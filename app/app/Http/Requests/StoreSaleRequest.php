<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\PaymentMode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Shape validation only — money and stock arithmetic is authoritative in SalesService,
 * never trusted from the request (brain/06 §5, cart totals are a preview).
 */
class StoreSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],

            'lines' => ['required', 'array', 'min:1'],
            'lines.*.medicine_id' => ['required', 'integer', 'exists:medicines,id'],
            'lines.*.quantity' => ['required', 'integer', 'min:1'],
            'lines.*.discount' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'lines.*.prescription_number' => ['nullable', 'string', 'max:60'],
            'lines.*.override' => ['nullable', 'boolean'],
            'lines.*.override_reason' => ['nullable', 'string', 'max:255', 'required_if:lines.*.override,true'],

            'payments' => ['required', 'array', 'min:1'],
            'payments.*.mode' => ['required', 'string', 'in:'.implode(',', array_map(
                static fn (PaymentMode $mode): string => $mode->value,
                PaymentMode::cases(),
            ))],
            'payments.*.amount' => ['required', 'numeric'],
            'payments.*.reference_no' => ['nullable', 'string', 'max:60'],
        ];
    }

    /**
     * At least one payment must cover the total, or the shortfall must be tendered as
     * `credit` against a customer. The exact rupee reconciliation still happens in
     * SalesService against server-computed totals; this only rejects an obviously
     * malformed split before it reaches the transaction.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $payments = $this->input('payments', []);

            if (! is_array($payments) || $payments === []) {
                return;
            }

            $sum = array_sum(array_map(
                static fn ($p): float => is_array($p) ? (float) ($p['amount'] ?? 0) : 0.0,
                $payments,
            ));

            $hasCredit = collect($payments)->contains(
                static fn ($p): bool => is_array($p) && ($p['mode'] ?? null) === PaymentMode::Credit->value
            );

            if ($sum <= 0 && ! $hasCredit) {
                $validator->errors()->add('payments', 'Payments must sum to a positive amount, or include a credit tender.');
            }

            if ($hasCredit && $this->input('customer_id') === null) {
                $validator->errors()->add('payments', 'A credit payment requires a customer to be selected.');
            }
        });
    }
}
