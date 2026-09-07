<x-app-layout>
    <x-page-header :title="'Low Stock'" :breadcrumbs="[
        ['label' => 'Inventory', 'href' => route('inventory.index')],
        ['label' => 'Low Stock'],
    ]" />

    <div class="mx-auto max-w-5xl px-4 py-6">
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 text-sm">
                <thead class="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <tr>
                        <th scope="col" class="px-3 py-2">Medicine</th>
                        <th scope="col" class="px-3 py-2">Available Qty</th>
                        <th scope="col" class="px-3 py-2">Min Stock Level</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($medicines as $medicine)
                        <tr class="border-t border-amber-200 border-l-4 border-l-amber-500 bg-amber-50/40">
                            <td class="px-3 py-2">{{ $medicine->name }}</td>
                            <td class="px-3 py-2 tabular-nums text-amber-800 font-medium">{{ $medicine->available_quantity ?? 0 }}</td>
                            <td class="px-3 py-2 tabular-nums">{{ $medicine->min_stock_level }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="3" class="px-3 py-6 text-center text-slate-500">No medicines are below their minimum stock level.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
</x-app-layout>
