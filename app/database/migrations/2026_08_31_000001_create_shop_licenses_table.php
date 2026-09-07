<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Shop-level Drug License (DL) records — Phase 8e / Gap 5
     * (brain/11-gap-closure-architecture.md §6). This is the pharmacy's OWN retail
     * DL (e.g. India Schedule H/H1 categories 'retail_dl_20', 'retail_dl_21'), not
     * a per-medicine field and not the unrelated supplier drug_license_no column
     * on the suppliers table. A pharmacy can hold more than one DL category
     * concurrently, so this supports multiple rows rather than a single settings
     * field.
     *
     * Pure master/compliance data — no stock or sale interaction whatsoever
     * (cave law interaction: none, per the architecture doc).
     */
    public function up(): void
    {
        Schema::create('shop_licenses', function (Blueprint $table): void {
            $table->id();
            $table->string('license_type'); // e.g. 'retail_dl_20', 'retail_dl_21'
            $table->string('license_number');
            $table->date('issued_on');
            $table->date('expires_on');
            $table->string('issuing_authority')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('expires_on');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shop_licenses');
    }
};
