<?php

declare(strict_types=1);

namespace App\Exceptions\Domain;

/**
 * DR-FEFO-06: if the sellable quantity across all of a medicine's batches is less than the
 * requested quantity, the whole allocation is rejected — never partially applied. The
 * cashier is told the actual available number.
 */
final class InsufficientStockException extends DomainException
{
    public function __construct(
        public readonly int $medicineId,
        public readonly int $requested,
        public readonly int $available,
    ) {
        parent::__construct(sprintf(
            'Insufficient stock for medicine #%d: requested %d, only %d available.',
            $medicineId,
            $requested,
            $available,
        ));
    }

    public function errorCode(): string
    {
        return 'insufficient_stock';
    }

    public function userMessage(): string
    {
        return sprintf('Only %d left of this medicine.', $this->available);
    }
}
