# Routes and Module Boundaries

Purpose: the complete route surface, the permission key vocabulary, and which module is
allowed to touch which tables and services.

Route URIs and names as-implemented are derivable from `php artisan route:list`. This file
exists for what is not derivable: the grouping rules, the permission attached to each route
and why, the phase each route lands in, and the boundaries between modules.

## 1. Route file organisation

| File | Contents | Middleware stack |
|---|---|---|
| `routes/web.php` | Every screen. Grouped by module with `Route::prefix()->name()->middleware()` blocks, one block per module, in the order of the table below | `web`, `auth`, `verified.active` |
| `routes/api.php` | Only the POS's own XHR endpoints: medicine search, barcode lookup, batch lookup, cart price recalculation, hold/recall | `api`, `auth:web` (same session cookie — there is no token issuer), `throttle:pos` |
| `routes/auth.php` | Breeze/Fortify login, logout, password reset, password confirmation | `web`, `guest` where applicable |
| `routes/console.php` | Closure-based scheduled commands only | — |

Rules:

- `web.php` contains no closures. Every route points at a controller action.
- Every module block declares its own `can:` middleware. Nothing relies on a controller
  checking permissions by hand.
- Route model binding everywhere; implicit binding uses the model's primary key except
  `medicines` in POS lookups, which bind by id only (barcode is a query parameter, not a
  route key — barcodes change).
- `routes/api.php` is not a public API. It is the POS's private transport and stays
  session-authenticated. There is no `/api/v1` and no token flow; a separate integration API,
  if it ever exists, gets its own file and its own decision record.
- `throttle:pos` is defined as 300 requests/minute/user — high enough for typeahead, low
  enough to catch a runaway loop.

> **Cave law:** the POS may read through `routes/api.php`, but every stock or money mutation
> posts to a `web.php` route backed by a Form Request and a transactional service. There is no
> JSON endpoint that moves stock.

## 2. Route inventory

Permission column values are permission keys (section 3). `—` means authenticated users only.
Phase refers to `CAVEMAN_DESIGN.md`.

### Authentication and session (`routes/auth.php`)

| Method | URI | Name | Controller@action | Permission | Phase |
|---|---|---|---|---|---|
| GET | `/login` | `login` | `Auth\AuthenticatedSessionController@create` | guest | 1 |
| POST | `/login` | `login.store` | `Auth\AuthenticatedSessionController@store` | guest, `throttle:login` | 1 |
| POST | `/logout` | `logout` | `Auth\AuthenticatedSessionController@destroy` | auth | 1 |
| GET | `/forgot-password` | `password.request` | `Auth\PasswordResetLinkController@create` | guest | 1 |
| POST | `/forgot-password` | `password.email` | `Auth\PasswordResetLinkController@store` | guest | 1 |
| GET | `/reset-password/{token}` | `password.reset` | `Auth\NewPasswordController@create` | guest | 1 |
| POST | `/reset-password` | `password.store` | `Auth\NewPasswordController@store` | guest | 1 |
| GET | `/confirm-password` | `password.confirm` | `Auth\ConfirmablePasswordController@show` | auth | 1 |
| POST | `/confirm-password` | `password.confirm.store` | `Auth\ConfirmablePasswordController@store` | auth | 1 |
| PUT | `/password` | `password.update` | `Auth\PasswordController@update` | auth | 1 |
| POST | `/lock` | `session.lock` | `Auth\ScreenLockController@store` | auth | 6 |
| POST | `/unlock` | `session.unlock` | `Auth\ScreenLockController@update` | auth | 6 |

### Dashboard and profile

| Method | URI | Name | Controller@action | Permission | Phase |
|---|---|---|---|---|---|
| GET | `/` | `dashboard` | `DashboardController@__invoke` | `dashboard.view` | 1 (shell), 5 (widgets) |
| GET | `/dashboard/alerts` | `dashboard.alerts` | `DashboardAlertsController@__invoke` | `dashboard.view` | 5 |
| GET | `/profile` | `profile.edit` | `ProfileController@edit` | — | 1 |
| PATCH | `/profile` | `profile.update` | `ProfileController@update` | — | 1 |

