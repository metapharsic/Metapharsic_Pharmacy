# Phase 4 — POS and Sales ("Trade")

**Purpose:** put a cashier in front of a real customer and produce a correct, fast, legally
numbered GST invoice under real concurrent load.
**Depends on:** Phase 3 exit gate signed (`workflow/phase-pipeline.md` §4) — `medicine_batches`,
`stock_transactions`, `InventoryService::apply()`, and `stock:verify` all exist and are clean.
**Exit gate:** the conditions in `workflow/phase-pipeline.md` §5 (G4.1–G4.11), summarised —
one full real trading day run in parallel with the shop's old method on all terminals
simultaneously, every closing total (cash/card/UPI/credit/bill count) reconciles to the paisa;
the Phase 3 concurrency-test pattern re-run at full terminal count (ADR-0007) passes with zero
duplicate invoice numbers and `quantity_available` never negative; `stock:verify` clean at day
close; cashier cost-exposure sweep clean; no route can edit or delete a `sales`/`sale_items` row.
**Agents active:** pos-specialist (lead), backend-engineer, pharmacy-domain, frontend-engineer,
security-auditor, qa-tester. (`db-architect` and `devops` are on call for schema/CI review only —
not active leads this phase.)

> **Budget note:** this phase is scheduled longer than Phases 2, 3, 5, and 6. `CAVEMAN_DESIGN.md`
> calls it "the big one" for a reason four smaller phases are not: it is the only phase that must
> prove itself under real concurrent write contention (ADR-0007 — 4+ terminals) rather than under
> a single acceptance session. Row-lock ordering, invoice allocation timing, and the FEFO
> allocator each need their own concurrency test, and each concurrency test needs a real failure
> and a real fix before it is trusted. Compressing this phase to match the others is how a shop
> ends up with a race condition discovered on a Saturday.

---

## Tasks

