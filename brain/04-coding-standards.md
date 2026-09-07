# Coding Standards

Purpose: the rules every line of PHP, Blade, and SQL in this repository must satisfy.

Read with `brain/01-architecture.md` (where code goes) and `brain/03-domain-rules.md` (what
the code must do). This file governs *how* it is written.

## 1. Language baseline

PHP 8.3. Every PHP file begins with:

```php
<?php

declare(strict_types=1);
```

No exceptions, including migrations, factories, and tests. A file without it fails Pint's
`declare_strict_types` rule and therefore fails CI.

### Features to use

| Feature | Where | Why |
|---|---|---|
| Readonly promoted constructor properties | DTOs, service constructors, value objects | An allocation result that can be mutated after it is returned is a bug waiting for a caller |
| Backed enums | Every status, type, mode, reason column | A status is a closed set; a string column with no enum drifts into typos |
| Typed everything | Parameters, returns, properties, closures | `mixed` and untyped are review-blocking |
| First-class callable syntax | `$this->allocate(...)` in collection pipelines | Clearer than string callables |
| `never` return type | Methods that always throw | Lets static analysis prune branches |
| Constants in enums / interfaces | Domain limits (`MAX_DISCOUNT_PERCENT`) | Named, not scattered literals |

`void` returns are permitted only on framework hooks (`boot`, `register`, `handle` on
listeners). A domain service method returns something the caller can assert on.

### Features to avoid

`match(true)` chains longer than five arms (extract a method), dynamic properties (banned by
8.2 anyway), `global`, `static` mutable state, and `env()` calls outside `config/`.

## 2. Style and static analysis

| Tool | Setting | Gate |
|---|---|---|
| Laravel Pint | `laravel` preset plus the overrides below, config in `pint.json` | `vendor/bin/pint --test` in CI |
| PHPStan + Larastan | **Level 6 minimum**, config in `phpstan.neon` | `vendor/bin/phpstan analyse` in CI |
| PSR-12 | Enforced through Pint | Same gate |

`pint.json` overrides on top of the `laravel` preset:

```json
{
  "preset": "laravel",
  "rules": {
    "declare_strict_types": true,
    "final_class": false,
    "ordered_imports": { "sort_algorithm": "alpha" },
    "no_unused_imports": true,
    "not_operator_with_successor_space": false,
    "php_unit_method_casing": false
  }
}
```

Level 6 is the floor, not the target. `app/Services` and `app/Enums` are additionally
analysed at level 8 via a second `phpstan-services.neon` include; new services must pass at
8. Baselines are permitted only for third-party stubs and must carry a comment naming the
package. A baseline entry for our own code is a defect, not a suppression.

> **Cave law:** no `@phpstan-ignore` and no baseline entry lands without a one-line reason on
> the same line. An unexplained suppression is a hidden bug with a lid on it.

## 3. Naming

| Thing | Convention | Example |
|---|---|---|
| Model | Singular, StudlyCase | `Medicine`, `MedicineBatch`, `StockTransaction` |
| Table | Plural, snake_case | `medicines`, `medicine_batches`, `stock_transactions` |
| Controller | Plural resource + `Controller` | `MedicinesController`, `SalesController` |
| Single-action controller | Verb phrase + `Controller`, `__invoke` | `ConfirmPurchaseController` |
| Service | `*Service`, in `app/Services` | `SalesService`, `InventoryService` |
| Form request | `Store*Request` / `Update*Request` | `StoreMedicineRequest`, `UpdateSupplierRequest` |
| Non-CRUD request | Verb + `Request` | `ConfirmPurchaseRequest`, `VoidSaleRequest` |
| Policy | Model singular + `Policy` | `SalePolicy` |
| Enum | Singular noun, no suffix, in `app/Enums` | `SaleStatus`, `PaymentMode` |
| DTO | Purpose + `Data`, in `app/Data` | `AllocationData`, `GstBreakupData` |
| Domain exception | Condition + `Exception`, in `app/Exceptions/Domain` | `InsufficientStockException` |
| Action | Verb phrase, invokable, in `app/Actions` | `AllocateFefoBatches`, `ComputeLineTax` |
| Query object | `*Query`, in `app/Queries` | `SellableBatchesQuery` |
| Artisan command | `namespace:verb` | `stock:verify`, `expiry:scan`, `summary:rebuild` |
| Blade component | `x-` + kebab-case | `x-expiry-pill` |
| Migration | `NNNN_NN_NN_create_x_table` / `add_y_to_x_table` | one concept per file |
| Test file | `Feature/{Module}/{Behaviour}Test.php` | `Feature/Pos/FefoAllocationTest.php` |

