# 01 — Architecture

Purpose: define the layers, where each kind of logic is allowed to live, how transactions and locks are taken, and how one POS sale travels through the system.

---

## 1. Layers

```
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  Browser — Blade views + Alpine.js + Tailwind (Vite-built assets)        │
 │  Keyboard-driven POS, dashboards, forms. No business rules here.         │
 └──────────────────────────────┬───────────────────────────────────────────┘
                                │  HTTP (LAN only)
 ┌──────────────────────────────▼───────────────────────────────────────────┐
 │  Routes + Middleware        routes/web.php, auth, can:<permission>       │
 └──────────────────────────────┬───────────────────────────────────────────┘
 ┌──────────────────────────────▼───────────────────────────────────────────┐
 │  Controllers (THIN)         resolve → delegate → respond                 │
 │  No calculation. No DB::transaction. No Eloquent writes.                 │
 └──────────────────────────────┬───────────────────────────────────────────┘
 ┌──────────────────────────────▼───────────────────────────────────────────┐
 │  Form Requests              shape + authorization + field validation     │
 │  "is this well-formed and is this user allowed" — never "is stock free"  │
 └──────────────────────────────┬───────────────────────────────────────────┘
 ┌──────────────────────────────▼───────────────────────────────────────────┐
 │  Services                   ALL business logic. Owns DB::transaction().  │
 │  SalesService · PurchaseService · InventoryService · ReturnService       │
 │  InvoiceService · ReportService · AuditService                           │
 └──────────────────────────────┬───────────────────────────────────────────┘
 ┌──────────────────────────────▼───────────────────────────────────────────┐
 │  Repositories / Eloquent    query building, scopes, locking reads        │
 │  Cost-column stripping for cashier sessions happens HERE                 │
 └──────────────────────────────┬───────────────────────────────────────────┘
 ┌──────────────────────────────▼───────────────────────────────────────────┐
 │  PostgreSQL 16              constraints, CHECKs, unique indexes          │
 │  The last line of defence. Every invariant the DB can hold, it holds.    │
 └──────────────────────────────────────────────────────────────────────────┘
```

> **Cave law:** Controllers contain no business logic. Every mutation of stock or money
> happens inside a Service, inside an explicit database transaction. A controller that
> calls `->save()` on a batch, a sale, or a payment is a defect, not a shortcut.

What each layer may and may not do:

| Layer | May | May not |
|---|---|---|
| Blade / Alpine | Render, format for display, capture keystrokes, call routes | Compute tax, decide a discount is allowed, decide stock is available |
| Controller | Resolve the Form Request, call one Service method, return a view/redirect/JSON | Loop over line items, touch Eloquent writes, open a transaction, compute totals |
| Form Request | `rules()`, `authorize()`, normalise input types | Query stock levels, compute money, write anything |
| Service | Own the transaction, orchestrate, compute, emit events, call AuditService | Render, know about HTTP, read `request()` directly (inputs arrive as arguments/DTOs) |
| Repository / Model | Queries, scopes, relations, locking reads, casts | Business decisions, cross-aggregate orchestration |
| PostgreSQL | Enforce FKs, uniques, CHECKs, NOT NULLs | Hold business logic in triggers, except the two immutability guards named below |

Validation is layered on purpose: a Form Request answers *"is this request well-formed and is
this user permitted?"*; a Service answers *"is this operation valid against the current state
of the database, right now, under a lock?"*. Screen data is always stale. The database is the
truth, re-checked inside the transaction.

---

## 2. Directory layout

