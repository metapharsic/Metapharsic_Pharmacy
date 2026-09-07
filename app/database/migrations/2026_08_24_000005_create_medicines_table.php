<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cave law 3: a medicine is the IDEA of a medicine — name, HSN, gst_rate, Rx flag,
     * min_stock_level, barcode. It holds no quantity, no expiry, no stock price. Those
     * live on `medicine_batches` (Phase 3). Do not add a quantity/expiry column here.
     */
    public function up(): void
    {
        Schema::create('medicines', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 180);
            $table->string('generic_name', 180)->nullable();
            $table->string('brand', 120)->nullable();
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->foreignId('manufacturer_id')->nullable()->constrained('manufacturers')->nullOnDelete();
            $table->string('unit', 20);
            $table->integer('pack_size')->default(1);
            $table->string('hsn_code', 10)->nullable();
            $table->decimal('gst_rate', 5, 2)->default(0);
            $table->decimal('default_purchase_price', 12, 2)->nullable();
            $table->decimal('default_selling_price', 12, 2)->nullable();
            $table->integer('min_stock_level')->default(0);
            $table->string('rack_location', 40)->nullable();
            $table->boolean('is_prescription_required')->default(false);
            $table->string('barcode', 64)->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('name');
            $table->index('generic_name');
        });

        // barcode: unique only when not null (partial unique index) — brain/02-database-schema.md.
        DB::statement(
            'CREATE UNIQUE INDEX medicines_barcode_unique ON medicines (barcode) WHERE barcode IS NOT NULL'
        );

        // G2.5: GST slab and pack-size invariants enforced at the database, not application
        // validation alone (brain/phases/phase-2-master-data.md, T-0202a).
        DB::statement(
            "ALTER TABLE medicines ADD CONSTRAINT medicines_gst_rate_check CHECK (gst_rate IN (0, 5, 12, 18))"
        );
        DB::statement(
            'ALTER TABLE medicines ADD CONSTRAINT medicines_pack_size_check CHECK (pack_size > 0)'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('medicines');
    }
};
