<?php

declare(strict_types=1);

namespace App\Exceptions\Domain;

/**
 * Shared base for domain failures (brain/04-coding-standards.md §8). Not part of this
 * task's explicit deliverable list, but required for `StockLedgerMismatchException` and
 * `InsufficientStockException` to compile against the project's own convention rather than
 * inventing a one-off shape. If Phase 1/2 already ships this class, this file is a no-op
 * duplicate to drop in favour of the canonical one.
 */
abstract class DomainException extends \RuntimeException
{
    abstract public function errorCode(): string;

    abstract public function userMessage(): string;
}
