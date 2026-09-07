# Phase 5 — Reporting and Audit ("Read the bones")

**Purpose:** make the month closeable, and an inspection answerable, from the software alone.
**Depends on:** Phase 4 exit gate signed (`workflow/phase-pipeline.md` §5) — the tax engine,
invoice numbering, and `cost_price_at_sale` snapshot must be live and reconciling in production
sale data before any report can be built over them.
**Exit gate:** the conditions in `workflow/phase-pipeline.md` §6 (G5.1–G5.7), summarised — a full
month's GST report matches the manually prepared GSTR-1 figures to the rupee, per slab and per
HSN; the month closes without opening a spreadsheet; the profit report is refused to pharmacist
and cashier at the policy layer with no cost column selected for their session; dashboard renders
under 1 second, cached or summary-backed, never a live scan of `sale_items`; any watched event is
traceable in under 5 minutes.
**Agents active:** backend-engineer (lead), pharmacy-domain, db-architect, frontend-engineer,
security-auditor, qa-tester.

---

## Tasks

| ID | Title | Owning agent | Depends on | Acceptance check |
|---|---|---|---|---|
| T-0501 | `daily_sales_summary` and the idempotent `summary:rebuild` command | db-architect | gate Phase 4 | headline — decomposed below |
| T-0501a | `daily_sales_summary` schema: one row per `summary_date`, sales/purchases/profit/tax totals, unique on `summary_date` | db-architect | gate Phase 4 | Migration reversible; `brain/02-database-schema.md` updated in the same change |
| T-0501b | `summary:rebuild` command, written only by itself, idempotent by `summary_date` | backend-engineer | T-0501a | `Feature/Reports/SummaryRebuildIdempotencyTest.php`: two runs over the same day produce identical rows (G5.4) |
| T-0501c | Scheduler wiring: `summary:rebuild` at 00:30 daily per `brain/09-deployment.md` §5, failure path logs and alerts, dashboard falls back to a live query on failure | devops | T-0501b | Cron entry present; failure-path test forces an exception and asserts the log + alert fire |
| T-0502 | Dashboard: today's figures and the four alert boxes, expiry first | frontend-engineer | T-0501 | headline — decomposed below |
| T-0502a | Top-row stat tiles: today's sales, bill count, purchases, gross profit (admin-gated), cash in drawer | frontend-engineer | T-0501b | `x-stat-tile` used per `brain/06-ui-conventions.md` §4; gross-profit tile absent from the DOM entirely for pharmacist/cashier sessions, not merely hidden |
| T-0502b | Four alert boxes in order: expiring 30-day, expiring 90-day, below-min-stock, payment due | frontend-engineer | T-0502a | Feature test over a seeded expiry calendar: a batch entering the 90-day window appears the same morning, and again at 30 days (G5.7) |
| T-0502c | 30-day sales chart and top-10-medicine-this-month chart | frontend-engineer | T-0502a | Renders from `daily_sales_summary`, not a live `sale_items` scan; query-count assertion in the feature test |
| T-0502d | Dashboard cache/summary discipline: 5-minute cache or summary-table-backed, never live `SUM` over `stock_transactions` or `sale_items` at request time | backend-engineer | T-0502c | Performance group test: dashboard renders under 1 second with the full seeded dataset (G5.5, cave law 8) |
| T-0503 | Sales and purchase reports with date range, CSV and PDF export | backend-engineer | gate Phase 4 | headline — decomposed below |
| T-0503a | Sales report: daily/monthly, by user, by payment mode, date-range filter | backend-engineer | gate Phase 4 | Feature test: totals for a fixture date range match a hand-summed fixture exactly |
| T-0503b | Purchase report: by supplier, by date | backend-engineer | gate Phase 4 | Feature test against a fixture set of confirmed purchases |
| T-0503c | CSV and PDF export for both reports, generated to a temp path, deleted after download, export generation audited | backend-engineer | T-0503a, T-0503b | Feature test: export file exists transiently, is gone after the download response completes, `report.export` (or equivalent) audit row written |
| T-0504 | Profit report, admin only, from `cost_price_at_sale` | pharmacy-domain | gate Phase 4 | headline — decomposed below |
| T-0504a | Profit computation: `SUM(line_total − cost_price_at_sale * qty)` per medicine, per day, per category | pharmacy-domain | gate Phase 4 | Feature test against a fixture with known margins, verified to the paisa |
| T-0504b | Policy gate: `report.profit` hard-denied to non-admin regardless of the runtime permission grid (`brain/08-security-and-audit.md` §2) | security-auditor | T-0504a | Feature test for pharmacist and cashier roles, both refused at the policy layer (G5.3) |
| T-0504c | Snapshot-cost regression check: profit is unchanged after a batch's `purchase_price`/`selling_price` is edited post-sale | qa-tester | T-0504a | `Feature/Reports/ProfitSnapshotTest.php` re-run in this phase's context against the reporting query specifically (cave law 6) |
| T-0505 | GST report: rate-slab split, HSN summary, output and input tax | pharmacy-domain | gate Phase 4, Q-002, Q-008 | headline — decomposed below |
| T-0505a | Output tax: sales GST split by rate slab (0/5/12/18), CGST/SGST halves, per the tax engine built in T-0403b | pharmacy-domain | gate Phase 4 | Feature test: slab totals reconcile against a summed set of fixture invoices |
| T-0505b | Input tax: purchase GST by rate slab, from `purchase_items.gst_rate` | pharmacy-domain | gate Phase 4 | Feature test against fixture purchases |
| T-0505c | HSN summary: quantity and taxable value grouped by `hsn_code`, per the GST return's HSN-summary requirement | pharmacy-domain | T-0505a | Feature test against fixture data with two medicines sharing one HSN code |
| T-0505d | Hand-verification reconciliation: the report's figures for one real month checked against a sample of real invoices and the manually prepared GSTR-1 | qa-tester | T-0505a, T-0505b, T-0505c | Side-by-side reconciliation recorded in a session note, matches to the rupee, per slab and per HSN (G5.1) |
| T-0506 | Stock valuation, expiry windows, fast/slow mover reports | backend-engineer | gate Phase 4 | headline — decomposed below |
| T-0506a | Stock valuation: current batch-wise quantity at cost and at MRP, admin-only for the cost figure | backend-engineer | gate Phase 4 | Feature test: cashier/pharmacist request returns MRP valuation only, no cost column selected (`report.valuation` per §2.1) |
| T-0506b | Expiry window report: picker for 30/60/90/180 days, grouped with supplier so the shop knows who to call | backend-engineer | gate Phase 4 | Feature test over a seeded expiry calendar, each window boundary checked |
| T-0506c | Fast/slow mover report, backed by the weekly `analytics:movers` refresh from `brain/09-deployment.md` §5 | backend-engineer | gate Phase 4 | Feature test: a fixture medicine with high sale frequency appears in fast movers, a stale one in slow movers |
| T-0507 | Customer and supplier ledgers with 0–30/31–60/61–90/90+ aging | backend-engineer | gate Phase 4, Q-007 | headline — decomposed below |
| T-0507a | Customer ledger: per-customer statement of invoices, payments, and running balance | backend-engineer | gate Phase 4, Q-007 | Feature test against a fixture customer with mixed cash and credit sales |
| T-0507b | Supplier ledger: per-supplier statement of purchases and payments | backend-engineer | gate Phase 4 | Feature test against a fixture supplier |
| T-0507c | Aging buckets 0–30/31–60/61–90/90+ computed from real invoice dates, not a single lump opening balance (per Q-007's resolution) | backend-engineer | T-0507a | Feature test: an invoice dated 45 days back lands in the 31–60 bucket, not lumped into "old" |
| T-0508 | Audit log viewer with old/new JSONB diff | security-auditor | gate Phase 4 | headline — decomposed below |
| T-0508a | Audit log list: filterable by user, action, model, date range, per `brain/08-security-and-audit.md` §3 | security-auditor | gate Phase 4 | Feature test: filtering by `action = 'sale.void'` returns only void events |
| T-0508b | Old/new JSONB diff view per row, human-readable, no raw `jsonb` dump | security-auditor | T-0508a | Manual review: a `batch.price_changed` row renders "selling_price: 45.00 → 42.00", not a raw blob |
| T-0508c | Audit-trail timed drill: any sale void, discount override, price change, stock adjustment, or permission change traced to who/when/from-what/to-what | qa-tester | T-0508b | Timed drill recorded, under 5 minutes end to end (G5.6) |
| T-0509 | Month-close acceptance walkthrough with the shop owner | qa-tester | T-0501–T-0508 | Session note recording G5.2 — the month is closed using only the reports built in this phase, no spreadsheet opened |

---

## Risks specific to this phase

> **Cave law:** cost never reaches a cashier's or pharmacist's browser for the profit or
> valuation reports — excluded at the query layer, and `report.profit` is one of the four keys
> hard-denied to non-admins regardless of the runtime grid (`brain/08-security-and-audit.md` §2,
> cave law 2). T-0504b and T-0506a exist because a report screen is exactly where this is easiest
> to get wrong under time pressure.

> **Cave law:** `cost_price_at_sale` is the only source the profit report may read for cost —
> never a join back to the batch's current price (cave law 6, ADR-0002, ADR-0005). T-0504c
> re-proves this specifically against the reporting query, not just the sale-time write.

> **Cave law:** `audit_logs` is append-only; no route under `/audit` writes
> (`brain/08-security-and-audit.md` §3). The viewer built in T-0508 is read-only by construction —
> there is no edit or annotate affordance to accidentally add.

- **Schema temptation.** A slow report is fixed with an index or a summary row, never by
  denormalising a transactional table — Phase 5 is read-only over Phases 3 and 4, with the single
  exception of `daily_sales_summary` written only by `summary:rebuild` (phase-pipeline.md §6,
  "forbidden to start early"). A backend-engineer under a performance deadline reaching for a
  new column on `sale_items` "just for reporting" is the failure mode this phase most invites.
- **GST reconciliation is the real gate, not the code.** G5.1 requires a human comparison against
  a manually prepared GSTR-1 for one real month — this cannot be faked with fixture data alone
  and needs the shop's real invoices, which may not exist in volume until partway through the
  phase; sequence T-0505d late enough to have real data, but not so late it slips the gate.
- **Aging depends on Q-007.** If Q-007 (existing customer credit outstanding) is still open when
  T-0507c starts, opening balances risk landing in the wrong bucket on day one. Escalate rather
  than guess a migration date for legacy balances.

## Definition of done

Universal checklist plus per-layer sections in `workflow/definition-of-done.md`, and specifically
for this phase:

- [ ] `SummaryRebuildIdempotencyTest.php` green — two runs, identical rows (G5.4).
- [ ] Dashboard performance group test green: under 1 second with the full dataset, no live
      `sale_items`/`stock_transactions` scan (G5.5).
- [ ] `ProfitSnapshotTest.php` re-verified against the Phase 5 reporting query specifically.
- [ ] Profit and valuation policy tests green for both pharmacist and cashier roles (G5.3, G5.6
      §2.1 hard-deny keys unaffected).
- [ ] GST report hand-reconciled against one real month's GSTR-1 and a sample of real invoices,
      to the rupee, per slab and per HSN, recorded in a session note (G5.1).
- [ ] Audit-trail timed drill executed and recorded under 5 minutes (G5.6).
- [ ] Feature test over a seeded expiry calendar confirms the 90-day and 30-day dashboard alerts
      both fire on schedule (G5.7).
- [ ] Month-close walkthrough performed with the shop owner using only the software (G5.2).
- [ ] No new write path introduced outside `daily_sales_summary`/`summary:rebuild` — reviewer
      confirms against the Phase 5 "forbidden to start early" list.
- [ ] Phase gate signed by the orchestrator on qa-tester's and security-auditor's recommendation,
      recorded in `logs/build-log.md`, before Phase 6 tasks leave `blocked`.
