<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * The coarse role backing roles.name. Fine-grained rights are permission keys
 * (see brain/05-routes-and-modules.md) — never branch on UserRole in a service,
 * ask the Gate instead.
 */
enum UserRole: string
{
    case Admin = 'admin';
    case Pharmacist = 'pharmacist';
    case Cashier = 'cashier';

    public function label(): string
    {
        return match ($this) {
            self::Admin => 'Admin',
            self::Pharmacist => 'Pharmacist',
            self::Cashier => 'Cashier',
        };
    }
}
