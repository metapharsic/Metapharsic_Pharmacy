{{--
    Fast/slow mover report — phase-5-reports.md T-0506c. report.movers permission.
    Backed by the weekly analytics:movers refresh, not a live scan.

    Cave law 2: no cost/margin column — movement is measured by quantity and
    sale frequency, not by profitability.
--}}
<x-app-layout>
    <x-slot name="title">Fast / Slow Movers</x-slot>

    <div class="space-y-4">
        <div class="flex items-center justify-between">
            <h1 class="text-xl font-semibold text-slate-900">Fast / Slow Movers</h1>
            <a
                href="{{ route('reports.movers', array_merge(request()->query(), ['format' => 'csv'])) }}"
                class="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
                Export CSV
            </a>
        </div>

        <form method="GET" action="{{ route('reports.movers') }}" class="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
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

        <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <div class="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900">Fast Movers</div>
                <table class="w-full text-sm">
                    <thead class="bg-slate-50">
                        <tr class="text-left text-xs uppercase tracking-wide text-slate-500">
                            <th scope="col" class="px-4 py-2">Medicine</th>
                            <th scope="col" class="px-4 py-2 text-right">Units / Week</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse (($fastMovers ?? []) as $row)
                            <tr class="border-t border-slate-100">
                                <td class="px-4 py-2">{{ $row['medicine_name'] ?? '' }}</td>
                                <td class="px-4 py-2 text-right tabular-nums">{{ $row['units_per_week'] ?? 0 }}</td>
                            </tr>
                        @empty
                            <tr><td colspan="2" class="px-4 py-6 text-center text-slate-500">No data yet.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </div>

            <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <div class="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900">Slow Movers</div>
                <table class="w-full text-sm">
                    <thead class="bg-slate-50">
                        <tr class="text-left text-xs uppercase tracking-wide text-slate-500">
                            <th scope="col" class="px-4 py-2">Medicine</th>
                            <th scope="col" class="px-4 py-2 text-right">Units / Week</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse (($slowMovers ?? []) as $row)
                            <tr class="border-t border-slate-100">
                                <td class="px-4 py-2">{{ $row['medicine_name'] ?? '' }}</td>
                                <td class="px-4 py-2 text-right tabular-nums">{{ $row['units_per_week'] ?? 0 }}</td>
                            </tr>
                        @empty
                            <tr><td colspan="2" class="px-4 py-6 text-center text-slate-500">No data yet.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</x-app-layout>
