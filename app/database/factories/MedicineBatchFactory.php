<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\BatchStatus;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<MedicineBatch>
 */
class MedicineBatchFactory extends Factory
{
    protected $model = MedicineBatch::class;

    public function definition(): array
    {
        $purchasePrice = rand(500, 20000) / 100;
        $quantity = rand(10, 200);

        return [
            'medicine_id' => Medicine::factory(),
            'batch_no' => 'B' . rand(1000, 9999) . strtoupper(Str::random(2)),
            'expiry_date' => now()->addDays(rand(90, 730))->format('Y-m-d'),
            'purchase_price' => $purchasePrice,
            'selling_price' => $purchasePrice * 1.2,
            'mrp' => $purchasePrice * 1.4,
            'effective_cost' => $purchasePrice,
            'quantity_received' => $quantity,
            // Cave law 1: this is a factory, not application code, and it still never writes
            // a quantity outside a ledger — tests that need a truthful balance pair this
            // factory's batch with a matching `opening_stock` StockTransaction, or call
            // InventoryService::receiveStock() to raise it, rather than trusting this raw value.
            'quantity_available' => $quantity,
            'status' => BatchStatus::Available,
            'purchase_item_id' => null,
            'supplier_id' => null,
        ];
    }

    public function expired(): static
    {
        return $this->state(fn (): array => [
            'expiry_date' => now()->subDays(rand(1, 365))->format('Y-m-d'),
            'status' => BatchStatus::Expired,
        ]);
    }

    public function quarantined(): static
    {
        return $this->state(fn (): array => ['status' => BatchStatus::Quarantined]);
    }

    public function finished(): static
    {
        return $this->state(fn (): array => [
            'quantity_available' => 0,
            'status' => BatchStatus::Finished,
        ]);
    }
}
