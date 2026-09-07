# METAPHARSIC PHARMACY — CAVEMAN DESIGN SCROLL

Ugg. Me draw plan on cave wall. Laravel 12. PHP 8.3. Postgres. Me go part by part, then me go phase by phase.

---

## PART 0 — BONES OF HUT (foundation)

**What it do:** hold everything else up.

- Laravel 12 project. Postgres database. `.env` hold secret.
- Every table have `id` (bigint), `created_at`, `updated_at`. Money table also have `created_by` (who did it).
- Money never float. Money is `decimal(12,2)`. Float lie. Float make rupee disappear.
- Quantity is integer. Half tablet problem? Then quantity `decimal(10,3)`. Pick now, not later.
- Soft delete on master table (medicine, customer, supplier). Never soft delete on sale. Sale is stone. Sale never move.
- Every table that touch stock get index on the column you search: `medicine_id`, `expiry_date`, `batch_no`.

**Cave law #1:** stock only change through one door. That door is `stock_transactions`. No controller touch quantity by hand. Ever.

---

## PART 1 — WHO ENTER CAVE (auth, users, roles)

**Tables:** `users`, `roles`, `permissions`, `role_user`, `permission_role`, `login_logs`

- `users`: name, email, password, role_id, is_active, last_login_at
- `roles`: admin, pharmacist, cashier
- `permissions`: string key like `sale.create`, `sale.delete`, `purchase.create`, `report.profit`, `stock.adjust`

**Who allowed do what:**

| Thing | Admin | Pharmacist | Cashier |
|---|---|---|---|
| Sell medicine | yes | yes | yes |
| Give discount over 10% | yes | yes | no |
| Cancel/return sale | yes | yes | no |
| Add purchase | yes | yes | no |
| Adjust stock | yes | no | no |
| See profit report | yes | no | no |
| Make user | yes | no | no |

**Cave law #2:** cashier never see purchase price. Cashier see selling price only. Hide it in the query, not just in the blade.

Use Laravel Gate + policy. One middleware `can:sale.create`. Done.

---

## PART 2 — MEDICINE BOOK (master data)

**Tables:** `categories`, `manufacturers`, `medicines`, `units`

`medicines` is the *idea* of medicine. Not the box on shelf.

- name, generic_name, brand, category_id, manufacturer_id
- unit (strip / bottle / tablet / tube), pack_size
- hsn_code, gst_rate (0 / 5 / 12 / 18)
- default_purchase_price, default_selling_price  ← only *suggestion*
- min_stock_level, rack_location
- is_prescription_required (bool) ← Schedule H medicine
- barcode (nullable, unique when not null)
- is_active

**Cave law #3:** medicine table have NO quantity column. NO expiry column. NO batch column. Those live in batch. Put quantity here and you cry in six month.

---

## PART 3 — BATCH (the real box on shelf)

**Table:** `medicine_batches`

- medicine_id, batch_no, expiry_date (date)
- purchase_price, selling_price, mrp  ← price live HERE, price change every purchase
- quantity_received, quantity_available
- purchase_item_id (where it come from), supplier_id
- unique index: (medicine_id, batch_no, expiry_date)

**Batch state:** available / expired / finished / quarantined (returned to supplier, do not sell)

**Cave law #4 — FEFO:** when sell, pick batch with nearest expiry first.

```
SELECT * FROM medicine_batches
WHERE medicine_id = ?
  AND quantity_available > 0
  AND expiry_date > CURRENT_DATE
ORDER BY expiry_date ASC, id ASC
FOR UPDATE            -- lock row, two cashier no fight
```

If one batch not enough → split line across two batch. Sale item row per batch. Customer see one line on invoice, database see two. That correct.

---

## PART 4 — BRING MEDICINE IN (purchase)

**Tables:** `suppliers`, `purchases`, `purchase_items`, `supplier_payments`

`purchases`: supplier_id, invoice_no, invoice_date, subtotal, discount, gst_amount, total, paid_amount, due_amount, status (draft/confirmed/cancelled)

`purchase_items`: purchase_id, medicine_id, batch_no, expiry_date, quantity, free_quantity, purchase_price, mrp, selling_price, gst_rate, line_total

**What happen when press CONFIRM:**

```
begin transaction
  for each item:
      find or create medicine_batch (medicine + batch_no + expiry)
      batch.quantity_available += quantity + free_quantity
      write stock_transaction (type = purchase, +qty, ref = purchase_item)
  supplier.outstanding += due_amount
commit
```

Draft purchase touch nothing. Confirmed purchase move stock. Cancel confirmed purchase = write *reverse* stock transaction, never delete old row.