```
app/
  Actions/                    single-purpose invokables reused across services
    AllocateFefoBatches.php   candidate discovery + FEFO ordering (no writes)
    ComputeLineTax.php        per-line GST maths (pure, unit-tested)
    ResolveFinancialYear.php  date -> "26-27"
  Console/
    Commands/
      StockVerifyCommand.php      stock:verify
      ExpiryScanCommand.php       expiry:scan
      BackupRunCommand.php        backup:run
      SummaryRebuildCommand.php   summary:rebuild
  Enums/
    Role.php  StockTransactionType.php  PaymentMode.php  BatchStatus.php
    AdjustmentReason.php  SaleStatus.php  GstRate.php
  Events/
    LowStockDetected.php  BatchNearingExpiry.php  SaleCompleted.php
    PurchaseConfirmed.php  DiscountOverridden.php  PrescriptionOverridden.php
  Exceptions/
    Domain/
      InsufficientStockException.php  ExpiredBatchException.php
      PrescriptionRequiredException.php  CreditLimitExceededException.php
      DiscountNotPermittedException.php
  Http/
    Controllers/              thin; one per resource, plus Pos/, Reports/
    Middleware/               EnsureActiveUser, SetTimezone, LogRequestContext
    Requests/                 StoreSaleRequest, StorePurchaseRequest, StoreReturnRequest, ...
    Resources/                JSON shapes for the Alpine-driven POS
  Listeners/
    NotifyLowStock.php  FlagBatchForReturn.php  WriteSaleAuditEntry.php
  Jobs/
    RebuildDailySummary.php  GenerateInvoicePdf.php  ScanExpiringBatches.php
  Models/                     User, Role, Permission, Medicine, MedicineBatch,
                              Sale, SaleItem, Purchase, PurchaseItem, StockTransaction, ...
  Policies/                   SalePolicy, PurchasePolicy, StockAdjustmentPolicy,
                              ReportPolicy, UserPolicy
  Providers/                  AppServiceProvider, AuthServiceProvider, EventServiceProvider
  Repositories/               MedicineRepository, BatchRepository, SaleRepository,
                              ReportRepository  (cost-column stripping lives here)
  Services/                   SalesService, PurchaseService, InventoryService,
                              ReturnService, InvoiceService, ReportService, AuditService
  Support/
    Money.php                 rupee/paisa helpers; never float
    Gst.php                   slab helpers, intra/inter-state split
bootstrap/
config/                       app.php (timezone Asia/Kolkata), pharmacy.php (business knobs)
database/
  migrations/                 ordered per brain/02-database-schema.md §12
  seeders/                    RoleSeeder, PermissionSeeder, SettingSeeder, InvoiceCounterSeeder
  factories/
resources/
  views/
    layouts/                  app.blade.php, print-a4.blade.php, print-80mm.blade.php
    pos/                      index, cart partials, payment modal
    medicines/ purchases/ sales/ returns/ inventory/ reports/ settings/
    components/               alert boxes, stat tiles, batch picker
  js/                         app.js, pos.js (Alpine components)
  css/                        app.css (Tailwind)
routes/
  web.php  console.php        (schedule definitions live in console.php / bootstrap)
tests/
  Feature/                    POS flow, purchase confirm/cancel, returns, permissions
  Unit/                       tax maths, FEFO allocation, invoice numbering, aging buckets
```

`app/Actions` is used, but narrowly: an Action is a pure or near-pure unit reused by more than
one Service (tax maths, FEFO ordering, financial-year resolution). Actions do not open
transactions and do not write. Orchestration stays in Services.

---

## 3. Core services and their single responsibilities

