{{--
    Medicine search dropdown, split out of pos/index.blade.php because it is re-rendered
    independently on every keystroke and has its own keyboard-navigation styling concerns.
    Bound to Alpine state owned by the parent posCart() component (ui.searchResults,
    ui.searchHighlight) — no state of its own.
--}}
<div
    x-show="ui.searchOpen"
    x-cloak
    class="absolute z-40 mt-1 w-full max-h-80 overflow-y-auto rounded border border-slate-300 bg-white shadow-lg"
>
    <template x-for="(result, idx) in ui.searchResults" :key="result.id">
        <div
            @click="addMedicineToCart(result); ui.searchOpen = false"
            @mouseenter="ui.searchHighlight = idx"
            :class="idx === ui.searchHighlight ? 'bg-brand-50' : ''"
            class="flex cursor-pointer items-center justify-between px-3 py-2 border-b border-slate-100 last:border-0"
        >
            <div>
                <span class="font-medium" x-text="result.name"></span>
                <template x-if="result.is_prescription_required">
                    <span class="ml-1 rounded bg-red-100 px-1 text-xs font-bold text-red-800" title="Schedule H">℞</span>
                </template>
                <template x-if="result.rack_location">
                    <span class="ml-2 inline-flex items-center rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-xs font-mono font-medium text-indigo-700" x-text="result.rack_location"></span>
                </template>
                <span class="ml-2 text-xs text-slate-400" x-text="result.category || result.pack"></span>
            </div>
            <div class="flex items-center gap-2 text-sm">
                <template x-if="result.storage_temperature === 'cold_2_8'">
                    <span class="rounded bg-sky-100 text-sky-800 text-xs px-1 py-0.5 font-medium">❄️ 2°C–8°C</span>
                </template>
                <template x-if="result.stock_status === 'out'">
                    <span class="text-slate-400">Out of stock</span>
                </template>
                <template x-if="result.stock_status === 'low'">
                    <span class="rounded border border-amber-300 bg-amber-100 px-1 text-amber-800">Low</span>
                </template>
            </div>
        </div>
    </template>
    <template x-if="ui.searchResults.length === 0">
        <div class="px-3 py-2 text-sm text-slate-400">No matches</div>
    </template>
</div>
