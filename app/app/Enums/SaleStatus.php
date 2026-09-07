<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Cave law 8: `status` is one of the very few columns SalesService may update on a
 * committed sale — never a raw controller/model update.
 */
enum SaleStatus: string
{
    case Completed = 'completed';
    case Cancelled = 'cancelled';
    case PartiallyReturned = 'partially_returned';

    public function label(): string
    {
        return match ($this) {
            self::Completed => 'Completed',
            self::Cancelled => 'Cancelled',
            self::PartiallyReturned => 'Partially Returned',
        };
    }
}
