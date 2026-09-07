<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\StoreReturnRequest;
use App\Models\Sale;
use App\Services\ReturnService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Throwable;

/**
 * Sales returns. DR-RET-09: pharmacist or admin only — "a cashier cannot process a return,
 * because a return is the easiest way to remove money from a drawer." We standardise on the
 * `return.create` permission key (it is the key actually seeded per
 * brain/05-routes-and-modules.md §3's permission list; the prose in brain/03 §9.1 calls it
 * "the sale.return permission" but no such key exists in the seeded set, so `return.create`
 * is the one Gate call used consistently below and in StoreReturnRequest).
 */
class ReturnController extends Controller
{
    public function create(?Sale $sale = null): View
    {
        Gate::authorize('return.create');

        $sale?->load(['items.medicine', 'items.batch']);

        return view('returns.create', ['sale' => $sale]);
    }

    public function store(StoreReturnRequest $request): RedirectResponse
    {
        Gate::authorize('return.create');

        $sale = Sale::findOrFail($request->validated('sale_id'));

        try {
            $return = app(ReturnService::class)->processReturn(
                sale: $sale,
                returnLines: $request->validated('lines', []),
                userId: $request->user()->id,
                reason: $request->validated('reason'),
            );
        } catch (Throwable $e) {
            report($e);

            return back()->withInput()->withErrors([
                'lines' => 'The return could not be processed: '.$e->getMessage(),
            ]);
        }

        return redirect()
            ->route('returns.show', $return)
            ->with('status', 'Return processed.');
    }
}
