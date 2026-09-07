<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Web Routes — CONSOLIDATED, Phase 6
|--------------------------------------------------------------------------
|
| This file REPLACES routes/web.php wholesale. It supersedes and retires:
|   - phase-1/routes/web.php               (Dashboard, Profile, Users)
|   - phase-2/routes/web.php-additions.php (Categories, Manufacturers,
|                                            Medicines, Suppliers, Customers)
|   - phase-3, phase-4, phase-5 controllers, whose routes were written but
|     never consolidated into a drop-in file until now.
|
| Per brain/05-routes-and-modules.md §1: every screen lives here, grouped by
| module, no closures — every route points at a controller action. Every
| module block declares its own `can:` middleware; nothing relies on a
| controller checking permissions by hand (three layers must agree — see
| brain/08-security-and-audit.md §2: route can:, Gate::authorize() in the
| controller, and the runtime permission grid all have to say yes).
|
| Route model binding is implicit everywhere below (primary key), except
| /api/medicines/barcode/{code} which lives in routes/api.php, not here.
*/

use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\CategoriesController;
use App\Http\Controllers\CustomersController;
use App\Http\Controllers\DoctorController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\ManufacturersController;
use App\Http\Controllers\MedicineImportController;
use App\Http\Controllers\MedicinesController;
use App\Http\Controllers\PosController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\RackController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ReturnController;
use App\Http\Controllers\SaleController;
use App\Http\Controllers\DiscountSchemeController;
use App\Http\Controllers\ShopLicenseController;
use App\Http\Controllers\StockAdjustmentController;
use App\Http\Controllers\SuppliersController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

// Breeze's own routes (login, register, password reset, email verification,
// confirm-password). Kept separate from the app's own module routes per
// Breeze convention; nothing below depends on load order against this file.
require __DIR__.'/auth.php';

