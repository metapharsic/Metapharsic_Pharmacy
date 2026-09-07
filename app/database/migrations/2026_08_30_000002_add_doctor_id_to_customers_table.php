<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Legacy-fallback convention (Phase 8c, brain/11-gap-closure-architecture.md):
     * this is a deliberately NOT auto-migrated column. Existing `customers.doctor_name`
     * free-text values are unstructured and may contain typos/duplicates, so they are
     * NOT force-matched to a `doctors` row here — an admin reviews and links each
     * customer manually over time.
     *
     * - doctor_id NULL, doctor_name present  -> legacy unstructured data, unresolved.
     * - doctor_id SET                        -> properly linked to a real Doctor row.
     *   doctor_name may still be present (redundant) or blank; the view layer should
     *   always prefer the doctor_id relation's name over doctor_name when both exist.
     */
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->foreignId('doctor_id')->nullable()->after('doctor_name')
                ->constrained('doctors')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('doctor_id');
        });
    }
};
