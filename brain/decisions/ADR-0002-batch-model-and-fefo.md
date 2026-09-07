# ADR-0002 — Quantity, expiry and price live on batches; allocation is FEFO

Purpose: record why stock attributes belong to `medicine_batches` rather than to `medicines`, and why allocation is First-Expiry-First-Out under a row lock rather than FIFO or a manual pick.

**Status:** Accepted
**Date:** 2026-08-24
**Deciders:** orchestrator, pharmacy-domain
**Supersedes:** none
**Related:** `brain/02-database-schema.md`, `brain/03-domain-rules.md` §2, ADR-0003, ADR-0005, cave laws 3 and 4

## Context

A pharmacy does not stock "Paracetamol 500". It stocks a box, from a particular manufacturer's
production run, bought on a particular supplier invoice at a particular price, carrying a
particular batch number and a particular expiry date. Two boxes of the same medicine on the same
shelf routinely differ in purchase price, in selling price, in MRP, and in how many months they
have left.

Four facts follow, and any design that ignores one of them produces a system the shop cannot
use:

1. **Expiry is per box, and it is money.** Stock that expires unsold is a direct loss, and it can
   often be returned to the supplier if it is spotted 90 days out. A system that cannot say
   *which* units expire when cannot produce that warning.
2. **Price moves with each purchase.** The same medicine bought twice in a quarter arrives at two
   costs and two MRPs. Billing must use the price of the box actually being dispensed, and
   profit must use the cost of that same box.
3. **Regulation is batch-level.** A recall names a batch number. An inspection asks which batch
   a specific customer received. A return must go back to the box it came from.
4. **A single sale line can span boxes.** Selling ten when the nearest-expiry box holds four is
   ordinary, not exceptional.

The question is where these attributes live, and by what rule the system decides which box to
dispense from.

## Decision

**`medicines` is the idea of a medicine. `medicine_batches` is the box on the shelf.**

`medicines` carries identity and policy: name, generic name, category, manufacturer, unit and
pack size, HSN code, GST rate, minimum stock level, prescription flag, barcode, rack location,
and *suggested* default prices. It carries **no quantity, no expiry date, no batch number, and
no effective price**. Not now and not in any later phase.

`medicine_batches` carries the physical reality: `medicine_id`, `batch_no`, `expiry_date`,
`purchase_price`, `effective_cost`, `selling_price`, `mrp`, `quantity_received`,
`quantity_available`, the `purchase_item_id` it arrived on, the supplier, and a status of
`available` / `expired` / `finished` / `quarantined`. Unique on
`(medicine_id, batch_no, expiry_date)`.

**Allocation is FEFO — First Expiry, First Out — inside a transaction, on rows read
`FOR UPDATE`:**

```sql
SELECT * FROM medicine_batches
WHERE medicine_id = ?
  AND quantity_available > 0
  AND expiry_date > CURRENT_DATE
  AND status = 'available'
ORDER BY expiry_date ASC, id ASC
FOR UPDATE
```

The requested quantity is consumed from that ordered list until it is satisfied, or
`InsufficientStockException` is thrown and **nothing is written**. Where the quantity spans more
than one batch, one `sale_items` row is written per batch slice: the customer sees one line on
the invoice, the database records two. Each slice carries its own `medicine_batch_id`, its own
`cost_price_at_sale`, and its own `stock_transactions` row.

The tie-break is `id ASC` — the older row wins — so that allocation is deterministic and
reproducible in tests when two batches share an expiry date.

## Consequences

### Positive

| Consequence | Why it matters here |
|---|---|
| Expiry loss becomes visible and preventable | The 90-day and 30-day dashboard alerts, and the supplier-return window, exist only because expiry is a column on a row with a quantity |
| Selling and cost prices are those of the actual goods | Billing is honest; profit is real; MRP is never exceeded, per box |
| Recall and inspection are answerable | "Which customers received batch A552?" is one join |
| Oldest-expiring stock leaves first, by default | The shop's largest avoidable loss is reduced by the system's normal behaviour, not by staff diligence |
| The last-unit race is resolved by the database | `FOR UPDATE` inside the transaction, with a re-check after the lock. `quantity_available` never reaches −1 |
| Free goods can be costed correctly | `effective_cost` is a per-batch column; cave law 5 has somewhere to live |

### Negative

