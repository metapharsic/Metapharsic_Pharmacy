# Review Checklist

Purpose: give the reviewer a fixed set of yes/no questions, grouped by risk, so that a review verifies the change rather than admiring it.

---

## 1. How to review here

The author has already completed `workflow/definition-of-done.md`. This document is not a
repeat of it: the DoD is self-assessment, the review is **verification**. The reviewer's job is
to answer each question below from the diff and from running things — never from the author's
summary.

| Rule | Detail |
|---|---|
| The reviewer is never the author | A second agent, named on the task file |
| Every question is answered `yes`, `no`, or `n/a` | `n/a` requires a half-line reason |
| One `no` blocks the merge | The task returns to `in-progress` with the failed questions named |
| Findings are specific | "Q4.2 no — `SalesService::complete()` line 88 reads the batch before locking it" |
| The reviewer runs the gates themselves | Pint, PHPStan, the suite, and `stock:verify` where stock is touched |
| Review the tests as hard as the code | An untested branch is an unreviewed branch |

Reviewers of a change to `InventoryService`, to any authorisation boundary, or to the sale save
path: a second reviewer is required. Those three surfaces are where a single missed `no` is
expensive beyond repair.

---

## 2. Correctness

| # | Question |
|---|---|
| 1.1 | Does the change do what the task's acceptance criteria say, and did you observe each criterion yourself? |
| 1.2 | Is the happy path correct on the shop's real shapes — multi-batch lines, free goods, credit customers, zero-rated medicines — not only on the simplest case? |
| 1.3 | Is every failure path handled with a domain exception rather than a silent `null`, `false`, or early `return`? |
| 1.4 | Are the boundary values right: zero quantity, exactly the credit limit, a batch expiring today, a 100 percent discount, a bill of ₹0.00? |
| 1.5 | Does the code stay in its layer — no domain logic in a controller, no HTTP knowledge in a service, no query in a Blade template? |
| 1.6 | Does it write only to tables its module owns (`brain/05-routes-and-modules.md` §4)? |
| 1.7 | Are enums used for every status, type, mode, and reason, rather than bare strings? |
| 1.8 | Is anything here duplicating logic that already exists in a service or action, which will now drift from it? |
| 1.9 | Is the change reversible — can it be rolled back without leaving orphan rows or unreadable history? |

## 3. Cave-law compliance

| # | Question |
|---|---|
| 2.1 | **Law 1 — one door.** Does every quantity change go through `InventoryService`, with no direct write to `quantity_available` anywhere in the diff (including seeders, factories, and commands)? |
| 2.2 | **Law 2 — cashier never sees cost.** Is cost excluded at the query layer for cashier sessions, and is every new cashier-reachable route covered by the cost-exposure test? |
| 2.3 | **Law 3 — medicine holds nothing.** Does the diff add any quantity, expiry, price, or batch column to `medicines`, or any code that treats a medicine as if it had one? |
| 2.4 | **Law 4 — FEFO with a row lock.** Is allocation ordered by `expiry_date ASC, id ASC`, inside a transaction, on rows read `FOR UPDATE`? |
| 2.5 | **Law 5 — free goods.** Do free units raise quantity and lower `effective_cost`, rather than being priced as if they were bought? |
| 2.6 | **Law 6 — snapshot cost.** Is `cost_price_at_sale` written onto the sale item, and does no profit calculation in the diff join to the batch's current price? |
| 2.7 | **Law 7 — ledger equals balance.** Does `stock:verify` run clean after the suite with this change applied, and did you run it yourself? |
| 2.8 | **Law 8 — sales are stone.** Does the diff introduce any path — route, service method, command, or admin screen — that updates or deletes a `sales` or `sale_items` row? |
| 2.9 | If the task named specific cave laws in play, can you point at the concrete mechanism satisfying each one? |

## 4. Transactions and locking

| # | Question |
|---|---|
| 3.1 | Is every multi-row mutation wrapped in an explicit `DB::transaction`? |
| 3.2 | Is every row that will be mutated locked before it is read for a decision, rather than read then locked? |
| 3.3 | Is screen-supplied state re-validated **inside** the transaction — quantity, expiry, status, credit limit, prescription flag? |
| 3.4 | Are locks taken in a consistent order across the codebase, so two concurrent operations cannot deadlock? |
| 3.5 | Is the transaction as short as it can be — no HTTP call, no print, no queue dispatch, no file write inside it? |
| 3.6 | Does anything that must happen only after a successful commit (printing, notifications, summary rebuild) actually happen after commit? |
| 3.7 | Is the ledger row's `balance_after` computed from the locked row, not from a value read before the lock? |
| 3.8 | If two cashiers ran this code path simultaneously on the same batch, can you describe exactly what happens — and is there a test that proves it? |
| 3.9 | Does any new query that reads for a decision use `lockForUpdate()` where it should, and avoid it where a plain read is correct? |

## 5. Money math