| ID | Title | Owning agent | Depends on | Acceptance check |
|---|---|---|---|---|
| T-0401 | Keyboard-driven POS screen with the documented key contract, hold and recall | pos-specialist | gate Phase 3 | headline — decomposed below |
| T-0401a | POS shell and cart state: `layouts/pos.blade.php`, `Alpine.data('posCart', …)` matching the shape in `brain/06-ui-conventions.md` §5, no navigation chrome | pos-specialist | gate Phase 3 | Exit is blocked while the cart has lines; a Dusk/Pest-browser test asserts no sidebar link is reachable from `/pos` |
| T-0401b | Search-to-cart: F3 focus, 3-char trigram dropdown, arrow-key navigation, first result pre-highlighted | pos-specialist | T-0401a | Feature test: typing 3 characters returns results within the 150ms budget (`brain/06` §8); `Enter` alone adds the pre-highlighted result |
| T-0401c | Full key contract wired: F1 help overlay, F2 new customer, F4 payment, F9 hold, F10 recall, Esc, +/-, Tab, Ctrl+D, Ctrl+P, Ctrl+Del, F8 payment-mode cycle | pos-specialist | T-0401b | A Pest browser test drives a complete five-line cash bill using only key events, no `.click()` call anywhere in the test |
| T-0401d | Hold and recall: held bill survives page reload, cannot be recalled twice, re-quotes on recall | pos-specialist | T-0401c | Feature test: hold, reload the page, recall — cart restored; a second recall of the same held bill 404s |
| T-0401e | Barcode-as-keyboard handling: 8+ digit burst under 100ms/char terminated by Enter resolves via `api.pos.barcode` regardless of focused field | pos-specialist | T-0401b | Feature test simulates a fast digit burst while a non-search field has focus and asserts the item is added, not typed into the field |
| T-0402 | FEFO allocation with `SELECT … FOR UPDATE` and multi-batch line splitting | backend-engineer | gate Phase 3 | headline — decomposed below |
| T-0402a | `AllocateFefoBatches` service: lock order `ORDER BY expiry_date ASC, medicine_batches.id ASC FOR UPDATE`, re-check quantity and expiry inside the transaction | backend-engineer | gate Phase 3 | Unit test asserts the exact `ORDER BY` clause via query log; `InsufficientStockException` thrown and nothing written when unmet |
| T-0402b | Multi-batch line splitting: one `sale_items` row per batch slice, one visible invoice line | backend-engineer | T-0402a | `MultiBatchSplitTest`: selling 10 against a 4-unit nearest-expiry batch produces 2+ `sale_items` rows and 1 invoice line |
| T-0402c | Concurrency test at full terminal count: two-plus real connections racing the last unit | qa-tester | T-0402a | `Concurrency/LastUnitRaceTest.php`, tagged `->group('concurrency')`, run at the ADR-0007 terminal count; exactly one commits, `quantity_available` ends at 0, never −1 (G4.2) |
| T-0402d | Pharmacist batch override: manual batch pick overriding FEFO, logged | pharmacy-domain | T-0402a | `audit_logs` row written with requesting and approving user; feature test for cashier role denial |
| T-0403 | Tax and discount engine: line and invoice totals, CGST/SGST, round-off | pharmacy-domain | gate Phase 3, Q-002 | headline — decomposed below |
| T-0403a | Discount engine: line-level and bill-level percent, role-based cap at `DISCOUNT_OVERRIDE_PERCENT` (10%), override flow to pharmacist/admin credential | pharmacy-domain | T-0402a | Feature test: cashier discount above 10% opens the override prompt, not a silent apply; `discount.override` audit row carries both user ids |
| T-0403b | GST engine: CGST+SGST split at half the configured rate each (intra-state only per Q-002), computed per line, summarised per slab (0/5/12/18) | pharmacy-domain | T-0403a | `Feature/Services/Tax/GstCalculationTest.php`: `taxable_value * rate/2` per side, summed per slab, matches a hand-computed fixture |
| T-0403c | Round-off absorption: `round_off` bounded to ±0.50, invoice total reconciles exactly | pharmacy-domain | T-0403b | `subtotal − discount + gst_amount + round_off = total` asserted for a randomised batch of bills (G4.4) |
| T-0404 | Schedule H block with pharmacist override written to `audit_logs` | security-auditor | T-0401c | headline — decomposed below |
| T-0404a | Hard block: a Schedule H (`is_prescription_required`) line cannot reach payment without a prescription number and doctor name, or an authorised override | security-auditor | T-0401c | Feature test: F4 (payment) is refused server-side, not just UI-disabled, when an unsatisfied ℞ line is present |
| T-0404b | Override flow: pharmacist/admin credential re-entry, reason captured, `prescription.overridden` audit row | security-auditor | T-0404a | Audit row asserts approving user, medicine, sale, reason; cashier alone cannot self-override |
| T-0405 | Payments: cash, card, UPI, split, credit; credit-limit enforcement and override | backend-engineer | T-0402 | headline — decomposed below |
| T-0405a | Payment modes cash/card/UPI, single and split, each with its own reference field where applicable | backend-engineer | T-0403c | Feature test: a split payment's mode amounts sum exactly to `total`; a mismatch is refused with a 422 |
| T-0405b | Credit-sale path: block when `outstanding + this_bill > credit_limit`, admin override with reason | backend-engineer | T-0405a | Feature test: credit sale over limit refused for cashier and pharmacist; admin override writes `credit.overridden` with outstanding and shortfall |
| T-0405c | Payment row(s) written inside the sale transaction, `customer.outstanding_balance` updated for credit | backend-engineer | T-0405b | Feature test: a credit sale's `payments` row and `customers.outstanding_balance` delta are consistent in the same commit |
| T-0406 | Invoice numbering from `invoice_counters`, locked read-and-increment | backend-engineer | T-0402, Q-008 | headline — decomposed below |
| T-0406a | `invoice_counters` locked read-and-increment inside the sale transaction, allocated **last**, immediately before the `sales` insert — never at cart-open, never on hold | backend-engineer | T-0403c, T-0405c | Code review + test asserts no invoice number is allocated for a held-but-uncommitted bill; grep confirms the allocation call site is inside `SalesService::commit()`, after all validation |
| T-0406b | Format `PHARM/26-27/00042`, financial-year rollover at 1 April, unique index on `sales.invoice_no` as second line of defence | backend-engineer | T-0406a | Unit test for format and rollover; DB-level unique-violation test |
| T-0406c | Concurrency test at full terminal count: N simultaneous sales produce N distinct, contiguous, correctly formatted invoice numbers | qa-tester | T-0406b | `Concurrency/InvoiceNumberRaceTest.php`, `->group('concurrency')`, run at the ADR-0007 terminal count, zero unique-index violations surfaced (G4.3) |
| T-0407 | Invoice print: A4 and 80mm layouts with the statutory footer | frontend-engineer | T-0406, Q-003, Q-004 | headline — decomposed below |
| T-0407a | A4 layout `layouts/print-a4.blade.php` per `brain/06-ui-conventions.md` §7 — header, invoice meta, party block, prescription block, line table with HSN, tax summary per slab, totals, payment, footer | pos-specialist | T-0406b | Printed sample reviewed against the §7 section list; every field present with fixture data |
| T-0407b | 80mm thermal layout `layouts/print-80mm.blade.php` per `brain/06` §7 — same statutory content in compressed form | pos-specialist | T-0406b | Renders at 80mm with `@page` rule; manual print-preview check; GSTIN, HSN tax summary, drug licence number, invoice number all present |
| T-0407c | Print-after-commit discipline: printing triggers only after the sale response, a failed print reprints from `sales.receipt` and never re-runs the sale | pos-specialist | T-0407a, T-0407b | Feature test: simulated print failure leaves the sale committed once, with no duplicate `sales` row and no duplicate stock movement |
| T-0408 | Sales returns, refunds, credit notes, quarantine on expired returns | pharmacy-domain | T-0402 | headline — decomposed below |
| T-0408a | Return against original `sale_item`, quantity never exceeds sold-minus-already-returned | pharmacy-domain | T-0402b | Feature test: over-return attempt refused; `returns`/`return_items` reference the exact `sale_item_id` |
| T-0408b | Same-batch stock restore: return quantity goes back into `sale_items.medicine_batch_id`, never the current FEFO-nearest batch | pharmacy-domain | T-0408a | `Feature/Services/Returns/ReturnSameBatchTest.php` (G4.7) |
| T-0408c | Expired-return quarantine: a returned batch already past `expiry_date` is set to `quarantined`, not restored to sellable stock | pharmacy-domain | T-0408b | Feature test: returning against an expired batch leaves `quantity_available` for sellable stock unchanged and sets `BatchStatus::Quarantined` |
| T-0408d | Refund and credit note: negative `payments` row or a customer-account credit note | backend-engineer | T-0408a | Feature test: cash refund writes a negative `payments` row; a credit customer's return instead reduces `outstanding_balance` |
| T-0409 | Sale cancellation, same-day, before day-close | pharmacy-domain | T-0402, T-0406b | Feature test: a same-day cancel writes reversing `stock_transactions` for every line and a negative `payments` row, sets `sales.status = cancelled`, and the invoice number is never reused; attempting cancel on a prior day is refused (ADR-0005) |
| T-0410 | Cashier cost-exposure sweep across every new Phase 4 route | security-auditor | T-0401–T-0409 | `Feature/Http/Pos/CashierCostExposureTest.php` iterates the full Phase 4 route list and asserts the raw response body contains none of `purchase_price`, `effective_cost`, `cost_price_at_sale` (G4.5) |
| T-0411 | Phase 4 acceptance: parallel trading-day run, full-terminal-count concurrency suite, `stock:verify` at close | qa-tester | T-0401–T-0410 | Session note recording G4.1 (parallel-day reconciliation), G4.2/G4.3 concurrency evidence, G4.9 (45s five-line bill, 500ms p95 save), G4.10 (`stock:verify` exit 0) |

