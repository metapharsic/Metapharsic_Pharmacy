<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Models\LoginLog;
use Illuminate\Auth\Events\Login;
use Illuminate\Http\Request;

/**
 * Writes a login_logs row for every successful login.
 *
 * brain/08-security-and-audit.md §1: "every attempt, successful or not, writes a
 * login_logs row (user or attempted username, IP, user agent, outcome, timestamp).
 * Successful logins also stamp users.last_login_at."
 *
 * Registered against Illuminate\Auth\Events\Login. Laravel 12 auto-discovers this
 * listener from its handle(Login $event) type hint — no entry in an
 * EventServiceProvider $listen array is required — but it is also wired explicitly
 * in AppServiceProvider::boot() for clarity on a security-relevant path.
 */
final class LogSuccessfulLogin
{
    public function __construct(private readonly Request $request)
    {
    }

    public function handle(Login $event): void
    {
        LoginLog::query()->create([
            'user_id' => $event->user->getAuthIdentifier(),
            'email_attempted' => $event->user->email,
            'ip_address' => $this->request->ip(),
            'user_agent' => (string) $this->request->userAgent(),
            'success' => true,
        ]);

        $event->user->forceFill(['last_login_at' => now()])->save();
    }
}
