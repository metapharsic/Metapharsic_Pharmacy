<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 150);
            $table->string('phone', 20)->nullable();
            $table->string('email', 160)->nullable();
            $table->text('address')->nullable();
            $table->string('doctor_name', 150)->nullable();
            $table->string('gstin', 15)->nullable();
            $table->string('state_code', 2)->nullable();
            $table->decimal('credit_limit', 12, 2)->default(0);
            $table->decimal('outstanding_balance', 12, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        // phone is the primary counter lookup key: indexed, and unique among live rows only
        // (per brain/02-database-schema.md §4.2) so a deactivated/soft-deleted customer's
        // phone can be re-registered for a new walk-in without a residual unique conflict.
        DB::statement(
            'CREATE UNIQUE INDEX customers_phone_unique ON customers (phone) WHERE deleted_at IS NULL AND phone IS NOT NULL'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
