# CLAUDE.md — Metapharsic Pharmacy

Read this file first, every session, before touching code.

## What this is

A pharmacy retail management system: POS, batch/expiry-aware inventory, purchasing,
GST-compliant billing, and reporting.

**Stack:** PHP 8.3 · Laravel 12 · PostgreSQL 16 · Blade + Alpine.js + Tailwind · Vite
**Locale:** India — INR, GST, `Asia/Kolkata` timezone
**Repo root:** `C:\Metapharsic_pharmacy`

## Where knowledge lives

| Path | Holds | Who writes it |
|---|---|---|
| `brain/` | Durable truth: architecture, schema, domain rules, standards | Whoever changes the thing |
| `brain/decisions/` | ADRs — one file per irreversible choice, never edited after Accepted | Orchestrator + author |
| `brain/state/` | Current phase, backlog, open questions — the only files that churn | Orchestrator |
| `agents/` | Agent roster, each agent's charter and boundaries | Orchestrator |
| `workflow/` | How work moves: pipeline, handoff, definition of done | Orchestrator |
| `logs/` | Append-only history: build log, decisions log, session notes, changelog | Every agent |
| `CAVEMAN_DESIGN.md` | The original module + phase design | Frozen reference |

**Rule:** if a fact is derivable from code, it does not go in `brain/`. `brain/` holds
*why* and *must*, not *what the code currently says*.

## The eight cave laws (non-negotiable)

1. **One door for stock.** Quantity changes only through a `stock_transactions` row. No
   controller, job, or seeder writes `quantity_available` directly.
2. **Cashier never sees cost.** Purchase price is excluded at the query layer, not just
   hidden in the view.
3. **Medicine holds no quantity, no expiry, no price.** Those live on `medicine_batches`.
4. **FEFO with a row lock.** Allocation orders by `expiry_date ASC` inside a transaction
   using `SELECT … FOR UPDATE`.
5. **Free goods count as quantity, not as cost.** Store `effective_cost` on the batch.
6. **Snapshot cost onto `sale_items`.** History must not move when batch prices change.
7. **`batch.quantity_available` == `SUM(stock_transactions.quantity_change)`.** Enforced by
   `php artisan stock:verify`, run nightly and in CI.
8. **Sales are stone.** No edit, no delete. Corrections are returns or cancellations that
   write reversing transactions.

Money is `decimal(12,2)`. Never float. Ever.

## How to work here

1. Read `brain/state/CURRENT_PHASE.md` — it says what is in scope right now.
2. Read the `brain/` files your task touches, plus any ADR they reference.
3. Do the work. Follow `brain/04-coding-standards.md`.
4. Meet `workflow/definition-of-done.md` before claiming done.
5. Append to `logs/build-log.md`. If you made a real decision, add an ADR and a line in
   `logs/decisions.log.md`.
6. If a `brain/` doc is now wrong because of your change, fix it in the same commit.
   A stale brain is worse than no brain.

## Style

Docs are written in precise technical English. `> **Cave law:**` callouts mark rules that
must not be broken. That is the only place the caveman voice belongs — it makes the
non-negotiables findable, not decorative.
