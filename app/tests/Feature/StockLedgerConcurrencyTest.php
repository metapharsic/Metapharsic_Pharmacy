<?php

declare(strict_types=1);

use App\Enums\BatchStatus;
use App\Models\MedicineBatch;
use App\Services\InventoryService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Support\Facades\DB;

/**
 * ADR-0007 / DR-TRAP-01: "two tills sell the last unit" — a batch of
 * quantity 1, two attempts to deduct it, exactly one succeeds and
 * quantity_available never goes negative.
 *
 * Honest limitation, per brain/07-testing-strategy.md §3: RefreshDatabase
 * wraps each test in one rolled-back transaction, so a second PDO
 * connection would see an empty database and the "race" would pass for the
 * wrong reason. This file therefore uses DatabaseTruncation (not
 * RefreshDatabase) plus a second, genuinely separate connection
 * (`pgsql_test_b`, configured in config/database.php as a distinct PDO
 * handle to the same test database) so the two locking reads are real.
 *
 * What this file does NOT attempt: true wall-clock-simultaneous execution
 * of two PHP call stacks. PHP in this test process is single-threaded, so
 * "concurrent" here means connection A takes and holds the row lock first,
 * connection B's lock attempt is proven to block via a short lock_timeout
 * (a deterministic proxy for contention, not a sleep), and only after A
 * commits does B's transaction proceed and fail on quantity. This is the
 * practical approach the brain document itself prescribes, and it is
 * weaker than the "4+ terminals hammering the same batch" load test that
 * ADR-0007 also requires manually before the Phase 4 exit gate (see the
 * documented manual psql procedure below, and
 * logs/build-log.md for its recorded run).
 */
uses(DatabaseTruncation::class)->group('concurrency');

it('lets only one till deduct the last unit of a batch', function () {
    $batch = MedicineBatch::factory()->create([
        'quantity_available' => 1,
        'status' => BatchStatus::Available,
    ]);

    \App\Models\StockTransaction::factory()->create([
        'medicine_batch_id' => $batch->id,
        'medicine_id' => $batch->medicine_id,
        'type' => \App\Enums\StockTransactionType::OpeningStock,
        'quantity_change' => 1,
        'balance_after' => 1,
    ]);

    // Connection A: lock the row and hold it open.
    DB::connection('pgsql')->beginTransaction();
    DB::connection('pgsql')->table('medicine_batches')
        ->where('id', $batch->id)
        ->lockForUpdate()
        ->first();

    // Connection B: must not be able to take the same lock while A holds it.
    // A short, explicit lock_timeout turns "would it block forever" into a
    // deterministic, fast assertion instead of a sleep-based race.
    DB::connection('pgsql_test_b')->statement("SET lock_timeout = '400ms'");

    expect(function () use ($batch) {
        DB::connection('pgsql_test_b')->transaction(function () use ($batch) {
            DB::connection('pgsql_test_b')->table('medicine_batches')
                ->where('id', $batch->id)
                ->lockForUpdate()
                ->first();
        });
    })->toThrow(QueryException::class); // Postgres 55P03 lock_not_available

    // A deducts the only unit through the one door (InventoryService) and commits.
    app(InventoryService::class)->deductStock($batch->fresh(), 1, null);
    DB::connection('pgsql')->commit();

    // B, retrying after A's commit, now sees quantity_available = 0 and must fail
    // on business rules (insufficient stock), not on the lock.
    expect(fn () => app(InventoryService::class)->deductStock($batch->fresh(), 1, null))
        ->toThrow(\App\Exceptions\Domain\StockLedgerMismatchException::class);

    expect($batch->fresh()->quantity_available)->toBe(0)
        ->and($batch->fresh()->quantity_available)->toBeGreaterThanOrEqual(0);

    // Cave law 7: the ledger must reconcile after the race, not just the
    // batch's cached column.
    $this->artisan('stock:verify')->assertExitCode(0);
})->group('concurrency');

/**
 * Documented manual procedure for the 4+ terminal case ADR-0007 requires
 * before the Phase 4 exit gate, which this automated two-connection test
 * cannot fully substitute for:
 *
 *   1. Seed one medicine with one batch of quantity_available = 1.
 *   2. Open four `psql` sessions against the same database.
 *   3. In each session: BEGIN; SELECT * FROM medicine_batches WHERE id = :id FOR UPDATE;
 *      — only one returns immediately, the other three block.
 *   4. COMMIT the first session, observe exactly one of the remaining three
 *      unblocks next, repeat until all four have attempted.
 *   5. Repeat through the actual application with four browsers/terminals
 *      on the last unit of one medicine, saving within the same second.
 *      Expect exactly one successful sale and three clear "0 left" messages.
 *   6. Record the run in logs/build-log.md per the Phase 3 exit checklist.
 */
