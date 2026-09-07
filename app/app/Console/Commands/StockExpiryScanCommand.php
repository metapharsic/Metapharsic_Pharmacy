<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Events\BatchNearingExpiry;
use App\Models\MedicineBatch;
use Carbon\Carbon;
use Illuminate\Console\Command;

/**
 * `expiry:scan` — scheduled 06:00 daily (Asia/Kolkata) per
 * brain/01-architecture.md §5. Finds sellable batches expiring within 30
 * days and dispatches BatchNearingExpiry for each — a documented stub in
 * this phase; the real supplier-return worklist listener lands later.
 *
 * The full command per brain/01 also moves past-expiry batches to status
 * `expired` and refreshes the 90-day window; only the 30-day notification
 * dispatch is implemented here per this task's scope.
 */
final class StockExpiryScanCommand extends Command
{
    protected $signature = 'expiry:scan';

    protected $description = 'Find batches expiring within 30 days and dispatch BatchNearingExpiry.';

    public function handle(): int
    {
        $cutoff = Carbon::today()->addDays(30)->toDateString();

        $batches = MedicineBatch::query()
            ->where('status', 'available')
            ->whereDate('expiry_date', '>', Carbon::today()->toDateString())
            ->whereDate('expiry_date', '<=', $cutoff)
            ->get(['id']);

        foreach ($batches as $batch) {
            BatchNearingExpiry::dispatch($batch->id);
        }

        $this->info("expiry:scan — {$batches->count()} batch(es) within 30 days of expiry.");

        return self::SUCCESS;
    }
}
