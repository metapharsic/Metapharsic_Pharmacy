# Decisions Log

One line per decision. The ADR holds the argument; this file holds the index. Append only.

| Date | ADR | Decision | Decided by |
|---|---|---|---|
| 2026-08-24 | [ADR-0001](../brain/decisions/ADR-0001-laravel-postgres.md) | PHP 8.3 + Laravel 12 + PostgreSQL 16 | orchestrator, db-architect |
| 2026-08-24 | [ADR-0002](../brain/decisions/ADR-0002-batch-model-and-fefo.md) | Quantity/expiry/price live on `medicine_batches`; FEFO allocation | orchestrator, pharmacy-domain |
| 2026-08-24 | [ADR-0003](../brain/decisions/ADR-0003-single-door-stock-ledger.md) | All stock movement through `stock_transactions` via `InventoryService` | orchestrator, db-architect |
| 2026-08-24 | [ADR-0004](../brain/decisions/ADR-0004-money-representation.md) | `numeric(12,2)` columns + money value object; floats forbidden | orchestrator, backend-engineer |
| 2026-08-24 | [ADR-0005](../brain/decisions/ADR-0005-immutable-sales.md) | Sales append-only; corrections are returns/cancellations | orchestrator, pharmacy-domain |
| 2026-08-24 | [ADR-0006](../brain/decisions/ADR-0006-invoice-numbering.md) | `invoice_counters` locked read-and-increment, `PHARM/26-27/00042` | orchestrator, db-architect |
| 2026-08-24 | [ADR-0007](../brain/decisions/ADR-0007-concurrency-and-scale.md) | 4+ terminals: allocate invoice number last, FEFO locks ordered by `id ASC`, explicit `lock_timeout`, Phase 3 concurrency test | orchestrator, db-architect |
