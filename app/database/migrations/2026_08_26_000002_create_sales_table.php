<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The GST tax invoice (brain/02-database-schema.md §4.4, ADR-0005, ADR-0006).
     *
     * Cave law 8: sales are stone. No UPDATE of quantity/price/total after commit, no
     * DELETE ever. The only columns a Service may ever touch post-commit are `status`,
     * `payment_status`, `paid`, `due` — via SalesService::cancelSale(), never a raw update.
     */
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table): void {
            $table->id();
            $table->string('invoice_no', 30)->unique();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->restrictOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->date('sale_date');
            $table->decimal('subtotal', 12, 2);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('gst_amount', 12, 2)->default(0);
            // DR-GST-08: absorbs the whole-rupee rounding, never lets a line be nudged.
            $table->decimal('round_off', 12, 2)->default(0);
            $table->decimal('total', 12, 2);
            $table->decimal('paid', 12, 2)->default(0);
            $table->decimal('due', 12, 2)->default(0);
            $table->string('payment_status', 20);
            $table->string('status', 24)->default('completed');
            $table->timestamps();

            $table->index('sale_date');
            $table->index(['status', 'sale_date']);
        });

        DB::statement(
            "ALTER TABLE sales ADD CONSTRAINT sales_payment_status_check "
            . "CHECK (payment_status IN ('paid', 'partial', 'unpaid', 'refunded'))"
        );

        DB::statement(
            "ALTER TABLE sales ADD CONSTRAINT sales_status_check "
            . "CHECK (status IN ('completed', 'cancelled', 'partially_returned'))"
        );

        DB::statement(
            'ALTER TABLE sales ADD CONSTRAINT sales_amounts_check '
            . 'CHECK (subtotal >= 0 AND discount >= 0 AND discount <= subtotal AND total >= 0)'
        );

        // DR-GST-08: round_off is the only place the rupee-rounding residue may live.
        DB::statement(
            'ALTER TABLE sales ADD CONSTRAINT sales_round_off_check '
            . 'CHECK (round_off >= -0.50 AND round_off <= 0.50)'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('sales');
    }
};
