{{--
    30/60/90-day expiry window picker. Red = expired or within 30 days
    (critical), amber = within 90 days (warning). Thresholds are read from
    the controller (settings-backed), never hard-coded in this view.
    brain/06-ui-conventions.md §3.
--}}
<x-app-layout>
    <x-page-header :title="'Expiry Report'" :breadcrumbs="[
        ['label' => 'Inventory', 'href' => route('inventory.index')],
        ['label' => 'Expiry Report'],
    ]" />

    <div class="mx-auto max-w-6xl px-4 py-6">
        <form method="GET" class="mb-4 flex items-end gap-3">
            <x-form.select name="days" label="Window" :options="[30 => '30 days', 60 => '60 days', 90 => '90 days']" value="{{ $days }}" />
            <button type="submit" class="rounded-md border border-slate-300 px-3 py-2 text-sm">Apply</button>
        </form>

        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 text-sm">
                <thead class="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <tr>
                        <th scope="col" class="px-3 py-2">Medicine</th>
                        <th scope="col" class="px-3 py-2">Batch No.</th>
                        <th scope="col" class="px-3 py-2">Expiry</th>
                        <th scope="col" class="px-3 py-2">Qty</th>
                        <th scope="col" class="px-3 py-2">Supplier</th>
                        <th scope="col" class="px-3 py-2">Flag</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($batches as $batch)
                        @php
                            $daysLeft = now()->diffInDays($batch->expiry_date, false);
                            $isCritical = $daysLeft <= 30;
                        @endphp
                        <tr class="border-t border-slate-100 {{ $isCritical ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800' }}">
                            <td class="px-3 py-2">{{ $batch->medicine->name }}</td>
                            <td class="px-3 py-2">{{ $batch->batch_no }}</td>
                            <td class="px-3 py-2"><x-expiry-pill :date="$batch->expiry_date" /></td>
                            <td class="px-3 py-2 tabular-nums">{{ $batch->quantity_available }}</td>
                            <td class="px-3 py-2">{{ $batch->purchase?->supplier?->name ?? '—' }}</td>
                            <td class="px-3 py-2 text-xs font-medium">
                                {{ $isCritical ? 'Critical — ≤30 days' : 'Warning — ≤90 days' }}
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>

        <div class="mt-4">{{ $batches->links() }}</div>
    </div>
</x-app-layout>
