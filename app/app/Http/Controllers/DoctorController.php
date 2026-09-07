<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Doctor;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

class DoctorController extends Controller
{
    public function index(Request $request): View
    {
        Gate::authorize('customer.view');

        $doctors = Doctor::query()
            ->when($request->boolean('active'), fn ($query) => $query->active())
            ->orderBy('name')
            ->paginate(25);

        return view('doctors.index', ['doctors' => $doctors]);
    }

    public function create(): View
    {
        Gate::authorize('customer.create');

        return view('doctors.create');
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('customer.create');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'registration_no' => ['nullable', 'string', 'max:60'],
            'phone' => ['nullable', 'string', 'max:20'],
            'specialization' => ['nullable', 'string', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $doctor = Doctor::query()->create([
            ...$data,
            'created_by' => $request->user()?->id,
        ]);

        return to_route('doctors.edit', $doctor)->with('status', __('Doctor created.'));
    }

    public function edit(Doctor $doctor): View
    {
        Gate::authorize('customer.update');

        return view('doctors.edit', ['doctor' => $doctor]);
    }

    public function update(Request $request, Doctor $doctor): RedirectResponse
    {
        Gate::authorize('customer.update');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'registration_no' => ['nullable', 'string', 'max:60'],
            'phone' => ['nullable', 'string', 'max:20'],
            'specialization' => ['nullable', 'string', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $doctor->update($data);

        return to_route('doctors.edit', $doctor)->with('status', __('Doctor updated.'));
    }

    public function destroy(Doctor $doctor): RedirectResponse
    {
        Gate::authorize('customer.delete');

        // Deletion is allowed regardless of linked customers: customers.doctor_id is
        // nullOnDelete-free here (FK uses nullOnDelete, not a delete restriction), and
        // soft-deleting a Doctor keeps the row queryable via ->withTrashed() so existing
        // customer.doctor_id FKs / sale-history references keep resolving fine. A
        // soft-deleted doctor is simply excluded from the active() scope and thus from
        // new-assignment dropdowns going forward. This is simpler than a hard block and
        // matches how Customer soft-deletes already work in this codebase.
        $doctor->delete();

        return to_route('doctors.index')->with('status', __('Doctor deleted.'));
    }
}
