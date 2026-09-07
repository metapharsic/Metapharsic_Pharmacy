<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\AuthManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Shared shop terminal idle lock — brain/08-security-and-audit.md §"Idle screen lock":
 * "after N minutes without input ... an opaque overlay covers the screen and the
 * session ends." This middleware is the server-side half of that: it force-logs-out a
 * session whose last recorded activity is older than the configured idle timeout.
 *
 * brain/08 §threat-model row states 10 minutes for the shared-terminal threat model.
 * This scaffold takes `config('pharmacy.idle_timeout_minutes', 15)` as instructed for
 * Phase 6, which is LOOSER than brain/08's documented 10 minutes — set
 * PHARMACY_IDLE_TIMEOUT_MINUTES=10 in .env on the real deployment to match brain/08,
 * or update brain/08 in the same commit if 15 is a deliberate, reconsidered value.
 * Do not ship 15 silently as if it were brain/08's number.
 *
 * This is a hard logout + redirect, not just a UI overlay: the UI overlay (JS idle
 * timer) is a separate, client-side affordance for a *faster* perceived lock; this
 * middleware is the layer that actually cannot be bypassed by editing the DOM, since
 * it invalidates the session server-side on the next request after the timeout.
 *
 * Registration (bootstrap/app.php) — NOT applied here since bootstrap/app.php is not
 * being overwritten wholesale by this phase:
 *
 *     ->withMiddleware(function (Middleware $middleware): void {
 *         $middleware->alias(['idle.lock' => \App\Http\Middleware\IdleSessionLock::class]);
 *         // Add 'idle.lock' to the 'web' group (or to the same route group that
 *         // wraps routes/web.php's `auth` middleware) so it runs on every
 *         // authenticated request:
 *         $middleware->appendToGroup('web', \App\Http\Middleware\IdleSessionLock::class);
 *     })
 */
class IdleSessionLock
{
    private const SESSION_KEY = 'idle_lock.last_activity_at';

    public function __construct(
        private readonly AuthManager $auth,
    ) {
    }

    public function handle(Request $request, Closure $next): Response
    {
        if (! $this->auth->check()) {
            return $next($request);
        }

        $timeoutMinutes = (int) config('pharmacy.idle_timeout_minutes', 15);
        $now = time();
        $lastActivity = (int) $request->session()->get(self::SESSION_KEY, $now);

        if (($now - $lastActivity) > ($timeoutMinutes * 60)) {
            $this->auth->guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()
                ->route('login')
                ->with('status', "You were logged out after {$timeoutMinutes} minutes of inactivity. Please sign in again.");
        }

        // Touch last-activity on every authenticated request that passes through.
        $request->session()->put(self::SESSION_KEY, $now);

        return $next($request);
    }
}