| Service | Single responsibility | Notable methods |
|---|---|---|
| **SalesService** | Turn a validated cart into an immutable sale: allocate stock FEFO, compute line and invoice totals, enforce Rx/discount/credit rules, record payments, obtain the invoice number, commit. | `complete(SaleDraft $draft, User $actor): Sale`, `hold()`, `recall()`, `cancel(Sale $sale, string $reason)` |
| **PurchaseService** | Own the purchase lifecycle: draft, confirm (create/find batches, push stock in, update supplier outstanding), cancel with reversal, record supplier payments. | `saveDraft()`, `confirm(Purchase $p, User $actor)`, `cancel(Purchase $p, string $reason)`, `recordPayment()` |
| **InventoryService** | **The only writer of `stock_transactions`, and therefore the only mutator of `medicine_batches.quantity_available`.** Applies a signed quantity change to a locked batch, writes the ledger row with `balance_after`, and maintains batch status. Also performs adjustments, expiry write-offs, and quarantine transitions. | `apply(MedicineBatch $batch, int $delta, StockTransactionType $type, Model $reference, User $actor, ?string $note)`, `lockBatches(array $ids)`, `adjust()`, `quarantine()`, `writeOffExpired()` |
| **ReturnService** | Sales returns and purchase returns: validate against the original line, cap quantities, route stock back to the *same* batch or to quarantine, produce refunds/credit notes/debit notes. | `returnSale(SaleReturnDraft $d, User $actor)`, `returnToSupplier(PurchaseReturnDraft $d, User $actor)` |
| **InvoiceService** | Produce identifiers and documents: the locked read-and-increment of `invoice_counters`, the formatted number `PHARM/26-27/00042`, and the A4 / 80mm renderings. | `nextNumber(string $series, string $financialYear): string`, `renderA4()`, `render80mm()` |
| **ReportService** | Read-only aggregation for dashboards and reports, including the cost-visibility rules by role and the summary-table/cache selection. Never writes business data. | `dashboard()`, `sales()`, `profit()`, `gst()`, `expiry()`, `aging()`, `stockValuation()` |
| **AuditService** | Write `audit_logs` rows with old/new JSONB snapshots, actor, IP and context. Called explicitly by the other services for the watched actions; also wired to model observers for master-data changes. | `record(string $action, ?Model $subject, array $old, array $new, ?string $note)` |

> **Cave law:** One door for stock. `InventoryService::apply()` is that door. No controller,
> job, seeder, observer, or test factory writes `quantity_available` directly. If you need
> stock to move, you write a `stock_transactions` row through `InventoryService`, and the
> batch quantity moves as a consequence.

---

## 4. Transaction boundaries and locking

### 4.1 Operations that must be atomic

| Operation | Everything inside one transaction |
|---|---|
| **Complete a sale** | Lock batches → re-validate quantity, expiry, Rx, credit → insert `sales` → insert `sale_items` (one per batch slice) → `InventoryService::apply()` per slice → insert `payments` → update `customers.outstanding_balance` if credit → obtain invoice number → insert audit rows |
| **Confirm a purchase** | Lock or create the affected batches → find-or-create `medicine_batches` → `apply()` per line (+quantity + free_quantity) → recompute `effective_cost` → set `purchases.status = confirmed` → update `suppliers.outstanding_balance` |
| **Cancel a purchase** | Lock batches → `apply()` the exact reversal per line → set status `cancelled` → reverse supplier outstanding |
| **Sales return** | Lock the original batches → cap quantity against `sale_item.quantity - returned_quantity` → insert `returns` + `return_items` → `apply()` positive (sellable) or quarantine (expired/damaged) → insert refund `payments` row or credit note → update `sale_items.returned_quantity` and `sales.status` |
| **Purchase return** | Lock batches → `apply()` negative → insert `purchase_returns` + items → adjust supplier outstanding |
| **Stock adjustment** | Lock batch → insert `stock_adjustments` → `apply()` signed change → audit |
| **Record a payment** | Insert `payments` / `customer_payments` / `supplier_payments` → update the corresponding `outstanding_balance` |
| **Expiry write-off** | Lock batch → `apply()` negative with type `expiry_writeoff` → set batch status `expired` |

Nothing outside this list opens a transaction. Reads, reports and renders do not.

### 4.2 Where `SELECT … FOR UPDATE` is taken

Row locks are taken on `medicine_batches` only, and only inside the operations above. The
locking read is a single statement per transaction:

```sql
SELECT id, medicine_id, batch_no, expiry_date, status,
       quantity_available, selling_price, mrp, effective_cost, gst_rate
FROM medicine_batches
WHERE id = ANY(:batch_ids)
ORDER BY id ASC
FOR UPDATE;
```

`customers` and `suppliers` rows whose `outstanding_balance` is mutated are updated with a
single arithmetic `UPDATE … SET outstanding_balance = outstanding_balance + :delta` statement
rather than a read-modify-write, so no explicit lock is needed there. `invoice_counters` is
locked implicitly by its `UPDATE … RETURNING` (see `02-database-schema.md` §10).

