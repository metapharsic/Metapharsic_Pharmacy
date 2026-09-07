<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMedicineRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('medicine.manage') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:180'],
            'generic_name' => ['nullable', 'string', 'max:180'],
            'brand' => ['nullable', 'string', 'max:120'],
            'category_id' => ['nullable', 'integer', Rule::exists('categories', 'id')],
            'manufacturer_id' => ['nullable', 'integer', Rule::exists('manufacturers', 'id')],
            'unit' => ['required', 'string', 'max:20'],
            'pack_size' => ['required', 'integer', 'min:1'],
            'hsn_code' => ['nullable', 'string', 'max:10'],
            // G2.5 / T-0203: reject an out-of-slab GST rate before it reaches the database
            // CHECK constraint — same invariant, enforced at both layers.
            'gst_rate' => ['required', 'numeric', Rule::in([0, 5, 12, 18])],
            'default_purchase_price' => ['nullable', 'numeric', 'min:0'],
            'default_selling_price' => ['nullable', 'numeric', 'min:0'],
            'min_stock_level' => ['nullable', 'integer', 'min:0'],
            'rack_location' => ['nullable', 'string', 'max:40'],
            'storage_zone_id' => ['nullable', 'integer', Rule::exists('storage_zones', 'id')],
            'rack_id' => ['nullable', 'integer', Rule::exists('racks', 'id')],
            'rack_shelf_id' => ['nullable', 'integer', Rule::exists('rack_shelves', 'id')],
            'storage_temperature' => ['nullable', 'string', Rule::in(['ambient_15_25', 'cold_2_8', 'frozen_minus_20', 'controlled_vault'])],
            'is_prescription_required' => ['sometimes', 'boolean'],
            'barcode' => ['nullable', 'string', 'max:64', Rule::unique('medicines', 'barcode')],
            'notes' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
