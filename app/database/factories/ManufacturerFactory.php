<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Manufacturer;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Manufacturer>
 */
class ManufacturerFactory extends Factory
{
    protected $model = Manufacturer::class;

    public function definition(): array
    {
        return [
            'name' => 'Manufacturer ' . ucfirst(Str::random(6)),
            'contact_person' => 'Contact ' . ucfirst(Str::random(5)),
            'phone' => '+91' . rand(7000000000, 9999999999),
            'email' => strtolower(Str::random(6)) . '@example.com',
            'address' => 'Plot ' . rand(1, 100) . ', Industrial Area',
            'is_active' => true,
        ];
    }
}
