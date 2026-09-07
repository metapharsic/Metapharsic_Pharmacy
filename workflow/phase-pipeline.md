# Phase Pipeline

Purpose: define the six build phases as gates — what each phase produces, what must be demonstrably true before the next one opens, and what is forbidden from starting early.

---

## 1. How the pipeline works

Phases are sequential and gated. Each phase ends in something that works end to end; no phase
ends in scaffolding waiting for a later phase to make it real.

> **Cave law:** a phase does not open until the previous phase's exit gate is signed off. The
> signoff is recorded in `logs/build-log.md` as a phase-gate entry, and mirrored into
> `brain/state/CURRENT_PHASE.md`. An unsigned gate means the next phase's tasks stay `blocked`
> in `brain/state/BACKLOG.md`, whatever anyone's calendar says.

**Signoff format** (see `logs/README.md` for the full log grammar):

```
### PHASE GATE — Phase N (Name) — SIGNED 2026-MM-DD
- Gate conditions: all met / listed exceptions with waiver reference
- Evidence: test run, stock:verify output, acceptance session
- Signed by: orchestrator, on the recommendation of qa-tester
- Opens: Phase N+1 (Name)
```

Who signs: the **orchestrator** signs, and may only sign when **qa-tester** has confirmed the
acceptance evidence and **security-auditor** has confirmed no permission or cost-exposure
regression. A gate is never signed by the agent whose work the gate measures.

**Waivers.** A gate condition may be waived exactly once, only by the user (the shop owner),
only in writing, and only when it is recorded as a new backlog task in the next phase plus a
line in `logs/build-log.md`. A waived condition is deferred work, not a passed condition.

**Rollback.** If a phase's gate is signed and a defect later proves a gate condition was false,
the phase is reopened: the orchestrator writes a reopening entry in `logs/build-log.md`, moves
the offending tasks back to `todo`, and freezes new work in the later phase until the condition
is genuinely met.

---

## 2. Phase 1 — Foundation ("Make fire")

**Goal.** A running Laravel 12 application on PostgreSQL 16 with real authentication, real
roles and permissions, and a layout shell — built to the money, quantity, timezone, and
migration conventions that every later table will inherit.

| Field | Value |
|---|---|
| **Agents active** | devops (lead), db-architect, backend-engineer, security-auditor, frontend-engineer, qa-tester |
| **Backlog** | T-0101 … T-0112 |

**Deliverables**

| # | Deliverable |
|---|---|
| D1.1 | Laravel 12 on PHP 8.3, PostgreSQL 16 connection, `.env.example` complete, no SQLite anywhere |
| D1.2 | `config/app.php` timezone `Asia/Kolkata`, locale and INR formatting settled |
| D1.3 | Migration conventions baseline: `bigint id`, `timestampTz`, `numeric(12,2)` money, actor columns, index rules from `brain/02-database-schema.md` §1 |
| D1.4 | `users`, `roles`, `permissions`, `role_user`, `permission_role`, `login_logs` migrations and models |
| D1.5 | Auth scaffolding (Blade stack), session and password configuration |
| D1.6 | Gates, policies, and the role/permission seeder; `permissions:check` command |
| D1.7 | User CRUD, admin-only, policy-enforced |
| D1.8 | Login and failed-login logging |
| D1.9 | Base layout: sidebar shell, permission-filtered navigation, empty dashboard |
| D1.10 | Pint, PHPStan/Larastan level 6, Pest 3 harness on real PostgreSQL |
| D1.11 | CI skeleton running steps 1–11 of `brain/07-testing-strategy.md` §7 |

**Exit gate — every condition checkable**

