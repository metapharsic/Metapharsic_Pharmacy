<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\BatchStatus;
use App\Enums\StockTransactionType;
use App\Exceptions\Domain\InsufficientStockException;
use App\Exceptions\Domain\StockLedgerMismatchException;
use App\Models\MedicineBatch;
use App\Models\StockTransaction;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * THE single door for stock (ADR-0003, cave law 1). No controller, job, or seeder may write
 * `medicine_batches.quantity_available` directly — every quantity change flows through
 * `receiveStock()` / `deductStock()`, each of which updates the batch balance and inserts
 * the matching `stock_transactions` row atomically.
 *
 * This service does NOT open its own `DB::transaction()` around the two-write pair — see
 * the method docblocks — but each individual write pair (locked read -> update -> insert)
 * happens inside one statement group with no other query between them, so the pair can
 * never be observed half-applied by another connection even without an explicit wrapper.
 * The CALLER is responsible for the outer transaction (e.g. `PurchaseService::confirm()`),
 * because the caller is the one who knows what else must succeed or fail with the movement.
 */
class InventoryService
{
    /**
     * Record stock coming IN. Increments `quantity_available`, flips a `finished` batch
     * back to `available` if stock is re-added to it, and writes the ledger row.
     */
    public function receiveStock(
        MedicineBatch $batch,
        int $qty,
        string $type,
        ?string $referenceType,
        ?int $referenceId,
        ?string $note = null,
        ?User $actor = null,
    ): StockTransaction {
        if ($qty <= 0) {
            throw new \InvalidArgumentException('receiveStock() requires a positive quantity.');
        }

        return $this->applyDelta($batch, $qty, StockTransactionType::from($type), $referenceType, $referenceId, $note, $actor);
    }

    /**
     * Record stock going OUT. Decrements `quantity_available`. Throws
     * `StockLedgerMismatchException` if the resulting balance would be negative — cave law 7
     * enforced at the moment of write, not just detected later by `stock:verify`.
     */
    public function deductStock(
        MedicineBatch $batch,
        int $qty,
        string|StockTransactionType|null $type = null,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?string $note = null,
        ?User $actor = null,
    ): StockTransaction {
        if ($qty <= 0) {
            throw new \InvalidArgumentException('deductStock() requires a positive quantity (the sign is applied internally).');
        }

        $transactionType = match (true) {
            $type instanceof StockTransactionType => $type,
            is_string($type) => StockTransactionType::from($type),
            default => StockTransactionType::Sale,
        };

        return $this->applyDelta($batch, -$qty, $transactionType, $referenceType, $referenceId, $note, $actor);
    }

    private function applyDelta(
        MedicineBatch $batch,
        int $delta,
        StockTransactionType $type,
        ?string $referenceType,
        ?int $referenceId,
        ?string $note,
        ?User $actor,
    ): StockTransaction {
        // Re-read the current balance from the (assumed already-locked, per lockBatchesForUpdate())
        // in-memory model. Callers on the hot FEFO path lock via lockBatchesForUpdate() before
        // ever constructing the batch they pass in here.
        $resultingBalance = $batch->quantity_available + $delta;

        // Cave law 7 backstop at the service layer, ahead of the DB CHECK constraint.
        if ($resultingBalance < 0) {
            throw StockLedgerMismatchException::forNegativeBalance($batch, $delta, $resultingBalance);
        }

        $batch->quantity_available = $resultingBalance;

        if ($resultingBalance === 0 && $batch->status === BatchStatus::Available) {
            $batch->status = BatchStatus::Finished;
        } elseif ($resultingBalance > 0 && $batch->status === BatchStatus::Finished) {
            // Stock re-added to a finished batch (e.g. a sale reversal) makes it sellable again.
            $batch->status = BatchStatus::Available;
        }

        $batch->save();

        return StockTransaction::create([
            'medicine_id' => $batch->medicine_id,
            'medicine_batch_id' => $batch->getKey(),
            'type' => $type,
            'quantity_change' => $delta,
            'balance_after' => $resultingBalance,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'user_id' => $actor?->getKey(),
            'note' => $note,
        ]);
    }

    /**
     * Cave law 4 / ADR-0007 rule 2: lock candidate batch rows in one statement, ascending
     * `id`, and in that order only. Fixed lock ordering is what prevents two concurrent
     * tills selling the same fast-moving medicine from deadlocking against each other.
     *
     * @param  Collection<int, int>  $batchIds
     * @return Collection<int, MedicineBatch>
     */
    public function lockBatchesForUpdate(Collection $batchIds): Collection
    {
        if ($batchIds->isEmpty()) {
            return collect();
        }

        return MedicineBatch::query()
            ->whereIn('id', $batchIds->all())
            ->orderBy('id', 'asc')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');
    }

    /**
     * DR-FEFO-01..08: allocate `$quantityNeeded` units of one medicine across its sellable
     * batches, nearest expiry first, inside a row lock. Must be called from inside the
     * caller's own `DB::transaction()` — locking only means something inside a transaction.
     *
    /**
     * @return array<int, \App\DTO\StockAllocation>
     *
     * @throws InsufficientStockException when locked, re-validated stock cannot cover demand
     */
    public function allocateFefo(\App\Models\Medicine|int $medicine, int $quantityNeeded): array
    {
        $medicineId = $medicine instanceof \App\Models\Medicine ? (int) $medicine->id : (int) $medicine;

        if ($quantityNeeded <= 0) {
            throw new \InvalidArgumentException('allocateFefo() requires a positive quantity.');
        }

        // Step 1 (DR-FEFO §2.2 step 2): discover candidates, no lock, over-fetch every
        // sellable batch rather than just enough to cover demand.
        $candidateIds = MedicineBatch::query()
            ->where('medicine_id', $medicineId)
            ->sellable()
            ->orderBy('expiry_date', 'asc')
            ->orderBy('id', 'asc')
            ->pluck('id');

        // Step 2 (DR-FEFO-04 / ADR-0007 rule 2): lock in one statement, ascending id — never
        // in expiry order, so two concurrent allocations can never lock in opposite order.
        $locked = $this->lockBatchesForUpdate($candidateIds);

        // Step 3 (DR-FEFO §2.2 step 6): re-validate against the locked, truthful rows —
        // screen/candidate data is already stale by the time the lock is held.
        $sellableLocked = $locked
            ->filter(static fn (MedicineBatch $batch): bool => $batch->quantity_available > 0
                && $batch->status === BatchStatus::Available
                && $batch->expiry_date->greaterThan(now()->toDateString()))
            ->sortBy([
                ['expiry_date', 'asc'],
                ['id', 'asc'],
            ])
            ->values();

        $remaining = $quantityNeeded;
        $allocations = [];

        foreach ($sellableLocked as $batch) {
            if ($remaining <= 0) {
                break;
            }

            $take = min($remaining, $batch->quantity_available);

            if ($take <= 0) {
                continue;
            }

            $allocations[] = new \App\DTO\StockAllocation($batch, $take);
            $remaining -= $take;
        }

        if ($remaining > 0) {
            // DR-FEFO-06: reject the whole allocation, never apply it partially.
            $available = $quantityNeeded - $remaining;

            throw new InsufficientStockException($medicineId, $quantityNeeded, $available);
        }

        return $allocations;
    }
}
