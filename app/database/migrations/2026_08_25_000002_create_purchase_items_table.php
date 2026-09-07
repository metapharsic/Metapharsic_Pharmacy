<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One line of a supplier invoice — stock IN, before it becomes a batch. On confirm,
     * `PurchaseService` finds-or-creates the `medicine_batches` row keyed on
     * (medicine_id, batch_no, expiry_date) and copies `effective_cost` there (DR-FREE-03).
     */
    public function up(): void
    {
        Schema::create('purchase_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('purchase_id')->constrained('purchases')->cascadeOnDelete();
            $table->foreignId('medicine_id')->constrained('medicines')->restrictOnDelete();
            $table->string('batch_no', 60);
            $table->date('expiry_date');
            $table->integer('quantity');
            $table->integer('free_quantity')->default(0);
            $table->decimal('purchase_price', 12, 2);
            $table->decimal('mrp', 12, 2);
            $table->decimal('selling_price', 12, 2);
            $table->decimal('gst_rate', 4, 2)->default(0);
            $table->decimal('line_total', 12, 2);
            $table->timestamps();

            $table->index(['medicine_id', 'batch_no', 'expiry_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_items');
    }
};
