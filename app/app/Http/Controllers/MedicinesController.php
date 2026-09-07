<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\StoreMedicineRequest;
use App\Http\Requests\UpdateMedicineRequest;
use App\Models\Category;
use App\Models\Manufacturer;
use App\Models\Medicine;
use App\Models\Rack;
use App\Models\RackShelf;
use App\Models\StorageZone;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

class MedicinesController extends Controller
{
    public function index(): View
    {
        Gate::authorize('medicine.view');

        // Cave law 2: cost columns are scoped away at the query layer, not by a Blade @can.
        $medicines = Medicine::query()
            ->withoutCost()
            ->with(['category', 'manufacturer', 'zone', 'rack', 'shelf'])
            ->orderBy('name')
            ->paginate(25);

        return view('medicines.index', ['medicines' => $medicines]);
    }

    public function create(): View
    {
        Gate::authorize('medicine.create');

        return view('medicines.create', [
            'categories' => Category::query()->orderBy('name')->get(),
            'manufacturers' => Manufacturer::query()->orderBy('name')->get(),
            'zones' => StorageZone::query()->where('is_active', true)->orderBy('name')->get(),
            'racks' => Rack::query()->with('zone')->orderBy('rack_code')->get(),
            'shelves' => RackShelf::query()->with('rack')->orderBy('shelf_code')->get(),
        ]);
    }

    public function store(StoreMedicineRequest $request): RedirectResponse
    {
        $medicine = Medicine::query()->create([
            ...$request->validated(),
            'created_by' => $request->user()?->id,
        ]);

        return to_route('medicines.edit', $medicine)->with('status', __('Medicine created.'));
    }

    public function edit(Medicine $medicine): View
    {
        Gate::authorize('medicine.update');

        $medicine->load(['batches.supplier']);

        return view('medicines.edit', [
            'medicine' => $medicine,
            'categories' => Category::query()->orderBy('name')->get(),
            'manufacturers' => Manufacturer::query()->orderBy('name')->get(),
            'suppliers' => \App\Models\Supplier::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'zones' => StorageZone::query()->where('is_active', true)->orderBy('name')->get(),
            'racks' => Rack::query()->with('zone')->orderBy('rack_code')->get(),
            'shelves' => RackShelf::query()->with('rack')->orderBy('shelf_code')->get(),
        ]);
    }

    public function update(UpdateMedicineRequest $request, Medicine $medicine): RedirectResponse
    {
        $medicine->update($request->validated());

        return to_route('medicines.edit', $medicine)->with('status', __('Medicine updated.'));
    }

    public function destroy(Medicine $medicine): RedirectResponse
    {
        Gate::authorize('medicine.delete');

        // Inactive medicines cannot be sold or purchased; soft delete only (cave law: no
        // hard delete of master data referenced by batches/sale history in later phases).
        $medicine->delete();

        return to_route('medicines.index')->with('status', __('Medicine deleted.'));
    }
}