**Cave law #5:** free goods (10+1 scheme) go into quantity but cost zero. That make your true cost per tablet lower. Store `effective_cost = line_total / (quantity + free_quantity)` on the batch. Profit report thank you later.

---

## PART 5 — SELL MEDICINE (POS — the heart)

**Tables:** `customers`, `sales`, `sale_items`, `payments`, `prescriptions`

`sales`: invoice_no, customer_id (nullable = walk-in), user_id, sale_date, subtotal, discount, gst_amount, round_off, total, paid, due, payment_status, status (completed/returned/partially_returned)

`sale_items`: sale_id, medicine_id, **medicine_batch_id**, quantity, unit_price, discount, gst_rate, gst_amount, line_total, **cost_price_at_sale**

**Cave law #6:** copy `cost_price_at_sale` onto the sale item. Do not join to batch later for profit. Batch price change. History must not change.

**Screen — POS need be fast. Keyboard only.**

```
[ search box: type name / scan barcode ]  F2 = new customer   F4 = payment   F9 = hold bill
------------------------------------------------------------------
 Medicine        Batch    Exp     Qty   Rate   Disc   GST    Amount
 Paracetamol     B1024    03/27    2    12.00   0%    12%    26.88
 Amoxicillin ℞   A552     11/26    1    88.00   5%    12%    93.68
------------------------------------------------------------------
              Subtotal 120.00   Disc 4.40   GST 14.96   TOTAL 130.00
              [ CASH ]  [ CARD ]  [ UPI ]  [ SPLIT ]  [ CREDIT ]
```

- Type 3 letter → dropdown. Arrow key. Enter. Quantity. Enter. Next line. Mouse is for weak hunter.
- ℞ mark show red if `is_prescription_required`. Cannot finish bill until prescription number entered or pharmacist override (and override get logged).
- Warn yellow if batch expire inside 90 day. Block hard if expired.
- Hold bill / recall bill. Customer forget wallet, go car. Bill wait.

**What happen when press SAVE:**

```
begin transaction
  lock batches (SELECT ... FOR UPDATE)
  re-check quantity + expiry     -- screen data is old, database is truth
  create sale
  for each line:
      allocate FEFO across batch
      create sale_item(s)
      batch.quantity_available -= qty
      stock_transaction (type = sale, -qty, ref = sale_item)
  create payment row(s)
  if credit: customer.outstanding += due
  invoice_no = atomic counter, per financial year  (PHARM/26-27/00042)
commit
then print
```

Print only after commit. Print fail is small problem. Half-saved sale is big problem.

---

## PART 6 — MEDICINE COME BACK (returns)

**Tables:** `returns`, `return_items`  (also `purchase_returns` to supplier)

- Return always point at original sale_item. No orphan return.
- Return quantity never more than sold quantity minus already returned.
- Return put stock BACK into **same batch** it came from. That why sale_item store batch_id.
- Expired medicine come back from customer → do NOT return to sellable stock. Goes to batch state `quarantined`, then purchase_return to supplier.
- Refund is a `payments` row with negative amount, or credit note on customer account.

---

## PART 7 — STOCK LEDGER (the truth keeper)

**Table:** `stock_transactions` — append only. Never update. Never delete.

- medicine_id, medicine_batch_id, type, quantity_change (+/-), balance_after
- reference_type + reference_id (polymorphic: purchase_item, sale_item, return_item, adjustment)
- user_id, note, created_at

**type:** purchase, sale, sale_return, purchase_return, adjustment_add, adjustment_remove, expiry_writeoff, transfer_in, transfer_out, opening_stock

**Cave law #7:** `batch.quantity_available` must always equal `SUM(quantity_change)` for that batch. Write a nightly command `php artisan stock:verify` that check every batch and shout when number not match. That command catch bug before customer catch bug.

Stock adjustment screen need mandatory reason: damaged / expired / theft / counting error / sample. Admin only.

---

## PART 8 — MONEY OWED (customers & suppliers)

- `customers`: name, phone (index it, you search by phone 100 time a day), address, doctor_name, credit_limit, outstanding_balance
- Credit sale blocked when outstanding + this bill > credit_limit, unless admin override.
- `supplier_payments` and `customer_payments`: date, amount, mode, reference_no, against which invoice.
- Aging report: 0-30 day, 31-60, 61-90, 90+. Old money is dead money.

---

## PART 9 — CAVE WALL PAINTINGS (dashboard)

Top row big number, today:

`Sales ₹` · `Bills count` · `Purchases ₹` · `Gross profit ₹` · `Cash in drawer`

Then four red-alert box:

1. **Expiring in 30 day** — count + value at risk (this one save real money, put it first)
2. **Expiring in 90 day** — time still there to return to supplier
3. **Below min stock** — order today
4. **Payment due** — customer owe you, you owe supplier