### Medicines (`/medicines`)

| Method | URI | Name | Controller@action | Permission | Phase |
|---|---|---|---|---|---|
| GET | `/medicines` | `medicines.index` | `MedicinesController@index` | `medicine.view` | 2 |
| GET | `/medicines/create` | `medicines.create` | `MedicinesController@create` | `medicine.create` | 2 |
| POST | `/medicines` | `medicines.store` | `MedicinesController@store` | `medicine.create` | 2 |
| GET | `/medicines/{medicine}` | `medicines.show` | `MedicinesController@show` | `medicine.view` | 2 |
| GET | `/medicines/{medicine}/edit` | `medicines.edit` | `MedicinesController@edit` | `medicine.update` | 2 |
| PUT | `/medicines/{medicine}` | `medicines.update` | `MedicinesController@update` | `medicine.update` | 2 |
| DELETE | `/medicines/{medicine}` | `medicines.destroy` | `MedicinesController@destroy` | `medicine.delete` | 2 |
| GET | `/medicines/import` | `medicines.import.create` | `MedicineImportController@create` | `medicine.import` | 2 |
| POST | `/medicines/import` | `medicines.import.store` | `MedicineImportController@store` | `medicine.import` | 2 |
| GET | `/medicines/import/{import}` | `medicines.import.show` | `MedicineImportController@show` | `medicine.import` | 2 |
| GET | `/medicines/{medicine}/batches` | `medicines.batches` | `MedicineBatchesController@index` | `inventory.view` | 3 |
| GET | `/medicines/{medicine}/ledger` | `medicines.ledger` | `MedicineLedgerController@index` | `inventory.ledger` | 3 |

### Categories, manufacturers, units (`/categories`, `/manufacturers`, `/units`)

| Method | URI | Name | Controller@action | Permission | Phase |
|---|---|---|---|---|---|
| GET | `/categories` | `categories.index` | `CategoriesController@index` | `category.view` | 2 |
| GET | `/categories/create` | `categories.create` | `CategoriesController@create` | `category.create` | 2 |
| POST | `/categories` | `categories.store` | `CategoriesController@store` | `category.create` | 2 |
| GET | `/categories/{category}/edit` | `categories.edit` | `CategoriesController@edit` | `category.update` | 2 |
| PUT | `/categories/{category}` | `categories.update` | `CategoriesController@update` | `category.update` | 2 |
| DELETE | `/categories/{category}` | `categories.destroy` | `CategoriesController@destroy` | `category.delete` | 2 |
| GET | `/manufacturers` | `manufacturers.index` | `ManufacturersController@index` | `manufacturer.view` | 2 |
| GET | `/manufacturers/create` | `manufacturers.create` | `ManufacturersController@create` | `manufacturer.create` | 2 |
| POST | `/manufacturers` | `manufacturers.store` | `ManufacturersController@store` | `manufacturer.create` | 2 |
| GET | `/manufacturers/{manufacturer}/edit` | `manufacturers.edit` | `ManufacturersController@edit` | `manufacturer.update` | 2 |
| PUT | `/manufacturers/{manufacturer}` | `manufacturers.update` | `ManufacturersController@update` | `manufacturer.update` | 2 |
| DELETE | `/manufacturers/{manufacturer}` | `manufacturers.destroy` | `ManufacturersController@destroy` | `manufacturer.delete` | 2 |
| GET | `/units` | `units.index` | `UnitsController@index` | `unit.view` | 2 |
| POST | `/units` | `units.store` | `UnitsController@store` | `unit.manage` | 2 |
| PUT | `/units/{unit}` | `units.update` | `UnitsController@update` | `unit.manage` | 2 |

### Suppliers (`/suppliers`)

