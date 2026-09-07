<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\PaymentMode;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A tender against a sale (or purchase), or a refund. Cave law 8: a refund is a NEW
 * negative-amount row — never an edit of the original payment.
 */
class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'sale_id',
        'purchase_id',
        'amount',
        'mode',
        'reference_no',
        'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'mode' => PaymentMode::class,
            'paid_at' => 'datetime',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }
}