Boolean columns and properties read as assertions: `is_active`, `is_prescription_required`,
`has_free_goods`. Never `flag`, never `status_bool`.

## 4. Enums

Every status, type, mode, and reason is a **backed string enum** in `app/Enums`, cast on the
model via `protected function casts(): array`. String-backed, not int-backed: a DBA reading
`stock_transactions` at 2 a.m. must not need a lookup table. Each enum implements a `label():
string` for the UI and, where behaviour attaches, a small method that keeps the branch inside
the enum instead of scattering `match` statements across services.

```php
<?php

declare(strict_types=1);

namespace App\Enums;

enum StockTransactionType: string
{
    case Purchase = 'purchase';
    case Sale = 'sale';
    case SaleReturn = 'sale_return';
    case PurchaseReturn = 'purchase_return';
    case AdjustmentAdd = 'adjustment_add';
    case AdjustmentRemove = 'adjustment_remove';
    case ExpiryWriteoff = 'expiry_writeoff';
    case TransferIn = 'transfer_in';
    case TransferOut = 'transfer_out';
    case OpeningStock = 'opening_stock';

    /** +1 for inbound, -1 for outbound. The ledger's only arithmetic rule. */
    public function sign(): int
    {
        return match ($this) {
            self::Purchase, self::SaleReturn, self::AdjustmentAdd,
            self::TransferIn, self::OpeningStock => 1,
            self::Sale, self::PurchaseReturn, self::AdjustmentRemove,
            self::ExpiryWriteoff, self::TransferOut => -1,
        };
    }

    public function label(): string { /* ... */ }
}
```

### The enum list

| Enum | Cases (backing value = snake_case of the case name) |
|---|---|
| `UserRole` | `Admin`, `Pharmacist`, `Cashier` |
| `SaleStatus` | `Completed`, `PartiallyReturned`, `Returned`, `Cancelled` |
| `PaymentStatus` | `Unpaid`, `Partial`, `Paid`, `Refunded` |
| `PaymentMode` | `Cash`, `Card`, `Upi`, `Cheque`, `BankTransfer`, `Credit`, `CreditNote` |
| `StockTransactionType` | `Purchase`, `Sale`, `SaleReturn`, `PurchaseReturn`, `AdjustmentAdd`, `AdjustmentRemove`, `ExpiryWriteoff`, `TransferIn`, `TransferOut`, `OpeningStock` |
| `BatchStatus` | `Available`, `Expired`, `Finished`, `Quarantined` |
| `AdjustmentReason` | `Damaged`, `Expired`, `Theft`, `CountingError`, `Sample` |
| `PurchaseStatus` | `Draft`, `Confirmed`, `Cancelled` |

Notes that are rules, not trivia:

- `SaleStatus` has no `Draft` and no `Held`. A held bill is parked outside the `sales` table
  (see `brain/02-database-schema.md`) and becomes a sale only on commit. See ADR-0005.
- `PaymentMode::Credit` means "not paid now, charged to the customer account". A split
  payment is *several* `payments` rows, never a `Split` mode.
- `BatchStatus::Quarantined` is terminal for selling: quarantined stock is never allocated,
  and only a purchase return or write-off moves it out.
- `AdjustmentReason` is mandatory on every adjustment; there is deliberately no `Other`.
- `UserRole` (file `app/Enums/UserRole.php`) is the coarse role backing `roles.name`.
  Fine-grained rights are permission keys — see `brain/05-routes-and-modules.md`. Never branch
  on `UserRole` in a service; ask the Gate.
