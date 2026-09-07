{{-- Admin-only per the `can:user.manage` route gate in routes/web.php. Real list
     screens get x-data-table + filters in later phases; this is a minimal Phase 1
     table sufficient to satisfy gate G1.1 (admin creates a cashier user). --}}
@extends('layouts.app')

@section('title', 'Users')

@section('content')
    <x-page-header title="Users">
        <x-slot:action>
            <a href="{{ route('users.create') }}" class="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                New user
            </a>
        </x-slot:action>
    </x-page-header>

    <div class="mt-6 overflow-x-auto rounded border border-slate-200 bg-white">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50">
                <tr>
                    <th scope="col" class="px-4 py-2 text-left font-medium text-slate-500">Name</th>
                    <th scope="col" class="px-4 py-2 text-left font-medium text-slate-500">Email</th>
                    <th scope="col" class="px-4 py-2 text-left font-medium text-slate-500">Role</th>
                    <th scope="col" class="px-4 py-2 text-left font-medium text-slate-500">Status</th>
                    <th scope="col" class="px-4 py-2 text-right font-medium text-slate-500">
                        <span class="sr-only">Actions</span>
                    </th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                @forelse ($users as $user)
                    <tr>
                        <td class="px-4 py-2 text-slate-900">{{ $user->name }}</td>
                        <td class="px-4 py-2 text-slate-500">{{ $user->email }}</td>
                        <td class="px-4 py-2 text-slate-500">{{ $user->role?->label() ?? $user->role?->name }}</td>
                        <td class="px-4 py-2">
                            @if ($user->is_active)
                                <span class="rounded bg-ok-100 px-2 py-0.5 text-xs text-ok-800">Active</span>
                            @else
                                <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Inactive</span>
                            @endif
                        </td>
                        <td class="px-4 py-2 text-right">
                            <a href="{{ route('users.edit', $user) }}" class="text-brand-600 hover:underline">Edit</a>
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="5" class="px-4 py-6 text-center text-slate-400">No users yet.</td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>

    <div class="mt-4">
        {{ $users->links() }}
    </div>
@endsection
