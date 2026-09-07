<?php

declare(strict_types=1);

namespace App\Exceptions\Domain;

/**
 * Cave law 4 backstop: a batch allocated by FEFO must be re-validated as not expired at
 * the moment of sale, inside the same locked transaction — stock discovered before the
 * lock is already stale by the time the lock is held.
 */
final class ExpiredBatchException extends DomainException
{
    public function __construct(
        public readonly int $batchId,
        public readonly string $expiryDate,
    ) {
        parent::__construct(sprintf(
            'Batch #%d expired on %s and cannot be sold.',
            $batchId,
            $expiryDate,
        ));
    }

    public function errorCode(): string
    {
        return 'expired_batch';
    }

    public function userMessage(): string
    {
        return 'One of the items in this cart is drawn from an expired batch. Please re-scan.';
    }
}
