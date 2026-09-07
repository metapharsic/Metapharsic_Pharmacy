{{--
    Q-002 resolved intra-state only per brain/05-routes-and-modules.md
    T-0205, so no IGST/inter-state field is added here — state_code exists
    for GST validation against the shop's own state, not for tax routing.
--}}
<x-app-layout>
    <x-slot name="header">
        <x-page-header :title="'Edit supplier'" :breadcrumbs="[
            ['label' => 'Suppliers', 'href' => route('suppliers.index')],
            ['label' => $supplier->name],
        ]" />
    </x-slot>

    @if ($errors->any())
        <div class="max-w-xl mb-4 rounded-md bg-red-50 border border-red-300 p-4" aria-live="assertive">
            <p class="text-sm font-medium text-red-800">Please fix the following:</p>
            <ul class="mt-2 text-sm text-red-700 list-disc list-inside">
                @foreach ($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <form method="POST" action="{{ route('suppliers.update', $supplier) }}"
          x-data="{ submitting: false }" @submit="submitting = true"
          class="max-w-xl bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        @csrf
        @method('PUT')

        <div>
            <label for="name" class="block text-sm font-medium text-slate-700">Name</label>
            <input type="text" id="name" name="name" autofocus value="{{ old('name', $supplier->name) }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('name') border-red-400 ring-1 ring-red-400 @enderror">
            @error('name')<p class="mt-1 text-sm text-red-600">{{ $message }}</p>@enderror
        </div>

        <div>
            <label for="gstin" class="block text-sm font-medium text-slate-700">GSTIN</label>
            <input type="text" id="gstin" name="gstin" value="{{ old('gstin', $supplier->gstin) }}" maxlength="15"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('gstin') border-red-400 ring-1 ring-red-400 @enderror">
            @error('gstin')<p class="mt-1 text-sm text-red-600">{{ $message }}</p>@enderror
        </div>

        <div>
            <label for="state_code" class="block text-sm font-medium text-slate-700">State code</label>
            <select id="state_code" name="state_code"
                    class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('state_code') border-red-400 ring-1 ring-red-400 @enderror">
                @foreach ($stateCodes as $code => $label)
                    <option value="{{ $code }}" @selected(old('state_code', $supplier->state_code) == $code)>{{ $code }} — {{ $label }}</option>
                @endforeach
            </select>
            <p class="mt-1 text-xs text-slate-400">Validated against the GST state-code list; must match the shop's own state (intra-state only, Q-002).</p>
            @error('state_code')<p class="mt-1 text-sm text-red-600">{{ $message }}</p>@enderror
        </div>

        <div>
            <label for="phone" class="block text-sm font-medium text-slate-700">Phone</label>
            <input type="text" id="phone" name="phone" value="{{ old('phone', $supplier->phone) }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('phone') border-red-400 ring-1 ring-red-400 @enderror">
            @error('phone')<p class="mt-1 text-sm text-red-600">{{ $message }}</p>@enderror
        </div>

        <div>
            <label for="address" class="block text-sm font-medium text-slate-700">Address</label>
            <textarea id="address" name="address" rows="3"
                      class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('address') border-red-400 ring-1 ring-red-400 @enderror">{{ old('address', $supplier->address) }}</textarea>
            @error('address')<p class="mt-1 text-sm text-red-600">{{ $message }}</p>@enderror
        </div>

        <div class="flex justify-between items-center pt-2">
            @can('supplier.delete')
                <button type="button"
                        @click="$dispatch('open-confirm', {
                            message: 'This will deactivate {{ $supplier->name }}. It will no longer be selectable on new purchases.',
                            action: '{{ route('suppliers.destroy', $supplier) }}',
                        })"
                        class="text-sm font-medium text-red-600 hover:text-red-800">
                    Deactivate
                </button>
            @else
                <span></span>
            @endcan
            <div class="flex gap-3">
                <a href="{{ route('suppliers.index') }}" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</a>
                <button type="submit" :disabled="submitting"
                        class="inline-flex items-center px-4 py-2 bg-brand-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                    Save changes
                </button>
            </div>
        </div>
    </form>

    <x-confirm />
</x-app-layout>
