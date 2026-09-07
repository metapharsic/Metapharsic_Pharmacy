{{--
    GST report — phase-5-reports.md T-0505. report.gst permission.
    Grouped by rate slab (0/5/12/18) with CGST/SGST halves, plus an HSN
    summary section per T-0505c. G5.1 requires this to hand-reconcile to
    the rupee against a real GSTR-1 — the arithmetic here is display only,
    ReportService::gstReport() owns the actual totals.

    Cave law 2: this is tax on the sale side, not cost — no purchase_price
    or margin column belongs here either.
--}}
<x-app-layout>
    <x-slot name="title">GST Report</x-slot>

    <div class="space-y-4">
        <div class="flex items-center justify-between">
            <h1 class="text-xl font-semibold text-slate-900">GST Report</h1>
            <a
                href="{{ route('reports.gst', array_merge(request()->query(), ['format' => 'csv'])) }}"
                class="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
                Export CSV
            </a>
        </div>

        <form method="GET" action="{{ route('reports.gst') }}" class="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <div>
                <label for="from" class="block text-xs font-medium text-slate-600">From</label>
                <input type="date" id="from" name="from" value="{{ request('from') }}" class="mt-1 rounded border-slate-300 text-sm">
            </div>
            <div>
                <label for="to" class="block text-xs font-medium text-slate-600">To</label>
                <input type="date" id="to" name="to" value="{{ request('to') }}" class="mt-1 rounded border-slate-300 text-sm">
            </div>
            <button type="submit" class="rounded bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                Filter
            </button>
        </form>

        {{-- Rate-slab split: output tax (sales) --}}
        <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <div class="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900">Output Tax (Sales) — By Rate Slab</div>
            <table class="w-full text-sm">
                <thead class="bg-slate-50">
                    <tr class="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th scope="col" class="px-4 py-2">GST Rate</th>
                        <th scope="col" class="px-4 py-2 text-right">Taxable Value</th>
                        <th scope="col" class="px-4 py-2 text-right">CGST</th>
                        <th scope="col" class="px-4 py-2 text-right">SGST</th>
                        <th scope="col" class="px-4 py-2 text-right">Total Tax</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse (($outputSlabs ?? []) as $slab)
                        <tr class="border-t border-slate-100">
                            <td class="px-4 py-2">{{ $slab['rate'] ?? 0 }}%</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($slab['taxable_value'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($slab['cgst'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($slab['sgst'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums font-medium">₹{{ number_format((float) ($slab['total_tax'] ?? 0), 2) }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">No sales in this range.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        {{-- Rate-slab split: input tax (purchases) --}}
        <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <div class="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900">Input Tax (Purchases) — By Rate Slab</div>
            <table class="w-full text-sm">
                <thead class="bg-slate-50">
                    <tr class="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th scope="col" class="px-4 py-2">GST Rate</th>
                        <th scope="col" class="px-4 py-2 text-right">Taxable Value</th>
                        <th scope="col" class="px-4 py-2 text-right">CGST</th>
                        <th scope="col" class="px-4 py-2 text-right">SGST</th>
                        <th scope="col" class="px-4 py-2 text-right">Total Tax</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse (($inputSlabs ?? []) as $slab)
                        <tr class="border-t border-slate-100">
                            <td class="px-4 py-2">{{ $slab['rate'] ?? 0 }}%</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($slab['taxable_value'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($slab['cgst'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($slab['sgst'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums font-medium">₹{{ number_format((float) ($slab['total_tax'] ?? 0), 2) }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">No purchases in this range.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        {{-- HSN summary — T-0505c: quantity and taxable value grouped by hsn_code --}}
        <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <div class="flex items-center justify-between border-b border-slate-200 px-4 py-2">
                <div class="text-sm font-semibold text-slate-900">HSN Summary</div>
            </div>
            <table class="w-full text-sm">
                <thead class="bg-slate-50">
                    <tr class="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th scope="col" class="px-4 py-2">HSN Code</th>
                        <th scope="col" class="px-4 py-2 text-right">Quantity</th>
                        <th scope="col" class="px-4 py-2 text-right">Taxable Value</th>
                        <th scope="col" class="px-4 py-2 text-right">Total Tax</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse (($hsnSummary ?? []) as $row)
                        <tr class="border-t border-slate-100">
                            <td class="px-4 py-2">{{ $row['hsn_code'] ?? '' }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">{{ $row['quantity'] ?? 0 }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($row['taxable_value'] ?? 0), 2) }}</td>
                            <td class="px-4 py-2 text-right tabular-nums">₹{{ number_format((float) ($row['total_tax'] ?? 0), 2) }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="4" class="px-4 py-6 text-center text-slate-500">No HSN data in this range.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
</x-app-layout>