- `brain/01-architecture.md` also lists `GstRate` in `app/Enums`. It is a value enum for the
  0/5/12/18 slabs and follows every rule in this section.

## 5. Controllers

Thin. A controller resolves the request, calls one service method or one query object, and
returns a response.

Rules:

- No business logic. If a controller contains an `if` about domain state (stock, credit,
  expiry, GST), that `if` belongs in a service.
- **No DB writes outside a service.** No `Model::create()`, no `->save()`, no `DB::table()`
  in a controller, job, listener, command, or Blade view.
- No `DB::transaction` in a controller. Transactions are owned by services, which know the
  full unit of work.
- Validation lives in a Form Request. `$request->validate()` inline is permitted only in
  single-field toggle endpoints and is discouraged there too.
- Authorization lives in a Policy, invoked by `authorize()` in the Form Request or the
  `can:` middleware on the route. A controller never reads `auth()->user()->role`.
- Response shaping only: pick the view, pick the redirect, pick the flash message.
- Maximum around 15 lines per action. Longer means logic leaked in.

```php
public function store(StoreSaleRequest $request, SalesService $sales): RedirectResponse
{
    $sale = $sales->complete(SaleDraft::fromRequest($request), $request->user());

    return to_route('sales.show', $sale)->with('status', __('Sale :no saved', ['no' => $sale->invoice_no]));
}
```

## 6. Services

Services in `app/Services` hold the domain (`brain/01-architecture.md` §3 names them and their single responsibilities). They are constructor-injected, stateless
between calls, and never touch the request or the session — a service takes a DTO and the
acting `User`, not `Request`.

> **Cave law:** every service method that mutates stock or money opens `DB::transaction`,
> acquires row locks in **ascending id order**, and returns a typed DTO or a model — never an
> array of loose keys.

- **Transaction boundary.** One public method, one transaction. Nested calls between services
  join the outer transaction; they never open a second one and never `commit` on their own.
  A service method that mutates must be safe to call inside a caller's transaction.
- **Lock order.** Batches are discovered in FEFO order without a lock, then locked in **one**
  `SELECT … FOR UPDATE` statement ordered by `id ASC` covering every batch the operation will
  touch — never per line, never in FEFO order. `customers`/`suppliers` balances move by a
  single arithmetic `UPDATE`, and the `invoice_counters` increment is the last write before
  commit. The full procedure, including the retry policy, is in `brain/01-architecture.md`
  §4.3. See ADR-0002 and ADR-0006.
- **Re-read after lock.** Screen data is stale. Every quantity, price, expiry, and credit
  check is re-evaluated from the locked row inside the transaction, never from the payload.
- **Return types.** `AllocationData`, `SaleResult`, `Sale` — something typed. Returning
  `['ok' => true, 'ids' => [...]]` is rejected in review: loose arrays defeat PHPStan and rot
  silently when a key is renamed.
- **Side effects after commit.** Printing, mail, cache busting, and broadcasts fire from
  `DB::afterCommit()` or a queued job. Print failure is a small problem; a half-saved sale is
  a big one.
- **The ledger is the only door.** Only `InventoryService::apply()` writes
  `stock_transactions` and the matching `medicine_batches.quantity_available` change, in the
  same statement pair inside the same transaction. No other class updates
  `quantity_available`. See ADR-0003.

## 7. Money

> **Cave law:** money is never a float, never an `int` of rupees, and never a string that gets
> `+`-ed. Storage is `decimal(12,2)`. In PHP, money is `Brick\Money\Money`.

**The standard: `brick/money`, INR, scale 2, `RoundingMode::HALF_UP`.**

Why `Brick\Money` and not integer paise:

1. The database columns are `decimal(12,2)` (CLAUDE.md, Part 0). Integer paise would mean a
   representation change at every read and write boundary — 40+ columns across sales,
   purchases, payments, batches — and every missed conversion is a factor-of-100 bug in a
   customer's bill.
