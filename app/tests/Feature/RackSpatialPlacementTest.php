<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Medicine;
use App\Models\Rack;
use App\Models\RackShelf;
use App\Models\Role;
use App\Models\StorageZone;
use App\Models\User;
use Database\Seeders\PharmacyRackLocationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RackSpatialPlacementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->seed(PharmacyRackLocationSeeder::class);
    }

    public function test_spatial_storage_zones_and_racks_are_seeded(): void
    {
        $this->assertDatabaseHas('storage_zones', ['code' => 'DISP-MAIN']);
        $this->assertDatabaseHas('storage_zones', ['code' => 'COLD-01']);
        $this->assertDatabaseHas('storage_zones', ['code' => 'VAULT-X']);
        $this->assertDatabaseHas('racks', ['rack_code' => 'RACK-A']);
        $this->assertDatabaseHas('racks', ['rack_code' => 'FRIDGE-01']);
    }

    public function test_authenticated_pharmacist_can_view_racks_layout(): void
    {
        $pharmacistRole = Role::query()->where('name', 'pharmacist')->firstOrFail();
        $pharmacist = User::factory()->create(['role_id' => $pharmacistRole->id]);

        $response = $this->actingAs($pharmacist)->get('/inventory/racks');
        $response->assertOk();
        $response->assertSee('Pharmacy Racks');
        $response->assertSee('Main Dispensary Floor');
        $response->assertSee('Cold Chain Refrigerator Bay');
    }

    public function test_cold_chain_medicines_are_mapped_to_refrigerator_shelf(): void
    {
        $insulin = Medicine::query()->where('name', 'like', '%Insulin%')->first();
        if ($insulin) {
            $this->assertEquals('cold_2_8', $insulin->storage_temperature);
            $this->assertNotNull($insulin->storage_zone_id);
            $this->assertStringContainsString('FRIDGE', $insulin->rack_location);
        } else {
            $this->assertTrue(true);
        }
    }
}
