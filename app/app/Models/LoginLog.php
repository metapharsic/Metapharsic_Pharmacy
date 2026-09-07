<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * login_logs is append-only, per brain/08-security-and-audit.md §1: kept 2 years,
 * never updated or deleted by application code. There is deliberately no
 * observer-driven audit wiring here — LogSuccessfulLogin / LogFailedLogin write it
 * directly, because a login is not a model save on an existing Eloquent entity.
 */
final class LoginLog extends Model
{
    protected $table = 'login_logs';
    public $timestamps = false; // created_at only, set by DB default
    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'email_attempted',
        'ip_address',
        'user_agent',
        'success',
    ];

    protected function casts(): array
    {
        return [
            'success' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
