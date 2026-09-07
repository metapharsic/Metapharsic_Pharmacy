<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Enums\PaymentMode;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\Role;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PosCheckoutWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_cashier_can_checkout_sale_via_pos_api(): void
    {
        $adminRole = Role::query()->where('name', 'admin')->firstOrFail();
        $cashier = User::factory()->create(['role_id' => $adminRole->id]);

        $medicine = Medicine::factory()->create(['is_prescription_required' => false]);
        $batch = MedicineBatch::factory()->create([
            'medicine_id' => $medicine->id,
            'quantity_available' => 50,
            'selling_price' => '100.00',
            'mrp' => '100.00',
            'expiry_date' => now()->addYear(),
            'status' => BatchStatus::Available,
        ]);

        $postData = [
            'lines' => [
                [
                    'medicine_id' => $medicine->id,
                    'quantity' => 2,
                    'discount' => 0,
                ],
            ],
            'payments' => [
                [
                    'mode' => PaymentMode::Cash->value,
                    'amount' => 300.00, // Covers bill
                ],
            ],
        ];

        $response = $this->actingAs($cashier)->postJson('/pos', $postData);
        $response->assertCreated();
        $response->assertJsonStructure([
            'sale_id',
            'invoice_no',
            'print_a4_url',
            'print_80mm_url',
        ]);

        $saleId = $response->json('sale_id');
        $sale = Sale::query()->findOrFail($saleId);

        $batch->refresh();
        // 50 - 2 = 48
        $this->assertEquals(48, $batch->quantity_available);

        // Double-entry stock transaction created
        $this->assertDatabaseHas('stock_transactions', [
            'medicine_batch_id' => $batch->id,
            'quantity_change' => -2,
            'type' => 'sale',
        ]);
    }
}
