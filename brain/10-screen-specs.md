# Screen Specs

Source: `routes/web.php`, `database/migrations/*.php`, the controllers listed in the
task brief, the staged FormRequest classes under `app/Http/Requests/`, and
`routes/api.php`. Field lists are derived from migration columns actually referenced by
each controller/validate() call, not from the full table schema.

---

## Dashboard

**Route**: `GET /` → `DashboardController@index` → name `dashboard`

**Purpose**: Landing screen showing today's sales, 30-day trend, stock/expiry/dues tiles.

**Fields shown** (all read-only tiles, no form):

| Tile | Source |
|---|---|
| Today's sales/purchases/profit/bill count | `ReportService::dailySalesSummary()`, cached 5 min (`pharmacy.dashboard.today`) |
| Last 30 days chart | `daily_sales_summary` table (`summary_date`, `total_sales`, `total_purchases`, `total_profit`, `bill_count`) |
| Stock count | `SUM(medicine_batches.quantity_available)` where `status='available'`, cached 5 min |
| Low stock count | medicines where batch stock sum ≤ `medicines.min_stock_level`, cached 5 min |
| Expiring in 30 / 90 days | `ReportService::expiryReport()`, cached 60 min |
| Pending customer payments | `SUM(customers.outstanding_balance)`, cached 5 min |
| Pending supplier payments | `SUM(suppliers.outstanding_balance)`, cached 5 min |
| Today's gross profit | Same as today tile; **hidden in the Blade view** for non-`report.profit` roles (cave law 2) |

**Dropdowns/selects**: None (tile dashboard, no form inputs).

**API endpoints called**: None from this controller; view is server-rendered.

**Database tables touched**: `daily_sales_summary` (read), `medicine_batches` (read), `medicines` (read), `customers` (read), `suppliers` (read). No writes.

**Validation rules**: N/A (no form).

**Permissions/roles gate**:
- Route: `middleware('can:dashboard.view')` — granted to every role.
- The `todayProfit` value is passed to the view but the view itself must gate its display with `Gate::allows('report.profit')` (per controller comment) — controller does not strip it from the payload.

---

## POS (Point of Sale)

**Routes**:
| Method | Path | Name | Controller action |
|---|---|---|---|
| GET | `/pos` | `pos.index` | `PosController@index` |
| POST | `/pos` | `pos.store` | `PosController@store` |
| POST | `/pos/hold` | `pos.hold` | `PosController@hold` |
| POST | `/pos/recall` | `pos.recall` | `PosController@recall` |
| GET | `/pos/held` | `pos.held` | `PosController@heldSlots` |

All under `middleware('can:sale.create')`.

**Purpose**: Cashier billing screen — build a cart, checkout, hold/recall in-progress bills.

**Fields shown/edited**:

| Field | Type | Required? | Notes |
|---|---|---|---|
| `lines[]` (cart) | array of `{medicine_id, quantity, unit_price?, discount?}` | required (checkout) | Validated by `StoreSaleRequest` — TBD, form request not staged |
| `customer_id` | integer, nullable | optional | Walk-in sale if omitted |
| `payments[]` | array of `{mode, amount, reference_no?}` | required (checkout) | Split-tender; `mode` maps to `payments.mode` check (`cash`,`card`,`upi`,`credit`) |
| Hold: `slot` | integer 1–9 | required | `hold()`/`recall()` validate `slot` inline |
| Hold: `cart` | array | required | Raw cart payload cached, not persisted to DB |

**Dropdowns/selects**:
- Medicine picker — populated via type-as-you-search against `GET /api/medicines/search` (see MedicineSearchController below), not a static select.
- Payment mode — fixed set `cash | card | upi | credit` (from `payments.mode` CHECK constraint), not DB-driven.
- Customer — searched/selected client-side; source table `customers`.
- Hold slot (1–9) — fixed range, not DB-driven.

**API endpoints it calls**:
- `GET /api/medicines/search?q=` (Api\MedicineSearchController@search) — typeahead as the cashier types.
- `GET /api/medicines/barcode/{code}` (Api\MedicineSearchController@barcode) — barcode scan lookup.
- `POST /pos` (`pos.store`) — commits the sale via `SalesService::createSale()`.
- `POST /pos/hold`, `POST /pos/recall`, `GET /pos/held` — session/cache-backed hold slots (`Cache` store, key `pos:hold:{userId}:{slot}`, TTL 12h) — **not** a database table; no `held_bills` table exists in the migrations.

**Database tables touched**: `sales`, `sale_items`, `medicine_batches` (FEFO deduction), `stock_transactions`, `invoice_counters`, `payments`, `prescriptions`, `customers` (credit/outstanding check) — all inside `SalesService::createSale()`, not directly by the controller. POS itself never queries `purchase_price`/`effective_cost`/`cost_price_at_sale` (cave law 2).

**Validation rules**:

| Field | Rule | Error condition |
|---|---|---|
| `slot` (hold/recall) | `required, integer, min:1, max:9` | missing/out of range |
| `cart` (hold) | `required, array` | missing |
| checkout `lines`, `customer_id`, `payments` | enforced by `StoreSaleRequest` (shape only — money/stock math is authoritative in `SalesService`) | see table below |

`StoreSaleRequest::rules()` (authorize: `true` — anyone hitting the route; real gate is route/service-level):

| Field | Rule | Note |
|---|---|---|
| `customer_id` | `nullable, integer, exists:customers,id` | |
| `lines` | `required, array, min:1` | |
| `lines.*.medicine_id` | `required, integer, exists:medicines,id` | |
| `lines.*.quantity` | `required, integer, min:1` | |
| `lines.*.discount` | `nullable, numeric, min:0, max:100` | |
| `lines.*.prescription_number` | `nullable, string, max:60` | |
| `lines.*.override` | `nullable, boolean` | |
| `lines.*.override_reason` | `nullable, string, max:255, required_if:lines.*.override,true` | |
| `payments` | `required, array, min:1` | |
| `payments.*.mode` | `required, string, in:<PaymentMode enum values>` | built from `PaymentMode::cases()` |
| `payments.*.amount` | `required, numeric` | |
| `payments.*.reference_no` | `nullable, string, max:60` | |

Plus a `withValidator()` after-hook: payments must sum to a positive amount unless a `credit` tender is present; a `credit` tender requires `customer_id` to be set. Both add errors to the `payments` key.

