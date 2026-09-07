<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\AdjustmentReason;
use App\Enums\BatchStatus;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StockAdjustmentWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_admin_can_perform_stock_deduction_adjustment_for_damaged_vials(): void
    {
        $adminRole = Role::query()->where('name', 'admin')->firstOrFail();
        $admin = User::factory()->create(['role_id' => $adminRole->id]);

        $medicine = Medicine::query()->first() ?? Medicine::factory()->create();
        $batch = MedicineBatch::factory()->create([
            'medicine_id' => $medicine->id,
            'quantity_available' => 100,
            'expiry_date' => now()->addYear(),
            'status' => BatchStatus::Available,
        ]);

        $postData = [
            'medicine_batch_id' => $batch->id,
            'reason' => AdjustmentReason::Damaged->value,
            'quantity_change' => -5,
            'note' => 'Vial dropped and broken during shelf inspection',
        ];

        $response = $this->actingAs($admin)->post('/stock-adjustments', $postData);
        $response->assertSessionHasNoErrors();
        $response->assertRedirect('/inventory');

        $batch->refresh();
        $this->assertEquals(95, $batch->quantity_available);

        $this->assertDatabaseHas('stock_transactions', [
            'medicine_batch_id' => $batch->id,
            'quantity_change' => -5,
            'type' => 'adjustment_remove',
        ]);
    }

    public function test_admin_can_perform_positive_stock_adjustment_for_counting_error(): void
    {
        $adminRole = Role::query()->where('name', 'admin')->firstOrFail();
        $admin = User::factory()->create(['role_id' => $adminRole->id]);

        $medicine = Medicine::query()->first() ?? Medicine::factory()->create();
        $batch = MedicineBatch::factory()->create([
            'medicine_id' => $medicine->id,
            'quantity_available' => 50,
            'expiry_date' => now()->addYear(),
            'status' => BatchStatus::Available,
        ]);

        $postData = [
            'medicine_batch_id' => $batch->id,
            'reason' => AdjustmentReason::CountingError->value,
            'quantity_change' => 10,
            'note' => 'Physical cycle count revealed +10 units',
        ];

        $response = $this->actingAs($admin)->post('/stock-adjustments', $postData);
        $response->assertSessionHasNoErrors();
        $response->assertRedirect('/inventory');

        $batch->refresh();
        $this->assertEquals(60, $batch->quantity_available);

        $this->assertDatabaseHas('stock_transactions', [
            'medicine_batch_id' => $batch->id,
            'quantity_change' => 10,
            'type' => 'adjustment_add',
        ]);
    }
}
