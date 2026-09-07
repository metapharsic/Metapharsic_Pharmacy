<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Medicine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Medicine typeahead search and exact barcode lookup.
 *
 * Cave law: cashier/clerk never sees cost. Both actions select an explicit,
 * narrow column list and never touch default_purchase_price or any batch
 * cost column — enforced here in the query, not by hiding fields in JSON
 * serialization, per brain/CLAUDE.md cave law 2.
 *
 * Speed budget: brain/06-ui-conventions.md section 8 requires p95 < 150ms
 * for search over 5,000 medicines / 20,000 batches. That is why:
 *   - only a fixed column list is selected (no SELECT *)
 *   - category/manufacturer are eager-loaded with their own narrow column
 *     lists to avoid an N+1 without pulling unused columns
 *   - the query is capped at 20 rows and orders by nothing exotic
 *   - matching relies on the pg_trgm GIN index on medicines.name /
 *     generic_name (brain/02-database-schema.md); this controller assumes
 *     that index exists and does not fall back to a LIKE '%...%' scan.
 */
final class MedicineSearchController extends Controller
{
    private const SEARCH_LIMIT = 20;

    /**
     * GET /api/medicines/search?q=par
     */
    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:3', 'max:100'],
        ]);

        $term = trim($validated['q']);

        $medicines = Medicine::query()
            ->select(['id', 'name', 'generic_name', 'barcode', 'unit', 'category_id', 'manufacturer_id', 'gst_rate', 'rack_location', 'storage_temperature', 'is_prescription_required'])
            ->whereNull('deleted_at')
            ->where('is_active', true)
            ->where(function ($query) use ($term) {
                $query->whereRaw('name ILIKE ?', ["%{$term}%"])
                    ->orWhereRaw('generic_name ILIKE ?', ["%{$term}%"]);
            })
            ->with([
                'category:id,name',
                'manufacturer:id,name',
            ])
            ->limit(self::SEARCH_LIMIT)
            ->get();

        return response()->json([
            'data' => $medicines->map(fn (Medicine $medicine) => [
                'id' => $medicine->id,
                'name' => $medicine->name,
                'generic_name' => $medicine->generic_name,
                'barcode' => $medicine->barcode,
                'unit' => $medicine->unit,
                'category' => $medicine->category?->name,
                'manufacturer' => $medicine->manufacturer?->name,
                'gst_rate' => $medicine->gst_rate,
                'rack_location' => $medicine->rack_location,
                'storage_temperature' => $medicine->storage_temperature,
                'is_prescription_required' => $medicine->is_prescription_required,
            ]),
        ]);
    }

    /**
     * GET /api/medicines/barcode/{code}
     *
     * Exact match only — the b-tree unique index on barcode makes this
     * a point lookup, not a scan. {code} is deliberately not route-model
     * bound: barcodes can be re-scanned/changed on a medicine, ids don't.
     */
    public function barcode(string $code): JsonResponse
    {
        $medicine = Medicine::query()
            ->select(['id', 'name', 'generic_name', 'barcode', 'unit', 'category_id', 'manufacturer_id', 'gst_rate', 'rack_location', 'storage_temperature', 'is_prescription_required'])
            ->whereNull('deleted_at')
            ->where('is_active', true)
            ->where('barcode', $code)
            ->with([
                'category:id,name',
                'manufacturer:id,name',
            ])
            ->first();

        if ($medicine === null) {
            return response()->json(['message' => 'No medicine found for that barcode.'], 404);
        }

        return response()->json([
            'data' => [
                'id' => $medicine->id,
                'name' => $medicine->name,
                'generic_name' => $medicine->generic_name,
                'barcode' => $medicine->barcode,
                'unit' => $medicine->unit,
                'category' => $medicine->category?->name,
                'manufacturer' => $medicine->manufacturer?->name,
                'gst_rate' => $medicine->gst_rate,
                'rack_location' => $medicine->rack_location,
                'storage_temperature' => $medicine->storage_temperature,
                'is_prescription_required' => $medicine->is_prescription_required,
            ],
        ]);
    }
}
