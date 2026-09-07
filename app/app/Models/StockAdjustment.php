<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\AdjustmentReason;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The reason record behind a manual stock movement. Admin only. Never the door to stock
 * itself — `InventoryService` still writes the `stock_transactions` row it justifies.
 */
class StockAdjustment extends Model
{
    use HasFactory;

    public const UPDATED_AT = null;

    protected $fillable = [
        'medicine_batch_id',
        'quantity_change',
        'reason',
        'user_id',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'quantity_change' => 'integer',
            'reason' => AdjustmentReason::class,
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(MedicineBatch::class, 'medicine_batch_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
