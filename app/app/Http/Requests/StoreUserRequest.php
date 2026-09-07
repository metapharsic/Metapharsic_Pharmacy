<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Admin-only, per brain/05-routes-and-modules.md `users.store` (`user.create`).
 * `user.create` is one of the four permanently admin-only keys hard-denied to
 * non-admins in the Gate regardless of the runtime grid (brain/08-security-and-audit.md §2).
 */
final class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->can('user.create');
    }

    /**
     * @return array<string, array<int, ValidationRule|string>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')],
            'role_id' => ['required', 'integer', Rule::exists('roles', 'id')],
            'password' => ['required', 'string', 'min:10', 'confirmed'],
            'is_active' => ['boolean'],
        ];
    }
}
