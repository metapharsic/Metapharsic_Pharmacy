# Testing Strategy

Purpose: what must be tested, at which layer, and how the hard cases (concurrency, ledger
integrity, money arithmetic) are actually tested rather than hoped about.

Test framework: **Pest 3** over PHPUnit, PostgreSQL 16 as the test database. Never SQLite —
this system depends on `FOR UPDATE`, `jsonb`, sequences, and trigram indexes, and a test suite
that runs on a database with different locking semantics tests a different program.

## 1. The pyramid for this project

| Layer | Directory | Count target | What it covers | Database |
|---|---|---|---|---|
| Unit | `tests/Unit` | Many, fast | Enums and their behaviour methods, money and GST value objects, FEFO ordering as a pure function, invoice-number formatting, date-window helpers | None |
| Service | `tests/Feature/Services` | The bulk of the suite | Every mutating service method: allocation, ledger writes, purchase confirm and cancel, returns, credit, payments. Transactions, locks, and reversal behaviour | Real Postgres |
| HTTP | `tests/Feature/Http` | One or two per route | Routing, Form Request validation, Policy enforcement, redirect and status codes. Smoke depth, not logic depth | Real Postgres |
| Integrity | `tests/Feature/Integrity` | Small, high value | Property-style checks: ledger sum equals batch balance, no orphan sale item, no negative availability, `stock:verify` clean after arbitrary sequences | Real Postgres |
| Concurrency | `tests/Concurrency` | A handful | Two-connection races: last unit, invoice number, credit limit | Real Postgres, no wrapping transaction |
| Browser | `tests/Browser` (Dusk, optional) | Very few | The POS keyboard contract end to end | Real Postgres |

The shape is deliberately service-heavy rather than HTTP-heavy. The risk in this system is
arithmetic and concurrency inside a transaction, not routing.

## 2. The non-negotiable test list

> **Cave law:** these ten behaviours have named tests that are never skipped, never marked
> incomplete, and never deleted to make a build green. If one fails, the build is broken and
> the shop does not get the release.

| # | Test | File | Asserts |
|---|---|---|---|
| 1 | FEFO picks the nearest expiry | `Feature/Services/Allocation/FefoOrderTest.php` | Given three sellable batches of one medicine with expiries in mixed insertion order, a sale of 1 unit consumes the earliest `expiry_date`; ties break by `id ASC`; quarantined and zero-quantity batches are skipped |
| 2 | Multi-batch split | `Feature/Services/Allocation/MultiBatchSplitTest.php` | Selling 10 when the nearest batch holds 4 creates two `sale_items` (4 + 6) against two batches, two `stock_transactions`, one invoice line group; the sum of allocations equals the requested quantity exactly, and `InsufficientStockException` is thrown — with nothing written — when the total across batches is short |
| 3 | Concurrent sale of the last unit | `Concurrency/LastUnitRaceTest.php` | Two connections both attempt the final unit. Exactly one commits; the other either blocks until the first commits and then fails with `InsufficientStockException`, or is rolled back. `quantity_available` ends at 0, never -1, and exactly one `stock_transactions` row exists for the sale |
| 4 | Expired batches are never allocated | `Feature/Services/Allocation/ExpiredBatchTest.php` | A batch expiring today or earlier, or in `Quarantined`/`Expired` status, is invisible to allocation even when it is the only stock; the attempt raises `InsufficientStockException`, and a batch that expires *between* quote and save is caught by the in-transaction re-check and raises `ExpiredBatchException` |
| 5 | Ledger sum equals batch balance after a random sequence | `Feature/Integrity/LedgerBalanceTest.php` | Generate a randomised but seeded sequence of 200 operations (purchase, sale, return, adjustment, write-off, purchase cancel) and assert for every batch that `quantity_available == SUM(quantity_change)`, that `balance_after` on each row matches the running total in `created_at, id` order, and that `stock:verify` exits 0. Cave law 7 |
| 6 | Invoice numbers are unique under concurrency | `Concurrency/InvoiceNumberRaceTest.php` | Eight connections each save a sale simultaneously; eight distinct invoice numbers result, contiguous within the financial-year series, correctly formatted (`PHARM/26-27/00042`), and a unique index violation is never reached. ADR-0006 |
| 7 | A return restores the same batch | `Feature/Services/Returns/ReturnSameBatchTest.php` | Returning a line puts stock back into the exact `medicine_batch_id` recorded on the `sale_item`, never into the current FEFO-nearest batch; return quantity cannot exceed sold minus already-returned; and an expired-on-return item goes to `Quarantined`, not to sellable stock |
| 8 | Profit uses snapshot cost | `Feature/Reports/ProfitSnapshotTest.php` | Sell at a known `cost_price_at_sale`, then change the batch's `purchase_price`, then run the profit report: the figure is unchanged. Cave law 6, ADR-0005 |
| 9 | A cashier query never exposes cost | `Feature/Http/Pos/CashierCostExposureTest.php` | Every POS endpoint and every cashier-reachable page, called as a cashier, produces a response body containing none of `purchase_price`, `effective_cost`, `cost_price_at_sale`; the test asserts on the raw response, not the rendered view, and iterates the route list so a new cashier route is covered automatically. Cave law 2 |
| 10 | GST math per slab, including round-off | `Feature/Services/Tax/GstCalculationTest.php` | A table-driven set of cases across 0/5/12/18 with line discounts, bill discount, and multi-slab baskets: taxable value, CGST/SGST split, per-slab totals, `round_off` in ±0.50, and `subtotal - discount + gst + round_off == total` to the paise. Includes the classic 26.88 and 93.68 lines from `CAVEMAN_DESIGN.md` Part 5 |