| Method | URI | Name | Controller@action | Permission | Phase |
|---|---|---|---|---|---|
| GET | `/suppliers` | `suppliers.index` | `SuppliersController@index` | `supplier.view` | 2 |
| GET | `/suppliers/create` | `suppliers.create` | `SuppliersController@create` | `supplier.create` | 2 |
| POST | `/suppliers` | `suppliers.store` | `SuppliersController@store` | `supplier.create` | 2 |
| GET | `/suppliers/{supplier}` | `suppliers.show` | `SuppliersController@show` | `supplier.view` | 2 |
| GET | `/suppliers/{supplier}/edit` | `suppliers.edit` | `SuppliersController@edit` | `supplier.update` | 2 |
| PUT | `/suppliers/{supplier}` | `suppliers.update` | `SuppliersController@update` | `supplier.update` | 2 |
| DELETE | `/suppliers/{supplier}` | `suppliers.destroy` | `SuppliersController@destroy` | `supplier.delete` | 2 |
| GET | `/suppliers/{supplier}/ledger` | `suppliers.ledger` | `SupplierLedgerController@index` | `supplier.ledger` | 5 |
| GET | `/suppliers/{supplier}/payments` | `suppliers.payments.index` | `SupplierPaymentsController@index` | `supplier.payment` | 3 |
| POST | `/suppliers/{supplier}/payments` | `suppliers.payments.store` | `SupplierPaymentsController@store` | `supplier.payment` | 3 |

### Customers (`/customers`)

| Method | URI | Name | Controller@action | Permission | Phase |
|---|---|---|---|---|---|
| GET | `/customers` | `customers.index` | `CustomersController@index` | `customer.view` | 2 |
| GET | `/customers/create` | `customers.create` | `CustomersController@create` | `customer.create` | 2 |
| POST | `/customers` | `customers.store` | `CustomersController@store` | `customer.create` | 2 |
| GET | `/customers/{customer}` | `customers.show` | `CustomersController@show` | `customer.view` | 2 |
| GET | `/customers/{customer}/edit` | `customers.edit` | `CustomersController@edit` | `customer.update` | 2 |
| PUT | `/customers/{customer}` | `customers.update` | `CustomersController@update` | `customer.update` | 2 |
| DELETE | `/customers/{customer}` | `customers.destroy` | `CustomersController@destroy` | `customer.delete` | 2 |
| PUT | `/customers/{customer}/credit-limit` | `customers.credit-limit.update` | `CustomerCreditLimitController@update` | `customer.credit_limit` | 4 |
| GET | `/customers/{customer}/ledger` | `customers.ledger` | `CustomerLedgerController@index` | `customer.ledger` | 5 |
| GET | `/customers/{customer}/payments` | `customers.payments.index` | `CustomerPaymentsController@index` | `payment.receive` | 4 |
| POST | `/customers/{customer}/payments` | `customers.payments.store` | `CustomerPaymentsController@store` | `payment.receive` | 4 |

### Purchases (`/purchases`)

| Method | URI | Name | Controller@action | Permission | Phase |
|---|---|---|---|---|---|
| GET | `/purchases` | `purchases.index` | `PurchasesController@index` | `purchase.view` | 3 |
| GET | `/purchases/create` | `purchases.create` | `PurchasesController@create` | `purchase.create` | 3 |
| POST | `/purchases` | `purchases.store` | `PurchasesController@store` | `purchase.create` | 3 |
| GET | `/purchases/{purchase}` | `purchases.show` | `PurchasesController@show` | `purchase.view` | 3 |
| GET | `/purchases/{purchase}/edit` | `purchases.edit` | `PurchasesController@edit` | `purchase.update` | 3 |
| PUT | `/purchases/{purchase}` | `purchases.update` | `PurchasesController@update` | `purchase.update` | 3 |
| POST | `/purchases/{purchase}/confirm` | `purchases.confirm` | `ConfirmPurchaseController@__invoke` | `purchase.confirm` | 3 |
| POST | `/purchases/{purchase}/cancel` | `purchases.cancel` | `CancelPurchaseController@__invoke` | `purchase.cancel` | 3 |
| GET | `/purchases/{purchase}/print` | `purchases.print` | `PurchasesController@print` | `purchase.view` | 3 |
| GET | `/purchase-returns` | `purchase-returns.index` | `PurchaseReturnsController@index` | `purchase_return.view` | 4 |
| GET | `/purchase-returns/create` | `purchase-returns.create` | `PurchaseReturnsController@create` | `purchase_return.create` | 4 |
| POST | `/purchase-returns` | `purchase-returns.store` | `PurchaseReturnsController@store` | `purchase_return.create` | 4 |
| GET | `/purchase-returns/{purchaseReturn}` | `purchase-returns.show` | `PurchaseReturnsController@show` | `purchase_return.view` | 4 |

