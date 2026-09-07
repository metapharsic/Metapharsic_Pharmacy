<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\PaymentStatus;
use App\Enums\SaleStatus;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Sale>
 */
class SaleFactory extends Factory
{
    protected $model = Sale::class;

    public function definition(): array
    {
        $subtotal = $this->faker->randomFloat(2, 100, 5000);
        $discount = round($subtotal * 0.02, 2);
        $taxable = $subtotal - $discount;
        $gst = round($taxable * 0.12, 2);
        $preRound = $taxable + $gst;
        $total = round($preRound, 0);
        $roundOff = round($total - $preRound, 2);

        static $counter = 0;
        $counter++;

        return [
            'invoice_no' => sprintf('PHARM/26-27/%05d', $counter),
            'customer_id' => null,
            'user_id' => User::factory(),
            'sale_date' => now()->toDateString(),
            'subtotal' => $subtotal,
            'discount' => $discount,
            'gst_amount' => $gst,
            'round_off' => $roundOff,
            'total' => $total,
            'paid' => $total,
            'due' => 0,
            'payment_status' => PaymentStatus::Paid->value,
            'status' => SaleStatus::Completed->value,
        ];
    }

    public function cancelled(): static
    {
        return $this->state(fn (): array => [
            'status' => SaleStatus::Cancelled->value,
            'payment_status' => PaymentStatus::Refunded->value,
            'paid' => 0,
            'due' => 0,
        ]);
    }

    public function credit(): static
    {
        return $this->state(function (array $attributes): array {
            $due = round(((float) $attributes['total']) * 0.5, 2);

            return [
                'paid' => round(((float) $attributes['total']) - $due, 2),
                'due' => $due,
                'payment_status' => PaymentStatus::Partial->value,
            ];
        });
    }
}
