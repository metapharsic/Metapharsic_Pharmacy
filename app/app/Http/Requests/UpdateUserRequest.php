<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Admin-only, per brain/05-routes-and-modules.md `users.update` (`user.update`).
 * Password is intentionally absent here: password resets go through the dedicated
 * `users.password` route/UserPasswordController (`user.reset_password`), and
 * activation state through `users.status` (`user.deactivate`) — this request only
 * ever edits name, email, and role.
 */
final class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->can('user.update');
    }

    /**
     * @return array<string, array<int, ValidationRule|string>>
     */
    public function rules(): array
    {
        $userId = $this->route('user')?->id;

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($userId)],
            'role_id' => ['required', 'integer', Rule::exists('roles', 'id')],
        ];
    }
}
