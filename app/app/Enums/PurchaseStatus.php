<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * A draft purchase has moved no stock and may be deleted outright. Only `Confirmed` has
 * moved stock through `InventoryService`; `Cancelled` reverses it with mirrored ledger rows.
 */
enum PurchaseStatus: string
{
    case Draft = 'draft';
    case Confirmed = 'confirmed';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Confirmed => 'Confirmed',
            self::Cancelled => 'Cancelled',
        };
    }
}
