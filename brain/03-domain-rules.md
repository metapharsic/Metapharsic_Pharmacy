# 03 — Domain Rules

Purpose: state the pharmacy's business logic as numbered, testable rules — what must happen, what must be blocked, and what must be recorded.

---

## 1. How to read these rules

Every rule has an identifier (`DR-FEFO-03`). Every rule is written so that a failing case can
be expressed as a test. Where a rule names a threshold, that threshold lives in `settings` and
the value quoted here is the shipped default.

A rule is enforced at one or more of four points, and the enforcement point is stated:

| Point | Meaning |
|---|---|
| **DB** | A constraint in PostgreSQL. Cannot be bypassed by any code path. |
| **Service** | Checked inside the owning Service, inside the transaction, against locked rows. |
| **Request** | Checked by a Form Request before the Service is called — shape and permission only. |
| **UI** | Surfaced in Blade/Alpine for the operator. Advisory. Never the only enforcement. |

> **Cave law:** A rule enforced only in the UI is not enforced. The browser is a convenience,
> not a guarantee.

---

## 2. FEFO allocation

First-Expiry-First-Out. The batch that expires soonest is sold first, so the shop's money does
not die on the shelf.

### 2.1 The rules

| ID | Rule | Enforced at |
|---|---|---|
| `DR-FEFO-01` | Allocation considers only batches where `quantity_available > 0` **and** `status = 'available'` **and** `expiry_date > CURRENT_DATE`. | Service, DB (partial index) |
| `DR-FEFO-02` | Batches are consumed in `expiry_date ASC, id ASC` order. `id` is the tie-break, so two batches with the same expiry always allocate in a deterministic, reproducible order. | Service |
| `DR-FEFO-03` | Allocation happens inside the sale's transaction, against rows read with `FOR UPDATE`. Quantities sent by the browser are advisory and are discarded. | Service |
| `DR-FEFO-04` | Locks are acquired in ascending `id` order, in one statement, covering every batch the whole cart might touch. Never per line, never in expiry order. | Service |
| `DR-FEFO-05` | If one batch cannot satisfy a line, the line splits across batches. One `sale_item` row per batch slice, all slices sharing a `group_key`. The invoice prints one line; the database records the split. | Service |
| `DR-FEFO-06` | If the sellable quantity across all batches is less than the line quantity, the whole sale is rejected. Partial fulfilment is never silently applied — the cashier is told the available number and decides. | Service |
| `DR-FEFO-07` | An operator may **not** override FEFO to pick a farther-expiry batch when a nearer one exists. The only exception is a batch the pharmacist has quarantined, which is out of the candidate set by `DR-FEFO-01` anyway. | Service |
| `DR-FEFO-08` | Every allocated slice writes exactly one `stock_transactions` row of type `sale` with a negative `quantity_change`, referencing its `sale_item`. | Service |

> **Cave law:** FEFO with a row lock. Allocation orders by `expiry_date ASC` inside a
> transaction using `SELECT … FOR UPDATE`. Two cashiers selling the last strip at the same
> second is a weekly event in a real shop, not a theoretical race.

### 2.2 The algorithm

1. **Collect demand.** Build a map of `medicine_id → total quantity` across the whole cart,
   merging duplicate lines for the same medicine so one medicine is allocated once.
2. **Discover candidates (no lock).** For each medicine, select the ids of all sellable batches
   in FEFO order. Over-fetch — take every sellable batch for the medicine, not just enough to
   cover the demand — so a concurrent sale that empties the front batch does not force a second
   lock pass.
3. **Union and sort.** Merge every candidate id from every medicine into one list and sort it
   ascending. This list is the lock set.
4. **Open the transaction.**
5. **Lock in one statement**, `ORDER BY id ASC … FOR UPDATE`. This is the only locking read in
   the operation.
6. **Re-validate.** For each locked row, re-check `quantity_available > 0`,
   `expiry_date > CURRENT_DATE`, `status = 'available'`. Rows that no longer qualify drop out of
   the candidate set. Screen data is old; the database is truth.
7. **Sort in memory** by `(expiry_date ASC, id ASC)` per medicine, and allocate greedily:
   take `min(remaining_demand, batch.quantity_available)` from each batch in turn.
8. **Fail if short.** If any medicine's demand is not fully covered after exhausting its locked
   candidates, roll back and re-run the whole transaction (up to 3 attempts). If it is still
   short, reject the sale with the actual available quantity in the message.
9. **Materialise.** For each slice, insert a `sale_item` carrying `medicine_batch_id`,
   `quantity`, `unit_price`, `gst_rate`, `hsn_code`, `expiry_date`, `mrp`, and
   `cost_price_at_sale` copied from the batch's `effective_cost`.
10. **Move stock.** Call `InventoryService::apply()` once per slice with the negative delta; it
    writes the ledger row and decrements the batch. A batch reaching zero becomes `finished`.
