<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Medicine;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PurchaseItem>
 */
class PurchaseItemFactory extends Factory
{
    protected $model = PurchaseItem::class;

    public function definition(): array
    {
        $purchasePrice = $this->faker->randomFloat(2, 5, 200);
        $quantity = $this->faker->numberBetween(10, 100);
        $freeQuantity = $this->faker->numberBetween(0, (int) round($quantity * 0.1));
        $gstRate = $this->faker->randomElement([0, 5, 12, 18]);
        $taxable = $purchasePrice * $quantity;
        $lineTotal = round($taxable * (1 + $gstRate / 100), 2);

        return [
            'purchase_id' => Purchase::factory(),
            'medicine_id' => Medicine::factory(),
            'batch_no' => strtoupper($this->faker->bothify('B####??')),
            'expiry_date' => $this->faker->dateTimeBetween('+3 months', '+2 years')->format('Y-m-d'),
            'quantity' => $quantity,
            'free_quantity' => $freeQuantity,
            'purchase_price' => $purchasePrice,
            'mrp' => round($purchasePrice * 1.4, 2),
            'selling_price' => round($purchasePrice * 1.2, 2),
            'gst_rate' => $gstRate,
            'line_total' => $lineTotal,
        ];
    }
}
