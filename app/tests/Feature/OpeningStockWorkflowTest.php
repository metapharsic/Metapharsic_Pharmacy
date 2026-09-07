<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OpeningStockWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_admin_can_add_opening_stock_batch_to_medicine(): void
    {
        $adminRole = Role::query()->where('name', 'admin')->firstOrFail();
        $admin = User::factory()->create(['role_id' => $adminRole->id]);

        $medicine = Medicine::factory()->create();

        $postData = [
            'batch_no' => 'PCM-OPEN-001',
            'expiry_date' => now()->addMonths(24)->toDateString(),
            'quantity' => 50,
            'purchase_price' => '10.00',
            'selling_price' => '15.00',
            'mrp' => '15.00',
        ];

        $response = $this->actingAs($admin)->post("/medicines/{$medicine->id}/opening-stock", $postData);
        $response->assertSessionHasNoErrors();
        $response->assertRedirect("/medicines/{$medicine->id}/edit");

        // Batch created with opening balance
        $batch = MedicineBatch::query()->where('batch_no', 'PCM-OPEN-001')->firstOrFail();
        $this->assertEquals(50, $batch->quantity_available);
        $this->assertEquals(50, $batch->quantity_received);
        $this->assertEquals(BatchStatus::Available, $batch->status);

        // Double-entry stock transaction created
        $this->assertDatabaseHas('stock_transactions', [
            'medicine_batch_id' => $batch->id,
            'quantity_change' => 50,
            'type' => 'opening_stock',
        ]);
    }
}