| # | Condition | How it is checked |
|---|---|---|
| G1.1 | An admin logs in and creates a cashier user | Acceptance run, recorded in the session note |
| G1.2 | The cashier logs in, reaches an empty dashboard, and receives HTTP 403 on the user-management route | Feature test `Feature/Http/Identity/CashierCannotManageUsersTest.php`, green |
| G1.3 | `vendor/bin/pint --test` exits 0 | CI step 4 |
| G1.4 | `vendor/bin/phpstan analyse` exits 0 at level 6 or higher, with no baseline entry for our own code | CI step 5 |
| G1.5 | `php artisan migrate:refresh --force` succeeds — every migration is reversible | CI step 7 |
| G1.6 | `php artisan permissions:check` exits 0 — no orphan `can:` string, no unused seeded permission | CI step 9 |
| G1.7 | `config('app.timezone') === 'Asia/Kolkata'` asserted by a test, and one `timestamptz` column round-trips correctly across the boundary | Unit + feature test |
| G1.8 | Pest suite green on PostgreSQL 16, not SQLite | CI step 11 |
| G1.9 | Q-001 (fractional units) is resolved and recorded, because it fixes the quantity column type for every later migration | `brain/state/OPEN_QUESTIONS.md` status `resolved`, ADR written if the answer is "yes, fractional" |
| G1.10 | `brain/` reflects what was built; `CURRENT_PHASE.md` shows all Phase 1 tasks `done` | Orchestrator review |

**Forbidden to start early**

- No `medicines`, `medicine_batches`, `stock_transactions`, `sales`, or `purchases` migration.
  Schema for later phases is designed on paper in `brain/02-database-schema.md`, not created.
- No POS route, controller, or Blade view, not even a placeholder.
- No `InventoryService`, `SalesService`, or any service that would need a table that does not exist.
- No seeded demo medicines. Reference data in Phase 1 means roles and permissions only.

---

## 3. Phase 2 — Master Data ("Name the things")

**Goal.** The shop's real catalogue and parties exist in the system and are searchable fast
enough to bill from.

| Field | Value |
|---|---|
| **Agents active** | backend-engineer (lead), db-architect, pharmacy-domain, frontend-engineer, qa-tester |
| **Backlog** | T-0201 … T-0208 |

**Deliverables**

| # | Deliverable |
|---|---|
| D2.1 | `categories`, `manufacturers`, `units` tables and CRUD |
| D2.2 | `medicines` table: HSN, `gst_rate`, `pack_size`, `min_stock_level`, `is_prescription_required`, barcode, `is_active`, soft delete |
| D2.3 | Medicine search: trigram/prefix index, name and generic name, barcode exact match |
| D2.4 | `suppliers` and `customers` including `state_code`, `credit_limit`, `outstanding_balance` |
| D2.5 | CSV medicine import: dry-run, row-level error report, idempotent re-run |
| D2.6 | Master-data UI screens under the Phase 1 layout |

**Exit gate**

| # | Condition | How it is checked |
|---|---|---|
| G2.1 | The shop's real medicine list imports with zero silent row loss: `rows_in_file = imported + rejected`, and every rejection has a reason | Import report artefact attached to the session note |
| G2.2 | Re-running the same import changes nothing (idempotent) | Feature test |
| G2.3 | Medicine search 95th percentile under 150 ms over the real catalogue | `php artisan test --group=performance`, CI step 15 |
| G2.4 | `medicines` has no `quantity`, no `expiry_date`, no batch column — verified against the live schema, not the migration file | Integrity test asserting absent columns. Cave law 3 |
| G2.5 | `gst_rate IN (0,5,12,18)` and `pack_size > 0` enforced by CHECK constraints in the database | Schema assertion test |
| G2.6 | Q-005 (source data format) resolved; Q-007 (opening credit balances) resolved or explicitly deferred with an owner | `brain/state/OPEN_QUESTIONS.md` |
| G2.7 | Pint, PHPStan, full suite green; `brain/02-database-schema.md` matches reality | CI + orchestrator review |

**Forbidden to start early**

- No quantity, no price, no expiry on `medicines` — ever, in any phase.
- No batch table, no ledger, no purchase entry.
- No POS. A medicine search box built "for the POS" is a Phase 4 deliverable and is not built here.

---

## 4. Phase 3 — Inventory and Purchasing ("Fill the shelf")

**Goal.** Stock exists, moves through exactly one door, and can be proven correct.

| Field | Value |
|---|---|
| **Agents active** | backend-engineer (lead), db-architect, pharmacy-domain, qa-tester, frontend-engineer |
| **Backlog** | T-0301 … T-0308 |

