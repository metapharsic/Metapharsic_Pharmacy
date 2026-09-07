<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\ShopLicense;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;
use Illuminate\View\View;

/**
 * Admin-only management of shop-level Drug License (DL) records — Phase 8e
 * (brain/11-gap-closure-architecture.md §6, Gap 5). Gated by license.manage
 * on every method, matching the DiscountSchemeController/scheme.manage
 * pattern. Pure compliance master data — no stock or sale interaction.
 */
final class ShopLicenseController extends Controller
{
    public function index(): View
    {
        Gate::authorize('license.manage');

        $licenses = ShopLicense::query()
            ->orderBy('expires_on')
            ->paginate(25);

        return view('settings.licenses.index', ['licenses' => $licenses]);
    }

    public function create(): View
    {
        Gate::authorize('license.manage');

        return view('settings.licenses.create');
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('license.manage');

        $data = $this->validated($request);

        ShopLicense::query()->create($data);

        return to_route('settings.licenses.index')->with('status', __('License created.'));
    }

    public function edit(ShopLicense $license): View
    {
        Gate::authorize('license.manage');

        return view('settings.licenses.edit', ['license' => $license]);
    }

    public function update(Request $request, ShopLicense $license): RedirectResponse
    {
        Gate::authorize('license.manage');

        $data = $this->validated($request);

        $license->update($data);

        return to_route('settings.licenses.index')->with('status', __('License updated.'));
    }

    public function destroy(ShopLicense $license): RedirectResponse
    {
        Gate::authorize('license.manage');

        $license->delete();

        return to_route('settings.licenses.index')->with('status', __('License deleted.'));
    }

    /**
     * Shared validation for store()/update().
     */
    private function validated(Request $request): array
    {
        $data = Validator::make($request->all(), [
            'license_type' => ['required', 'string', 'max:100'],
            'license_number' => ['required', 'string', 'max:100'],
            'issued_on' => ['required', 'date'],
            'expires_on' => ['required', 'date', 'after_or_equal:issued_on'],
            'issuing_authority' => ['nullable', 'string', 'max:150'],
            'is_active' => ['sometimes', 'boolean'],
        ])->validate();

        $data['is_active'] = $request->boolean('is_active');

        return $data;
    }
}
