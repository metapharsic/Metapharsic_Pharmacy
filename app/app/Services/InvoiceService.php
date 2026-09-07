<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\InvoiceCounter;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * ADR-0006 / ADR-0007: the ONLY door invoice numbers come from. `nextInvoiceNumber()` must
 * be called LAST inside the sale transaction, immediately before the `sales` insert —
 * never at cart-open, never on hold, never anywhere earlier in checkout. This method does
 * nothing but lock, read, and increment the counter row; no tax computation, no FEFO
 * allocation, no payment processing may run inside the span this lock is held (ADR-0007
 * rule 1). Callers: SalesService::createSale() only.
 */
class InvoiceService
{
    /**
     * @throws \RuntimeException if called outside an open transaction — the lock this
     *                            method takes is meaningless without one
     */
    public function nextInvoiceNumber(string $series): string
    {
        if (DB::transactionLevel() < 1) {
            throw new \RuntimeException(
                'InvoiceService::nextInvoiceNumber() must run inside the caller\'s sale transaction (ADR-0006/0007).'
            );
        }

        $financialYear = $this->currentFinancialYear();

        // SELECT ... FOR UPDATE: the row lock ADR-0006 mandates. Nothing else runs between
        // this lock and the increment below — the shortest possible span (ADR-0007 rule 1).
        $counter = InvoiceCounter::query()
            ->where('series', $series)
            ->where('financial_year', $financialYear)
            ->lockForUpdate()
            ->first();

        if ($counter === null) {
            // First use of this series/year: seed the row under the same lock semantics —
            // the unique(series, financial_year) constraint is the backstop against a race
            // creating two counter rows for the same key.
            $counter = InvoiceCounter::create([
                'series' => $series,
                'financial_year' => $financialYear,
                'last_number' => 0,
            ]);
        }

        $nextNumber = $counter->last_number + 1;
        $counter->last_number = $nextNumber;
        $counter->save();

        return sprintf('%s/%s/%05d', $series, $financialYear, $nextNumber);
    }

    /**
     * Indian financial year, 1 April - 31 March, e.g. August 2026 -> '26-27'. Derived from
     * the current date, never cached across a long-running process.
     */
    private function currentFinancialYear(): string
    {
        $today = Carbon::now();
        $startYear = $today->month >= 4 ? $today->year : $today->year - 1;
        $endYear = $startYear + 1;

        return sprintf('%02d-%02d', $startYear % 100, $endYear % 100);
    }
}
