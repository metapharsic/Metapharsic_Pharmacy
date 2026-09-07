<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            'Analgesic',
            'Antibiotic',
            'Antacid',
            'Antihistamine',
            'Antidiabetic',
            'Cardiac',
            'Dermatology',
            'Vitamin & Supplement',
            'Cough & Cold',
            'Gastro',
        ];

        foreach ($categories as $name) {
            Category::query()->firstOrCreate(['name' => $name], ['is_active' => true]);
        }
    }
}