**Deliverables**

| # | Deliverable |
|---|---|
| D3.1 | `medicine_batches` with unique `(medicine_id, batch_no, expiry_date)`, CHECK constraints, batch status enum |
| D3.2 | `stock_transactions` append-only ledger with `balance_after`, polymorphic reference, actor |
| D3.3 | `InventoryService::apply()` — the only writer of the ledger and the only mutator of `quantity_available` |
| D3.4 | Purchase entry: draft, confirm, cancel-with-reversal; supplier outstanding maintained |
| D3.5 | Batch auto-create on confirm, `effective_cost` including free goods |
| D3.6 | Opening stock entry and admin-only stock adjustment with mandatory reason codes |
| D3.7 | `php artisan stock:verify` and its CI wiring |
| D3.8 | Batch-wise inventory, low-stock, and expiry-window screens |

**Exit gate**

| # | Condition | How it is checked |
|---|---|---|
| G3.1 | A real supplier bill is entered and the resulting batch quantities, `effective_cost`, and supplier outstanding are correct to the paisa | Acceptance run against a real invoice, recorded |
| G3.2 | Cancelling that confirmed purchase writes reversing `stock_transactions` rows — never a delete, never an update — and quantities return exactly to their prior values | Feature test + ledger inspection |
| G3.3 | `php artisan stock:verify` exits 0 after the randomised 200-operation integrity sequence | `Feature/Integrity/LedgerBalanceTest.php`, CI step 14 |
| G3.4 | Grep proves no write to `quantity_available` outside `InventoryService` | Static check in CI plus reviewer confirmation. Cave law 1 |
| G3.5 | Free goods raise quantity and lower per-unit cost: a 10+1 line yields `effective_cost = net line cost / 11` | Unit test. Cave law 5 |
| G3.6 | Stock adjustment is refused for pharmacist and cashier at the policy layer | Feature test, both roles |
| G3.7 | Q-001 confirmed in the schema as built (quantity type matches the resolution) | Schema assertion |
| G3.8 | Pint, PHPStan, full suite, `stock:verify` all green in one CI run | CI |

**Forbidden to start early**

- No sale, no `sale_items`, no invoice counter, no POS screen. FEFO **allocation** belongs to
  Phase 4; Phase 3 may only order batches for display.
- No profit report — there is no `cost_price_at_sale` to compute it from yet.
- No direct `UPDATE medicine_batches SET quantity_available = …` anywhere, in any phase, forever.

---

## 5. Phase 4 — POS and Sales ("Trade") — the big one

**Goal.** A cashier can bill a real customer, correctly, fast, under contention, with a legally
numbered GST invoice.

| Field | Value |
|---|---|
| **Agents active** | pos-specialist (lead), backend-engineer, pharmacy-domain, frontend-engineer, security-auditor, qa-tester |
| **Backlog** | T-0401 … T-0408 |

**Deliverables**

| # | Deliverable |
|---|---|
| D4.1 | Keyboard-driven POS screen honouring the key contract in `brain/06-ui-conventions.md` |
| D4.2 | FEFO allocation inside a transaction with `SELECT … FOR UPDATE`, multi-batch line splitting |
| D4.3 | Line and invoice tax engine: discount distribution, CGST/SGST (and IGST if Q-002 says so), `round_off` in ±0.50 |
| D4.4 | Schedule H block with pharmacist/admin override, override written to `audit_logs` |
| D4.5 | Payments: cash, card, UPI, split, credit; credit-limit enforcement with admin override |
| D4.6 | `invoice_counters` locked read-and-increment, format `PHARM/26-27/00042` |
| D4.7 | A4 and 80mm invoice layouts; hold and recall bill |
| D4.8 | Sales returns against the original `sale_item`, refunds and credit notes, quarantine on expired returns |

**Exit gate**

