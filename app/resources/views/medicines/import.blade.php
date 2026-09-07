{{--
    medicines.import — CSV upload posting to MedicineImportController,
    which delegates to app/Services/MedicineImportService.php (the same
    code path the medicines:import artisan command uses). T-0207/T-0207a.
--}}
<x-app-layout>
    <x-slot name="header">
        <x-page-header :title="'Import medicines'" :breadcrumbs="[
            ['label' => 'Medicines', 'href' => route('medicines.index')],
            ['label' => 'Import'],
        ]" />
    </x-slot>

    <div class="max-w-2xl space-y-6">
        <form method="POST" action="{{ route('medicines.import.store') }}" enctype="multipart/form-data"
              x-data="{ submitting: false }" @submit="submitting = true"
              class="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            @csrf

            <div>
                <label for="csv_file" class="block text-sm font-medium text-slate-700">CSV file</label>
                <input type="file" id="csv_file" name="csv_file" accept=".csv,text/csv" autofocus
                       class="mt-1 block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 @error('csv_file') border-red-400 @enderror">
                <p class="mt-1 text-xs text-slate-400">
                    Expected columns: name, generic_name, category, manufacturer, unit, gst_rate,
                    pack_size, hsn_code, barcode, min_stock_level, is_prescription_required.
                </p>
                @error('csv_file')
                    <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                @enderror
            </div>

            <label class="flex items-center gap-2">
                <input type="checkbox" name="dry_run" value="1" class="rounded border-slate-300 text-brand-600 focus:ring-brand-500">
                <span class="text-sm text-slate-700">Dry run (validate only, write nothing)</span>
            </label>

            <div class="flex justify-end">
                <button type="submit" :disabled="submitting"
                        class="inline-flex items-center px-4 py-2 bg-brand-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                    Import
                </button>
            </div>
        </form>

        @isset($report)
            <div class="bg-white border border-slate-200 rounded-lg p-6">
                <h2 class="text-sm font-semibold text-slate-700 mb-3">Last import report</h2>
                <dl class="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div><dt class="text-slate-500">Rows in file</dt><dd class="tabular-nums font-medium">{{ $report['rows_in_file'] }}</dd></div>
                    <div><dt class="text-slate-500">Imported</dt><dd class="tabular-nums font-medium text-ok-700">{{ $report['imported'] }}</dd></div>
                    <div><dt class="text-slate-500">Rejected</dt><dd class="tabular-nums font-medium text-red-700">{{ $report['rejected'] }}</dd></div>
                    <div><dt class="text-slate-500">Duplicates</dt><dd class="tabular-nums font-medium text-amber-700">{{ $report['duplicates'] }}</dd></div>
                </dl>

                @if (! empty($report['errors']))
                    <table class="min-w-full text-sm divide-y divide-slate-200">
                        <thead>
                            <tr>
                                <th scope="col" class="px-3 py-2 text-left font-medium text-slate-600">Row</th>
                                <th scope="col" class="px-3 py-2 text-left font-medium text-slate-600">Reason</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            @foreach ($report['errors'] as $error)
                                <tr>
                                    <td class="px-3 py-2 tabular-nums">{{ $error['row'] }}</td>
                                    <td class="px-3 py-2 text-slate-600">{{ $error['reason'] }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                @endif
            </div>
        @endisset
    </div>
</x-app-layout>
