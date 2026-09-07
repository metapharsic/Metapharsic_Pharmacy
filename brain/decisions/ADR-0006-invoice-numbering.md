# ADR-0006: Invoice Numbering

**Status:** Accepted · **Date:** 2026-08-24 · **Deciders:** orchestrator, db-architect

## Context
GST requires invoice numbers to be unique, sequential and unbroken within a series for a
financial year. Two cashiers billing in the same second must not collide.

## Decision
Table `invoice_counters(series, financial_year, last_number)` with a unique key on
`(series, financial_year)`. Allocation happens inside the sale transaction:

```sql
SELECT last_number FROM invoice_counters
 WHERE series = 'PHARM' AND financial_year = '26-27'
   FOR UPDATE;
UPDATE invoice_counters SET last_number = last_number + 1 WHERE ...;
```

Format: `PHARM/26-27/00042` — series / financial year / zero-padded 5-digit counter.
Financial year rolls over on 1 April; the counter restarts at 1 for the new year row.
Series codes: `PHARM` sales, `RET` sale returns, `PO` purchases.
`sales.invoice_no` carries a unique index as a second line of defence.

> **Cave law:** Invoice numbers come from the counter table under a row lock. Nothing else.

## Consequences
**Positive:** no duplicates under concurrency; no gaps on rollback (the counter rolls back
with the sale); financial-year rollover is a data row, not a code change.
**Negative:** the counter row is a serialization point — every sale queues on it briefly.
At 3-5 terminals this is microseconds and irrelevant; it would matter at 500.

## Alternatives rejected
- **`count(*) + 1`** — forbidden. Two concurrent sales read the same count and produce the
  same invoice number. Duplicate GST invoices are a filing problem, not a bug report.
- **PostgreSQL sequence** — sequences are non-transactional by design, so a rolled-back
  sale permanently burns a number. Gaps in a GST series invite questions.
- **UUID / timestamp** — not sequential, not human-readable, not compliant.
