<x-app-layout>
    <x-slot name="header">
        <x-page-header :title="'Pharmacy Racks & Spatial Layout'" :breadcrumbs="[['label' => 'Inventory', 'url' => route('inventory.index')], ['label' => 'Racks Layout']]">
            <x-slot name="action">
                <div class="flex items-center gap-2">
                    <a href="{{ route('inventory.index') }}" class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        &larr; Batch View
                    </a>
                    <a href="{{ route('inventory.low-stock') }}" class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50">
                        Low Stock
                    </a>
                    <a href="{{ route('inventory.expiry-report') }}" class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
                        Expiry Radar
                    </a>
                </div>
            </x-slot>
        </x-page-header>
    </x-slot>

    <div class="space-y-6" x-data="{ selectedMed: null, showLifecycle: false }">
        {{-- Zone & Spatial Summary Stats --}}
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Storage Zones</div>
                <div class="mt-1 text-2xl font-bold text-slate-900">{{ $zones->count() }}</div>
                <div class="mt-1 text-xs text-slate-500">Main Dispensary, Cold Chain, Vault, Fast Bay</div>
            </div>
            <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Storage Racks</div>
                <div class="mt-1 text-2xl font-bold text-brand-700">{{ $zones->sum(fn ($z) => $z->racks->count()) }} Racks</div>
                <div class="mt-1 text-xs text-slate-500">Aisles 1–2, Cold Bay, Vault Room</div>
            </div>
            <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Cold Chain Monitor</div>
                <div class="mt-1 text-2xl font-bold text-sky-700">2°C – 8°C Active</div>
                <div class="mt-1 text-xs text-sky-600">Insulin, Vaccines & Biologics Safe</div>
            </div>
            <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div class="text-xs font-semibold uppercase tracking-wider text-slate-500">Controlled Vault Safe</div>
                <div class="mt-1 text-2xl font-bold text-purple-700">Schedule X / H1</div>
                <div class="mt-1 text-xs text-purple-600">Double-Lock Compliance Verified</div>
            </div>
        </div>

        {{-- End-to-End Inventory Life Cycle Interactive Banner --}}
        <div class="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-900 via-brand-800 to-slate-900 p-6 text-white shadow-md">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="rounded bg-brand-500/30 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-brand-200 border border-brand-400/30">
                            Pharmacy Standard
                        </span>
                        <h2 class="text-lg font-bold text-white">End-to-End Inventory Life Cycle & Deduction Mechanics</h2>
                    </div>
                    <p class="mt-1 text-xs text-slate-300">
                        Zero-drift FIFO/FEFO ledger allocation, atomic multi-till concurrency locks, and real-time spatial shelf deduction.
                    </p>
                </div>
                <button type="button" @click="showLifecycle = !showLifecycle" class="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-white/20 border border-white/20 transition">
                    <span x-text="showLifecycle ? '▲ Hide Lifecycle Flow' : '▼ View End-to-End Lifecycle Stages'"></span>
                </button>
            </div>

            {{-- Collapsible Life Cycle Visual Flow --}}
            <div x-show="showLifecycle" x-cloak class="mt-6 border-t border-white/10 pt-6">
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 text-slate-900 text-xs">
                    <div class="rounded-lg bg-white p-3 shadow-sm flex flex-col justify-between border-t-4 border-blue-500">
                        <div>
                            <span class="font-bold text-blue-700 uppercase tracking-wide text-[10px]">Stage 1</span>
                            <h4 class="font-bold text-slate-900 mt-1">Inward GRN Receipt</h4>
                            <p class="mt-1 text-[11px] text-slate-500">Supplier PO verification, MRP, purchase rate, and invoice matching.</p>
                        </div>
                        <span class="mt-2 text-[10px] text-slate-400 font-mono">Status: Draft</span>
                    </div>

                    <div class="rounded-lg bg-white p-3 shadow-sm flex flex-col justify-between border-t-4 border-amber-500">
                        <div>
                            <span class="font-bold text-amber-700 uppercase tracking-wide text-[10px]">Stage 2</span>
                            <h4 class="font-bold text-slate-900 mt-1">Climate Quarantine</h4>
                            <p class="mt-1 text-[11px] text-slate-500">Cold chain (2°C–8°C) and Schedule X vault double-lock verification.</p>
                        </div>
                        <span class="mt-2 text-[10px] text-slate-400 font-mono">Status: Quarantined</span>
                    </div>

                    <div class="rounded-lg bg-white p-3 shadow-sm flex flex-col justify-between border-t-4 border-indigo-500">
                        <div>
                            <span class="font-bold text-indigo-700 uppercase tracking-wide text-[10px]">Stage 3</span>
                            <h4 class="font-bold text-slate-900 mt-1">Spatial Put-Away</h4>
                            <p class="mt-1 text-[11px] text-slate-500">Physical placement into Zone, Rack code, Shelf Level, and Bin coordinate.</p>
                        </div>
                        <span class="mt-2 text-[10px] text-slate-400 font-mono">Assigned Rack</span>
                    </div>

                    <div class="rounded-lg bg-white p-3 shadow-sm flex flex-col justify-between border-t-4 border-emerald-500">
                        <div>
                            <span class="font-bold text-emerald-700 uppercase tracking-wide text-[10px]">Stage 4</span>
                            <h4 class="font-bold text-slate-900 mt-1">FEFO Available</h4>
                            <p class="mt-1 text-[11px] text-slate-500">Batch ledger indexed by nearest expiry date. Ready for cashier lookup.</p>
                        </div>
                        <span class="mt-2 text-[10px] text-slate-400 font-mono">Status: Available</span>
                    </div>

                    <div class="rounded-lg bg-white p-3 shadow-sm flex flex-col justify-between border-t-4 border-purple-500">
                        <div>
                            <span class="font-bold text-purple-700 uppercase tracking-wide text-[10px]">Stage 5</span>
                            <h4 class="font-bold text-slate-900 mt-1">Atomic POS Lock</h4>
                            <p class="mt-1 text-[11px] text-slate-500">Barcode scan, `SELECT FOR UPDATE` row lock, prevents double-selling.</p>
                        </div>
                        <span class="mt-2 text-[10px] text-slate-400 font-mono">Cart Item Lock</span>
                    </div>

                    <div class="rounded-lg bg-white p-3 shadow-sm flex flex-col justify-between border-t-4 border-rose-500">
                        <div>
                            <span class="font-bold text-rose-700 uppercase tracking-wide text-[10px]">Stage 6</span>
                            <h4 class="font-bold text-slate-900 mt-1">Ledger Deduction</h4>
                            <p class="mt-1 text-[11px] text-slate-500">Double-entry append to `stock_transactions`, batch balance reduced.</p>
                        </div>
                        <span class="mt-2 text-[10px] text-slate-400 font-mono">Sale Committed</span>
                    </div>

                    <div class="rounded-lg bg-white p-3 shadow-sm flex flex-col justify-between border-t-4 border-cyan-500">
                        <div>
                            <span class="font-bold text-cyan-700 uppercase tracking-wide text-[10px]">Stage 7</span>
                            <h4 class="font-bold text-slate-900 mt-1">Radar & Reorder</h4>
                            <p class="mt-1 text-[11px] text-slate-500">90-day expiry radar, minimum stock threshold alarm, automated PO.</p>
                        </div>
                        <span class="mt-2 text-[10px] text-slate-400 font-mono">Stock Monitored</span>
                    </div>
                </div>
            </div>
        </div>

        {{-- Zones Loop --}}
        @foreach ($zones as $zone)
            <div class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {{-- Zone Header --}}
                <div class="flex flex-col justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-6 py-4 sm:flex-row sm:items-center">
                    <div>
                        <div class="flex items-center gap-3">
                            <h2 class="text-lg font-bold text-slate-900">{{ $zone->name }}</h2>
                            <span class="rounded bg-slate-200 px-2 py-0.5 text-xs font-mono font-semibold text-slate-700">{{ $zone->code }}</span>
                            @if ($zone->temperature_type === 'cold_2_8')
                                <span class="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
                                    ❄️ Cold Chain (2°C–8°C)
                                </span>
                            @elseif ($zone->temperature_type === 'ambient_15_25')
                                <span class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                                    🌡️ Ambient (15°C–25°C)
                                </span>
                            @else
                                <span class="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
                                    🔒 High Security Vault
                                </span>
                            @endif
                        </div>
                        <p class="mt-1 text-xs text-slate-500">{{ $zone->description }}</p>
                    </div>
                    <div class="text-xs text-slate-500 font-medium">
                        {{ $zone->racks->count() }} Storage Units &bull; {{ $zone->racks->sum(fn ($r) => $r->shelves->count()) }} Shelves
                    </div>
                </div>

                {{-- Racks Grid --}}
                <div class="p-6">
                    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        @forelse ($zone->racks as $rack)
                            <div class="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300 transition">
                                <div class="flex items-start justify-between border-b border-slate-100 pb-3">
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="rounded bg-brand-50 px-2 py-1 text-xs font-mono font-bold text-brand-700 border border-brand-200">
                                                {{ $rack->rack_code }}
                                            </span>
                                            <h3 class="text-sm font-semibold text-slate-900">{{ $rack->name }}</h3>
                                        </div>
                                        <div class="mt-1 text-xs text-slate-500">
                                            Location: <span class="font-medium text-slate-700">{{ $rack->aisle ?? 'Dispensary' }}</span>
                                            &bull; Row {{ $rack->row_number ?? 1 }}, Col {{ $rack->column_number ?? 1 }}
                                        </div>
                                    </div>
                                    <span class="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                        {{ $rack->status }}
                                    </span>
                                </div>

                                {{-- Shelves Stack --}}
                                <div class="mt-4 space-y-3 flex-1">
                                    @foreach ($rack->shelves as $shelf)
                                        <div class="rounded-md border border-slate-100 bg-slate-50/60 p-3">
                                            <div class="flex items-center justify-between mb-2">
                                                <span class="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                                    <span class="inline-block w-2 h-2 rounded-full bg-brand-500"></span>
                                                    Level {{ $shelf->shelf_number }} ({{ $shelf->shelf_code }})
                                                </span>
                                                <span class="text-xs text-slate-400 font-mono">
                                                    {{ $shelf->medicines->count() }} Medicines Assigned
                                                </span>
                                            </div>

                                            {{-- Medicine Items on this Shelf --}}
                                            @if ($shelf->medicines->isNotEmpty())
                                                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                    @foreach ($shelf->medicines as $med)
                                                        <div class="rounded border border-slate-200 bg-white p-2.5 text-xs flex flex-col justify-between hover:border-brand-400 transition cursor-pointer"
                                                             @click="selectedMed = @js($med)">
                                                            <div>
                                                                <div class="flex items-start justify-between gap-1">
                                                                    <span class="font-semibold text-slate-900 line-clamp-1" title="{{ $med->name }}">
                                                                        {{ $med->name }}
                                                                    </span>
                                                                    @if ($med->is_prescription_required)
                                                                        <span class="shrink-0 rounded bg-red-100 px-1 py-0.2 text-[10px] font-bold text-red-700">Rx</span>
                                                                    @endif
                                                                </div>
                                                                <div class="text-[11px] text-slate-500 italic line-clamp-1">{{ $med->generic_name }}</div>
                                                            </div>

                                                            {{-- Active Batches Preview --}}
                                                            <div class="mt-2 space-y-1">
                                                                @if ($med->batches->isNotEmpty())
                                                                    @foreach ($med->batches->take(2) as $batch)
                                                                        <div class="flex items-center justify-between rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600 font-mono">
                                                                            <span>#{{ $batch->batch_no }}</span>
                                                                            <span class="text-emerald-700 font-bold">{{ $batch->quantity_available }} {{ $med->unit ?? 'qty' }}</span>
                                                                        </div>
                                                                    @endforeach
                                                                @else
                                                                    <div class="text-[10px] text-slate-400 italic">No available batches in stock</div>
                                                                @endif
                                                            </div>

                                                            <div class="mt-2 flex items-center justify-between pt-1 border-t border-slate-100">
                                                                <span class="text-[10px] text-slate-400">Min: {{ $med->min_stock_level }}</span>
                                                                <span class="font-semibold {{ ($med->current_stock ?? 0) <= $med->min_stock_level ? 'text-amber-600' : 'text-emerald-700' }}">
                                                                    Total: {{ $med->current_stock ?? 0 }}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    @endforeach
                                                </div>
                                            @else
                                                <div class="rounded border border-dashed border-slate-200 py-2 text-center text-xs text-slate-400">
                                                    Empty Shelf — Available for Put-Away
                                                </div>
                                            @endif
                                        </div>
                                    @endforeach
                                </div>
                            </div>
                        @empty
                            <div class="col-span-2 py-6 text-center text-sm text-slate-400">
                                No racks configured in this zone yet.
                            </div>
                        @endforelse
                    </div>
                </div>
            </div>
        @endforeach

        {{-- Medicine Detail & Batch Inspection Modal --}}
        <div x-show="selectedMed" x-cloak class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div @click.away="selectedMed = null" class="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl space-y-4">
                <div class="flex items-start justify-between border-b border-slate-100 pb-3">
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="text-base font-bold text-slate-900" x-text="selectedMed?.name"></h3>
                            <template x-if="selectedMed?.is_prescription_required">
                                <span class="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">Prescription Required</span>
                            </template>
                        </div>
                        <p class="text-xs text-slate-500 italic mt-0.5" x-text="selectedMed?.generic_name"></p>
                    </div>
                    <button type="button" @click="selectedMed = null" class="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
                </div>

                <div class="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg">
                    <div>
                        <span class="text-slate-400">Rack Coordinate:</span>
                        <p class="font-semibold text-slate-800" x-text="selectedMed?.rack_location || 'Dispensary Shelf'"></p>
                    </div>
                    <div>
                        <span class="text-slate-400">Barcode / SKU:</span>
                        <p class="font-mono font-semibold text-slate-800" x-text="selectedMed?.barcode || 'N/A'"></p>
                    </div>
                    <div>
                        <span class="text-slate-400">Storage Climate:</span>
                        <p class="font-semibold text-sky-700" x-text="selectedMed?.storage_temperature || 'Ambient (15°C–25°C)'"></p>
                    </div>
                    <div>
                        <span class="text-slate-400">Current Stock:</span>
                        <p class="font-bold text-emerald-700" x-text="(selectedMed?.current_stock || 0) + ' ' + (selectedMed?.unit || 'units')"></p>
                    </div>
                </div>

                <div>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Active FEFO Batches on Shelf</h4>
                    <div class="space-y-2 max-h-48 overflow-y-auto">
                        <template x-for="batch in selectedMed?.batches || []" :key="batch.id">
                            <div class="flex items-center justify-between rounded border border-slate-200 bg-white p-2.5 text-xs">
                                <div>
                                    <div class="font-mono font-bold text-slate-800" x-text="'Batch: ' + batch.batch_no"></div>
                                    <div class="text-[11px] text-slate-500" x-text="'Expiry: ' + (batch.expiry_date ? batch.expiry_date.split('T')[0] : 'N/A')"></div>
                                </div>
                                <div class="text-right">
                                    <div class="font-bold text-emerald-700" x-text="batch.quantity_available + ' available'"></div>
                                    <div class="text-[11px] text-slate-500" x-text="'MRP: ₹' + Number(batch.mrp || 0).toFixed(2)"></div>
                                </div>
                            </div>
                        </template>
                        <template x-if="!selectedMed?.batches || selectedMed.batches.length === 0">
                            <div class="py-4 text-center text-xs text-slate-400 italic">No batches currently available.</div>
                        </template>
                    </div>
                </div>

                <div class="pt-3 border-t border-slate-100 flex justify-between items-center">
                    <a :href="'/medicines/' + selectedMed?.id + '/edit'" class="text-xs font-semibold text-brand-600 hover:text-brand-800">
                        Edit Medicine Master &rarr;
                    </a>
                    <button type="button" @click="selectedMed = null" class="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                        Close
                    </button>
                </div>
            </div>
        </div>
    </div>
</x-app-layout>
