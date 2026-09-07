<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_logs', function (Blueprint $table): void {
            $table->id();
            // Nullable: a failed login for an unknown email still gets logged.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('email_attempted', 160);
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->boolean('success')->default(false);
            // Append-only ledger of login attempts: created_at only, no updated_at.
            $table->timestampTz('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_logs');
    }
};
