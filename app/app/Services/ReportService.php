<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\DailySalesSummary;
use App\Models\MedicineBatch;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockTransaction;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Read-only aggregation for dashboards and reports.
 *
 * Per brain/01-architecture.md §3: ReportService never writes business data,
 * never opens a DB::transaction(), and owns the summary-table/live-query
 * selection per report. Controllers call these methods directly and either
 * hand the result to a view or stream it as CSV — no calculation belongs in
 * the controller.
 *
 * > Cave law 2: cost never reaches a cashier's or pharmacist's browser. This
 * > service does not enforce that by itself — the caller (ReportController)
 * > must Gate-check report.profit / report.valuation before calling the cost
 * > bearing methods here. This service assumes it is only ever invoked by a
 * > caller that has already authorised the request.
 */
final class ReportService
{
    /**
     * Dashboard tile for a single day. For "today" the caller (typically
     * DashboardController) should wrap this in Cache::remember() per
     * brain/01 §6 — this method itself always runs live and does not cache.
     *
     * For any day that already has a daily_sales_summary row, prefer reading
     * that row directly (see DashboardController::index()) rather than this
     * method, which recomputes live from sale_items.
     */
    public function dailySalesSummary(Carbon $date): array
    {
        $day = $date->toDateString();

        $sales = Sale::query()
            ->whereDate('sale_date', $day)
            ->where('status', '!=', 'cancelled')
            ->selectRaw('COUNT(*) as bill_count, COALESCE(SUM(total), 0) as total_sales')
            ->first();

        // Cave law 6: profit is computed ONLY from the cost_price_at_sale
        // snapshot on sale_items. This NEVER joins medicine_batches for cost
        // — the batch's current effective_cost may have changed since the
        // sale, and history must not move (ADR-0005, ADR-0002).
        $profit = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->whereDate('sales.sale_date', $day)
            ->where('sales.status', '!=', 'cancelled')
            ->selectRaw('COALESCE(SUM(sale_items.line_total - sale_items.cost_price_at_sale * sale_items.quantity), 0) as total_profit')
            ->value('total_profit');

        $purchases = DB::table('purchases')
            ->whereDate('invoice_date', $day)
            ->where('status', 'confirmed')
            ->sum('total');

        return [
            'summary_date' => $day,
            'bill_count' => (int) ($sales->bill_count ?? 0),
            'total_sales' => (string) ($sales->total_sales ?? '0.00'),
            'total_purchases' => (string) $purchases,
            'total_profit' => (string) $profit,
        ];
    }

    /**
     * Sales report over a date range, optionally by cashier. No cost is
     * selected here — this is a top-line revenue report, safe for any
     * report.view-permitted role.
     */
    public function salesReport(Carbon $from, Carbon $to, ?int $userId = null): Collection
    {
        $query = Sale::query()
            ->whereBetween('sale_date', [$from->toDateString(), $to->toDateString()])
            ->where('status', '!=', 'cancelled')
            ->when($userId !== null, fn ($q) => $q->where('user_id', $userId))
            ->selectRaw(
                'sale_date, user_id, COUNT(*) as bill_count, ' .
                'SUM(subtotal) as subtotal, SUM(discount) as discount, ' .
                'SUM(subtotal - discount) as taxable_amount, SUM(gst_amount) as gst_amount, ' .
                'SUM(total) as total'
            )
            ->groupBy('sale_date', 'user_id')
            ->orderBy('sale_date');

        return $query->get();
    }

    /**
     * Purchase report over a date range, optionally by supplier. Purchase
     * price is visible here by design (purchasing itself is not a
     * cashier-facing screen) — this is not the cost-visibility boundary,
     * report.profit / report.valuation are.
     */
    public function purchaseReport(Carbon $from, Carbon $to, ?int $supplierId = null): Collection
    {
        return DB::table('purchases')
            ->whereBetween('invoice_date', [$from->toDateString(), $to->toDateString()])
            ->where('status', 'confirmed')
            ->when($supplierId !== null, fn ($q) => $q->where('supplier_id', $supplierId))
            ->selectRaw(
                'supplier_id, COUNT(*) as purchase_count, ' .
                'SUM(subtotal - discount) as taxable_amount, SUM(gst_amount) as gst_amount, ' .
                'SUM(total) as total'
            )
            ->groupBy('supplier_id')
            ->orderBy('supplier_id')
            ->get();
    }

