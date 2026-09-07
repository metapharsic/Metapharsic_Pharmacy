<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Consolidated seed order for a fresh shop. Roles/permissions must exist
 * before the admin user; category/manufacturer are reference data medicines
 * point at later. Run: php artisan db:seed
 */
final class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolePermissionSeeder::class,
            Phase2PermissionSeeder::class,
            Phase3PermissionSeeder::class,
            Phase4PermissionSeeder::class,
            Phase5PermissionSeeder::class,
            Phase8PermissionSeeder::class,
            Phase8ePermissionSeeder::class,
            Phase8fPermissionSeeder::class,
            AdminUserSeeder::class,
            CategorySeeder::class,
            ManufacturerSeeder::class,
            PharmacyRackLocationSeeder::class,
        ]);
    }
}
