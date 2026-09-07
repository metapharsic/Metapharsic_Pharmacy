<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Category;
use App\Models\Manufacturer;
use App\Models\Medicine;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Expected CSV header (order not significant, matched by name):
 * name,generic_name,brand,category,manufacturer,unit,pack_size,hsn_code,gst_rate,
 * min_stock_level,barcode
 *
 * Cave law 3: this importer never writes quantity, expiry, or a stock price — those columns
 * do not exist on `medicines`. Opening stock is a Phase 3 concern (StockTransactionType::OpeningStock).
 */
class ImportMedicinesFromCsv extends Command
{
    protected $signature = 'medicines:import {path : Absolute or relative path to the CSV file} {--dry-run : Validate and report without writing any rows}';

    protected $description = 'Import medicines from a CSV file, upserting category/manufacturer by name and medicines by barcode-or-name.';

    private const ALLOWED_GST_RATES = [0.0, 5.0, 12.0, 18.0];

    public function handle(): int
    {
        $path = (string) $this->argument('path');
        $dryRun = (bool) $this->option('dry-run');

        if (! is_readable($path)) {
            $this->error("File not readable: {$path}");

            return self::FAILURE;
        }

        $handle = fopen($path, 'rb');

        if ($handle === false) {
            $this->error("Could not open file: {$path}");

            return self::FAILURE;
        }

        $header = fgetcsv($handle);

        if ($header === false) {
            $this->error('CSV file is empty.');
            fclose($handle);

            return self::FAILURE;
        }

        $header = array_map(static fn (string $col): string => trim(strtolower($col)), $header);

        $rowsIn = 0;
        $imported = 0;
        $skipped = 0;
        /** @var array<int, string> $errors */
        $errors = [];

        $rowNumber = 1; // header was row 1

        while (($row = fgetcsv($handle)) !== false) {
            $rowNumber++;
            $rowsIn++;

            if (count($row) !== count($header)) {
                $errors[] = "Row {$rowNumber}: column count mismatch, skipped.";
                $skipped++;

                continue;
            }

            /** @var array<string, string> $record */
            $record = array_combine($header, array_map('trim', $row));

            $result = $this->importRow($record, $rowNumber, $dryRun);

            if ($result === null) {
                $imported++;
            } else {
                $errors[] = $result;
                $skipped++;
            }
        }

        fclose($handle);

        $this->info(sprintf(
            '%sRows in file: %d | Imported: %d | Rejected: %d',
            $dryRun ? '[DRY RUN] ' : '',
            $rowsIn,
            $imported,
            $skipped,
        ));

        foreach ($errors as $error) {
            $this->warn($error);
        }

        return $skipped > 0 && $imported === 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * @param  array<string, string>  $record
     * @return string|null Error message, or null on success.
     */
    private function importRow(array $record, int $rowNumber, bool $dryRun): ?string
    {
        $name = $record['name'] ?? '';

        if ($name === '') {
            return "Row {$rowNumber}: missing required 'name', skipped.";
        }

        $unit = $record['unit'] ?? '';

        if ($unit === '') {
            return "Row {$rowNumber}: missing required 'unit', skipped.";
        }

        $gstRate = isset($record['gst_rate']) && $record['gst_rate'] !== ''
            ? (float) $record['gst_rate']
            : 0.0;

        if (! in_array($gstRate, self::ALLOWED_GST_RATES, true)) {
            return "Row {$rowNumber}: gst_rate '{$record['gst_rate']}' is not one of 0/5/12/18, skipped.";
        }

        $packSize = isset($record['pack_size']) && $record['pack_size'] !== ''
            ? (int) $record['pack_size']
            : 1;

        if ($packSize < 1) {
            return "Row {$rowNumber}: pack_size must be > 0, skipped.";
        }

        $barcode = ($record['barcode'] ?? '') !== '' ? $record['barcode'] : null;

        if ($dryRun) {
            return null;
        }

        try {
            DB::transaction(function () use ($record, $name, $unit, $gstRate, $packSize, $barcode): void {
                $categoryId = $this->upsertCategory($record['category'] ?? '');
                $manufacturerId = $this->upsertManufacturer($record['manufacturer'] ?? '');

                $attributes = [
                    'generic_name' => ($record['generic_name'] ?? '') !== '' ? $record['generic_name'] : null,
                    'brand' => ($record['brand'] ?? '') !== '' ? $record['brand'] : null,
                    'category_id' => $categoryId,
                    'manufacturer_id' => $manufacturerId,
                    'unit' => $unit,
                    'pack_size' => $packSize,
                    'hsn_code' => ($record['hsn_code'] ?? '') !== '' ? $record['hsn_code'] : null,
                    'gst_rate' => $gstRate,
                    'min_stock_level' => isset($record['min_stock_level']) && $record['min_stock_level'] !== ''
                        ? (int) $record['min_stock_level']
                        : 0,
                    'barcode' => $barcode,
                ];

                // Upsert key: barcode when present (it is the more reliable identity),
                // otherwise name. Re-running the same file must be idempotent (G2.2).
                $lookup = $barcode !== null
                    ? ['barcode' => $barcode]
                    : ['name' => $name];

                Medicine::query()->updateOrCreate($lookup, ['name' => $name, ...$attributes]);
            });
        } catch (\Throwable $e) {
            return "Row {$rowNumber}: import failed — {$e->getMessage()}";
        }

        return null;
    }

    private function upsertCategory(string $name): ?int
    {
        if ($name === '') {
            return null;
        }

        return Category::query()->firstOrCreate(['name' => $name], ['is_active' => true])->id;
    }

    private function upsertManufacturer(string $name): ?int
    {
        if ($name === '') {
            return null;
        }

        return Manufacturer::query()->firstOrCreate(['name' => $name], ['is_active' => true])->id;
    }
}
