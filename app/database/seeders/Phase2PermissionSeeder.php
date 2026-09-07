<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Adds Phase 2 master-data permissions and attaches them per the role matrix
 * in brain/08-security-and-audit.md. Run after Phase 1's RolePermissionSeeder.
 */
final class Phase2PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $resources = ['category', 'manufacturer', 'medicine', 'supplier', 'customer'];
        $actions = ['view', 'create', 'update', 'delete'];

        $names = [];
        foreach ($resources as $resource) {
            foreach ($actions as $action) {
                $names[] = "{$resource}.{$action}";
            }
        }

        $permissions = collect($names)->mapWithKeys(
            fn (string $name) => [$name => Permission::firstOrCreate(['name' => $name])]
        );

        $admin = Role::where('name', 'admin')->first();
        $pharmacist = Role::where('name', 'pharmacist')->first();
        $cashier = Role::where('name', 'cashier')->first();

        $admin?->permissions()->syncWithoutDetaching($permissions->pluck('id'));

        $pharmacistNames = collect($names)->filter(fn (string $n) => ! str_ends_with($n, '.delete'));
        $pharmacist?->permissions()->syncWithoutDetaching($permissions->only($pharmacistNames)->pluck('id'));

        $cashierNames = collect($names)->filter(fn (string $n) => str_ends_with($n, '.view'));
        $cashier?->permissions()->syncWithoutDetaching($permissions->only($cashierNames)->pluck('id'));
    }
}
