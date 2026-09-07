<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * The IDEA of a medicine — name, HSN, GST rate, Rx flag, min stock level, barcode.
 *
 * Cave law 3: this model holds no quantity, no expiry, no stock price. Those live on
 * `medicine_batches` (Phase 3). Never add an accessor, cast, or fillable entry here that
 * implies stock — that is a six-month bug with a head start.
 */
class Medicine extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'name',
        'generic_name',
        'brand',
        'category_id',
        'manufacturer_id',
        'unit',
        'pack_size',
        'hsn_code',
        'gst_rate',
        'default_purchase_price',
        'default_selling_price',
        'min_stock_level',
        'rack_location',
        'storage_zone_id',
        'rack_id',
        'rack_shelf_id',
        'storage_temperature',
        'is_prescription_required',
        'barcode',
        'notes',
        'is_active',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'pack_size' => 'integer',
            'gst_rate' => 'decimal:2',
            'default_purchase_price' => 'decimal:2',
            'default_selling_price' => 'decimal:2',
            'min_stock_level' => 'integer',
            'is_prescription_required' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function manufacturer(): BelongsTo
    {
        return $this->belongsTo(Manufacturer::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function zone(): BelongsTo
    {
        return $this->belongsTo(StorageZone::class, 'storage_zone_id');
    }

    public function rack(): BelongsTo
    {
        return $this->belongsTo(Rack::class, 'rack_id');
    }

    public function shelf(): BelongsTo
    {
        return $this->belongsTo(RackShelf::class, 'rack_shelf_id');
    }

    public function batches(): HasMany
    {
        return $this->hasMany(MedicineBatch::class);
    }

    /**
     * Cave law 2: cost columns never leave the database for a cashier-reachable query.
     * Cashier and POS endpoints must select only through this scope.
     */
    public function scopeWithoutCost(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query->select([
            'id', 'name', 'generic_name', 'brand', 'category_id', 'manufacturer_id',
            'unit', 'pack_size', 'hsn_code', 'gst_rate', 'min_stock_level',
            'rack_location', 'storage_zone_id', 'rack_id', 'rack_shelf_id', 'storage_temperature',
            'is_prescription_required', 'barcode', 'is_active',
        ]);
    }

    public function scopeWithStockSummary(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query
            ->withSum('batches as current_stock', 'quantity_available')
            ->withSum([
                'batches as saleable_stock' => function (\Illuminate\Database\Eloquent\Builder $query) {
                    $query
                        ->where('status', \App\Enums\BatchStatus::Available)
                        ->where('quantity_available', '>', 0)
                        ->whereDate('expiry_date', '>=', today());
                },
            ], 'quantity_available');
    }

    public function isLowStock(): bool
    {
        return (float) ($this->saleable_stock ?? $this->current_stock ?? 0)
            <= (float) $this->min_stock_level;
    }
}
