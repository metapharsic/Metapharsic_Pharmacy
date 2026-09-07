<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One row per (sale line x batch slice) — a FEFO split writes several rows for one
     * visible invoice line (brain/02 §4.4).
     *
     * Cave law 6: `cost_price_at_sale` is a SNAPSHOT of the batch's cost at the moment of
     * sale. Every profit query reads this column and this column only — never a live join
     * back to `medicine_batches` for cost, because a slab or price change must not rewrite
     * a bill that already left the shop.
     */
    public function up(): void
    {
        Schema::create('sale_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->restrictOnDelete();
            $table->foreignId('medicine_id')->constrained('medicines')->restrictOnDelete();
            // Not nullable — a return must know exactly which physical batch to restore to.
            $table->foreignId('medicine_batch_id')->constrained('medicine_batches')->restrictOnDelete();
            $table->integer('quantity');
            $table->decimal('unit_price', 12, 2);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('gst_rate', 4, 2);
            $table->decimal('gst_amount', 12, 2)->default(0);
            $table->decimal('line_total', 12, 2);
            // Cave law 6: never recomputed, never joined live to the batch for profit.
            $table->decimal('cost_price_at_sale', 12, 2);
            $table->integer('returned_quantity')->default(0);
            $table->timestamps();

            $table->index('sale_id');
            $table->index('medicine_batch_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_items');
    }
};
