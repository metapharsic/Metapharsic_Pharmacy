<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\Permission;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

final class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // See brain/09-queries.md / 04-coding-standards.md §9: lazy loading is a bug in
        // every environment except production, where it only logs so a missed relation
        // never takes the shop down mid-sale.
        Model::preventLazyLoading(! app()->isProduction());
        Model::preventSilentlyDiscardingAttributes(! app()->isProduction());
        Model::preventAccessingMissingAttributes(! app()->isProduction());

        $this->registerGates();

        // Login/failed-login audit logging (brain/08-security-and-audit.md §1, §3).
        // Laravel 12 auto-discovers listeners in app/Listeners by their handle() type
        // hint, so no explicit $listen map or EventServiceProvider is required. These
        // two lines are here only as documentation of the wiring; they are safe to
        // remove once auto-discovery is confirmed, but are kept explicit for clarity
        // in a security-relevant path.
        Event::listen(Login::class, \App\Listeners\LogSuccessfulLogin::class);
        Event::listen(Failed::class, \App\Listeners\LogFailedLogin::class);
    }

    /**
     * Register the permission Gate.
     *
     * brain/08-security-and-audit.md §2: gates are registered from the seeded
     * permission table, with a `before` callback that grants an admin everything,
     * and Gate::authorize() throws an AuthorizationException (HTTP 403) automatically
     * when a check fails — callers never need to hand-roll a 403 response.
     */
    private function registerGates(): void
    {
        Gate::before(function ($user, string $ability): ?bool {
            if ($user->role?->name === 'admin') {
                return true;
            }

            // Hard-denied keys to non-admins per brain/08-security-and-audit.md §2
            if (in_array($ability, ['stock.adjust', 'report.profit', 'role.permission', 'user.manage'], true)) {
                return false;
            }

            if ($user->role !== null && $user->role->permissions->pluck('name')->contains($ability)) {
                return true;
            }

            return null;
        });

        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('permissions')) {
                foreach (Permission::pluck('name') as $permission) {
                    Gate::define($permission, function ($user) use ($permission): bool {
                        return $user->role !== null
                            && $user->role->permissions->contains('name', $permission);
                    });
                }
            }
        } catch (\Throwable) {
            // Database not yet migrated or connected
        }
    }
}
