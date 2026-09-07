<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\Sale;
use App\Models\SaleItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SaleItem>
 */
class SaleItemFactory extends Factory
{
    protected $model = SaleItem::class;

    public function definition(): array
    {
        $quantity = $this->faker->numberBetween(1, 10);
        $unitPrice = $this->faker->randomFloat(2, 10, 500);
        $discount = 0.0;
        $taxable = round($unitPrice * $quantity - $discount, 2);
        $gstRate = $this->faker->randomElement([0, 5, 12, 18]);
        $gstAmount = round($taxable * $gstRate / 100, 2);

        return [
            'sale_id' => Sale::factory(),
            'medicine_id' => Medicine::factory(),
            'medicine_batch_id' => MedicineBatch::factory(),
            'quantity' => $quantity,
            'unit_price' => $unitPrice,
            'discount' => $discount,
            'gst_rate' => $gstRate,
            'gst_amount' => $gstAmount,
            'line_total' => $taxable + $gstAmount,
            // Cave law 6: a snapshot value, deliberately independent of the batch's
            // current effective_cost — history must not move when batch prices change.
            'cost_price_at_sale' => $this->faker->randomFloat(2, 5, (float) $unitPrice * 0.8),
            'returned_quantity' => 0,
        ];
    }
}
