# Backlog

Purpose: hold every planned task, its phase, its single owning agent, its status, and what blocks it.

---

## 1. How to read and change this file

The orchestrator owns this file. An agent never changes its own row; it returns the task with a
handoff block (`workflow/handoff-protocol.md` §3) and the orchestrator moves the status.

**Status vocabulary — these five words only.**

| Status | Meaning |
|---|---|
| `todo` | Written and ready, nobody is working on it |
| `in-progress` | Assigned and being worked, exactly one agent |
| `blocked` | Cannot proceed: a named task, open question, or unsigned phase gate stands in the way |
| `review` | Work complete, Definition of Done self-checked, awaiting a reviewer who is not the author |
| `done` | Reviewed, logged, brain updated, merged |

**ID scheme.** `T-PPNN` — two digits of phase, two of sequence. `T-0403` is the third task of
Phase 4. IDs are never reused and never renumbered, because logs and ADRs reference them.

**Blocked-by** names the specific blocker: a task ID, a question ID, or `gate Phase N` for work
that cannot start until a phase gate is signed. Every task in Phases 2 through 6 carries an
implicit dependency on the preceding phase's gate; the column names only the additional ones.

This backlog holds headline tasks. A headline task is decomposed into sub-tasks by the
orchestrator when its phase opens; sub-tasks take IDs like `T-0403a`.

---

## 2. Phase 1 — Foundation

Open since 2026-08-24. Full scope in `brain/state/CURRENT_PHASE.md`.

| ID | Title | Phase | Owning agent | Status | Blocked by |
|---|---|---|---|---|---|
| T-0101 | Initialize the Laravel 12 project with a PostgreSQL 16 connection | 1 | devops | todo | — |
| T-0102 | Configure timezone `Asia/Kolkata`, INR locale, and app config baseline | 1 | devops | todo | T-0101 |
| T-0103 | Set up Pint, PHPStan/Larastan level 6, and Pest 3 on real PostgreSQL | 1 | devops | todo | T-0101 |
| T-0104 | CI skeleton: pipeline steps 1–11, including migrate-refresh reversibility | 1 | devops | todo | T-0103 |
| T-0105 | Migration conventions baseline: id, timestamptz, money, actor columns, index rules | 1 | db-architect | todo | T-0101, Q-001 |
| T-0106 | Identity schema: users, roles, permissions, pivots, login_logs | 1 | db-architect | todo | T-0105 |
| T-0107 | Auth scaffolding, session and password configuration, `is_active` enforcement | 1 | backend-engineer | todo | T-0106 |
| T-0108 | Roles, permissions, gates, policies, seeder, `permissions:check` command | 1 | security-auditor | todo | T-0106 |
| T-0109 | User CRUD, admin only, policy-enforced | 1 | backend-engineer | todo | T-0108 |
| T-0110 | Login and failed-login logging, audit hooks for permission changes | 1 | security-auditor | todo | T-0107 |
| T-0111 | Base layout: sidebar shell, permission-filtered navigation, empty dashboard | 1 | frontend-engineer | todo | T-0107 |
| T-0112 | Phase 1 acceptance suite and gate evidence | 1 | qa-tester | todo | T-0109, T-0111 |

## 3. Phase 2 — Master Data

| ID | Title | Phase | Owning agent | Status | Blocked by |
|---|---|---|---|---|---|
| T-0201 | `categories`, `manufacturers`, `units` schema and CRUD | 2 | backend-engineer | blocked | gate Phase 1 |
| T-0202 | `medicines` schema: HSN, GST rate, pack size, min stock, Rx flag, barcode, soft delete | 2 | db-architect | blocked | gate Phase 1 |
| T-0203 | Medicine CRUD with validation and the GST-slab and pack-size CHECK constraints | 2 | backend-engineer | blocked | T-0202 |
| T-0204 | Medicine search: trigram/prefix indexing, name, generic name, barcode exact match | 2 | db-architect | blocked | T-0202 |
| T-0205 | `suppliers` schema and CRUD, including `state_code` | 2 | backend-engineer | blocked | gate Phase 1, Q-002 |
| T-0206 | `customers` schema and CRUD: phone index, credit limit, outstanding balance | 2 | backend-engineer | blocked | gate Phase 1, Q-007 |
| T-0207 | CSV medicine import: dry run, row-level error report, idempotent re-run | 2 | pharmacy-domain | blocked | T-0203, Q-005 |
| T-0208 | Master-data UI screens under the Phase 1 layout | 2 | frontend-engineer | blocked | T-0201, T-0203 |

## 4. Phase 3 — Inventory and Purchasing

| ID | Title | Phase | Owning agent | Status | Blocked by |
|---|---|---|---|---|---|
| T-0301 | `medicine_batches` schema: unique key, CHECK constraints, status enum | 3 | db-architect | blocked | gate Phase 2 |
| T-0302 | `stock_transactions` append-only ledger with `balance_after` and polymorphic reference | 3 | db-architect | blocked | T-0301 |
| T-0303 | `InventoryService::apply()` — the single stock door | 3 | backend-engineer | blocked | T-0302 |
| T-0304 | Purchase entry: draft, confirm, cancel with reversal; supplier outstanding | 3 | backend-engineer | blocked | T-0303 |
| T-0305 | Batch auto-create on confirm, free goods, `effective_cost`, opening stock entry | 3 | pharmacy-domain | blocked | T-0304, Q-007 |
| T-0306 | Stock adjustment with mandatory reason codes, admin only | 3 | backend-engineer | blocked | T-0303 |
| T-0307 | `php artisan stock:verify` and its CI wiring | 3 | qa-tester | blocked | T-0303 |
| T-0308 | Batch-wise inventory, low-stock, and expiry-window screens | 3 | frontend-engineer | blocked | T-0304 |

