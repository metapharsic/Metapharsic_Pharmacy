<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

final class Phase3PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $names = [
            'purchase.view',
            'purchase.create',
            'purchase.update',
            'purchase.confirm',
            'purchase.cancel',
            'inventory.view',
            'inventory.ledger',
            'inventory.verify',
            'inventory.price_change',
            'inventory.quarantine',
            'stock.adjust',
            'stock.opening',
            'stock.writeoff',
        ];

        $permissions = collect($names)->mapWithKeys(
            fn (string $name) => [$name => Permission::firstOrCreate(['name' => $name])]
        );

        $admin = Role::where('name', 'admin')->first();
        $pharmacist = Role::where('name', 'pharmacist')->first();
        $cashier = Role::where('name', 'cashier')->first();

        $admin?->permissions()->syncWithoutDetaching($permissions->pluck('id'));

        // Pharmacist gets purchase.* and inventory.* except stock.adjust (hard admin only)
        $pharmacistNames = collect($names)->filter(fn (string $n) => $n !== 'stock.adjust' && $n !== 'stock.opening');
        $pharmacist?->permissions()->syncWithoutDetaching($permissions->only($pharmacistNames)->pluck('id'));

        // Cashier gets inventory.view
        $cashierNames = ['inventory.view'];
        $cashier?->permissions()->syncWithoutDetaching($permissions->only($cashierNames)->pluck('id'));
    }
}
