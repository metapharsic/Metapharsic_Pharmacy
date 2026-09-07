<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Audit log viewer — brain/08-security-and-audit.md §3, phase-5-reports.md T-0508.
 *
 * Read-only by construction: there is no store/update/destroy action here,
 * and no route in web.php points at one. `audit_logs` is append-only and is
 * written only by AuditService and model observers, never from a controller.
 *
 * Admin-only: audit.view is not granted to pharmacist or cashier under the
 * default permission grid (brain/08 §2.1), and unlike the four hard-denied
 * keys this one is an ordinary Gate check, not a `before` hard-deny — kept
 * consistent with the grid rather than escalated, since nothing in phase-5
 * calls for hard-denying it.
 */
final class AuditLogController extends Controller
{
    public function index(Request $request): View
    {
        Gate::authorize('audit.view');

        $logs = AuditLog::query()
            ->with('user')
            ->when(
                $request->filled('user_id'),
                fn ($q) => $q->where('user_id', $request->integer('user_id')),
            )
            ->when(
                $request->filled('action'),
                fn ($q) => $q->where('action', $request->string('action')->toString()),
            )
            ->when(
                $request->filled('date_from'),
                fn ($q) => $q->whereDate('created_at', '>=', $request->date('date_from')),
            )
            ->when(
                $request->filled('date_to'),
                fn ($q) => $q->whereDate('created_at', '<=', $request->date('date_to')),
            )
            ->orderByDesc('created_at')
            ->paginate(50)
            ->withQueryString();

        // For the filter dropdowns only — never used to scope the query
        // itself beyond the explicit user_id filter above.
        $users = User::query()->orderBy('name')->get(['id', 'name']);

        $actions = AuditLog::query()
            ->select('action')
            ->distinct()
            ->orderBy('action')
            ->pluck('action');

        return view('audit-logs.index', compact('logs', 'users', 'actions'));
    }
}