2. `Brick\Money` carries the currency and the scale in the type. `Money::of('12.00', 'INR')`
   cannot be silently added to a quantity or to a GST *rate*; a bare `int` can.
3. Rounding is explicit and auditable. GST at 12% on ₹26.88 forces the caller to name a
   rounding mode; integer arithmetic hides the same decision in an `intdiv`.
4. Allocation is solved. Splitting a line discount across two batches uses
   `Money::allocate()`, which distributes remainder paise without losing or inventing one.

Rules:

- Cast money columns with a `MoneyCast` returning `Brick\Money\Money`; models never expose a
  raw string or float for a money column.
- Arithmetic uses `plus`, `minus`, `multipliedBy`, `dividedBy` with an explicit
  `RoundingMode`. Never `+`, never `round()`.
- Percentages (GST rate, discount percent) are `decimal(5,2)` numbers, not money. A rate is
  not an amount.
- Rounding to the rupee happens once per sale, as the `round_off` column on `sales`. Line
  amounts keep paise.
- Formatting — the `₹` symbol, the Indian digit grouping — happens **only in the view layer**,
  through `<x-money :value="$sale->total" />`. A service that returns "₹1,234.50" is broken.
- Quantities are `integer`. If half-tablet dispensing is ever adopted it becomes
  `decimal(10,3)` in one migration across all quantity columns, never in one table alone.

ADR-0004 records this choice and the integer-paise alternative that was rejected.

## 8. Error handling

Domain failures are exceptions, not booleans and not flash strings. They live in
`app/Exceptions/Domain` — the tree in `brain/01-architecture.md` abbreviates this to
`app/Exceptions/`; the `Domain/` subdirectory is the standard, so domain failures stay
separable from infrastructure ones — and extend a shared `DomainException` that carries a stable
`errorCode(): string` and a user-facing `userMessage(): string`.

| Exception | Thrown when | HTTP | POS on-screen behaviour |
|---|---|---|---|
| `InsufficientStockException` | Locked batches cannot cover the requested quantity | 422 | Red toast "Only N left of {medicine}"; the offending line is highlighted, quantity field refocused, bill not saved |
| `ExpiredBatchException` | An allocation or return would touch a batch past `expiry_date` or `Quarantined` | 422 | Red modal naming batch and expiry; line removed and re-allocated on acknowledge |
| `CreditLimitExceededException` | `outstanding + this bill > credit_limit` with no admin override | 422 | Blocking modal with outstanding, limit, and shortfall; offers "Take payment" or an admin-override prompt |
| `PrescriptionRequiredException` | Save attempted with a Schedule H line and no prescription number or override | 422 | Focus jumps to the prescription field on the ℞ line; save button stays disabled |
| `DiscountNotPermittedException` | A discount above the configured threshold without an approving user | 422 | Override prompt asking for a pharmacist or admin credential; the bill is not saved until it is approved or the discount is reduced |

Mapping:

- `bootstrap/app.php` registers one renderable that converts any `DomainException` to a 422
  JSON body `{ "error_code": ..., "message": ..., "context": {...} }` for API and
  `X-Requested-With` requests, and to a `back()->withErrors()` redirect for form posts.
- The POS is an Alpine front end against `routes/api.php`; it reads `error_code` and picks the
  behaviour above. It never parses the message text.
- Domain exceptions are logged at `warning`, not `error`, and are excluded from alerting —
  they are expected outcomes of a busy counter, not faults.
- Anything not a `DomainException` is a 500, is logged at `error`, and shows the POS a generic
  "Could not save — nothing was charged" message. Because services are transactional, that
  statement is always true.
- Never catch a `DomainException` to continue silently. Catch it to translate it, or let it
  reach the handler.

## 9. Queries