`purchases.update` and `purchases.edit` apply only to `PurchaseStatus::Draft`. The Policy
denies both once a purchase is `Confirmed`; correction after confirmation is a cancellation
(reversing stock transactions) plus a fresh purchase.

### Inventory: stock, batches, adjustments (`/inventory`)

| Method | URI | Name | Controller@action | Permission | Phase |
|---|---|---|---|---|---|
| GET | `/inventory` | `inventory.index` | `InventoryController@index` | `inventory.view` | 3 |
| GET | `/inventory/batches` | `inventory.batches.index` | `BatchesController@index` | `inventory.view` | 3 |
| GET | `/inventory/batches/{batch}` | `inventory.batches.show` | `BatchesController@show` | `inventory.view` | 3 |
| PUT | `/inventory/batches/{batch}/status` | `inventory.batches.status` | `BatchStatusController@update` | `inventory.quarantine` | 4 |
| PUT | `/inventory/batches/{batch}/selling-price` | `inventory.batches.price` | `BatchPriceController@update` | `inventory.price_change` | 3 |
| GET | `/inventory/ledger` | `inventory.ledger` | `StockLedgerController@index` | `inventory.ledger` | 3 |
| GET | `/stock-adjustments` | `stock-adjustments.index` | `StockAdjustmentController@index` | `stock.adjust` | 3 |
| GET | `/stock-adjustments/create` | `stock-adjustments.create` | `StockAdjustmentController@create` | `stock.adjust` | 3 |
| POST | `/stock-adjustments` | `stock-adjustments.store` | `StockAdjustmentController@store` | `stock.adjust` | 3 |
<!-- Patched 2026-08-26: as-built path/name/controller differ from the original plan above
     (this doc originally read /inventory/adjustments/* via plural StockAdjustmentsController).
     Real app ships singular StockAdjustmentController at /stock-adjustments/*, already true for
     create/store before the index route existed — kept consistent with that instead of retrofitting
     the build to this doc's original naming. Cave law: a stale brain is worse than no brain. -->

| GET | `/inventory/opening-stock` | `inventory.opening.create` | `OpeningStockController@create` | `stock.opening` | 3 |
| POST | `/inventory/opening-stock` | `inventory.opening.store` | `OpeningStockController@store` | `stock.opening` | 3 |
| GET | `/inventory/low-stock` | `inventory.low-stock` | `LowStockController@index` | `inventory.view` | 3 |
| GET | `/inventory/expiry` | `inventory.expiry` | `ExpiryController@index` | `inventory.view` | 3 |
| POST | `/inventory/expiry/write-off` | `inventory.expiry.write-off` | `ExpiryWriteOffController@store` | `stock.writeoff` | 4 |
| GET | `/inventory/verify` | `inventory.verify` | `StockVerifyController@index` | `inventory.verify` | 3 |

### POS and sales (`/pos`, `/sales`)

| Method | URI | Name | Controller@action | Permission | Phase |
|---|---|---|---|---|---|
| GET | `/pos` | `pos.index` | `PosController@index` | `sale.create` | 4 |
| POST | `/sales` | `sales.store` | `SalesController@store` | `sale.create` | 4 |
| GET | `/sales` | `sales.index` | `SalesController@index` | `sale.view` | 4 |
| GET | `/sales/{sale}` | `sales.show` | `SalesController@show` | `sale.view` | 4 |
| GET | `/sales/{sale}/invoice` | `sales.invoice` | `SaleInvoiceController@show` | `sale.view` | 4 |
| GET | `/sales/{sale}/receipt` | `sales.receipt` | `SaleReceiptController@show` | `sale.view` | 4 |
| POST | `/sales/{sale}/void` | `sales.void` | `VoidSaleController@__invoke` | `sale.void` | 4 |
| POST | `/sales/{sale}/payments` | `sales.payments.store` | `SalePaymentsController@store` | `payment.receive` | 4 |
| POST | `/pos/held-bills` | `pos.hold.store` | `HeldBillsController@store` | `sale.create` | 4 |
| GET | `/pos/held-bills` | `pos.hold.index` | `HeldBillsController@index` | `sale.create` | 4 |
| DELETE | `/pos/held-bills/{heldBill}` | `pos.hold.destroy` | `HeldBillsController@destroy` | `sale.create` | 4 |
| POST | `/pos/overrides/discount` | `pos.override.discount` | `DiscountOverrideController@store` | `sale.discount_override` | 4 |
| POST | `/pos/overrides/prescription` | `pos.override.prescription` | `PrescriptionOverrideController@store` | `sale.prescription_override` | 4 |
| POST | `/pos/overrides/credit-limit` | `pos.override.credit` | `CreditOverrideController@store` | `customer.credit_override` | 4 |

`sales.void` exists only for the same-day, unpaid-mistake case and writes reversing stock
transactions plus a `SaleStatus::Cancelled`; it never deletes a row. There is deliberately no
`sales.edit`, no `PUT /sales/{sale}`, and no `DELETE /sales/{sale}`. See ADR-0005.

### Sales returns (`/returns`)

| Method | URI | Name | Controller@action | Permission | Phase |
|---|---|---|---|---|---|
| GET | `/returns` | `returns.index` | `ReturnsController@index` | `return.view` | 4 |
| GET | `/returns/create` | `returns.create` | `ReturnsController@create` | `return.create` | 4 |
| POST | `/returns` | `returns.store` | `ReturnsController@store` | `return.create` | 4 |
| GET | `/returns/{return}` | `returns.show` | `ReturnsController@show` | `return.view` | 4 |
| GET | `/returns/{return}/receipt` | `returns.receipt` | `ReturnReceiptController@show` | `return.view` | 4 |
| GET | `/sales/{sale}/returnable` | `sales.returnable` | `ReturnableItemsController@index` | `return.create` | 4 |

### Reports (`/reports`)

| Method | URI | Name | Controller@action | Permission | Phase |
|---|---|---|---|---|---|
| GET | `/reports` | `reports.index` | `ReportsController@index` | `report.view` | 5 |
| GET | `/reports/sales` | `reports.sales` | `Reports\SalesReportController@__invoke` | `report.sales` | 5 |
| GET | `/reports/purchases` | `reports.purchases` | `Reports\PurchaseReportController@__invoke` | `report.purchase` | 5 |
| GET | `/reports/profit` | `reports.profit` | `Reports\ProfitReportController@__invoke` | `report.profit` | 5 |
| GET | `/reports/stock` | `reports.stock` | `Reports\StockReportController@__invoke` | `report.stock` | 5 |
| GET | `/reports/stock-valuation` | `reports.stock-valuation` | `Reports\StockValuationController@__invoke` | `report.valuation` | 5 |
| GET | `/reports/expiry` | `reports.expiry` | `Reports\ExpiryReportController@__invoke` | `report.expiry` | 5 |
| GET | `/reports/movers` | `reports.movers` | `Reports\MoverReportController@__invoke` | `report.movers` | 5 |
| GET | `/reports/gst` | `reports.gst` | `Reports\GstReportController@__invoke` | `report.gst` | 5 |
| GET | `/reports/gst/hsn-summary` | `reports.gst.hsn` | `Reports\HsnSummaryController@__invoke` | `report.gst` | 5 |
| GET | `/reports/customer-ledger` | `reports.customer-ledger` | `Reports\CustomerLedgerReportController@__invoke` | `customer.ledger` | 5 |
| GET | `/reports/supplier-ledger` | `reports.supplier-ledger` | `Reports\SupplierLedgerReportController@__invoke` | `supplier.ledger` | 5 |
| GET | `/reports/aging` | `reports.aging` | `Reports\AgingReportController@__invoke` | `report.aging` | 5 |
| GET | `/reports/{report}/export` | `reports.export` | `Reports\ExportController@__invoke` | inherits the report's own key | 5 |

Every report route accepts `from`, `to`, and report-specific filters through a Form Request
that defaults the range to today in `Asia/Kolkata` and caps it at 366 days.

### Audit (`/audit`)

| Method | URI | Name | Controller@action | Permission | Phase |
|---|---|---|---|---|---|
| GET | `/audit` | `audit.index` | `AuditLogsController@index` | `audit.view` | 5 |
| GET | `/audit/{auditLog}` | `audit.show` | `AuditLogsController@show` | `audit.view` | 5 |
| GET | `/audit/logins` | `audit.logins` | `LoginLogsController@index` | `audit.logins` | 1 |
| GET | `/audit/export` | `audit.export` | `AuditExportController@__invoke` | `audit.export` | 5 |

There is no write route under `/audit`. Audit rows are append-only and are written by the
observer layer only. See `brain/08-security-and-audit.md`.

### Settings (`/settings`)

| Method | URI | Name | Controller@action | Permission | Phase |
|---|---|---|---|---|---|
| GET | `/settings` | `settings.index` | `SettingsController@index` | `settings.view` | 6 |
| GET | `/settings/shop` | `settings.shop.edit` | `ShopSettingsController@edit` | `settings.update` | 6 |
| PUT | `/settings/shop` | `settings.shop.update` | `ShopSettingsController@update` | `settings.update` | 6 |
| GET | `/settings/invoice` | `settings.invoice.edit` | `InvoiceSettingsController@edit` | `settings.update` | 6 |
| PUT | `/settings/invoice` | `settings.invoice.update` | `InvoiceSettingsController@update` | `settings.update` | 6 |
| GET | `/settings/printing` | `settings.printing.edit` | `PrintSettingsController@edit` | `settings.update` | 6 |
| PUT | `/settings/printing` | `settings.printing.update` | `PrintSettingsController@update` | `settings.update` | 6 |
| GET | `/settings/backups` | `settings.backups` | `BackupStatusController@index` | `settings.backup` | 6 |

Shop settings hold the legal identity printed on every invoice: shop name, address, GSTIN,
**drug licence numbers**, and the registered pharmacist's name and registration number. They
are audited on change like any other watched event.

### Users and roles (`/users`, `/roles`)

| Method | URI | Name | Controller@action | Permission | Phase |
|---|---|---|---|---|---|
| GET | `/users` | `users.index` | `UsersController@index` | `user.view` | 1 |
| GET | `/users/create` | `users.create` | `UsersController@create` | `user.create` | 1 |
| POST | `/users` | `users.store` | `UsersController@store` | `user.create` | 1 |
| GET | `/users/{user}/edit` | `users.edit` | `UsersController@edit` | `user.update` | 1 |
| PUT | `/users/{user}` | `users.update` | `UsersController@update` | `user.update` | 1 |
| PUT | `/users/{user}/status` | `users.status` | `UserStatusController@update` | `user.deactivate` | 1 |
| PUT | `/users/{user}/password` | `users.password` | `UserPasswordController@update` | `user.reset_password` | 1 |
| GET | `/roles` | `roles.index` | `RolesController@index` | `role.view` | 1 |
| GET | `/roles/{role}/permissions` | `roles.permissions.edit` | `RolePermissionsController@edit` | `role.permission` | 1 |
| PUT | `/roles/{role}/permissions` | `roles.permissions.update` | `RolePermissionsController@update` | `role.permission` | 1 |

Users are never deleted, only deactivated: `sales.user_id` and `audit_logs.user_id` must stay
resolvable for as long as the records are retained.

### POS transport (`routes/api.php`)

| Method | URI | Name | Controller@action | Permission | Phase |
|---|---|---|---|---|---|
| GET | `/api/pos/medicines` | `api.pos.medicines` | `Api\MedicineSearchController@__invoke` | `sale.create` | 4 |
| GET | `/api/pos/barcode/{code}` | `api.pos.barcode` | `Api\BarcodeLookupController@__invoke` | `sale.create` | 4 |
| GET | `/api/pos/medicines/{medicine}/batches` | `api.pos.batches` | `Api\SellableBatchesController@__invoke` | `sale.create` | 4 |
| POST | `/api/pos/quote` | `api.pos.quote` | `Api\CartQuoteController@__invoke` | `sale.create` | 4 |
| GET | `/api/pos/customers` | `api.pos.customers` | `Api\CustomerSearchController@__invoke` | `sale.create` | 4 |
| GET | `/api/pos/customers/{customer}/credit` | `api.pos.credit` | `Api\CustomerCreditController@__invoke` | `sale.create` | 4 |

> **Cave law:** every one of these endpoints selects through the `withoutCost()` scope. A
> cashier's browser must never receive `purchase_price`, `effective_cost`, or
> `cost_price_at_sale` in any response body. Cave law 2 is enforced in the query, not the view.

`api.pos.quote` recomputes discount, GST, and round-off server-side and returns the totals the
POS displays. The browser's arithmetic is a preview; the number that binds is computed again
inside the save transaction.

## 3. Permission keys

Format: `module.action`, lowercase, `snake_case` for multi-word actions.
`medicine.view`, `sale.discount_override`, `customer.credit_limit`. Never `can-view-medicines`,
never a plural module, never a role name in a key.

Rules:

- Keys are seeded by `PermissionSeeder` and are immutable strings. Renaming a key is a
  migration plus a data update, so name it right the first time.
- Roles hold permissions; users hold roles. A user never holds a permission directly. The
  role-to-permission grid is editable at runtime through `roles.permissions.update`, which is
  an audited event.
- Every `can:` middleware string in a route file must exist in the seeder. A test asserts the
  two sets are equal, so a typo in a route fails CI rather than silently granting nothing.
- Four actions are permanently admin-only regardless of the runtime grid, enforced in the
  Gate with a `before` check: `stock.adjust`, `report.profit`, `role.permission`, `user.create`.

### Full permission list

| Module | Keys |
|---|---|
| dashboard | `dashboard.view` |
| medicine | `medicine.view`, `medicine.create`, `medicine.update`, `medicine.delete`, `medicine.import` |
| category | `category.view`, `category.create`, `category.update`, `category.delete` |
| manufacturer | `manufacturer.view`, `manufacturer.create`, `manufacturer.update`, `manufacturer.delete` |
| unit | `unit.view`, `unit.manage` |
| supplier | `supplier.view`, `supplier.create`, `supplier.update`, `supplier.delete`, `supplier.ledger`, `supplier.payment` |
| customer | `customer.view`, `customer.create`, `customer.update`, `customer.delete`, `customer.ledger`, `customer.credit_limit`, `customer.credit_override` |
| purchase | `purchase.view`, `purchase.create`, `purchase.update`, `purchase.confirm`, `purchase.cancel` |
| purchase_return | `purchase_return.view`, `purchase_return.create` |
| inventory | `inventory.view`, `inventory.ledger`, `inventory.verify`, `inventory.price_change`, `inventory.quarantine` |
| stock | `stock.adjust`, `stock.opening`, `stock.writeoff` |
| sale | `sale.create`, `sale.view`, `sale.void`, `sale.discount_override`, `sale.prescription_override` |
| return | `return.view`, `return.create` |
| payment | `payment.receive`, `payment.refund` |
| report | `report.view`, `report.sales`, `report.purchase`, `report.profit`, `report.stock`, `report.valuation`, `report.expiry`, `report.movers`, `report.gst`, `report.aging` |
| audit | `audit.view`, `audit.logins`, `audit.export` |
| settings | `settings.view`, `settings.update`, `settings.backup` |
| user | `user.view`, `user.create`, `user.update`, `user.deactivate`, `user.reset_password` |
| role | `role.view`, `role.permission` |

The role-by-role default grid lives in `brain/08-security-and-audit.md`, which is the single
place the matrix is maintained.

## 4. Module boundaries

A module is a vertical slice: routes, controllers, form requests, policies, services, and the
tables it owns. Ownership means: **only the owning module's services write those tables.**
Any module may *read* another module's tables through that module's models and query scopes.

| Module | Owns (writes) | Primary services |
|---|---|---|
| Identity | `users`, `roles`, `permissions`, `role_user`, `permission_role`, `login_logs` | Controllers plus policies; no domain service of its own |
| Catalog | `medicines`, `categories`, `manufacturers`, `units` | `MedicineImportService` (import only) |
| Parties | `customers`, `suppliers` | Controllers plus policies |
| Purchasing | `purchases`, `purchase_items`, `purchase_returns`, `purchase_return_items`, `supplier_payments` | `PurchaseService`, `ReturnService::returnToSupplier()` |
| Inventory | `medicine_batches`, `stock_transactions`, `stock_adjustments` | `InventoryService` (the only ledger writer), `AllocateFefoBatches` action |
| Sales | `sales`, `sale_items`, `prescriptions`, `invoice_counters`, and the held-bill store | `SalesService`, `InvoiceService` |
| Returns | `returns`, `return_items` | `ReturnService::returnSale()` |
| Payments | `payments`, `customer_payments` | Recorded by `SalesService` and `PurchaseService` inside the same transaction as the document they pay for |
| Reporting | `daily_sales_summary` (write, by `summary:rebuild` only) | `ReportService`, `app/Queries` objects |
| Audit | `audit_logs` (insert only) | `AuditService` |

### Call graph

Allowed service-to-service calls, and nothing else:

```
SalesService     -> InventoryService (lock + apply), AllocateFefoBatches
                 -> InvoiceService   (next number)
                 -> AuditService
                 -> Catalog, Parties (read models only)
ReturnService    -> InventoryService (apply, quarantine)
                 -> AuditService
                 -> Sales, Purchasing (read models only; never mutates a sale row)
PurchaseService  -> InventoryService (batch create + apply)
                 -> AuditService
InventoryService -> (nothing; it is a leaf)
InvoiceService   -> (nothing)
AuditService     -> (nothing; it is called by services and by model observers)
ReportService    -> (read only, everywhere)
```

Rules that make the graph hold:

> **Cave law:** only Inventory writes `medicine_batches.quantity_available`, and only through
> `InventoryService::apply()`, in the same transaction as the matching `stock_transactions`
> insert. Every other module asks; none reaches in. This is cave law 1 expressed as a boundary.

- The graph is acyclic. `InventoryService` never calls Sales; if Inventory appears to need something
  from Sales, the dependency is inverted with an event or the logic belongs in Sales.
- `ReportService` is read-only against every other module's tables and must not import another
  module's services. A report that needs domain arithmetic uses the same enum/value object,
  not the same service.
- Audit is written by model observers registered centrally, so no module has to remember to
  call it and no module can choose not to.
- Cross-module reads go through models and scopes, never raw joins written in another module's
  service. Pure logic reused by two services becomes an invokable in `app/Actions`, not a
  cross-module call. Report query objects are the single exception and live in `app/Queries`.
- A module's Form Requests and Policies are never used by another module. Shared validation
  rules live in `app/Rules`.
