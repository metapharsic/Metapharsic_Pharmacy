<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\MedicineBatch;
use App\Models\StockTransaction;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Cave law 7: `medicine_batches.quantity_available` must always equal
 * `SUM(stock_transactions.quantity_change)` for that batch. Run nightly and in CI
 * (ADR-0003, G3.3). Deliberately has NO `--fix` flag and never will — drift is a defect
 * to be diagnosed from the ledger, not a number to be silently overwritten.
 */
class StockVerifyCommand extends Command
{
    protected $signature = 'stock:verify';

    protected $description = 'Verify every medicine_batches.quantity_available equals the SUM of its stock_transactions ledger.';

    public function handle(): int
    {
        $ledgerSums = StockTransaction::query()
            ->select('medicine_batch_id', DB::raw('SUM(quantity_change) as ledger_sum'))
            ->groupBy('medicine_batch_id')
            ->pluck('ledger_sum', 'medicine_batch_id');

        $mismatches = [];

        MedicineBatch::query()
            ->select('id', 'medicine_id', 'batch_no', 'quantity_available')
            ->orderBy('id')
            ->chunkById(500, function ($batches) use ($ledgerSums, &$mismatches): void {
                foreach ($batches as $batch) {
                    $expected = (int) ($ledgerSums[$batch->id] ?? 0);
                    $actual = (int) $batch->quantity_available;

                    if ($expected !== $actual) {
                        $mismatches[] = [
                            'batch_id' => $batch->id,
                            'medicine_id' => $batch->medicine_id,
                            'batch_no' => $batch->batch_no,
                            'expected' => $expected,
                            'actual' => $actual,
                        ];
                    }
                }
            });

        if ($mismatches === []) {
            $this->info('stock:verify — clean. Every batch balance matches its ledger.');

            return self::SUCCESS;
        }

        $this->error(sprintf('stock:verify — %d mismatch(es) found:', count($mismatches)));

        $this->table(
            ['Batch ID', 'Medicine ID', 'Batch No', 'Expected (ledger sum)', 'Actual (quantity_available)'],
            array_map(
                static fn (array $row): array => [
                    $row['batch_id'],
                    $row['medicine_id'],
                    $row['batch_no'],
                    $row['expected'],
                    $row['actual'],
                ],
                $mismatches,
            ),
        );

        return self::FAILURE;
    }
}
