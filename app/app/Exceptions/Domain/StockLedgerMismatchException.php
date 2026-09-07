<?php

declare(strict_types=1);

namespace App\Exceptions\Domain;

use App\Models\MedicineBatch;

/**
 * Thrown when a stock movement would drive `medicine_batches.quantity_available` negative.
 * Cave law 7: the ledger and the balance must always agree, and the balance must never lie
 * below zero. This is the service-level guard; `quantity_available >= 0` CHECK is the DB
 * backstop behind it.
 */
final class StockLedgerMismatchException extends DomainException
{
    public static function forNegativeBalance(MedicineBatch $batch, int $attemptedDelta, int $resultingBalance): self
    {
        return new self(sprintf(
            'Stock movement on batch #%d (%s) would set quantity_available to %d (delta %+d). '
            . 'Rejected — quantity_available must never be negative.',
            $batch->getKey(),
            $batch->batch_no,
            $resultingBalance,
            $attemptedDelta,
        ));
    }

    public function errorCode(): string
    {
        return 'stock_ledger_mismatch';
    }

    public function userMessage(): string
    {
        return 'This stock movement is not possible — it would take the batch below zero.';
    }
}