## 5. Phase 4 — POS and Sales

| ID | Title | Phase | Owning agent | Status | Blocked by |
|---|---|---|---|---|---|
| T-0401 | Keyboard-driven POS screen with the documented key contract, hold and recall | 4 | pos-specialist | blocked | gate Phase 3 |
| T-0402 | FEFO allocation with `SELECT … FOR UPDATE` and multi-batch line splitting | 4 | backend-engineer | blocked | gate Phase 3 |
| T-0403 | Tax and discount engine: line and invoice totals, CGST/SGST/IGST, round-off | 4 | pharmacy-domain | blocked | gate Phase 3, Q-002 |
| T-0404 | Schedule H block with pharmacist override written to `audit_logs` | 4 | security-auditor | blocked | T-0401 |
| T-0405 | Payments: cash, card, UPI, split, credit; credit-limit enforcement and override | 4 | backend-engineer | blocked | T-0402 |
| T-0406 | Invoice numbering from `invoice_counters`, locked read-and-increment | 4 | backend-engineer | blocked | T-0402, Q-008 |
| T-0407 | Invoice print: A4 and 80mm layouts with the statutory footer | 4 | frontend-engineer | blocked | T-0406, Q-003, Q-004 |
| T-0408 | Sales returns, refunds, credit notes, quarantine on expired returns | 4 | pharmacy-domain | blocked | T-0402 |

## 6. Phase 5 — Reporting and Audit

| ID | Title | Phase | Owning agent | Status | Blocked by |
|---|---|---|---|---|---|
| T-0501 | `daily_sales_summary` and the idempotent `summary:rebuild` command | 5 | db-architect | blocked | gate Phase 4 |
| T-0502 | Dashboard: today's figures and the four alert boxes, expiry first | 5 | frontend-engineer | blocked | T-0501 |
| T-0503 | Sales and purchase reports with date range, CSV and PDF export | 5 | backend-engineer | blocked | gate Phase 4 |
| T-0504 | Profit report, admin only, from `cost_price_at_sale` | 5 | pharmacy-domain | blocked | gate Phase 4 |
| T-0505 | GST report: rate-slab split, HSN summary, output and input tax | 5 | pharmacy-domain | blocked | gate Phase 4, Q-002, Q-008 |
| T-0506 | Stock valuation, expiry windows, fast and slow mover reports | 5 | backend-engineer | blocked | gate Phase 4 |
| T-0507 | Customer and supplier ledgers with 0–30 / 31–60 / 61–90 / 90+ aging | 5 | backend-engineer | blocked | gate Phase 4, Q-007 |
| T-0508 | Audit log viewer with old/new JSONB diff | 5 | security-auditor | blocked | gate Phase 4 |

## 7. Phase 6 — Hardening and Deployment

| ID | Title | Phase | Owning agent | Status | Blocked by |
|---|---|---|---|---|---|
| T-0601 | Barcode scanning end to end, scanner as keyboard, no driver | 6 | pos-specialist | blocked | gate Phase 5 |
| T-0602 | Thermal 80mm printer tuning against the shop's actual device | 6 | frontend-engineer | blocked | gate Phase 5, Q-004 |
| T-0603 | Nightly `pg_dump`, 30-day retention, off-machine copy, performed restore drill | 6 | devops | blocked | gate Phase 5 |
| T-0604 | Deployment: nginx, php-fpm, supervisor, scheduler cron, UPS check | 6 | devops | blocked | gate Phase 5, Q-006 |
| T-0605 | Role and permission fine-tuning after real use, with a re-audit | 6 | security-auditor | blocked | gate Phase 5 |
| T-0606 | Paper-fallback procedure, back-dated sale handling, staff training | 6 | orchestrator | blocked | gate Phase 5 |
| T-0607 | Performance pass, monitoring and alerting, 30-night `stock:verify` watch | 6 | devops | blocked | T-0604 |

## 8. Counts

| Phase | Tasks | todo | in-progress | blocked | review | done |
|---|---|---|---|---|---|---|
| 1 — Foundation | 12 | 12 | 0 | 0 | 0 | 0 |
| 2 — Master Data | 8 | 0 | 0 | 8 | 0 | 0 |
| 3 — Inventory and Purchasing | 8 | 0 | 0 | 8 | 0 | 0 |
| 4 — POS and Sales | 8 | 0 | 0 | 8 | 0 | 0 |
| 5 — Reporting and Audit | 8 | 0 | 0 | 8 | 0 | 0 |
| 6 — Hardening and Deployment | 7 | 0 | 0 | 7 | 0 | 0 |
| **Total** | **51** | **12** | **0** | **39** | **0** | **0** |

**Last updated:** 2026-08-24
