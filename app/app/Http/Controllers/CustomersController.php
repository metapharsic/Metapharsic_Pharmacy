<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Doctor;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

class CustomersController extends Controller
{
    public function index(): View
    {
        Gate::authorize('customer.view');

        $customers = Customer::query()->orderBy('name')->paginate(25);

        return view('customers.index', ['customers' => $customers]);
    }

    public function create(): View
    {
        Gate::authorize('customer.create');

        return view('customers.create', ['doctors' => Doctor::query()->active()->orderBy('name')->pluck('name', 'id')]);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('customer.create');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'phone' => ['nullable', 'string', 'max:20', 'unique:customers,phone'],
            'email' => ['nullable', 'email', 'max:160'],
            'address' => ['nullable', 'string'],
            'doctor_name' => ['nullable', 'string', 'max:150'],
            'doctor_id' => ['nullable', 'integer', 'exists:doctors,id'],
            'gstin' => ['nullable', 'string', 'max:15'],
            'state_code' => ['nullable', 'string', 'size:2'],
            'credit_limit' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $customer = Customer::query()->create([
            ...$data,
            'created_by' => $request->user()?->id,
        ]);

        return to_route('customers.edit', $customer)->with('status', __('Customer created.'));
    }

    public function edit(Customer $customer): View
    {
        Gate::authorize('customer.update');

        return view('customers.edit', [
            'customer' => $customer,
            'doctors' => Doctor::query()->active()->orderBy('name')->pluck('name', 'id'),
        ]);
    }

    public function update(Request $request, Customer $customer): RedirectResponse
    {
        Gate::authorize('customer.update');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'phone' => ['nullable', 'string', 'max:20', 'unique:customers,phone,'.$customer->id],
            'email' => ['nullable', 'email', 'max:160'],
            'address' => ['nullable', 'string'],
            'doctor_name' => ['nullable', 'string', 'max:150'],
            'doctor_id' => ['nullable', 'integer', 'exists:doctors,id'],
            'gstin' => ['nullable', 'string', 'max:15'],
            'state_code' => ['nullable', 'string', 'size:2'],
            'credit_limit' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        // outstanding_balance is deliberately absent: it moves only via SalesService /
        // payments (Phase 4), never through this form.
        $customer->update($data);

        return to_route('customers.edit', $customer)->with('status', __('Customer updated.'));
    }

    public function destroy(Customer $customer): RedirectResponse
    {
        Gate::authorize('customer.delete');

        $customer->delete();

        return to_route('customers.index')->with('status', __('Customer deleted.'));
    }
}
