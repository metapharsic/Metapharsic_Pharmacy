<x-app-layout>
    <x-slot name="header">
        <x-page-header :title="'Add Manufacturer'" :breadcrumbs="[
            ['label' => 'Manufacturers', 'href' => route('manufacturers.index')],
            ['label' => 'Add'],
        ]" />
    </x-slot>

    @if ($errors->any())
        <div class="max-w-xl mb-4 rounded-md bg-red-50 border border-red-300 p-4">
            <p class="text-sm font-medium text-red-800">Please fix the following:</p>
            <ul class="mt-2 text-sm text-red-700 list-disc list-inside">
                @foreach ($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <form method="POST" action="{{ route('manufacturers.store') }}" class="max-w-xl bg-white border border-slate-200 rounded-lg p-6 space-y-4 shadow-sm">
        @csrf

        <div>
            <label for="name" class="block text-sm font-medium text-slate-700">Manufacturer Name *</label>
            <input type="text" id="name" name="name" required autofocus value="{{ old('name') }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500">
        </div>

        <div>
            <label for="contact_person" class="block text-sm font-medium text-slate-700">Contact Person</label>
            <input type="text" id="contact_person" name="contact_person" value="{{ old('contact_person') }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500">
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <label for="phone" class="block text-sm font-medium text-slate-700">Phone</label>
                <input type="text" id="phone" name="phone" value="{{ old('phone') }}"
                       class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500">
            </div>
            <div>
                <label for="email" class="block text-sm font-medium text-slate-700">Email</label>
                <input type="email" id="email" name="email" value="{{ old('email') }}"
                       class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500">
            </div>
        </div>

        <div>
            <label for="address" class="block text-sm font-medium text-slate-700">Address</label>
            <textarea id="address" name="address" rows="2"
                      class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500">{{ old('address') }}</textarea>
        </div>

        <div class="flex items-center gap-2">
            <input type="checkbox" id="is_active" name="is_active" value="1" @checked(old('is_active', 1)) class="rounded border-slate-300 text-brand-600 focus:ring-brand-500">
            <label for="is_active" class="text-sm text-slate-700">Active</label>
        </div>

        <div class="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <a href="{{ route('manufacturers.index') }}" class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</a>
            <button type="submit" class="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 shadow-sm">Save Manufacturer</button>
        </div>
    </form>
</x-app-layout>