Two supporting rules:

- Every one of these carries a comment naming the cave law or ADR it defends, so nobody
  "simplifies" it later without reading why it exists.
- Test 5 is seeded from a fixed seed in CI and from a random seed in the nightly run; a
  nightly failure prints the seed for exact replay.

## 3. Testing concurrency in Pest — honestly

Concurrency is the hardest thing here to test, and the usual test setup actively prevents it.
Be clear about why:

- `RefreshDatabase` wraps each test in a transaction that is rolled back. Work done on
  connection A is then invisible to connection B, so a two-connection race sees an empty
  database and passes for the wrong reason.
- A single PHP process cannot hold two genuinely concurrent transactions with one connection.
  It can with two connections, but they must be real, separate PDO handles.
- `pcntl_fork` gives true parallelism on Linux CI, but is unavailable on the Windows
  development machine (`C:\Metapharsic_pharmacy`) and makes failure output hard to read.

### The practical approach: two connections, no wrapping transaction

1. `config/database.php` defines a second connection `pgsql_test_b` pointing at the same test
   database with the same credentials. It is a distinct PDO handle, which is the whole point.
2. Tests in `tests/Concurrency` use `DatabaseTruncation` (not `RefreshDatabase`) so committed
   work is visible across connections, and are tagged `->group('concurrency')`.
3. The race is made deterministic with `lock_timeout` instead of sleeps:

```php
it('lets only one cashier sell the last unit', function () {
    $batch = MedicineBatch::factory()->create(['quantity_available' => 1]);

    // Connection A: take the row lock and hold it.
    DB::connection('pgsql')->beginTransaction();
    DB::connection('pgsql')->table('medicine_batches')
        ->where('id', $batch->id)->lockForUpdate()->first();

    // Connection B: must not be able to read that row for update.
    DB::connection('pgsql_test_b')->statement("SET lock_timeout = '400ms'");

    expect(fn () => DB::connection('pgsql_test_b')->transaction(function () use ($batch) {
        DB::connection('pgsql_test_b')->table('medicine_batches')
            ->where('id', $batch->id)->lockForUpdate()->first();
    }))->toThrow(QueryException::class);   // 55P03 lock_not_available

    // A commits its sale; B retried afterwards must now fail on quantity, not on the lock.
    app(SalesService::class)->complete($draftFor($batch, 1), $cashier);
    DB::connection('pgsql')->commit();

    expect(fn () => app(SalesService::class)->complete($draftFor($batch, 1), $cashier))
        ->toThrow(InsufficientStockException::class);

    expect($batch->fresh()->quantity_available)->toBe(0);
})->group('concurrency');
```

The assertion that matters is *that the second transaction was blocked by the lock* — proven
by the `lock_timeout` error code — plus the final state. That is deterministic and gives no
flaky sleeps.

