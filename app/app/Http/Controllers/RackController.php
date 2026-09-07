<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\BatchStatus;
use App\Models\MedicineBatch;
use App\Models\Rack;
use App\Models\RackShelf;
use App\Models\StorageZone;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;
use Illuminate\View\View;

/**
 * Admin-only management of physical rack master data (code/name, aisle,
 * shelf count, capacity, active flag). Gated by rack.manage on every method,
 * same gate weight as DiscountSchemeController/ShopLicenseController.
 *
 * Occupancy is never stored — it is always the live SUM of
 * medicine_batches.quantity_available for available batches whose shelf
 * belongs to the rack, computed in the query on every request. Storing a
 * running counter here would drift the moment a sale, adjustment, or rack
 * reassignment ran without also touching this table.
 */
final class RackController extends Controller
{
    public function index(): View
    {
        Gate::authorize('rack.manage');

        $occupancyByRack = MedicineBatch::query()
            ->join('rack_shelves', 'rack_shelves.id', '=', 'medicine_batches.rack_shelf_id')
            ->where('medicine_batches.status', BatchStatus::Available)
            ->selectRaw('rack_shelves.rack_id as rack_id, SUM(medicine_batches.quantity_available) as occupied')
            ->groupBy('rack_shelves.rack_id')
            ->pluck('occupied', 'rack_id');

        $racks = Rack::query()
            ->with('zone')
            ->withCount('shelves')
            ->orderBy('rack_code')
            ->paginate(25)
            ->withQueryString();

        $racks->getCollection()->transform(function (Rack $rack) use ($occupancyByRack): Rack {
            $rack->occupied_units = (int) ($occupancyByRack[$rack->id] ?? 0);

            return $rack;
        });

        return view('racks.index', compact('racks'));
    }

    public function create(): View
    {
        Gate::authorize('rack.manage');

        $zones = StorageZone::query()->orderBy('name')->get();

        return view('racks.create', compact('zones'));
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('rack.manage');

        $data = $this->validated($request);

        $rack = Rack::query()->create($data);

        // A rack is useless for put-away until it has real shelf rows to
        // assign batches to — total_shelves on its own is just a stored
        // count, nothing generates the RackShelf rows automatically. Create
        // them here so a freshly-created rack is immediately usable in the
        // inventory assign-rack dropdown, matching what PharmacyRackLocationSeeder
        // already does for seeded racks.
        $this->syncShelves($rack);

        return to_route('racks.index')->with('status', __('Rack created.'));
    }

    public function edit(Rack $rack): View
    {
        Gate::authorize('rack.manage');

        $zones = StorageZone::query()->orderBy('name')->get();

        return view('racks.edit', ['rack' => $rack, 'zones' => $zones]);
    }

    public function update(Request $request, Rack $rack): RedirectResponse
    {
        Gate::authorize('rack.manage');

        $data = $this->validated($request, $rack->id);

        $rack->update($data);

        // If total_shelves was raised, top up with the missing shelf rows.
        // Never deletes existing shelves on a decrease — a shelf may already
        // hold assigned batches, and shrinking the count here would orphan
        // that data silently.
        $this->syncShelves($rack);

        return to_route('racks.index')->with('status', __('Rack updated.'));
    }

    public function destroy(Rack $rack): RedirectResponse
    {
        Gate::authorize('rack.manage');

        $occupied = MedicineBatch::query()
            ->join('rack_shelves', 'rack_shelves.id', '=', 'medicine_batches.rack_shelf_id')
            ->where('rack_shelves.rack_id', $rack->id)
            ->where('medicine_batches.status', BatchStatus::Available)
            ->sum('medicine_batches.quantity_available');

        if ($occupied > 0) {
            return to_route('racks.index')->with(
                'status',
                __('Cannot delete :name — :qty units are still assigned to its shelves. Reassign or clear stock first.', [
                    'name' => $rack->rack_code,
                    'qty' => $occupied,
                ]),
            );
        }

        // Deleting the rack cascades to its shelves and bins (FK
        // cascadeOnDelete on rack_shelves.rack_id / rack_bins.rack_shelf_id);
        // any medicine still pointing at this rack for display purposes only
        // (medicines.rack_id / rack_shelf_id) is nulled out by nullOnDelete.
        $rack->delete();

        return to_route('racks.index')->with('status', __('Rack deleted.'));
    }

    /**
     * Ensure this rack has one RackShelf row per shelf_number from 1 to
     * total_shelves. Idempotent — only creates rows that don't already
     * exist, never touches or removes existing ones.
     */
    private function syncShelves(Rack $rack): void
    {
        $existingShelfNumbers = RackShelf::query()
            ->where('rack_id', $rack->id)
            ->pluck('shelf_number')
            ->all();

        for ($shelfNumber = 1; $shelfNumber <= $rack->total_shelves; $shelfNumber++) {
            if (in_array($shelfNumber, $existingShelfNumbers, true)) {
                continue;
            }

            RackShelf::query()->create([
                'rack_id' => $rack->id,
                'shelf_number' => $shelfNumber,
                'shelf_code' => "{$rack->rack_code}-S{$shelfNumber}",
                'capacity_units' => $rack->total_shelves > 0
                    ? (int) round($rack->max_capacity_boxes / $rack->total_shelves)
                    : $rack->max_capacity_boxes,
            ]);
        }
    }

    private function validated(Request $request, ?int $ignoreRackId = null): array
    {
        $data = Validator::make($request->all(), [
            'storage_zone_id' => ['required', 'integer', 'exists:storage_zones,id'],
            'rack_code' => [
                'required', 'string', 'max:30',
                'unique:racks,rack_code' . ($ignoreRackId ? ",{$ignoreRackId}" : ''),
            ],
            'name' => ['required', 'string', 'max:120'],
            'aisle' => ['nullable', 'string', 'max:20'],
            'row_number' => ['nullable', 'integer', 'min:0'],
            'column_number' => ['nullable', 'integer', 'min:0'],
            'total_shelves' => ['required', 'integer', 'min:1', 'max:50'],
            'max_capacity_boxes' => ['required', 'integer', 'min:1'],
            'status' => ['required', 'string', 'in:active,inactive'],
        ])->validate();

        return $data;
    }
}
