<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\AdjustmentReason;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * DR-ADJ-01/02/03: admin-only, mandatory reason code from the fixed set,
 * mandatory free-text note. Enforcement of the admin-only rule itself lives
 * in the Gate (stock.adjust is permanently admin-only per
 * brain/05-routes-and-modules.md §3), not here — this request only checks
 * shape.
 */
final class StoreStockAdjustmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('stock.adjust') ?? false;
    }

    public function rules(): array
    {
        return [
            'medicine_batch_id' => ['required', 'integer', 'exists:medicine_batches,id'],
            'reason' => ['required', Rule::enum(AdjustmentReason::class)],
            // Signed integer: positive = adjustment_add, negative = adjustment_remove.
            // Zero is meaningless — an adjustment that changes nothing is not an adjustment.
            'quantity_change' => ['required', 'integer', 'not_in:0'],
            'note' => [
                Rule::requiredIf(fn () => in_array(
                    $this->input('reason'),
                    [AdjustmentReason::Damaged->value, AdjustmentReason::Theft->value],
                    true,
                )),
                'nullable',
                'string',
                'max:1000',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'quantity_change.not_in' => 'Quantity change cannot be zero.',
            'note.required' => 'A note is required when the reason is damaged or theft.',
        ];
    }

    protected function prepareForValidation(): void
    {
        // DR-ADJ-03 requires a note for every adjustment in spirit, but is
        // strictly mandatory only for damaged/theft per this task's brief;
        // still normalise blank strings to null so requiredIf behaves.
        if ($this->input('note') === '') {
            $this->merge(['note' => null]);
        }
    }
}
