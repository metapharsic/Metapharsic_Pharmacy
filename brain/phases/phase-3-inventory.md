# Phase 3 — Inventory

**Purpose:** Make stock exist, move through exactly one door, and be provably correct — including
under concurrent access, ahead of Phase 4 depending on that guarantee.

**Depends on:** Phase 2 exit gate signed.

**Exit gate:**

| # | Condition | How it is checked |
|---|---|---|
| G3.1 | A real supplier bill is entered and the resulting batch quantities, `effective_cost`, and supplier outstanding are correct to the paisa | Acceptance run against a real invoice, recorded |
| G3.2 | Cancelling that confirmed purchase writes reversing `stock_transactions` rows — never a delete, never an update — and quantities return exactly to their prior values | Feature test + ledger inspection |
| G3.3 | `php artisan stock:verify` exits 0 after a randomised 200-operation integrity sequence | `Feature/Integrity/LedgerBalanceTest.php` |
| G3.4 | Grep proves no write to `quantity_available` outside `InventoryService` | Static check in CI plus reviewer confirmation |
| G3.5 | Free goods raise quantity and lower per-unit cost: a 10+1 line yields `effective_cost = net line cost / 11` | Unit test |
| G3.6 | Stock adjustment is refused for pharmacist and cashier at the policy layer | Feature test, both roles |
| G3.7 | Q-001 confirmed in the schema as built (quantity type matches the resolution) | Schema assertion |
| G3.8 | The concurrent "two tills sell the last unit" race test passes with 4+ simulated terminals against the same batch: exactly one commits, `quantity_available` ends at 0 and never negative | `Concurrency/LastUnitRaceTest.php`, per ADR-0007 |
| G3.9 | Pint, PHPStan, full suite, `stock:verify` all green in one CI run | CI |

**Agents active:** backend-engineer (lead), db-architect, pharmacy-domain, qa-tester, frontend-engineer.

## Tasks

| ID | Title | Owning agent | Depends on | Acceptance check |
|---|---|---|---|---|
| T-0301 | `medicine_batches` schema: unique key, CHECK constraints, status enum | db-architect | gate Phase 2 | Migration enforces unique `(medicine_id, batch_no, expiry_date)`; `quantity_available >= 0` CHECK; status enum `available/expired/finished/quarantined` |
| T-0301a | Indexes for FEFO ordering | db-architect | T-0301 | Composite index on `(medicine_id, expiry_date)` supports the FEFO query plan without a sequential scan (verified via `EXPLAIN`) |
| T-0302 | `stock_transactions` append-only ledger with `balance_after` and polymorphic reference | db-architect | T-0301 | Table has no `updated_at`-driven update path exposed; `reference_type`/`reference_id` indexed; a trigger or model guard blocks `UPDATE`/`DELETE` |
| T-0302a | `StockTransactionType` enum covering purchase, sale, sale_return, purchase_return, adjustment_add, adjustment_remove, expiry_writeoff, opening_stock | db-architect | T-0302 | Enum values match `brain/03-domain-rules.md` §11/§12 exactly; a new type requires an escalation per `agents/README.md` §4 |
| T-0303 | `InventoryService::apply()` — the single stock door | backend-engineer | T-0302 | Every quantity mutation in the codebase routes through this method; it writes the ledger row and `balance_after` inside one `DB::transaction` |
| T-0303a | Row locking discipline in `InventoryService::apply()` | backend-engineer | T-0303 | Batch row is locked with `SELECT … FOR UPDATE` before the quantity read used for the decision; lock order documented and consistent |
| T-0304 | Purchase entry: draft, confirm, cancel with reversal; supplier outstanding | backend-engineer | T-0303 | Draft purchases touch no stock; confirm moves stock via `InventoryService`; cancel writes a mirrored reversing transaction, never a delete/update |
| T-0304a | Supplier outstanding maintained on confirm/cancel | backend-engineer | T-0304 | `suppliers.outstanding_balance` increases on confirm by `due_amount` and decreases identically on cancel |
| T-0305 | Batch auto-create on confirm, free goods, `effective_cost`, opening stock entry | pharmacy-domain | T-0304, Q-007 | Confirming a purchase line finds-or-creates the batch; `effective_cost = line_total / (quantity + free_quantity)` stored on the batch |
| T-0305a | Opening stock entry screen and ledger type | pharmacy-domain | T-0305 | Opening stock writes a `stock_transactions` row of type `opening_stock`, never a direct `UPDATE` on `quantity_available` |
| T-0306 | Stock adjustment with mandatory reason codes, admin only | backend-engineer | T-0303 | Adjustment form requires a reason from the fixed set (damaged/expired/theft/counting error/sample); policy refuses pharmacist and cashier |
| T-0306a | Adjustment writes through `InventoryService` with type `adjustment_add`/`adjustment_remove` | backend-engineer | T-0306 | No adjustment code path bypasses the service; static grep confirms |
| T-0307 | `php artisan stock:verify` and its CI wiring | qa-tester | T-0303 | Command compares `batch.quantity_available` to `SUM(stock_transactions.quantity_change)` for every batch and exits non-zero with a report on mismatch |
| T-0307a | Randomised 200-operation integrity sequence test | qa-tester | T-0307 | Fixed-seed randomised test mixes purchase/sale/adjustment/return operations, then asserts `stock:verify` exits 0 |
| T-0307b | Concurrent last-unit race test — "two tills sell the last unit" | qa-tester | T-0303, T-0303a | Built here per ADR-0007, not deferred to Phase 4: two (and then 4+, matching the resolved terminal count) genuine database connections race a `SELECT … FOR UPDATE` allocation against a single-unit batch; exactly one succeeds, `quantity_available` ends at 0, never −1, tagged `->group('concurrency')` |
| T-0307c | backend-engineer support for the race test's service-level guarantees | backend-engineer | T-0307b | `InventoryService::apply()` reviewed jointly with qa-tester against the race test's failure modes; any gap found is fixed in `InventoryService`, not worked around in the test |
| T-0308 | Batch-wise inventory, low-stock, and expiry-window screens | frontend-engineer | T-0304 | Inventory list groups by batch with expiry and quantity; low-stock view filters on `min_stock_level`; expiry view supports a 30/60/90-day window picker |