| Consequence | What it costs, and how we live with it |
|---|---|
| Every sale line is batch-bound | The POS cannot simply decrement a medicine. Allocation is a service operation inside a transaction, always. This is the cost of correctness and it is paid on every sale |
| Multi-batch splits complicate everything downstream | Invoice rendering groups slices back into one visible line; returns operate per slice; reports must aggregate. Handled once, in `SalesService` and the invoice renderer, and tested by `MultiBatchSplitTest` |
| Returns must go back to the same batch | A return can never be credited to the current FEFO-nearest batch, because that box has a different cost and a different expiry. `sale_items.medicine_batch_id` exists precisely to make this possible, and `ReturnSameBatchTest` defends it |
| Batch proliferation | A shop with 3,000 medicines carries several thousand live batches, and dead batches accumulate. Mitigated by indexing on `(medicine_id, expiry_date)`, by a `finished` status, and by never deleting a batch that has ledger history |
| "Stock of a medicine" is always a SUM | Every stock display and every low-stock check aggregates across batches. Indexed, and summarised where it is hot |
| Row locks are held during allocation | Brief, but real. The transaction must stay short: no printing, no HTTP call, no queue dispatch inside it |

## Alternatives considered

### Quantity on `medicines`, with a separate expiry table

**The case for it.** Vastly simpler for the common case. `medicines.quantity_available` makes
stock display, low-stock checks, and the POS decrement trivial — no joins, no aggregation, no
allocation service. Expiry information can still be kept in a side table for the alerts that
need it.

**Why rejected.** The two numbers drift, and they drift silently. The moment quantity exists in
two places — the medicine total and the per-batch detail — every operation must update both,
every failure mode leaves them disagreeing, and nothing can tell you which one is right. Worse,
it does not actually solve the problem it appears to: to sell, you must still decide *which*
expiry you are consuming, so the side table needs its own quantity, and now there are three
numbers. Price has the same shape: a single price on `medicines` is either wrong for one of the
two boxes on the shelf, or it silently changes the value of stock already sold. This is
`CAVEMAN_DESIGN.md`'s "put quantity here and you cry in six months", and it is cave law 3
because it is the mistake most retail systems make.

### FIFO — first received, first out

**The case for it.** Conceptually simpler and matches standard inventory accounting. Received
order is a single monotonic column, and it never needs an expiry date to be correct. It is what
most general-purpose inventory systems implement.

**Why rejected.** Received order and expiry order are not the same order, and in pharmacy the
difference is money. Suppliers routinely ship stock with a shorter remaining life than stock
already on the shelf — short-dated goods, promotional lots, a slow-moving line restocked from a
different production run. FIFO would keep the newer, longer-dated box moving while the older,
shorter-dated one sat until it expired. FEFO minimises the quantity that reaches expiry, which
is the loss the shop actually suffers. FIFO's accounting tidiness is not a benefit here, because
cost is snapshotted per batch onto the sale line (cave law 6) rather than derived from a flow
assumption.

### Manual batch pick at the counter

**The case for it.** Maximum accuracy and maximum flexibility. The cashier sees the physical box
in hand and selects its exact batch, so the system's record matches reality even when someone has
taken a box from the back of the shelf. It also handles the genuine edge cases — a customer
requesting a specific batch, a box that has been physically moved.

**Why rejected.** It puts the slowest possible step in the fastest possible path. `brain/06`'s
keyboard contract targets a five-line bill in under 45 seconds; a batch-selection dropdown per
line, during the 11am rush, is where that budget dies. It also fails in the direction that costs
money: under pressure, staff pick the first or nearest option, which is the newest box at the
front of the shelf — the exact opposite of FEFO. The system would be accurate about the wrong
choice. Manual override is retained where it is genuinely needed — a pharmacist may override the
allocated batch, and the override is logged — but it is the exception, not the mechanism.

### Sell from a pooled quantity and assign batches at end of day

**The case for it.** Fastest possible POS: decrement a total, reconcile later in a batch job.

**Why rejected.** It makes the sale line's cost, and therefore the day's profit, unknowable at
the moment of sale; it breaks the recall and inspection query; and it makes the stock ledger a
reconstruction rather than a record. It is a variant of "quantity in two places" with the drift
deferred to a nightly job.

## Cave laws created or reinforced

| # | Law | Where it is enforced |
|---|---|---|
| 3 | Medicine holds no quantity, no expiry, no price | Absent from the `medicines` migration; an integrity test asserts the columns do not exist |
| 4 | FEFO with a row lock: `ORDER BY expiry_date ASC` inside a transaction using `SELECT … FOR UPDATE` | `AllocateFefoBatches`, `InventoryService::lockBatches()`; `FefoOrderTest`, `LastUnitRaceTest` |
| 5 | Free goods count as quantity, not as cost — store `effective_cost` on the batch | `medicine_batches.effective_cost`, written by `PurchaseService::confirm()` |
| 6 | Snapshot cost onto `sale_items` | `cost_price_at_sale`, written per batch slice |

## Revisit conditions

- The shop begins dispensing loose units in a way that makes a batch's `quantity_available`
  fractional (Q-001) — the model holds, but the column types change.
- A statutory requirement appears to dispense strictly by a rule other than expiry.
- Batch counts grow far beyond the several thousand assumed, such that the allocation query's
  index strategy needs revisiting.
