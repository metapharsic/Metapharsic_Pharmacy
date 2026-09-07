{{--
    Rack master list. Occupancy is computed live in RackController::index()
    (SUM of quantity_available for available batches on each rack's shelves)
    — never a stored counter. Overfull racks (occupied > capacity) get a
    visible amber/red badge; colour is never the only signal, the text says
    "Overfull" too.
--}}
<x-app-layout>
    <x-page-header :title="'Racks'" :breadcrumbs="[['label' => 'Racks']]">
        <x-slot name="action">
            <a href="{{ route('inventory.racks') }}" class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Spatial Layout →
            </a>
            <a href="{{ route('racks.create') }}"
               class="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                New Rack
            </a>
        </x-slot>
    </x-page-header>

    <div class="mx-auto max-w-7xl px-4 py-6">
        <x-data-table :rows="$racks" :columns="['Code', 'Name', 'Zone', 'Aisle', 'Shelves', 'Occupancy', 'Status', 'Actions']" empty="No racks found.">
            @foreach ($racks as $rack)
                @php
                    $capacity = max(1, (int) $rack->max_capacity_boxes);
                    $occupied = (int) $rack->occupied_units;
                    $percent = (int) round(($occupied / $capacity) * 100);
                    $overfull = $occupied > $capacity;
                @endphp
                <tr>
                    <td class="px-4 py-2 font-medium text-slate-900">{{ $rack->rack_code }}</td>
                    <td class="px-4 py-2">{{ $rack->name }}</td>
                    <td class="px-4 py-2">{{ $rack->zone->name ?? '—' }}</td>
                    <td class="px-4 py-2">{{ $rack->aisle ?? '—' }}</td>
                    <td class="px-4 py-2 tabular-nums">{{ $rack->shelves_count }}</td>
                    <td class="px-4 py-2">
                        <div class="flex items-center gap-2">
                            <div class="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
                                <div class="h-full {{ $overfull ? 'bg-red-500' : ($percent >= 85 ? 'bg-amber-500' : 'bg-emerald-500') }}"
                                     style="width: {{ min(100, $percent) }}%"></div>
                            </div>
                            <span class="text-xs tabular-nums text-slate-600">{{ $occupied }} / {{ $capacity }} units ({{ $percent }}%)</span>
                        </div>
                        @if ($overfull)
                            <span class="mt-1 inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                                ⚠ Overfull — {{ $occupied - $capacity }} over capacity
                            </span>
                        @endif
                    </td>
                    <td class="px-4 py-2">
                        @if ($rack->status === 'active')
                            <span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Active</span>
                        @else
                            <span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Inactive</span>
                        @endif
                    </td>
                    <td class="px-4 py-2 whitespace-nowrap">
                        <a href="{{ route('racks.edit', $rack) }}" class="text-brand-700 hover:underline text-sm">Edit</a>
                        <form method="POST" action="{{ route('racks.destroy', $rack) }}" class="inline"
                              onsubmit="return confirm('{{ __('Delete this rack? This also removes its shelves and bins.') }}');">
                            @csrf
                            @method('DELETE')
                            <button type="submit" class="text-red-700 hover:underline text-sm ml-2">Delete</button>
                        </form>
                    </td>
                </tr>
            @endforeach
        </x-data-table>

        <div class="mt-4">{{ $racks->links() }}</div>
    </div>
</x-app-layout>