- **No N+1.** Eager-load with `with()` on every list and report query. `Model::preventLazyLoading(! app()->isProduction())` is set in `AppServiceProvider::boot()`, so a lazy load throws in local, CI, and staging. Production only logs it, so a missed relation never takes the shop down mid-sale.
- Also enabled outside production: `Model::preventSilentlyDiscardingAttributes()` and `Model::preventAccessingMissingAttributes()`.
- **No raw SQL outside `app/Queries` and `app/Repositories`.** Reports may use `DB::select` with bound parameters inside a query object; a controller, service, or Blade file with a `DB::raw` in it is rejected. String interpolation into SQL is never acceptable — bind, always.
- **Cost columns are scoped away from cashier queries at the query layer.** `Medicine`, `MedicineBatch`, and `SaleItem` expose a `->sellable()` / `->withoutCost()` scope that explicitly `select()`s the permitted columns, and the POS and cashier-facing endpoints use only those. Hiding cost in a Blade template is not compliance with cave law 2 — the column must not leave the database.
- Aggregations over `sales`, `sale_items`, and `stock_transactions` for the dashboard read `daily_sales_summary` or a 5-minute cache, never the base tables live. See cave law 8.
- Index awareness is part of writing a query: if a new list screen filters on a column with no index, the migration adding the index ships in the same commit.
- Chunk anything unbounded (`chunkById`, `lazyById`). Imports of 3,000+ medicines never load a full collection.

## 10. Git

- **Branches:** `phase-N/short-slug` — `phase-4/fefo-allocation`, `phase-3/stock-verify-command`. Fixes on released work use `fix/short-slug`. Nothing is committed to `main` directly.
- **Commits:** Conventional Commits — `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `perf:`. Scope is the module: `feat(pos): allocate across batches by FEFO`. Body explains why; the diff already explains what. Reference the ADR when one applies.
- **Migrations:** one concept per migration. Creating a table, and adding an index to it later, are two files. Never combine a schema change with a data backfill; backfills are separate migrations or an Artisan command.
- **A migration that has run in production is frozen.** Fix it forward with a new migration. Editing a run migration makes the shop server and every developer machine disagree about a schema they both claim is version-matched.
- **Documentation ships with the change.** If a commit makes a `brain/` file wrong, the same commit fixes it. Append to `logs/build-log.md`; a real decision also gets an ADR and a line in `logs/decisions.log.md`.
- No commit leaves `main` failing Pint, PHPStan, or Pest. See `brain/07-testing-strategy.md`.

## 11. Forbidden patterns

| Forbidden | Reason |
|---|---|
| Writing `medicine_batches.quantity_available` outside `InventoryService::apply()` | Cave law 1. Two writers means two truths and `stock:verify` starts screaming with no way to tell which one lied |
| A `quantity`, `expiry_date`, or price column on `medicines` | Cave law 3. It duplicates batch data, drifts within a week, and cannot answer "which box on the shelf" |
| `float`/`double` for money, or `round()` on a rupee value | Paise vanish. An accountant finds it before you do |
| Selecting cost columns in a cashier-reachable query | Cave law 2. A blade `@can` is not a boundary; the network response is |
| `Sale::find($id)->update(...)` or deleting a sale | Cave law 8, ADR-0005. Stock and GST filings both point at that row; correct with a return or cancellation that writes reversing transactions |
| Allocating stock without `FOR UPDATE` inside a transaction | Cave law 4. Two cashiers sell the same last strip and the ledger goes negative |
| `invoice_no` from `count() + 1` or `max(id) + 1` | Duplicate invoice numbers under concurrency is a GST compliance failure, not a UI bug. Use the locked counter. ADR-0006 |
| Business logic in Blade or in Alpine | It cannot be tested, cannot be audited, and the client is not a trust boundary |
| `env()` outside `config/` | Returns `null` once config is cached, which is exactly how production runs |
| Queueing or dispatching before commit | The job runs against a state that may roll back. Use `DB::afterCommit()` |
| Catching `\Exception` broadly in a service | Swallows a rollback signal and turns a data bug into a silent wrong number |
| Seeder or job writing stock directly | Same as the first row. Opening stock is a `StockTransactionType::OpeningStock` row like everything else |
| `Carbon::now()` with no timezone assumption checked | Reports slice by `Asia/Kolkata` day boundaries; UTC drift moves takings between days |
