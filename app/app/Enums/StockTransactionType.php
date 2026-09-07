<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Every quantity movement in the system carries exactly one of these types.
 *
 * Cave law 1: this is the closed set of reasons `InventoryService` will accept. Adding a
 * case here is an escalation (see `agents/README.md` §4), not a routine change.
 */
enum StockTransactionType: string
{
    case Purchase = 'purchase';
    case Sale = 'sale';
    case SaleReturn = 'sale_return';
    case PurchaseReturn = 'purchase_return';
    case AdjustmentAdd = 'adjustment_add';
    case AdjustmentRemove = 'adjustment_remove';
    case ExpiryWriteoff = 'expiry_writeoff';
    case OpeningStock = 'opening_stock';

    /** +1 for inbound, -1 for outbound. The ledger's only arithmetic rule. */
    public function sign(): int
    {
        return match ($this) {
            self::Purchase, self::SaleReturn, self::AdjustmentAdd, self::OpeningStock => 1,
            self::Sale, self::PurchaseReturn, self::AdjustmentRemove, self::ExpiryWriteoff => -1,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Purchase => 'Purchase',
            self::Sale => 'Sale',
            self::SaleReturn => 'Sale Return',
            self::PurchaseReturn => 'Purchase Return',
            self::AdjustmentAdd => 'Adjustment (Add)',
            self::AdjustmentRemove => 'Adjustment (Remove)',
            self::ExpiryWriteoff => 'Expiry Write-off',
            self::OpeningStock => 'Opening Stock',
        };
    }
}
