<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Manufacturer;
use Illuminate\Database\Seeder;

class ManufacturerSeeder extends Seeder
{
    public function run(): void
    {
        $manufacturers = [
            'Cipla',
            'Sun Pharma',
            "Dr Reddy's",
            'Mankind',
            'Alkem',
            'Zydus',
            'Lupin',
            'GSK',
        ];

        foreach ($manufacturers as $name) {
            Manufacturer::query()->firstOrCreate(['name' => $name], ['is_active' => true]);
        }
    }
}
