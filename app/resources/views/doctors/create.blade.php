<x-app-layout>
    <x-page-header :title="'New Doctor'" :breadcrumbs="[
        ['label' => 'Doctors', 'url' => route('doctors.index')],
        ['label' => 'New'],
    ]" />

    <div class="mx-auto max-w-3xl px-4 py-6">
        <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <form method="POST" action="{{ route('doctors.store') }}">
                @csrf

                @php($doctor = null)
                @include('doctors._form')

                <div class="mt-6 flex items-center gap-3">
                    <button type="submit" class="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                        Save
                    </button>
                    <a href="{{ route('doctors.index') }}" class="text-sm text-slate-600 hover:underline">Cancel</a>
                </div>
            </form>
        </div>
    </div>
</x-app-layout>
