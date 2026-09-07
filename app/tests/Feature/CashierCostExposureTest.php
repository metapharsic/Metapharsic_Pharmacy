<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Medicine;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CashierCostExposureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_cashier_cannot_access_profit_report(): void
    {
        $cashierRole = Role::query()->where('name', 'cashier')->firstOrFail();
        $cashier = User::factory()->create(['role_id' => $cashierRole->id]);

        $response = $this->actingAs($cashier)->get('/reports/profit');
        $response->assertForbidden();
    }

    public function test_cashier_cannot_access_stock_valuation_report(): void
    {
        $cashierRole = Role::query()->where('name', 'cashier')->firstOrFail();
        $cashier = User::factory()->create(['role_id' => $cashierRole->id]);

        $response = $this->actingAs($cashier)->get('/reports/stock-valuation');
        $response->assertForbidden();
    }

    public function test_cashier_cannot_manage_users(): void
    {
        $cashierRole = Role::query()->where('name', 'cashier')->firstOrFail();
        $cashier = User::factory()->create(['role_id' => $cashierRole->id]);

        $response = $this->actingAs($cashier)->get('/users');
        $response->assertForbidden();
    }
}
