<?php

declare(strict_types=1);

use App\Http\Controllers\Api\MedicineSearchController;
use App\Http\Controllers\PosController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| routes/api.php — POS's own private transport (session-authenticated)
|--------------------------------------------------------------------------
|
| Per brain/05-routes-and-modules.md this is NOT a public API: no /api/v1,
| no token issuer. `api` + `auth:web` (same session cookie) + `throttle:pos`
| (300 req/min/user). Phase 2 ships the medicine search/barcode lookup
| early because Medicines/Import UI needs it; Phase 4 will add the rest
| of the api.pos.* surface (batches, quote, customers) alongside the POS
| screen itself.
|
| Cave law: every endpoint here selects through withoutCost(). A cashier's
| (or clerk's) browser must never receive purchase_price, effective_cost,
| or cost_price_at_sale in any response body — enforced in the query, not
| hidden in the view.
*/

Route::middleware(['auth:web', 'throttle:pos'])->prefix('medicines')->name('api.medicines.')->group(function () {
    // GET /api/medicines/search?q=par
    //
    // Backs the medicines/index.blade.php typeahead and the POS-adjacent
    // "medicine picker" used elsewhere. brain/06-ui-conventions.md section 8
    // requires this to answer in <150ms p95 over 5,000 medicines / 20,000
    // batches — that budget is why medicines.name and medicines.generic_name
    // carry a pg_trgm GIN index (see brain/02-database-schema.md) and why
    // this query selects a fixed, narrow column list and caps at 20 rows
    // instead of joining any aggregate.
    Route::get('/search', [MedicineSearchController::class, 'search'])
        ->middleware('can:medicine.view')
        ->name('search');

    // GET /api/medicines/barcode/{code}
    //
    // Exact-match lookup against the b-tree unique index on barcode.
    // {code} is a route parameter but NOT model-bound to Medicine's key
    // per brain/05: barcodes change, ids don't.
    Route::get('/barcode/{code}', [MedicineSearchController::class, 'barcode'])
        ->middleware('can:medicine.view')
        ->name('barcode');
});

// Held-bills — Phase 4 session/cache-backed hold/recall (PosController docblock note),
// used by pos/index.blade.php's F9/F10 shortcuts and the clickable slot chips.
// Was missing from this file entirely: the controller methods existed with no route,
// so every hold/recall/heldSlots call from the browser was a plain 404 until this landed.
Route::middleware(['auth:web', 'throttle:pos'])->prefix('pos')->name('api.pos.')->group(function () {
    Route::get('/held-bills', [PosController::class, 'heldSlots'])
        ->middleware('can:sale.create')
        ->name('held-bills.index');

    Route::post('/held-bills', [PosController::class, 'hold'])
        ->middleware('can:sale.create')
        ->name('held-bills.store');

    // {slot} is a route parameter, not a body/query field — PosController::recall() takes it
    // as a method-injected $slot argument, not $request->input('slot').
    Route::get('/held-bills/{slot}', [PosController::class, 'recall'])
        ->middleware('can:sale.create')
        ->name('held-bills.recall');

    // F2 customer modal (pos/index.blade.php) — lightweight AJAX lookup/quick-create so the
    // cashier never leaves /pos. Distinct from CustomersController's full-page CRUD routes,
    // which this deliberately does not touch.
    Route::get('/customers/search', [PosController::class, 'customerSearch'])
        ->middleware('can:sale.create')
        ->name('customers.search');

    Route::post('/customers', [PosController::class, 'customerQuickCreate'])
        ->middleware('can:sale.create')
        ->name('customers.store');
});