Then chart: sale last 30 day, top 10 medicine this month.

**Cave law #8:** dashboard query hit big table. Cache 5 minute, or make summary table `daily_sales_summary` filled by nightly job. Do not make dashboard slow the whole shop at 11am rush.

---

## PART 10 — COUNTING STONES (reports)

Every report: date range + export CSV/PDF + print.

- Sales — daily / monthly, by user, by payment mode
- Purchase — by supplier, by date
- **Profit** — `SUM(line_total - cost_price_at_sale*qty)` per medicine, per day, per category. Admin only.
- Stock — current, batch-wise, valuation at cost and at MRP
- Expiry — window picker (30/60/90/180 day), with supplier so you know who to call
- Fast/slow mover — what sell, what sleep on shelf eating your money
- GST — output tax from sales, input tax from purchases, split by rate slab (0/5/12/18), HSN summary
- Customer / Supplier ledger statement

---

## PART 11 — REMEMBER EVERYTHING (audit)

**Table:** `audit_logs` — user_id, action, model_type, model_id, old_values (jsonb), new_values (jsonb), ip_address, created_at

Postgres `jsonb` good here. Can query inside it.

Watch these hard: sale edit, sale delete, discount above limit, price change, stock adjustment, user permission change, login and failed login.

Pharmacy is regulated. Inspector come. You show him log, he go away happy.

---

## PART 12 — SHARP TOOLS (extras)

- Barcode: scanner is just keyboard. It type digits then Enter. No driver needed. Search medicine by barcode → auto-add to cart.
- Thermal print 80mm: separate blade layout, CSS `@media print`, page width 80mm.
- Backup: `pg_dump` nightly by cron, keep 30 day, copy off the shop computer. Untested backup is not backup — restore it once and see.
- Drug interaction / allergy warning — nice-to-have, later, needs a data source.

---

# 🔥 PHASES — ORDER OF HUNT

Each phase end with thing that WORK. Not half thing.

### PHASE 1 — MAKE FIRE (week 1)
Laravel 12 install · Postgres connect · Breeze auth · roles + permissions + gate · user CRUD · login log · base layout with sidebar · every future migration written with the money/quantity rules from Part 0.
**Done when:** admin login, make cashier, cashier login and see empty dashboard, cashier cannot open user page.

### PHASE 2 — NAME THE THINGS (week 2)
Category · Manufacturer · Medicine (with search, GST, min stock, ℞ flag) · Supplier · Customer · CSV import for medicine (you have 3000 medicine, you not typing them).
**Done when:** you import your real medicine list and search it fast.

### PHASE 3 — FILL THE SHELF (week 3–4)
Purchase entry with line items · batch auto-create · `stock_transactions` ledger · inventory list batch-wise · stock adjustment · opening stock entry · low stock and expiry list · `stock:verify` command.
**Done when:** you enter a real supplier bill and stock numbers are right, and reversing it puts them back.

### PHASE 4 — TRADE (week 5–7) ← the big one
POS screen, keyboard-driven · FEFO allocation with row locking · discount and GST math · ℞ block · payment cash/card/UPI/split/credit · invoice number series · A4 and 80mm print · hold/recall bill · returns and refunds.
**Done when:** you run one full real day on it in parallel with your old way, and totals match at closing.

### PHASE 5 — READ THE BONES (week 8–9)
Dashboard with alerts · all reports from Part 10 · GST report · customer/supplier ledger and aging · audit log viewer.
**Done when:** you can close the month from the software alone.

### PHASE 6 — MAKE STRONG (week 10+)
Barcode · thermal printer tuning · nightly backup + tested restore · role fine-tuning after real use · deploy (nginx + php-fpm + supervisor + daily cron) · train staff · offline-safe plan for when internet die.
**Done when:** shop run on it, and you sleep.

---

## THINGS THAT BITE CAVEMAN LATER

1. Two cashier sell last strip same second → **row lock in transaction**, decided in Phase 4, not patched in Phase 7.
2. Money in float → wrong paise → angry accountant. `decimal(12,2)`, always.
3. Profit computed from today's batch price → history change every purchase. Snapshot cost on sale_item.
4. Invoice number from `count()+1` → duplicate invoice → GST problem. Use dedicated counter row with lock, or Postgres sequence per year.
5. Editing a saved sale → stock lie. Do not allow edit. Allow only return/cancel with reverse transaction.
6. No timezone set → reports off by hours. Set `Asia/Kolkata` in `config/app.php` on day one.
7. Stock quantity kept in two places → they drift. One door: `stock_transactions`.

---

Ugg finish. Me ready build Phase 1 when you say word.
