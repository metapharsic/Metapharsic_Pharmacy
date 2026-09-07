<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\BatchStatus;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\Rack;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;

/**
 * Batch-wise stock views. Read-only — nothing here writes
 * quantity_available (cave law 1). Cashier-cost columns are never selected;
 * these screens are behind inventory.view / admin roles, not the POS.
 */
final class InventoryController extends Controller
{
    public function index(Request $request): View
    {
        Gate::authorize('inventory.view');

        $batches = MedicineBatch::query()
            ->with(['medicine', 'rackShelf.rack'])
            ->when($request->filled('medicine_id'), fn ($q) => $q->where('medicine_id', $request->integer('medicine_id')))
            ->when($request->filled('expiry_from'), fn ($q) => $q->whereDate('expiry_date', '>=', $request->date('expiry_from')))
            ->when($request->filled('expiry_to'), fn ($q) => $q->whereDate('expiry_date', '<=', $request->date('expiry_to')))
            ->orderBy('expiry_date')
            ->paginate(50)
            ->withQueryString();

        $medicines = Medicine::query()->orderBy('name')->get(['id', 'name']);

        // Active racks' shelves, populated from real rack_shelves rows — never a
        // hardcoded list — for the rack-assignment dropdown on this screen.
        $rackShelves = Rack::query()
            ->where('status', 'active')
            ->with(['shelves' => fn ($q) => $q->orderBy('shelf_number')])
            ->orderBy('rack_code')
            ->get();

        return view('inventory.index', compact('batches', 'medicines', 'rackShelves'));
    }

    /**
     * Assign (or clear) the physical shelf a medicine batch is stored on.
     * Gated separately from inventory.view: viewing stock is not the same
     * privilege as changing where it physically lives (rack.manage, same
     * gate as the rack master screens). Never touches quantity_available —
     * this is a pure location update (cave law 1 only governs the quantity
     * column, not this FK).
     */
    public function assignRack(Request $request, MedicineBatch $batch): RedirectResponse
    {
        Gate::authorize('rack.manage');

        $data = Validator::make($request->all(), [
            'rack_shelf_id' => ['nullable', 'integer', 'exists:rack_shelves,id'],
        ])->validate();

        $batch->update(['rack_shelf_id' => $data['rack_shelf_id'] ?? null]);

        return back()->with('status', __('Rack assignment updated.'));
    }

    /**
     * DR-EXP-03/04 thresholds. min_stock_level lives on the medicine
     * (cave law 3 says the medicine holds no quantity — this compares
     * against a per-medicine summary of batch quantities, it does not
     * store one).
     */
    public function lowStock(): View
    {
        Gate::authorize('inventory.view');

        $medicines = Medicine::query()
            ->withSum(
                ['batches as available_quantity' => fn ($q) => $q->where('status', BatchStatus::Available)],
                'quantity_available',
            )
            ->get()
            // Compared in memory, not in SQL: min_stock_level lives on
            // medicines (cave law 3 — the medicine itself holds no quantity,
            // this is only a threshold it is compared against), and a
            // HAVING against a correlated column-vs-column comparison reads
            // worse than this for a list that is never large.
            ->filter(fn (Medicine $medicine) => ($medicine->available_quantity ?? 0) <= $medicine->min_stock_level)
            ->sortBy('name')
            ->values();

        return view('inventory.low-stock', compact('medicines'));
    }

    /**
     * Expiry report. Window defaults to 90 days (DR-EXP-03 default), overridable
     * via ?days=. Colour flags are decided again server-side in the view via
     * x-expiry-pill so the browser is never trusted for the red/amber split
     * (brain/06-ui-conventions.md §3).
     */
    public function expiryReport(Request $request): View
    {
        Gate::authorize('inventory.view');

        $days = max(1, min(365, $request->integer('days', 90)));

        $batches = MedicineBatch::query()
            ->with(['medicine', 'purchase.supplier'])
            ->whereIn('status', [BatchStatus::Available, BatchStatus::Quarantined])
            ->whereDate('expiry_date', '<=', now()->addDays($days))
            ->orderBy('expiry_date')
            ->paginate(50)
            ->withQueryString();

        return view('inventory.expiry-report', [
            'batches' => $batches,
            'days' => $days,
        ]);
    }

    /**
     * Visual Pharmacy Rack & Shelf Spatial Layout.
     * Displays all storage zones, racks, shelves, and mapped medicines with real-time stock.
     */
    public function racks(): View
    {
        Gate::authorize('inventory.view');

        $zones = \App\Models\StorageZone::query()
            ->with(['racks.shelves.medicines' => function ($q) {
                $q->with([
                    'batches' => function ($bq) {
                        $bq->where('status', BatchStatus::Available)
                            ->orderBy('expiry_date');
                    },
                ])->withSum([
                    'batches as current_stock' => function ($bq) {
                        $bq->where('status', BatchStatus::Available);
                    },
                ], 'quantity_available');
            }])
            ->where('is_active', true)
            ->get();

        return view('inventory.racks', compact('zones'));
    }
}
