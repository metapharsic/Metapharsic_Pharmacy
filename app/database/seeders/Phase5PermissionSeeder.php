<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

final class Phase5PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $names = [
            'report.view',
            'report.profit',
            'report.valuation',
            'report.export',
            'audit.view',
        ];

        $permissions = collect($names)->mapWithKeys(
            fn (string $name) => [$name => Permission::firstOrCreate(['name' => $name])]
        );

        $admin = Role::where('name', 'admin')->first();
        $pharmacist = Role::where('name', 'pharmacist')->first();

        $admin?->permissions()->syncWithoutDetaching($permissions->pluck('id'));

        // Pharmacist gets report.view, report.export (profit and valuation are admin-only per Cave Law 2)
        $pharmacistNames = ['report.view', 'report.export'];
        $pharmacist?->permissions()->syncWithoutDetaching($permissions->only($pharmacistNames)->pluck('id'));
    }
}
