<x-app-layout>
    <x-slot name="header">
        <x-page-header :title="'Suppliers'" :breadcrumbs="[['label' => 'Suppliers']]">
            <x-slot name="action">
                @can('supplier.create')
                    <a href="{{ route('suppliers.create') }}"
                       class="inline-flex items-center px-4 py-2 bg-brand-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-brand-700">
                        Add supplier
                    </a>
                @endcan
            </x-slot>
        </x-page-header>
    </x-slot>

    <x-data-table :columns="['Name', 'GSTIN', 'State code', 'Phone', 'Status', '']">
        <x-slot name="rows">
            @forelse ($suppliers as $supplier)
                <tr class="hover:bg-slate-50">
                    <td class="px-4 py-2 font-medium text-slate-900">
                        <a href="{{ route('suppliers.show', $supplier) }}" class="hover:underline">{{ $supplier->name }}</a>
                    </td>
                    <td class="px-4 py-2 text-slate-500 tabular-nums">{{ $supplier->gstin }}</td>
                    <td class="px-4 py-2 text-slate-500 tabular-nums">{{ $supplier->state_code }}</td>
                    <td class="px-4 py-2 text-slate-500 tabular-nums">{{ $supplier->phone }}</td>
                    <td class="px-4 py-2">
                        @if ($supplier->is_active)
                            <span class="text-ok-700">Active</span>
                        @else
                            <span class="text-slate-400">Inactive</span>
                        @endif
                    </td>
                    <td class="px-4 py-2 text-right">
                        @can('supplier.update')
                            <a href="{{ route('suppliers.edit', $supplier) }}" class="text-sm text-brand-600 hover:underline">Edit</a>
                        @endcan
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="6" class="px-4 py-8 text-center text-slate-400">
                        No suppliers yet. <a href="{{ route('suppliers.create') }}" class="text-brand-600 hover:underline">Add the first one</a>.
                    </td>
                </tr>
            @endforelse
        </x-slot>
        <x-slot name="pagination">
            {{ $suppliers->links() }}
        </x-slot>
    </x-data-table>
</x-app-layout>
