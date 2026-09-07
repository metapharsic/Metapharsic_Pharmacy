<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\AdjustmentReason;
use App\Http\Requests\StoreStockAdjustmentRequest;
use App\Models\MedicineBatch;
use App\Models\StockAdjustment;
use App\Services\InventoryService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * Admin-only stock corrections. DR-ADJ-01: stock.adjust is permanently
 * admin-only at the Gate regardless of the runtime permission grid
 * (brain/05-routes-and-modules.md §3), so the `Gate::authorize` call below
 * is backstopped even if a role grid is ever misconfigured.
 */
final class StockAdjustmentController extends Controller
{
    /**
     * Read-only history of past adjustments, for review/audit. Same
     * admin-only Gate as create()/store() (DR-ADJ-01) — this is not a
     * separate, lighter permission.
     */
    public function index(Request $request): View
    {
        Gate::authorize('stock.adjust');

        $reasons = AdjustmentReason::cases();
        $reason = (string) $request->query('reason', '');

        $adjustments = StockAdjustment::query()
            ->with(['batch.medicine', 'user'])
            ->when($reason !== '', fn ($query) => $query->where('reason', $reason))
            ->latest('created_at')
            ->paginate(25)
            ->withQueryString();

        return view('stock-adjustments.index', compact('adjustments', 'reasons', 'reason'));
    }

    public function create(): View
    {
        Gate::authorize('stock.adjust');

        $batches = MedicineBatch::query()->with('medicine')->orderBy('expiry_date')->get();
        $reasons = AdjustmentReason::cases();

        return view('stock-adjustments.create', compact('batches', 'reasons'));
    }

    /**
     * One door for stock (cave law 1): the quantity change never touches
     * medicine_batches.quantity_available directly here. It always goes
     * through InventoryService::receiveStock() (positive) or
     * ::deductStock() (negative), which writes the matching
     * stock_transactions row inside the same transaction as the
     * StockAdjustment audit row.
     */
    public function store(StoreStockAdjustmentRequest $request, InventoryService $inventoryService): RedirectResponse
    {
        Gate::authorize('stock.adjust');

        $validated = $request->validated();
        $quantityChange = (int) $validated['quantity_change'];
        $reason = AdjustmentReason::from($validated['reason']);

        DB::transaction(function () use ($validated, $quantityChange, $reason, $inventoryService) {
            $batch = MedicineBatch::query()->lockForUpdate()->findOrFail($validated['medicine_batch_id']);

            $adjustment = StockAdjustment::create([
                'medicine_batch_id' => $batch->id,
                'reason' => $reason,
                'quantity_change' => $quantityChange,
                'note' => $validated['note'] ?? null,
                'user_id' => auth()->id(),
            ]);

            if ($quantityChange > 0) {
                $inventoryService->receiveStock(
                    $batch,
                    $quantityChange,
                    'adjustment_add',
                    StockAdjustment::class,
                    $adjustment->id,
                    $validated['note'] ?? null,
                    auth()->user(),
                );
            } else {
                // DR-ADJ-07: an adjustment can never take quantity_available
                // below zero; InventoryService::deductStock() enforces this
                // inside the locked transaction, not this controller.
                $inventoryService->deductStock(
                    $batch,
                    abs($quantityChange),
                    'adjustment_remove',
                    StockAdjustment::class,
                    $adjustment->id,
                    $validated['note'] ?? null,
                    auth()->user(),
                );
            }
        });

        return redirect()
            ->route('inventory.index')
            ->with('status', 'Stock adjustment recorded.');
    }
}
