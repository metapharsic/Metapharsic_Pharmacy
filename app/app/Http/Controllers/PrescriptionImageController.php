<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Sale;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Phase 8b: attach/view a prescription photo or scan against an existing
 * Prescription row (created during POS checkout by SalesService::createSale —
 * this controller never creates one).
 *
 * Storage: the private 'local' disk (storage/app/private), never the
 * 'public' disk. A prescription image is a patient health document; it must
 * never be reachable via a bare public URL, only through this
 * authenticated, sale.view-gated controller. Both actions re-check
 * Gate::authorize('sale.view', $sale) themselves rather than relying solely
 * on route middleware, matching SaleController::cancel()'s style.
 *
 * One image per prescription, immutable once set: DR-RX-07 says a
 * prescription row is never edited/deleted — a wrong entry is corrected by
 * cancelling the sale and re-billing, not by overwriting the image.
 */
class PrescriptionImageController extends Controller
{
    public function store(Request $request, Sale $sale): RedirectResponse
    {
        Gate::authorize('sale.view', $sale);

        $request->validate([
            'image' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
        ]);

        $prescription = $sale->prescription()->firstOrFail();

        if ($prescription->hasImage()) {
            return back()->withErrors([
                'image' => 'A prescription image has already been attached to this invoice and cannot be replaced. Cancel and re-bill the sale to correct it.',
            ]);
        }

        $file = $request->file('image');
        $extension = $file->getClientOriginalExtension() ?: $file->extension();
        $path = $file->storeAs(
            "prescriptions/{$sale->id}",
            Str::uuid()->toString() . '.' . $extension,
            'local',
        );

        $prescription->update([
            'image_path' => $path,
            'image_uploaded_at' => now(),
        ]);

        return redirect()
            ->route('sales.show', $sale)
            ->with('status', "Prescription image attached to invoice {$sale->invoice_no}.");
    }

    public function show(Sale $sale): Response
    {
        Gate::authorize('sale.view', $sale);

        $prescription = $sale->prescription()->firstOrFail();

        if (! $prescription->hasImage()) {
            abort(404);
        }

        return Storage::disk('local')->response($prescription->image_path);
    }
}
