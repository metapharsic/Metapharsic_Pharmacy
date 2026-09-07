<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Table `returns`. Named `SaleReturn` because `Return` is a reserved word in PHP.
 * ADR-0005: a return is a forward correction — it never edits the original sale.
 */
class SaleReturn extends Model
{
    use HasFactory;

    /** @var string */
    protected $table = 'returns';

    protected $fillable = [
        'sale_id',
        'user_id',
        'return_date',
        'total_refund',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'return_date' => 'date',
            'total_refund' => 'decimal:2',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(ReturnItem::class, 'return_id');
    }
}
