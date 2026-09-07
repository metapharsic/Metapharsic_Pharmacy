# ADR-0003 — One door for stock: `stock_transactions` via `InventoryService`

Purpose: record why every quantity change in the system flows through a single append-only ledger written by a single service, and why the reconciliation command has no `--fix`.

**Status:** Accepted
**Date:** 2026-08-24
**Deciders:** orchestrator, backend-engineer
**Supersedes:** none
**Related:** `brain/01-architecture.md` §3, `brain/03-domain-rules.md`, ADR-0002, ADR-0005, cave laws 1 and 7

## Context

Stock quantity is the number the shop trusts. If it drifts, the low-stock report orders things
that are on the shelf, the expiry report misses things that are not, the valuation is wrong, and
the owner stops believing the software — which is the real failure, because the system is then
maintained in parallel with a paper register.

Quantity will be changed by at least nine different operations: purchase confirm, purchase
cancel, sale, sale return, purchase return, stock adjustment up, stock adjustment down, expiry
write-off, and opening stock. Each of those is a different screen, written at a different time,
by a different agent. Without a structural constraint, each one will eventually contain its own
`UPDATE medicine_batches SET quantity_available = …`, and the ninth one will get it wrong in a
way nobody notices for a month.

Two further requirements shape the answer. The system must be able to explain *why* a batch
holds the quantity it holds — an auditor's question, and a debugging question. And it must be
able to prove, mechanically and repeatedly, that the number it shows is the number its own
history implies.

## Decision

**Every change to `medicine_batches.quantity_available` is made by `InventoryService::apply()`,
and every such change writes exactly one `stock_transactions` row in the same transaction.**

```php
InventoryService::apply(
    MedicineBatch $batch,          // locked FOR UPDATE by the caller
    int $delta,                    // signed: +for in, -for out
    StockTransactionType $type,    // purchase, sale, sale_return, adjustment_add, …
    Model $reference,              // the purchase_item, sale_item, return_item, adjustment
    User $actor,
    ?string $note,
): StockTransaction
```

`stock_transactions` is **append-only**: never updated, never deleted. Each row carries
`medicine_id`, `medicine_batch_id`, `type`, `quantity_change` (signed), `balance_after`,
`reference_type` + `reference_id`, `user_id`, `note`, and `created_at`. `balance_after` is
computed from the locked row, making each row a self-contained statement about the batch at that
instant.

`medicine_batches.quantity_available` remains as a **materialised balance**, not as an
independent fact: it is a cache of the ledger sum, maintained inside the same transaction that
appends the row, and it exists so that the sellable-batch query and every stock display are a
simple indexed read rather than an aggregate.

> **Cave law:** `batch.quantity_available` must always equal
> `SUM(stock_transactions.quantity_change)` for that batch. `php artisan stock:verify` checks
> every batch, and it is run nightly and in CI.

A correction is never an edit. A confirmed purchase that is cancelled writes reversing rows of
the opposite sign; it does not delete the original rows or subtract from them in place. Nothing
in the ledger ever moves once written (this is the inventory half of the argument in ADR-0005).

`stock:verify` has **no `--fix` flag, and one must never be added**. Drift is a defect to be
diagnosed from the ledger, not a number to be overwritten. A `--fix` flag would convert the one
mechanism that detects the bug into the mechanism that hides it.

## Consequences

### Positive

| Consequence | Why it matters here |
|---|---|
| One place to get it right, one place to review | A change to stock semantics is a change to one service, reviewed by two agents, defended by named tests |
| Every quantity is explainable | "Why does this batch hold 7?" is answered by reading its ledger rows in order, with actor, reason, and reference on each |
| Drift is detectable, mechanically and cheaply | `stock:verify` turns cave law 7 into a command that either exits 0 or names the batch. It is a CI step and a gate condition, not a good intention |
| Reversal is natural | Cancel, return, and write-off are the same operation with a different sign and type. No special-case code path |
| The fast query stays fast | Displays and the FEFO query read one indexed column instead of aggregating a ledger that grows forever |
| Audit and inspection are served by the same table | The ledger is the operational record and the regulatory record; there is no second, divergent history |

### Negative

