<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Console Routes — Laravel 12 schedule (routes/console.php)
|--------------------------------------------------------------------------
|
| Laravel 12 moved schedule definitions out of the old
| App\Console\Kernel::schedule() into this file's `Schedule` facade. The
| server side of this is unchanged from brain/09-deployment.md §5: a single
| cron entry runs the scheduler every minute —
|
|   * * * * * metapharsic cd /var/www/metapharsic/current && php artisan schedule:run >> /dev/null 2>&1
|
| — and Laravel decides, minute by minute, which of the jobs below are
| actually due. All times are Asia/Kolkata (brain/09 §5 table), matching
| config/app.php's `timezone`.
|
| No Redis on this box (brain/01-architecture.md §6) — none of these jobs
| depend on a queue or a cache store beyond the file/database cache already
| used elsewhere, so `withoutOverlapping()` (file-based mutex) is enough to
| stop two runs stacking if one job overruns its minute.
*/

use Illuminate\Support\Facades\Schedule;

// stock:verify — cave law 7, ADR-0003, G3.3. Nightly ledger-vs-balance
// check with no --fix flag; drift here means someone paged, not silently
// patched. brain/09 §5: on failure, email the owner.
Schedule::command('stock:verify')
    ->dailyAt('06:00')
    ->timezone('Asia/Kolkata')
    ->withoutOverlapping()
    ->onFailure(function (): void {
        \Illuminate\Support\Facades\Log::error('stock:verify failed — see brain/09-deployment.md §5, owner alert required.');
    });

// summary:rebuild — the only writer of daily_sales_summary (Phase 5). Runs
// for "yesterday" so the dashboard's prior-day tiles are cheap reads all
// day, per brain/01 §6 (no Redis).
Schedule::command('summary:rebuild')
    ->dailyAt('00:15')
    ->timezone('Asia/Kolkata')
    ->withoutOverlapping();

// expiry:scan — fires BatchNearingExpiry for batches crossing the alert
// threshold (Phase 5). Runs after summary:rebuild so both jobs land in the
// same quiet overnight window without contending for the same tables.
Schedule::command('expiry:scan')
    ->dailyAt('07:00')
    ->timezone('Asia/Kolkata')
    ->withoutOverlapping();

// backup:run — brain/09 §5/§6. pg_dump, prune >30 days, log outcome.
//
// Cave law (brain/09 §6): "an untested backup is not a backup. It is a
// file." This schedule entry only produces the file; it does not prove
// the file restores. See BackupRestoreDrillCommand and run the quarterly
// drill described in brain/09-deployment.md §6 against staging — never
// against production.
Schedule::command('backup:run')
    ->dailyAt('02:00')
    ->timezone('Asia/Kolkata')
    ->withoutOverlapping()
    ->onFailure(function (): void {
        \Illuminate\Support\Facades\Log::error('backup:run failed — see brain/09-deployment.md §5, owner alert required (one of the four things that must email the owner).');
    });

// license:check-expiry — Phase 8e / Gap 5 (brain/11-gap-closure-architecture.md
// §6). Flags shop_licenses within the 60/30/7-day renewal windows, or already
// expired, via Log::warning. Runs in the same overnight window as the other
// daily jobs; no queue/cache dependency, withoutOverlapping() is enough.
Schedule::command('license:check-expiry')
    ->dailyAt('07:15')
    ->timezone('Asia/Kolkata')
    ->withoutOverlapping();