Domain-level errors surfaced as JSON `error_code` (422) rather than form validation:
`prescription_required`, `credit_limit_exceeded`, `expired_batch`, `insufficient_stock`, and a generic `sale_failed` (500).

**Permissions/roles gate**:
- Route: `can:sale.create` on the whole `/pos` group.
- `Gate::authorize('sale.create')` is also expected inside `SalesService`/`StoreSaleRequest` per the module docblock (route-level `can:` alone is not considered sufficient — see brain/08 §2 "three layers must agree").

---

## Medicines

**Routes**:
| Method | Path | Name | Controller action |
|---|---|---|---|
| GET | `/medicines` | `medicines.index` | `MedicinesController@index` |
| GET | `/medicines/create` | `medicines.create` | `MedicinesController@create` |
| POST | `/medicines` | `medicines.store` | `MedicinesController@store` |
| GET | `/medicines/{medicine}` | `medicines.show` | `MedicinesController@show` (route exists; no `show()` method found in controller — TBD, likely resolves to a resource/implicit view) |
| GET | `/medicines/{medicine}/edit` | `medicines.edit` | `MedicinesController@edit` |
| PUT | `/medicines/{medicine}` | `medicines.update` | `MedicinesController@update` |
| DELETE | `/medicines/{medicine}` | `medicines.destroy` | `MedicinesController@destroy` |
| POST | `/medicines/{medicine}/opening-stock` | `medicines.opening-stock.store` | `OpeningStockController@store` (separate controller, not in scope) |

Import routes (`/medicines/import*`) point at `MedicineImportController`, not in scope for this doc.

**Purpose**: Master-data CRUD for medicines (the "idea" of a medicine — no quantity/expiry, per cave law 3).

**Fields shown/edited** (from `medicines` table columns the controller loads/creates):

| Field | Type | Required? |
|---|---|---|
| `name` | string(180) | required, `max:180` |
| `generic_name` | string(180), nullable | optional |
| `brand` | string(120), nullable | optional |
| `category_id` | FK → categories, nullable | optional |
| `manufacturer_id` | FK → manufacturers, nullable | optional |
| `unit` | string(20) | required |
| `pack_size` | integer, default 1 | must be `> 0` (DB CHECK `medicines_pack_size_check`) |
| `hsn_code` | string(10), nullable | optional |
| `gst_rate` | decimal(5,2), default 0 | must be one of `0, 5, 12, 18` (DB CHECK `medicines_gst_rate_check`) |
| `default_purchase_price` | decimal(12,2), nullable | optional (cost field — visible only on edit/create forms behind `medicine.create`/`medicine.update`, not `medicine.view`/index) |
| `default_selling_price` | decimal(12,2), nullable | optional |
| `min_stock_level` | integer, default 0 | optional |
| `rack_location` | string(40), nullable (legacy free-text) | optional |
| `is_prescription_required` | boolean, default false | optional |
| `barcode` | string(64), nullable | optional, unique among non-null values (`medicines_barcode_unique` partial index) |
| `notes` | text, nullable | optional |
| `is_active` | boolean, default true | optional |
| `storage_zone_id` | FK → storage_zones, nullable | optional |
| `rack_id` | FK → racks, nullable | optional |
| `rack_shelf_id` | FK → rack_shelves, nullable | optional |
| `storage_temperature` | string(30), default `ambient_15_25` | optional |

**Dropdowns/selects**:
- Category — `Category::query()->orderBy('name')->get()` (all categories, not filtered to active-only in `create()`/`edit()`).
- Manufacturer — `Manufacturer::query()->orderBy('name')->get()` (all, not active-filtered).
- Storage zone — `StorageZone::query()->where('is_active', true)->orderBy('name')->get()` (active only).
- Rack — `Rack::query()->with('zone')->orderBy('rack_code')->get()` (not filtered by active).
- Rack shelf — `RackShelf::query()->with('rack')->orderBy('shelf_code')->get()`.
- Supplier (edit screen only, for batch context) — `Supplier::query()->where('is_active', true)->orderBy('name')->get(['id','name'])` (active only).

**API endpoints it calls**: None directly from this controller (import flow uses `MedicineImportController`, out of scope).

**Database tables touched**: `medicines` (CRUD, soft delete), `categories`/`manufacturers`/`storage_zones`/`racks`/`rack_shelves`/`suppliers` (read, for dropdowns), `medicine_batches` (eager-loaded with `supplier` on edit for display).

**Validation rules**: Enforced via `StoreMedicineRequest` / `UpdateMedicineRequest` (both authorize on `medicine.manage`; rule arrays are identical except `barcode` uniqueness scoping on update):

| Field | Rule | Note |
|---|---|---|
| `name` | `required, string, max:180` | |
| `generic_name` | `nullable, string, max:180` | |
| `brand` | `nullable, string, max:120` | |
| `category_id` | `nullable, integer, exists:categories,id` | |
| `manufacturer_id` | `nullable, integer, exists:manufacturers,id` | |
| `unit` | `required, string, max:20` | |
| `pack_size` | `required, integer, min:1` | |
| `hsn_code` | `nullable, string, max:10` | |
| `gst_rate` | `required, numeric, in:0,5,12,18` | G2.5/T-0203 — same invariant as the DB CHECK, enforced at both layers |
| `default_purchase_price` | `nullable, numeric, min:0` | |
| `default_selling_price` | `nullable, numeric, min:0` | |
| `min_stock_level` | `nullable, integer, min:0` | |
| `rack_location` | `nullable, string, max:40` | |
| `storage_zone_id` | `nullable, integer, exists:storage_zones,id` | |
| `rack_id` | `nullable, integer, exists:racks,id` | |
| `rack_shelf_id` | `nullable, integer, exists:rack_shelves,id` | |
| `storage_temperature` | `nullable, string, in:ambient_15_25,cold_2_8,frozen_minus_20,controlled_vault` | |
| `is_prescription_required` | `sometimes, boolean` | |
| `barcode` | `nullable, string, max:64, unique:medicines,barcode` (update: `->ignore($medicineId)`) | |
| `notes` | `nullable, string` | |
| `is_active` | `sometimes, boolean` | |

Database-level invariants that will surface as errors regardless of form rules:

