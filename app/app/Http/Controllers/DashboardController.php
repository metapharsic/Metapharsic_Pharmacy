<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\DailySalesSummary;
use App\Services\ReportService;
use Carbon\Carbon;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Thin controller: gathers dashboard tiles by delegating to ReportService
 * and cached/summary reads, no calculation here (brain/01-architecture.md §1).
 *
 * Cache store is `file`/`database` — no Redis on the shop LAN (brain/01 §6).
 * Today's tile is the only one computed live (today is not yet in
 * daily_sales_summary — summary:rebuild only writes past days), and it is
 * cached 5 minutes under `pharmacy.dashboard.today`, busted on
 * SaleCompleted elsewhere in the app (not this controller's concern).
 */
final class DashboardController extends Controller
{
    public function __construct(
        private readonly ReportService $reports,
    ) {
    }

    public function index(): View
    {
        $today = Carbon::today();

        // Today's slice: live query, cached 5 minutes. Small and bounded —
        // "today" is at most one day of sale_items, never a full scan.
        $todayTile = Cache::remember(
            'pharmacy.dashboard.today',
            now()->addMinutes(5),
            fn () => $this->reports->dailySalesSummary($today),
        );

        // Prior days: read from the precomputed daily_sales_summary cache
        // table (brain/01 §6) — never a live SUM over sale_items here.
        $last30Days = DailySalesSummary::query()
            ->whereBetween('summary_date', [$today->copy()->subDays(30)->toDateString(), $today->copy()->subDay()->toDateString()])
            ->orderBy('summary_date')
            ->get();

        $stockCount = Cache::remember(
            'pharmacy.dashboard.stock_count',
            now()->addMinutes(5),
            fn () => (int) DB::table('medicine_batches')->where('status', 'available')->sum('quantity_available'),
        );

        $lowStockCount = Cache::remember(
            'pharmacy.dashboard.low_stock',
            now()->addMinutes(5),
            fn () => (int) DB::table('medicines')
                ->select('medicines.id')
                ->join('medicine_batches', 'medicine_batches.medicine_id', '=', 'medicines.id')
                ->where('medicine_batches.status', 'available')
                ->groupBy('medicines.id', 'medicines.min_stock_level')
                ->havingRaw('SUM(medicine_batches.quantity_available) <= medicines.min_stock_level')
                ->get()
                ->count(),
        );

        $expiring30 = Cache::remember(
            'pharmacy.dashboard.expiring_30',
            now()->addMinutes(60),
            fn () => $this->reports->expiryReport(30)->count(),
        );

        $expiring90 = Cache::remember(
            'pharmacy.dashboard.expiring_90',
            now()->addMinutes(60),
            fn () => $this->reports->expiryReport(90)->count(),
        );

        $pendingCustomerPayments = Cache::remember(
            'pharmacy.dashboard.customer_due',
            now()->addMinutes(5),
            fn () => (string) DB::table('customers')->sum('outstanding_balance'),
        );

        $pendingSupplierPayments = Cache::remember(
            'pharmacy.dashboard.supplier_due',
            now()->addMinutes(5),
            fn () => (string) DB::table('suppliers')->sum('outstanding_balance'),
        );

        return view('dashboard.index', [
            'today' => $todayTile,
            'last30Days' => $last30Days,
            'stockCount' => $stockCount,
            'lowStockCount' => $lowStockCount,
            'expiring30' => $expiring30,
            'expiring90' => $expiring90,
            'pendingCustomerPayments' => $pendingCustomerPayments,
            'pendingSupplierPayments' => $pendingSupplierPayments,
            // Gross-profit tile: the view must omit this from the DOM
            // entirely for pharmacist/cashier sessions (T-0502a), not
            // merely hide it with CSS. Gate::allows() is checked in the
            // Blade view per brain/06-ui-conventions.md.
            'todayProfit' => $todayTile['total_profit'],
        ]);
    }
}
