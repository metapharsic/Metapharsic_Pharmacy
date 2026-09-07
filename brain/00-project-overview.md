# 00 — Project Overview

Purpose: define what Metapharsic Pharmacy is, who runs it, what v1 must and must not contain, and how we will know v1 is finished.

---

## 1. What the system is

Metapharsic Pharmacy is a single-shop pharmacy retail management system: point of sale,
batch- and expiry-aware inventory, purchasing, GST-compliant billing, customer and supplier
ledgers, and reporting. It replaces the shop's current mix of a cash register, a purchase
register, and a spreadsheet with one system of record.

The system exists to answer four questions correctly, every day, without a human recomputing
anything:

1. What did we sell, to whom, at what tax, and did the drawer match at closing?
2. What is on the shelf right now — by batch, with its expiry and its true cost?
3. What is about to expire, and is there still time to sell it or return it to the supplier?
4. Who owes us money, whom do we owe, and what do we file for GST?

**Stack:** PHP 8.3 · Laravel 12 · PostgreSQL 16 · Blade + Alpine.js + Tailwind · Vite.
**Locale:** India — INR, GST, `Asia/Kolkata`.

---

## 2. Who uses it

| Role | Who they are | What they do all day | What they must never be able to do |
|---|---|---|---|
| **Admin** | Owner / proprietor pharmacist | Everything. User management, stock adjustment, profit and GST reports, price and settings changes, overrides. | — (but every privileged action is audited) |
| **Pharmacist** | Registered pharmacist on duty | Sell, approve prescription (Schedule H) sales, authorise discounts above the cashier cap, enter purchases, process returns and cancellations. | Adjust stock; see the profit report; create users. |
| **Cashier** | Counter staff | Sell, take payment, print, look up stock and price, register walk-in customers. | See any purchase/cost price or margin; discount above the cap; cancel or return a sale; enter purchases; adjust stock. |

> **Cave law:** Cashier never sees cost. Purchase price, `effective_cost`, and
> `cost_price_at_sale` are excluded at the query layer for cashier sessions — not merely
> hidden in the Blade template.

### The business it runs

A single retail chemist shop. Roughly 2,000–4,000 distinct medicines, several thousand live
batches, 150–300 bills on a normal day with peaks around late morning and early evening.
Supply arrives as supplier invoices with batch numbers, expiry dates, free-goods schemes
(10+1), and GST at 0/5/12/18 percent. Sales are mostly walk-in cash/UPI, with a minority of
credit customers (regulars, nearby clinics) who settle periodically. Some stock is Schedule H
and may not be dispensed without a prescription record.

---

## 3. Scope

### In v1

| Area | Included |
|---|---|
| Access | Users, roles (admin/pharmacist/cashier), permissions, gates and policies, login log |
| Master data | Categories, manufacturers, medicines (HSN, GST rate, Rx flag, min stock, barcode), suppliers, customers, CSV import of the medicine list |
| Purchasing | Supplier invoice entry with line items, batch auto-creation, free goods, draft/confirm/cancel, supplier payments and outstanding |
| Inventory | `medicine_batches`, append-only `stock_transactions` ledger, opening stock, stock adjustment with reason codes, low-stock and expiry lists, `stock:verify` reconciliation command |
| Selling | Keyboard-driven POS, FEFO allocation with row locking, multi-batch line split, discount rules, GST computation, Schedule H block/override, hold and recall bill, cash/card/UPI/split/credit payment, atomic invoice numbering, A4 and 80mm print |
| Returns | Sales returns against the original sale item, refunds and credit notes, purchase returns to supplier, quarantine of expired stock |
| Money owed | Customer credit limits and outstanding, customer and supplier payments, ledger statements, aging buckets |
| Reporting | Dashboard with expiry/low-stock/dues alerts, sales, purchase, profit (admin only), stock and valuation, expiry window, fast/slow mover, GST output/input with HSN summary |
| Compliance | `audit_logs` with old/new JSONB snapshots, inspection-ready audit viewer |
| Operations | Nightly `pg_dump` backup with a tested restore, LAN deployment (nginx + php-fpm + supervisor + cron), thermal printer tuning, barcode scanning |

### Not in v1