---

## Risks specific to this phase

> **Cave law:** allocation orders by `expiry_date ASC, id ASC` inside a transaction using
> `SELECT … FOR UPDATE` (cave law 4, ADR-0002). At 4+ concurrent terminals (ADR-0007) this lock
> is held on every sale line — the transaction must stay short: no printing, no HTTP call, no
> queue dispatch while a batch row is locked.

> **Cave law:** invoice numbers come from the `invoice_counters` row under a lock, allocated
> **last**, immediately before the `sales` insert — never at cart-open (ADR-0006, ADR-0007). A
> number allocated early and then abandoned by a hold or an abandoned bill burns a gap in a GST
> series that an inspector will ask about.

> **Cave law:** sales, `sale_items`, `payments`, and `stock_transactions` are append-only after
> commit — no edit affordance anywhere on the POS screen, in this phase or ever (ADR-0005, cave
> law 8). Corrections are same-day cancellation or a return, both audited.

> **Cave law:** cost never reaches a cashier's browser — excluded at the query layer, not the
> Blade layer (cave law 2, `brain/08-security-and-audit.md` §2.3). Every new Phase 4 endpoint is
> a new place this can silently regress; T-0410 exists because of that.

- **Lock-ordering deadlock risk.** A multi-line sale locks several `medicine_batches` rows;
  if two concurrent sales lock the same two batches in opposite order, they deadlock. ADR-0007's
  ordering rule (`id ASC` within each medicine, medicines processed in a stable order per sale)
  must be followed by every code path that locks more than one batch, not just the common one.
