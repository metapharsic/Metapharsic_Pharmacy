<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * audit_logs — brain/08-security-and-audit.md §3.
 *
 * Append-only. No `updated_at`, no soft deletes: this table is never touched
 * by an UPDATE, only ever INSERTed. The application's database role holds
 * only INSERT and SELECT here — UPDATE and DELETE are revoked at the
 * database level in a deploy-time grant script, not in this migration
 * (grants are environment config, not schema), so even a bug in the
 * application cannot rewrite history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->id();

            // Null only for system actions (scheduler, console commands).
            // Users are deactivated, never deleted, so this stays resolvable.
            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            // Stable dotted verb: sale.void, discount.override,
            // batch.price_changed, stock.adjusted, role.permission_changed,
            // auth.login, auth.login_failed, prescription.overridden, ...
            $table->string('action');

            // Polymorphic target of the action.
            $table->string('model_type')->nullable();
            $table->unsignedBigInteger('model_id')->nullable();

            // Only the changed keys, not the whole row.
            $table->jsonb('old_values')->nullable();
            $table->jsonb('new_values')->nullable();

            // Reason text, approving user id for overrides, invoice number,
            // route name — whatever context the event needs beyond a diff.
            $table->jsonb('context')->nullable();

            $table->ipAddress('ip_address')->nullable();
            $table->string('user_agent')->nullable();

            // created_at only — append-only, no updated_at.
            $table->timestampTz('created_at')->useCurrent();

            $table->index(['model_type', 'model_id']);
            $table->index(['user_id', 'created_at']);
            $table->index(['action', 'created_at']);
        });

        // GIN indexes for containment queries over the JSONB diff columns
        // ("every price change on medicine 712 last quarter") — not
        // expressible as a Blueprint column modifier, so raw DDL.
        DB::statement('CREATE INDEX audit_logs_old_values_gin ON audit_logs USING GIN (old_values)');
        DB::statement('CREATE INDEX audit_logs_new_values_gin ON audit_logs USING GIN (new_values)');
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
