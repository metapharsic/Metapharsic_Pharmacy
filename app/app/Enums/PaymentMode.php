<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Every `payments` row carries exactly one of these. `Credit` records the unpaid portion
 * of a credit sale, not an actual tender.
 */
enum PaymentMode: string
{
    case Cash = 'cash';
    case Card = 'card';
    case Upi = 'upi';
    case Credit = 'credit';

    public function label(): string
    {
        return match ($this) {
            self::Cash => 'Cash',
            self::Card => 'Card',
            self::Upi => 'UPI',
            self::Credit => 'Credit',
        };
    }
}
