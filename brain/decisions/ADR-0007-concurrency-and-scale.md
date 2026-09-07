# ADR-0007: Concurrency and Scale

**Status:** Accepted · **Date:** 2026-08-24 · **Deciders:** orchestrator, db-architect

## Context
The shop confirmed 4+ concurrent POS terminals (Q-006, resolved), up from the 1-3 the design
had assumed. This stresses two serialization points that were sized for light contention: the
`invoice_counters` row lock (ADR-0006) and the FEFO batch-row locks on fast-moving medicine
(ADR-0002). Both are correct at low concurrency; at 4+ tills selling continuously, the
question is no longer "does the lock work" but "how long does a till wait behind it, and what
happens when it waits too long."

## Decision
1. **The `invoice_counters` transaction does nothing but increment and read.** The number is
   allocated last, immediately before the `sales` insert — never at cart-open, never earlier in
   the checkout flow. Nothing else runs inside that transaction: no tax computation, no FEFO
   allocation, no payment processing. The lock is held for the shortest possible span.
2. **FEFO batch locks are acquired in `medicine_batches.id ASC` order**, mandatory across every
   code path that locks more than one batch for the same medicine. Without a fixed order, two
   concurrent tills selling the same fast-moving medicine can lock batches in opposite order and
   deadlock.
3. **`lock_timeout` is set explicitly** (PostgreSQL, e.g. `3s`) so a stuck till fails fast with a
   retry-the-sale message instead of hanging silently and holding up every other till queued
   behind the same counter or batch row.
4. **The concurrent "two tills sell the last unit" test is built in Phase 3**, when the ledger
   lands — not deferred to Phase 4. A load-style manual test with 4 terminals is required before
   the Phase 4 exit gate.

> **Cave law:** the `invoice_counters` transaction allocates the number last and does nothing
> else. Any additional work inside that transaction is a bug, not a style choice — it turns a
> microsecond lock into a queue every till waits behind.

## Consequences
**Positive:** the counter and FEFO locks stay simple, in-database, and correct at the confirmed
scale — no new service, no new failure mode. Fixed lock ordering removes deadlock risk between
tills entirely, rather than detecting and retrying it. A fast, explicit timeout turns a stuck
till into a visible, recoverable error instead of an invisible slowdown for everyone else.
**Negative:** every checkout path must be disciplined about what runs inside the counter
transaction — a future developer adding "just one more thing" before the number is allocated
silently reintroduces the exact contention this ADR removes. The Phase 3 concurrency test and
the Phase 4 four-terminal load test are now hard gate requirements, adding test-writing and
manual-test time that a lower-concurrency design would not have needed this early.

## Alternatives rejected
- **Per-terminal pre-allocated invoice number blocks** (e.g. till A gets 1-1000, till B gets
  1001-2000) — rejected. It breaks strict sequential numbering, which GST requires within a
  series; two tills issuing invoices from disjoint blocks produces a series with the numbers
  out of chronological order, which invites exactly the filing question ADR-0006 exists to
  avoid.
- **Optimistic locking with retry** on the counter and batch rows — rejected. Under real
  contention (4+ tills hitting the same fast-moving medicine at the same minute), optimistic
  retry produces a retry storm that is worse than a short pessimistic wait: every failed
  attempt has already done the read-side work and must redo it, and the retries themselves
  compete for the same row.
- **Redis-based counters** — rejected per CONFLICT-001. It adds a service to operate for a
  problem row-locking already solves cleanly at this scale; the shop server runs one fewer
  moving part without it.
