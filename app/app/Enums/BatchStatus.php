<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Lifecycle of a physical batch. Per DR-EXP-09, there is no transition back to `Available`
 * from `Expired` or `Quarantined` — correcting a mistaken quarantine is a fresh stock
 * adjustment with reason `counting_error`, never a status flip.
 */
enum BatchStatus: string
{
    case Available = 'available';
    case Expired = 'expired';
    case Finished = 'finished';
    case Quarantined = 'quarantined';

    public function label(): string
    {
        return match ($this) {
            self::Available => 'Available',
            self::Expired => 'Expired',
            self::Finished => 'Finished',
            self::Quarantined => 'Quarantined',
        };
    }
}