- **Held bills and stale quotes.** A held bill's prices and stock may have moved by recall time;
  T-0401d's forced re-quote on recall is the only defence — skipping it reintroduces stale-data
  sales that the FEFO re-check inside the transaction (T-0402a) would then reject at save time,
  which is correct but confusing to staff if untested.
- **Terminal-count underestimate.** Every concurrency test in this phase (T-0402c, T-0406c) must
  run at the actual ADR-0007 terminal count, not the "3–5" assumption T-0106/Q-006's earlier
  answer implied — a test passing at 3 connections and failing at 5 is a false gate.
- **Open questions still live at phase start.** Q-003 (statutory footer strings) and Q-004
  (thermal printer model) block T-0407 concretely; Q-008 (e-invoicing threshold) blocks T-0406 —
  if it resolves "yes", invoice numbering and print both need rework mid-phase. Escalate, do not
  guess (`CLAUDE.md` open-questions cave law).

## Definition of done

Universal checklist plus per-layer sections in `workflow/definition-of-done.md`, and specifically
for this phase:

- [ ] Every acceptance check in the table above actually run, not reasoned about.
- [ ] `Concurrency/LastUnitRaceTest.php` and `Concurrency/InvoiceNumberRaceTest.php` both green at
      the ADR-0007 terminal count, tagged `->group('concurrency')`.
- [ ] `CashierCostExposureTest.php` green across every Phase 4 route.
- [ ] `GstCalculationTest.php` and the round-off reconciliation query both green (G4.4).
- [ ] `ReturnSameBatchTest.php` and `ProfitSnapshotTest.php` green (G4.7, G4.8).
- [ ] No route, service, or console path can update or delete a `sales` or `sale_items` row —
      reviewer grep plus a feature test asserting the absence (G4.6).
- [ ] Five-line cash bill completed keyboard-only under 45 seconds; POS save under 500ms p95 at
      5 concurrent users (G4.9).
- [ ] `php artisan stock:verify` exits 0 after the parallel trading-day acceptance run (G4.10).
- [ ] Q-002, Q-003, Q-004, Q-008 each resolved or explicitly deferred with a named owner in
      `brain/state/OPEN_QUESTIONS.md` (G4.11).
- [ ] Phase gate signed by the orchestrator on qa-tester's and security-auditor's recommendation,
      recorded in `logs/build-log.md` per `workflow/phase-pipeline.md` §1, before Phase 5 tasks
      leave `blocked`.
