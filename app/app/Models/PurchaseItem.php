<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'purchase_id',
        'medicine_id',
        'batch_no',
        'expiry_date',
        'quantity',
        'free_quantity',
        'purchase_price',
        'mrp',
        'selling_price',
        'gst_rate',
        'line_total',
    ];

    protected function casts(): array
    {
        return [
            'expiry_date' => 'date',
            'quantity' => 'integer',
            'free_quantity' => 'integer',
            'purchase_price' => 'decimal:2',
            'mrp' => 'decimal:2',
            'selling_price' => 'decimal:2',
            'gst_rate' => 'decimal:2',
            'line_total' => 'decimal:2',
        ];
    }

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }

    public function medicine(): BelongsTo
    {
        return $this->belongsTo(Medicine::class);
    }

    /**
     * DR-FREE-03: true per-unit cost = taxable line cost / (quantity + free_quantity),
     * rounded to the paisa. Copied onto the batch's `effective_cost` at confirm time.
     */
    public function computeEffectiveCost(): string
    {
        $units = $this->quantity + $this->free_quantity;

        if ($units <= 0) {
            throw new \DomainException('Cannot compute effective cost for a line with zero total units.');
        }

        return bcdiv((string) $this->line_total, (string) $units, 2);
    }
}
