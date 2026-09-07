<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\StockTransactionType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * The append-only stock ledger. Cave law 1: only `InventoryService` inserts here, and only
 * alongside the `medicine_batches.quantity_available` update it explains. Never updated,
 * never deleted — no `updated_at` column exists, and a database trigger blocking
 * UPDATE/DELETE is planned as a later hardening migration (see the table migration).
 */
class StockTransaction extends Model
{
    use HasFactory;

    public const UPDATED_AT = null;

    protected $fillable = [
        'medicine_id',
        'medicine_batch_id',
        'type',
        'quantity_change',
        'balance_after',
        'reference_type',
        'reference_id',
        'user_id',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'type' => StockTransactionType::class,
            'quantity_change' => 'integer',
            'balance_after' => 'integer',
        ];
    }

    public function medicine(): BelongsTo
    {
        return $this->belongsTo(Medicine::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(MedicineBatch::class, 'medicine_batch_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reference(): MorphTo
    {
        return $this->morphTo();
    }
}
