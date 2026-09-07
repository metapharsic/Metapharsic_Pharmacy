<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Models\LoginLog;
use Illuminate\Auth\Events\Failed;
use Illuminate\Http\Request;

/**
 * Writes a login_logs row for every failed login attempt.
 *
 * brain/08-security-and-audit.md §3: the password is never logged, not even hashed;
 * only the attempted identifier (email/username), IP, user agent, and outcome are
 * recorded. user_id is null when the credential does not resolve to a real user.
 *
 * Registered against Illuminate\Auth\Events\Failed. Laravel 12 auto-discovers this
 * listener from its handle(Failed $event) type hint; also wired explicitly in
 * AppServiceProvider::boot() for clarity on a security-relevant path.
 */
final class LogFailedLogin
{
    public function __construct(private readonly Request $request)
    {
    }

    public function handle(Failed $event): void
    {
        LoginLog::query()->create([
            'user_id' => $event->user?->getAuthIdentifier(),
            'email_attempted' => (string) ($event->credentials['email'] ?? ''),
            'ip_address' => $this->request->ip(),
            'user_agent' => (string) $this->request->userAgent(),
            'success' => false,
        ]);
    }
}
