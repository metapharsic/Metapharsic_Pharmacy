<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\PurchaseStatus;
use App\Http\Requests\StorePurchaseRequest;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Supplier;
use App\Services\PurchaseService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * Purchasing module — draft/confirm/cancel around Purchase + PurchaseItem.
 *
 * All stock and cost mutation happens inside PurchaseService, never here.
 * This controller only ever builds a draft row-set and hands the id off to
 * the service; see brain/05-routes-and-modules.md §4 module boundaries.
 */
final class PurchaseController extends Controller
{
    public function index(Request $request): View
    {
        Gate::authorize('purchase.view');

        $purchases = Purchase::query()
            ->with('supplier')
            ->when($request->filled('supplier_id'), fn ($q) => $q->where('supplier_id', $request->integer('supplier_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->latest('invoice_date')
            ->paginate(25)
            ->withQueryString();

        return view('purchases.index', compact('purchases'));
    }

    public function create(): View
    {
        Gate::authorize('purchase.create');

        $suppliers = Supplier::query()->orderBy('name')->get(['id', 'name']);
        $medicines = \App\Models\Medicine::query()->withoutCost()->orderBy('name')->get(['id', 'name', 'unit', 'gst_rate']);

        return view('purchases.create', compact('suppliers', 'medicines'));
    }

    /**
     * Persists a draft purchase only. No stock moves here — draft purchases
     * touch no stock (G3.2 / T-0304). Confirming is a separate, explicit
     * action the pharmacist takes after checking the physical delivery.
     */
    public function store(StorePurchaseRequest $request): RedirectResponse
    {
        Gate::authorize('purchase.create');

        $validated = $request->validated();

        $purchase = DB::transaction(function () use ($validated) {
            $purchase = Purchase::create([
                'supplier_id' => $validated['supplier_id'],
                'invoice_no' => $validated['invoice_no'],
                'invoice_date' => $validated['invoice_date'],
                'status' => PurchaseStatus::Draft,
            ]);

            foreach ($validated['items'] as $item) {
                $base = bcmul((string) $item['quantity'], (string) $item['purchase_price'], 4);
                $gst = bcdiv(bcmul($base, (string) $item['gst_rate'], 4), '100', 4);
                $lineTotal = bcadd($base, $gst, 2);

                PurchaseItem::create([
                    'purchase_id' => $purchase->id,
                    'medicine_id' => $item['medicine_id'],
                    'batch_no' => $item['batch_no'],
                    'expiry_date' => $item['expiry_date'],
                    'quantity' => $item['quantity'],
                    'free_quantity' => $item['free_quantity'],
                    'purchase_price' => $item['purchase_price'],
                    'mrp' => $item['mrp'],
                    'selling_price' => $item['selling_price'],
                    'gst_rate' => $item['gst_rate'],
                    'line_total' => $lineTotal,
                ]);
            }

            return $purchase;
        });

        return redirect()
            ->route('purchases.show', $purchase)
            ->with('status', "Purchase draft #{$purchase->id} saved. Confirm it once the delivery is checked.");
    }

    public function show(Purchase $purchase): View
    {
        Gate::authorize('purchase.view');

        $purchase->load(['supplier', 'items.medicine']);

        return view('purchases.show', compact('purchase'));
    }

    /**
     * Confirms a draft purchase: PurchaseService::confirm() finds-or-creates
     * each batch, computes effective_cost (DR-FREE-03), moves stock through
     * InventoryService, and raises suppliers.outstanding_balance. This
     * controller does none of that arithmetic itself.
     */
    public function confirm(Purchase $purchase, PurchaseService $purchaseService): RedirectResponse
    {
        Gate::authorize('purchase.confirm');

        $purchaseService->confirm($purchase);

        return redirect()
            ->route('purchases.show', $purchase)
            ->with('status', "Purchase #{$purchase->id} confirmed. Stock has been received.");
    }

    /**
     * Cancels a confirmed (or draft) purchase. PurchaseService::cancel()
     * writes mirrored reversing stock_transactions rows for anything that
     * was moved on confirm — it never deletes the purchase or its items,
     * and it never deletes or edits a stock_transactions row. Cave law: a
     * purchase cancel is a new movement in the ledger, not an erasure of
     * the old one.
     */
    public function cancel(Purchase $purchase, PurchaseService $purchaseService): RedirectResponse
    {
        Gate::authorize('purchase.cancel');

        $purchaseService->cancel($purchase);

        return redirect()
            ->route('purchases.show', $purchase)
            ->with('status', "Purchase #{$purchase->id} cancelled. Reversing stock movements recorded.");
    }
}
