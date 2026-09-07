<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Shape-and-permission validation only (brain/03-domain-rules.md §1 "Request" enforcement
 * point). ReturnService::processReturn() re-validates quantities against locked sale_item
 * rows inside the transaction (DR-RET-02) — this Form Request cannot and does not trust the
 * quantities it receives to still be valid by the time the service runs.
 */
class StoreReturnRequest extends FormRequest
{
    public function authorize(): bool
    {
        // DR-RET-09: returns require pharmacist or admin — a cashier cannot process a return.
        // Gate::authorize('return.create') is also re-checked in the controller so the 403
        // is explicit and testable independent of this Form Request's own gate call.
        return $this->user() !== null && $this->user()->can('return.create');
    }

    public function rules(): array
    {
        return [
            'sale_id' => ['required', 'integer', 'exists:sales,id'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.sale_item_id' => ['required', 'integer', 'exists:sale_items,id'],
            'lines.*.quantity' => ['required', 'integer', 'min:1'],
            'lines.*.condition' => ['required', 'string', 'in:good,damaged,expired'],
            'reason' => ['nullable', 'string', 'max:500'],
            // DR-RET-10: accepting outside the return window requires a recorded reason and
            // is only reachable by pharmacist/admin (same Gate as the rest of this request).
            'out_of_window_reason' => ['nullable', 'string', 'max:500', 'required_if:force_out_of_window,true'],
            'force_out_of_window' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'lines.required' => 'Select at least one line to return.',
            'lines.*.condition.in' => 'Condition must be good, damaged, or expired.',
        ];
    }
}
