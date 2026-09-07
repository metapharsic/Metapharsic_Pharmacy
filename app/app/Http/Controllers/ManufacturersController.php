<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Manufacturer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

class ManufacturersController extends Controller
{
    public function index(): View
    {
        Gate::authorize('manufacturer.view');

        $manufacturers = Manufacturer::query()->orderBy('name')->paginate(25);

        return view('manufacturers.index', ['manufacturers' => $manufacturers]);
    }

    public function create(): View
    {
        Gate::authorize('manufacturer.create');

        return view('manufacturers.create');
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('manufacturer.create');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150', 'unique:manufacturers,name'],
            'contact_person' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:160'],
            'address' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $manufacturer = Manufacturer::query()->create($data);

        return to_route('manufacturers.edit', $manufacturer)->with('status', __('Manufacturer created.'));
    }

    public function edit(Manufacturer $manufacturer): View
    {
        Gate::authorize('manufacturer.update');

        return view('manufacturers.edit', ['manufacturer' => $manufacturer]);
    }

    public function update(Request $request, Manufacturer $manufacturer): RedirectResponse
    {
        Gate::authorize('manufacturer.update');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150', 'unique:manufacturers,name,'.$manufacturer->id],
            'contact_person' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:160'],
            'address' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $manufacturer->update($data);

        return to_route('manufacturers.edit', $manufacturer)->with('status', __('Manufacturer updated.'));
    }

    public function destroy(Manufacturer $manufacturer): RedirectResponse
    {
        Gate::authorize('manufacturer.delete');

        $manufacturer->delete();

        return to_route('manufacturers.index')->with('status', __('Manufacturer deleted.'));
    }
}
