<x-app-layout>
    <x-page-header :title="'Purchases'" :breadcrumbs="[['label' => 'Purchases']]">
        <x-slot name="action">
            @can('purchase.create')
                <a href="{{ route('purchases.create') }}"
                   class="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    New Purchase
                </a>
            @endcan
        </x-slot>
    </x-page-header>

    <div class="mx-auto max-w-7xl px-4 py-6">
        <form method="GET" class="mb-4 flex flex-wrap items-end gap-3">
            <x-form.select name="status" label="Status" :options="[
                '' => 'All',
                'draft' => 'Draft',
                'confirmed' => 'Confirmed',
                'cancelled' => 'Cancelled',
            ]" value="{{ request('status') }}" />
            <button type="submit" class="rounded-md border border-slate-300 px-3 py-2 text-sm">Filter</button>
        </form>

        <x-data-table :rows="$purchases" :columns="['Invoice #', 'Supplier', 'Date', 'Status', 'Total']" empty="No purchases found.">
            @foreach ($purchases as $purchase)
                <tr>
                    <td class="px-4 py-2">
                        <a href="{{ route('purchases.show', $purchase) }}" class="text-brand-700 hover:underline">
                            {{ $purchase->invoice_no }}
                        </a>
                    </td>
                    <td class="px-4 py-2">{{ $purchase->supplier->name }}</td>
                    <td class="px-4 py-2">{{ $purchase->invoice_date->format('d/m/Y') }}</td>
                    <td class="px-4 py-2">
                        @if ($purchase->status->value === 'draft')
                            <span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Draft</span>
                        @elseif ($purchase->status->value === 'confirmed')
                            <span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Confirmed</span>
                        @else
                            <span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">Cancelled</span>
                        @endif
                    </td>
                    <td class="px-4 py-2 tabular-nums"><x-money :value="$purchase->items->sum(fn ($i) => $i->quantity * $i->purchase_price)" /></td>
                </tr>
            @endforeach
        </x-data-table>

        <div class="mt-4">{{ $purchases->links() }}</div>
    </div>
</x-app-layout>