4. For throughput races (test 6, eight simultaneous invoice numbers) a small shell harness
   runs N `artisan` processes in parallel against the seeded test database and a Pest test then
   asserts the resulting rows. It runs in CI on Linux only, guarded by
   `->skipOnWindows('parallel harness needs a POSIX shell')`. It is skipped locally on Windows
   and is **not** skippable in CI — a skip there fails the build.

5. **Documented manual procedure**, for the cases automation cannot reach and for verifying a
   fix by hand:

   1. Seed the shop database with one medicine and one batch of quantity 1.
   2. Open two `psql` sessions against it.
   3. Session 1: `BEGIN; SELECT * FROM medicine_batches WHERE id = :id FOR UPDATE;`
   4. Session 2: the same statement — it must block, not return.
   5. Session 1: `COMMIT;` — session 2's statement now returns with the post-commit values.
   6. Repeat through the application with two browsers on two terminals, both on the last unit
      of one medicine, pressing save within the same second. Expect one invoice and one clear
      "Only 0 left" message.

   This drill is part of the Phase 4 exit checklist, run against the real shop server, and its
   result is recorded in `logs/build-log.md`.

## 4. Factories, seeders, demo data

Factories, all in `database/factories`, all producing valid domain state:

| Factory | Notable states |
|---|---|
| `UserFactory` | `admin()`, `pharmacist()`, `cashier()` (each with the role's seeded permissions), `inactive()` |
| `CategoryFactory`, `ManufacturerFactory`, `UnitFactory` | plain |
| `MedicineFactory` | `prescriptionRequired()`, `withBarcode()`, `gst(5\|12\|18)`, `lowStockThreshold(n)` |
| `MedicineBatchFactory` | `expiringInDays(n)`, `expired()`, `quarantined()`, `finished()`, `withQuantity(n)`, `freeGoods()` |
| `SupplierFactory`, `CustomerFactory` | `withOutstanding(amount)`, `creditLimit(amount)`, `atCreditLimit()` |
| `PurchaseFactory` + `PurchaseItemFactory` | `draft()`, `confirmed()` (confirmed goes through `PurchaseService`, never by direct insert) |
| `SaleFactory` + `SaleItemFactory` | `completed()`, `partiallyReturned()`, `credit()` — again via `SalesService` |
| `StockTransactionFactory` | Used only in integrity tests that need a deliberately broken ledger |

> **Cave law:** no factory and no seeder writes `quantity_available` or inserts a
> `stock_transactions` row directly, except the two fixtures explicitly built to simulate
> corruption for `stock:verify` tests. Stock in test data is created the same way stock is
> created in the shop — through `InventoryService::apply()`. A factory that cheats hides the
> bug the test exists to find.

Seeders:

| Seeder | Purpose |
|---|---|
| `RoleAndPermissionSeeder` | The permission keys from `brain/05-routes-and-modules.md` and the default role grid. Runs in every environment, including production |
| `ShopSettingsSeeder` | Shop identity placeholders, GSTIN, drug licence fields. Production values are entered by the owner, not seeded |
| `DemoDataSeeder` | The dataset below. Never runs in production; guarded by an environment check that aborts |

**Demo dataset shape** — sized to be realistic enough to catch performance and reporting bugs:

- 12 categories, 40 manufacturers, 8 units.
- **5,000 medicines** — the number the search budget in `brain/06-ui-conventions.md` is stated
  against — of which about 15% are `is_prescription_required` and 60% carry a barcode. GST
  rates distributed across 0/5/12/18.
- 25 suppliers, 400 customers (60 with a credit limit, 10 deliberately at or over it).
- ~20,000 batches: roughly 3 per stocked medicine, with a deliberate spread — 5% already
  expired, 8% expiring inside 30 days, 15% inside 90 days, some finished, a few quarantined.
- 90 days of history: ~120 purchases and ~4,500 sales spread across three users with a
  realistic daily curve and an 11 a.m. peak, ~4% of sales carrying a return, a mix of cash,
  card, UPI, split, and credit payments.
- Every rupee figure in the demo set is generated through the same money and GST services the
  application uses, so demo totals are arithmetically consistent and can be reconciled by hand.

`php artisan migrate:fresh --seed --seeder=DemoDataSeeder` must complete in under two minutes,
because a dataset nobody waits for is a dataset nobody uses.

## 5. `stock:verify` as test and as guard

`php artisan stock:verify` compares `medicine_batches.quantity_available` against
`SUM(stock_transactions.quantity_change)` for every batch, and additionally checks each row's
`balance_after` against the running total. Exit code 0 = clean, 1 = drift found. Output lists
the batch, both numbers, and the delta.

It is used in three places:

| Context | Invocation | On failure |
|---|---|---|
| Test suite | Called at the end of every service test that moves stock, via a Pest `afterEach` on the `Feature/Services` and `Feature/Integrity` suites | The test fails, naming the batch |
| CI | Runs **after** the full suite, against the seeded database, as a separate pipeline step | The build fails. A green suite with a drifted ledger is not green |
| Production | Nightly at 01:00 `Asia/Kolkata` via the scheduler | Writes to the log, raises the dashboard alert, and emails the owner. See `brain/09-deployment.md` |

Running it after the suite — not before — is the point: the suite has just performed thousands
of stock movements through the real services, so a clean verify afterwards is a statement about
the code, not about the seed.

`--fix` does not exist and must not be added. Drift is a bug to be diagnosed from the ledger,
not a number to be overwritten.

## 6. Coverage expectations

| Layer | Line coverage | Notes |
|---|---|---|
| `app/Services` | **≥ 90%**, and 100% of branches that throw a domain exception | The domain lives here; a gap here is an untested rupee |
| `app/Enums`, `app/Data`, `app/Rules` | ≥ 95% | Small and pure; there is no excuse |
| `app/Queries`, `app/Repositories` | ≥ 80% | Report queries are asserted on results, not on SQL strings |
| `app/Http/Controllers` | Smoke only, ~60% | One happy path and one authorization denial per route. Depth here means logic leaked out of a service |
| `app/Http/Requests`, `app/Policies` | ≥ 90% | Cheap to test, and they are the authorization boundary |
| `resources/views` | **Not measured** | Views are exercised indirectly by HTTP smoke tests. Chasing view coverage produces tests that assert markup and break on every restyle |

The gate is the service-layer number; the global figure is reported but is not the pass/fail
line. Coverage measures what was executed, not what was verified — the ten tests in section 2
matter more than any percentage, and no coverage target may be met by adding assertions-free
tests.

## 7. CI pipeline

Runs on every push and every pull request. Steps in order; the first failure stops the run.

| # | Step | Command | Fails the build when |
|---|---|---|---|
| 1 | Checkout, PHP 8.3, Node 20, Postgres 16 service container | — | Environment cannot be built |
| 2 | Cache and install dependencies | `composer install --no-interaction --prefer-dist`, `npm ci` | Lockfile out of sync |
| 3 | Prepare environment | `cp .env.testing .env`, `php artisan key:generate` | — |
| 4 | Format check | `vendor/bin/pint --test` | Any file would be reformatted |
| 5 | Static analysis | `vendor/bin/phpstan analyse --memory-limit=1G` | Below level 6, or a new baseline entry for our own code |
| 6 | Migrations, forwards | `php artisan migrate --force` | Any migration errors |
| 7 | Migrations, backwards and forwards again | `php artisan migrate:refresh --force` | A migration is not reversible |
| 8 | Seed reference data | `php artisan db:seed --class=RoleAndPermissionSeeder` | — |
| 9 | Route/permission consistency | `php artisan permissions:check` | A `can:` string has no seeded permission, or a seeded permission is unused |
| 10 | Asset build | `npm run build` | Vite build error |
| 11 | Test suite with coverage | `php artisan test --parallel --coverage --min=80` (excluding the `concurrency` group) | Any failing test, or service-layer coverage below target |
| 12 | Concurrency group, serial | `php artisan test --group=concurrency` | Any race test fails or is skipped |
| 13 | Seed demo data | `php artisan db:seed --class=DemoDataSeeder` | Seeder error or over the two-minute budget |
| 14 | **Ledger verification** | `php artisan stock:verify` | Any batch drifts |
| 15 | POS search budget | `php artisan test --group=performance` | 95th-percentile search over the 5,000-medicine demo set exceeds 150ms |

Steps 11 and 12 are separate because the concurrency group must not run in parallel with
itself — parallel workers sharing a database would produce races the tests did not intend.

Nightly, on the `main` branch, the same pipeline runs with a random seed for test 5 and with
the full demo dataset, and reports separately. A nightly-only failure is still a real failure
and gets an issue the same morning.