| # | Question |
|---|---|
| 4.1 | Is every money column `numeric(12,2)`, and every money value in PHP a money value object rather than a float, an int of rupees, or a string being concatenated? |
| 4.2 | Does the diff contain any `float`, `(float)`, `round()` on a rupee value, or arithmetic on a raw column value in a money path? |
| 4.3 | Is rounding applied at the named steps only — per-line tax, then once per invoice into `round_off` — and never nudged into a line to make the total look tidy? |
| 4.4 | Is `round_off` within ±0.50, and is it the only place the invoice's rounding difference lives? |
| 4.5 | Does `subtotal − discount + gst_amount + round_off = total`, and does `SUM(sale_items.line_total) + round_off = total`, in a test with real numbers? |
| 4.6 | Is the CGST/SGST split exactly half each, with the halves derived so they always re-sum to the total tax, and is IGST zero for intra-state supply (and vice versa)? |
| 4.7 | When a bill-level discount is distributed across lines, is the remainder paisa allocated rather than lost or invented? |
| 4.8 | Are percentages (GST rate, discount percent) kept as rates, not as money, and never multiplied as floats? |
| 4.9 | Does any service return a formatted currency string instead of a value — which would mean formatting has leaked out of the view? |

## 6. Security and permissions

| # | Question |
|---|---|
| 5.1 | Is every new route protected by a policy or `can:` middleware, and does `php artisan permissions:check` pass? |
| 5.2 | Is the permission key seeded, named consistently (`sale.create`, `report.profit`), and actually used? |
| 5.3 | Does the change widen any role's reach? If so, was security-auditor involved and is it recorded? |
| 5.4 | Can a cashier reach anything on this diff that the role matrix in `brain/00-project-overview.md` §2 says they must not — by URL, by API call, by export, or by a report parameter? |
| 5.5 | Is authorisation enforced server-side on every path, with the UI's hiding treated as cosmetic only? |
| 5.6 | Are the watched actions (sale create and cancel, discount override, prescription override, price change, stock adjustment, permission change, login and failed login) writing `audit_logs` rows with old and new values, actor, and IP? |
| 5.7 | Is the audit write inside the same transaction as the action it records, so a rolled-back action leaves no audit row and a committed one always has its row? |
| 5.8 | Does any user-supplied value reach a raw query, a file path, or a redirect target without validation? |
| 5.9 | Are mass-assignment guards and Form Request rules tight enough that a crafted request cannot set a price, a batch, a cost, or an actor column? |
| 5.10 | Is anything secret — a credential, a key, a real GSTIN — committed in this diff? |

## 7. Tests

| # | Question |
|---|---|
| 6.1 | Is there a test for each acceptance criterion, at the layer the testing strategy assigns it to? |
| 6.2 | Did you run the suite yourself and see it green, including the concurrency group where relevant? |
| 6.3 | Is there a test for the failure path, not only the happy path — and does it assert that **nothing was written** when the operation fails? |
| 6.4 | Does each test actually fail when the behaviour is broken? Break one line and check, for at least the most important test in the change. |
| 6.5 | Were any of the non-negotiable ten weakened, skipped, or deleted? |
| 6.6 | Do the tests run on real PostgreSQL, and do the concurrency tests use two genuine connections without a wrapping transaction? |
| 6.7 | Do tests assert on data and behaviour rather than on markup, SQL text, or log output? |
| 6.8 | Does any test defending a cave law or an ADR carry the comment naming it? |
| 6.9 | Are factories and seeders used here producing realistic shapes — multiple batches, mixed GST slabs, free goods — rather than one tidy row that hides bugs? |

## 8. Documentation

| # | Question |
|---|---|
| 7.1 | Is every `brain/` document that this change made wrong corrected in the same change? |
| 7.2 | Does anything added to `brain/` belong there — a *why* or a *must* — rather than being derivable from the code? |
| 7.3 | If an irreversible or expensive-to-reverse choice was made, is there an ADR, is it referenced from what depends on it, and is it in `logs/decisions.log.md`? |
| 7.4 | Was any Accepted ADR edited? (It must not be — it is superseded by a new one instead.) |
| 7.5 | Is `logs/build-log.md` appended, in format, with nothing rewritten? |
| 7.6 | Is `brain/state/OPEN_QUESTIONS.md` current — questions answered are resolved, questions raised are filed with what they block? |
| 7.7 | Is `logs/changelog.md` updated if the change is user-visible? |
| 7.8 | Is the handoff block complete, with all seven fields and a next-agent recommendation? |
| 7.9 | Would a new agent, reading only the task file and the brain, be able to continue this work without asking the author anything? |

## 9. Performance

| # | Question |
|---|---|
| 8.1 | Does any new query run inside a loop, or produce an N+1 — and did you check with a query count, not by eye? |
| 8.2 | Does every column this change filters, joins, or sorts on have an index that the planner will actually use? |
| 8.3 | Does any list screen page its results rather than loading the whole table? |
| 8.4 | Does a dashboard or report query added here read a summary table or a cache instead of scanning `sale_items`? *(Cave law 8)* |
| 8.5 | Is the transaction short enough that it cannot hold a batch lock across a slow operation during the 11am rush? |
| 8.6 | Does POS-path work stay inside its budget — search p95 under 150 ms, save p95 under 500 ms with five concurrent users? |
| 8.7 | Is anything eagerly loaded that is not used, or lazily loaded that is used on every row? |
| 8.8 | Will this still be acceptable at real scale — 4,000 medicines, several thousand live batches, 300 bills a day, a year of history — and how do you know? |
