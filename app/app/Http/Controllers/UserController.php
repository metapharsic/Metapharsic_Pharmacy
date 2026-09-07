<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\View\View;

/**
 * Admin-only user management (brain/05-routes-and-modules.md `/users`).
 *
 * Users are never deleted, only deactivated — sales.user_id and audit_logs.user_id
 * must stay resolvable for as long as the records are retained
 * (brain/05-routes-and-modules.md §2). There is deliberately no destroy() action;
 * deactivation happens through the dedicated UserStatusController (`users.status`),
 * not here.
 *
 * Gate::authorize() throws an AuthorizationException, which the framework renders
 * as HTTP 403 automatically — controllers never build a 403 response by hand
 * (brain/04-coding-standards.md §5: authorization lives in a Policy/Gate, never a
 * hand-rolled controller if).
 */
final class UserController extends Controller
{
    public function index(): View
    {
        Gate::authorize('user.view');

        $users = User::query()->with('role')->orderBy('name')->paginate(25);

        return view('users.index', ['users' => $users]);
    }

    public function create(): View
    {
        Gate::authorize('user.create');

        $roles = Role::query()->orderBy('name')->get();

        return view('users.create', ['roles' => $roles]);
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        Gate::authorize('user.create');

        $data = $request->validated();

        User::query()->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'role_id' => $data['role_id'],
            'password' => Hash::make($data['password']),
            'is_active' => $data['is_active'] ?? true,
        ]);

        return to_route('users.index')->with('status', __('User created.'));
    }

    public function edit(User $user): View
    {
        Gate::authorize('user.update');

        $roles = Role::query()->orderBy('name')->get();

        return view('users.edit', ['user' => $user, 'roles' => $roles]);
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        Gate::authorize('user.update');

        $user->update($request->validated());

        return to_route('users.index')->with('status', __('User updated.'));
    }

    /**
     * Deliberately not a real delete. brain/05-routes-and-modules.md: "Users are
     * never deleted, only deactivated." There is no `DELETE /users/{user}` route in
     * routes/web.php; this method exists only to document why, for anyone who goes
     * looking for the sixth CRUD action. Use UserStatusController (`users.status`,
     * `user.deactivate`) instead.
     */
    public function destroy(): never
    {
        abort(404);
    }
}