    /**
     * Profit report, admin-only at the controller/Gate layer (report.profit).
     *
     * > Cave law 6: profit is SUM(line_total - cost_price_at_sale * quantity)
     * > over sale_items. This query MUST NEVER join medicine_batches to read
     * > cost — medicine_batches.effective_cost is the CURRENT price and can
     * > have moved since the sale (a supplier repriced, a correction was
     * > made). cost_price_at_sale is a point-in-time snapshot written once at
     * > sale completion (ADR-0005: sales are stone) and is the only cost this
     * > report, or any report, may read. A regression here silently rewrites
     * > historical profit every time a batch price changes — see
     * > ProfitSnapshotTest.php (T-0504c).
     */
    public function profitReport(Carbon $from, Carbon $to): Collection
    {
        return SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('medicines', 'medicines.id', '=', 'sale_items.medicine_id')
            ->whereBetween('sales.sale_date', [$from->toDateString(), $to->toDateString()])
            ->where('sales.status', '!=', 'cancelled')
            ->selectRaw(
                'sales.sale_date, medicines.id as medicine_id, medicines.name as medicine_name, ' .
                'medicines.category_id, ' .
                'SUM(sale_items.quantity) as quantity_sold, ' .
                'SUM(sale_items.line_total) as revenue, ' .
                // NEVER medicine_batches.effective_cost here — snapshot only.
                'SUM(sale_items.cost_price_at_sale * sale_items.quantity) as cost_of_goods, ' .
                'SUM(sale_items.line_total - sale_items.cost_price_at_sale * sale_items.quantity) as profit'
            )
            ->groupBy('sales.sale_date', 'medicines.id', 'medicines.name', 'medicines.category_id')
            ->orderBy('sales.sale_date')
            ->get();
    }

    /**
     * Stock valuation at cost and at MRP. Admin-only for the "at cost"
     * figures — the controller must strip cost columns for non-admin roles
     * (cave law 2) before this data reaches a view or export. The MRP figure
     * alone is safe for any report.view role.
     */
    public function stockValuationReport(): Collection
    {
        return MedicineBatch::query()
            ->where('status', 'available')
            ->join('medicines', 'medicines.id', '=', 'medicine_batches.medicine_id')
            ->selectRaw(
                'medicine_batches.id as batch_id, medicines.name as medicine_name, ' .
                'medicine_batches.batch_no, medicine_batches.expiry_date, ' .
                'medicine_batches.quantity_available, ' .
                'medicine_batches.effective_cost, medicine_batches.mrp, ' .
                '(medicine_batches.quantity_available * medicine_batches.effective_cost) as value_at_cost, ' .
                '(medicine_batches.quantity_available * medicine_batches.mrp) as value_at_mrp'
            )
            ->orderBy('medicines.name')
            ->get();
    }

    /**
     * Batches expiring within N days, sellable stock only, grouped for the
     * supplier-return worklist.
     */
    public function expiryReport(int $days = 90): Collection
    {
        $cutoff = Carbon::today()->addDays($days)->toDateString();

        return MedicineBatch::query()
            ->where('status', 'available')
            ->whereDate('expiry_date', '>', Carbon::today()->toDateString())
            ->whereDate('expiry_date', '<=', $cutoff)
            ->join('medicines', 'medicines.id', '=', 'medicine_batches.medicine_id')
            ->leftJoin('suppliers', 'suppliers.id', '=', 'medicine_batches.supplier_id')
            ->selectRaw(
                'medicine_batches.id as batch_id, medicines.name as medicine_name, ' .
                'medicine_batches.batch_no, medicine_batches.expiry_date, ' .
                'medicine_batches.quantity_available, medicine_batches.mrp, ' .
                'suppliers.id as supplier_id, suppliers.name as supplier_name, suppliers.phone as supplier_phone'
            )
            ->orderBy('medicine_batches.expiry_date')
            ->get();
    }