| # | Condition | How it is checked |
|---|---|---|
| G4.1 | One full real trading day is run in parallel with the old method and every closing total matches: cash, card, UPI, credit, and bill count | Parallel-run acceptance day, recorded in a session note. Success criterion S1 |
| G4.2 | Two connections racing for the last unit: exactly one commits, `quantity_available` ends at 0 and never −1 | `Concurrency/LastUnitRaceTest.php`. Cave law 4 |
| G4.3 | 1,000 concurrent sales produce 1,000 distinct, contiguous, correctly formatted invoice numbers with zero unique-index violations surfaced | `Concurrency/InvoiceNumberRaceTest.php`. ADR-0006, criterion S5 |
| G4.4 | `subtotal − discount + gst_amount + round_off = total` and `SUM(sale_items.line_total) + round_off = total` for 100 percent of the day's bills, to the paisa | `Feature/Services/Tax/GstCalculationTest.php` plus a query over the acceptance day |
| G4.5 | Every cashier-reachable endpoint returns a body containing none of `purchase_price`, `effective_cost`, `cost_price_at_sale` — asserted on the raw response, iterating the route list | `Feature/Http/Pos/CashierCostExposureTest.php`. Cave law 2 |
| G4.6 | No route, service, or console path can update or delete a `sales` or `sale_items` row | Reviewer grep plus a feature test asserting the absence of such a route. Cave law 8, ADR-0005 |
| G4.7 | A return restores stock to the exact original `medicine_batch_id`; an expired return goes to `quarantined` | `Feature/Services/Returns/ReturnSameBatchTest.php` |
| G4.8 | Profit is unchanged after a batch price change — snapshot cost holds | `Feature/Reports/ProfitSnapshotTest.php`. Cave law 6 |
| G4.9 | Five-line cash bill completed keyboard-only in under 45 seconds; POS save under 500 ms at p95 with 5 concurrent users | Timed acceptance plus performance group. Criterion S4 |
| G4.10 | `stock:verify` clean after the parallel-run day | Nightly command output |
| G4.11 | Q-002 (IGST), Q-003 (licence and GSTIN on the invoice footer), Q-008 (e-invoicing thresholds) resolved or explicitly deferred with a written owner | `brain/state/OPEN_QUESTIONS.md` |

**Forbidden to start early**

- No profit or GST *report* screens — Phase 5. The tax engine is built here; the reporting over
  it is not.
- No dashboard aggregates or summary tables.
- No barcode scanner integration, no thermal-printer driver tuning — the 80mm layout is CSS
  here; hardware behaviour is Phase 6.
- No "edit sale" affordance, in this phase or ever.

---

## 6. Phase 5 — Reporting and Audit ("Read the bones")

**Goal.** The month can be closed, and an inspection can be answered, from the software alone.

| Field | Value |
|---|---|
| **Agents active** | backend-engineer (lead), pharmacy-domain, db-architect, frontend-engineer, security-auditor, qa-tester |
| **Backlog** | T-0501 … T-0508 |

**Deliverables**

| # | Deliverable |
|---|---|
| D5.1 | `daily_sales_summary` and `summary:rebuild`, idempotent by `summary_date` |
| D5.2 | Dashboard: today's numbers plus the four alert boxes, expiry first |
| D5.3 | Sales and purchase reports with date range, CSV and PDF export |
| D5.4 | Profit report, admin only, computed from `cost_price_at_sale` |
| D5.5 | GST report: rate-slab split and HSN summary, output and input tax |
| D5.6 | Stock valuation at cost and MRP, expiry windows, fast/slow mover |
| D5.7 | Customer and supplier ledgers with 0–30 / 31–60 / 61–90 / 90+ aging |
| D5.8 | Audit log viewer with old/new JSONB diff |

**Exit gate**

| # | Condition | How it is checked |
|---|---|---|
| G5.1 | One full month's GST report matches the manually prepared GSTR-1 figures to the rupee, per slab and per HSN | Side-by-side reconciliation, recorded. Criterion S6 |
| G5.2 | The month is closed without opening a spreadsheet | Acceptance session with the owner. Criterion S7 |
| G5.3 | The profit report is refused to pharmacist and cashier at the policy layer, and its query selects no cost column for any non-admin session | Feature test for both roles. Cave law 2 |
| G5.4 | `summary:rebuild` run twice produces identical rows | Idempotency test |
| G5.5 | Dashboard renders under 1 second with the full dataset — cached or summary-backed, never a live scan of `sale_items` | Performance group. Cave law 8 |
| G5.6 | Any sale, discount override, price change, stock adjustment, or permission change is traceable to who/when/from-what/to-what in under 5 minutes | Timed audit drill. Criterion S8 |
| G5.7 | Every batch entering the 90-day window appears on the dashboard that morning, and again at 30 days | Feature test over a seeded expiry calendar. Criterion S3 |

