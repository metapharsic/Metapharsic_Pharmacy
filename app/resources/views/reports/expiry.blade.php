{{--
    Expiry window report — phase-5-reports.md T-0506b. report.expiry permission.
    Colour-coded per brain/06-ui-conventions.md §3: red = expired/<=30 days,
    amber = <=90 days, plain text beyond that — colour is decided server-side
    here from expiry_date, never trusted from the client.

    Cave law 2: no cost column. Grouped with supplier so the shop knows who
    to call, per T-0506b — no purchase_price needed for that.
--}}
<x-app-layout>
    <x-slot name="title">Expiry Report</x-slot>

    <div class="space-y-4">
        <div class="flex items-center justify-between">
            <h1 class="text-xl font-semibold text-slate-900">Expiry Report</h1>
            <a
                href="{{ route('reports.expiry', array_merge(request()->query(), ['format' => 'csv'])) }}"
                class="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
                Export CSV
            </a>
        </div>

        <form method="GET" action="{{ route('reports.expiry') }}" class="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <div>
                <label for="days" class="block text-xs font-medium text-slate-600">Window</label>
                <select id="days" name="days" class="mt-1 rounded border-slate-300 text-sm" onchange="this.form.submit()">
                    @foreach ([30, 60, 90, 180] as $option)
                        <option value="{{ $option }}" @selected((int) request('days', 90) === $option)>{{ $option }} days</option>
                    @endforeach
                </select>
            </div>
            <div>
                <label for="supplier_id" class="block text-xs font-medium text-slate-600">Supplier</label>
                <select id="supplier_id" name="supplier_id" class="mt-1 rounded border-slate-300 text-sm">
                    <option value="">All</option>
                    @foreach (($suppliers ?? []) as $supplier)
                        <option value="{{ $supplier->id }}" @selected(request('supplier_id') == $supplier->id)>{{ $supplier->name }}</option>
                    @endforeach
                </select>
            </div>
            <button type="submit" class="rounded bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                Filter
            </button>
        </form>

        <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table class="w-full text-sm">
                <thead class="bg-slate-50">
                    <tr class="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th scope="col" class="px-4 py-2">Medicine</th>
                        <th scope="col" class="px-4 py-2">Batch #</th>
                        <th scope="col" class="px-4 py-2">Supplier</th>
                        <th scope="col" class="px-4 py-2">Expiry</th>
                        <th scope="col" class="px-4 py-2 text-right">Qty Available</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse (($rows ?? []) as $row)
                        @php
                            $expiryDate = \Illuminate\Support\Carbon::parse($row['expiry_date'] ?? now());
                            $daysLeft = (int) now()->diffInDays($expiryDate, false);

                            // Colour windows per brain/06-ui-conventions.md §3:
                            // expired or <=30 days = red (hard warning), <=90 = amber, else plain.
                            $rowClass = match (true) {
                                $daysLeft <= 30 => 'bg-danger-100 text-danger-800',
                                $daysLeft <= 90 => 'bg-warn-100 text-warn-800',
                                default => '',
                            };
                        @endphp
                        <tr class="border-t border-slate-100 {{ $rowClass }}">
                            <td class="px-4 py-2">{{ $row['medicine_name'] ?? '' }}</td>
                            <td class="px-4 py-2">{{ $row['batch_number'] ?? '' }}</td>
                            <td class="px-4 py-2">{{ $row['supplier_name'] ?? '' }}</td>
                            <td class="px-4 py-2" title="{{ $daysLeft }} days">{{ $expiryDate->format('d M Y') }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">{{ $row['quantity_available'] ?? 0 }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="5" class="px-4 py-6 text-center text-slate-500">No batches in this window.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
</x-app-layout>
