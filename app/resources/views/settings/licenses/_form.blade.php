{{-- Shared fields for create.blade.php and edit.blade.php. Expects $license (may be null on create). --}}

<div class="space-y-6">
    <x-form.select name="license_type" label="License Type" :options="[
        '' => 'Select a type',
        'retail_dl_20' => 'Retail Drug License (Form 20)',
        'retail_dl_21' => 'Retail Drug License (Form 21)',
        'wholesale_dl_20b' => 'Wholesale Drug License (Form 20B)',
        'wholesale_dl_21b' => 'Wholesale Drug License (Form 21B)',
        'other' => 'Other',
    ]" value="{{ old('license_type', $license->license_type ?? '') }}" />
    @error('license_type')
        <p class="text-xs text-red-600 -mt-4">{{ $message }}</p>
    @enderror

    <x-form.input name="license_number" label="License Number" value="{{ old('license_number', $license->license_number ?? '') }}" required />
    @error('license_number')
        <p class="text-xs text-red-600 -mt-4">{{ $message }}</p>
    @enderror

    <div class="grid grid-cols-2 gap-4">
        <div>
            <x-form.input type="date" name="issued_on" label="Issued On" value="{{ old('issued_on', optional($license->issued_on ?? null)->format('Y-m-d')) }}" required />
            @error('issued_on')
                <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
            @enderror
        </div>
        <div>
            <x-form.input type="date" name="expires_on" label="Expires On" value="{{ old('expires_on', optional($license->expires_on ?? null)->format('Y-m-d')) }}" required />
            @error('expires_on')
                <p class="text-xs text-red-600 mt-1">{{ $message }}</p>
            @enderror
        </div>
    </div>

    <x-form.input name="issuing_authority" label="Issuing Authority" value="{{ old('issuing_authority', $license->issuing_authority ?? '') }}" />
    @error('issuing_authority')
        <p class="text-xs text-red-600 -mt-4">{{ $message }}</p>
    @enderror

    <label class="inline-flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="is_active" value="1" class="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            @checked(old('is_active', $license->is_active ?? true))>
        Active
    </label>
</div>
