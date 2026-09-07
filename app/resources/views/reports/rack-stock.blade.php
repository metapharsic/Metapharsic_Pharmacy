{{--
    Rack-wise stock report. Per-rack occupancy vs capacity summary at the
    top (live SUM, never a stored counter — see ReportService::rackStockReport()),
    then every available batch currently assigned to a shelf, grouped by rack.
--}}
<x-app-layout>
    <x-page-header :title="'Rack-wise Stock'" :breadcrumbs="[['label' => 'Reports', 'url' => route('reports.sales')], ['label' => 'Rack-wise Stock']]">
        <x-slot name="action">
            <a href="{{ route('reports.rack-stock', ['format' => 'csv']) }}"
               class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Export CSV
            </a>
        </x-slot>
    </x-page-header>

    <div class="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <div class="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div class="p-4 border-b border-slate-200 text-sm font-semibold text-slate-700">Rack Occupancy Summary</div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-slate-200 text-sm">
                    <thead class="bg-slate-50">
                        <tr>
                            <th class="px-4 py-2 text-left font-medium text-slate-600">Rack</th>
                            <th class="px-4 py-2 text-left font-medium text-slate-600">Occupancy</th>
                            <th class="px-4 py-2 text-left font-medium text-slate-600">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        @forelse ($rackSummary as $summary)
                            @php
                                $capacity = max(1, (int) $summary->capacity);
                                $occupied = (int) $summary->occupied;
                                $percent = (int) round(($occupied / $capacity) * 100);
                                $overfull = $occupied > $capacity;
                            @endphp
                            <tr>
                                <td class="px-4 py-2 font-medium text-slate-900">{{ $summary->rack_code }} — {{ $summary->rack_name }}</td>
                                <td class="px-4 py-2">
                                    <div class="flex items-center gap-2">
                                        <div class="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
                                            <div class="h-full {{ $overfull ? 'bg-red-500' : ($percent >= 85 ? 'bg-amber-500' : 'bg-emerald-500') }}"
                                                 style="width: {{ min(100, $percent) }}%"></div>
                                        </div>
                                        <span class="text-xs tabular-nums text-slate-600">{{ $occupied }} / {{ $capacity }} units ({{ $percent }}%)</span>
                                    </div>
                                </td>
                                <td class="px-4 py-2">
                                    @if ($overfull)
                                        <span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">⚠ Overfull</span>
                                    @else
                                        <span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">OK</span>
                                    @endif
                                </td>
                            </tr>
                        @empty
                            <tr><td colspan="3" class="px-4 py-6 text-center text-slate-400">No racks with assigned stock.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>

        <x-data-table :columns="['Zone', 'Rack', 'Shelf', 'Medicine', 'Batch No.', 'Expiry', 'Qty Available']" empty="No stock currently assigned to a rack.">
            @forelse ($rows as $row)
                <tr>
                    <td class="px-4 py-2">{{ $row->zone_name }}</td>
                    <td class="px-4 py-2">{{ $row->rack_code }} — {{ $row->rack_name }}</td>
                    <td class="px-4 py-2">{{ $row->shelf_code }}</td>
                    <td class="px-4 py-2">{{ $row->medicine_name }}</td>
                    <td class="px-4 py-2">{{ $row->batch_no }}</td>
                    <td class="px-4 py-2">{{ \Illuminate\Support\Carbon::parse($row->expiry_date)->format('d/m/Y') }}</td>
                    <td class="px-4 py-2 tabular-nums">{{ $row->quantity_available }}</td>
                </tr>
            @empty
                <tr><td colspan="7" class="px-4 py-6 text-center text-slate-400">No stock currently assigned to a rack.</td></tr>
            @endforelse
        </x-data-table>
    </div>
</x-app-layout>
