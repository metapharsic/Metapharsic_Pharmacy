# ADR-0005: Sales Are Immutable

**Status:** Accepted · **Date:** 2026-08-24 · **Deciders:** orchestrator, pharmacy-domain

## Context
A cashier will mis-key a bill. The obvious fix is an Edit button. But a `sales` row is
simultaneously (a) a GST tax invoice in a legally numbered series, (b) the source of a
`stock_transactions` entry that already moved physical stock, and (c) the row a profit
report reads. Editing it silently rewrites all three.

## Decision
`sales`, `sale_items`, `payments` and `stock_transactions` are append-only. No UPDATE of
quantity, price, or total after commit. No DELETE, ever — not even soft delete.

Corrections happen exactly two ways:
1. **Cancel** (whole bill, same day, before day-close) — writes a `sale_return` covering
   every line, reversing stock transactions, and a negative `payments` row. Sale status
   becomes `cancelled`. The invoice number is consumed and never reused.
2. **Return** (partial or later) — a `returns` row referencing the original `sale_items`.

Both require an `audit_logs` entry with the acting user and reason.

> **Cave law:** Sales are stone. Correct forward, never backward.

## Consequences
**Positive:** stock ledger and invoice series stay reconcilable; profit history is stable;
an inspector's spot-check always ties out; `stock:verify` becomes meaningful.
**Negative:** more rows for a simple typo; staff must be trained that "cancel and re-bill"
is the workflow; a same-day cancel still burns an invoice number (acceptable — a gap in a
series is explainable, a rewritten invoice is not).

## Alternatives rejected
- **Soft-delete and re-issue** — leaves two invoices for one transaction with no linkage;
  stock reversal still needed, so it saves nothing and loses the audit trail.
- **In-place edit with audit log** — the log records the change, but every downstream
  aggregate (stock, GST return, profit) silently shifts. The log tells you it happened; it
  does not make the numbers right.
- **Edit allowed within N minutes** — an arbitrary window that still permits a rewrite
  after the stock left the shelf.
