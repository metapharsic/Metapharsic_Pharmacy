<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Snapshots which scheme (if any) drove a sale line's discount, and how much of the
     * line's total `discount` came from that scheme vs a manual/cashier-entered discount
     * (cave law 6 spirit — snapshot at sale time, never recompute later).
     *
     * nullOnDelete on discount_scheme_id deliberately: a scheme can later be edited or
     * deactivated without breaking historical sale_items rows referencing it.
     */
    public function up(): void
    {
        Schema::table('sale_items', function (Blueprint $table): void {
            $table->foreignId('discount_scheme_id')->nullable()->after('discount')
                ->constrained('discount_schemes')->nullOnDelete();
            $table->decimal('scheme_discount_amount', 12, 2)->nullable()->after('discount_scheme_id');
        });
    }

    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('discount_scheme_id');
            $table->dropColumn('scheme_discount_amount');
        });
    }
};
