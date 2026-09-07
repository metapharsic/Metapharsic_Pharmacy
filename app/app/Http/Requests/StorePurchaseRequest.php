<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Shape and permission only. Cost math, effective_cost, and stock movement
 * are decided by PurchaseService/InventoryService inside their transaction —
 * see brain/03-domain-rules.md §7. This request never trusts the browser's
 * arithmetic, only its shape.
 */
final class StorePurchaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Route-level `can:purchase.create` middleware is the real gate; this
        // is a defence-in-depth check for direct form-request testing.
        return $this->user()?->can('purchase.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'invoice_no' => ['required', 'string', 'max:64'],
            'invoice_date' => ['required', 'date', 'before_or_equal:today'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.medicine_id' => ['required', 'integer', 'exists:medicines,id'],
            'items.*.batch_no' => ['required', 'string', 'max:64'],
            // DR-EXP-01: a batch is only ever received with a genuinely future
            // expiry. A batch already expired on arrival is a data-entry error,
            // not a purchase.
            'items.*.expiry_date' => ['required', 'date', 'after:today'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            // DR-FREE-01/02: free goods are quantity, never cost. min:0, never negative.
            'items.*.free_quantity' => ['required', 'integer', 'min:0'],
            'items.*.purchase_price' => ['required', 'numeric', 'min:0'],
            'items.*.mrp' => ['required', 'numeric', 'min:0'],
            'items.*.selling_price' => ['required', 'numeric', 'min:0'],
            // DR-GST-01: only 0/5/12/18 are permitted slabs on pharma goods.
            'items.*.gst_rate' => ['required', 'numeric', Rule::in([0, 5, 12, 18])],
            'items.*.discount_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'items.*.expiry_date.after' => 'Expiry date must be in the future.',
            'items.*.gst_rate.in' => 'GST rate must be one of 0, 5, 12, or 18 percent.',
        ];
    }
}
