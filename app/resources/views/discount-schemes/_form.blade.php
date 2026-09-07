{{-- Shared fields for create.blade.php and edit.blade.php. Expects $scheme (may be null on create). --}}

<div x-data="{
        type: '{{ old('type', $scheme->type ?? '') }}',
        scope: '{{ old('medicine_id', $scheme->medicine_id ?? '') ? 'medicine' : (old('category_id', $scheme->category_id ?? '') ? 'category' : '') }}',
    }" class="space-y-6">

    <x-form.input name="name" label="Name" value="{{ old('name', $scheme->name ?? '') }}" required />
    @error('name')
        <p class="text-xs text-red-600 -mt-4">{{ $message }}</p>
    @enderror

    <x-form.select name="type" label="Type" x-model="type" :options="[
        '' => 'Select a type',
        'buy_x_get_y' => 'Buy X Get Y Free',
        'slab' => 'Slab Discount',
    ]" value="{{ old('type', $scheme->type ?? '') }}" />
    @error('type')
        <p class="text-xs text-red-600 -mt-4">{{ $message }}</p>
    @enderror

    <div>
        <label class="block text-xs font-medium text-slate-700 mb-1">Applies To</label>
        <div class="flex items-center gap-4 mb-2">
            <label class="inline-flex items-center gap-1.5 text-sm text-slate-700">
                <input type="radio" name="scope" value="medicine" x-model="scope" class="border-slate-300 text-brand-600 focus:ring-brand-500">
                One medicine
            </label>
            <label class="inline-flex items-center gap-1.5 text-sm text-slate-700">
                <input type="radio" name="scope" value="category" x-model="scope" class="border-slate-300 text-brand-600 focus:ring-brand-500">
                A category
            </label>
        </div>

        <div x-show="scope === 'medicine'">
            <x-form.select name="medicine_id" label="Medicine" :options="$medicines->pluck('name', 'id')->prepend('Select a medicine', '')"
                value="{{ old('medicine_id', $scheme->medicine_id ?? '') }}" />
        </div>

        <div x-show="scope === 'category'">
            <x-form.select name="category_id" label="Category" :options="$categories->pluck('name', 'id')->prepend('Select a category', '')"
                value="{{ old('category_id', $scheme->category_id ?? '') }}" />
        </div>

        @error('medicine_id')
            <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
        @enderror
        @error('category_id')
            <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
        @enderror
    </div>

    <div x-show="type === 'buy_x_get_y'" class="grid grid-cols-2 gap-4">
        <div>
            <x-form.input type="number" min="1" name="buy_qty" label="Buy Qty" value="{{ old('buy_qty', $scheme->buy_qty ?? '') }}" />
            @error('buy_qty')
                <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
            @enderror
        </div>
        <div>
            <x-form.input type="number" min="1" name="get_qty" label="Get Qty Free" value="{{ old('get_qty', $scheme->get_qty ?? '') }}" />
            @error('get_qty')
                <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
            @enderror
        </div>
    </div>

    <div x-show="type === 'slab'" class="grid grid-cols-2 gap-4">
        <div>
            <x-form.input type="number" min="1" name="min_qty" label="Min Qty" value="{{ old('min_qty', $scheme->min_qty ?? '') }}" />
            @error('min_qty')
                <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
            @enderror
        </div>
        <div>
            <x-form.input type="number" step="0.01" min="0" max="100" name="slab_discount_percent" label="Discount %"
                value="{{ old('slab_discount_percent', $scheme->slab_discount_percent ?? '') }}" />
            @error('slab_discount_percent')
                <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
            @enderror
        </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
        <div>
            <x-form.input type="date" name="starts_on" label="Starts On" value="{{ old('starts_on', optional($scheme->starts_on ?? null)->format('Y-m-d')) }}" />
            @error('starts_on')
                <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
            @enderror
        </div>
        <div>
            <x-form.input type="date" name="ends_on" label="Ends On" value="{{ old('ends_on', optional($scheme->ends_on ?? null)->format('Y-m-d')) }}" />
            @error('ends_on')
                <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
            @enderror
        </div>
    </div>

    <label class="inline-flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="is_active" value="1" class="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            @checked(old('is_active', $scheme->is_active ?? true))>
        Active
    </label>
</div>
