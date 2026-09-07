<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\PurchaseStatus;
use App\Models\Purchase;
use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Purchase>
 */
class PurchaseFactory extends Factory
{
    protected $model = Purchase::class;

    public function definition(): array
    {
        $subtotal = $this->faker->randomFloat(2, 500, 20000);
        $gst = round($subtotal * 0.12, 2);
        $total = $subtotal + $gst;

        return [
            'supplier_id' => Supplier::factory(),
            'invoice_no' => strtoupper($this->faker->bothify('INV-####-???')),
            'invoice_date' => $this->faker->dateTimeBetween('-60 days', 'now')->format('Y-m-d'),
            'subtotal' => $subtotal,
            'discount' => 0,
            'gst_amount' => $gst,
            'total' => $total,
            'paid_amount' => 0,
            'due_amount' => $total,
            'status' => PurchaseStatus::Draft,
        ];
    }

    public function confirmed(): static
    {
        return $this->state(fn (): array => ['status' => PurchaseStatus::Confirmed]);
    }

    public function cancelled(): static
    {
        return $this->state(fn (): array => ['status' => PurchaseStatus::Cancelled]);
    }
}