11. **Continue** with tax, payment, invoice number, commit.

### 2.3 The SQL

Candidate discovery — no lock, ordered FEFO:

```sql
SELECT id
  FROM medicine_batches
 WHERE medicine_id = :medicine_id
   AND quantity_available > 0
   AND status = 'available'
   AND expiry_date > CURRENT_DATE
 ORDER BY expiry_date ASC, id ASC;
```

The locking read — one statement for the entire cart, ascending id:

```sql
SELECT id,
       medicine_id,
       batch_no,
       expiry_date,
       status,
       quantity_available,
       selling_price,
       mrp,
       effective_cost,
       gst_rate
  FROM medicine_batches
 WHERE id = ANY(:candidate_ids)
   AND quantity_available > 0
   AND status = 'available'
   AND expiry_date > CURRENT_DATE
 ORDER BY id ASC
   FOR UPDATE;
```

The decrement, written only by `InventoryService`, alongside its ledger row:

```sql
UPDATE medicine_batches
   SET quantity_available = quantity_available - :qty,
       status = CASE WHEN quantity_available - :qty = 0 THEN 'finished' ELSE status END,
       updated_at = now()
 WHERE id = :batch_id
RETURNING quantity_available;   -- becomes stock_transactions.balance_after
```

### 2.4 The multi-batch split, worked

A customer buys 10 strips of Paracetamol. Sellable batches:

| Batch | Expiry | Available |
|---|---|---|
| B1024 | 2027-03-31 | 4 |
| B1101 | 2027-08-31 | 12 |
| B0990 | 2026-11-30 | 0 (finished — excluded by `DR-FEFO-01`) |

Allocation: 4 from B1024 (nearest expiry), then the remaining 6 from B1101.

Resulting rows:

| Row | `sale_item` | batch | qty | `group_key` | ledger row |
|---|---|---|---|---|---|
| 1 | line 1, slice 1 | B1024 | 4 | `a3f1…` | `sale`, `-4`, `balance_after = 0`, ref `SaleItem#1` |
| 2 | line 1, slice 2 | B1101 | 6 | `a3f1…` | `sale`, `-6`, `balance_after = 6`, ref `SaleItem#2` |

B1024 becomes `finished`. The printed invoice shows one line: `Paracetamol 500mg — 10 —
₹12.00 — ₹120.00`, with the batch column showing the nearest-expiry batch and a footnote marker
where the shop wants both batch numbers printed (a settings flag; some inspectors want every
batch on the face of the invoice, and `sale_items` already holds them).

If the two slices carry different `selling_price` values — the newer batch was bought at a
higher price — the POS bills **both slices at the price of the first slice** and records the
difference as a per-line margin variance, rather than printing two different rates for what the
customer sees as one item. The cost side is unaffected: each slice keeps its own
`cost_price_at_sale`, so profit stays honest.

---

## 3. Expiry

| ID | Rule | Enforced at |
|---|---|---|
| `DR-EXP-01` | `expiry_date` holds the labelled expiry. Stock is sellable only while `expiry_date > CURRENT_DATE`. A batch is not sold on its expiry date itself — a one-day conservative margin, and it matches the FEFO predicate exactly. | Service, DB (index predicate) |
| `DR-EXP-02` | **Selling expired stock is blocked hard.** Not a warning, not a confirmation dialog, not an admin override. There is no code path in the system that sells a batch with `expiry_date <= CURRENT_DATE`. | Service |
| `DR-EXP-03` | A batch expiring within 90 days is flagged **warning** (yellow) at the POS line and appears on the 90-day expiry report with its supplier, so it can still be returned under the supplier's near-expiry terms. | UI, Service |
| `DR-EXP-04` | A batch expiring within 30 days is flagged **critical** (red) and appears on the dashboard's first alert tile with the value at risk. | UI, Service |
| `DR-EXP-05` | Warning and critical windows are `settings` values (`expiry.warning_days` = 90, `expiry.critical_days` = 30) and are read, never hard-coded. | Service |
| `DR-EXP-06` | `expiry:scan` runs at 06:00 daily. It sets `status = 'expired'` on every batch that has passed `expiry_date`, and raises `BatchNearingExpiry` the first time a batch crosses each window. | Service |
| `DR-EXP-07` | Setting a batch to `expired` does **not** by itself remove its quantity. The quantity leaves through an explicit `expiry_writeoff` stock transaction, so the loss is visible, dated, valued, and attributable. | Service |
| `DR-EXP-08` | Expired stock is physically separated and represented as `status = 'quarantined'` while it awaits a supplier return, or written off with `expiry_writeoff` if the supplier will not take it. | Service |
| `DR-EXP-09` | **Quarantined or expired stock never returns to sellable status.** There is no transition from `quarantined` or `expired` back to `available`. Correcting a mistaken quarantine is an admin stock adjustment with reason `counting_error`, which creates a fresh, auditable movement rather than a silent status flip. | Service, DB (status CHECK plus a service-level transition table) |
| `DR-EXP-10` | Expired goods returned by a customer are accepted, but with `return_items.condition = 'expired'` and `restock = false`. They go to quarantine, never back to sellable stock. | Service, DB (CHECK) |

