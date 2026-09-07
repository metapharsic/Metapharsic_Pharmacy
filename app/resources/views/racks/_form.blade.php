{{-- Shared fields for create.blade.php and edit.blade.php. Expects $rack (may be null on create) and $zones. --}}

<div class="space-y-6">
    <x-form.select name="storage_zone_id" label="Storage Zone" :options="$zones->pluck('name', 'id')->prepend('Select a zone', '')"
        value="{{ old('storage_zone_id', $rack->storage_zone_id ?? '') }}" />
    @error('storage_zone_id')
        <p class="text-xs text-red-600 -mt-4">{{ $message }}</p>
    @enderror

    <div class="grid grid-cols-2 gap-4">
        <div>
            <x-form.input name="rack_code" label="Rack Code" value="{{ old('rack_code', $rack->rack_code ?? '') }}" required />
            @error('rack_code')
                <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
            @enderror
        </div>
        <div>
            <x-form.input name="name" label="Name" value="{{ old('name', $rack->name ?? '') }}" required />
            @error('name')
                <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
            @enderror
        </div>
    </div>

    <div class="grid grid-cols-3 gap-4">
        <div>
            <x-form.input name="aisle" label="Aisle" value="{{ old('aisle', $rack->aisle ?? '') }}" />
            @error('aisle')
                <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
            @enderror
        </div>
        <div>
            <x-form.input type="number" min="0" name="row_number" label="Row No." value="{{ old('row_number', $rack->row_number ?? '') }}" />
            @error('row_number')
                <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
            @enderror
        </div>
        <div>
            <x-form.input type="number" min="0" name="column_number" label="Column No." value="{{ old('column_number', $rack->column_number ?? '') }}" />
            @error('column_number')
                <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
            @enderror
        </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
        <div>
            <x-form.input type="number" min="1" max="50" name="total_shelves" label="Total Shelves" value="{{ old('total_shelves', $rack->total_shelves ?? 5) }}" required />
            @error('total_shelves')
                <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
            @enderror
        </div>
        <div>
            <x-form.input type="number" min="1" name="max_capacity_boxes" label="Capacity (units)" value="{{ old('max_capacity_boxes', $rack->max_capacity_boxes ?? 500) }}" required />
            <p class="mt-1 text-xs text-slate-500">Maximum units this rack can hold across all its shelves.</p>
            @error('max_capacity_boxes')
                <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
            @enderror
        </div>
    </div>

    <x-form.select name="status" label="Status" :options="[
        'active' => 'Active',
        'inactive' => 'Inactive',
    ]" value="{{ old('status', $rack->status ?? 'active') }}" />
    @error('status')
        <p class="text-xs text-red-600 -mt-4">{{ $message }}</p>
    @enderror
</div>
