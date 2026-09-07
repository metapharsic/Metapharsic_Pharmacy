{{--
    Purchase report — phase-5-reports.md T-0503b. report.purchase permission.

    Cave law 2: this is a purchase-side report and does carry the purchase
    price the shop paid its supplier (that is the report's whole point), but
    it must never carry a per-unit selling margin or a join to cost_price_at_sale
    — that belongs only to reports/profit.blade.php, admin-gated. A cashier
    does not hold report.purchase under the default grid (brain/08 §2.1), so
    this view is pharmacist/admin territory, not counter-facing.
--}}
<x-app-layout>
    <x-slot name="title">Purchase Report</x-slot>

    <div class="space-y-4">
        <div class="flex items-center justify-between">
            <h1 class="text-xl font-semibold text-slate-900">Purchase Report</h1>
            <a
                href="{{ route('reports.purchases', array_merge(request()->query(), ['format' => 'csv'])) }}"
                class="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
                Export CSV
            </a>
        </div>

        <form method="GET" action="{{ route('reports.purchases') }}" class="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <div>
                <label for="from" class="block text-xs font-medium text-slate-600">From</label>
                <input type="date" id="from" name="from" value="{{ request('from') }}" class="mt-1 rounded border-slate-300 text-sm">
            </div>
            <div>
                <label for="to" class="block text-xs font-medium text-slate-600">To</label>
                <input type="date" id="to" name="to" value="{{ request('to') }}" class="mt-1 rounded border-slate-300 text-sm">
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
                        <th scope="col" class="px-4 py-2">Date</th>
                        <th scope="col" class="px-4 py-2">Supplier</th>
                        <th scope="col" class="px-4 py-2">Invoice #</th>
                        <th scope="col" class="px-4 py-2 text-right">Items</th>
                        <th scope="col" class="px-4 py-2 text-right">Tax</th>
                        <th scope="col" class="px-4 py-2 text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse (($rows ?? []) as $row)
                        <tr class="border-t border-slate-100">
                            <td class="px-4 py-2">{{ $row['date'] ?? '' }}</td>
                            <td class="px-4 py-2">{{ $row['supplier_name'] ?? '' }}</td>
                            <td class="px-4 py-2">{{ $row['invoice_number'] ?? '' }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">{{ $row['item_count'] ?? 0 }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($row['tax_total'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums font-medium">₹{{ number_format((float) ($row['grand_total'] ?? 0), 2) }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="6" class="px-4 py-6 text-center text-slate-500">No purchases in this range.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
</x-app-layout>