| Constraint | Rule |
|---|---|
| `medicines_gst_rate_check` | `gst_rate IN (0,5,12,18)` |
| `medicines_pack_size_check` | `pack_size > 0` |
| `medicines_barcode_unique` | barcode unique when not null |

**Permissions/roles gate**:
- `index`/`show` → `Gate::authorize('medicine.view')`
- `create`/`store` → `medicine.create` (route middleware `can:medicine.create`; controller does not call `Gate::authorize` again in `store()` — relies on the route + FormRequest)
- `edit`/`update` → `Gate::authorize('medicine.update')` (edit only; `update()` relies on `UpdateMedicineRequest`'s own authorization, no explicit `Gate::authorize` call in the method body)
- `destroy` → `Gate::authorize('medicine.delete')`
- Cave law 2: `index()` explicitly calls `->withoutCost()` on the query to keep cost columns out of the listing regardless of role.

---

## Purchases

**Routes**:
| Method | Path | Name | Controller action |
|---|---|---|---|
| GET | `/purchases/create` | `purchases.create` | `PurchaseController@create` |
| POST | `/purchases` | `purchases.store` | `PurchaseController@store` |
| GET | `/purchases` | `purchases.index` | `PurchaseController@index` |
| GET | `/purchases/{purchase}` | `purchases.show` | `PurchaseController@show` |
| POST | `/purchases/{purchase}/confirm` | `purchases.confirm` | `PurchaseController@confirm` |
| POST | `/purchases/{purchase}/cancel` | `purchases.cancel` | `PurchaseController@cancel` |

**Purpose**: Enter a supplier invoice as a draft, then confirm it (moves stock) or cancel it.

**Fields shown/edited**:

Purchase header (`purchases` table):

| Field | Type | Required? |
|---|---|---|
| `supplier_id` | FK → suppliers | required |
| `invoice_no` | string(60) | required; unique per `(supplier_id, invoice_no)` (DB unique index — "same bill entered twice" guard) |
| `invoice_date` | date | required |
| `status` | enum `draft/confirmed/cancelled`, default `draft` | set by controller, not user-entered |

Purchase item lines (`purchase_items`, one row per `items[]` entry):

| Field | Type | Required? |
|---|---|---|
| `medicine_id` | FK → medicines | required |
| `batch_no` | string(60) | required |
| `expiry_date` | date | required |
| `quantity` | integer | required |
| `free_quantity` | integer, default 0 | optional |
| `purchase_price` | decimal(12,2) | required |
| `mrp` | decimal(12,2) | required |
| `selling_price` | decimal(12,2) | required |
| `gst_rate` | decimal(4,2), default 0 | required |
| `line_total` | decimal(12,2) | computed server-side (`base + gst`, via `bcmul`/`bcdiv`/`bcadd`), not user-entered |

**Dropdowns/selects**:
- Supplier — `Supplier::query()->orderBy('name')->get(['id','name'])` (not filtered to active-only).
- Medicine — `Medicine::query()->withoutCost()->orderBy('name')->get(['id','name','unit','gst_rate'])` — cost columns explicitly excluded even on the purchasing screen's medicine picker (cave law 2 applies broadly, not just to POS).

**API endpoints it calls**: None seen in this controller (medicine picker appears to be server-rendered from the `create()` payload, not an AJAX search like POS).

**Database tables touched**: `purchases`, `purchase_items` (writes on `store()`); `medicine_batches`, `stock_transactions`, `suppliers.outstanding_balance` (writes inside `PurchaseService::confirm()`/`cancel()`, not the controller itself).

**Validation rules**: Enforced via `StorePurchaseRequest` (authorize: `purchase.create`; shape/permission only — cost math, `effective_cost`, and stock movement are decided by `PurchaseService`/`InventoryService` inside their transaction):

| Field | Rule | Note |
|---|---|---|
| `supplier_id` | `required, integer, exists:suppliers,id` | |
| `invoice_no` | `required, string, max:64` | |
| `invoice_date` | `required, date, before_or_equal:today` | |
| `items` | `required, array, min:1` | |
| `items.*.medicine_id` | `required, integer, exists:medicines,id` | |
| `items.*.batch_no` | `required, string, max:64` | |
| `items.*.expiry_date` | `required, date, after:today` | DR-EXP-01 — a batch already expired on arrival is a data-entry error, not a purchase |
| `items.*.quantity` | `required, integer, min:1` | |
| `items.*.free_quantity` | `required, integer, min:0` | DR-FREE-01/02 — free goods are quantity, never cost |
| `items.*.purchase_price` | `required, numeric, min:0` | |
| `items.*.mrp` | `required, numeric, min:0` | |
| `items.*.selling_price` | `required, numeric, min:0` | |
| `items.*.gst_rate` | `required, numeric, in:0,5,12,18` | DR-GST-01 |
| `items.*.discount_percent` | `nullable, numeric, min:0, max:100` | |

Custom messages override `items.*.expiry_date.after` and `items.*.gst_rate.in`. Known DB-level invariant: `purchases` unique on `(supplier_id, invoice_no)`.

**Permissions/roles gate**:
- `index`/`show` → `Gate::authorize('purchase.view')`
- `create`/`store` → route `can:purchase.create`, plus explicit `Gate::authorize('purchase.create')` inside `store()`
- `confirm` → route `can:purchase.confirm` + `Gate::authorize('purchase.confirm')`
- `cancel` → route `can:purchase.cancel` + `Gate::authorize('purchase.cancel')`
- Only `draft` purchases carry no stock; `store()` never moves stock — only `confirm()` does, via `PurchaseService`.

---

## Inventory

**Routes**:
| Method | Path | Name | Controller action |
|---|---|---|---|
| GET | `/inventory` | `inventory.index` | `InventoryController@index` |
| GET | `/inventory/racks` | `inventory.racks` | `InventoryController@racks` |
| GET | `/inventory/low-stock` | `inventory.low-stock` | `InventoryController@lowStock` |
| GET | `/inventory/expiry-report` | `inventory.expiry-report` | `InventoryController@expiryReport` |

All under `middleware('can:inventory.view')`.

**Purpose**: Read-only batch-level stock views (by batch, by rack/shelf, low-stock, expiry).

**Fields shown** (read-only; no create/edit form on this controller):

`inventory.index` — batch list filterable by:

| Filter field | Type | Required? |
|---|---|---|
| `medicine_id` | integer, query param | optional |
| `expiry_from` | date, query param | optional |
| `expiry_to` | date, query param | optional |

Displayed columns come from `medicine_batches` (`batch_no`, `expiry_date`, `quantity_available`, `status`, ...) joined to `medicine` — cost columns (`purchase_price`, `effective_cost`) are not excluded in the query here explicitly, but the screen is behind `inventory.view` (admin/pharmacist), not the cashier POS.

`inventory.low-stock` — no filters; compares `SUM(quantity_available)` per medicine (batches with `status='available'`) against `medicines.min_stock_level`, computed in PHP after fetch (not SQL `HAVING`).

`inventory.expiry-report` — filter:

| Field | Type | Required? | Default |
|---|---|---|---|
| `days` | integer, query param | optional | 90, clamped to `[1, 365]` |

Shows batches with `status IN (available, quarantined)` and `expiry_date <= now() + days`.

`inventory.racks` — no filters; nested read of `storage_zones → racks → rack_shelves → medicines → batches (available only)`, with per-medicine `current_stock` sum.

**Dropdowns/selects**:
- Medicine filter on `inventory.index` — `Medicine::query()->orderBy('name')->get(['id','name'])` (all medicines, not active-filtered).

**API endpoints it calls**: None — all four actions are server-rendered Blade views.

**Database tables touched**: `medicine_batches`, `medicines`, `storage_zones`, `racks`, `rack_shelves` — all read-only. Nothing here ever writes `quantity_available` (cave law 1 — enforced by convention/comment, not a DB trigger in this migration set for this table's writes).

**Validation rules**: No `validate()` calls — filters are read via `Request::filled()`/`integer()`/`date()` with no explicit validation rules; `days` is clamped in PHP (`max(1, min(365, ...))`) rather than rejected.

**Permissions/roles gate**: `Gate::authorize('inventory.view')` on every action, plus route-level `can:inventory.view` on the whole group.

---

## Stock Adjustments

**Routes**:
| Method | Path | Name | Controller action |
|---|---|---|---|
| GET | `/stock-adjustments/create` | `stock-adjustments.create` | `StockAdjustmentController@create` |
| POST | `/stock-adjustments` | `stock-adjustments.store` | `StockAdjustmentController@store` |

Deliberately no index/show route — adjustments are viewed via Inventory/audit log, not a list screen of their own.

**Purpose**: Admin-only manual stock correction (damage, theft, counting error, etc.), always routed through `InventoryService`.

**Fields shown/edited** (`stock_adjustments` table):

| Field | Type | Required? |
|---|---|---|
| `medicine_batch_id` | FK → medicine_batches | required |
| `quantity_change` | integer, non-zero | required (DB CHECK `stock_adjustments_quantity_change_check`); sign determines add vs. remove |
| `reason` | string(30) enum | required; DB CHECK `reason IN ('damaged','expired','theft','counting_error','sample','opening_stock')` |
| `note` | text, nullable | optional |
| `user_id` | FK → users | set from `auth()->id()`, not user-entered |

**Dropdowns/selects**:
- Batch — `MedicineBatch::query()->with('medicine')->orderBy('expiry_date')->get()` (all batches, no status filter).
- Reason — `AdjustmentReason::cases()` (PHP enum, backed by the same values as the DB CHECK).

**API endpoints it calls**: None — traditional POST form.

**Database tables touched**: `stock_adjustments` (insert), `medicine_batches` (row locked with `lockForUpdate()`, quantity updated via `InventoryService`), `stock_transactions` (insert, type `adjustment_add`/`adjustment_remove`) — the latter two writes happen inside `InventoryService::receiveStock()`/`deductStock()`, not directly in the controller.

**Validation rules**: Enforced via `StoreStockAdjustmentRequest` (authorize: `stock.adjust`; shape only, the admin-only rule itself is the Gate's job per DR-ADJ-01/02/03):

| Field | Rule | Note |
|---|---|---|
| `medicine_batch_id` | `required, integer, exists:medicine_batches,id` | |
| `reason` | `required, Rule::enum(AdjustmentReason::class)` | |
| `quantity_change` | `required, integer, not_in:0` | signed: positive = add, negative = remove; zero is meaningless |
| `note` | `required_if` (reason is `damaged` or `theft`), else `nullable`, `string, max:1000` | blank string normalised to `null` in `prepareForValidation()` before the rule runs |

Custom messages: `quantity_change.not_in` → "Quantity change cannot be zero."; `note.required` → "A note is required when the reason is damaged or theft." DB-level invariants:

| Constraint | Rule |
|---|---|
| `stock_adjustments_reason_check` | `reason IN ('damaged','expired','theft','counting_error','sample','opening_stock')` |
| `stock_adjustments_quantity_change_check` | `quantity_change <> 0` |
| `medicine_batches_quantity_available_check` | resulting `quantity_available >= 0` (a large negative adjustment is rejected inside `deductStock()`) |

**Permissions/roles gate**: `Gate::authorize('stock.adjust')` on both actions, backed by route `can:stock.adjust`. Comment states this permission is "permanently admin-only... regardless of the runtime permission grid" (DR-ADJ-01).

---

## Customers

**Routes**:
| Method | Path | Name | Controller action |
|---|---|---|---|
| GET | `/customers/create` | `customers.create` | `CustomersController@create` |
| POST | `/customers` | `customers.store` | `CustomersController@store` |
| GET | `/customers` | `customers.index` | `CustomersController@index` |
| GET | `/customers/{customer}` | `customers.show` | `CustomersController@show` (route exists; no `show()` method found in controller — TBD) |
| GET | `/customers/{customer}/edit` | `customers.edit` | `CustomersController@edit` |
| PUT | `/customers/{customer}` | `customers.update` | `CustomersController@update` |
| DELETE | `/customers/{customer}` | `customers.destroy` | `CustomersController@destroy` |

**Purpose**: Master-data CRUD for customers (credit/patient records).

**Fields shown/edited** (`customers` table):

| Field | Type | Required? |
|---|---|---|
| `name` | string(150) | required |
| `phone` | string(20), nullable | optional; unique among live rows, scoped by customer id on update |
| `email` | string(160), nullable | optional; must be valid email |
| `address` | text, nullable | optional |
| `doctor_name` | string(150), nullable | optional |
| `gstin` | string(15), nullable | optional |
| `state_code` | string(2), nullable | optional; exactly 2 chars |
| `credit_limit` | decimal(12,2), default 0 | optional; ≥ 0 |
| `is_active` | boolean, default true | optional |
| `outstanding_balance` | decimal(12,2) | **not editable on this form** — moves only via `SalesService`/payments |
| `created_by` | FK → users | set server-side from authenticated user, not user-entered |

**Dropdowns/selects**: None — plain text/number fields.

**API endpoints it calls**: None.

**Database tables touched**: `customers` (CRUD, soft delete).

**Validation rules** (inline `Request::validate()`, `store()`/`update()` identical except the unique scope):

| Field | Rule | Error condition |
|---|---|---|
| `name` | `required, string, max:150` | missing, non-string, over 150 chars |
| `phone` | `nullable, string, max:20, unique:customers,phone[,{id}]` | duplicate phone among live rows |
| `email` | `nullable, email, max:160` | invalid email format |
| `address` | `nullable, string` | — |
| `doctor_name` | `nullable, string, max:150` | — |
| `gstin` | `nullable, string, max:15` | — |
| `state_code` | `nullable, string, size:2` | not exactly 2 chars |
| `credit_limit` | `nullable, numeric, min:0` | negative value |
| `is_active` | `sometimes, boolean` | non-boolean value |

**Permissions/roles gate**:
- `index`/`show` → `Gate::authorize('customer.view')`
- `create`/`store` → `Gate::authorize('customer.create')` (also route `can:customer.create`)
- `edit`/`update` → `Gate::authorize('customer.update')`
- `destroy` → `Gate::authorize('customer.delete')` (soft delete only)

---

## Suppliers

**Routes**:
| Method | Path | Name | Controller action |
|---|---|---|---|
| GET | `/suppliers/create` | `suppliers.create` | `SuppliersController@create` |
| POST | `/suppliers` | `suppliers.store` | `SuppliersController@store` |
| GET | `/suppliers` | `suppliers.index` | `SuppliersController@index` |
| GET | `/suppliers/{supplier}` | `suppliers.show` | `SuppliersController@show` (route exists; no `show()` method in controller — TBD) |
| GET | `/suppliers/{supplier}/edit` | `suppliers.edit` | `SuppliersController@edit` |
| PUT | `/suppliers/{supplier}` | `suppliers.update` | `SuppliersController@update` |
| DELETE | `/suppliers/{supplier}` | `suppliers.destroy` | `SuppliersController@destroy` |

**Purpose**: Master-data CRUD for suppliers (vendor records, GST/DL details, payment terms).

**Fields shown/edited** (`suppliers` table):

| Field | Type | Required? |
|---|---|---|
| `name` | string(150) | required |
| `contact_person` | string(120), nullable | optional |
| `phone` | string(20), nullable | optional |
| `email` | string(160), nullable | optional; valid email |
| `address` | text, nullable | optional |
| `state_code` | string(2), nullable | optional; exactly 2 chars |
| `gstin` | string(15), nullable, unique | optional; unique across all suppliers (not scoped to live-only in the migration, unlike categories/manufacturers) |
| `drug_license_no` | string(40), nullable | optional |
| `payment_terms_days` | integer, default 0 | optional; ≥ 0 |
| `is_active` | boolean, default true | optional |
| `outstanding_balance` | decimal(12,2) | **not editable on this form** — maintained only by `PurchaseService`/payments |
| `created_by` | FK → users | set server-side |

**Dropdowns/selects**:
- `state_code` — populated from a hardcoded PHP array in `SuppliersController::stateCodes()` (17 Indian states/UTs with GST codes), not a DB table.

**API endpoints it calls**: None.

**Database tables touched**: `suppliers` (CRUD, soft delete).

**Validation rules**:

| Field | Rule | Error condition |
|---|---|---|
| `name` | `required, string, max:150` | missing/too long |
| `contact_person` | `nullable, string, max:120` | — |
| `phone` | `nullable, string, max:20` | — |
| `email` | `nullable, email, max:160` | invalid format |
| `address` | `nullable, string` | — |
| `state_code` | `nullable, string, size:2` | not 2 chars |
| `gstin` | `nullable, string, max:15, unique:suppliers,gstin[,{id}]` | duplicate GSTIN |
| `drug_license_no` | `nullable, string, max:40` | — |
| `payment_terms_days` | `nullable, integer, min:0` | negative |
| `is_active` | `sometimes, boolean` | — |

**Permissions/roles gate**:
- `index`/`show` → `Gate::authorize('supplier.view')`
- `create`/`store` → `Gate::authorize('supplier.create')`
- `edit`/`update` → `Gate::authorize('supplier.update')`
- `destroy` → `Gate::authorize('supplier.delete')`

---

## Sales (history / print / cancel)

**Routes**:
| Method | Path | Name | Controller action |
|---|---|---|---|
| GET | `/sales` | `sales.index` | `SaleController@index` |
| GET | `/sales/{sale}` | `sales.show` | `SaleController@show` |
| GET | `/sales/{sale}/print` | `sales.print` | `SaleController@print` |
| GET | `/sales/{sale}/print-thermal` | `sales.print-thermal` | `SaleController@printThermal` |
| POST | `/sales/{sale}/cancel` | `sales.cancel` | `SaleController@cancel` |

**Purpose**: Browse completed invoices, reprint A4/thermal receipts, cancel a same-day mistaken sale.

**Fields shown** (read-only; `sales` + `sale_items`):

Index filters:

| Field | Type | Required? |
|---|---|---|
| `from` | date, query param | optional |
| `to` | date, query param | optional |
| `q` | string, query param | optional — LIKE match against `invoice_no` |

Detail/print views show: `invoice_no`, `sale_date`, `customer`, line items (`medicine`, `batch`, `quantity`, `unit_price`, `discount`, `gst_rate`, `gst_amount`, `line_total`), `payments`, `prescription`. Never `cost_price_at_sale` (cave law 2 — excluded via the model's default relations, not filtered per-role in the controller).

**Dropdowns/selects**: None on this controller (filters are free-text/date inputs).

**API endpoints it calls**: None — Blade views, including print views rendered via dedicated print layouts.

**Database tables touched**: `sales`, `sale_items`, `payments`, `customers`, `prescriptions` (all read). `cancel()` triggers writes inside `SalesService::cancelSale()` — updates only `sales.status`/`payment_status`/`paid`/`due` (never `sale_items`), plus reversing `stock_transactions` rows.

**Validation rules**: No `validate()` calls on this controller. `cancel()` enforces a same-day business rule in PHP (`$sale->sale_date->isToday()`), surfaced as a form error, not a validation rule.

**Permissions/roles gate**:
- `index`/`show`/`print`/`print-thermal` → route `can:sale.view` (no per-method `Gate::authorize()` call in the controller body — relies on route middleware only).
- `cancel` → route `can:sale.void,sale` (policy-style check against the specific `$sale`) + `Gate::authorize('sale.void', $sale)` inside the method. Same-day restriction (ADR-0005) enforced again inside `SalesService::cancelSale()`, not just at the controller.

---

## Returns

**Routes**:
| Method | Path | Name | Controller action |
|---|---|---|---|
| GET | `/returns/create/{sale?}` | `returns.create` | `ReturnController@create` |
| POST | `/returns` | `returns.store` | `ReturnController@store` |

**Purpose**: Process a sales return (stock coming back from a customer), optionally pre-seeded from a specific sale.

**Fields shown/edited**:

| Field | Type | Required? |
|---|---|---|
| `sale_id` | FK → sales | required (on store) |
| `lines[]` | array of `{sale_item_id, quantity, ...}` | required — validated by `StoreReturnRequest`, TBD (not staged) |
| `reason` | text, nullable | optional |

Resulting `returns`/`return_items` rows (written by `ReturnService`, not the controller):

| Field (returns) | Type |
|---|---|
| `sale_id` | FK |
| `user_id` | FK, set from `auth` |
| `return_date` | date |
| `total_refund` | decimal(12,2) |
| `reason` | text, nullable |

| Field (return_items) | Type |
|---|---|
| `sale_item_id` | FK |
| `medicine_batch_id` | FK — always the **same** batch the original sale line drew from (DR-RET rule), never FEFO-nearest |
| `quantity` | integer — capped against `sale_item.quantity - sale_item.returned_quantity` |
| `refund_amount` | decimal(12,2) |

**Dropdowns/selects**: Sale/line picker is driven by the optional `{sale}` route param (`create/{sale?}`) which preloads `items.medicine`/`items.batch`; no separate DB-backed dropdown identified in this controller.

**API endpoints it calls**: None in this controller.

**Database tables touched**: `returns`, `return_items` (insert, via `ReturnService::processReturn()`), plus `sale_items.returned_quantity` update, `medicine_batches`/`stock_transactions` (stock restored) — all inside the service layer.

**Validation rules**: Enforced via `StoreReturnRequest` (authorize: `return.create`, requires pharmacist/admin — a cashier cannot process a return; shape-and-permission only, `ReturnService::processReturn()` re-validates quantities against locked `sale_item` rows inside the transaction per DR-RET-02):

| Field | Rule | Note |
|---|---|---|
| `sale_id` | `required, integer, exists:sales,id` | |
| `lines` | `required, array, min:1` | |
| `lines.*.sale_item_id` | `required, integer, exists:sale_items,id` | |
| `lines.*.quantity` | `required, integer, min:1` | |
| `lines.*.condition` | `required, string, in:good,damaged,expired` | |
| `reason` | `nullable, string, max:500` | |
| `out_of_window_reason` | `nullable, string, max:500, required_if:force_out_of_window,true` | DR-RET-10 |
| `force_out_of_window` | `sometimes, boolean` | |

Custom messages: `lines.required` → "Select at least one line to return."; `lines.*.condition.in` → "Condition must be good, damaged, or expired."

**Permissions/roles gate**:
- Both actions → `Gate::authorize('return.create')`, backed by route `can:return.create`.
- Comment: pharmacist/admin only — "a cashier cannot process a return." Permission key is `return.create` (not `sale.return`, despite older prose docs using that name).

---

## Reports

**Routes** (all `GET`, under `middleware('can:report.view')` except `reports.profit`):
| Path | Name | Controller action |
|---|---|---|
| `/reports/sales` | `reports.sales` | `ReportController@sales` |
| `/reports/purchases` | `reports.purchases` | `ReportController@purchases` |
| `/reports/stock-valuation` | `reports.stock-valuation` | `ReportController@stockValuation` |
| `/reports/expiry` | `reports.expiry` | `ReportController@expiry` |
| `/reports/movers` | `reports.movers` | `ReportController@movers` |
| `/reports/gst` | `reports.gst` | `ReportController@gst` |
| `/reports/customer-aging` | `reports.customer-aging` | `ReportController@customerAging` |
| `/reports/supplier-aging` | `reports.supplier-aging` | `ReportController@supplierAging` |
| `/reports/profit` | `reports.profit` | `ReportController@profit` — separate `can:report.profit` middleware |

**Purpose**: One screen per report type; sales, purchases, profit (admin-only), stock valuation, expiry, fast/slow movers, GST/HSN summary, customer/supplier aging. Each supports CSV export via `?format=csv`.

**Fields shown / filters** (query params, no `validate()` calls — read via `Request::filled()`/`integer()`/`query()`):

| Filter | Applies to | Type | Default |
|---|---|---|---|
| `from` / `to` | sales, purchases, profit, movers, gst | date | `from` = start of current month, `to` = now |
| `user_id` | sales | integer | none |
| `supplier_id` | purchases | integer | none |
| `days` | expiry | integer | 90 |
| `limit` | movers | integer | 10 |
| `format=csv` | all | string | triggers CSV stream instead of view |

**Dropdowns/selects**: Not built in this controller (likely populated in the Blade view from `users`/`suppliers` tables — TBD, view not in scope).

**API endpoints it calls**: None — server-rendered views or streamed CSV downloads.

**Database tables touched** (all read-only, via `ReportService`): `sales`, `sale_items`, `purchases`, `purchase_items`, `medicine_batches`, `medicines`, `customers`, `suppliers`. `stockValuation()` additionally strips `effective_cost`/`value_at_cost` columns in PHP for viewers who fail `Gate::allows('report.profit')`.

**Validation rules**: None — all inputs are optional query filters with PHP-side defaults, no rejection path for malformed input beyond normal type coercion (`$request->integer()`/`date()`).

**Permissions/roles gate**:
- All actions except `profit` → `Gate::authorize('report.view')`.
- `profit` → `Gate::authorize('report.profit')` — a **separate**, admin-only permission (cave law 2 / T-0504b), never folded into `report.view`.
- `stockValuation` → `report.view` for the base view, plus an in-method `Gate::allows('report.profit')` check that strips cost columns for non-profit-permitted viewers rather than blocking the whole report.

---

## Categories

**Routes**:
| Method | Path | Name | Controller action |
|---|---|---|---|
| GET | `/categories` | `categories.index` | `CategoriesController@index` |
| GET | `/categories/create` | `categories.create` | `CategoriesController@create` |
| POST | `/categories` | `categories.store` | `CategoriesController@store` |
| GET | `/categories/{category}/edit` | `categories.edit` | `CategoriesController@edit` |
| PUT | `/categories/{category}` | `categories.update` | `CategoriesController@update` |
| DELETE | `/categories/{category}` | `categories.destroy` | `CategoriesController@destroy` |

**Purpose**: Master-data CRUD for medicine categories (supports a self-referential parent for sub-categories).

**Fields shown/edited** (`categories` table):

| Field | Type | Required? |
|---|---|---|
| `name` | string(100) | required; unique among non-deleted rows (partial unique index `categories_name_unique`) |
| `parent_id` | FK → categories, nullable | optional; must reference an existing category |
| `description` | text, nullable | optional |
| `is_active` | boolean, default true | optional |

**Dropdowns/selects**:
- Parent category — validated as `exists:categories,id` but the controller does not explicitly build a list for the view; presumably the full `categories` table, self-referencing (TBD exact source — view not in scope).

**API endpoints it calls**: None.

**Database tables touched**: `categories` (CRUD, soft delete).

**Validation rules**:

| Field | Rule | Error condition |
|---|---|---|
| `name` | `required, string, max:100, unique:categories,name[,{id}]` | missing, >100 chars, duplicate active name |
| `parent_id` | `nullable, integer, exists:categories,id` | references non-existent category |
| `description` | `nullable, string` | — |
| `is_active` | `sometimes, boolean` | — |

**Permissions/roles gate**:
- `index` → `category.view`; `create`/`store` → `category.create`; `edit`/`update` → `category.update`; `destroy` → `category.delete`. All via `Gate::authorize()` plus matching route `can:` middleware.
- `destroy()` performs a soft delete only ("Master data is deactivated first; deletion is a soft delete only, never hard" — per controller comment).

---

## Manufacturers

**Routes**:
| Method | Path | Name | Controller action |
|---|---|---|---|
| GET | `/manufacturers` | `manufacturers.index` | `ManufacturersController@index` |
| GET | `/manufacturers/create` | `manufacturers.create` | `ManufacturersController@create` |
| POST | `/manufacturers` | `manufacturers.store` | `ManufacturersController@store` |
| GET | `/manufacturers/{manufacturer}/edit` | `manufacturers.edit` | `ManufacturersController@edit` |
| PUT | `/manufacturers/{manufacturer}` | `manufacturers.update` | `ManufacturersController@update` |
| DELETE | `/manufacturers/{manufacturer}` | `manufacturers.destroy` | `ManufacturersController@destroy` |

**Purpose**: Master-data CRUD for medicine manufacturers.

**Fields shown/edited** (`manufacturers` table):

| Field | Type | Required? |
|---|---|---|
| `name` | string(150) | required; unique among non-deleted rows (`manufacturers_name_unique` partial index) |
| `contact_person` | string(120), nullable | optional |
| `phone` | string(20), nullable | optional |
| `email` | string(160), nullable | optional |
| `address` | text, nullable | optional |
| `is_active` | boolean, default true | optional |

**Dropdowns/selects**: None (no FK fields on this form).

**API endpoints it calls**: None.

**Database tables touched**: `manufacturers` (CRUD, soft delete).

**Validation rules**:

| Field | Rule | Error condition |
|---|---|---|
| `name` | `required, string, max:150, unique:manufacturers,name[,{id}]` | missing, >150 chars, duplicate active name |
| `contact_person` | `nullable, string, max:120` | — |
| `phone` | `nullable, string, max:20` | — |
| `email` | `nullable, email, max:160` | invalid format |
| `address` | `nullable, string` | — |
| `is_active` | `sometimes, boolean` | — |

**Permissions/roles gate**: `index` → `manufacturer.view`; `create`/`store` → `manufacturer.create`; `edit`/`update` → `manufacturer.update`; `destroy` → `manufacturer.delete`. Soft delete only.

---

## Users

**Routes** (all under `middleware('can:user.manage')`):
| Method | Path | Name | Controller action |
|---|---|---|---|
| GET | `/users` | `users.index` | `UserController@index` |
| GET | `/users/create` | `users.create` | `UserController@create` |
| POST | `/users` | `users.store` | `UserController@store` |
| GET | `/users/{user}/edit` | `users.edit` | `UserController@edit` |
| PUT | `/users/{user}` | `users.update` | `UserController@update` |

No `DELETE /users/{user}` route — users are deactivated (via a separate `UserStatusController`, not in scope), never deleted. `UserController::destroy()` exists only as a documented 404 stub.

**Purpose**: Admin-only staff account management (name, email, password, role, active flag).

**Fields shown/edited** (`users` table, extended by the role/status migration):

| Field | Type | Required? |
|---|---|---|
| `name` | string | required (exact rule TBD, `StoreUserRequest` not staged) |
| `email` | string, unique | required, unique |
| `password` | string (hashed via `Hash::make`) | required on create; TBD whether optional on update |
| `role_id` | FK → roles, nullable | required in practice (form always supplies one) |
| `is_active` | boolean, default true | optional, defaults true on create |

**Dropdowns/selects**:
- Role — `Role::query()->orderBy('name')->get()` (all roles, table `roles`).

**API endpoints it calls**: None.

**Database tables touched**: `users` (create/update only — no delete), `roles` (read, for dropdown).

**Validation rules**: Enforced via `StoreUserRequest` (authorize: `user.create`) / `UpdateUserRequest` (authorize: `user.update`):

`StoreUserRequest::rules()`:

| Field | Rule | Note |
|---|---|---|
| `name` | `required, string, max:255` | |
| `email` | `required, string, email, max:255, unique:users,email` | |
| `role_id` | `required, integer, exists:roles,id` | |
| `password` | `required, string, min:10, confirmed` | |
| `is_active` | `boolean` | |

`UpdateUserRequest::rules()` — no `password` field (resets go through `users.password`/`UserPasswordController`; activation through `users.status`):

| Field | Rule | Note |
|---|---|---|
| `name` | `required, string, max:255` | |
| `email` | `required, string, email, max:255, unique:users,email` | `->ignore($userId)` |
| `role_id` | `required, integer, exists:roles,id` | |

Known DB constraint: `users.email` is unique.

**Permissions/roles gate**:
- Whole module behind route `can:user.manage`.
- Each action additionally calls `Gate::authorize()` with a finer-grained key: `index`→`user.view`, `create`/`store`→`user.create`, `edit`/`update`→`user.update`. Comment notes `user.manage` is "permanently admin-only, hard-denied to non-admins in the Gate regardless of the runtime permission grid."
- Deactivation (not deletion) is handled by a separate `users.status` route/`UserStatusController`, outside this controller's scope.

---

## Api/MedicineSearchController (supporting API, not a standalone screen)

**Routes** (registered in `routes/api.php`, not `web.php`):
| Method | Path | Controller action |
|---|---|---|
| GET | `/api/medicines/search?q=` | `MedicineSearchController@search` |
| GET | `/api/medicines/barcode/{code}` | `MedicineSearchController@barcode` |

**Purpose**: Typeahead medicine search and exact barcode lookup, consumed by the POS screen (and potentially Purchases, though `PurchaseController::create()` currently server-renders its medicine list instead of calling this API).

**Fields shown** (both actions return the same shape):

| Field | Source column |
|---|---|
| `id` | `medicines.id` |
| `name` | `medicines.name` |
| `generic_name` | `medicines.generic_name` |
| `barcode` | `medicines.barcode` |
| `unit` | `medicines.unit` |
| `category` | `categories.name` (eager-loaded, narrow select `id,name`) |
| `manufacturer` | `manufacturers.name` (eager-loaded, narrow select `id,name`) |
| `gst_rate` | `medicines.gst_rate` |
| `rack_location` | `medicines.rack_location` |
| `storage_temperature` | `medicines.storage_temperature` |
| `is_prescription_required` | `medicines.is_prescription_required` |

Cost columns (`default_purchase_price`, batch `effective_cost`) are never selected — enforced by an explicit narrow `select()` list, not by post-hoc JSON hiding (cave law 2).

**Dropdowns/selects**: N/A — this is the data source for POS's medicine picker, not a screen with its own dropdowns.

**API endpoints it calls**: N/A (this is itself an endpoint).

**Database tables touched**: `medicines` (read, `whereNull('deleted_at')`, `is_active = true`), `categories`, `manufacturers` (read, eager-loaded).

**Validation rules**:

| Field | Rule | Error condition |
|---|---|---|
| `q` (search only) | `required, string, min:3, max:100` | missing, <3 chars, >100 chars |
| `{code}` (barcode) | route param, no explicit `validate()` call | any string accepted; a non-matching code returns 404 JSON, not a 422 |

**Performance constraints** (documented in the controller, relevant to screen behavior): capped at 20 results (`SEARCH_LIMIT`), relies on a `pg_trgm` GIN index on `medicines.name`/`generic_name` rather than falling back to a `LIKE '%...%'` scan; p95 target < 150ms over 5,000 medicines / 20,000 batches (brain/06-ui-conventions.md §8).

**Permissions/roles gate**: No `Gate::authorize()` call in either action — enforced entirely via middleware in `routes/api.php`: the group carries `auth:web` + `throttle:pos` (session-cookie auth, 300 req/min/user, not `auth:sanctum` — see API Middleware section below), and each route additionally carries `can:medicine.view`.

---

## API Middleware

`routes/api.php` is **not** a public API — no `/api/v1` prefix, no token issuer (per
brain/05-routes-and-modules.md). It is POS's own private transport, authenticated by the
same session cookie as the web routes.

| Group | Middleware | Prefix | Route name prefix |
|---|---|---|---|
| Medicines (search/barcode) | `auth:web`, `throttle:pos` (300 req/min/user) | `/medicines` | `api.medicines.` |

Routes in the group:

| Method | Path | Name | Middleware (route-level, in addition to the group) |
|---|---|---|---|
| GET | `/api/medicines/search` | `api.medicines.search` | `can:medicine.view` |
| GET | `/api/medicines/barcode/{code}` | `api.medicines.barcode` | `can:medicine.view` |

Note: `{code}` in the barcode route is a plain route parameter, not model-bound to
`Medicine`'s key — barcodes change, ids don't. Every endpoint in this file selects through
`withoutCost()` (cave law 2): purchase_price/effective_cost/cost_price_at_sale must never
reach a cashier's browser via this API.

Currently only the Medicines search/barcode surface is registered (staged early because
Medicines/Import UI needs it); Phase 4 is expected to add the rest of the `api.pos.*`
surface (batches, quote, customers) per the file's header comment.

## Gaps / items marked TBD

- `MedicinesController@show`, `CustomersController@show`, `SuppliersController@show` are routed in `web.php` but no `show()` method exists in the staged controller source — likely present in a version not included in this file set, or handled elsewhere; flagged as TBD rather than assumed.
- Blade view files were not staged, so exact field labels/layout and any client-side-only dropdown sourcing (e.g., Categories' parent picker, Reports' user/supplier filter selects) are inferred from controller-supplied view data only, or marked TBD where no such data was found in the controller.
- `StoreOpeningStockRequest` (authorize: `stock.adjust` OR `medicine.update`) was also staged though not referenced by name in the original screen sections: `batch_no` (`required, string, max:64`), `expiry_date` (`required, date, after:today`), `quantity` (`required, integer, min:1`), `purchase_price` (`required, numeric, min:0`), `selling_price` (`required, numeric, min:0`), `mrp` (`nullable, numeric, min:0`), `supplier_id` (`nullable, integer, exists:suppliers,id`) — backs `POST /medicines/{medicine}/opening-stock` (`medicines.opening-stock.store`) noted in the Medicines routes table.