    /**
     * Rack-wise stock: every available batch with a rack shelf assignment,
     * grouped by zone/rack/shelf, plus a per-rack occupancy-vs-capacity
     * summary. Occupancy is summed live here from medicine_batches —
     * never a stored counter, so it can never drift from the ledger.
     *
     * @return array{rows: Collection, rack_summary: Collection}
     */
    public function rackStockReport(): array
    {
        $rows = MedicineBatch::query()
            ->join('rack_shelves', 'rack_shelves.id', '=', 'medicine_batches.rack_shelf_id')
            ->join('racks', 'racks.id', '=', 'rack_shelves.rack_id')
            ->join('storage_zones', 'storage_zones.id', '=', 'racks.storage_zone_id')
            ->join('medicines', 'medicines.id', '=', 'medicine_batches.medicine_id')
            ->where('medicine_batches.status', 'available')
            ->where('medicine_batches.quantity_available', '>', 0)
            ->selectRaw(
                'storage_zones.name as zone_name, racks.id as rack_id, racks.rack_code, racks.name as rack_name, ' .
                'racks.max_capacity_boxes as rack_capacity, rack_shelves.shelf_code, ' .
                'medicines.id as medicine_id, medicines.name as medicine_name, ' .
                'medicine_batches.batch_no, medicine_batches.expiry_date, medicine_batches.quantity_available'
            )
            ->orderBy('racks.rack_code')
            ->orderBy('rack_shelves.shelf_code')
            ->orderBy('medicines.name')
            ->get();

        $rackSummary = MedicineBatch::query()
            ->join('rack_shelves', 'rack_shelves.id', '=', 'medicine_batches.rack_shelf_id')
            ->join('racks', 'racks.id', '=', 'rack_shelves.rack_id')
            ->where('medicine_batches.status', 'available')
            ->selectRaw(
                'racks.id as rack_id, racks.rack_code, racks.name as rack_name, racks.max_capacity_boxes as capacity, ' .
                'COALESCE(SUM(medicine_batches.quantity_available), 0) as occupied'
            )
            ->groupBy('racks.id', 'racks.rack_code', 'racks.name', 'racks.max_capacity_boxes')
            ->orderBy('racks.rack_code')
            ->get();

        return [
            'rows' => $rows,
            'rack_summary' => $rackSummary,
        ];
    }

    /**
     * Fast/slow movers by units sold over the range. `$limit` applies to
     * each end (top N fast, bottom N slow among medicines that sold at all
     * in the range).
     */
    public function fastSlowMoverReport(Carbon $from, Carbon $to, int $limit = 10): array
    {
        $moved = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('medicines', 'medicines.id', '=', 'sale_items.medicine_id')
            ->whereBetween('sales.sale_date', [$from->toDateString(), $to->toDateString()])
            ->where('sales.status', '!=', 'cancelled')
            ->selectRaw('medicines.id as medicine_id, medicines.name as medicine_name, SUM(sale_items.quantity) as units_sold')
            ->groupBy('medicines.id', 'medicines.name')
            ->orderByDesc('units_sold')
            ->get();

        return [
            'fast_movers' => $moved->take($limit)->values(),
            'slow_movers' => $moved->sortBy('units_sold')->take($limit)->values(),
        ];
    }

