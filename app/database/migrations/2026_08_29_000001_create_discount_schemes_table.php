<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Shop-defined auto-discount schemes ("buy 2 get 1 free", "10% off on 10+ units").
     * Cave law 1: this table (and the SchemeEngine that reads it) is DISCOUNT-COMPUTATION
     * ONLY — it never touches stock_transactions or InventoryService. A scheme changes how
     * much of a line's gross value is discounted; it never changes how many real units are
     * allocated/deducted.
     *
     * Convention (app-enforced, not a DB constraint): exactly ONE of medicine_id /
     * category_id should be set per scheme — a scheme targets either a single medicine or
     * a whole category, never both and never neither. The UI/form request is responsible
     * for enforcing this at creation time.
     *
     * type='buy_x_get_y' uses buy_qty/get_qty; type='slab' uses min_qty/slab_discount_percent.
     * The unused pair stays null for a given type — validated at the app layer.
     */
    public function up(): void
    {
        Schema::create('discount_schemes', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('type'); // 'buy_x_get_y' | 'slab'

            $table->foreignId('medicine_id')->nullable()->constrained('medicines')->restrictOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('categories')->restrictOnDelete();

            // buy_x_get_y fields
            $table->integer('buy_qty')->nullable();
            $table->integer('get_qty')->nullable();

            // slab fields
            $table->integer('min_qty')->nullable();
            $table->decimal('slab_discount_percent', 5, 2)->nullable();

            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->boolean('is_active')->default(true);

            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();

            $table->timestamps();

            $table->index('medicine_id');
            $table->index('category_id');
            $table->index('is_active');
        });

        // type is restricted to the two known scheme kinds.
        DB::statement("ALTER TABLE discount_schemes ADD CONSTRAINT chk_discount_schemes_type CHECK (type IN ('buy_x_get_y', 'slab'))");

        // When type='buy_x_get_y', both buy_qty and get_qty must be positive integers.
        // When type='slab', min_qty must be positive. (slab_discount_percent's own
        // sane-range (0-100) is left to app-layer validation to keep this check simple.)
        DB::statement(<<<'SQL'
            ALTER TABLE discount_schemes ADD CONSTRAINT chk_discount_schemes_qty_by_type CHECK (
                (type = 'buy_x_get_y' AND buy_qty > 0 AND get_qty > 0)
                OR
                (type = 'slab' AND min_qty > 0)
            )
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('discount_schemes');
    }
};
