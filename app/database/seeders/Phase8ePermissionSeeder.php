<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Phase 8e (shop drug licenses). `license.manage` is admin-only, same shape
 * as `scheme.manage` (brain/11-gap-closure-architecture.md) — shop-level
 * regulatory compliance records, admin-only gate.
 */
final class Phase8ePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permission = Permission::firstOrCreate(['name' => 'license.manage']);

        $admin = Role::where('name', 'admin')->first();
        $admin?->permissions()->syncWithoutDetaching([$permission->id]);
    }
}
