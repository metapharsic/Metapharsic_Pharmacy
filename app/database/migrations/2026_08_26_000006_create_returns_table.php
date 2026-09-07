<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Sales returns — stock coming back from a customer (brain/02 §4.5). ADR-0005: a
     * return never edits the original sale/sale_items; it is a new set of rows.
     */
    public function up(): void
    {
        Schema::create('returns', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->restrictOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->date('return_date');
            $table->decimal('total_refund', 12, 2);
            $table->text('reason')->nullable();
            $table->timestamps();

            $table->index('sale_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('returns');
    }
};
