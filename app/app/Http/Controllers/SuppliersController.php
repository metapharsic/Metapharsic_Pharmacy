<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Supplier;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

class SuppliersController extends Controller
{
    public function index(): View
    {
        Gate::authorize('supplier.view');

        $suppliers = Supplier::query()->orderBy('name')->paginate(25);

        return view('suppliers.index', ['suppliers' => $suppliers]);
    }

    public function create(): View
    {
        Gate::authorize('supplier.create');

        return view('suppliers.create', [
            'stateCodes' => $this->stateCodes(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('supplier.create');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'contact_person' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:160'],
            'address' => ['nullable', 'string'],
            'state_code' => ['nullable', 'string', 'size:2'],
            'gstin' => ['nullable', 'string', 'max:15', 'unique:suppliers,gstin'],
            'drug_license_no' => ['nullable', 'string', 'max:40'],
            'payment_terms_days' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $supplier = Supplier::query()->create([
            ...$data,
            'created_by' => $request->user()?->id,
        ]);

        return to_route('suppliers.edit', $supplier)->with('status', __('Supplier created.'));
    }

    public function edit(Supplier $supplier): View
    {
        Gate::authorize('supplier.update');

        return view('suppliers.edit', [
            'supplier' => $supplier,
            'stateCodes' => $this->stateCodes(),
        ]);
    }

    private function stateCodes(): array
    {
        return [
            '01' => 'Jammu and Kashmir',
            '02' => 'Himachal Pradesh',
            '03' => 'Punjab',
            '04' => 'Chandigarh',
            '05' => 'Uttarakhand',
            '06' => 'Haryana',
            '07' => 'Delhi',
            '08' => 'Rajasthan',
            '09' => 'Uttar Pradesh',
            '10' => 'Bihar',
            '19' => 'West Bengal',
            '27' => 'Maharashtra',
            '29' => 'Karnataka',
            '32' => 'Kerala',
            '33' => 'Tamil Nadu',
            '36' => 'Telangana',
            '37' => 'Andhra Pradesh',
        ];
    }

    public function update(Request $request, Supplier $supplier): RedirectResponse
    {
        Gate::authorize('supplier.update');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'contact_person' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:160'],
            'address' => ['nullable', 'string'],
            'state_code' => ['nullable', 'string', 'size:2'],
            'gstin' => ['nullable', 'string', 'max:15', 'unique:suppliers,gstin,'.$supplier->id],
            'drug_license_no' => ['nullable', 'string', 'max:40'],
            'payment_terms_days' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        // outstanding_balance is deliberately absent: it is maintained only by
        // PurchaseService/supplier_payments (Phase 3), never by this controller.
        $supplier->update($data);

        return to_route('suppliers.edit', $supplier)->with('status', __('Supplier updated.'));
    }

    public function destroy(Supplier $supplier): RedirectResponse
    {
        Gate::authorize('supplier.delete');

        $supplier->delete();

        return to_route('suppliers.index')->with('status', __('Supplier deleted.'));
    }
}
