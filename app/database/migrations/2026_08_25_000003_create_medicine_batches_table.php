<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The physical box on the shelf (brain/02-database-schema.md §4.2).
     *
     * Cave law 1: `quantity_available` is written ONLY by `InventoryService`, and only
     * alongside a `stock_transactions` row. No other migration, seeder, or controller may
     * update this column directly.
     *
     * Cave law 4: FEFO orders by `expiry_date ASC` inside a `SELECT ... FOR UPDATE`. The
     * composite index on (medicine_id, expiry_date) exists so that ordering has a plan,
     * not a sequential scan, under lock.
     */
    public function up(): void
    {
        Schema::create('medicine_batches', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('medicine_id')->constrained('medicines')->restrictOnDelete();
            $table->string('batch_no', 60);
            $table->date('expiry_date');
            $table->decimal('purchase_price', 12, 2);
            $table->decimal('selling_price', 12, 2);
            $table->decimal('mrp', 12, 2);
            // Cave law 5: true per-unit cost = net taxable line cost / (quantity + free_quantity).
            // This, not purchase_price, is what gets snapshotted onto sale_items.cost_price_at_sale.
            $table->decimal('effective_cost', 12, 2);
            $table->integer('quantity_received');
            $table->integer('quantity_available');
            $table->string('status', 20)->default('available');
            $table->foreignId('purchase_item_id')->nullable()->constrained('purchase_items')->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->timestamps();

            // The central integrity rule of the inventory (brain/02-database-schema.md §6):
            // the same physical batch received twice lands in one row whose quantity is
            // added to, never in two rows that split stock and defeat FEFO.
            $table->unique(['medicine_id', 'batch_no', 'expiry_date']);

            $table->index('expiry_date');
            $table->index(['medicine_id', 'expiry_date']);
        });

        DB::statement(
            "ALTER TABLE medicine_batches ADD CONSTRAINT medicine_batches_status_check "
            . "CHECK (status IN ('available', 'expired', 'finished', 'quarantined'))"
        );

        // Backstop for cave law 7: even if the ledger ever drifted, the balance column
        // itself can never go negative at the database level.
        DB::statement(
            'ALTER TABLE medicine_batches ADD CONSTRAINT medicine_batches_quantity_available_check '
            . 'CHECK (quantity_available >= 0)'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('medicine_batches');
    }
};
