{{--
    Q-007 (opening credit balances) may still be open at Phase 2 time
    (brain/phases/phase-2-master-data.md G2.6). Outstanding balance is
    not editable here — it is derived from sales/payments (Phase 4/5),
    never set by hand on the master-data screen.
--}}
<x-app-layout>
    <x-slot name="header">
        <x-page-header :title="'Add customer'" :breadcrumbs="[
            ['label' => 'Customers', 'href' => route('customers.index')],
            ['label' => 'Add'],
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

    <form method="POST" action="{{ route('customers.store') }}"
          x-data="{ submitting: false }" @submit="submitting = true"
          class="max-w-xl bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        @csrf

        <div>
            <label for="name" class="block text-sm font-medium text-slate-700">Name</label>
            <input type="text" id="name" name="name" autofocus value="{{ old('name') }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('name') border-red-400 ring-1 ring-red-400 @enderror">
            @error('name')<p class="mt-1 text-sm text-red-600">{{ $message }}</p>@enderror
        </div>

        <div>
            <label for="phone" class="block text-sm font-medium text-slate-700">Phone</label>
            <input type="text" id="phone" name="phone" value="{{ old('phone') }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('phone') border-red-400 ring-1 ring-red-400 @enderror">
            <p class="mt-1 text-xs text-slate-400">Indexed for POS customer lookup.</p>
            @error('phone')<p class="mt-1 text-sm text-red-600">{{ $message }}</p>@enderror
        </div>

        <div>
            <label for="doctor_id" class="block text-sm font-medium text-slate-700">Doctor</label>
            <select id="doctor_id" name="doctor_id"
                    class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('doctor_id') border-red-400 ring-1 ring-red-400 @enderror">
                <option value="">— Not listed —</option>
                @foreach (($doctors ?? []) as $id => $name)
                    <option value="{{ $id }}" @selected((string) old('doctor_id') === (string) $id)>{{ $name }}</option>
                @endforeach
            </select>
            @error('doctor_id')<p class="mt-1 text-sm text-red-600">{{ $message }}</p>@enderror
        </div>

        <div>
            <label for="doctor_name" class="block text-sm font-medium text-slate-700">Doctor name (free text)</label>
            <input type="text" id="doctor_name" name="doctor_name" value="{{ old('doctor_name') }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('doctor_name') border-red-400 ring-1 ring-red-400 @enderror">
            <p class="mt-1 text-xs text-slate-400">Or type a doctor name below if not yet in the list (Phase 8c legacy fallback).</p>
            @error('doctor_name')<p class="mt-1 text-sm text-red-600">{{ $message }}</p>@enderror
        </div>

        <div>
            <label for="credit_limit" class="block text-sm font-medium text-slate-700">Credit limit (₹)</label>
            <input type="number" step="0.01" min="0" id="credit_limit" name="credit_limit" value="{{ old('credit_limit', '0.00') }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('credit_limit') border-red-400 ring-1 ring-red-400 @enderror">
            <p class="mt-1 text-xs text-slate-400">0 disables credit sales for this customer at the POS.</p>
            @error('credit_limit')<p class="mt-1 text-sm text-red-600">{{ $message }}</p>@enderror
        </div>

        <div class="flex justify-end gap-3 pt-2">
            <a href="{{ route('customers.index') }}" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</a>
            <button type="submit" :disabled="submitting"
                    class="inline-flex items-center px-4 py-2 bg-brand-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                Save customer
            </button>
        </div>
    </form>
</x-app-layout>
