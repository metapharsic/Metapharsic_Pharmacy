<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A shop-defined auto-discount scheme ("buy 2 get 1 free", "10% off on 10+ units").
 * Cave law 1: this model (and SchemeEngine) is discount-COMPUTATION-only — it never
 * touches stock_transactions or InventoryService.
 */
class DiscountScheme extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'type',
        'medicine_id',
        'category_id',
        'buy_qty',
        'get_qty',
        'min_qty',
        'slab_discount_percent',
        'starts_on',
        'ends_on',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'starts_on' => 'date',
        'ends_on' => 'date',
        'slab_discount_percent' => 'decimal:2',
    ];

    public function medicine(): BelongsTo
    {
        return $this->belongsTo(Medicine::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Active AND within its optional date window (as of today).
     */
    public function scopeActive(Builder $query): Builder
    {
        $today = Carbon::now()->toDateString();

        return $query->where('is_active', true)
            ->where(function (Builder $q) use ($today): void {
                $q->whereNull('starts_on')->orWhereDate('starts_on', '<=', $today);
            })
            ->where(function (Builder $q) use ($today): void {
                $q->whereNull('ends_on')->orWhereDate('ends_on', '>=', $today);
            });
    }
}
