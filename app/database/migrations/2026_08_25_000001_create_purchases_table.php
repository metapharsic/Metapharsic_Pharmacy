<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A supplier invoice. Only `confirmed` has moved stock (brain/02-database-schema.md §4.3).
     * No soft delete: a wrong purchase is cancelled with reversing stock transactions, never
     * deleted. A `draft` purchase has touched no stock and is the one exception that may be
     * deleted outright by application code, not by this schema.
     */
    public function up(): void
    {
        Schema::create('purchases', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('supplier_id')->constrained('suppliers')->restrictOnDelete();
            $table->string('invoice_no', 60);
            $table->date('invoice_date');
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('gst_amount', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('due_amount', 12, 2)->default(0);
            $table->string('status', 20)->default('draft');
            $table->timestamps();

            // Same supplier bill must not be entered twice — the classic cause of doubled stock.
            $table->unique(['supplier_id', 'invoice_no']);
        });

        DB::statement(
            "ALTER TABLE purchases ADD CONSTRAINT purchases_status_check "
            . "CHECK (status IN ('draft', 'confirmed', 'cancelled'))"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('purchases');
    }
};