### 4.3 The lock ordering rule

> **Cave law:** Locks on `medicine_batches` are always acquired in ascending `id` order, in
> one statement, for every batch the whole operation will touch — never per line, never in
> FEFO order. Two transactions that lock the same set in the same order cannot deadlock.

FEFO wants expiry order; deadlock avoidance wants a stable global order. Both are satisfied by
splitting discovery from locking:

1. **Discover (no lock).** For every medicine in the cart, select candidate batch ids ordered
   by `expiry_date ASC, id ASC`. Over-fetch: take all sellable batches for that medicine, not
   just the first that appears to satisfy the quantity, so a concurrent depletion does not
   force a second lock pass.
2. **Lock (one statement, `id ASC`).** Union the candidate ids for the entire cart, sort
   ascending, and issue the single `FOR UPDATE` read above.
3. **Allocate (in memory).** Sort the locked rows by `(expiry_date ASC, id ASC)` and allocate
   FEFO. All quantities and expiry dates used are those returned by the locked read, never the
   values the browser sent.
4. **Insufficient after locking?** Do not take a second lock pass inside the same transaction
   — that is precisely how the ordering guarantee is lost. Roll back, re-discover, and retry
   the whole transaction, up to three attempts with a short backoff.
5. **Counter last.** The `invoice_counters` increment is the final write before commit, so the
   counter row is held for the shortest possible time.

Retry policy: PostgreSQL `40P01` (deadlock detected) and `40001` (serialization failure) are
retried up to 3 times with 50/100/200 ms backoff by a small `Retryable` wrapper in
`app/Support`. Any other exception aborts and surfaces to the user. A sale that fails after
retries produces no partial state — the transaction rolled back — and the attempt is logged.

Transaction hygiene: no HTTP call, no file write, no PDF render, no print, and no event
dispatch to a synchronous listener that does I/O may occur inside a transaction. Side effects
are queued or performed after commit (`DB::afterCommit`, queued listeners).

---

## 5. Events, listeners, jobs and schedule

### Events

| Event | Raised by | Listeners |
|---|---|---|
| `LowStockDetected` | `InventoryService::apply()` when a batch's medicine total falls to or below `medicines.min_stock_level` | `NotifyLowStock` (queued) — records a dashboard alert row / notification for admin and pharmacist |
| `BatchNearingExpiry` | `expiry:scan` when a batch crosses the 90-day or 30-day threshold for the first time | `FlagBatchForReturn` (queued) — marks the batch for the supplier-return worklist and records the alert |
| `SaleCompleted` | `SalesService::complete()`, dispatched after commit | `WriteSaleAuditEntry`, `RebuildDailySummary` (queued, debounced) |
| `PurchaseConfirmed` | `PurchaseService::confirm()`, after commit | summary rebuild, low-stock re-evaluation |
| `DiscountOverridden`, `PrescriptionOverridden` | `SalesService` | audit write (synchronous — the audit row is part of the same transaction; the event carries only notification concerns) |

All listeners that do I/O are queued. Events are dispatched after commit so a rolled-back
transaction never notifies anyone about something that did not happen.

### Queued jobs

Queue driver: `database` (there is no Redis in the shop). One `supervisor`-managed worker.

| Job | Purpose |
|---|---|
| `RebuildDailySummary` | Recompute `daily_sales_summary` for a given date; debounced so a burst of sales rebuilds once |
| `ScanExpiringBatches` | The heavy part of `expiry:scan`, so the scheduler returns quickly |
| `GenerateInvoicePdf` | A4 PDF rendering for e-mail/reprint; never in the billing path |

### Scheduled commands

