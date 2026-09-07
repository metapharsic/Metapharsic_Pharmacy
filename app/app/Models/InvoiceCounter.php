<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * ADR-0006: the row `InvoiceService::nextInvoiceNumber()` locks, reads, and increments.
 * Nothing else may write `last_number`.
 */
class InvoiceCounter extends Model
{
    use HasFactory;

    protected $fillable = [
        'series',
        'financial_year',
        'last_number',
    ];

    protected function casts(): array
    {
        return [
            'last_number' => 'integer',
        ];
    }
}
