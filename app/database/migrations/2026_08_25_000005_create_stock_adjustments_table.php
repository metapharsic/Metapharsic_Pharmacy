<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The reason record behind a manual stock movement (admin only). An adjustment is never
     * itself the door to stock — `StockAdjustmentService`/controller calls `InventoryService`
     * with type `adjustment_add` or `adjustment_remove`, referencing this row.
     */
    public function up(): void
    {
        Schema::create('stock_adjustments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('medicine_batch_id')->constrained('medicine_batches')->restrictOnDelete();
            $table->integer('quantity_change');
            $table->string('reason', 30);
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->text('note')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('medicine_batch_id');
        });

        DB::statement(
            "ALTER TABLE stock_adjustments ADD CONSTRAINT stock_adjustments_reason_check "
            . "CHECK (reason IN ('damaged', 'expired', 'theft', 'counting_error', 'sample', 'opening_stock'))"
        );

        DB::statement(
            'ALTER TABLE stock_adjustments ADD CONSTRAINT stock_adjustments_quantity_change_check '
            . 'CHECK (quantity_change <> 0)'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_adjustments');
    }
};