| Command | Schedule (Asia/Kolkata) | What it does | Failure behaviour |
|---|---|---|---|
| `stock:verify` | 01:00 daily, and in every CI run | For every batch, compares `quantity_available` against `SUM(stock_transactions.quantity_change)`; reports every mismatch with batch id, expected, actual, and the last ledger row | Non-zero exit; alerts admin; **CI fails the build**. It never "fixes" the number silently — a drift is a bug to be found, not a value to be patched. |
| `expiry:scan` | 06:00 daily | Moves batches past expiry to status `expired`, raises `BatchNearingExpiry` for new entrants to the 90/30-day windows, and refreshes the expiry alert cache | Logged, retried next morning |
| `backup:run` | 02:00 daily | `pg_dump` (custom format) plus the uploads directory, 30-day rotation, copy to a second physical location; records size and checksum | Non-zero exit and a loud admin alert. A silent backup failure is treated as a production incident. |
| `summary:rebuild` | 00:30 daily, plus on demand | Rebuilds `daily_sales_summary` for the previous day (and a `--from`/`--to` range for corrections after a back-dated return) | Logged; the dashboard falls back to live queries if the row is missing |

> **Cave law:** `batch.quantity_available` must always equal `SUM(stock_transactions.quantity_change)`
> for that batch. `stock:verify` proves it nightly and in CI. A failing `stock:verify` blocks
> release.

---

## 6. Caching strategy for the dashboard

The dashboard aggregates over the largest tables in the system (`sales`, `sale_items`,
`stock_transactions`, `medicine_batches`) and is opened first thing every morning and refreshed
all day. Left uncached it becomes the slowest query in the shop at exactly the busiest hour.

Two mechanisms, chosen per tile:

| Tile | Source | Why |
|---|---|---|
| Today's sales ₹, bill count, gross profit, cash in drawer | Live query over *today only*, cached 5 minutes (`cache:pharmacy.dashboard.today`), invalidated on `SaleCompleted` | Today's slice is small and bounded; staleness of five minutes is acceptable but a completed sale should show immediately, so the event busts the key |
| 30-day sales chart, top-10 medicines this month, month-to-date totals | `daily_sales_summary`, one row per day, built by `summary:rebuild` | These aggregate over weeks of `sale_items`. Precomputing turns a multi-second scan into a 30-row read. Back-dated corrections re-run the rebuild for the affected dates. |
| Expiring in 30 / 90 days (count and value at risk) | Live query over `medicine_batches`, cached 60 minutes, refreshed by `expiry:scan` | Changes only on purchase, sale, or the daily scan; the table is indexed on `(expiry_date, status)` so the query is cheap even uncached |
| Below minimum stock | Live query, cached 5 minutes, busted by `LowStockDetected` | Must not lag: the point of the tile is to order today |
| Payments due (customer/supplier) | Live query on `outstanding_balance`, cached 5 minutes | Balances are maintained incrementally, so the query is an indexed scan of small tables |

Cache store is `file` (or `database`); there is no external cache server on the shop LAN. Keys
are namespaced `pharmacy.dashboard.*` and every key carries an explicit TTL — nothing is cached
forever. Report screens with user-chosen date ranges are **not** cached; they are read from
`daily_sales_summary` where the grain matches, and otherwise run live with the indexes listed
in `02-database-schema.md` §8.

> **Cave law:** The dashboard never slows the shop down at 11am. If a dashboard query cannot
> be served from cache or from `daily_sales_summary` inside 200 ms, the tile is redesigned —
> the fix is never "the counter waits".

---

## 7. How a request flows: one POS sale, end to end

A cashier bills two lines: 2 strips of Paracetamol (12 percent GST) and 1 strip of Amoxicillin
(Schedule H, 12 percent GST, 5 percent discount), paid in cash.

1. **Typing.** The cashier types three letters. Alpine calls `GET /pos/search?q=par`.
   `PosSearchController` calls `MedicineRepository::searchForPos()`, which returns name, pack,
   MRP, selling price, Rx flag, and *available quantity across sellable batches only*. Because
   the session role is cashier, the repository's cost-visibility scope removes
   `purchase_price` and `effective_cost` from the select list — they are never sent to the
   browser at all.
2. **Cart building.** Quantity is entered; Alpine keeps the cart in local state and shows the
   nearest-expiry batch it will probably draw from, a yellow flag if that batch expires within
   90 days, and a red ℞ mark on the Amoxicillin line. This display is advisory only.
