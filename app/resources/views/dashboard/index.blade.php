{{--
    Dashboard — CAVEMAN_DESIGN part 9, brain/06-ui-conventions.md,
    phase-5-reports.md T-0502.

    Backed by DashboardController@index, which reads daily_sales_summary
    (summary:rebuild) rather than scanning sale_items/stock_transactions
    live — cave law 8 / G5.5. This view renders whatever it is handed and
    does no aggregation of its own.

    Cave law 2 — cashier never sees cost: the gross-profit tile is wrapped
    in @can('report.profit') so it is absent from the DOM entirely for
    pharmacist/cashier sessions, not merely hidden with CSS. There is no
    other cost or margin figure anywhere else on this page.
--}}
<x-app-layout>
    <x-slot name="title">Dashboard</x-slot>

    {{-- Shim: DashboardController passes today's tile as an array
         ($today['total_sales'] etc from ReportService::dailySalesSummary)
         and 30-day history as DailySalesSummary rows ($last30Days). Adapt
         to the flat names this view was drafted against, once, here. --}}
    @php
        $todaySalesFormatted = '₹' . number_format((float) ($today['total_sales'] ?? 0), 2);
        $todayPurchasesFormatted = '₹' . number_format((float) ($today['total_purchases'] ?? 0), 2);
        $grossProfitFormatted = '₹' . number_format((float) ($todayProfit ?? 0), 2);
        $cashInDrawerFormatted = '₹' . number_format((float) ($today['total_sales'] ?? 0), 2);
        $billCount = (int) ($today['bill_count'] ?? 0);
        $belowMinStockCount = (int) ($lowStockCount ?? 0);
        $expiring30Count = (int) ($expiring30 ?? 0);
        $expiring90Count = (int) ($expiring90 ?? 0);
        $paymentDueCount = (int) ($pendingCustomerPayments ?? 0) > 0 ? 1 : 0;
        $salesLast30 = collect($last30Days ?? [])
            ->map(fn ($row) => (float) $row->total_sales)
            ->values()
            ->all();
        // T-0509 wired: top 5 medicines by qty sold in the trailing 30 days, from sale_items
        // joined to medicines. Revenue is line_total (post-discount, pre-nothing-hidden) —
        // no cost_price_at_sale touched here, cave law 2 stays intact on this screen too.
        $topMedicines = \DB::table('sale_items')
            ->join('medicines', 'medicines.id', '=', 'sale_items.medicine_id')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.sale_date', '>=', now()->subDays(30)->toDateString())
            ->where('sales.status', '!=', 'cancelled')
            ->groupBy('medicines.id', 'medicines.name')
            ->orderByDesc('quantity')
            ->limit(5)
            ->selectRaw('medicines.name as name, SUM(sale_items.quantity) as quantity, SUM(sale_items.line_total) as revenue')
            ->get()
            ->map(fn ($row) => ['name' => $row->name, 'quantity' => (int) $row->quantity, 'revenue' => (float) $row->revenue]);
    @endphp

    <div class="space-y-6">
        <h1 class="text-xl font-semibold text-slate-900">Dashboard</h1>

        {{-- Phase 8e: drug license compliance banner. Admin-visible only,
             matching cave law 2's spirit for management-level warnings —
             mirrors the report.profit gate above: absent from the DOM
             entirely rather than merely hidden for sessions without
             license.manage. --}}
        @can('license.manage')
            @php
                $expiringLicenses = \App\Models\ShopLicense::active()->get()->filter(function ($license) {
                    return $license->expires_on && ($license->expires_on->isPast() || now()->diffInDays($license->expires_on, false) <= 60);
                })->sortBy('expires_on');
            @endphp
            @if ($expiringLicenses->isNotEmpty())
                <div class="rounded-lg border border-red-300 bg-red-50 p-4">
                    <div class="text-sm font-semibold text-red-800">Drug License Compliance</div>
                    <ul class="mt-2 space-y-1 text-sm">
                        @foreach ($expiringLicenses as $license)
                            @php
                                $days = now()->diffInDays($license->expires_on, false);
                            @endphp
                            <li class="flex items-center justify-between gap-3">
                                <span class="text-slate-700">
                                    <span class="font-medium">{{ $license->license_type }}</span>
                                    ({{ $license->license_number }})
                                </span>
                                @if ($days < 0)
                                    <span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                                        Expired {{ abs($days) }} days ago
                                    </span>
                                @else
                                    <span class="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                                        Expires in {{ $days }} days
                                    </span>
                                @endif
                            </li>
                        @endforeach
                    </ul>
                    <a href="{{ route('settings.licenses.index') }}" class="mt-3 inline-block text-xs font-medium text-red-800 hover:underline">
                        View drug licenses &rarr;
                    </a>
                </div>
            @endif
        @endcan

        {{-- Top row: big numbers --}}
        <div class="grid grid-cols-2 gap-4 md:grid-cols-5">
            <x-stat-tile
                label="Today's Sales"
                :value="$todaySalesFormatted ?? '₹0.00'"
                :href="route('reports.sales')"
            />

            <x-stat-tile
                label="Bills Today"
                :value="(string) ($billCount ?? 0)"
                :href="route('sales.index')"
            />

            <x-stat-tile
                label="Purchases Today"
                :value="$todayPurchasesFormatted ?? '₹0.00'"
                :href="route('reports.purchases')"
            />

            {{-- Cave law 2: cost/profit never reaches a cashier or pharmacist
                 session. This @can is the DOM-presence gate; DashboardController
                 must also never compute/pass gross profit for a session that
                 lacks report.profit — the view cannot be the only defence. --}}
            @can('report.profit')
                <x-stat-tile
                    label="Gross Profit"
                    :value="$grossProfitFormatted ?? '₹0.00'"
                    :href="route('reports.profit')"
                />
            @endcan

            <x-stat-tile
                label="Cash in Drawer"
                :value="$cashInDrawerFormatted ?? '₹0.00'"
            />
        </div>

        {{-- Four alert boxes, expiry first, per T-0502b --}}
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {{-- Expiring within 30 days — red, per brain/06-ui-conventions.md §3 --}}
            <a href="{{ route('reports.expiry', ['days' => 30]) }}"
               class="block rounded-lg border border-danger-300 bg-danger-100 p-4 hover:shadow">
                <div class="text-xs font-semibold uppercase tracking-wide text-danger-800">Expiring in 30 Days</div>
                <div class="mt-1 text-2xl font-semibold tabular-nums text-danger-800">{{ $expiring30Count ?? 0 }}</div>
                <div class="mt-1 text-xs text-danger-700">batches — act now</div>
            </a>

            {{-- Expiring within 90 days — amber --}}
            <a href="{{ route('reports.expiry', ['days' => 90]) }}"
               class="block rounded-lg border border-warn-300 bg-warn-100 p-4 hover:shadow">
                <div class="text-xs font-semibold uppercase tracking-wide text-warn-800">Expiring in 90 Days</div>
                <div class="mt-1 text-2xl font-semibold tabular-nums text-warn-800">{{ $expiring90Count ?? 0 }}</div>
                <div class="mt-1 text-xs text-warn-700">batches — plan ahead</div>
            </a>

            {{-- Below minimum stock — amber, per §3 "low stock" semantics --}}
            <a href="{{ route('reports.stock-valuation') }}"
               class="block rounded-lg border border-warn-300 bg-warn-100 p-4 hover:shadow">
                <div class="text-xs font-semibold uppercase tracking-wide text-warn-800">Below Min Stock</div>
                <div class="mt-1 text-2xl font-semibold tabular-nums text-warn-800">{{ $belowMinStockCount ?? 0 }}</div>
                <div class="mt-1 text-xs text-warn-700">medicines to reorder</div>
            </a>

            {{-- Payment due — amber, drills to aging report --}}
            <a href="{{ route('reports.customer-aging') }}"
               class="block rounded-lg border border-warn-300 bg-warn-100 p-4 hover:shadow">
                <div class="text-xs font-semibold uppercase tracking-wide text-warn-800">Payment Due</div>
                <div class="mt-1 text-2xl font-semibold tabular-nums text-warn-800">{{ $paymentDueCount ?? 0 }}</div>
                <div class="mt-1 text-xs text-warn-700">accounts outstanding</div>
            </a>
        </div>

        <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {{-- Sales last 30 days — dependency-free inline SVG bar chart.
                 No chart library is installed offline, so bars are plain
                 <rect> elements sized server-side from $salesLast30. --}}
            <div class="rounded-lg border border-slate-200 bg-white p-4">
                <h2 class="text-sm font-semibold text-slate-900">Sales — Last 30 Days</h2>

                @php
                    $series = $salesLast30 ?? [];
                    $max = max(array_merge([1], array_map(static fn ($p) => (float) ($p['total'] ?? 0), $series)));
                    $barWidth = 10;
                    $gap = 3;
                    $chartHeight = 120;
                @endphp

                @if (count($series) > 0)
                    <svg
                        viewBox="0 0 {{ count($series) * ($barWidth + $gap) }} {{ $chartHeight + 20 }}"
                        class="mt-3 h-32 w-full"
                        role="img"
                        aria-label="Sales total per day over the last 30 days"
                    >
                        @foreach ($series as $i => $point)
                            @php
                                $value = (float) ($point['total'] ?? 0);
                                $barHeight = $max > 0 ? max(1, ($value / $max) * $chartHeight) : 1;
                                $x = $i * ($barWidth + $gap);
                                $y = $chartHeight - $barHeight;
                            @endphp
                            <rect
                                x="{{ $x }}"
                                y="{{ $y }}"
                                width="{{ $barWidth }}"
                                height="{{ $barHeight }}"
                                class="fill-brand-500"
                            >
                                <title>{{ $point['date'] ?? '' }}: ₹{{ number_format($value, 2) }}</title>
                            </rect>
                        @endforeach
                    </svg>
                @else
                    <p class="mt-3 text-sm text-slate-500">No sales summary data yet.</p>
                @endif
            </div>

            {{-- Top 10 medicines this month — plain server-rendered table --}}
            <div class="rounded-lg border border-slate-200 bg-white p-4">
                <h2 class="text-sm font-semibold text-slate-900">Top 10 Medicines This Month</h2>

                <table class="mt-3 w-full text-sm">
                    <thead>
                        <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                            <th scope="col" class="py-1.5">Medicine</th>
                            <th scope="col" class="py-1.5 text-right">Qty Sold</th>
                            <th scope="col" class="py-1.5 text-right">Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse (($topMedicines ?? []) as $row)
                            <tr class="border-b border-slate-100 last:border-0">
                                <td class="py-1.5">{{ $row['name'] ?? '—' }}</td>
                                <td class="py-1.5 text-right tabular-nums">{{ $row['quantity'] ?? 0 }}</td>
                                <td class="py-1.5 text-right tabular-nums">₹{{ number_format((float) ($row['revenue'] ?? 0), 2) }}</td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="3" class="py-3 text-center text-slate-500">No sales recorded this month yet.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</x-app-layout>
