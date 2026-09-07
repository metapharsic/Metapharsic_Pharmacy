<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Mandatory reason for a manual stock adjustment. There is no "other" — an adjustment
 * without a specific, closed-set reason explains nothing to an inspector.
 */
enum AdjustmentReason: string
{
    case Damaged = 'damaged';
    case Expired = 'expired';
    case Theft = 'theft';
    case CountingError = 'counting_error';
    case Sample = 'sample';
    case OpeningStock = 'opening_stock';

    public function label(): string
    {
        return match ($this) {
            self::Damaged => 'Damaged',
            self::Expired => 'Expired',
            self::Theft => 'Theft',
            self::CountingError => 'Counting Error',
            self::Sample => 'Sample',
            self::OpeningStock => 'Opening Stock',
        };
    }
}