These are explicitly out. Do not design for them, do not add columns "just in case".

| Excluded | Why, and what it would cost later |
|---|---|
| **Multi-store chains** | No `store_id` anywhere in v1. Adding it later is a schema-wide migration; that is accepted deliberately rather than carrying an always-`1` column through every table now. |
| **E-commerce / online ordering** | No public-facing surface, no payment gateway, no delivery workflow. The app is LAN-only. |
| **Insurance / TPA claim processing** | No claim forms, no panel pricing, no reimbursement tracking. |
| **Drug-interaction and allergy checking** | Requires a licensed clinical data source. Nice to have; deferred until such a source is procured. |
| **Mobile app** | The web UI is responsive enough for a tablet on the LAN. No native app, no offline sync layer. |
| Loyalty points, SMS/WhatsApp campaigns, doctor commission tracking, biometric attendance | Out of scope. Raise as a phase 7+ request with a business case. |

---

## 4. Success criteria for v1

v1 is finished when all of the following are demonstrably true, measured on the real shop's
data, not on seeded fixtures.

| # | Criterion | Measurement |
|---|---|---|
| S1 | **A full trading day reconciles.** | For one full parallel-run day: `SUM(payments.amount)` by mode equals counted cash in drawer plus card settlement plus UPI settlement, difference ₹0.00. For every sale, `total = subtotal - discount + gst_amount + round_off` and `total = SUM(sale_items.line_total) + round_off`, to the paisa, for 100 percent of bills. |
| S2 | **The ledger never drifts.** | `php artisan stock:verify` reports zero mismatching batches on 30 consecutive nightly runs and in every CI run. A single mismatch is a release blocker. |
| S3 | **Expiry loss is visible before it happens.** | Every batch is listed on the dashboard the first morning it enters the 90-day window, and again at 30 days. Over the first two quarters, value written off as `expiry_writeoff` is below 1 percent of purchase value for the same period, and no batch expires without having appeared in at least one 90-day report. |
| S4 | **Billing is fast enough for the 11am rush.** | A five-line cash bill is completed keyboard-only, no mouse, in under 45 seconds by a trained cashier. POS save (lock → allocate → write → commit) completes in under 500 ms at the 95th percentile with 5 concurrent users. |
| S5 | **Invoice numbers are unique and gap-explainable.** | A 5-user, 1,000-sale concurrency test produces 1,000 distinct invoice numbers, zero duplicates, zero unique-constraint failures surfaced to the user. Any gap in the series is traceable to a specific failed transaction in the log. |
| S6 | **GST filing comes out of the software.** | For one full month, the GST report's rate-slab and HSN summary matches the manually prepared GSTR-1 figures to the rupee. |
| S7 | **The month can be closed from the software alone.** | Sales, purchase, profit, stock valuation, customer/supplier ledger, and GST reports are produced without opening a spreadsheet. |
| S8 | **An inspection can be answered.** | For any sale, purchase, discount override, price change, stock adjustment, or permission change, the audit log yields who, when, from what, to what, in under 5 minutes. Every Schedule H sale has either a prescription record or a logged override with a named authoriser. |
| S9 | **The backup is real.** | At least one restore from a nightly `pg_dump` into a scratch database has been performed and verified against the source row counts and the day's sales totals. An untested backup does not count towards this criterion. |

---

## 5. Build phases

Each phase ends with something that works end to end. No half things.

