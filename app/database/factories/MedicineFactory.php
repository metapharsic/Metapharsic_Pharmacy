<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Category;
use App\Models\Manufacturer;
use App\Models\Medicine;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

/**
 * @extends Factory<Medicine>
 */
class MedicineFactory extends Factory
{
    protected $model = Medicine::class;

    public function definition(): array
    {
        return [
            'name' => ucfirst(Str::random(6)) . ' ' . Arr::random(['500mg', '250mg', '100ml', '10mg']),
            'generic_name' => ucfirst(Str::random(8)),
            'brand' => ucfirst(Str::random(6)) . ' Pharma',
            'category_id' => Category::factory(),
            'manufacturer_id' => Manufacturer::factory(),
            'unit' => Arr::random(['strip', 'bottle', 'box', 'tube', 'vial']),
            'pack_size' => Arr::random([10, 15, 1, 30]),
            'hsn_code' => '30049099',
            'gst_rate' => Arr::random(['0.00', '5.00', '12.00', '18.00']),
            'default_purchase_price' => '100.00',
            'default_selling_price' => '120.00',
            'min_stock_level' => 10,
            'rack_location' => 'R1-S2',
            'is_prescription_required' => false,
            'barcode' => (string) rand(1000000000000, 9999999999999),
            'is_active' => true,
        ];
    }
}
