<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * DR-RX-06: one prescription record per sale, whether it is a genuine prescription
     * capture or an authorised override (overridden_by set, with a mandatory reason).
     */
    public function up(): void
    {
        Schema::create('prescriptions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->restrictOnDelete();
            $table->string('prescription_number', 60)->nullable();
            $table->string('doctor_name', 150)->nullable();
            // Set when a Schedule H line was completed without a prescription number.
            $table->foreignId('overridden_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('override_reason')->nullable();
            $table->timestamps();

            $table->unique('sale_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prescriptions');
    }
};
