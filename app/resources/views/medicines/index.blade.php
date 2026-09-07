{{--
    medicines.index — brain/06-ui-conventions.md: admin shell, x-data-table,
    ℞ badge red per colour semantics, no cost field ever rendered here
    (cave law 2 — MedicinePolicy/controller already excludes cost columns
    at the query layer; this view has nothing to accidentally leak).
--}}
<x-app-layout>
    <x-slot name="header">
        <x-page-header :title="'Medicines'" :breadcrumbs="[['label' => 'Medicines']]">
            <x-slot name="action">
                <div class="flex gap-2">
                    <a href="{{ route('medicines.import.create') }}"
                       class="inline-flex items-center px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50">
                        Import CSV
                    </a>
                    @can('medicine.create')
                        <a href="{{ route('medicines.create') }}"
                           class="inline-flex items-center px-4 py-2 bg-brand-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-brand-700">
                            Add medicine
                        </a>
                    @endcan
                </div>
            </x-slot>
        </x-page-header>
    </x-slot>

    <div
        x-data="{
            q: '',
            results: [],
            open: false,
            loading: false,
            debounceTimer: null,
            controller: null,
            search() {
                clearTimeout(this.debounceTimer);
                // 120ms debounce per brain/06-ui-conventions.md section 8.
                this.debounceTimer = setTimeout(() => this.runSearch(), 120);
            },
            async runSearch() {
                if (this.q.length < 3) { this.results = []; this.open = false; return; }
                if (this.controller) this.controller.abort();
                this.controller = new AbortController();
                this.loading = true;
                try {
                    const res = await fetch(`/api/medicines/search?q=${encodeURIComponent(this.q)}`, {
                        signal: this.controller.signal,
                        headers: { 'Accept': 'application/json' },
                    });
                    const json = await res.json();
                    this.results = json.data ?? [];
                    this.open = true;
                } catch (e) {
                    if (e.name !== 'AbortError') { this.results = []; }
                } finally {
                    this.loading = false;
                }
            },
        }"
        class="space-y-4"
    >
        <div class="relative max-w-md">
            <label for="medicine-search" class="sr-only">Search medicines</label>
            <input
                id="medicine-search"
                type="text"
                autofocus
                x-model="q"
                @input="search()"
                @keydown.escape="open = false; q = ''"
                placeholder="Search by name, generic name, or barcode..."
                class="w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 text-sm"
                autocomplete="off"
            >
            <div x-show="open && results.length > 0" x-cloak
                 class="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-80 overflow-y-auto">
                <template x-for="(r, i) in results" :key="r.id">
                    <a :href="`/medicines/${r.id}`"
                       class="block px-4 py-2 text-sm hover:bg-slate-50"
                       :class="i === 0 ? 'bg-slate-50' : ''">
                        <span x-text="r.name"></span>
                        <span class="text-slate-400" x-text="r.generic_name ?? ''"></span>
                    </a>
                </template>
            </div>
        </div>

        <x-data-table :columns="['Name', 'Generic', 'Category', 'Manufacturer', 'GST', 'Min stock', 'Rx', 'Status', '']">
            <x-slot name="rows">
                @forelse ($medicines as $medicine)
                    <tr class="hover:bg-slate-50">
                        <td class="px-4 py-2 font-medium text-slate-900">
                            @can('medicine.update')
                                <a href="{{ route('medicines.edit', $medicine) }}" class="hover:underline">
                                    {{ $medicine->name }}
                                </a>
                            @else
                                {{ $medicine->name }}
                            @endcan
                        </td>
                        <td class="px-4 py-2 text-slate-500">{{ $medicine->generic_name }}</td>
                        <td class="px-4 py-2 text-slate-500">{{ $medicine->category?->name }}</td>
                        <td class="px-4 py-2 text-slate-500">{{ $medicine->manufacturer?->name }}</td>
                        <td class="px-4 py-2 tabular-nums">{{ $medicine->gst_rate }}%</td>
                        <td class="px-4 py-2 tabular-nums">{{ $medicine->min_stock_level }}</td>
                        <td class="px-4 py-2">
                            @if ($medicine->is_prescription_required)
                                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
                                    ℞
                                </span>
                            @endif
                        </td>
                        <td class="px-4 py-2">
                            @if ($medicine->is_active)
                                <span class="text-ok-700">Active</span>
                            @else
                                <span class="text-slate-400">Inactive</span>
                            @endif
                        </td>
                        <td class="px-4 py-2 text-right">
                            @can('medicine.update')
                                <a href="{{ route('medicines.edit', $medicine) }}" class="text-sm text-brand-600 hover:underline">Edit</a>
                            @endcan
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="9" class="px-4 py-8 text-center text-slate-400">
                            No medicines yet. <a href="{{ route('medicines.create') }}" class="text-brand-600 hover:underline">Add the first one</a>.
                        </td>
                    </tr>
                @endforelse
            </x-slot>
            <x-slot name="pagination">
                {{ $medicines->links() }}
            </x-slot>
        </x-data-table>
    </div>
</x-app-layout>