## Risks specific to this phase

This is the phase where the single-door discipline is either established or quietly broken by a
seeder, a script, or a "just this once" direct update — and every later phase inherits whatever
gets away with it here.

> **Cave law:** stock only changes through one door — `stock_transactions`, written via
> `InventoryService::apply()`. No controller, job, console command, or seeder writes
> `quantity_available` directly. G3.4 exists to catch a regression by grep, not by trust.

> **Cave law:** FEFO with a row lock. Allocation orders by `expiry_date ASC` inside a transaction
> using `SELECT … FOR UPDATE`. T-0301a and T-0303a exist because an unindexed FEFO query and an
> unlocked read both look correct on a single terminal and both fail exactly when two cashiers
> reach for the same batch at once — which is the scenario T-0307b exists to force.

> **Cave law:** free goods count as quantity, not as cost — `effective_cost` on the batch. A
> purchase line miscounted here understates true cost per tablet for the rest of the batch's
> life; there is no later correction point once sales start consuming it in Phase 4.

Per ADR-0007 (4+ concurrent terminals resolved), the "two tills sell the last unit" concurrency
test is pulled forward into this phase rather than left for Phase 4, because the guarantee it
proves — `InventoryService::apply()`'s locking is correct under real contention — is exactly what
Phase 4's FEFO allocation (T-0402) is built on top of. Discovering a locking defect during Phase
4 POS work would mean reopening this phase's gate per `workflow/phase-pipeline.md` §1 rollback
rules; proving it here avoids that.

`stock:verify` (G3.3, T-0307) is the nightly and CI safety net for cave law 7. A green
`stock:verify` after this phase's randomised sequence is not optional evidence — it is the gate
condition that everything from Phase 4 onward assumes holds without re-checking.

## Definition of done

Per `workflow/definition-of-done.md` universal checklist, plus:

- [ ] Migration checklist (§3.1) for `medicine_batches` and `stock_transactions`: reversible,
      CHECK constraints, actor columns, indexes, `brain/02-database-schema.md` updated.
- [ ] Service checklist (§3.2) for `InventoryService::apply()`: explicit transaction,
      `SELECT … FOR UPDATE` before every mutating read, screen data re-validated inside the
      transaction, ledger writes carry the correct `StockTransactionType` and a real polymorphic
      reference, `balance_after` written.
- [ ] Stock integrity: `php artisan stock:verify` runs clean after the full suite, with the
      change applied, for every task in this phase.
- [ ] Every quantity change in the diff goes through `InventoryService` — no direct write to
      `medicine_batches.quantity_available` anywhere.
- [ ] Concurrency group passes: `php artisan test --group=concurrency`, including
      `LastUnitRaceTest.php` using two genuine connections and `DatabaseTruncation`, not
      `RefreshDatabase`.
- [ ] Controller checklist (§3.3) for purchase entry and stock adjustment: policy-enforced,
      happy-path and denial tests for pharmacist and cashier on stock adjustment.
- [ ] `PHASE GATE — Phase 3 (Inventory and Purchasing)` signoff written by the orchestrator on
      qa-tester's recommendation and security-auditor's confirmation of the stock-adjustment
      policy, before any Phase 4 task leaves `blocked`.
