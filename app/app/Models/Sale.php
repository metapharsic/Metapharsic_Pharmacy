<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\PaymentStatus;
use App\Enums\SaleStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * The GST tax invoice. Cave law 8: sales are stone. No edit, no delete, no `deleted_at`.
 * The only columns ever updated post-commit are `status`, `payment_status`, `paid`, `due`
 * — and only through {@see \App\Services\SalesService::cancelSale()}, never a raw save().
 */
class Sale extends Model
{
    use HasFactory;

    protected $fillable = [
        'invoice_no',
        'customer_id',
        'user_id',
        'sale_date',
        'subtotal',
        'discount',
        'gst_amount',
        'round_off',
        'total',
        'paid',
        'due',
        'payment_status',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'sale_date' => 'date',
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'gst_amount' => 'decimal:2',
            'round_off' => 'decimal:2',
            'total' => 'decimal:2',
            'paid' => 'decimal:2',
            'due' => 'decimal:2',
            'payment_status' => PaymentStatus::class,
            'status' => SaleStatus::class,
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function prescription(): HasOne
    {
        return $this->hasOne(Prescription::class);
    }

    public function returns(): HasMany
    {
        return $this->hasMany(SaleReturn::class);
    }
}
