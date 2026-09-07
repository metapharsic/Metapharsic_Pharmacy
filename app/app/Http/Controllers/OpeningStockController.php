<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\BatchStatus;
use App\Enums\StockTransactionType;
use App\Http\Requests\StoreOpeningStockRequest;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Services\InventoryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class OpeningStockController extends Controller
{
    public function store(StoreOpeningStockRequest $request, Medicine $medicine, InventoryService $inventory): RedirectResponse
    {
        $validated = $request->validated();
        $qty = (int) $validated['quantity'];

        DB::transaction(function () use ($medicine, $validated, $qty, $inventory, $request) {
            $batch = MedicineBatch::query()->firstOrCreate(
                [
                    'medicine_id' => $medicine->id,
                    'batch_no' => $validated['batch_no'],
                    'expiry_date' => $validated['expiry_date'],
                ],
                [
                    'supplier_id' => $validated['supplier_id'] ?? null,
                    'purchase_price' => $validated['purchase_price'],
                    'selling_price' => $validated['selling_price'],
                    'mrp' => $validated['mrp'] ?? $validated['selling_price'],
                    'effective_cost' => $validated['purchase_price'],
                    'quantity_received' => 0,
                    'quantity_available' => 0,
                    'status' => BatchStatus::Available,
                ]
            );

            $batch->quantity_received += $qty;
            $batch->save();

            $inventory->receiveStock(
                batch: $batch,
                qty: $qty,
                type: StockTransactionType::OpeningStock->value,
                referenceType: MedicineBatch::class,
                referenceId: $batch->id,
                note: 'Initial opening stock balance',
                actor: $request->user(),
            );
        });

        return to_route('medicines.edit', $medicine)
            ->with('status', "Opening stock batch #{$validated['batch_no']} ({$qty} units) recorded successfully.");
    }
}
