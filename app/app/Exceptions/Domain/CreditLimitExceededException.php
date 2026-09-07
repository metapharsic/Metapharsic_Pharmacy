<?php

declare(strict_types=1);

namespace App\Exceptions\Domain;

/**
 * DR-CRED-02: credit is blocked when `customer.outstanding_balance + this_bill_due` would
 * exceed `customer.credit_limit`. A customer with a zero credit_limit has no credit
 * facility at all.
 */
final class CreditLimitExceededException extends DomainException
{
    public function __construct(
        public readonly int $customerId,
        public readonly string $outstanding,
        public readonly string $creditLimit,
        public readonly string $shortfall,
    ) {
        parent::__construct(sprintf(
            'Customer #%d would exceed credit limit: outstanding %s + this bill exceeds limit %s (short by %s).',
            $customerId,
            $outstanding,
            $creditLimit,
            $shortfall,
        ));
    }

    public function errorCode(): string
    {
        return 'credit_limit_exceeded';
    }

    public function userMessage(): string
    {
        return 'This sale would exceed the customer\'s credit limit. An admin override is required.';
    }
}
