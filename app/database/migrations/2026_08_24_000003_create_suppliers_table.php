<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('suppliers', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 150);
            $table->string('contact_person', 120)->nullable();
            $table->string('phone', 20)->nullable()->index();
            $table->string('email', 160)->nullable();
            $table->text('address')->nullable();
            $table->string('state_code', 2)->nullable();
            $table->string('gstin', 15)->nullable()->unique();
            $table->string('drug_license_no', 40)->nullable();
            $table->integer('payment_terms_days')->default(0);
            $table->decimal('outstanding_balance', 12, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('suppliers');
    }
};
