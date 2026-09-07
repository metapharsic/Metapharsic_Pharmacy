<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Phase 8f (rack master + capacity/occupancy management). `rack.manage` is
 * admin-only, same shape as `scheme.manage` / `license.manage`
 * (brain/11-gap-closure-architecture.md) — physical storage layout changes
 * affect where every future batch gets put away, admin-only gate.
 */
final class Phase8fPermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permission = Permission::firstOrCreate(['name' => 'rack.manage']);

        $admin = Role::where('name', 'admin')->first();
        $admin?->permissions()->syncWithoutDetaching([$permission->id]);
    }
}
