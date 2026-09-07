<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Phase 8a (discount schemes). `scheme.manage` is admin-only, same shape as
 * `stock.adjust` (brain/11-gap-closure-architecture.md) — a shop-defined "buy 2 get 1
 * free" rule changes real money on every future sale, so it gets the same single
 * admin-only gate as a manual stock correction, not a broader role grant.
 */
final class Phase8PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permission = Permission::firstOrCreate(['name' => 'scheme.manage']);

        $admin = Role::where('name', 'admin')->first();
        $admin?->permissions()->syncWithoutDetaching([$permission->id]);
    }
}
