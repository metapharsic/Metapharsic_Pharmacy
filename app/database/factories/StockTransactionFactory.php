<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\StockTransactionType;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\StockTransaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StockTransaction>
 */
class StockTransactionFactory extends Factory
{
    protected $model = StockTransaction::class;

    public function definition(): array
    {
        return [
            'medicine_id' => function (array $attributes) {
                if (isset($attributes['medicine_batch_id'])) {
                    $batch = MedicineBatch::find($attributes['medicine_batch_id']);
                    if ($batch) {
                        return $batch->medicine_id;
                    }
                }
                return Medicine::factory();
            },
            'medicine_batch_id' => fn () => MedicineBatch::factory(),
            'type' => StockTransactionType::OpeningStock,
            'quantity_change' => 10,
            'balance_after' => 10,
            'reference_type' => null,
            'reference_id' => null,
            'user_id' => fn () => User::factory(),
            'note' => 'Factory stock transaction',
        ];
    }
}
