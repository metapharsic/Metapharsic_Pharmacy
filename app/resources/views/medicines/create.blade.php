<x-app-layout>
    <x-slot name="header">
        <x-page-header :title="'Add medicine'" :breadcrumbs="[
            ['label' => 'Medicines', 'href' => route('medicines.index')],
            ['label' => 'Add'],
        ]" />
    </x-slot>

    @if ($errors->any())
        <div class="max-w-2xl mb-4 rounded-md bg-red-50 border border-red-300 p-4" aria-live="assertive">
            <p class="text-sm font-medium text-red-800">Please fix the following:</p>
            <ul class="mt-2 text-sm text-red-700 list-disc list-inside">
                @foreach ($errors->all() as $error)
                    <li><a href="#" class="hover:underline">{{ $error }}</a></li>
                @endforeach
            </ul>
        </div>
    @endif

    <form method="POST" action="{{ route('medicines.store') }}"
          x-data="{ submitting: false }" @submit="submitting = true">
        @csrf
        @include('medicines._form', ['medicine' => null])

        <div class="max-w-2xl mt-6 flex justify-end gap-3">
            <a href="{{ route('medicines.index') }}" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</a>
            <button type="submit" :disabled="submitting"
                    class="inline-flex items-center px-4 py-2 bg-brand-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                <svg x-show="submitting" x-cloak class="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Save medicine
            </button>
        </div>
    </form>
</x-app-layout>