    /**
     * GST report grouped by rate slab (0/5/12/18): output tax from sales,
     * input tax from purchases, plus the HSN summary required for the GST
     * return.
     */
    public function gstReport(Carbon $from, Carbon $to): array
    {
        $from = $from->toDateString();
        $to = $to->toDateString();

        $outputBySlab = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->whereBetween('sales.sale_date', [$from, $to])
            ->where('sales.status', '!=', 'cancelled')
            ->selectRaw(
                'sale_items.gst_rate, ' .
                'SUM((sale_items.quantity * sale_items.unit_price) - sale_items.discount) as taxable_amount, ' .
                'SUM(sale_items.gst_amount / 2) as cgst_amount, ' .
                'SUM(sale_items.gst_amount / 2) as sgst_amount, ' .
                '0.00 as igst_amount, ' .
                'SUM(sale_items.gst_amount) as gst_amount'
            )
            ->groupBy('sale_items.gst_rate')
            ->orderBy('sale_items.gst_rate')
            ->get();

        $inputBySlab = DB::table('purchase_items')
            ->join('purchases', 'purchases.id', '=', 'purchase_items.purchase_id')
            ->whereBetween('purchases.invoice_date', [$from, $to])
            ->where('purchases.status', 'confirmed')
            ->selectRaw(
                'purchase_items.gst_rate, ' .
                'SUM(purchase_items.quantity * purchase_items.purchase_price) as taxable_amount, ' .
                'SUM(((purchase_items.quantity * purchase_items.purchase_price) * (purchase_items.gst_rate / 100)) / 2) as cgst_amount, ' .
                'SUM(((purchase_items.quantity * purchase_items.purchase_price) * (purchase_items.gst_rate / 100)) / 2) as sgst_amount, ' .
                '0.00 as igst_amount, ' .
                'SUM((purchase_items.quantity * purchase_items.purchase_price) * (purchase_items.gst_rate / 100)) as gst_amount'
            )
            ->groupBy('purchase_items.gst_rate')
            ->orderBy('purchase_items.gst_rate')
            ->get();

        $hsnSummary = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('medicines', 'medicines.id', '=', 'sale_items.medicine_id')
            ->whereBetween('sales.sale_date', [$from, $to])
            ->where('sales.status', '!=', 'cancelled')
            ->whereNotNull('medicines.hsn_code')
            ->selectRaw(
                'medicines.hsn_code, sale_items.gst_rate, ' .
                'SUM(sale_items.quantity) as quantity, ' .
                'SUM((sale_items.quantity * sale_items.unit_price) - sale_items.discount) as taxable_amount, ' .
                'SUM(sale_items.gst_amount) as gst_amount'
            )
            ->groupBy('medicines.hsn_code', 'sale_items.gst_rate')
            ->orderBy('medicines.hsn_code')
            ->get();

        return [
            'output_tax_by_slab' => $outputBySlab,
            'input_tax_by_slab' => $inputBySlab,
            'hsn_summary' => $hsnSummary,
        ];
    }

    /**
     * Customer aging: outstanding balance bucketed by days since sale_date,
     * per real invoice, not a single lump opening balance (Q-007).
     */
    public function customerAgingReport(): Collection
    {
        return $this->agingBuckets(
            table: 'sales',
            dateColumn: 'sale_date',
            partyIdColumn: 'customer_id',
            dueColumn: 'due',
            partyTable: 'customers',
        );
    }

    /**
     * Supplier aging: outstanding balance bucketed by days since the
     * supplier's payment terms would have made it due (invoice_date +
     * payment_terms_days), per real invoice.
     */
    public function supplierAgingReport(): Collection
    {
        return DB::table('purchases')
            ->join('suppliers', 'suppliers.id', '=', 'purchases.supplier_id')
            ->where('purchases.status', 'confirmed')
            ->where('purchases.due_amount', '>', 0)
            ->selectRaw(
                'purchases.id as purchase_id, purchases.supplier_id, suppliers.name as supplier_name, ' .
                'purchases.invoice_no, purchases.invoice_date, purchases.due_amount, ' .
                "(purchases.invoice_date + (suppliers.payment_terms_days || ' days')::interval)::date as due_date, " .
                "(CURRENT_DATE - (purchases.invoice_date + (suppliers.payment_terms_days || ' days')::interval)::date) as days_overdue"
            )
            ->get()
            ->map(fn ($row) => (array) $row + ['bucket' => $this->bucketFor((int) $row->days_overdue)]);
    }

    /**
     * Shared aging-bucket query for the customer side, keyed off the real
     * invoice (sale) date rather than a lump opening balance.
     */
    private function agingBuckets(
        string $table,
        string $dateColumn,
        string $partyIdColumn,
        string $dueColumn,
        string $partyTable,
    ): Collection {
        return DB::table($table)
            ->join($partyTable, "{$partyTable}.id", '=', "{$table}.{$partyIdColumn}")
            ->where("{$table}.{$dueColumn}", '>', 0)
            ->selectRaw(
                "{$table}.id as invoice_id, {$table}.{$partyIdColumn} as party_id, " .
                "{$partyTable}.name as party_name, {$table}.{$dateColumn} as invoice_date, " .
                "{$table}.{$dueColumn} as due_amount, " .
                "(CURRENT_DATE - {$table}.{$dateColumn}) as days_overdue"
            )
            ->get()
            ->map(fn ($row) => (array) $row + ['bucket' => $this->bucketFor((int) $row->days_overdue)]);
    }

    private function bucketFor(int $daysOverdue): string
    {
        return match (true) {
            $daysOverdue <= 30 => '0-30',
            $daysOverdue <= 60 => '31-60',
            $daysOverdue <= 90 => '61-90',
            default => '90+',
        };
    }
}
