{{--
    Sales report — phase-5-reports.md T-0503a. report.sales permission.

    Cave law 2: cost never reaches a cashier's or pharmacist's browser. This
    table has no cost_price_at_sale, purchase_price, or margin column — sale
    price and tax only. ReportService::salesReport() must not select cost
    columns for this view in the first place (excluded at the query layer,
    not hidden here) — this view has nothing to hide even if it tried.
--}}
<x-app-layout>
    <x-slot name="title">Sales Report</x-slot>

    <div class="space-y-4">
        <div class="flex items-center justify-between">
            <h1 class="text-xl font-semibold text-slate-900">Sales Report</h1>
            <a
                href="{{ route('reports.sales', array_merge(request()->query(), ['format' => 'csv'])) }}"
                class="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
                Export CSV
            </a>
        </div>

        <form method="GET" action="{{ route('reports.sales') }}" class="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <div>
                <label for="from" class="block text-xs font-medium text-slate-600">From</label>
                <input type="date" id="from" name="from" value="{{ request('from') }}" class="mt-1 rounded border-slate-300 text-sm">
            </div>
            <div>
                <label for="to" class="block text-xs font-medium text-slate-600">To</label>
                <input type="date" id="to" name="to" value="{{ request('to') }}" class="mt-1 rounded border-slate-300 text-sm">
            </div>
            <div>
                <label for="user_id" class="block text-xs font-medium text-slate-600">Cashier</label>
                <select id="user_id" name="user_id" class="mt-1 rounded border-slate-300 text-sm">
                    <option value="">All</option>
                    @foreach (($users ?? []) as $user)
                        <option value="{{ $user->id }}" @selected(request('user_id') == $user->id)>{{ $user->name }}</option>
                    @endforeach
                </select>
            </div>
            <div>
                <label for="payment_mode" class="block text-xs font-medium text-slate-600">Payment Mode</label>
                <select id="payment_mode" name="payment_mode" class="mt-1 rounded border-slate-300 text-sm">
                    <option value="">All</option>
                    <option value="cash" @selected(request('payment_mode') === 'cash')>Cash</option>
                    <option value="card" @selected(request('payment_mode') === 'card')>Card</option>
                    <option value="upi" @selected(request('payment_mode') === 'upi')>UPI</option>
                    <option value="credit" @selected(request('payment_mode') === 'credit')>Credit</option>
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
                        <th scope="col" class="px-4 py-2">Date</th>
                        <th scope="col" class="px-4 py-2">Invoice #</th>
                        <th scope="col" class="px-4 py-2">Cashier</th>
                        <th scope="col" class="px-4 py-2">Payment Mode</th>
                        <th scope="col" class="px-4 py-2 text-right">Items</th>
                        <th scope="col" class="px-4 py-2 text-right">Tax</th>
                        <th scope="col" class="px-4 py-2 text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse (($rows ?? []) as $row)
                        <tr class="border-t border-slate-100">
                            <td class="px-4 py-2">{{ $row['date'] ?? '' }}</td>
                            <td class="px-4 py-2">{{ $row['invoice_number'] ?? '' }}</td>
                            <td class="px-4 py-2">{{ $row['cashier_name'] ?? '' }}</td>
                            <td class="px-4 py-2">{{ ucfirst($row['payment_mode'] ?? '') }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">{{ $row['item_count'] ?? 0 }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($row['tax_total'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums font-medium">₹{{ number_format((float) ($row['grand_total'] ?? 0), 2) }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="7" class="px-4 py-6 text-center text-slate-500">No sales in this range.</td>
                        </tr>
                    @endforelse
                </tbody>
                @if (!empty($totals))
                    <tfoot>
                        <tr class="border-t border-slate-200 bg-slate-50 font-medium">
                            <td colspan="5" class="px-4 py-2 text-right">Totals</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($totals['tax_total'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($totals['grand_total'] ?? 0), 2) }}</td>
                        </tr>
                    </tfoot>
                @endif
            </table>
        </div>
    </div>
</x-app-layout>
