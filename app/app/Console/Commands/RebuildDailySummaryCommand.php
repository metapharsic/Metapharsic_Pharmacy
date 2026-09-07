<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\DailySalesSummary;
use App\Models\SaleItem;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * `summary:rebuild {date?}` — the nightly job that keeps the dashboard cheap
 * without Redis (brain/01-architecture.md §6). Scheduled 00:30 daily
 * (Asia/Kolkata) for the previous day; also runnable on demand for
 * back-dated corrections after a late return or purchase edit.
 *
 * This command is the ONLY writer of daily_sales_summary. The upsert on
 * `summary_date` makes two runs over the same day produce identical rows
 * (idempotent — see T-0501b / SummaryRebuildIdempotencyTest.php).
 *
 * This table is a cache, not a ledger: recomputing it from sales/sale_items
 * is always safe and loses nothing (contrast with cave law 8 — sales
 * themselves are stone, this summary of them is not).
 */
final class RebuildDailySummaryCommand extends Command
{
    protected $signature = 'summary:rebuild {date? : Y-m-d, defaults to yesterday}';

    protected $description = 'Rebuild daily_sales_summary for one day from sales/sale_items (idempotent upsert).';

    public function handle(): int
    {
        $dateArg = $this->argument('date');
        $date = $dateArg !== null ? Carbon::parse($dateArg) : Carbon::yesterday();
        $day = $date->toDateString();

        try {
            $totals = $this->computeTotals($day);

            DailySalesSummary::query()->updateOrCreate(
                ['summary_date' => $day],
                [
                    'total_sales' => $totals['total_sales'],
                    'total_purchases' => $totals['total_purchases'],
                    'total_profit' => $totals['total_profit'],
                    'bill_count' => $totals['bill_count'],
                    'generated_at' => Carbon::now(),
                ],
            );

            $this->info("summary:rebuild — {$day} rebuilt ({$totals['bill_count']} bills).");

            return self::SUCCESS;
        } catch (\Throwable $e) {
            Log::error('summary:rebuild failed', ['date' => $day, 'exception' => $e]);
            $this->error("summary:rebuild failed for {$day}: {$e->getMessage()}");

            // Non-fatal to the shop: the dashboard falls back to a live
            // query when rebuilt_at/generated_at is stale (brain/01 §6).
            return self::FAILURE;
        }
    }

    /**
     * @return array{total_sales:string, total_purchases:string, total_profit:string, bill_count:int}
     */
    private function computeTotals(string $day): array
    {
        $sales = DB::table('sales')
            ->whereDate('sale_date', $day)
            ->where('status', '!=', 'cancelled')
            ->selectRaw('COUNT(*) as bill_count, COALESCE(SUM(total), 0) as total_sales')
            ->first();

        $purchases = DB::table('purchases')
            ->whereDate('invoice_date', $day)
            ->where('status', 'confirmed')
            ->sum('total');

        // Cave law 6: profit reads cost_price_at_sale ONLY — never a live
        // join to medicine_batches.effective_cost. See ReportService for the
        // full explanation; this is the same formula, precomputed here.
        $profit = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->whereDate('sales.sale_date', $day)
            ->where('sales.status', '!=', 'cancelled')
            ->selectRaw('COALESCE(SUM(sale_items.line_total - sale_items.cost_price_at_sale * sale_items.quantity), 0) as total_profit')
            ->value('total_profit');

        return [
            'total_sales' => (string) ($sales->total_sales ?? '0.00'),
            'total_purchases' => (string) $purchases,
            'total_profit' => (string) $profit,
            'bill_count' => (int) ($sales->bill_count ?? 0),
        ];
    }
}
