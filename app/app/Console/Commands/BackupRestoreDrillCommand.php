<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

/**
 * `backup:restore-drill {file}` — the executable form of brain/09-deployment.md §6's
 * cave law:
 *
 * > **An untested backup is not a backup. It is a file.** ... A "yes we have backups"
 * > without a recorded drill means the shop currently has no backup, and that is the
 * > finding.
 *
 * This command restores a given `pg_dump -Fc` dump into a disposable, clearly-named
 * database (`_restore_drill_test`), runs `stock:verify` against it as a content
 * sanity check (cave law 7 — if the ledger doesn't balance in the restored copy,
 * something is wrong with either the dump or the restore), then drops the throwaway
 * database and reports pass/fail.
 *
 * STAGING/TEST ONLY. brain/09 §1 and §6 are explicit that the drill runs on staging
 * or a spare machine, never against production — "restoring onto the production box
 * to check the backup is how a good backup becomes a bad afternoon." This command
 * refuses to run when `app.env` is `production` unless `--force` is passed, and even
 * then it never touches the live database — it only ever creates/drops the
 * `_restore_drill_test` database, so a forced run is a database-name-collision risk
 * at worst, not a data-loss one. Still: don't force it. Run this on staging.
 *
 * What this command does NOT do (documented, not silently skipped): decrypt an
 * `age`-encrypted dump (brain/09 §6 step 2), or the manual eyeball checks brain/09
 * §6 steps 7–8 ask a human to do (open the restored system, ring a test sale in the
 * POS, print it). `stock:verify` passing is necessary evidence the restore is sound,
 * not sufficient evidence the drill is complete — a human still has to do those two
 * steps and record the result, per brain/09 §6.
 */
class BackupRestoreDrillCommand extends Command
{
    protected $signature = 'backup:restore-drill {file : Path to a pg_dump -Fc dump file} {--force : Allow running with app.env=production; still never touches the live database}';

    protected $description = 'Restore a backup dump into a throwaway database, run stock:verify against it, then drop it. Staging/test use only.';

    private const DRILL_DATABASE = '_restore_drill_test';

    public function handle(): int
    {
        $file = $this->argument('file');

        if (! is_file($file)) {
            $this->error("Dump file not found: {$file}");

            return self::FAILURE;
        }

        if (app()->environment('production') && ! $this->option('force')) {
            $this->error(
                'Refusing to run on app.env=production without --force. '.
                'brain/09-deployment.md §6: run the restore drill on staging or a spare '.
                'machine, not on the production box. This command never writes to the '.
                'live database, but it still is not meant to be normal on prod.'
            );

            return self::FAILURE;
        }

        $this->info("Restore drill starting against dump: {$file}");

        // 1. Drop then create the throwaway database, so a leftover from a
        //    previous failed drill never silently poisons this run.
        $this->runProcess(['dropdb', '--if-exists', self::DRILL_DATABASE], allowFailure: true);
        $this->runProcess(['createdb', self::DRILL_DATABASE]);

        // 2. pg_restore the dump into it.
        try {
            $this->runProcess([
                'pg_restore',
                '-d', self::DRILL_DATABASE,
                '--no-owner',
                '--clean',
                '--if-exists',
                $file,
            ]);
        } catch (ProcessFailedException $e) {
            Log::error('backup:restore-drill failed at pg_restore.', ['file' => $file, 'error' => $e->getMessage()]);
            $this->error('pg_restore failed — this dump does NOT pass the drill. See brain/09 §6.');
            $this->runProcess(['dropdb', '--if-exists', self::DRILL_DATABASE], allowFailure: true);

            return self::FAILURE;
        }

        // 3. Point a second connection at the restored database and run
        //    stock:verify against it (cave law 7) rather than against the app's
        //    normal `pgsql` connection.
        config(['database.connections.pgsql_restore_drill' => array_merge(
            config('database.connections.pgsql', []),
            ['database' => self::DRILL_DATABASE],
        )]);

        $verifyExitCode = Artisan::call('stock:verify', [
            '--database' => 'pgsql_restore_drill',
        ]);
        $verifyOutput = Artisan::output();
        $this->line($verifyOutput);

        // 4. Always drop the throwaway database, pass or fail — it must never
        //    linger and be mistaken for a real database.
        $this->runProcess(['dropdb', '--if-exists', self::DRILL_DATABASE], allowFailure: true);

        if ($verifyExitCode !== self::SUCCESS) {
            Log::error('backup:restore-drill: stock:verify failed against the restored copy.', ['file' => $file]);
            $this->error('FAIL: dump restored, but stock:verify found ledger drift in the restored copy. This dump does NOT pass the drill.');

            return self::FAILURE;
        }

        Log::info('backup:restore-drill passed.', ['file' => $file]);
        $this->info('PASS: dump restored cleanly and stock:verify agrees on the restored copy.');
        $this->warn(
            'Remember brain/09 §6 steps 7-8 are NOT covered by this command: a human still '.
            'has to open the restored system, ring and print a test sale, and record the '.
            'drill result. This command is evidence, not the whole drill.'
        );

        return self::SUCCESS;
    }

    /**
     * @param list<string> $command
     */
    private function runProcess(array $command, bool $allowFailure = false): void
    {
        $process = new Process($command);
        $process->setTimeout(1800);
        $process->run();

        if (! $allowFailure && ! $process->isSuccessful()) {
            throw new ProcessFailedException($process);
        }
    }
}
