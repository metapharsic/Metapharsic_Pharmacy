<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\PaymentMode;
use App\Enums\PaymentStatus;
use App\Enums\SaleStatus;
use App\Enums\StockTransactionType;
use App\Exceptions\Domain\CreditLimitExceededException;
use App\Exceptions\Domain\ExpiredBatchException;
use App\Exceptions\Domain\PrescriptionRequiredException;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\Prescription;
use App\Models\Sale;
use App\Models\SaleItem;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Orchestrates a POS checkout end to end inside one transaction. Cave law 8: never edits
 * or deletes a committed sale/sale_item/payment row — corrections are cancelSale() or
 * ReturnService::processReturn(), both of which write new rows.
 */
class SalesService
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly InvoiceService $invoices,
        private readonly SchemeEngine $schemes,
    ) {
    }

    /**
     * @param  array<int, array{medicine_id: int, quantity: int, discount?: float, prescription_number?: string|null, override?: bool, override_reason?: string|null}>  $cartLines
     * @param  array<int, array{mode: string, amount: float, reference_no?: string|null}>  $payments
     *
     * @throws ExpiredBatchException
     * @throws PrescriptionRequiredException
     * @throws CreditLimitExceededException
     */
    public function createSale(array $cartLines, ?int $customerId, int $userId, array $payments): Sale
    {
        return DB::transaction(function () use ($cartLines, $customerId, $userId, $payments): Sale {
            $today = Carbon::now()->toDateString();

            $lineSubtotal = '0.00';
            $lineDiscountTotal = '0.00';
            $lineGstTotal = '0.00';

            /** @var list<array{medicine_id: int, batch_id: int, quantity: int, unit_price: float, discount: float, discount_scheme_id: ?int, scheme_discount_amount: ?float, gst_rate: float, gst_amount: float, line_total: float, cost_price_at_sale: float}> $preparedLines */
            $preparedLines = [];

            /** @var list<array{medicine_id: int, prescription_number: ?string, override: bool, override_reason: ?string}> $prescriptionNotes */
            $prescriptionNotes = [];

            foreach ($cartLines as $lineIndex => $line) {
                $medicine = \App\Models\Medicine::query()->findOrFail($line['medicine_id']);
                $requestedQty = (int) $line['quantity'];
                $discountPercent = (float) ($line['discount'] ?? 0.0);

                // DR-RX-01/02: Schedule H items must carry a prescription number or an
                // explicit, reasoned override before the sale can complete.
                if ($medicine->is_prescription_required) {
                    $prescriptionNumber = $line['prescription_number'] ?? null;
                    $overridden = (bool) ($line['override'] ?? false);
                    $overrideReason = $line['override_reason'] ?? null;

                    if ($prescriptionNumber === null && ! $overridden) {
                        throw new PrescriptionRequiredException((int) $medicine->id, (int) $lineIndex);
                    }

                    if ($overridden && ($overrideReason === null || $overrideReason === '')) {
                        throw new PrescriptionRequiredException((int) $medicine->id, (int) $lineIndex);
                    }

                    $prescriptionNotes[] = [
                        'medicine_id' => (int) $medicine->id,
                        'prescription_number' => $prescriptionNumber,
                        'override' => $overridden,
                        'override_reason' => $overridden ? $overrideReason : null,
                    ];
                }

                // Cave law 4: FEFO allocation under a row lock, ORDER BY expiry_date ASC.
                $allocations = $this->inventory->allocateFefo((int) $medicine->id, $requestedQty);

                foreach ($allocations as $allocation) {
                    $batch = $allocation['batch'];
                    $qty = $allocation['qty'];

                    // Re-check expiry against the LOCKED row, not the pre-lock candidate
                    // list — allocateFefo() already filters expired batches out, but a
                    // batch expiring mid-transaction is re-asserted here defensively.
                    if ($batch->expiry_date->lte($today)) {
                        throw new ExpiredBatchException((int) $batch->id, $batch->expiry_date->toDateString());
                    }

                    $grossLineValue = round($batch->selling_price * $qty, 2);
                    $manualDiscountAmount = round($grossLineValue * $discountPercent / 100, 2);

                    // Cave law 1: SchemeEngine is discount-computation-only — it never
                    // touches stock_transactions/InventoryService, it only proposes a
                    // discount amount for this batch slice's gross value. The manual
                    // (cashier-entered) discount and the best auto-scheme discount do NOT
                    // stack — whichever is LARGER wins, so a cashier discounting on top of
                    // an automatic scheme can't silently double the discount.
                    $schemeResult = $this->schemes->bestSchemeFor($medicine, $qty, $grossLineValue);
                    $schemeDiscountAmount = $schemeResult['discount_amount'] ?? 0.0;

                    if ($schemeDiscountAmount > $manualDiscountAmount) {
                        $discountAmount = $schemeDiscountAmount;
                        $discountSchemeId = $schemeResult['scheme_id'];
                        $appliedSchemeDiscountAmount = $schemeDiscountAmount;
                    } else {
                        $discountAmount = $manualDiscountAmount;
                        $discountSchemeId = null;
                        $appliedSchemeDiscountAmount = null;
                    }

                    $taxable = $grossLineValue - $discountAmount;
                    $gstRate = (float) $medicine->gst_rate;
                    $gstAmount = round($taxable * $gstRate / 100, 2);
                    $lineTotal = $taxable + $gstAmount;

                    // Cave law 5/6: cost_price_at_sale is the batch's effective_cost, never
                    // recomputed later and never purchase_price directly.
                    $costPriceAtSale = (float) $batch->effective_cost;

                    $preparedLines[] = [
                        'medicine_id' => (int) $medicine->id,
                        'batch_id' => (int) $batch->id,
                        'quantity' => $qty,
                        'unit_price' => (float) $batch->selling_price,
                        'discount' => $discountAmount,
                        'discount_scheme_id' => $discountSchemeId,
                        'scheme_discount_amount' => $appliedSchemeDiscountAmount,
                        'gst_rate' => $gstRate,
                        'gst_amount' => $gstAmount,
                        'line_total' => $lineTotal,
                        'cost_price_at_sale' => $costPriceAtSale,
                    ];

                    $lineSubtotal = bcadd($lineSubtotal, (string) $grossLineValue, 2);
                    $lineDiscountTotal = bcadd($lineDiscountTotal, (string) $discountAmount, 2);
                    $lineGstTotal = bcadd($lineGstTotal, (string) $gstAmount, 2);
                }
            }

            $subtotal = (float) $lineSubtotal;
            $discountTotal = (float) $lineDiscountTotal;
            $gstTotal = (float) $lineGstTotal;
            $preRound = round($subtotal - $discountTotal + $gstTotal, 2);

            // DR-GST-08: round to the whole rupee; the difference lives ONLY in round_off,
            // bounded -0.50..+0.50. Line values are never nudged.
            $total = round($preRound, 0);
            $roundOff = round($total - $preRound, 2);

            $customer = $customerId !== null ? Customer::query()->lockForUpdate()->findOrFail($customerId) : null;

            $paidTotal = array_sum(array_map(static fn (array $p): float => (float) $p['amount'], $payments));
            $hasCredit = collect($payments)->contains(static fn (array $p): bool => $p['mode'] === PaymentMode::Credit->value);

            if ($hasCredit) {
                if ($customer === null) {
                    throw new \InvalidArgumentException('A credit payment requires a customer.');
                }

                $creditPortion = collect($payments)
                    ->where('mode', PaymentMode::Credit->value)
                    ->sum('amount');

                $newOutstanding = (float) $customer->outstanding_balance + $creditPortion;

                // DR-CRED-02: block when outstanding + this bill's due exceeds the limit.
                if ($newOutstanding > (float) $customer->credit_limit) {
                    throw new CreditLimitExceededException(
                        (int) $customer->id,
                        number_format((float) $customer->outstanding_balance, 2, '.', ''),
                        number_format((float) $customer->credit_limit, 2, '.', ''),
                        number_format($newOutstanding - (float) $customer->credit_limit, 2, '.', ''),
                    );
                }
            }

            $due = round($total - $paidTotal, 2);
            $paymentStatus = match (true) {
                $due <= 0.0 => PaymentStatus::Paid,
                $paidTotal > 0.0 => PaymentStatus::Partial,
                default => PaymentStatus::Unpaid,
            };

            // Deduct stock per batch slice BEFORE the invoice number is allocated — cave
            // law 1/4 and ADR-0007 rule 1 (the counter lock is the very last thing taken).
            foreach ($preparedLines as $prepared) {
                $batch = \App\Models\MedicineBatch::query()->lockForUpdate()->findOrFail($prepared['batch_id']);
                $this->inventory->deductStock(
                    $batch,
                    $prepared['quantity'],
                    StockTransactionType::Sale->value,
                    referenceType: SaleItem::class,
                    referenceId: null, // sale_item id not yet known; note carries the batch/line context
                    note: sprintf('POS sale, medicine #%d', $prepared['medicine_id']),
                );
            }

            // ADR-0006/0007: allocate the invoice number LAST, immediately before the
            // `sales` insert. Nothing above this line touches invoice_counters.
            $invoiceNo = $this->invoices->nextInvoiceNumber('PHARM');

            $sale = Sale::query()->create([
                'invoice_no' => $invoiceNo,
                'customer_id' => $customerId,
                'user_id' => $userId,
                'sale_date' => $today,
                'subtotal' => $subtotal,
                'discount' => $discountTotal,
                'gst_amount' => $gstTotal,
                'round_off' => $roundOff,
                'total' => $total,
                'paid' => $paidTotal,
                'due' => $due,
                'payment_status' => $paymentStatus->value,
                'status' => SaleStatus::Completed->value,
            ]);

            foreach ($preparedLines as $prepared) {
                SaleItem::query()->create([
                    'sale_id' => $sale->id,
                    'medicine_id' => $prepared['medicine_id'],
                    'medicine_batch_id' => $prepared['batch_id'],
                    'quantity' => $prepared['quantity'],
                    'unit_price' => $prepared['unit_price'],
                    'discount' => $prepared['discount'],
                    'discount_scheme_id' => $prepared['discount_scheme_id'],
                    'scheme_discount_amount' => $prepared['scheme_discount_amount'],
                    'gst_rate' => $prepared['gst_rate'],
                    'gst_amount' => $prepared['gst_amount'],
                    'line_total' => $prepared['line_total'],
                    'cost_price_at_sale' => $prepared['cost_price_at_sale'],
                ]);
            }

            foreach ($payments as $payment) {
                Payment::query()->create([
                    'sale_id' => $sale->id,
                    'amount' => $payment['amount'],
                    'mode' => $payment['mode'],
                    'reference_no' => $payment['reference_no'] ?? null,
                    'paid_at' => Carbon::now(),
                ]);
            }

            foreach ($prescriptionNotes as $note) {
                Prescription::query()->firstOrCreate(
                    ['sale_id' => $sale->id],
                    [
                        'prescription_number' => $note['prescription_number'],
                        'doctor_name' => null,
                        'overridden_by' => $note['override'] ? $userId : null,
                        'override_reason' => $note['override_reason'],
                    ],
                );
            }

            if ($hasCredit && $customer !== null) {
                $creditPortion = collect($payments)
                    ->where('mode', PaymentMode::Credit->value)
                    ->sum('amount');

                $customer->outstanding_balance = (float) $customer->outstanding_balance + $creditPortion;
                $customer->save();
            }

            return $sale->fresh(['items', 'payments', 'prescription']);
        });
    }

    /**
     * Same-day cancellation only (ADR-0005). Reverses every sale_item's stock via
     * InventoryService::receiveStock() and writes a negative Payment row. Never edits or
     * deletes the original sale/sale_items rows (cave law 8) — the invoice number is
     * consumed and never reused.
     */
    public function cancelSale(Sale $sale, int $userId): void
    {
        DB::transaction(function () use ($sale, $userId): void {
            $sale = Sale::query()->lockForUpdate()->findOrFail($sale->id);

            if ($sale->sale_date->toDateString() !== Carbon::now()->toDateString()) {
                throw new \RuntimeException('A sale can only be cancelled on the same business day it was billed (ADR-0005).');
            }

            if ($sale->status === SaleStatus::Cancelled) {
                throw new \RuntimeException('Sale is already cancelled.');
            }

            $items = $sale->items()->lockForUpdate()->get();

            foreach ($items as $item) {
                $batch = \App\Models\MedicineBatch::query()->lockForUpdate()->findOrFail($item->medicine_batch_id);

                // No literal "sale_cancellation" case exists on StockTransactionType
                // (phase-3 enum, not redefined here) — SaleReturn is reused deliberately,
                // per this task's instruction, to reverse the exact quantity sold.
                $this->inventory->receiveStock(
                    $batch,
                    $item->quantity,
                    StockTransactionType::SaleReturn->value,
                    referenceType: Sale::class,
                    referenceId: $sale->id,
                    note: sprintf('Same-day cancellation of invoice %s', $sale->invoice_no),
                );
            }

            Payment::query()->create([
                'sale_id' => $sale->id,
                'amount' => -1 * (float) $sale->paid,
                'mode' => PaymentMode::Cash->value,
                'reference_no' => 'CANCEL-'.$sale->invoice_no,
                'paid_at' => Carbon::now(),
            ]);

            $sale->status = SaleStatus::Cancelled->value;
            $sale->payment_status = PaymentStatus::Refunded->value;
            $sale->paid = 0;
            $sale->due = 0;
            $sale->save();
        });
    }
}
