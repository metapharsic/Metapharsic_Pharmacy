{{-- Shared fields for create.blade.php and edit.blade.php. Expects $doctor (may be null on create). --}}

<div class="space-y-6">
    <x-form.input name="name" label="Name" value="{{ old('name', $doctor->name ?? '') }}" required />
    @error('name')
        <p class="text-xs text-red-600 -mt-4">{{ $message }}</p>
    @enderror

    <x-form.input name="registration_no" label="Registration No." value="{{ old('registration_no', $doctor->registration_no ?? '') }}" />
    @error('registration_no')
        <p class="text-xs text-red-600 -mt-4">{{ $message }}</p>
    @enderror

    <x-form.input name="phone" label="Phone" value="{{ old('phone', $doctor->phone ?? '') }}" />
    @error('phone')
        <p class="text-xs text-red-600 -mt-4">{{ $message }}</p>
    @enderror

    <x-form.input name="specialization" label="Specialization" value="{{ old('specialization', $doctor->specialization ?? '') }}" />
    @error('specialization')
        <p class="text-xs text-red-600 -mt-4">{{ $message }}</p>
    @enderror

    <label class="inline-flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="is_active" value="1" class="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            @checked(old('is_active', $doctor->is_active ?? true))>
        Active
    </label>
</div>
