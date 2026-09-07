<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $role = Role::query()->where('name', UserRole::Admin->value)->firstOrFail();

        // SECURITY: 'ChangeMe123!' is a placeholder for local/dev bootstrap only.
        // Set ADMIN_SEED_PASSWORD in .env for any shared or production environment
        // and CHANGE THIS PASSWORD immediately after the first login.
        $password = config('app.admin_seed_password') ?? 'ChangeMe123!';

        User::query()->firstOrCreate(
            ['email' => 'admin@metapharsic.local'],
            [
                'name' => 'Admin',
                'password' => Hash::make($password),
                'role_id' => $role->id,
                'is_active' => true,
                'email_verified_at' => now(),
            ],
        );
    }
}
