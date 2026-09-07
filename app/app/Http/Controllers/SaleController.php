<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Sale;
use App\Services\SalesService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Throwable;

/**
 * Sale history, invoice/receipt print, and same-day cancellation.
 *
 * Cave law 8 (sales are stone): this controller has no edit or destroy action, and never
 * will — see ADR-0005 and brain/03-domain-rules.md DR-TRAP-05. cancel() writes reversing
 * transactions through SalesService::cancelSale(); it never mutates a sale_items row.
 *
 * Cave law 2 (cashier never sees cost): index()/show() query through the Sale model's
 * normal (cost-excluded) relations only. Nothing here selects cost_price_at_sale — that
 * column exists solely for SalesService/ReturnService's own profit-snapshot writes and the
 * admin-only profit report (report.profit).
 */
class SaleController extends Controller
{
    public function index(Request $request): View
    {
        $sales = Sale::query()
            ->with(['customer'])
            ->when($request->filled('from'), fn ($q) => $q->whereDate('sale_date', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($q) => $q->whereDate('sale_date', '<=', $request->date('to')))
            ->when($request->filled('q'), function ($q) use ($request) {
                $term = $request->string('q');
                $q->where('invoice_no', 'like', "%{$term}%");
            })
            ->orderByDesc('sale_date')
            ->paginate(25)
            ->withQueryString();

        return view('sales.index', ['sales' => $sales]);
    }

    public function show(Sale $sale): View
    {
        $sale->load(['items.medicine', 'items.batch', 'payments', 'customer', 'prescription']);

        return view('sales.show', ['sale' => $sale]);
    }

    /**
     * A4 tax invoice — brain/06-ui-conventions.md §7. Rendered from a route so it can be
     * reprinted from history, not only immediately after the sale (T-0407c).
     */
    public function print(Sale $sale): View
    {
        $sale->load(['items.medicine', 'items.batch', 'payments', 'customer', 'prescription']);

        return view('sales.print-a4', ['sale' => $sale])
            ->layout('layouts.print-a4');
    }

    /**
     * 80mm thermal receipt — filename fixed by CONFLICT-003's resolution.
     */
    public function printThermal(Sale $sale): View
    {
        $sale->load(['items.medicine', 'items.batch', 'payments', 'customer', 'prescription']);

        return view('sales.print-80mm', ['sale' => $sale])
            ->layout('layouts.print-80mm');
    }

    /**
     * Same-day, unpaid-mistake cancellation only (ADR-0005). Gate::authorize enforces
     * sale.void; SalesService::cancelSale() enforces the same-day rule again inside the
     * transaction because a Gate check alone is a Request-level guard, not a Service-level
     * one, and brain/03 §1's cave law is explicit: a rule enforced only before the Service
     * runs is not enforced against a stale page left open past midnight.
     */
    public function cancel(Sale $sale, Request $request): RedirectResponse
    {
        Gate::authorize('sale.void', $sale);

        if (! $sale->sale_date->isToday()) {
            // Same-day check surfaced as a user-facing error rather than a raw 403 — this is
            // a business rule (ADR-0005), not a permission failure.
            return back()->withErrors([
                'cancel' => 'This sale can no longer be cancelled — cancellation is only available on the day of sale. Use a return instead.',
            ]);
        }

        try {
            app(SalesService::class)->cancelSale($sale, $request->user()->id);
        } catch (Throwable $e) {
            report($e);

            return back()->withErrors([
                'cancel' => 'The sale could not be cancelled. Nothing was changed.',
            ]);
        }

        return redirect()
            ->route('sales.show', $sale)
            ->with('status', "Invoice {$sale->invoice_no} cancelled.");
    }
}
