<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Enums\PaymentMode;
use App\Enums\PaymentStatus;
use App\Enums\SaleStatus;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\Role;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\User;
use App\Services\ReturnService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReturnWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_pharmacist_can_process_return_and_restore_stock(): void
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

        $sale = Sale::query()->create([
            'invoice_no' => 'INV-RET-TEST-01',
            'user_id' => $admin->id,
            'subtotal' => '100.00',
            'discount' => '0.00',
            'gst_amount' => '12.00',
            'round_off' => '0.00',
            'total' => '112.00',
            'paid' => '112.00',
            'due' => '0.00',
            'payment_status' => PaymentStatus::Paid,
            'status' => SaleStatus::Completed,
            'sale_date' => now(),
        ]);

        $saleItem = SaleItem::query()->create([
            'sale_id' => $sale->id,
            'medicine_id' => $medicine->id,
            'medicine_batch_id' => $batch->id,
            'quantity' => 10,
            'unit_price' => '10.00',
            'discount' => '0.00',
            'gst_rate' => '12.00',
            'gst_amount' => '12.00',
            'line_total' => '112.00',
            'cost_price_at_sale' => '8.00',
            'returned_quantity' => 0,
        ]);

        // Process Return of 4 units
        $saleReturn = app(ReturnService::class)->processReturn(
            $sale,
            [['sale_item_id' => $saleItem->id, 'quantity' => 4]],
            $admin->id,
            'Customer purchased extra',
        );

        $this->assertNotNull($saleReturn->id);
        $batch->refresh();
        $saleItem->refresh();

        // 50 + 4 = 54
        $this->assertEquals(54, $batch->quantity_available);
        $this->assertEquals(4, $saleItem->returned_quantity);

        $this->assertDatabaseHas('stock_transactions', [
            'medicine_batch_id' => $batch->id,
            'quantity_change' => 4,
            'type' => 'sale_return',
        ]);
    }
}
