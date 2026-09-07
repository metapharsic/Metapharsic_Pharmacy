<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

/**
 * `backup:run` — nightly `pg_dump` per brain/09-deployment.md §5/§6, scheduled 02:00
 * Asia/Kolkata in routes/console.php.
 *
 * > **Cave law (brain/09 §6): an untested backup is not a backup. It is a file.**
 * > This command only produces the file, prunes old ones, and logs the outcome. It
 * > proves NOTHING about whether the dump actually restores. That proof is the
 * > quarterly restore drill — see BackupRestoreDrillCommand — and brain/09 §6 is
 * > explicit that the drill must run on staging/a spare machine, never on production,
 * > because "restoring onto the production box to check the backup is how a good
 * > backup becomes a bad afternoon."
 *
 * brain/09 also describes encryption (`age`) and an off-machine copy (NAS/USB) as
 * part of the full nightly job. This command deliberately does NOT implement those
 * two steps — they need real credentials/hardware this scaffold has no way to test
 * against — and says so loudly below rather than silently doing a partial job. Wire
 * them in before relying on this in production; until then treat local-only pg_dump
 * output as a stopgap, not brain/09's full backup story.
 *
 * No external backup package is used (composer is unavailable in this offline
 * scaffold environment) — this shells out to `pg_dump` directly via Symfony
 * Process, which Laravel already depends on.
 */
class BackupRunCommand extends Command
{
    protected $signature = 'backup:run';

    protected $description = 'Dump the production database with pg_dump, prune backups older than the retention window, and log the outcome.';

    public function handle(): int
    {
        $backupPath = config('pharmacy.backup_path', storage_path('app/backups'));
        $retentionDays = (int) config('pharmacy.backup_retention_days', 30);

        if (! is_dir($backupPath)) {
            // 0750: backups contain patient-identifying sale/customer data: not
            // world-readable, matching brain/09's "no internet exposure, local
            // socket only" posture for the box that holds them.
            mkdir($backupPath, 0750, true);
        }

        $database = config('database.connections.pgsql.database');
        $filename = sprintf('metapharsic-%s.dump', now('Asia/Kolkata')->format('Y-m-d'));
        $fullPath = rtrim($backupPath, '/').'/'.$filename;

        // -Fc: custom format, compressed, restorable with pg_restore (matches the
        // format brain/09 §6 documents and BackupRestoreDrillCommand expects).
        $process = new Process([
            'pg_dump',
            '-Fc',
            '--no-owner',
            '--file='.$fullPath,
            $database,
        ]);
        $process->setTimeout(3600);

        try {
            $process->mustRun();
        } catch (ProcessFailedException $e) {
            Log::error('backup:run failed: pg_dump did not complete.', [
                'database' => $database,
                'target' => $fullPath,
                'error' => $e->getMessage(),
            ]);
            $this->error('Backup failed — see log. Owner must be alerted per brain/09-deployment.md §5.');

            return self::FAILURE;
        }

        $bytes = @filesize($fullPath) ?: 0;

        Log::info('backup:run succeeded.', [
            'database' => $database,
            'target' => $fullPath,
            'bytes' => $bytes,
        ]);
        $this->info(sprintf('Backup written: %s (%s bytes).', $fullPath, number_format($bytes)));

        $pruned = $this->pruneOldBackups($backupPath, $retentionDays);
        if ($pruned > 0) {
            Log::info('backup:run pruned old backups.', ['count' => $pruned, 'retention_days' => $retentionDays]);
            $this->info(sprintf('Pruned %d backup(s) older than %d days.', $pruned, $retentionDays));
        }

        $this->warn('Reminder (brain/09 §6): this dump is untested until a restore drill has run against it. See BackupRestoreDrillCommand.');

        return self::SUCCESS;
    }

    /**
     * Delete *.dump files older than the retention window. Deliberately simple —
     * brain/09 §6 also asks to keep the first dump of each month indefinitely; that
     * refinement is out of scope here and should be added before this is treated as
     * the final retention policy.
     */
    private function pruneOldBackups(string $backupPath, int $retentionDays): int
    {
        $cutoff = now('Asia/Kolkata')->subDays($retentionDays)->getTimestamp();
        $pruned = 0;

        foreach (glob(rtrim($backupPath, '/').'/*.dump') ?: [] as $file) {
            if (filemtime($file) !== false && filemtime($file) < $cutoff) {
                @unlink($file);
                $pruned++;
            }
        }

        return $pruned;
    }
}
