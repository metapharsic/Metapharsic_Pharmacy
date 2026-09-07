<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The single append-only stock ledger (ADR-0003). Every quantity change in the system,
     * from every source, is exactly one row here, written by `InventoryService` alongside
     * the `medicine_batches.quantity_available` update it explains — cave laws 1 and 7.
     *
     * NOTE — deliberately NOT done in this migration: ADR-0003 / brain/02-database-schema.md
     * §9 call for a `BEFORE UPDATE OR DELETE` PostgreSQL trigger (`forbid_mutation()`) on
     * this table, blocking any UPDATE/DELETE at the database level. That trigger is real
     * business logic living in the database and belongs in a dedicated hardening migration
     * reviewed on its own, not bundled into the table's creation. Phase 3 does not require
     * it to function: application discipline (only `InventoryService` ever writes here, and
     * only via INSERT) plus `stock:verify` are sufficient for this phase's exit gate. Track
     * adding the trigger as a follow-up before Phase 3 is considered hardened for production.
     */
    public function up(): void
    {
        Schema::create('stock_transactions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('medicine_id')->constrained('medicines')->restrictOnDelete();
            $table->foreignId('medicine_batch_id')->constrained('medicine_batches')->restrictOnDelete();
            $table->string('type', 24);
            $table->integer('quantity_change');
            $table->integer('balance_after');
            $table->string('reference_type', 120)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note')->nullable();
            // Append-only ledger row (brain/02-database-schema.md §9): created_at only,
            // deliberately no updated_at — the row is immutable by design.
            $table->timestamp('created_at')->useCurrent();

            $table->index(['medicine_batch_id', 'created_at']);
            $table->index(['reference_type', 'reference_id']);
        });

        DB::statement(
            "ALTER TABLE stock_transactions ADD CONSTRAINT stock_transactions_type_check "
            . "CHECK (type IN ('purchase', 'sale', 'sale_return', 'purchase_return', "
            . "'adjustment_add', 'adjustment_remove', 'expiry_writeoff', 'opening_stock'))"
        );

        DB::statement(
            'ALTER TABLE stock_transactions ADD CONSTRAINT stock_transactions_quantity_change_check '
            . 'CHECK (quantity_change <> 0)'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_transactions');
    }
};
