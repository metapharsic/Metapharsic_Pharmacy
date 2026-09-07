<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\BatchStatus;
use App\Enums\PaymentMode;
use App\Enums\SaleStatus;
use App\Enums\StockTransactionType;
use App\Models\Customer;
use App\Models\MedicineBatch;
use App\Models\Payment;
use App\Models\ReturnItem;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SaleReturn;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Partial or later returns against an already-completed sale (ADR-0005: a forward
 * correction, never an edit of the original sale/sale_items).
 */
class ReturnService
{
    public function __construct(
        private readonly InventoryService $inventory,
    ) {
    }

    /**
     * @param  array<int, array{sale_item_id: int, quantity: int}>  $returnLines
     */
    public function processReturn(Sale $sale, array $returnLines, int $userId, ?string $reason): SaleReturn
    {
        return DB::transaction(function () use ($sale, $returnLines, $userId, $reason): SaleReturn {
            $sale = Sale::query()->lockForUpdate()->findOrFail($sale->id);
            $totalRefund = '0.00';

            /** @var list<array{sale_item: SaleItem, batch: MedicineBatch, quantity: int, refund: float}> $prepared */
            $prepared = [];

            foreach ($returnLines as $line) {
                $saleItem = SaleItem::query()->lockForUpdate()->findOrFail($line['sale_item_id']);

                if ($saleItem->sale_id !== $sale->id) {
                    throw new \InvalidArgumentException("Sale item #{$saleItem->id} does not belong to sale #{$sale->id}.");
                }

                $quantity = (int) $line['quantity'];
                $returnable = $saleItem->returnableQuantity();

                // DR-RET rule (T-0408a): quantity never exceeds sold minus already returned.
                if ($quantity <= 0 || $quantity > $returnable) {
                    throw new \InvalidArgumentException(
                        "Return quantity for sale item #{$saleItem->id} must be between 1 and {$returnable}."
                    );
                }

                // Same-batch restore only — never today's FEFO-nearest batch (T-0408b).
                $batch = MedicineBatch::query()->lockForUpdate()->findOrFail($saleItem->medicine_batch_id);

                // Refund value from the ORIGINAL line's figures, not today's prices
                // (DR-RET-07): proportional share of unit_price/discount/gst_rate.
                $perUnitTaxable = ((float) $saleItem->unit_price * $saleItem->quantity - (float) $saleItem->discount) / $saleItem->quantity;
                $perUnitGst = (float) $saleItem->gst_amount / $saleItem->quantity;
                $refundAmount = round(($perUnitTaxable + $perUnitGst) * $quantity, 2);

                $prepared[] = [
                    'sale_item' => $saleItem,
                    'batch' => $batch,
                    'quantity' => $quantity,
                    'refund' => $refundAmount,
                ];

                $totalRefund = bcadd($totalRefund, (string) $refundAmount, 2);
            }

            $saleReturn = SaleReturn::query()->create([
                'sale_id' => $sale->id,
                'user_id' => $userId,
                'return_date' => Carbon::now()->toDateString(),
                'total_refund' => $totalRefund,
                'reason' => $reason,
            ]);

            foreach ($prepared as $entry) {
                /** @var SaleItem $saleItem */
                $saleItem = $entry['sale_item'];
                /** @var MedicineBatch $batch */
                $batch = $entry['batch'];

                if ($batch->expiry_date->lt(Carbon::now()->toDateString())) {
                    // Expired-on-return: quarantine instead of restoring to sellable
                    // stock. Full quarantine workflow (separate holding location,
                    // write-off approval) is a later-phase stub — here we only make sure
                    // the unit does NOT silently become sellable again.
                    $batch->status = BatchStatus::Quarantined->value;
                    $batch->save();

                    // No stock_transactions row is written for a quarantined return: the
                    // physical unit is back in the shop but not in sellable inventory, so
                    // quantity_available (cave law 1/7) must not move for it. A future
                    // phase's quarantine ledger will own this movement explicitly.
                } else {
                    $this->inventory->receiveStock(
                        $batch,
                        $entry['quantity'],
                        StockTransactionType::SaleReturn->value,
                        referenceType: SaleReturn::class,
                        referenceId: $saleReturn->id,
                        note: sprintf('Return against invoice %s', $sale->invoice_no),
                    );
                }

                ReturnItem::query()->create([
                    'return_id' => $saleReturn->id,
                    'sale_item_id' => $saleItem->id,
                    'medicine_batch_id' => $batch->id,
                    'quantity' => $entry['quantity'],
                    'refund_amount' => $entry['refund'],
                ]);

                $saleItem->returned_quantity += $entry['quantity'];
                $saleItem->save();
            }

            // This schema's status set (completed/cancelled/partially_returned) has no
            // distinct "fully returned" value — any return, partial or full, moves a
            // completed sale to partially_returned. A full-return-only state is a later
            // schema decision, not one this migration set makes.
            $sale->status = SaleStatus::PartiallyReturned->value;
            $sale->save();

            if ($sale->customer_id !== null) {
                // Credit customer: reduce outstanding balance instead of a cash refund row.
                $customer = Customer::query()->lockForUpdate()->find($sale->customer_id);

                if ($customer !== null && (float) $customer->outstanding_balance > 0) {
                    $customer->outstanding_balance = max(0.0, (float) $customer->outstanding_balance - (float) $totalRefund);
                    $customer->save();
                } else {
                    Payment::query()->create([
                        'sale_id' => $sale->id,
                        'amount' => -1 * (float) $totalRefund,
                        'mode' => PaymentMode::Cash->value,
                        'reference_no' => 'RETURN-'.$saleReturn->id,
                        'paid_at' => Carbon::now(),
                    ]);
                }
            } else {
                Payment::query()->create([
                    'sale_id' => $sale->id,
                    'amount' => -1 * (float) $totalRefund,
                    'mode' => PaymentMode::Cash->value,
                    'reference_no' => 'RETURN-'.$saleReturn->id,
                    'paid_at' => Carbon::now(),
                ]);
            }

            return $saleReturn->fresh(['items']);
        });
    }
}
