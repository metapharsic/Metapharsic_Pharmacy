<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Enums\PurchaseStatus;
use App\Models\Medicine;
use App\Models\Purchase;
use App\Models\Role;
use App\Models\Supplier;
use App\Models\User;
use App\Services\PurchaseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurchaseGrnWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_pharmacist_can_create_draft_purchase_and_confirm_stock_inward(): void
    {
        $adminRole = Role::query()->where('name', 'admin')->firstOrFail();
        $admin = User::factory()->create(['role_id' => $adminRole->id]);

        $supplier = Supplier::query()->first() ?? Supplier::query()->create([
            'name' => 'Apex Pharma Distributors',
            'state_code' => '27',
            'is_active' => true,
        ]);
        $medicine = Medicine::query()->first() ?? Medicine::factory()->create();

        $postData = [
            'supplier_id' => $supplier->id,
            'invoice_no' => 'INV-TEST-GRN-101',
            'invoice_date' => now()->toDateString(),
            'items' => [
                [
                    'medicine_id' => $medicine->id,
                    'batch_no' => 'BATCH-TEST-99',
                    'expiry_date' => now()->addMonths(18)->toDateString(),
                    'quantity' => 100,
                    'free_quantity' => 10,
                    'purchase_price' => 50.00,
                    'mrp' => 80.00,
                    'selling_price' => 75.00,
                    'gst_rate' => 12,
                ],
            ],
        ];

        // 1. Create Draft Purchase via HTTP
        $response = $this->actingAs($admin)->post('/purchases', $postData);
        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $purchase = Purchase::query()->where('invoice_no', 'INV-TEST-GRN-101')->firstOrFail();
        $this->assertEquals(PurchaseStatus::Draft, $purchase->status);

        // Draft touches no stock
        $this->assertDatabaseMissing('medicine_batches', [
            'medicine_id' => $medicine->id,
            'batch_no' => 'BATCH-TEST-99',
            'quantity_available' => 110,
        ]);

        // 2. Confirm Purchase via PurchaseService (Inward GRN commit)
        app(PurchaseService::class)->confirm($purchase, $admin);

        $purchase->refresh();
        $this->assertEquals(PurchaseStatus::Confirmed, $purchase->status);

        // Batch created with total received quantity (quantity + free_quantity)
        $this->assertDatabaseHas('medicine_batches', [
            'medicine_id' => $medicine->id,
            'batch_no' => 'BATCH-TEST-99',
            'status' => BatchStatus::Available->value,
            'quantity_available' => 110,
        ]);

        // Double-entry stock transaction created
        $this->assertDatabaseHas('stock_transactions', [
            'medicine_id' => $medicine->id,
            'quantity_change' => 110,
            'type' => 'purchase',
        ]);
    }
}
