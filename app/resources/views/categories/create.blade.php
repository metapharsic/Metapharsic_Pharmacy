<x-app-layout>
    <x-slot name="header">
        <x-page-header :title="'Add Category'" :breadcrumbs="[
            ['label' => 'Categories', 'href' => route('categories.index')],
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

    <form method="POST" action="{{ route('categories.store') }}" class="max-w-xl bg-white border border-slate-200 rounded-lg p-6 space-y-4 shadow-sm">
        @csrf

        <div>
            <label for="name" class="block text-sm font-medium text-slate-700">Category Name *</label>
            <input type="text" id="name" name="name" required autofocus value="{{ old('name') }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500">
        </div>

        <div>
            <label for="description" class="block text-sm font-medium text-slate-700">Description</label>
            <textarea id="description" name="description" rows="3"
                      class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500">{{ old('description') }}</textarea>
        </div>

        <div class="flex items-center gap-2">
            <input type="checkbox" id="is_active" name="is_active" value="1" @checked(old('is_active', 1)) class="rounded border-slate-300 text-brand-600 focus:ring-brand-500">
            <label for="is_active" class="text-sm text-slate-700">Active</label>
        </div>

        <div class="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <a href="{{ route('categories.index') }}" class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</a>
            <button type="submit" class="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 shadow-sm">Save Category</button>
        </div>
    </form>
</x-app-layout>