| Consequence | What it costs, and how we live with it |
|---|---|
| The invariant is maintained by code, not by the engine | The database cannot enforce "the balance equals the sum" as a constraint without a trigger. Mitigated by: one writer, a `quantity_available >= 0` CHECK as a backstop, `stock:verify` nightly and in CI, and `LedgerBalanceTest` running a randomised 200-operation sequence |
| Every stock movement is a transaction with a lock | Slightly more expensive than a bare `UPDATE`, and the transaction must be kept short. Negligible at this scale; unavoidable at any scale that cares about correctness |
| `stock_transactions` grows without bound | Several hundred bills a day, several rows each. Indexed on `(medicine_batch_id, created_at)`; partitioning is available if the table ever becomes a problem, and it is never purged |
| Seeders, factories and imports must go through the door too | It is tempting to bulk-insert quantities in a demo seeder. Forbidden — a seeder that bypasses the ledger produces a database that fails `stock:verify` and teaches everyone to ignore the alarm |
| A caller can still forget to lock before calling `apply()` | `apply()` requires a batch the caller locked; `InventoryService::lockBatches()` is the supported way. Enforced by review checklist item 3.2 and by the concurrency tests |

## Alternatives considered

### Direct updates in each module, with database triggers writing the ledger

**The case for it.** Each module writes the quantity change it understands, and a trigger on
`medicine_batches` writes the audit row automatically. Nothing can bypass the ledger, because
the database itself writes it — a stronger guarantee than a convention about which service to
call. It is also less code.

**Why rejected.** The trigger can see *that* the number changed; it cannot see *why*. It has no
access to the actor, the reason, the reference document, or the business type of the movement —
which is most of the value of the ledger. Passing that context into a trigger means session
variables or a context table, which is fragile, invisible in the application code, and a
nightmare to test. Triggers also hide control flow from the very agents who most need to see it:
a reader of `SalesService` would have no indication that an `UPDATE` there produces a ledger row
elsewhere. And a trigger that fails, or that is dropped by a migration, fails silently. The
guarantee we want is not "the ledger gets written somehow" but "there is exactly one code path
for stock movement, and it is readable".

### Full event sourcing — the ledger is the only truth, no balance column

**The case for it.** The purest version of the same idea, and it removes the negative consequence
above entirely: with no materialised balance, there is nothing to drift, and `stock:verify`
becomes unnecessary because the sum *is* the quantity. Complete history by construction, natural
temporal queries ("what was the stock on 31 March?"), and replayability.

**Why rejected.** The FEFO allocation query is the hottest query in the system and runs inside a
lock: it must find sellable batches ordered by expiry, with a positive quantity, and lock exactly
those rows. Without a balance column that becomes an aggregate over a growing ledger, per
medicine, inside the transaction, on every line of every bill — and `FOR UPDATE` does not apply
cleanly to an aggregate, so the locking story would have to be rebuilt around it. Snapshotting
would be reintroduced to fix the performance, which is exactly the materialised balance we
started with, only now undocumented. Beyond the query, event sourcing across the *whole* system
would mean projections for medicines, customers, and suppliers, where nobody needs temporal
replay and everybody needs a simple `UPDATE`. The chosen design is event sourcing applied
precisely where it earns its cost — stock — with an explicit, verified cache and an honest name
for the risk it creates.

### No ledger: quantity as a plain column, history from the documents

**The case for it.** Simplest possible model, and arguably not lossy: purchases, sales, returns
and adjustments are all recorded as documents anyway, so the history exists across those tables
and could be reconstructed by querying them.

**Why rejected.** "Could be reconstructed" is doing enormous work in that sentence. It requires a
union across five tables with different shapes, different sign conventions, and different
notions of which rows count — written once for the stock report, again for the audit view, and
again slightly differently for the valuation, at which point three answers exist. It offers no
per-batch running balance, so there is nothing to verify against and drift becomes undetectable
by construction. Adjustments and write-offs have no natural document, so they need a table of
their own, which is a ledger with a worse name. And the moment one code path forgets to update
the column, the number is simply wrong, forever, with no mechanism that would ever notice. This
is item 7 in `CAVEMAN_DESIGN.md`'s list of things that bite later.

## Cave laws created or reinforced

| # | Law | Where it is enforced |
|---|---|---|
| 1 | One door for stock: quantity changes only through a `stock_transactions` row; no controller, job, or seeder writes `quantity_available` directly | `InventoryService::apply()`; review checklist 2.1; a CI grep over the diff |
| 7 | `batch.quantity_available` equals `SUM(stock_transactions.quantity_change)` | `php artisan stock:verify`, nightly and CI step 14; `LedgerBalanceTest`; `quantity_available >= 0` CHECK as backstop |
| 8 | Corrections are reversing transactions, never edits or deletes | `PurchaseService::cancel()`, `ReturnService`; append-only `stock_transactions` |

## Revisit conditions

- `stock_transactions` grows to a size where the nightly `stock:verify` no longer completes in
  its window, requiring partitioning or an incremental verification strategy.
- A movement type appears that genuinely cannot be expressed as a signed quantity change against
  a single batch.
- The materialised balance proves to drift for a reason that is structural rather than a bug, at
  which point the event-sourcing alternative is re-examined.
