<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * daily_sales_summary — precomputed daily cache table.
 *
 * Per brain/01-architecture.md §6 (dashboard caching strategy) and ADR-0007 /
 * CONFLICT-001's resolution: no Redis on the shop LAN, so the 30-day chart and
 * month-to-date tiles are backed by this summary table instead of a live scan
 * of sale_items. Written ONLY by `summary:rebuild` (see
 * RebuildDailySummaryCommand). This table is derived data — it holds no truth
 * of its own and may be truncated and rebuilt at any time without loss.
 *
 * Cave law 8 (sales are stone) does not apply to this table: it is not a sale,
 * it is a cache of sales, and an upsert here is expected and idempotent.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_sales_summary', function (Blueprint $table): void {
            $table->id();
            $table->date('summary_date')->unique();
            $table->decimal('total_sales', 12, 2)->default(0);
            $table->decimal('total_purchases', 12, 2)->default(0);
            $table->decimal('total_profit', 12, 2)->default(0);
            $table->integer('bill_count')->default(0);
            $table->timestampTz('generated_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_sales_summary');
    }
};
