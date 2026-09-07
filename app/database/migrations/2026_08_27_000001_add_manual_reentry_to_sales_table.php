<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Manual-fallback support (ops/MANUAL_FALLBACK.md): when the LAN server is
 * down mid-day, staff bill on paper and re-enter every sale once it's back.
 * Cave law 8 still applies — a manual re-entry is a normal, immutable Sale
 * row, just tagged so end-of-day reconciliation can find it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table): void {
            $table->boolean('is_manual_reentry')->default(false)->after('status');
            $table->text('note')->nullable()->after('is_manual_reentry');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table): void {
            $table->dropColumn(['is_manual_reentry', 'note']);
        });
    }
};
