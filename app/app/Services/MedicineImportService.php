<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Category;
use App\Models\Manufacturer;
use App\Models\Medicine;
use App\Models\Unit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Single code path for CSV medicine import — shared by the
 * `medicines:import` artisan command and MedicineImportController's web
 * upload flow, per brain/05-routes-and-modules.md ("Catalog" module owns
 * MedicineImportService as its only domain service).
 *
 * Cave law: medicine holds no quantity, no expiry, no price (only
 * default_purchase_price for costing reference — never a batch/stock
 * field). This service never touches medicine_batches or
 * stock_transactions; that table does not exist until Phase 3.
 *
 * Contract (brain/phases/phase-2-master-data.md T-0207 / T-0207a):
 *   - supports a dry run: validate + report, write nothing
 *   - every rejected row carries a reason string
 *   - rows_in_file = imported + rejected, always
 *   - re-running an already-imported file changes zero rows (idempotent):
 *     dedup key is name + manufacturer_id + pack_size
 */
final class MedicineImportService
{
    /**
     * @param  string  $csvPath  Absolute path to the CSV file on disk.
     * @param  bool  $dryRun  When true, validates and reports but writes nothing.
     * @return array{
     *     rows_in_file: int,
     *     imported: int,
     *     rejected: int,
     *     duplicates: int,
     *     errors: array<int, array{row: int, reason: string}>,
     * }
     */
    public function import(string $csvPath, bool $dryRun = false): array
    {
        $rowsInFile = 0;
        $imported = 0;
        $duplicates = 0;
        $errors = [];

        $handle = fopen($csvPath, 'rb');
        if ($handle === false) {
            throw new \RuntimeException("Unable to open CSV at {$csvPath}");
        }

        $header = fgetcsv($handle);
        if ($header === false) {
            fclose($handle);
            throw new \RuntimeException('CSV file is empty or unreadable.');
        }
        $header = array_map(static fn ($h) => Str::snake(trim((string) $h)), $header);

        DB::beginTransaction();

        try {
            $rowNumber = 1; // header is row 1
            while (($row = fgetcsv($handle)) !== false) {
                $rowNumber++;
                $rowsInFile++;

                if (count($row) !== count($header)) {
                    $errors[] = ['row' => $rowNumber, 'reason' => 'Column count does not match header.'];

                    continue;
                }

                $data = array_combine($header, $row);
                $result = $this->importRow($data, $dryRun);

                if ($result['status'] === 'imported') {
                    $imported++;
                } elseif ($result['status'] === 'duplicate') {
                    $duplicates++;
                    $errors[] = ['row' => $rowNumber, 'reason' => $result['reason']];
                } else {
                    $errors[] = ['row' => $rowNumber, 'reason' => $result['reason']];
                }
            }

            if ($dryRun) {
                DB::rollBack();
            } else {
                DB::commit();
            }
        } catch (\Throwable $e) {
            DB::rollBack();
            fclose($handle);
            throw $e;
        }

        fclose($handle);

        return [
            'rows_in_file' => $rowsInFile,
            'imported' => $imported,
            'rejected' => count($errors),
            'duplicates' => $duplicates,
            'errors' => $errors,
        ];
    }

    /**
     * @param  array<string, string>  $data
     * @return array{status: 'imported'|'duplicate'|'rejected', reason?: string}
     */
    private function importRow(array $data, bool $dryRun): array
    {
        $name = trim((string) ($data['name'] ?? ''));
        $genericName = trim((string) ($data['generic_name'] ?? ''));
        $manufacturerName = trim((string) ($data['manufacturer'] ?? ''));
        $categoryName = trim((string) ($data['category'] ?? ''));
        $unitName = trim((string) ($data['unit'] ?? ''));
        $gstRate = (int) ($data['gst_rate'] ?? -1);
        $packSize = (int) ($data['pack_size'] ?? 0);
        $barcode = trim((string) ($data['barcode'] ?? '')) ?: null;
        $hsnCode = trim((string) ($data['hsn_code'] ?? ''));
        $minStockLevel = (int) ($data['min_stock_level'] ?? 0);
        $isPrescriptionRequired = in_array(strtolower((string) ($data['is_prescription_required'] ?? '')), ['1', 'true', 'yes', 'y'], true);

        if ($name === '') {
            return ['status' => 'rejected', 'reason' => 'Missing medicine name.'];
        }

        if (! in_array($gstRate, [0, 5, 12, 18], true)) {
            return ['status' => 'rejected', 'reason' => "Invalid gst_rate '{$gstRate}': must be one of 0, 5, 12, 18."];
        }

        if ($packSize <= 0) {
            return ['status' => 'rejected', 'reason' => "Invalid pack_size '{$packSize}': must be greater than zero."];
        }

        if ($unitName === '') {
            return ['status' => 'rejected', 'reason' => 'Missing unit.'];
        }

        $unit = Unit::query()->where('name', $unitName)->first();
        if ($unit === null) {
            return ['status' => 'rejected', 'reason' => "Unit '{$unitName}' is not seeded."];
        }

        $manufacturer = $manufacturerName !== ''
            ? Manufacturer::query()->firstOrCreate(['name' => $manufacturerName])
            : null;

        $category = $categoryName !== ''
            ? Category::query()->firstOrCreate(['name' => $categoryName])
            : null;

        // T-0207a: duplicate name + manufacturer + pack_size is flagged,
        // never silently created twice. This is also what makes re-running
        // the same file idempotent (G2.2).
        $existing = Medicine::query()
            ->where('name', $name)
            ->where('manufacturer_id', $manufacturer?->id)
            ->where('pack_size', $packSize)
            ->first();

        if ($existing !== null) {
            return ['status' => 'duplicate', 'reason' => "Duplicate of existing medicine #{$existing->id} (same name + manufacturer + pack_size)."];
        }

        if ($dryRun) {
            return ['status' => 'imported'];
        }

        Medicine::query()->create([
            'name' => $name,
            'generic_name' => $genericName !== '' ? $genericName : null,
            'category_id' => $category?->id,
            'manufacturer_id' => $manufacturer?->id,
            'unit_id' => $unit->id,
            'gst_rate' => $gstRate,
            'pack_size' => $packSize,
            'hsn_code' => $hsnCode !== '' ? $hsnCode : null,
            'barcode' => $barcode,
            'min_stock_level' => $minStockLevel,
            'is_prescription_required' => $isPrescriptionRequired,
            'is_active' => true,
        ]);

        return ['status' => 'imported'];
    }
}
