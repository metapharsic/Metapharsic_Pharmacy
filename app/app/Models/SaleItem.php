<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One row per (sale line x batch slice). Cave law 6: `cost_price_at_sale` is a snapshot
 * taken at sale time — no accessor or scope on this model may join back to
 * `medicine_batches` for cost; every profit query reads this column verbatim.
 */
class SaleItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'sale_id',
        'medicine_id',
        'medicine_batch_id',
        'quantity',
        'unit_price',
        'discount',
        'gst_rate',
        'gst_amount',
        'line_total',
        'cost_price_at_sale',
        'returned_quantity',
        'discount_scheme_id',
        'scheme_discount_amount',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'decimal:2',
            'discount' => 'decimal:2',
            'gst_rate' => 'decimal:2',
            'gst_amount' => 'decimal:2',
            'line_total' => 'decimal:2',
            'cost_price_at_sale' => 'decimal:2',
            'returned_quantity' => 'integer',
            'scheme_discount_amount' => 'decimal:2',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function medicine(): BelongsTo
    {
        return $this->belongsTo(Medicine::class);
    }

    public function medicineBatch(): BelongsTo
    {
        return $this->belongsTo(MedicineBatch::class);
    }

    public function returnItems(): HasMany
    {
        return $this->hasMany(ReturnItem::class);
    }

    /** Phase 8a: the auto-applied scheme that won over any manual discount, if one did. */
    public function scheme(): BelongsTo
    {
        return $this->belongsTo(DiscountScheme::class, 'discount_scheme_id');
    }

    /** Units still open to a return: sold minus already returned. */
    public function returnableQuantity(): int
    {
        return $this->quantity - $this->returned_quantity;
    }
}
