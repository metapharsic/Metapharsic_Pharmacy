{{--
    Shared field partial for medicines/create.blade.php and edit.blade.php.
    One column, labels above fields, x-card sections per brain/06 section 6.
    Cave law: no quantity/expiry/price field exists here — those belong to
    medicine_batches (Phase 3). default_purchase_price is a costing
    reference, not a stock quantity, and is never shown on any
    cashier-reachable screen (MedicinePolicy handles that at read time).
--}}
@php
    $medicine = $medicine ?? null;
@endphp

<div class="max-w-2xl space-y-6">
    <div class="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h2 class="text-sm font-semibold text-slate-700">Identity</h2>

        <div>
            <label for="name" class="block text-sm font-medium text-slate-700">Name</label>
            <input type="text" id="name" name="name" autofocus
                   value="{{ old('name', $medicine?->name) }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('name') border-red-400 ring-1 ring-red-400 @enderror">
            @error('name')
                <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
            @enderror
        </div>

        <div>
            <label for="generic_name" class="block text-sm font-medium text-slate-700">Generic name</label>
            <input type="text" id="generic_name" name="generic_name"
                   value="{{ old('generic_name', $medicine?->generic_name) }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('generic_name') border-red-400 ring-1 ring-red-400 @enderror">
            @error('generic_name')
                <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
            @enderror
        </div>

        <div>
            <label for="barcode" class="block text-sm font-medium text-slate-700">Barcode</label>
            <input type="text" id="barcode" name="barcode"
                   value="{{ old('barcode', $medicine?->barcode) }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('barcode') border-red-400 ring-1 ring-red-400 @enderror">
            <p class="mt-1 text-xs text-slate-400">Optional. Unique when present.</p>
            @error('barcode')
                <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
            @enderror
        </div>

        <div>
            <label for="hsn_code" class="block text-sm font-medium text-slate-700">HSN code</label>
            <input type="text" id="hsn_code" name="hsn_code"
                   value="{{ old('hsn_code', $medicine?->hsn_code) }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('hsn_code') border-red-400 ring-1 ring-red-400 @enderror">
            @error('hsn_code')
                <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
            @enderror
        </div>
    </div>

    <div class="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h2 class="text-sm font-semibold text-slate-700">Classification</h2>

        {{-- "Searchable" select: plain <select> with Alpine-driven client
             filter of options. No business logic in Alpine — it only
             filters a list that already came from the server. --}}
        <div x-data="{ filter: '' }">
            <label for="category_id" class="block text-sm font-medium text-slate-700">Category</label>
            <input type="text" x-model="filter" placeholder="Filter categories..."
                   class="mt-1 mb-1 block w-full rounded-md border-slate-300 text-xs focus:border-brand-500 focus:ring-brand-500">
            <select id="category_id" name="category_id"
                    class="block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('category_id') border-red-400 ring-1 ring-red-400 @enderror">
                <option value="">— None —</option>
                @foreach ($categories as $category)
                    <option value="{{ $category->id }}"
                            x-show="filter === '' || '{{ Str::lower($category->name) }}'.includes(filter.toLowerCase())"
                            @selected(old('category_id', $medicine?->category_id) == $category->id)>
                        {{ $category->name }}
                    </option>
                @endforeach
            </select>
            @error('category_id')
                <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
            @enderror
        </div>

        <div x-data="{ filter: '' }">
            <label for="manufacturer_id" class="block text-sm font-medium text-slate-700">Manufacturer</label>
            <input type="text" x-model="filter" placeholder="Filter manufacturers..."
                   class="mt-1 mb-1 block w-full rounded-md border-slate-300 text-xs focus:border-brand-500 focus:ring-brand-500">
            <select id="manufacturer_id" name="manufacturer_id"
                    class="block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('manufacturer_id') border-red-400 ring-1 ring-red-400 @enderror">
                <option value="">— None —</option>
                @foreach ($manufacturers as $manufacturer)
                    <option value="{{ $manufacturer->id }}"
                            x-show="filter === '' || '{{ Str::lower($manufacturer->name) }}'.includes(filter.toLowerCase())"
                            @selected(old('manufacturer_id', $medicine?->manufacturer_id) == $manufacturer->id)>
                        {{ $manufacturer->name }}
                    </option>
                @endforeach
            </select>
            @error('manufacturer_id')
                <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
            @enderror
        </div>

        <div>
            <label for="unit" class="block text-sm font-medium text-slate-700">Unit / Dosage Form</label>
            <input type="text" id="unit" name="unit" list="unit-suggestions"
                   value="{{ old('unit', $medicine?->unit ?? 'strip') }}"
                   placeholder="e.g. strip, bottle, box, vial, ampoule"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('unit') border-red-400 ring-1 ring-red-400 @enderror">
            <datalist id="unit-suggestions">
                <option value="strip">
                <option value="bottle">
                <option value="box">
                <option value="vial">
                <option value="ampoule">
                <option value="tube">
                <option value="sachet">
            </datalist>
            @error('unit')
                <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
            @enderror
        </div>
    </div>

    {{-- Spatial Placement & Clinical Preservation --}}
    <div class="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
                <h2 class="text-sm font-semibold text-slate-900">Spatial Rack Placement & Climate</h2>
                <p class="text-xs text-slate-500">Assign storage zone, temperature control, and physical shelf coordinates.</p>
            </div>
            <span class="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                Spatial Logistics
            </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label for="storage_zone_id" class="block text-sm font-medium text-slate-700">Storage Zone</label>
                <select id="storage_zone_id" name="storage_zone_id"
                        class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('storage_zone_id') border-red-400 ring-1 ring-red-400 @enderror">
                    <option value="">— Select Storage Zone —</option>
                    @foreach ($zones ?? [] as $zone)
                        <option value="{{ $zone->id }}" @selected(old('storage_zone_id', $medicine?->storage_zone_id) == $zone->id)>
                            {{ $zone->name }} ({{ $zone->code }})
                        </option>
                    @endforeach
                </select>
                @error('storage_zone_id')
                    <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                @enderror
            </div>

            <div>
                <label for="storage_temperature" class="block text-sm font-medium text-slate-700">Storage Temperature</label>
                <select id="storage_temperature" name="storage_temperature"
                        class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('storage_temperature') border-red-400 ring-1 ring-red-400 @enderror">
                    <option value="ambient_15_25" @selected(old('storage_temperature', $medicine?->storage_temperature ?? 'ambient_15_25') == 'ambient_15_25')>Ambient (15°C – 25°C)</option>
                    <option value="cold_2_8" @selected(old('storage_temperature', $medicine?->storage_temperature) == 'cold_2_8')>Cold Chain (2°C – 8°C)</option>
                    <option value="frozen_minus_20" @selected(old('storage_temperature', $medicine?->storage_temperature) == 'frozen_minus_20')>Frozen (-20°C)</option>
                    <option value="controlled_vault" @selected(old('storage_temperature', $medicine?->storage_temperature) == 'controlled_vault')>Controlled Vault (Schedule X Safe)</option>
                </select>
                @error('storage_temperature')
                    <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                @enderror
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label for="rack_id" class="block text-sm font-medium text-slate-700">Storage Rack</label>
                <select id="rack_id" name="rack_id"
                        class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('rack_id') border-red-400 ring-1 ring-red-400 @enderror">
                    <option value="">— Select Rack —</option>
                    @foreach ($racks ?? [] as $rack)
                        <option value="{{ $rack->id }}" @selected(old('rack_id', $medicine?->rack_id) == $rack->id)>
                            {{ $rack->rack_code }} — {{ $rack->name }}
                        </option>
                    @endforeach
                </select>
                @error('rack_id')
                    <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                @enderror
            </div>

            <div>
                <label for="rack_shelf_id" class="block text-sm font-medium text-slate-700">Shelf Level</label>
                <select id="rack_shelf_id" name="rack_shelf_id"
                        class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('rack_shelf_id') border-red-400 ring-1 ring-red-400 @enderror">
                    <option value="">— Select Shelf —</option>
                    @foreach ($shelves ?? [] as $shelf)
                        <option value="{{ $shelf->id }}" @selected(old('rack_shelf_id', $medicine?->rack_shelf_id) == $shelf->id)>
                            {{ $shelf->shelf_code }} (Level {{ $shelf->shelf_number }})
                        </option>
                    @endforeach
                </select>
                @error('rack_shelf_id')
                    <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                @enderror
            </div>
        </div>

        <div>
            <label for="rack_location" class="block text-sm font-medium text-slate-700">Quick Picking Tag / Bin Code</label>
            <input type="text" id="rack_location" name="rack_location"
                   value="{{ old('rack_location', $medicine?->rack_location) }}"
                   placeholder="e.g. Aisle 1 &bull; Rack A &bull; Shelf 1 &bull; Bin 02"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('rack_location') border-red-400 ring-1 ring-red-400 @enderror">
            <p class="mt-1 text-xs text-slate-400">Displayed instantly on the cashier POS screen during barcode lookup.</p>
            @error('rack_location')
                <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
            @enderror
        </div>
    </div>

    <div class="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h2 class="text-sm font-semibold text-slate-700">Tax and stock rules</h2>

        <div>
            <label for="gst_rate" class="block text-sm font-medium text-slate-700">GST rate</label>
            <select id="gst_rate" name="gst_rate"
                    class="block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('gst_rate') border-red-400 ring-1 ring-red-400 @enderror">
                @foreach ([0, 5, 12, 18] as $slab)
                    <option value="{{ $slab }}" @selected(old('gst_rate', $medicine?->gst_rate) == $slab)>{{ $slab }}%</option>
                @endforeach
            </select>
            <p class="mt-1 text-xs text-slate-400">Enforced as a CHECK constraint in the database — only 0, 5, 12, 18 are valid slabs.</p>
            @error('gst_rate')
                <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
            @enderror
        </div>

        <div>
            <label for="pack_size" class="block text-sm font-medium text-slate-700">Pack size</label>
            <input type="number" id="pack_size" name="pack_size" min="1"
                   value="{{ old('pack_size', $medicine?->pack_size ?? 1) }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('pack_size') border-red-400 ring-1 ring-red-400 @enderror">
            @error('pack_size')
                <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
            @enderror
        </div>

        <div>
            <label for="min_stock_level" class="block text-sm font-medium text-slate-700">Minimum stock level</label>
            <input type="number" id="min_stock_level" name="min_stock_level" min="0"
                   value="{{ old('min_stock_level', $medicine?->min_stock_level ?? 0) }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('min_stock_level') border-red-400 ring-1 ring-red-400 @enderror">
            @error('min_stock_level')
                <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
            @enderror
        </div>

        <div x-data="{ checked: {{ old('is_prescription_required', $medicine?->is_prescription_required ?? false) ? 'true' : 'false' }} }">
            <label class="flex items-center gap-2">
                <input type="checkbox" name="is_prescription_required" value="1" x-model="checked"
                       class="rounded border-slate-300 text-brand-600 focus:ring-brand-500">
                <span class="text-sm font-medium text-slate-700">Prescription required (Schedule H)</span>
            </label>
            <div class="mt-2" x-show="checked" x-cloak>
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
                    ℞ Prescription required
                </span>
            </div>
        </div>

        <div x-data="{ checked: {{ old('is_active', $medicine?->is_active ?? true) ? 'true' : 'false' }} }">
            <label class="flex items-center gap-2">
                <input type="checkbox" name="is_active" value="1" x-model="checked"
                       class="rounded border-slate-300 text-brand-600 focus:ring-brand-500">
                <span class="text-sm font-medium text-slate-700">Active</span>
            </label>
        </div>
    </div>
</div>
