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
        Schema::create('categories', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 100);
            $table->foreignId('parent_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        // Cave law: "unique among non-deleted rows" per brain/02-database-schema.md §4.2.
        // A plain unique() would block re-creating a name after soft-deleting the original,
        // so the uniqueness is scoped to live rows via a partial index.
        DB::statement(
            'CREATE UNIQUE INDEX categories_name_unique ON categories (name) WHERE deleted_at IS NULL'
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};
