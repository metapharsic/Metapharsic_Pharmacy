<x-app-layout>
    <x-page-header :title="'Edit Drug License'" :breadcrumbs="[
        ['label' => 'Drug Licenses', 'url' => route('settings.licenses.index')],
        ['label' => $license->license_number],
    ]" />

    <div class="mx-auto max-w-3xl px-4 py-6">
        <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <form method="POST" action="{{ route('settings.licenses.update', $license) }}">
                @csrf
                @method('PUT')

                @include('settings.licenses._form')

                <div class="mt-6 flex items-center gap-3">
                    <button type="submit" class="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                        Save
                    </button>
                    <a href="{{ route('settings.licenses.index') }}" class="text-sm text-slate-600 hover:underline">Cancel</a>
                </div>
            </form>
        </div>
    </div>
</x-app-layout>
