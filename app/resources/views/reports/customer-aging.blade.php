{{--
    Customer aging report — phase-5-reports.md T-0507a/T-0507c. customer.ledger /
    report.aging permission. Buckets computed from real invoice dates
    (0-30/31-60/61-90/90+), not a single lump opening balance, per Q-007.

    Cave law 2: no cost column — this is receivables, not margin.
--}}
<x-app-layout>
    <x-slot name="title">Customer Aging</x-slot>

    <div class="space-y-4">
        <div class="flex items-center justify-between">
            <h1 class="text-xl font-semibold text-slate-900">Customer Aging</h1>
            <a
                href="{{ route('reports.customer-aging', array_merge(request()->query(), ['type' => 'customer', 'format' => 'csv'])) }}"
                class="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
                Export CSV
            </a>
        </div>

        <form method="GET" action="{{ route('reports.customer-aging') }}" class="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <input type="hidden" name="type" value="customer">
            <div>
                <label for="as_of" class="block text-xs font-medium text-slate-600">As Of</label>
                <input type="date" id="as_of" name="as_of" value="{{ request('as_of') }}" class="mt-1 rounded border-slate-300 text-sm">
            </div>
            <div>
                <label for="customer_id" class="block text-xs font-medium text-slate-600">Customer</label>
                <select id="customer_id" name="customer_id" class="mt-1 rounded border-slate-300 text-sm">
                    <option value="">All</option>
                    @foreach (($customers ?? []) as $customer)
                        <option value="{{ $customer->id }}" @selected(request('customer_id') == $customer->id)>{{ $customer->name }}</option>
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
                        <th scope="col" class="px-4 py-2">Customer</th>
                        <th scope="col" class="px-4 py-2 text-right">0–30 Days</th>
                        <th scope="col" class="px-4 py-2 text-right">31–60 Days</th>
                        <th scope="col" class="px-4 py-2 text-right">61–90 Days</th>
                        <th scope="col" class="px-4 py-2 text-right">90+ Days</th>
                        <th scope="col" class="px-4 py-2 text-right">Total Outstanding</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse (($rows ?? []) as $row)
                        <tr class="border-t border-slate-100">
                            <td class="px-4 py-2">{{ $row['customer_name'] ?? '' }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($row['bucket_0_30'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($row['bucket_31_60'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums {{ ($row['bucket_61_90'] ?? 0) > 0 ? 'text-warn-700 font-medium' : '' }}">₹{{ number_format((float) ($row['bucket_61_90'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums {{ ($row['bucket_90_plus'] ?? 0) > 0 ? 'text-danger-700 font-medium' : '' }}">₹{{ number_format((float) ($row['bucket_90_plus'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums font-medium">₹{{ number_format((float) ($row['total_outstanding'] ?? 0), 2) }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="6" class="px-4 py-6 text-center text-slate-500">No outstanding balances.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
</x-app-layout>
