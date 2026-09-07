<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\ReportService;
use Carbon\Carbon;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * One action per report type. Every action authorises via Gate before
 * calling ReportService (brain/01-architecture.md §1: authorization is a
 * Form Request / Gate concern, never the Service's).
 *
 * > Cave law 2 / T-0504b: `report.profit` is hard-denied to non-admin
 * > regardless of the runtime permission grid. It is gated separately from
 * > `report.view` in every action below that touches cost or profit — never
 * > folded into the general report.view check.
 */
final class ReportController extends Controller
{
    public function __construct(
        private readonly ReportService $reports,
    ) {
    }

    public function sales(Request $request): View|StreamedResponse
    {
        Gate::authorize('report.view');

        [$from, $to] = $this->range($request);
        $userId = $request->integer('user_id') ?: null;

        $rows = $this->reports->salesReport($from, $to, $userId);

        return $this->respond($request, 'reports.sales', $rows, 'sales-report');
    }

    public function purchases(Request $request): View|StreamedResponse
    {
        Gate::authorize('report.view');

        [$from, $to] = $this->range($request);
        $supplierId = $request->integer('supplier_id') ?: null;

        $rows = $this->reports->purchaseReport($from, $to, $supplierId);

        return $this->respond($request, 'reports.purchases', $rows, 'purchase-report');
    }

    /**
     * Profit is admin-only. Gate::authorize('report.profit') is separate
     * from report.view on purpose — see class docblock and cave law 2.
     */
    public function profit(Request $request): View|StreamedResponse
    {
        Gate::authorize('report.profit');

        [$from, $to] = $this->range($request);

        $rows = $this->reports->profitReport($from, $to);

        return $this->respond($request, 'reports.profit', $rows, 'profit-report');
    }

    /**
     * Stock valuation: the "at cost" columns require report.profit-grade
     * authorization; MRP-only valuation is available to report.view. This
     * action always fetches the full row set and strips cost columns for
     * non-admin viewers before render/export — never sends cost to the
     * browser for a role that should not see it (cave law 2).
     */
    public function stockValuation(Request $request): View|StreamedResponse
    {
        Gate::authorize('report.view');

        $rows = $this->reports->stockValuationReport();

        if (! Gate::allows('report.profit')) {
            $rows = $rows->map(fn (array|object $row) => collect((array) $row)
                ->except(['effective_cost', 'value_at_cost'])
                ->all());
        }

        return $this->respond($request, 'reports.stock-valuation', $rows, 'stock-valuation');
    }

    public function expiry(Request $request): View|StreamedResponse
    {
        Gate::authorize('report.view');

        $days = $request->integer('days', 90);
        $rows = $this->reports->expiryReport($days);

        return $this->respond($request, 'reports.expiry', $rows, 'expiry-report');
    }

    public function movers(Request $request): View|StreamedResponse
    {
        Gate::authorize('report.view');

        [$from, $to] = $this->range($request);
        $limit = $request->integer('limit', 10);

        $result = $this->reports->fastSlowMoverReport($from, $to, $limit);

        if ($request->query('format') === 'csv') {
            return $this->streamCsv('mover-report', collect($result['fast_movers'])->merge($result['slow_movers']));
        }

        return view('reports.fast-slow-movers', $result);
    }

    public function gst(Request $request): View|StreamedResponse
    {
        Gate::authorize('report.view');

        [$from, $to] = $this->range($request);
        $result = $this->reports->gstReport($from, $to);

        if ($request->query('format') === 'csv') {
            return $this->streamCsv('gst-hsn-summary', collect($result['hsn_summary']));
        }

        return view('reports.gst', [
            'outputSlabs' => collect($result['output_tax_by_slab'])->map(fn ($r) => [
                'rate' => (float) $r->gst_rate,
                'taxable_value' => (float) $r->taxable_amount,
                'cgst' => (float) $r->cgst_amount,
                'sgst' => (float) $r->sgst_amount,
                'total_tax' => (float) $r->gst_amount,
            ]),
            'inputSlabs' => collect($result['input_tax_by_slab'])->map(fn ($r) => [
                'rate' => (float) $r->gst_rate,
                'taxable_value' => (float) $r->taxable_amount,
                'cgst' => (float) $r->cgst_amount,
                'sgst' => (float) $r->sgst_amount,
                'total_tax' => (float) $r->gst_amount,
            ]),
            'hsnSummary' => collect($result['hsn_summary'])->map(fn ($r) => [
                'hsn_code' => $r->hsn_code,
                'quantity' => (int) $r->quantity,
                'taxable_value' => (float) $r->taxable_amount,
                'total_tax' => (float) $r->gst_amount,
            ]),
        ]);
    }

    /**
     * Rack-wise stock report: which medicines/batches/quantities sit on
     * each rack right now, plus per-rack occupancy vs. capacity. Gated on
     * report.view like every other report here — rack.manage governs
     * changing rack layout/assignment, not reading this report.
     */
    public function rackStock(Request $request): View|StreamedResponse
    {
        Gate::authorize('report.view');

        $result = $this->reports->rackStockReport();

        if ($request->query('format') === 'csv') {
            return $this->streamCsv('rack-stock-report', $result['rows']);
        }

        return view('reports.rack-stock', [
            'rows' => $result['rows'],
            'rackSummary' => $result['rack_summary'],
        ]);
    }

    public function customerAging(Request $request): View|StreamedResponse
    {
        Gate::authorize('report.view');

        $rows = $this->reports->customerAgingReport();

        return $this->respond($request, 'reports.customer-aging', $rows, 'customer-aging');
    }

    public function supplierAging(Request $request): View|StreamedResponse
    {
        Gate::authorize('report.view');

        $rows = $this->reports->supplierAgingReport();

        return $this->respond($request, 'reports.supplier-aging', $rows, 'supplier-aging');
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    private function range(Request $request): array
    {
        $from = $request->filled('from') ? Carbon::parse($request->query('from')) : Carbon::now()->startOfMonth();
        $to = $request->filled('to') ? Carbon::parse($request->query('to')) : Carbon::now();

        return [$from, $to];
    }

    private function respond(Request $request, string $view, Collection $rows, string $filenameBase): View|StreamedResponse
    {
        if ($request->query('format') === 'csv') {
            return $this->streamCsv($filenameBase, $rows);
        }

        return view($view, ['rows' => $rows]);
    }

    /**
     * Simple CSV export via Laravel's streamed response — no external
     * package, per this phase's brief. T-0503c also requires the export to
     * be audited; wiring AuditService::record('report.export', ...) is left
     * to the caller/middleware layer in this scaffold.
     */
    private function streamCsv(string $filenameBase, Collection $rows): StreamedResponse
    {
        $filename = $filenameBase . '-' . now()->format('Y-m-d') . '.csv';

        return response()->streamDownload(function () use ($rows): void {
            $handle = fopen('php://output', 'wb');

            $first = $rows->first();
            $headers = $first !== null ? array_keys((array) $first) : [];

            if ($headers !== []) {
                fputcsv($handle, $headers);
            }

            foreach ($rows as $row) {
                fputcsv($handle, array_values((array) $row));
            }

            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv']);
    }
}
