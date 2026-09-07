<x-app-layout>
    <x-page-header :title="'Stock Adjustments'" :breadcrumbs="[
        ['label' => 'Inventory', 'href' => route('inventory.index')],
        ['label' => 'Stock Adjustments'],
    ]">
        <x-slot name="action">
            @can('stock.adjust')
                <a href="{{ route('stock-adjustments.create') }}"
                   class="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    New Adjustment
                </a>
            @endcan
        </x-slot>
    </x-page-header>

    <div class="mx-auto max-w-7xl px-4 py-6">
        <form method="GET" class="mb-4 flex flex-wrap items-end gap-3">
            <x-form.select name="reason" label="Reason" :options="collect($reasons)->mapWithKeys(
                fn ($case) => [$case->value => $case->label()]
            )->prepend('All', '')->all()" value="{{ $reason }}" />
            <button type="submit" class="rounded-md border border-slate-300 px-3 py-2 text-sm">Filter</button>
        </form>

        <x-data-table :rows="$adjustments" :columns="['Date', 'Medicine', 'Batch', 'Qty Change', 'Reason', 'By', 'Note']" empty="No stock adjustments found.">
            @forelse ($adjustments as $adjustment)
                <tr>
                    <td class="px-4 py-2 whitespace-nowrap">{{ $adjustment->created_at->format('d/m/Y H:i') }}</td>
                    <td class="px-4 py-2">{{ $adjustment->batch?->medicine?->name ?? '—' }}</td>
                    <td class="px-4 py-2">{{ $adjustment->batch?->batch_no ?? '—' }}</td>
                    <td class="px-4 py-2 tabular-nums font-medium {{ $adjustment->quantity_change >= 0 ? 'text-emerald-700' : 'text-red-700' }}">
                        {{ $adjustment->quantity_change >= 0 ? '+' : '' }}{{ $adjustment->quantity_change }}
                    </td>
                    <td class="px-4 py-2">
                        <span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {{ $adjustment->reason?->label() ?? $adjustment->reason }}
                        </span>
                    </td>
                    <td class="px-4 py-2">{{ $adjustment->user?->name ?? '—' }}</td>
                    <td class="px-4 py-2 text-slate-600">{{ $adjustment->note ?? '—' }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="7" class="px-4 py-6 text-center text-slate-400">No stock adjustments found.</td>
                </tr>
            @endforelse
        </x-data-table>

        <div class="mt-4">{{ $adjustments->links() }}</div>
    </div>
</x-app-layout>
