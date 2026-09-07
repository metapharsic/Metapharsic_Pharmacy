<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Spatial pharmacy storage layout: Zones, Racks, Shelves, Bins.
     * Enforces clinical temperature classes, narcotic vault physical segregation,
     * and precision picking coordinates for high-velocity POS sales deduction.
     */
    public function up(): void
    {
        // 1. Storage Zones (Dispensary, Cold Chain, Narcotic Vault, Bulk)
        Schema::create('storage_zones', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 100);
            $table->string('code', 30)->unique();
            $table->string('temperature_type', 40)->default('ambient_15_25'); // ambient_15_25, cold_2_8, frozen, controlled
            $table->boolean('humidity_controlled')->default(false);
            $table->string('description', 255)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // 2. Physical Racks & Storage Units
        Schema::create('racks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('storage_zone_id')->constrained('storage_zones')->restrictOnDelete();
            $table->string('rack_code', 30)->unique();
            $table->string('name', 120);
            $table->string('aisle', 20)->nullable();
            $table->integer('row_number')->nullable();
            $table->integer('column_number')->nullable();
            $table->integer('total_shelves')->default(5);
            $table->integer('max_capacity_boxes')->default(500);
            $table->string('status', 20)->default('active');
            $table->timestamps();
        });

        // 3. Rack Shelves
        Schema::create('rack_shelves', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('rack_id')->constrained('racks')->cascadeOnDelete();
            $table->integer('shelf_number');
            $table->string('shelf_code', 40)->unique();
            $table->integer('capacity_units')->default(100);
            $table->string('notes', 150)->nullable();
            $table->timestamps();

            $table->unique(['rack_id', 'shelf_number']);
        });

        // 4. Rack Bins / Dividers
        Schema::create('rack_bins', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('rack_shelf_id')->constrained('rack_shelves')->cascadeOnDelete();
            $table->string('bin_code', 40)->unique();
            $table->string('name', 80)->nullable();
            $table->timestamps();
        });

        // 5. Add Location & Climate mapping to Medicines table
        Schema::table('medicines', function (Blueprint $table): void {
            $table->foreignId('storage_zone_id')->nullable()->constrained('storage_zones')->nullOnDelete();
            $table->foreignId('rack_id')->nullable()->constrained('racks')->nullOnDelete();
            $table->foreignId('rack_shelf_id')->nullable()->constrained('rack_shelves')->nullOnDelete();
            $table->string('storage_temperature', 30)->default('ambient_15_25');
        });

        // 6. Add specific shelf placement override on Batches (for overflow or multi-batch dispersal)
        Schema::table('medicine_batches', function (Blueprint $table): void {
            $table->foreignId('rack_shelf_id')->nullable()->constrained('rack_shelves')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('medicine_batches', function (Blueprint $table): void {
            $table->dropForeign(['rack_shelf_id']);
            $table->dropColumn(['rack_shelf_id']);
        });

        Schema::table('medicines', function (Blueprint $table): void {
            $table->dropForeign(['storage_zone_id']);
            $table->dropForeign(['rack_id']);
            $table->dropForeign(['rack_shelf_id']);
            $table->dropColumn(['storage_zone_id', 'rack_id', 'rack_shelf_id', 'storage_temperature']);
        });

        Schema::dropIfExists('rack_bins');
        Schema::dropIfExists('rack_shelves');
        Schema::dropIfExists('racks');
        Schema::dropIfExists('storage_zones');
    }
};