| Phase | Goal | Done when |
|---|---|---|
| **1 — Make fire** | Foundation: Laravel 12 on PostgreSQL, Breeze auth, roles/permissions/gates, user CRUD, login log, base layout. Every migration written to the Part 0 money and quantity rules. | Admin logs in, creates a cashier; the cashier logs in, sees an empty dashboard, and is refused the user-management page. |
| **2 — Name the things** | Master data: categories, manufacturers, medicines (search, GST rate, HSN, min stock, Rx flag, barcode), suppliers, customers, CSV medicine import. | The shop's real medicine list is imported and searchable fast enough to bill from. |
| **3 — Fill the shelf** | Purchasing and the stock ledger: purchase entry with line items, batch auto-creation, `stock_transactions`, batch-wise inventory, stock adjustment, opening stock, low-stock and expiry lists, `stock:verify`. | A real supplier bill is entered and the stock numbers are right; cancelling it writes reversing transactions and the numbers return exactly. |
| **4 — Trade** (the big one) | POS: keyboard-driven billing, FEFO allocation under row locks, discount and GST math, Schedule H block, cash/card/UPI/split/credit payment, invoice number series, A4 and 80mm print, hold/recall, returns and refunds. | One full real trading day is run in parallel with the old method and every total matches at closing. |
| **5 — Read the bones** | Dashboard alerts and the full report set: sales, purchase, profit, stock and valuation, expiry, fast/slow mover, GST with HSN summary, customer/supplier ledger and aging, audit log viewer. | The month is closed from the software alone. |
| **6 — Make strong** | Hardening: barcode, thermal printer tuning, nightly backup plus a tested restore, role fine-tuning after real use, deployment (nginx, php-fpm, supervisor, cron), staff training, documented fallback for when the shop network or server dies. | The shop runs on it, and the owner sleeps. |

---

## 6. Key constraints

These shape the design and are not up for renegotiation inside v1.

**Single shop.** One legal entity, one GSTIN, one premises, one stock pool. There is no
`store_id`, no transfer-between-branches workflow, and no store-scoped permission. The
`transfer_in` / `transfer_out` stock transaction types exist only for future use and are
unreachable from the v1 UI.

**Small concurrency, high stakes per transaction.** Three to five concurrent users: typically
two POS terminals, one back-office machine entering purchases, and the owner on reports. This
means we can afford pessimistic row locking (`SELECT … FOR UPDATE`) on batch allocation — the
contention cost is negligible and the correctness gain is total. It also means we cannot hide
behind "it rarely happens": with two cashiers and one last strip, the race is a weekly event,
not a theoretical one.

**LAN-hosted and offline-intolerant.** The application runs on a machine inside the shop and
is reached over the shop LAN. There is no cloud dependency in the billing path — no external
API call may sit between a customer and their bill. The corollary is that when the server or
the LAN dies, billing stops. v1 therefore requires: a tested restore procedure, a UPS on the
server, and a written paper-fallback procedure for the counter (hand-written bill, entered
afterwards as a back-dated sale by a pharmacist, flagged in the audit log). An offline-capable
client is explicitly not in v1.

**Regulated.** Three separate regimes bear on the design:

- *Schedule H prescription medicines.* Medicines flagged `is_prescription_required` may not be
  dispensed without a prescription record or a logged pharmacist/admin override. This is a
  hard block in the POS, not a warning.
- *GST.* Every sale is a tax invoice: HSN code, rate slab, CGST/SGST or IGST split, invoice
  number from an unbroken per-financial-year series, and a round-off line. Invoice numbering
  correctness is a compliance requirement, not a cosmetic one.
- *Inspection-ready audit trail.* Sales are immutable. Every privileged or money-touching
  action writes an `audit_logs` row with old and new values. Nothing in the transactional
  history is ever hard-deleted. Retention periods differ per regime (GST records are retained
  for years; drug records have their own statutory retention) — the system's default is to
  retain everything indefinitely and never purge, which satisfies the strictest of them.
  Confirm the exact statutory periods with the pharmacy's compliance advisor before any
  purge feature is ever considered.

**Money and quantity.** Money is `numeric(12,2)` in PostgreSQL (`decimal(12,2)` in migrations),
never float, anywhere, ever. Quantity is `integer` in v1; the question of fractional dispensing
(half tablets) was deliberately deferred rather than silently assumed — see the ADR on quantity
precision in `brain/decisions/`.

---

## 7. Where to read next

| You need | Read |
|---|---|
| Layers, services, transactions, jobs | `brain/01-architecture.md` |
| Tables, columns, constraints, indexes, migration order | `brain/02-database-schema.md` |
| FEFO, expiry, GST, discounts, credit, returns, profit | `brain/03-domain-rules.md` |
| The eight cave laws and how to work here | `CLAUDE.md` |
| The original informal design and phase plan | `CAVEMAN_DESIGN.md` (frozen reference) |
| What is in scope this week | `brain/state/CURRENT_PHASE.md` |