**Forbidden to start early**

- No deployment hardening, backup automation, or printer tuning — Phase 6.
- No new write paths. Phase 5 is read-only over Phases 3 and 4, with the single exception of
  `daily_sales_summary`, written only by `summary:rebuild`.
- No schema change to a transactional table to make a report easier. If a report is slow, add
  an index or a summary row; do not denormalise the ledger.

---

## 7. Phase 6 — Hardening and Deployment ("Make strong")

**Goal.** The shop runs on it, and the owner sleeps.

| Field | Value |
|---|---|
| **Agents active** | devops (lead), security-auditor, pos-specialist, frontend-engineer, orchestrator, qa-tester |
| **Backlog** | T-0601 … T-0607 |

**Deliverables**

| # | Deliverable |
|---|---|
| D6.1 | Barcode scanning end to end (scanner as keyboard, no driver) |
| D6.2 | Thermal 80mm printer tuning against the real device |
| D6.3 | Nightly `pg_dump`, 30-day retention, off-machine copy, and a performed restore drill |
| D6.4 | Deployment: nginx, php-fpm, supervisor, scheduler cron, UPS check |
| D6.5 | Role and permission fine-tuning after real use, re-audited |
| D6.6 | Written paper-fallback procedure and staff training |
| D6.7 | Monitoring, alerting, and the performance pass |

**Exit gate**

| # | Condition | How it is checked |
|---|---|---|
| G6.1 | A restore from a nightly dump into a scratch database matches source row counts and the day's sales totals | Restore drill, dated, recorded. Criterion S9 |
| G6.2 | `stock:verify` reports zero mismatching batches on 30 consecutive nightly runs | Nightly log review. Criterion S2 |
| G6.3 | A scanned barcode adds the correct medicine to the cart with no mouse and no driver install | Acceptance run on the shop's scanner |
| G6.4 | An 80mm receipt prints correctly on the shop's actual printer, full width, no clipped totals | Printed sample retained |
| G6.5 | Reboot of the server brings the application, queue worker, and scheduler back with no manual step | Reboot drill |
| G6.6 | The paper-fallback procedure is written, printed, and rehearsed once with counter staff | Training note in a session log |
| G6.7 | A permission re-audit shows no role holding a permission it does not use, and cashier cost exposure remains zero | security-auditor report |
| G6.8 | Q-004 (printer model) and Q-006 (terminal count) resolved before D6.2 and D6.4 respectively | `brain/state/OPEN_QUESTIONS.md` |

**Forbidden to start early**

- Nothing follows Phase 6 in v1. Requests beyond it (multi-store, e-commerce, loyalty,
  interaction checking) are recorded as phase 7+ backlog items with a business case and are
  not designed into v1 schema "just in case".

---

## 8. Gate summary

| Phase | Name | Opens when | Closes when, in one line |
|---|---|---|---|
| 1 | Foundation | Project start, 2026-08-24 | Cashier logs in, sees an empty dashboard, and is refused the user page — with CI green |
| 2 | Master Data | Phase 1 gate signed | The real medicine list is imported and searchable under 150 ms |
| 3 | Inventory and Purchasing | Phase 2 gate signed | A real supplier bill is entered, cancelled, and the ledger reconciles exactly |
| 4 | POS and Sales | Phase 3 gate signed | A full parallel trading day matches at closing, under concurrency, with unique invoice numbers |
| 5 | Reporting and Audit | Phase 4 gate signed | The month closes from the software alone and GST matches to the rupee |
| 6 | Hardening and Deployment | Phase 5 gate signed | A tested restore exists, the shop runs on it, and 30 nightly `stock:verify` runs are clean |
