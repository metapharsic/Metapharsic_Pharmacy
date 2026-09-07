<x-app-layout>
    <x-slot name="header">
        <x-page-header :title="'Customers'" :breadcrumbs="[['label' => 'Customers']]">
            <x-slot name="action">
                @can('customer.create')
                    <a href="{{ route('customers.create') }}"
                       class="inline-flex items-center px-4 py-2 bg-brand-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-brand-700">
                        Add customer
                    </a>
                @endcan
            </x-slot>
        </x-page-header>
    </x-slot>

    <x-data-table :columns="['Name', 'Phone', 'Credit limit', 'Outstanding', 'Status', '']">
        <x-slot name="rows">
            @forelse ($customers as $customer)
                <tr class="hover:bg-slate-50">
                    <td class="px-4 py-2 font-medium text-slate-900">
                        <a href="{{ route('customers.edit', $customer) }}" class="hover:underline">{{ $customer->name }}</a>
                    </td>
                    <td class="px-4 py-2 text-slate-500 tabular-nums">{{ $customer->phone }}</td>
                    <td class="px-4 py-2 tabular-nums"><x-money :value="$customer->credit_limit" /></td>
                    <td class="px-4 py-2 tabular-nums"><x-money :value="$customer->outstanding_balance" /></td>
                    <td class="px-4 py-2">
                        @if ($customer->is_active)
                            <span class="text-ok-700">Active</span>
                        @else
                            <span class="text-slate-400">Inactive</span>
                        @endif
                    </td>
                    <td class="px-4 py-2 text-right">
                        @can('customer.update')
                            <a href="{{ route('customers.edit', $customer) }}" class="text-sm text-brand-600 hover:underline">Edit</a>
                        @endcan
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="6" class="px-4 py-8 text-center text-slate-400">
                        No customers yet. <a href="{{ route('customers.create') }}" class="text-brand-600 hover:underline">Add the first one</a>.
                    </td>
                </tr>
            @endforelse
        </x-slot>
        <x-slot name="pagination">
            {{ $customers->links() }}
        </x-slot>
    </x-data-table>
</x-app-layout>
