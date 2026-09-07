<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * `medicine_batch_id` is always the SAME batch the original `sale_item` drew from —
 * never today's FEFO-nearest batch. Restored via InventoryService::receiveStock().
 */
class ReturnItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'return_id',
        'sale_item_id',
        'medicine_batch_id',
        'quantity',
        'refund_amount',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'refund_amount' => 'decimal:2',
        ];
    }

    public function saleReturn(): BelongsTo
    {
        return $this->belongsTo(SaleReturn::class, 'return_id');
    }

    public function saleItem(): BelongsTo
    {
        return $this->belongsTo(SaleItem::class);
    }

    public function medicineBatch(): BelongsTo
    {
        return $this->belongsTo(MedicineBatch::class);
    }
}
