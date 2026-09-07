<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Payments against a sale (split tender) or a purchase, plus refunds recorded as
     * negative amounts on the same table (brain/02 §4.4). Cave law 8: append-only, a
     * refund is a NEW negative row, never an edit of the original payment.
     */
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sale_id')->nullable()->constrained('sales')->restrictOnDelete();
            $table->foreignId('purchase_id')->nullable()->constrained('purchases')->restrictOnDelete();
            // Negative for a refund. Never zero.
            $table->decimal('amount', 12, 2);
            $table->string('mode', 20);
            $table->string('reference_no', 60)->nullable();
            $table->timestampTz('paid_at');
            $table->timestamps();

            $table->index('sale_id');
            $table->index('purchase_id');
        });

        DB::statement(
            "ALTER TABLE payments ADD CONSTRAINT payments_mode_check "
            . "CHECK (mode IN ('cash', 'card', 'upi', 'credit'))"
        );

        DB::statement('ALTER TABLE payments ADD CONSTRAINT payments_amount_nonzero_check CHECK (amount <> 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
