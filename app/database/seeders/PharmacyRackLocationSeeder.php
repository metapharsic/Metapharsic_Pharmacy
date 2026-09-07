<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Medicine;
use App\Models\Rack;
use App\Models\RackBin;
use App\Models\RackShelf;
use App\Models\StorageZone;
use Illuminate\Database\Seeder;

class PharmacyRackLocationSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Storage Zones
        $dispensary = StorageZone::query()->firstOrCreate(['code' => 'DISP-MAIN'], [
            'name' => 'Main Dispensary Floor',
            'temperature_type' => 'ambient_15_25',
            'humidity_controlled' => false,
            'description' => 'General climate-controlled pharmacy floor (15°C–25°C)',
            'is_active' => true,
        ]);

        $coldChain = StorageZone::query()->firstOrCreate(['code' => 'COLD-01'], [
            'name' => 'Cold Chain Refrigerator Bay',
            'temperature_type' => 'cold_2_8',
            'humidity_controlled' => true,
            'description' => 'Dedicated pharmaceutical refrigerator (2°C–8°C) with continuous digital logging',
            'is_active' => true,
        ]);

        $narcoticVault = StorageZone::query()->firstOrCreate(['code' => 'VAULT-X'], [
            'name' => 'Narcotic & Controlled Substance Vault',
            'temperature_type' => 'ambient_15_25',
            'humidity_controlled' => false,
            'description' => 'Double-lock biometric access vault for Schedule X and Schedule H1 drugs',
            'is_active' => true,
        ]);

        $fastMoverZone = StorageZone::query()->firstOrCreate(['code' => 'FAST-BAY'], [
            'name' => 'Counter-Adjacent Rapid Picking Bay',
            'temperature_type' => 'ambient_15_25',
            'humidity_controlled' => false,
            'description' => 'Direct reach racks for top 50 daily moving OTC and acute medicines',
            'is_active' => true,
        ]);

        // 2. Physical Racks & Storage Units
        $racksData = [
            [
                'storage_zone_id' => $dispensary->id,
                'rack_code' => 'RACK-A',
                'name' => 'Rack A — Antibiotics & Anti-Infectives',
                'aisle' => 'Aisle 1',
                'row_number' => 1,
                'column_number' => 1,
                'total_shelves' => 5,
                'max_capacity_boxes' => 500,
            ],
            [
                'storage_zone_id' => $dispensary->id,
                'rack_code' => 'RACK-B',
                'name' => 'Rack B — Cardiovascular & Antidiabetic',
                'aisle' => 'Aisle 1',
                'row_number' => 1,
                'column_number' => 2,
                'total_shelves' => 5,
                'max_capacity_boxes' => 500,
            ],
            [
                'storage_zone_id' => $dispensary->id,
                'rack_code' => 'RACK-C',
                'name' => 'Rack C — Gastrointestinal & Respiratory',
                'aisle' => 'Aisle 2',
                'row_number' => 2,
                'column_number' => 1,
                'total_shelves' => 5,
                'max_capacity_boxes' => 500,
            ],
            [
                'storage_zone_id' => $fastMoverZone->id,
                'rack_code' => 'RACK-FAST',
                'name' => 'Rack Fast — OTC, Analgesics & First-Aid',
                'aisle' => 'Counter-Front',
                'row_number' => 0,
                'column_number' => 1,
                'total_shelves' => 4,
                'max_capacity_boxes' => 300,
            ],
            [
                'storage_zone_id' => $coldChain->id,
                'rack_code' => 'FRIDGE-01',
                'name' => 'Pharma Fridge 01 — Insulins, Vaccines & Biologics',
                'aisle' => 'Cold Bay',
                'row_number' => 1,
                'column_number' => 1,
                'total_shelves' => 4,
                'max_capacity_boxes' => 200,
            ],
            [
                'storage_zone_id' => $narcoticVault->id,
                'rack_code' => 'VAULT-01',
                'name' => 'Narcotics Vault Safe 01 — Schedule X & H1',
                'aisle' => 'Vault Room',
                'row_number' => 1,
                'column_number' => 1,
                'total_shelves' => 3,
                'max_capacity_boxes' => 150,
            ],
        ];

        foreach ($racksData as $rData) {
            $rack = Rack::query()->firstOrCreate(['rack_code' => $rData['rack_code']], $rData);

            for ($s = 1; $s <= $rData['total_shelves']; $s++) {
                $shelfCode = "{$rack->rack_code}-S{$s}";
                $shelf = RackShelf::query()->firstOrCreate(['shelf_code' => $shelfCode], [
                    'rack_id' => $rack->id,
                    'shelf_number' => $s,
                    'capacity_units' => 100,
                    'notes' => "Shelf level {$s} in {$rack->name}",
                ]);

                // Create 4 bins per shelf
                for ($b = 1; $b <= 4; $b++) {
                    $binCode = "{$shelfCode}-B0{$b}";
                    RackBin::query()->firstOrCreate(['bin_code' => $binCode], [
                        'rack_shelf_id' => $shelf->id,
                        'name' => "Bin {$b}",
                    ]);
                }
            }
        }

        // Map existing seeded medicines to designated physical racks
        $rackA_S1 = RackShelf::query()->where('shelf_code', 'RACK-A-S1')->first();
        $rackB_S1 = RackShelf::query()->where('shelf_code', 'RACK-B-S1')->first();
        $rackFast_S2 = RackShelf::query()->where('shelf_code', 'RACK-FAST-S2')->first();
        $fridge_S1 = RackShelf::query()->where('shelf_code', 'FRIDGE-01-S1')->first();

        foreach (Medicine::all() as $medicine) {
            if (stripos($medicine->name, 'insulin') !== false || stripos($medicine->name, 'vaccine') !== false) {
                $medicine->update([
                    'storage_zone_id' => $coldChain->id,
                    'rack_id' => $fridge_S1?->rack_id,
                    'rack_shelf_id' => $fridge_S1?->id,
                    'storage_temperature' => 'cold_2_8',
                    'rack_location' => $fridge_S1?->shelf_code,
                ]);
            } elseif (stripos($medicine->name, 'paracetamol') !== false || stripos($medicine->name, 'cetirizine') !== false) {
                $medicine->update([
                    'storage_zone_id' => $fastMoverZone->id,
                    'rack_id' => $rackFast_S2?->rack_id,
                    'rack_shelf_id' => $rackFast_S2?->id,
                    'storage_temperature' => 'ambient_15_25',
                    'rack_location' => $rackFast_S2?->shelf_code,
                ]);
            } elseif (stripos($medicine->name, 'amoxicillin') !== false || stripos($medicine->name, 'azithromycin') !== false) {
                $medicine->update([
                    'storage_zone_id' => $dispensary->id,
                    'rack_id' => $rackA_S1?->rack_id,
                    'rack_shelf_id' => $rackA_S1?->id,
                    'storage_temperature' => 'ambient_15_25',
                    'rack_location' => $rackA_S1?->shelf_code,
                ]);
            } else {
                $medicine->update([
                    'storage_zone_id' => $dispensary->id,
                    'rack_id' => $rackB_S1?->rack_id,
                    'rack_shelf_id' => $rackB_S1?->id,
                    'storage_temperature' => 'ambient_15_25',
                    'rack_location' => $rackB_S1?->shelf_code ?? 'RACK-B-S1',
                ]);
            }
        }
    }
}
