<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Phase 8b: a prescription photo/scan can be attached to an existing
     * prescription record after the sale, from the invoice detail screen.
     * Stored on the private 'local' disk — image_path is a relative path
     * within that disk, never a public URL. One image per prescription,
     * immutable once set (see PrescriptionImageController::store).
     */
    public function up(): void
    {
        Schema::table('prescriptions', function (Blueprint $table): void {
            $table->string('image_path')->nullable()->after('override_reason');
            $table->timestamp('image_uploaded_at')->nullable()->after('image_path');
        });
    }

    public function down(): void
    {
        Schema::table('prescriptions', function (Blueprint $table): void {
            $table->dropColumn(['image_path', 'image_uploaded_at']);
        });
    }
};
