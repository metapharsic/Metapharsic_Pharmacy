{{--
    Profit report — phase-5-reports.md T-0504, T-0504b. report.profit permission,
    one of the four keys HARD-DENIED to non-admins regardless of the runtime
    permission grid (brain/08-security-and-audit.md §2, cave law 2).

    This is the one view in the whole reports/ directory allowed to render a
    cost or margin column, and only because ReportController@profit gates the
    route with Gate::authorize('report.profit') before this view is ever
    reached. Defensive belt-and-braces: if this view is somehow rendered for
    a non-admin session (a routing bug, a future refactor that drops the
    gate), fail loudly rather than silently leak cost.
--}}
@php
    /** @var \App\Models\User $__profitViewer */
    $__profitViewer = auth()->user();

    if (! $__profitViewer || ! $__profitViewer->can('report.profit')) {
        // This view must never render outside an admin session. Reaching
        // here means the controller's Gate::authorize('report.profit') was
        // bypassed or removed — cave law 2 violation in progress. Abort
        // rather than render a single row of margin data.
        abort(403, 'Profit report is admin-only (cave law 2).');
    }
@endphp
<x-app-layout>
    <x-slot name="title">Profit Report</x-slot>

    <div class="space-y-4">
        <div class="flex items-center justify-between">
            <h1 class="text-xl font-semibold text-slate-900">Profit Report</h1>
            <a
                href="{{ route('reports.profit', array_merge(request()->query(), ['format' => 'csv'])) }}"
                class="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
                Export CSV
            </a>
        </div>

        <form method="GET" action="{{ route('reports.profit') }}" class="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <div>
                <label for="from" class="block text-xs font-medium text-slate-600">From</label>
                <input type="date" id="from" name="from" value="{{ request('from') }}" class="mt-1 rounded border-slate-300 text-sm">
            </div>
            <div>
                <label for="to" class="block text-xs font-medium text-slate-600">To</label>
                <input type="date" id="to" name="to" value="{{ request('to') }}" class="mt-1 rounded border-slate-300 text-sm">
            </div>
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

        {{-- cost_price_at_sale-derived figures only, per cave law 6 —
             ReportService::profitReport() must never join back to a batch's
             current purchase_price. This view just renders what it is given. --}}
        <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table class="w-full text-sm">
                <thead class="bg-slate-50">
                    <tr class="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th scope="col" class="px-4 py-2">Date</th>
                        <th scope="col" class="px-4 py-2">Medicine</th>
                        <th scope="col" class="px-4 py-2">Category</th>
                        <th scope="col" class="px-4 py-2 text-right">Qty Sold</th>
                        <th scope="col" class="px-4 py-2 text-right">Revenue</th>
                        <th scope="col" class="px-4 py-2 text-right">Cost (Snapshot)</th>
                        <th scope="col" class="px-4 py-2 text-right">Profit</th>
                        <th scope="col" class="px-4 py-2 text-right">Margin %</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse (($rows ?? []) as $row)
                        <tr class="border-t border-slate-100">
                            <td class="px-4 py-2">{{ $row['date'] ?? '' }}</td>
                            <td class="px-4 py-2">{{ $row['medicine_name'] ?? '' }}</td>
                            <td class="px-4 py-2">{{ $row['category_name'] ?? '' }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">{{ $row['quantity'] ?? 0 }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($row['revenue'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($row['cost'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums font-medium">₹{{ number_format((float) ($row['profit'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">{{ number_format((float) ($row['margin_pct'] ?? 0), 1) }}%</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="8" class="px-4 py-6 text-center text-slate-500">No sales in this range.</td>
                        </tr>
                    @endforelse
                </tbody>
                @if (!empty($totals))
                    <tfoot>
                        <tr class="border-t border-slate-200 bg-slate-50 font-medium">
                            <td colspan="4" class="px-4 py-2 text-right">Totals</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($totals['revenue'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($totals['cost'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($totals['profit'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">{{ number_format((float) ($totals['margin_pct'] ?? 0), 1) }}%</td>
                        </tr>
                    </tfoot>
                @endif
            </table>
        </div>
    </div>
</x-app-layout>
