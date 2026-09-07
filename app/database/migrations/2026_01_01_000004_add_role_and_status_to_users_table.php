<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            // Nullable so the FK can be added before any role row exists on an
            // already-seeded users table; application logic always requires a role.
            $table->foreignId('role_id')->nullable()->after('id')
                ->constrained()->nullOnDelete();
            $table->boolean('is_active')->default(true)->after('password');
            $table->timestampTz('last_login_at')->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('role_id');
            $table->dropColumn(['is_active', 'last_login_at']);
        });
    }
};
