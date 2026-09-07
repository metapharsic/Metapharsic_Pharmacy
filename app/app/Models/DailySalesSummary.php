<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

/**
 * One row per calendar day (Asia/Kolkata). Derived/cache data — see
 * database/migrations/..._create_daily_sales_summary_table.php.
 *
 * Written only by App\Console\Commands\RebuildDailySummaryCommand via an
 * idempotent upsert on `summary_date`. Nothing else may write this table.
 *
 * @property \Illuminate\Support\Carbon $summary_date
 * @property string $total_sales
 * @property string $total_purchases
 * @property string $total_profit
 * @property int $bill_count
 * @property \Illuminate\Support\Carbon $generated_at
 */
final class DailySalesSummary extends Model
{
    protected $table = 'daily_sales_summary';

    protected $fillable = [
        'summary_date',
        'total_sales',
        'total_purchases',
        'total_profit',
        'bill_count',
        'generated_at',
    ];

    protected function casts(): array
    {
        return [
            'summary_date' => 'date',
            'total_sales' => 'decimal:2',
            'total_purchases' => 'decimal:2',
            'total_profit' => 'decimal:2',
            'bill_count' => 'integer',
            'generated_at' => 'datetime',
        ];
    }
}
