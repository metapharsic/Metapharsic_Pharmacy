<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * audit_logs — brain/08-security-and-audit.md §3.
 *
 * Append-only: no factory-of-updates here. This model is written by
 * AuditService::record() and by centrally-registered model observers only;
 * no controller or job should ever call save()/update() on an existing row.
 * `UPDATE`/`DELETE` are revoked for the application's database role, so this
 * is belt-and-braces, not the only line of defence.
 */
final class AuditLog extends Model
{
    /**
     * No `updated_at` — this table is genuinely append-only.
     */
    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'action',
        'model_type',
        'model_id',
        'old_values',
        'new_values',
        'context',
        'ip_address',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
            'context' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function model(): MorphTo
    {
        return $this->morphTo();
    }
}
