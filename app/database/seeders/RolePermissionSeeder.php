<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    /** @var list<string> */
    private const PERMISSIONS = [
        'user.manage',
        'sale.create',
        'sale.void',
        'sale.discount_override',
        'purchase.create',
        'stock.adjust',
        'report.profit',
        'report.view',
        'audit.view',
        'settings.manage',
    ];

    /**
     * Role => permission key list. Admin gets everything; pharmacist and
     * cashier get the narrow slice the cave laws allow — cashier in
     * particular never gets report.profit (cost visibility is a query-layer
     * concern in later phases, but the permission itself must not exist for
     * cashier here).
     *
     * @var array<string, list<string>>
     */
    private const ROLE_PERMISSIONS = [
        'admin' => self::PERMISSIONS,
        'pharmacist' => [
            'sale.create',
            'sale.void',
            'sale.discount_override',
            'purchase.create',
            'report.view',
        ],
        'cashier' => [
            'sale.create',
        ],
    ];

    public function run(): void
    {
        $permissions = collect(self::PERMISSIONS)->mapWithKeys(
            fn (string $name): array => [$name => Permission::query()->firstOrCreate(['name' => $name])]
        );

        foreach (UserRole::cases() as $userRole) {
            $role = Role::query()->firstOrCreate(['name' => $userRole->value]);

            $keys = self::ROLE_PERMISSIONS[$userRole->value];
            $ids = $permissions->only($keys)->map(fn (Permission $permission): int => $permission->id);

            $role->permissions()->sync($ids);
        }
    }
}
