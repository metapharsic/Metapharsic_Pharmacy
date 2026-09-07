<x-app-layout>
    <x-slot name="header">
        <x-page-header :title="'Medicine Manufacturers'" :breadcrumbs="[
            ['label' => 'Manufacturers'],
        ]">
            @can('manufacturer.create')
                <a href="{{ route('manufacturers.create') }}" class="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500">
                    + Add Manufacturer
                </a>
            @endcan
        </x-page-header>
    </x-slot>

    @if (session('status'))
        <div class="mb-4 rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800">
            {{ session('status') }}
        </div>
    @endif

    <div class="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50">
                <tr>
                    <th class="px-4 py-3 text-left font-semibold text-slate-700">Manufacturer Name</th>
                    <th class="px-4 py-3 text-left font-semibold text-slate-700">Contact Person</th>
                    <th class="px-4 py-3 text-left font-semibold text-slate-700">Phone / Email</th>
                    <th class="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                    <th class="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                @forelse ($manufacturers as $mfg)
                    <tr class="hover:bg-slate-50">
                        <td class="px-4 py-3 font-medium text-slate-900">{{ $mfg->name }}</td>
                        <td class="px-4 py-3 text-slate-500">{{ $mfg->contact_person ?? '—' }}</td>
                        <td class="px-4 py-3 text-slate-500">{{ $mfg->phone ?? $mfg->email ?? '—' }}</td>
                        <td class="px-4 py-3">
                            <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {{ $mfg->is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800' }}">
                                {{ $mfg->is_active ? 'Active' : 'Inactive' }}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-right">
                            @can('manufacturer.update')
                                <a href="{{ route('manufacturers.edit', $mfg) }}" class="text-brand-600 hover:text-brand-800 font-medium">Edit</a>
                            @endcan
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="5" class="px-4 py-8 text-center text-slate-400">No manufacturers found.</td>
                    </tr>
                @endforelse
            </tbody>
        </table>

        @if ($manufacturers->hasPages())
            <div class="p-4 border-t border-slate-100">
                {{ $manufacturers->links() }}
            </div>
        @endif
    </div>
</x-app-layout>