3. **Payment.** F4 opens the payment modal; CASH is chosen; the tendered amount is entered and
   change is displayed. The cashier presses SAVE. Alpine posts the whole cart to
   `POST /pos/sales`.
4. **Route and middleware.** `auth` → `EnsureActiveUser` → `can:sale.create`. A deactivated or
   unpermitted user never reaches the controller.
5. **Form Request.** `StoreSaleRequest::authorize()` re-checks the gate; `rules()` validates
   shape: line items present, `medicine_id` exists, `quantity` is a positive integer, discount
   percent is numeric within 0–100, payment lines sum to the claimed total, prescription block
   present when the client believed it was needed. It does **not** check stock or expiry —
   those are state questions and belong under the lock.
6. **Controller.** `PosSaleController::store()` builds a `SaleDraft` from the validated payload
   plus `auth()->user()` and calls `SalesService::complete($draft, $actor)`. That is the whole
   controller body, plus the response.
7. **Service, outside the transaction.** `SalesService` resolves the financial year from the
   sale date, checks the discount cap against the actor's role, and checks the Schedule H
   requirement against `medicines.is_prescription_required`, requiring either a prescription
   payload or an override authorised by a pharmacist/admin. Failures throw typed exceptions
   before any lock is taken.
8. **Discovery.** For each cart medicine, `AllocateFefoBatches` selects candidate batch ids
   ordered by `expiry_date ASC, id ASC` — sellable batches only.
9. **`DB::transaction` opens.**
   a. `InventoryService::lockBatches()` issues the single `FOR UPDATE` read over the union of
      candidate ids, `ORDER BY id ASC`.
   b. Re-validation against the locked rows: still `quantity_available > 0`, still
      `expiry_date > CURRENT_DATE`, still status `available`. The browser's numbers are
      discarded.
   c. FEFO allocation in memory. Paracetamol needs 2 and the nearest-expiry batch has 1, so the
      line splits: 1 from batch B1024 and 1 from B1101. The customer sees one printed line;
      the database records two `sale_items` sharing a `group_key`.
   d. Per line: taxable amount after discount, then GST at the line's rate, split CGST/SGST
      because the place of supply is the shop's own state. Invoice totals are summed and the
      round-off to the rupee is placed in `sales.round_off`.
   e. Credit check — skipped here, this is a cash sale.
   f. `sales` row inserted, then each `sale_item` with `cost_price_at_sale` snapshotted from
      the batch's `effective_cost` and `hsn_code` snapshotted from the medicine.
   g. `InventoryService::apply()` once per slice: `-1` for B1024, `-1` for B1101, `-1` for the
      Amoxicillin batch. Each call writes a `stock_transactions` row with `balance_after` and
      the `sale_item` as its polymorphic reference, and decrements the locked batch. Batches
      reaching zero become status `finished`.
   h. The `payments` row is inserted (mode `cash`, amount, tendered, change).
   i. `InvoiceService::nextNumber('PHARM','26-27')` performs the locked read-and-increment on
      `invoice_counters` and the formatted `PHARM/26-27/00042` is written to the sale.
   j. `AuditService::record('sale.create', …)` writes the audit row inside the same transaction.
10. **Commit.** Only now do side effects run: `SaleCompleted` is dispatched after commit,
    queueing the summary rebuild and busting the dashboard cache key; `LowStockDetected` fires
    if Paracetamol has now fallen below its minimum.
11. **Response and print.** The controller returns the sale id and print payload; the browser
    opens the 80mm print view.

> **Cave law:** Print only after commit. A failed print is a reprint. A half-saved sale is a
> wrong stock count, a wrong invoice series, and an argument with a customer.

12. **If anything failed** — a batch emptied by the other terminal between discovery and lock,
    a deadlock, a constraint violation — the transaction rolls back whole. No `sales` row, no
    ledger row, no consumed invoice number in a committed sense, and the cashier is told
    exactly what changed ("Paracetamol B1024 no longer has 2; available 1"). The retry wrapper
    re-attempts the transient classes automatically before surfacing anything.
