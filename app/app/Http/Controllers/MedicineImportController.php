<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\MedicineImportService;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

/**
 * Web-side CSV medicine import. Calls the same MedicineImportService the
 * `medicines:import` artisan command uses, so CLI and web share one code
 * path — see app/Services/MedicineImportService.php.
 *
 * Routes: medicines.import.create / medicines.import.store / medicines.import.show
 * Permission: medicine.import (see brain/05-routes-and-modules.md).
 */
final class MedicineImportController extends Controller
{
    public function __construct(private readonly MedicineImportService $importService)
    {
    }

    public function create(): View
    {
        return view('medicines.import');
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'csv_file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
            'dry_run' => ['sometimes', 'boolean'],
        ]);

        $path = $request->file('csv_file')->getRealPath();

        // G2.1: rows_in_file = imported + rejected, and every rejection
        // carries a reason. G2.2: re-running the same file is a no-op
        // thanks to the name+manufacturer+pack_size dedup in the service.
        $report = $this->importService->import($path, (bool) $request->boolean('dry_run'));

        // T-0207b: large files should be dispatched to the `database`
        // queue instead of running synchronously here. This scaffold
        // calls the service inline; wiring the queued job is a follow-up
        // once ImportMedicinesJob exists.
        session()->flash('import_report', $report);

        return redirect()
            ->route('medicines.index')
            ->with('status', "Import complete: {$report['imported']} imported, {$report['rejected']} rejected of {$report['rows_in_file']} rows.");
    }

    public function show(int $import): View
    {
        // Placeholder for a persisted import-run record (medicine_imports
        // table), out of scope for this scaffold pass. For now the report
        // is read back from the flashed session data set in store().
        $report = session('import_report', [
            'rows_in_file' => 0,
            'imported' => 0,
            'rejected' => 0,
            'duplicates' => 0,
            'errors' => [],
        ]);

        return view('medicines.import', ['report' => $report]);
    }
}
