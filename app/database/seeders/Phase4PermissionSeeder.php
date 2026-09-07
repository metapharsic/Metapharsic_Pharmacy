<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * POS/trade permissions, attached per brain/08-security-and-audit.md.
 * Cashier gets sale.create only — never sale.void, never return.create,
 * never purchase.* — those stay pharmacist/admin (cave-adjacent rule:
 * discount above cap and any cancel/return is a supervised action).
 */
final class Phase4PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $names = [
            'sale.create', 'sale.void', 'return.create',
            'purchase.create', 'stock.adjust',
        ];

        $permissions = collect($names)->mapWithKeys(
            fn (string $n) => [$n => Permission::firstOrCreate(['name' => $n])]
        );

        $admin = Role::where('name', 'admin')->first();
        $pharmacist = Role::where('name', 'pharmacist')->first();
        $cashier = Role::where('name', 'cashier')->first();

        $admin?->permissions()->syncWithoutDetaching($permissions->pluck('id'));

        $pharmacistNames = ['sale.create', 'sale.void', 'return.create', 'purchase.create'];
        $pharmacist?->permissions()->syncWithoutDetaching($permissions->only($pharmacistNames)->pluck('id'));

        $cashier?->permissions()->syncWithoutDetaching($permissions->only(['sale.create'])->pluck('id'));
    }
}
