<?php

declare(strict_types=1);

use App\Enums\StockTransactionType;
use App\Models\MedicineBatch;
use App\Models\StockTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * php artisan stock:verify — cave law 7: batch.quantity_available must
 * always equal SUM(stock_transactions.quantity_change) for that batch.
 * See brain/07-testing-strategy.md §5.
 */
uses(RefreshDatabase::class);

it('exits 0 when the ledger is clean', function () {
    $batch = MedicineBatch::factory()->create(['quantity_available' => 0]);

    // Built through InventoryService in real code paths; here we assert the
    // command against a batch whose ledger is already consistent by
    // construction (a single opening_stock movement matching the balance).
    StockTransaction::factory()->create([
        'medicine_batch_id' => $batch->id,
        'type' => StockTransactionType::OpeningStock,
        'quantity_change' => 10,
        'balance_after' => 10,
    ]);
    $batch->update(['quantity_available' => 10]);

    $this->artisan('stock:verify')->assertExitCode(0);
});

it('exits 1 when a ledger is deliberately corrupted', function () {
    $batch = MedicineBatch::factory()->create(['quantity_available' => 0]);

    StockTransaction::factory()->create([
        'medicine_batch_id' => $batch->id,
        'type' => StockTransactionType::OpeningStock,
        'quantity_change' => 10,
        'balance_after' => 10,
    ]);

    // Deliberately desynchronise the cached column from the ledger sum.
    // This is the one place a test is allowed to write quantity_available
    // directly — it exists to simulate corruption for stock:verify to
    // catch, per the factory rule in brain/07-testing-strategy.md §4.
    $batch->forceFill(['quantity_available' => 999])->saveQuietly();

    $this->artisan('stock:verify')
        ->assertExitCode(1)
        ->expectsOutputToContain((string) $batch->id);
});
