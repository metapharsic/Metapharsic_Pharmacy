{{--
    Batch-wise stock list. Colour semantics per brain/06-ui-conventions.md §3:
    red = expired/quarantined (struck through, non-selectable), amber =
    within the 90-day warning window, plain = normal. Colour is never the
    only signal — every row also carries text.
--}}
<x-app-layout>
    <x-page-header :title="'Inventory'" :breadcrumbs="[['label' => 'Inventory']]" />

    <div class="mx-auto max-w-7xl px-4 py-6">
        <form method="GET" class="mb-4 flex flex-wrap items-end gap-3">
            <x-form.select name="medicine_id" label="Medicine" :options="['' => 'All'] + $medicines->pluck('name', 'id')->all()" value="{{ request('medicine_id') }}" />
            <x-form.date name="expiry_from" label="Expiry from" value="{{ request('expiry_from') }}" />
            <x-form.date name="expiry_to" label="Expiry to" value="{{ request('expiry_to') }}" />
            <button type="submit" class="rounded-md border border-slate-300 px-3 py-2 text-sm">Filter</button>
            <a href="{{ route('inventory.racks') }}" class="ml-auto rounded-md bg-brand-50 border border-brand-200 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">🗄️ Racks Layout →</a>
            <a href="{{ route('inventory.low-stock') }}" class="text-sm text-brand-700 hover:underline">Low stock →</a>
            <a href="{{ route('inventory.expiry-report') }}" class="text-sm text-brand-700 hover:underline">Expiry report →</a>
        </form>

        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 text-sm">
                <thead class="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <tr>
                        <th scope="col" class="px-3 py-2">Medicine</th>
                        <th scope="col" class="px-3 py-2">Batch No.</th>
                        <th scope="col" class="px-3 py-2">Expiry</th>
                        <th scope="col" class="px-3 py-2">Available Qty</th>
                        <th scope="col" class="px-3 py-2">Status</th>
                        <th scope="col" class="px-3 py-2">Rack Location</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($batches as $batch)
                        @php
                            $isExpired = $batch->expiry_date->isPast() || in_array($batch->status->value, ['expired', 'quarantined'], true);
                            $isWarning = ! $isExpired && $batch->expiry_date->lte(now()->addDays(90));
                        @endphp
                        <tr class="border-t border-slate-100 {{ $isExpired ? 'bg-red-100 text-red-800 line-through' : ($isWarning ? 'bg-amber-100 text-amber-800' : '') }}">
                            <td class="px-3 py-2">{{ $batch->medicine->name }}</td>
                            <td class="px-3 py-2">{{ $batch->batch_no }}</td>
                            <td class="px-3 py-2"><x-expiry-pill :date="$batch->expiry_date" /></td>
                            <td class="px-3 py-2 tabular-nums">{{ $batch->quantity_available }}</td>
                            <td class="px-3 py-2">
                                <x-batch-badge :batch="$batch" />
                                @if ($isExpired)
                                    <span class="ml-1 text-xs font-medium">Expired — not sellable</span>
                                @elseif ($isWarning)
                                    <span class="ml-1 text-xs font-medium">Expiring soon</span>
                                @endif
                            </td>
                            <td class="px-3 py-2">
                                @can('rack.manage')
                                    <form method="POST" action="{{ route('inventory.batches.assign-rack', $batch) }}" class="flex items-center gap-1">
                                        @csrf
                                        @method('PATCH')
                                        <select name="rack_shelf_id" onchange="this.form.submit()"
                                                class="rounded-md border-slate-300 text-xs shadow-sm focus:border-brand-500 focus:ring-brand-500">
                                            <option value="">Unassigned</option>
                                            @foreach ($rackShelves as $rack)
                                                <optgroup label="{{ $rack->rack_code }} — {{ $rack->name }}">
                                                    @foreach ($rack->shelves as $shelf)
                                                        <option value="{{ $shelf->id }}" @selected($batch->rack_shelf_id === $shelf->id)>
                                                            {{ $shelf->shelf_code }}
                                                        </option>
                                                    @endforeach
                                                </optgroup>
                                            @endforeach
                                        </select>
                                        <noscript><button type="submit" class="text-xs text-brand-700 hover:underline">Save</button></noscript>
                                    </form>
                                @else
                                    {{ $batch->rackShelf->shelf_code ?? '—' }}
                                @endcan
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>

        <div class="mt-4">{{ $batches->links() }}</div>
    </div>
</x-app-layout>
