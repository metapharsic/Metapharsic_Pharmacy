<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One row per returned sale_item slice. `medicine_batch_id` is always the SAME batch
     * the original sale_item drew from (DR-RET rule, T-0408b) — never the current
     * FEFO-nearest batch. Quantity is capped in ReturnService, under lock, against
     * `sale_item.quantity - sale_item.returned_quantity`.
     */
    public function up(): void
    {
        Schema::create('return_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('return_id')->constrained('returns')->cascadeOnDelete();
            $table->foreignId('sale_item_id')->constrained('sale_items')->restrictOnDelete();
            $table->foreignId('medicine_batch_id')->constrained('medicine_batches')->restrictOnDelete();
            $table->integer('quantity');
            $table->decimal('refund_amount', 12, 2);
            $table->timestamps();

            $table->index('sale_item_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('return_items');
    }
};
