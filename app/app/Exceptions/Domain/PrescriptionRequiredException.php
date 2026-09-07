<?php

declare(strict_types=1);

namespace App\Exceptions\Domain;

/**
 * DR-RX-02: a sale containing a Schedule H line cannot be completed unless a prescription
 * number is supplied or an authorised override is recorded. Cave law: no Schedule H
 * medicine leaves the shop without one or the other.
 */
final class PrescriptionRequiredException extends DomainException
{
    public function __construct(
        public readonly int $medicineId,
        public readonly int $saleLineIndex,
    ) {
        parent::__construct(sprintf(
            'Medicine #%d (cart line %d) is Schedule H and requires a prescription number or an authorised override.',
            $medicineId,
            $saleLineIndex,
        ));
    }

    public function errorCode(): string
    {
        return 'prescription_required';
    }

    public function userMessage(): string
    {
        return 'This item needs a prescription number, or a pharmacist/admin override with a reason.';
    }
}
