{{--
    Stock valuation report — phase-5-reports.md T-0506a. report.valuation
    permission (admin-only for the cost figure — cashier/pharmacist do not
    hold report.valuation under the default grid, brain/08 §2.1).

    Cave law 2: no cost/purchase_price column here. ReportService::stockValuationReport()
    excludes cost at the query layer for any session that lacks report.valuation
    — this view only ever renders MRP-basis valuation, never at-cost, so it is
    safe even if reached by a session with a narrower grant than expected.
--}}
<x-app-layout>
    <x-slot name="title">Stock Valuation</x-slot>

    <div class="space-y-4">
        <div class="flex items-center justify-between">
            <h1 class="text-xl font-semibold text-slate-900">Stock Valuation</h1>
            <a
                href="{{ route('reports.stock-valuation', array_merge(request()->query(), ['format' => 'csv'])) }}"
                class="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
                Export CSV
            </a>
        </div>

        <form method="GET" action="{{ route('reports.stock-valuation') }}" class="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <div>
                <label for="category_id" class="block text-xs font-medium text-slate-600">Category</label>
                <select id="category_id" name="category_id" class="mt-1 rounded border-slate-300 text-sm">
                    <option value="">All</option>
                    @foreach (($categories ?? []) as $category)
                        <option value="{{ $category->id }}" @selected(request('category_id') == $category->id)>{{ $category->name }}</option>
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
                        <th scope="col" class="px-4 py-2">Expiry</th>
                        <th scope="col" class="px-4 py-2 text-right">Qty Available</th>
                        <th scope="col" class="px-4 py-2 text-right">Valuation at MRP</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse (($rows ?? []) as $row)
                        <tr class="border-t border-slate-100">
                            <td class="px-4 py-2">{{ $row['medicine_name'] ?? '' }}</td>
                            <td class="px-4 py-2">{{ $row['batch_number'] ?? '' }}</td>
                            <td class="px-4 py-2">{{ $row['expiry_date'] ?? '' }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">{{ $row['quantity_available'] ?? 0 }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($row['valuation_at_mrp'] ?? 0), 2) }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="5" class="px-4 py-6 text-center text-slate-500">No stock on hand.</td>
                        </tr>
                    @endforelse
                </tbody>
                @if (!empty($totals))
                    <tfoot>
                        <tr class="border-t border-slate-200 bg-slate-50 font-medium">
                            <td colspan="4" class="px-4 py-2 text-right">Total valuation at MRP</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($totals['valuation_at_mrp'] ?? 0), 2) }}</td>
                        </tr>
                    </tfoot>
                @endif
            </table>
        </div>

    </div>
</x-app-layout>