Route::middleware(['auth'])->group(function (): void {

    // ===================================================================
    // Phase 1 — Dashboard, Profile, Users
    // ===================================================================

    // `dashboard.view` is granted to every role (cashiers see it without profit
    // and cost tiles; that filtering happens in the query layer in Phase 5, not
    // here). DashboardController is the Phase 5 rewrite (invokable __construct
    // + index()), not the Phase 1 placeholder.
    Route::get('/', [DashboardController::class, 'index'])
        ->middleware('can:dashboard.view')
        ->name('dashboard');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');

    // Users and roles (`/users`) — admin-only. `user.manage` is one of the
    // permanently admin-only keys hard-denied to non-admins in the Gate
    // regardless of the runtime grid (brain/08 §2).
    Route::middleware(['can:user.manage'])->group(function (): void {
        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::get('/users/create', [UserController::class, 'create'])->name('users.create');
        Route::post('/users', [UserController::class, 'store'])->name('users.store');
        Route::get('/users/{user}/edit', [UserController::class, 'edit'])->name('users.edit');
        Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update');
        // No DELETE /users/{user} — users are deactivated, never deleted. See
        // UserController::destroy() and brain/05-routes-and-modules.md §2.
    });

    // ===================================================================
    // Phase 2 — Master data: Categories, Manufacturers, Medicines,
    // Suppliers, Customers
    // ===================================================================

    // --- Categories ----------------------------------------------------
    Route::middleware('can:category.view')->group(function (): void {
        Route::get('/categories', [CategoriesController::class, 'index'])->name('categories.index');
    });
    Route::middleware('can:category.create')->group(function (): void {
        Route::get('/categories/create', [CategoriesController::class, 'create'])->name('categories.create');
        Route::post('/categories', [CategoriesController::class, 'store'])->name('categories.store');
    });
    Route::middleware('can:category.update')->group(function (): void {
        Route::get('/categories/{category}/edit', [CategoriesController::class, 'edit'])->name('categories.edit');
        Route::put('/categories/{category}', [CategoriesController::class, 'update'])->name('categories.update');
    });
    Route::delete('/categories/{category}', [CategoriesController::class, 'destroy'])
        ->middleware('can:category.delete')
        ->name('categories.destroy');

    // --- Manufacturers ---------------------------------------------------
    Route::middleware('can:manufacturer.view')->group(function (): void {
        Route::get('/manufacturers', [ManufacturersController::class, 'index'])->name('manufacturers.index');
    });
    Route::middleware('can:manufacturer.create')->group(function (): void {
        Route::get('/manufacturers/create', [ManufacturersController::class, 'create'])->name('manufacturers.create');
        Route::post('/manufacturers', [ManufacturersController::class, 'store'])->name('manufacturers.store');
    });
    Route::middleware('can:manufacturer.update')->group(function (): void {
        Route::get('/manufacturers/{manufacturer}/edit', [ManufacturersController::class, 'edit'])->name('manufacturers.edit');
        Route::put('/manufacturers/{manufacturer}', [ManufacturersController::class, 'update'])->name('manufacturers.update');
    });
    Route::delete('/manufacturers/{manufacturer}', [ManufacturersController::class, 'destroy'])
        ->middleware('can:manufacturer.delete')
        ->name('manufacturers.destroy');

    // --- Medicines -------------------------------------------------------
    // NOTE: /medicines/import and /medicines/create must be registered BEFORE /medicines/{medicine}
    // so literal segments do not get swallowed by route model binding.
    Route::middleware('can:medicine.import')->group(function (): void {
        Route::get('/medicines/import', [MedicineImportController::class, 'create'])->name('medicines.import.create');
        Route::post('/medicines/import', [MedicineImportController::class, 'store'])->name('medicines.import.store');
        Route::get('/medicines/import/{import}', [MedicineImportController::class, 'show'])->name('medicines.import.show');
    });

    Route::middleware('can:medicine.create')->group(function (): void {
        Route::get('/medicines/create', [MedicinesController::class, 'create'])->name('medicines.create');
        Route::post('/medicines', [MedicinesController::class, 'store'])->name('medicines.store');
    });

    Route::middleware('can:medicine.view')->group(function (): void {
        Route::get('/medicines', [MedicinesController::class, 'index'])->name('medicines.index');
        Route::get('/medicines/{medicine}', [MedicinesController::class, 'show'])->name('medicines.show');
    });

    Route::middleware('can:medicine.update')->group(function (): void {
        Route::get('/medicines/{medicine}/edit', [MedicinesController::class, 'edit'])->name('medicines.edit');
        Route::put('/medicines/{medicine}', [MedicinesController::class, 'update'])->name('medicines.update');
        Route::post('/medicines/{medicine}/opening-stock', [\App\Http\Controllers\OpeningStockController::class, 'store'])->name('medicines.opening-stock.store');
    });
    Route::delete('/medicines/{medicine}', [MedicinesController::class, 'destroy'])
        ->middleware('can:medicine.delete')
        ->name('medicines.destroy');

    // --- Suppliers ---------------------------------------------------------
    Route::middleware('can:supplier.create')->group(function (): void {
        Route::get('/suppliers/create', [SuppliersController::class, 'create'])->name('suppliers.create');
        Route::post('/suppliers', [SuppliersController::class, 'store'])->name('suppliers.store');
    });

    Route::middleware('can:supplier.view')->group(function (): void {
        Route::get('/suppliers', [SuppliersController::class, 'index'])->name('suppliers.index');
        Route::get('/suppliers/{supplier}', [SuppliersController::class, 'show'])->name('suppliers.show');
    });

    Route::middleware('can:supplier.update')->group(function (): void {
        Route::get('/suppliers/{supplier}/edit', [SuppliersController::class, 'edit'])->name('suppliers.edit');
        Route::put('/suppliers/{supplier}', [SuppliersController::class, 'update'])->name('suppliers.update');
    });
    Route::delete('/suppliers/{supplier}', [SuppliersController::class, 'destroy'])
        ->middleware('can:supplier.delete')
        ->name('suppliers.destroy');

    // --- Customers -----------------------------------------------------
    Route::middleware('can:customer.create')->group(function (): void {
        Route::get('/customers/create', [CustomersController::class, 'create'])->name('customers.create');
        Route::post('/customers', [CustomersController::class, 'store'])->name('customers.store');
    });

    Route::middleware('can:customer.view')->group(function (): void {
        Route::get('/customers', [CustomersController::class, 'index'])->name('customers.index');
        Route::get('/customers/{customer}', [CustomersController::class, 'show'])->name('customers.show');
    });

    Route::middleware('can:customer.update')->group(function (): void {
        Route::get('/customers/{customer}/edit', [CustomersController::class, 'edit'])->name('customers.edit');
        Route::put('/customers/{customer}', [CustomersController::class, 'update'])->name('customers.update');
    });
    Route::delete('/customers/{customer}', [CustomersController::class, 'destroy'])
        ->middleware('can:customer.delete')
        ->name('customers.destroy');

    // --- Doctors (master data adjacent to customers; reuses customer.* perms) ------
    Route::middleware('can:customer.create')->group(function (): void {
        Route::get('/doctors/create', [DoctorController::class, 'create'])->name('doctors.create');
        Route::post('/doctors', [DoctorController::class, 'store'])->name('doctors.store');
    });

    Route::middleware('can:customer.view')->group(function (): void {
        Route::get('/doctors', [DoctorController::class, 'index'])->name('doctors.index');
    });

    Route::middleware('can:customer.update')->group(function (): void {
        Route::get('/doctors/{doctor}/edit', [DoctorController::class, 'edit'])->name('doctors.edit');
        Route::put('/doctors/{doctor}', [DoctorController::class, 'update'])->name('doctors.update');
    });
    Route::delete('/doctors/{doctor}', [DoctorController::class, 'destroy'])
        ->middleware('can:customer.delete')
        ->name('doctors.destroy');

    // ===================================================================
    // Phase 3 — Purchases, Inventory, Stock adjustments
    // ===================================================================

    // --- Purchases -------------------------------------------------------
    Route::middleware('can:purchase.create')->group(function (): void {
        Route::get('/purchases/create', [PurchaseController::class, 'create'])->name('purchases.create');
        Route::post('/purchases', [PurchaseController::class, 'store'])->name('purchases.store');
    });

    Route::middleware('can:purchase.view')->group(function (): void {
        Route::get('/purchases', [PurchaseController::class, 'index'])->name('purchases.index');
        Route::get('/purchases/{purchase}', [PurchaseController::class, 'show'])->name('purchases.show');
    });

    Route::post('/purchases/{purchase}/confirm', [PurchaseController::class, 'confirm'])
        ->middleware('can:purchase.confirm')
        ->name('purchases.confirm');
    Route::post('/purchases/{purchase}/cancel', [PurchaseController::class, 'cancel'])
        ->middleware('can:purchase.cancel')
        ->name('purchases.cancel');

    // --- Inventory -------------------------------------------------------
    Route::middleware('can:inventory.view')->group(function (): void {
        Route::get('/inventory', [InventoryController::class, 'index'])->name('inventory.index');
        Route::get('/inventory/racks', [InventoryController::class, 'racks'])->name('inventory.racks');
        Route::get('/inventory/low-stock', [InventoryController::class, 'lowStock'])->name('inventory.low-stock');
        Route::get('/inventory/expiry-report', [InventoryController::class, 'expiryReport'])->name('inventory.expiry-report');
    });

    // Assigning a batch to a rack shelf is a layout-changing action, gated
    // separately on rack.manage (not inventory.view) — see InventoryController::assignRack().
    Route::patch('/inventory/batches/{batch}/assign-rack', [InventoryController::class, 'assignRack'])
        ->middleware('can:rack.manage')
        ->name('inventory.batches.assign-rack');

    // --- Racks (Phase 8f: rack master, capacity/occupancy) -----------------
    // Admin-only per Phase8fPermissionSeeder, same gate weight as
    // discount-schemes/scheme.manage and settings.licenses/license.manage —
    // physical storage layout changes affect every future put-away.
    Route::middleware('can:rack.manage')->group(function (): void {
        Route::get('/racks', [RackController::class, 'index'])->name('racks.index');
        Route::get('/racks/create', [RackController::class, 'create'])->name('racks.create');
        Route::post('/racks', [RackController::class, 'store'])->name('racks.store');
        Route::get('/racks/{rack}/edit', [RackController::class, 'edit'])->name('racks.edit');
        Route::put('/racks/{rack}', [RackController::class, 'update'])->name('racks.update');
        Route::delete('/racks/{rack}', [RackController::class, 'destroy'])->name('racks.destroy');
    });

    // --- Stock adjustments -------------------------------------------------
    // /stock-adjustments/create is registered before the bare /stock-adjustments
    // index, following the same literal-segment-before-{model} ordering used for
    // /medicines/create and /medicines/import above.
    Route::middleware('can:stock.adjust')->group(function (): void {
        Route::get('/stock-adjustments/create', [StockAdjustmentController::class, 'create'])->name('stock-adjustments.create');
        Route::post('/stock-adjustments', [StockAdjustmentController::class, 'store'])->name('stock-adjustments.store');
        Route::get('/stock-adjustments', [StockAdjustmentController::class, 'index'])->name('stock-adjustments.index');
    });

    // --- Discount schemes (Phase 8a) ----------------------------------------
    // Admin-only per Phase8PermissionSeeder — a "buy 2 get 1 free" rule changes real
    // money on every future sale, same gate weight as a manual stock correction.
    Route::middleware('can:scheme.manage')->group(function (): void {
        Route::get('/discount-schemes', [DiscountSchemeController::class, 'index'])->name('discount-schemes.index');
        Route::get('/discount-schemes/create', [DiscountSchemeController::class, 'create'])->name('discount-schemes.create');
        Route::post('/discount-schemes', [DiscountSchemeController::class, 'store'])->name('discount-schemes.store');
        Route::get('/discount-schemes/{discountScheme}/edit', [DiscountSchemeController::class, 'edit'])->name('discount-schemes.edit');
        Route::put('/discount-schemes/{discountScheme}', [DiscountSchemeController::class, 'update'])->name('discount-schemes.update');
        Route::delete('/discount-schemes/{discountScheme}', [DiscountSchemeController::class, 'destroy'])->name('discount-schemes.destroy');
    });

    // ===================================================================
    // Phase 4 — POS, Sales, Returns
    // ===================================================================

    // --- POS ---------------------------------------------------------------
    // PosController is fully AJAX-driven (brain/06-ui-conventions.md §2,§5):
    // index() renders the shell once, store()/hold()/recall()/heldSlots()
    // are XHR endpoints hit from the Alpine cart. Permission checks live
    // inside SalesService/PosController via Gate::authorize('sale.create'),
    // not solely at the route, because store() also enforces per-item
    // domain exceptions the route layer cannot express.
    Route::middleware('can:sale.create')->group(function (): void {
        Route::get('/pos', [PosController::class, 'index'])->name('pos.index');
        Route::post('/pos', [PosController::class, 'store'])->name('pos.store');
        Route::post('/pos/hold', [PosController::class, 'hold'])->name('pos.hold');
        Route::post('/pos/recall', [PosController::class, 'recall'])->name('pos.recall');
        Route::get('/pos/held', [PosController::class, 'heldSlots'])->name('pos.held');
    });

    // --- Sales history / print / cancel -------------------------------------
    Route::middleware('can:sale.view')->group(function (): void {
        Route::get('/sales', [SaleController::class, 'index'])->name('sales.index');
        Route::get('/sales/{sale}', [SaleController::class, 'show'])->name('sales.show');
        Route::get('/sales/{sale}/print', [SaleController::class, 'print'])->name('sales.print');
        Route::get('/sales/{sale}/print-thermal', [SaleController::class, 'printThermal'])->name('sales.print-thermal');

        // Prescription image attach/view (Phase 8b). Gated on the same
        // sale.view permission as the invoice itself — attaching/viewing a
        // scan is part of managing that invoice's record, not a distinct
        // capability. The controller re-checks Gate::authorize('sale.view',
        // $sale) itself so it stays correct even if routed to another way.
        Route::post('/sales/{sale}/prescription-image', [\App\Http\Controllers\PrescriptionImageController::class, 'store'])
            ->name('sales.prescription-image.store');
        Route::get('/sales/{sale}/prescription-image', [\App\Http\Controllers\PrescriptionImageController::class, 'show'])
            ->name('sales.prescription-image.show');
    });
    // cancel() gates on Gate::authorize('sale.void', $sale) — a policy-style
    // check against the specific sale (same-day, unpaid-mistake only, per
    // ADR-0005), not a flat permission, so the route middleware only proves
    // the user holds *some* sale.void grant; the controller does the rest.
    Route::post('/sales/{sale}/cancel', [SaleController::class, 'cancel'])
        ->middleware('can:sale.void,sale')
        ->name('sales.cancel');

    // --- Returns -----------------------------------------------------------
    Route::middleware('can:return.create')->group(function (): void {
        Route::get('/returns/create/{sale?}', [ReturnController::class, 'create'])->name('returns.create');
        Route::post('/returns', [ReturnController::class, 'store'])->name('returns.store');
    });

    // ===================================================================
    // Phase 5 — Reports, Audit log
    // ===================================================================

    // One route per ReportController public method. `report.profit` is a
    // separate, admin-only permission from `report.view` (cave law 2 extends
    // to reports: margins are never shown to a cashier) — see
    // ReportController::profit().
    Route::middleware('can:report.view')->group(function (): void {
        Route::get('/reports/sales', [ReportController::class, 'sales'])->name('reports.sales');
        Route::get('/reports/purchases', [ReportController::class, 'purchases'])->name('reports.purchases');
        Route::get('/reports/stock-valuation', [ReportController::class, 'stockValuation'])->name('reports.stock-valuation');
        Route::get('/reports/expiry', [ReportController::class, 'expiry'])->name('reports.expiry');
        Route::get('/reports/movers', [ReportController::class, 'movers'])->name('reports.movers');
        Route::get('/reports/gst', [ReportController::class, 'gst'])->name('reports.gst');
        Route::get('/reports/rack-stock', [ReportController::class, 'rackStock'])->name('reports.rack-stock');
        Route::get('/reports/customer-aging', [ReportController::class, 'customerAging'])->name('reports.customer-aging');
        Route::get('/reports/supplier-aging', [ReportController::class, 'supplierAging'])->name('reports.supplier-aging');
    });
    Route::get('/reports/profit', [ReportController::class, 'profit'])
        ->middleware('can:report.profit')
        ->name('reports.profit');

    // --- Audit log -----------------------------------------------------
    Route::middleware('can:audit.view')->group(function (): void {
        Route::get('/audit-logs', [AuditLogController::class, 'index'])->name('audit-logs.index');
    });

    // -------------------------------------------------------------------
    // Phase 6 — Settings (shop identity, backup status) attach below this
    // line when built. Nothing in Phase 6 hardening itself required a new
    // settings screen, so no block is added here yet.
    // -------------------------------------------------------------------

    // --- Shop licenses (Phase 8e) ---------------------------------------
    // Shop-level Drug License (DL) records — brain/11-gap-closure-architecture.md
    // §6, Gap 5. Admin-only per Phase8ePermissionSeeder, same gate weight as
    // discount-schemes/scheme.manage: pure compliance master data, no stock or
    // sale interaction.
    Route::middleware('can:license.manage')->group(function (): void {
        Route::get('/settings/licenses', [ShopLicenseController::class, 'index'])->name('settings.licenses.index');
        Route::get('/settings/licenses/create', [ShopLicenseController::class, 'create'])->name('settings.licenses.create');
        Route::post('/settings/licenses', [ShopLicenseController::class, 'store'])->name('settings.licenses.store');
        Route::get('/settings/licenses/{license}/edit', [ShopLicenseController::class, 'edit'])->name('settings.licenses.edit');
        Route::put('/settings/licenses/{license}', [ShopLicenseController::class, 'update'])->name('settings.licenses.update');
        Route::delete('/settings/licenses/{license}', [ShopLicenseController::class, 'destroy'])->name('settings.licenses.destroy');
    });
});
