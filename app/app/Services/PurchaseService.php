<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\BatchStatus;
use App\Enums\PurchaseStatus;
use App\Enums\StockTransactionType;
use App\Models\MedicineBatch;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Purchase lifecycle: draft -> confirmed (moves stock through InventoryService) -> optionally
 * cancelled (reverses stock, never deletes). T-0304/T-0304a/T-0305.
 */
class PurchaseService
{
    public function __construct(
        private readonly InventoryService $inventory,
    ) {
    }

    /**
     * Confirm a draft purchase: for each line, find-or-create the batch keyed on
     * (medicine_id, batch_no, expiry_date) — the central integrity rule in
     * brain/02-database-schema.md §6 — compute `effective_cost`, move stock in via
     * `InventoryService::receiveStock()`, and raise the supplier's outstanding balance.
     */
    public function confirm(Purchase $purchase, ?User $actor = null): void
    {
        DB::transaction(function () use ($purchase, $actor): void {
            $purchase = Purchase::query()->whereKey($purchase->getKey())->lockForUpdate()->firstOrFail();

            if ($purchase->status !== PurchaseStatus::Draft) {
                throw new \DomainException('Only a draft purchase can be confirmed.');
            }

            foreach ($purchase->items()->get() as $item) {
                $this->receiveLine($purchase, $item, $actor);
            }

            $purchase->status = PurchaseStatus::Confirmed;
            $purchase->save();

            // T-0304a: supplier outstanding rises by the invoice's due amount on confirm.
            $supplier = $purchase->supplier()->lockForUpdate()->first();
            $supplier->outstanding_balance = bcadd(
                (string) $supplier->outstanding_balance,
                (string) $purchase->due_amount,
                2,
            );
            $supplier->save();
        });
    }

    private function receiveLine(Purchase $purchase, PurchaseItem $item, ?User $actor): void
    {
        $totalUnits = $item->quantity + $item->free_quantity;
        // DR-FREE-03: taxable line cost / (quantity + free_quantity), rounded to the paisa.
        $effectiveCost = bcdiv((string) $item->line_total, (string) $totalUnits, 2);

        // The central integrity rule (brain/02-database-schema.md §6): same physical batch
        // received twice lands in one row, added to, never split.
        $batch = MedicineBatch::query()
            ->where('medicine_id', $item->medicine_id)
            ->where('batch_no', $item->batch_no)
            ->where('expiry_date', $item->expiry_date)
            ->lockForUpdate()
            ->first();

        if ($batch === null) {
            $batch = MedicineBatch::create([
                'medicine_id' => $item->medicine_id,
                'batch_no' => $item->batch_no,
                'expiry_date' => $item->expiry_date,
                'purchase_price' => $item->purchase_price,
                'selling_price' => $item->selling_price,
                'mrp' => $item->mrp,
                'effective_cost' => $effectiveCost,
                'quantity_received' => $totalUnits,
                'quantity_available' => 0, // InventoryService::receiveStock() raises this below.
                'status' => BatchStatus::Available,
                'purchase_item_id' => $item->getKey(),
                'supplier_id' => $purchase->supplier_id,
            ]);
        } else {
            // DR-FREE-06: re-receiving the same batch recomputes effective_cost as a
            // weighted average over existing on-hand quantity and the incoming quantity.
            // Already-sold items keep the snapshot they were sold at.
            $existingQty = $batch->quantity_available;
            $existingValue = bcmul((string) $existingQty, (string) $batch->effective_cost, 2);
            $incomingValue = bcmul((string) $totalUnits, $effectiveCost, 2);
            $newTotalQty = $existingQty + $totalUnits;

            $batch->effective_cost = $newTotalQty > 0
                ? bcdiv(bcadd($existingValue, $incomingValue, 2), (string) $newTotalQty, 2)
                : $effectiveCost;
            $batch->purchase_price = $item->purchase_price;
            $batch->selling_price = $item->selling_price;
            $batch->mrp = $item->mrp;
            $batch->quantity_received += $totalUnits;
            $batch->purchase_item_id ??= $item->getKey();
            $batch->supplier_id ??= $purchase->supplier_id;
            $batch->save();
        }

        $this->inventory->receiveStock(
            batch: $batch,
            qty: $totalUnits,
            type: StockTransactionType::Purchase->value,
            referenceType: PurchaseItem::class,
            referenceId: $item->getKey(),
            note: sprintf('Purchase %s confirmed', $purchase->invoice_no),
            actor: $actor,
        );
    }

    /**
     * Cancel a confirmed purchase: reverse every line's stock movement via `deductStock()`
     * (mirrored, opposite-sign ledger rows — never a delete, never an update to the
     * original rows) and lower the supplier's outstanding balance back down. Cancelling a
     * draft is a plain status change; no stock was ever moved for it.
     */
    public function cancel(Purchase $purchase, ?User $actor = null): void
    {
        DB::transaction(function () use ($purchase, $actor): void {
            $purchase = Purchase::query()->whereKey($purchase->getKey())->lockForUpdate()->firstOrFail();

            if ($purchase->status === PurchaseStatus::Cancelled) {
                throw new \DomainException('Purchase is already cancelled.');
            }

            if ($purchase->status === PurchaseStatus::Confirmed) {
                foreach ($purchase->items()->get() as $item) {
                    // purchase_items has no medicine_batch_id column in this schema — resolve
                    // the batch the same way confirm() found/created it.
                    $batch = MedicineBatch::query()
                        ->where('medicine_id', $item->medicine_id)
                        ->where('batch_no', $item->batch_no)
                        ->where('expiry_date', $item->expiry_date)
                        ->lockForUpdate()
                        ->first();

                    if ($batch === null) {
                        continue; // Nothing to reverse against; already reported by stock:verify if this ever happens.
                    }

                    $totalUnits = $item->quantity + $item->free_quantity;

                    $this->inventory->deductStock(
                        batch: $batch,
                        qty: $totalUnits,
                        type: StockTransactionType::PurchaseReturn->value,
                        referenceType: PurchaseItem::class,
                        referenceId: $item->getKey(),
                        note: sprintf('Purchase %s cancelled — reversing receipt', $purchase->invoice_no),
                        actor: $actor,
                    );
                }

                $supplier = $purchase->supplier()->lockForUpdate()->first();
                $supplier->outstanding_balance = bcsub(
                    (string) $supplier->outstanding_balance,
                    (string) $purchase->due_amount,
                    2,
                );
                $supplier->save();
            }

            $purchase->status = PurchaseStatus::Cancelled;
            $purchase->save();
        });
    }
}
