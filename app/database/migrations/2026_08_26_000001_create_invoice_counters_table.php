<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * ADR-0006: the one row every invoice number is allocated from, under a row lock,
     * last, inside the sale transaction (ADR-0007 rule 1). Nothing else touches this row.
     */
    public function up(): void
    {
        Schema::create('invoice_counters', function (Blueprint $table): void {
            $table->id();
            $table->string('series', 10);
            $table->string('financial_year', 5);
            $table->integer('last_number')->default(0);
            $table->timestamps();

            // The row the lock in InvoiceService::nextInvoiceNumber() is taken on.
            $table->unique(['series', 'financial_year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_counters');
    }
};
