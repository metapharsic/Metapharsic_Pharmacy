<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\ShopLicense;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * `license:check-expiry` — scheduled daily (routes/console.php) per
 * brain/11-gap-closure-architecture.md §6, Phase 8e / Gap 5. Flags active
 * shop_licenses within the 60/30/7-day renewal windows of expires_on, and
 * separately flags any already expired, via Log::warning. Deliberately
 * simple — no external notification integration, just structured log
 * output a dashboard banner or ops process can read.
 */
final class CheckLicenseExpiry extends Command
{
    protected $signature = 'license:check-expiry';

    protected $description = 'Log a warning for shop licenses expired or nearing expiry (60/30/7-day windows).';

    public function handle(): int
    {
        $licenses = ShopLicense::query()->active()->get();

        $expiredCount = 0;
        $flaggedCount = 0;

        foreach ($licenses as $license) {
            $days = $license->daysUntilExpiry();

            if ($days < 0) {
                $expiredCount++;
                Log::warning(sprintf(
                    'Shop license EXPIRED: type=%s number=%s expired %d day(s) ago.',
                    $license->license_type,
                    $license->license_number,
                    abs($days),
                ));

                continue;
            }

            if ($days <= 7) {
                $flaggedCount++;
                Log::warning(sprintf(
                    'Shop license expiring URGENTLY (<=7 days): type=%s number=%s expires in %d day(s).',
                    $license->license_type,
                    $license->license_number,
                    $days,
                ));
            } elseif ($days <= 30) {
                $flaggedCount++;
                Log::warning(sprintf(
                    'Shop license expiring soon (<=30 days): type=%s number=%s expires in %d day(s).',
                    $license->license_type,
                    $license->license_number,
                    $days,
                ));
            } elseif ($days <= 60) {
                $flaggedCount++;
                Log::warning(sprintf(
                    'Shop license approaching renewal window (<=60 days): type=%s number=%s expires in %d day(s).',
                    $license->license_type,
                    $license->license_number,
                    $days,
                ));
            }
        }

        $this->info("license:check-expiry — {$expiredCount} expired, {$flaggedCount} within renewal window.");

        return self::SUCCESS;
    }
}
