<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\BatchStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * The physical box on the shelf. `quantity_available` is a materialised balance of the
 * `stock_transactions` ledger (ADR-0003) — it must be written ONLY by `InventoryService`,
 * never assigned directly by a controller, job, or seeder. Cave laws 1 and 7.
 */
class MedicineBatch extends Model
{
    use HasFactory;

    protected $fillable = [
        'medicine_id',
        'batch_no',
        'expiry_date',
        'purchase_price',
        'selling_price',
        'mrp',
        'effective_cost',
        'quantity_received',
        'quantity_available',
        'status',
        'purchase_item_id',
        'supplier_id',
        // Physical put-away location, set only via rack assignment (RacksController /
        // InventoryController::assignRack). Nullable and independent of the
        // quantity_available invariant above — reassigning a shelf never touches stock.
        'rack_shelf_id',
    ];

    protected function casts(): array
    {
        return [
            'expiry_date' => 'date',
            'purchase_price' => 'decimal:2',
            'selling_price' => 'decimal:2',
            'mrp' => 'decimal:2',
            'effective_cost' => 'decimal:2',
            'quantity_received' => 'integer',
            'quantity_available' => 'integer',
            'status' => BatchStatus::class,
        ];
    }

    public function medicine(): BelongsTo
    {
        return $this->belongsTo(Medicine::class);
    }

    public function purchaseItem(): BelongsTo
    {
        return $this->belongsTo(PurchaseItem::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function stockTransactions(): HasMany
    {
        return $this->hasMany(StockTransaction::class);
    }

    public function stockAdjustments(): HasMany
    {
        return $this->hasMany(StockAdjustment::class);
    }

    /**
     * Physical shelf this batch is put away on (nullable — many batches are
     * received before a rack assignment happens). Used by the rack-wise
     * stock report and rack occupancy calculation; never involved in the
     * FEFO/quantity ledger.
     */
    public function rackShelf(): BelongsTo
    {
        return $this->belongsTo(RackShelf::class, 'rack_shelf_id');
    }

    /**
     * DR-FEFO-01: the FEFO candidate predicate. Used by `InventoryService::allocateFefo()`
     * both for the unlocked candidate-discovery pass and (re-applied) after locking.
     */
    public function scopeSellable(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query->where('quantity_available', '>', 0)
            ->where('status', BatchStatus::Available)
            ->whereDate('expiry_date', '>', now()->toDateString());
    }
}