> **Cave law:** Expired stock is never sold and never returns to sellable stock. Both
> directions are closed: the sale path filters it out, and no status transition brings it back.

### Batch status transitions

```
                      purchase confirmed / opening stock
                                   │
                                   ▼
                            ┌─────────────┐
              sold out ◄────│  available  │────► expiry:scan past expiry_date
                  │         └──────┬──────┘                    │
                  ▼                │ pharmacist                ▼
            ┌──────────┐           │ quarantines         ┌──────────┐
            │ finished │           │ (recall, damage,    │ expired  │
            └──────────┘           │  near expiry)       └────┬─────┘
                  ▲                ▼                          │
                  │        ┌──────────────┐                   │
        restock   │        │ quarantined  │◄──────────────────┘
        from a    │        └──────┬───────┘   expired stock is quarantined
        sales     │               │            pending supplier return
        return    │               ▼
                  │      purchase_return to supplier
                  │               or
                  │      expiry_writeoff  (quantity to zero)
                  │
        (only from `available`; a return never resurrects a
         finished batch's sellability beyond restoring quantity)
```

---

## 4. Prescription (Schedule H) rules

| ID | Rule | Enforced at |
|---|---|---|
| `DR-RX-01` | A medicine with `is_prescription_required = true` is a Schedule H item. Any sale containing at least one such line sets `sales.requires_prescription = true`. | Service |
| `DR-RX-02` | **A sale containing a Schedule H line cannot be completed** unless either (a) a `prescriptions` record is supplied with, at minimum, `doctor_name`, or (b) a valid override is recorded. | Service |
| `DR-RX-03` | An override requires: an authoriser holding the `sale.rx_override` permission (**pharmacist or admin only — never a cashier, and never the cashier's own session without a re-authentication by the authoriser**), and a non-empty `rx_override_reason`. Both are written to `sales.rx_override_by` and `sales.rx_override_reason`. | Service, DB (CHECK) |
| `DR-RX-04` | Every override writes an `audit_logs` row with `action = 'sale.rx_override'` carrying the sale id, the medicines involved, the authoriser, the reason, and the IP. | Service |
| `DR-RX-05` | The POS marks Schedule H lines with a red ℞ from the moment they enter the cart, not at payment time. The operator learns what is needed before the customer's card is out. | UI |
| `DR-RX-06` | A prescription record is captured once per sale, not once per line. `prescriptions.sale_id` is unique. | DB |
| `DR-RX-07` | Prescription records are never deleted. A wrong prescription entry is corrected by cancelling the sale and re-billing, which leaves both records visible. | Service |
| `DR-RX-08` | The Schedule H report lists, for any date range, every sale with `requires_prescription = true`, showing whether it carries a prescription record or an override — with a running count of overrides per authoriser. A high override count for one person is the pattern an inspection looks for, and the shop should see it first. | Service |
| `DR-RX-09` | Schedule H1 and Schedule X handling (separate bound registers, stricter retention) is **not implemented in v1**. Where the shop stocks such items, they are handled on paper and the medicine is still flagged `is_prescription_required` so the block applies. | — |

> **Cave law:** No Schedule H medicine leaves the shop without either a prescription record or
> a named pharmacist's logged override. There is no third option and no silent path.

---
## 5. GST

The shop is a single registration in one state. Its own state code is `settings['shop.state_code']`.

### 5.1 Rules

| ID | Rule | Enforced at |
|---|---|---|
| `DR-GST-01` | The only permitted rate slabs are **0, 5, 12, 18** percent. `28` does not occur on pharmaceutical goods the shop sells and is rejected. | DB (CHECK), Service |
| `DR-GST-02` | The rate is taken from the **line's own snapshot** (`sale_items.gst_rate`, snapshotted from the batch, which snapshotted it from the purchase), never re-derived from `medicines.gst_rate` at report time. A slab change must not rewrite history. | Service |
| `DR-GST-03` | Every sale line carries an `hsn_code`, snapshotted from the medicine. A medicine without an HSN code cannot be billed. | Service |
| `DR-GST-04` | **v1 is intra-state only.** The shop confirmed it never raises an invoice where the place of supply is outside its own state (Q-002, resolved). Every sale splits tax into CGST and SGST, each half the total rate. `igst_amount = 0` always. | Service |
| `DR-GST-05` | **IGST is out of scope for v1.** There is no inter-state code path — no IGST computation, no inter-state GST report section. `cgst_amount`/`sgst_amount` are the only tax columns a sale writes. If the shop ever takes on inter-state supply, that is a phase-7-or-later concern: a new ADR, a schema change to add the IGST path, and a new GST report section — not a v1 branch left half-built. | Service, DB (CHECK) |
| `DR-GST-06` | Tax is computed **per line, on the taxable value after discount**, never on the pre-discount amount and never once on the invoice total. Two lines at different slabs must never be blended. | Service |
| `DR-GST-07` | Rounding is applied at each defined step with **half-up** rounding to two decimals, using decimal arithmetic (bcmath / a decimal value object), never float. | Service |
| `DR-GST-08` | The invoice total is rounded to the whole rupee. The difference is written to `sales.round_off`, which is constrained to the range −0.50 … +0.50 and is the **only** place the rounding difference may live. Line values are never nudged to make the total come out round. | Service, DB (CHECK) |
| `DR-GST-09` | Where the shop bills at printed MRP, MRP is tax-**inclusive** and the taxable value is back-calculated (§5.3). Where it bills at a negotiated rate, `unit_price` is tax-exclusive. Which mode applies is a per-shop `settings` value, applied consistently across an invoice. | Service |
| `DR-GST-10` | Purchases mirror the same split for input tax: CGST+SGST input credit only, per v1's intra-state-only scope (DR-GST-04, DR-GST-05). | Service |
| `DR-GST-11` | The GST report reconciles: output tax from `sale_items` minus tax on `return_items`, input tax from confirmed `purchase_items` minus tax on `purchase_return_items`, each summarised by rate slab and by HSN code. | Service |

### 5.2 Line computation, in order

```
gross            = quantity × unit_price                         -- 2 dp
discount_amount  = round(gross × discount_percent / 100, 2)      -- or entered directly
taxable_amount   = gross − discount_amount                       -- DR-GST-06
gst_amount       = round(taxable_amount × gst_rate / 100, 2)

                 cgst_amount = round(taxable_amount × gst_rate / 200, 2)  -- v1 is intra-state
                 sgst_amount = gst_amount − cgst_amount          -- residual paise to SGST,
                 igst_amount = 0 always                          --   so the halves always
                                                                 --   sum to gst_amount
                                                                 -- (no inter-state path in v1)

line_total       = taxable_amount + gst_amount
```

Invoice level:

```
subtotal        = Σ gross
discount        = Σ discount_amount
taxable_amount  = Σ taxable_amount            -- equals subtotal − discount
cgst_amount     = Σ cgst_amount   (etc. per component)
gst_amount      = cgst_amount + sgst_amount + igst_amount
pre_round       = taxable_amount + gst_amount
total           = round(pre_round, 0)          -- whole rupee, half-up
round_off       = total − pre_round            -- −0.50 … +0.50   (DR-GST-08)
```

Worked example — two lines, intra-state, 5 percent bill discount already distributed to lines:

| Line | Qty | Rate | Gross | Disc | Taxable | Slab | CGST | SGST | Line total |
|---|---|---|---|---|---|---|---|---|---|
| Paracetamol | 2 | 12.00 | 24.00 | 0.00 | 24.00 | 12% | 1.44 | 1.44 | 26.88 |
| Amoxicillin | 1 | 88.00 | 88.00 | 4.40 | 83.60 | 12% | 5.02 | 5.01 | 93.63 |
| **Invoice** | | | **112.00** | **4.40** | **107.60** | | **6.46** | **6.45** | **120.51** |

`pre_round = 120.51` → `total = 121.00`, `round_off = +0.49`. Note the Amoxicillin line: half of
₹10.03 is ₹5.015; CGST takes ₹5.02 and SGST absorbs the residual ₹5.01 so the two halves still
sum exactly to the line's `gst_amount`. Never let both halves round independently — that is how
an invoice ends up one paisa short of itself.

### 5.3 MRP is tax-inclusive

When billing at printed MRP:

```
taxable_unit_price = round(mrp × 100 / (100 + gst_rate), 2)
```

For an MRP of ₹112.00 at 12 percent: `112 × 100 / 112 = 100.00` taxable, ₹12.00 tax. The
`unit_price` stored on `sale_items` is always the **tax-exclusive** figure, whichever mode the
shop bills in; the inclusive MRP is stored separately in `sale_items.mrp` for printing. Reports
therefore never have to ask which mode a historic invoice used.

### 5.4 Reporting

The GST report produces, for a period:

- **Output tax** — from `sale_items`, grouped by `gst_rate`, then by `hsn_code`: taxable value,
  CGST, SGST, total tax, and quantity (no IGST column — v1 is intra-state only). Sales returns appear as negative rows in the same
  grouping, never as a separate netting step applied afterwards.
- **Input tax** — the same shape from confirmed `purchase_items`, less `purchase_return_items`.
- **HSN summary** — HSN, description, UQC (unit), total quantity, taxable value, tax by
  component. This is the section that goes into GSTR-1.
- **Reconciliation line** — output minus input, the net liability, shown alongside the shop's
  own arithmetic so a mismatch is visible on the same page.

---

## 6. Discounts

| ID | Rule | Enforced at |
|---|---|---|
| `DR-DISC-01` | A discount is expressed as a percentage of the line's gross value or as an absolute rupee amount. Whichever is entered, both `discount_percent` and `discount_amount` are stored. | Service |
| `DR-DISC-02` | `discount_amount` may never exceed `quantity × unit_price` for the line, nor `subtotal` for the invoice. A negative discount is not a thing. | DB (CHECK), Service |
| `DR-DISC-03` | **Role caps.** The maximum discount percentage the biller may apply without authorisation: | Service |

| Role | Cap without authorisation | Setting key |
|---|---|---|
| Cashier | **10 percent** | `discount.cap.cashier` |
| Pharmacist | 25 percent | `discount.cap.pharmacist` |
| Admin | 100 percent | `discount.cap.admin` |

| ID | Rule | Enforced at |
|---|---|---|
| `DR-DISC-04` | A discount above the biller's cap requires an **override by a pharmacist or admin** whose cap covers the requested figure. The authoriser is recorded in `sales.discount_override_by`. A cashier cannot authorise their own override, and a pharmacist cannot authorise beyond the pharmacist cap. | Service |
| `DR-DISC-05` | Every override writes an `audit_logs` row with `action = 'sale.discount_override'`, carrying the requested percentage, the biller, the authoriser, the sale, and the rupee value forgone. | Service |
| `DR-DISC-06` | A bill-level discount percentage is **distributed to the lines** before tax is computed, proportionally to each line's gross value, with the rounding residue assigned to the largest line. A bill-level discount is never applied to the invoice total after tax — that would misstate the taxable value on every line. | Service |
| `DR-DISC-07` | The permission `sale.discount.high` gates the override; it is granted to pharmacist and admin only. The cap values themselves remain in `settings` so the owner can tighten them without a deployment. | Request, Service |
| `DR-DISC-08` | The discount report lists, per period and per user, total discount given, as a percentage of gross sales, with every override itemised. Discount leakage is a pharmacy's quietest loss. | Service |

> **Cave law:** A discount above the biller's role cap requires a named authoriser and is
> logged. No exceptions, no "just this once" flag.

---

## 7. Free goods, schemes and `effective_cost`

Suppliers sell 10 strips and give 1 free. Eleven strips arrive; the shop paid for ten. If cost
is booked at the invoice rate, every profit number in the system is wrong by the scheme
percentage — and it is wrong in the shop's favour, which is the dangerous direction.

| ID | Rule | Enforced at |
|---|---|---|
| `DR-FREE-01` | `free_quantity` is recorded separately from `quantity` on `purchase_items`. Free goods have a purchase price of zero, not a discounted price. | Service |
| `DR-FREE-02` | Free goods **enter stock**. `quantity_received` on the batch is `quantity + free_quantity`, and the `purchase` stock transaction carries the combined figure. Free stock that is not in the system is stock that walks out unrecorded. | Service |
| `DR-FREE-03` | The batch's true per-unit cost is: `effective_cost = round(taxable_amount ÷ (quantity + free_quantity), 2)` where `taxable_amount` is the line value **after trade discount and excluding GST** — GST is excluded because it is recoverable as input credit and is not a cost of goods. | Service |
| `DR-FREE-04` | `effective_cost`, not `purchase_price`, is what is snapshotted onto `sale_items.cost_price_at_sale`. Every profit figure in the system derives from it. | Service |
| `DR-FREE-05` | Because `effective_cost` is rounded to the paisa, `effective_cost × (quantity + free_quantity)` can differ from `taxable_amount` by a few paise on high-count, low-value lines. This residue is **accepted and never redistributed**. The stock valuation report shows valuation at `effective_cost` and, where the difference matters, at invoice value, and states which is which. | Service |
| `DR-FREE-06` | If the same batch (`medicine_id`, `batch_no`, `expiry_date`) is received again on a later purchase at a different cost, the batch's `effective_cost` is recomputed as a **weighted average** over the existing on-hand quantity and the incoming quantity. Already-sold items keep the snapshot they were sold at; only future sales use the new figure. | Service |

Worked example: 10 strips charged at ₹80.00 each, 1 strip free, 10 percent trade discount, 12
percent GST.

```
gross            = 10 × 80.00              = 800.00
discount_amount  = 10% of 800.00           =  80.00
taxable_amount   = 800.00 − 80.00          = 720.00
gst_amount       = 12% of 720.00           =  86.40
line_total       = 720.00 + 86.40          = 806.40

quantity into stock = 10 + 1               = 11
effective_cost      = 720.00 ÷ 11          =  65.45   (not 80.00, and not 72.00)
```

Selling at ₹95.00 gives a true margin of ₹29.55 a strip, not the ₹15.00 the invoice rate would
have suggested.

---

## 8. Credit sales

| ID | Rule | Enforced at |
|---|---|---|
| `DR-CRED-01` | A credit sale requires a `customer_id`. A walk-in sale can never be on credit — there is nobody to bill. | Service |
| `DR-CRED-02` | Credit is blocked when `customer.outstanding_balance + this_bill_due > customer.credit_limit`. A customer whose `credit_limit` is 0 has no credit facility at all. | Service |
| `DR-CRED-03` | The check is performed **inside the sale's transaction**, against the current stored balance, not against a figure the browser was shown when the bill started. | Service |
| `DR-CRED-04` | An override requires the `sale.credit_override` permission (**admin only**) and is recorded in `sales.credit_override_by` plus an `audit_logs` row with `action = 'sale.credit_override'` carrying the limit, the balance, and the excess. | Service |
| `DR-CRED-05` | On commit, `customers.outstanding_balance` increases by `sales.due` via an arithmetic `UPDATE … SET outstanding_balance = outstanding_balance + :due`, never a read-modify-write. | Service |
| `DR-CRED-06` | A receipt (`customer_payments`, positive amount) decreases the outstanding balance by the same mechanism. A credit note from a return also decreases it, flagged `is_credit_note`. | Service |
| `DR-CRED-07` | `outstanding_balance` is a maintained aggregate, and it must always equal `Σ sales.due − Σ customer_payments.amount` for that customer. A `ledger:verify` check runs alongside `stock:verify` and reports any customer whose stored balance disagrees with the sum of their documents. | Service |
| `DR-CRED-08` | A partly-paid sale is `payment_status = 'partial'` with a `payments` row for the paid part (mode as tendered) and a second `payments` row of mode `credit` for the balance, so the payment lines always sum to the invoice total. | Service |
| `DR-CRED-09` | **Aging buckets** are computed from the invoice's due date — `sale_date + customer.payment_terms_days` where terms exist, otherwise `sale_date` — into `0–30`, `31–60`, `61–90`, `90+` days outstanding, on the unpaid balance of each invoice, not on the customer's net balance. A customer with one old invoice and one new payment must show the old money as old. | Service |
| `DR-CRED-10` | Receipts are applied oldest-invoice-first by default (FIFO settlement) unless the operator explicitly allocates against a named invoice. The allocation is recorded via `customer_payments.sale_id`. | Service |

Supplier payables mirror `DR-CRED-05` through `DR-CRED-10` against `suppliers.outstanding_balance`,
`purchases.due_amount`, and `supplier_payments`, with the same four aging buckets.

---

## 9. Returns

### 9.1 Sales returns (customer to shop)

| ID | Rule | Enforced at |
|---|---|---|
| `DR-RET-01` | **Every return line references an original `sale_item`.** `return_items.sale_item_id` is NOT NULL. There is no orphan return, no "return without bill" path, and no return against a medicine rather than against a line. | DB, Service |
| `DR-RET-02` | Return quantity may never exceed `sale_item.quantity − sale_item.returned_quantity`. The check is made inside the transaction with the sale item row read for update, so two simultaneous returns against one line cannot both pass. | Service |
| `DR-RET-03` | **Returned stock goes back into the same batch it left from** — `return_items.medicine_batch_id` is copied from the sale item, never re-selected by FEFO. This is the whole reason `sale_items.medicine_batch_id` is not nullable. | Service |
| `DR-RET-04` | Restocking writes a `sale_return` stock transaction with a **positive** `quantity_change` referencing the `return_item`. The batch's `quantity_available` rises accordingly, and a `finished` batch returns to `available` **only if `expiry_date > CURRENT_DATE`**. | Service |
| `DR-RET-05` | If the returned goods are expired (`condition = 'expired'`) or damaged (`condition = 'damaged'`), `restock` is `false`. No `sale_return` transaction is written into sellable stock; instead the goods are recorded into quarantine and the batch quantity is unaffected. Expired goods never rejoin sellable stock (`DR-EXP-09`). | Service, DB (CHECK) |
| `DR-RET-06` | The refund is either a `payments` row against the original sale with a **negative amount** and `is_refund = true` (cash, UPI, card reversal), or a credit note recorded in `customer_payments` with `is_credit_note = true` reducing the customer's outstanding balance. Never both. | Service, DB (CHECK) |
| `DR-RET-07` | Refund value is computed from the **original line's** figures — the same `unit_price`, the same proportional discount, the same `gst_rate` — not from today's prices. Tax on a return reverses at the rate it was charged at. | Service |
| `DR-RET-08` | On commit, `sale_items.returned_quantity` is increased, and `sales.status` becomes `partially_returned` or, when every line is fully returned, `returned`. The sale row itself is otherwise untouched. | Service |
| `DR-RET-09` | Returns require the `sale.return` permission — **pharmacist or admin. A cashier cannot process a return**, because a return is the easiest way to remove money from a drawer. | Request, Service |
| `DR-RET-10` | Returns are accepted within `settings['return.window_days']` (default 7) of the sale date. Beyond that window a pharmacist or admin may still accept with a recorded reason, logged as `sale.return_out_of_window`. | Service |
| `DR-RET-11` | A return is never edited or deleted. A wrong return is corrected by a fresh sale of the same goods, so both movements stay in the ledger. | Service |

### 9.2 Purchase returns (shop to supplier)

| ID | Rule | Enforced at |
|---|---|---|
| `DR-PRET-01` | A purchase return is always batch-specific and reduces that batch's quantity through a `purchase_return` transaction with a negative `quantity_change`. | Service |
| `DR-PRET-02` | Quantity returned may not exceed the batch's on-hand plus quarantined quantity. | Service |
| `DR-PRET-03` | A draft purchase return moves no stock. Only `confirmed` does. | Service |
| `DR-PRET-04` | Confirming reduces `suppliers.outstanding_balance` by the return's total (a debit note in our favour), or records a receivable where the account is already square. | Service |
| `DR-PRET-05` | Near-expiry returns are the point of the 90-day report: goods returned before expiry recover cost; goods written off after expiry recover nothing. The expiry report therefore shows the supplier and the last date their terms allow a return. | Service, UI |

---

## 10. Profit calculation

| ID | Rule | Enforced at |
|---|---|---|
| `DR-PROF-01` | Profit is computed **exclusively** from `sale_items.cost_price_at_sale`, the snapshot taken at the moment of sale. No profit query may join to `medicine_batches` for cost. | Service |
| `DR-PROF-02` | `cost_price_at_sale` is the batch's `effective_cost` (which already accounts for free goods and trade discount), not `purchase_price`. | Service |
| `DR-PROF-03` | Both sides of the margin exclude GST: revenue uses `taxable_amount`, cost uses `cost_price_at_sale`. GST is a pass-through, not income. | Service |
| `DR-PROF-04` | Returns reverse profit at the same `cost_price_at_sale` they were sold at — `return_items` carries its own copy for exactly this reason. | Service |
| `DR-PROF-05` | The profit report requires the `report.profit` permission — **admin only**. Cashiers and pharmacists cannot reach it, and the cost columns are stripped at the repository layer for their sessions, not merely hidden in the view. | Request, Repository |

Formulas:

```
line_gross_profit  = sale_items.taxable_amount − (sale_items.cost_price_at_sale × quantity)

line_returned      = return_items.taxable_amount
                     − (return_items.cost_price_at_sale × return_items.quantity)

gross_profit       = Σ line_gross_profit  −  Σ line_returned            (period)

gross_margin_pct   = gross_profit ÷ Σ taxable_amount × 100

net_profit         = gross_profit
                     − Σ expenses.amount                                (same period)
                     − Σ expiry write-off value                         (stock_adjustments /
                                                                         expiry_writeoff at
                                                                         effective_cost)
                     − Σ shrinkage value (damaged, theft adjustments)
```

Gross profit is what the counter earned. Net profit is what the shop kept. A pharmacy that
tracks only the first is usually surprised in March: expiry write-off and shrinkage are the two
lines that turn a healthy gross margin into a thin net one, which is precisely why they are
mandatory reason codes rather than free text.

> **Cave law:** Snapshot cost onto `sale_items`. History must not move when batch prices change.
> A profit report that changes its answer for last month because a new purchase arrived today is
> not a report.

---

## 11. Stock adjustment

| ID | Rule | Enforced at |
|---|---|---|
| `DR-ADJ-01` | An adjustment requires the `stock.adjust` permission — **admin only**. Not the pharmacist, not the cashier. | Request, Service, Policy |
| `DR-ADJ-02` | A **reason code is mandatory** and must be one of: `damaged`, `expired`, `theft`, `counting_error`, `sample`, `opening_stock`. There is no `other`, and there is no blank. | DB (CHECK), Service |
| `DR-ADJ-03` | A free-text `note` is also mandatory. A reason code says what kind of loss; the note says which shelf, which count, which incident. | DB (NOT NULL), Service |
| `DR-ADJ-04` | An adjustment is always against a specific batch. "We are four short" is meaningless until it says of which batch, because cost and expiry differ per batch. | DB, Service |
| `DR-ADJ-05` | Every adjustment writes a `stock_adjustments` row **and** a `stock_transactions` row of type `adjustment_add` or `adjustment_remove`, through `InventoryService` like every other movement. | Service |
| `DR-ADJ-06` | `opening_stock` is the reason code used once per batch when the system is first loaded with existing shelf stock. It writes an `opening_stock` transaction type, not `adjustment_add`, so opening balances are separable from later corrections in every report. | Service |
| `DR-ADJ-07` | An adjustment can never take `quantity_available` below zero. | DB (CHECK), Service |
| `DR-ADJ-08` | Every adjustment writes an `audit_logs` row (`action = 'stock.adjust'`) with before and after quantities and the rupee value at `effective_cost`. | Service |
| `DR-ADJ-09` | The shrinkage report groups adjustments by `reason_code` and period, valued at cost. A rising `counting_error` line means the process is wrong; a rising `theft` line means something else is. | Service |

> **Cave law:** One door for stock. `InventoryService` is the only writer of
> `stock_transactions`, and `quantity_available` changes only alongside such a row. No
> controller, job, seeder, factory, or "quick fix" tinker script writes a batch quantity
> directly.

---

## 12. Known traps and their mitigations

The seven things that bite, restated as binding rules. Each is a rule because each has bitten a
real pharmacy system before.

| # | Trap | Rule | Mitigation, and where it is enforced |
|---|---|---|---|
| 1 | Two cashiers sell the last strip in the same second | `DR-TRAP-01`: **Batch allocation happens under `SELECT … FOR UPDATE` inside the sale transaction, with locks taken in ascending `id` order in one statement.** | Decided and built in Phase 4, not patched in Phase 7. Enforced in `SalesService`/`InventoryService`; backstopped by `CHECK (quantity_available >= 0)`. Tested by a concurrency feature test that fires N simultaneous sales against a batch of N−1 units and asserts exactly one failure and a final quantity of zero. |
| 2 | Money kept in float, paise disappear, the accountant is angry | `DR-TRAP-02`: **Every money column is `numeric(12,2)`; every money calculation uses decimal arithmetic.** | No `float`, `real`, `double precision`, or PHP float maths anywhere in the money path. Enforced by the schema, by a static-analysis rule over migrations, and by a review checklist item. Rounding is explicit and half-up at each named step (§5.2). |
| 3 | Profit computed from today's batch price, so last month's profit changes when a new purchase lands | `DR-TRAP-03`: **`cost_price_at_sale` is snapshotted onto `sale_items` at sale time and is the only cost the profit report may use.** | `DR-PROF-01`. A profit query that joins `medicine_batches` for cost fails review. Tested by changing a batch's cost after a sale and asserting the profit report's answer is unchanged. |
| 4 | Invoice number from `count() + 1`, duplicates, GST problem | `DR-TRAP-04`: **Invoice numbers come from a locked read-and-increment on `invoice_counters`, keyed by (series, financial_year); `count()+1` and `MAX()+1` are forbidden.** | `02-database-schema.md` §10, plus `UNIQUE (sales.invoice_no)` as a backstop. A table row rather than a PostgreSQL sequence, because a sequence's `nextval` is not rolled back and would leave gaps in a legally numbered series. Tested by 1,000 concurrent sales asserting 1,000 distinct numbers. |
| 5 | Editing a saved sale, so stock lies | `DR-TRAP-05`: **Sales are stone. No edit, no delete.** Corrections are returns or cancellations that write reversing stock transactions. | No update route, no `deleted_at`, and only `status`/`payment_status`/`paid`/`due`/cancellation columns are ever written after commit — each through a Service and each audited. `stock_transactions` and `audit_logs` are additionally protected by an immutability trigger. |
| 6 | No timezone set, so reports are off by hours | `DR-TRAP-06`: **`Asia/Kolkata` is set in `config/app.php` on day one; all timestamps are `timestamptz`; every "today" boundary is computed in the shop's timezone.** | A sale at 11:30 pm IST belongs to that day's report, not to the previous UTC day. Tested by booking a sale at 23:55 IST and asserting it lands in the correct `daily_sales_summary` row. |
| 7 | Stock quantity kept in two places, so they drift | `DR-TRAP-07`: **One door.** `batch.quantity_available` is a cache of `SUM(stock_transactions.quantity_change)` for that batch and must always equal it. | Only `InventoryService` writes either. `php artisan stock:verify` proves the equality nightly and in CI; a mismatch fails the build and is investigated as a bug at the row where `balance_after` first disagrees. The command never "repairs" a number silently — a self-healing counter hides the defect that caused the drift. |

### The eight cave laws, as an index into this document

| Law | Stated in |
|---|---|
| 1. One door for stock | §11 `DR-ADJ-05`, §12 trap 7 |
| 2. Cashier never sees cost | §10 `DR-PROF-05`, `01-architecture.md` §3 |
| 3. Medicine holds no quantity, expiry, or price | `02-database-schema.md` §3, §4.2 |
| 4. FEFO with a row lock | §2, `DR-FEFO-01` … `DR-FEFO-08` |
| 5. Free goods count as quantity, not as cost | §7, `DR-FREE-01` … `DR-FREE-06` |
| 6. Snapshot cost onto `sale_items` | §10 `DR-PROF-01`, §12 trap 3 |
| 7. `quantity_available` equals the ledger sum | §12 trap 7, `01-architecture.md` §5 |
| 8. Sales are stone | §9 `DR-RET-11`, §12 trap 5, `02-database-schema.md` §4.4 |
