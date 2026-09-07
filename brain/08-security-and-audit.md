# Security and Audit

Purpose: who may do what, how it is enforced, what is recorded, and which regulatory duties the
system must satisfy.

The threat model is a small shop on a LAN: a shared counter terminal, three or four staff, no
public internet exposure, and a regulator who may ask for records years later. Nothing here
assumes a hostile internet; everything here assumes ordinary human pressure — a busy counter, a
borrowed login, a discount given to a friend.

## 1. Authentication

**Laravel Breeze** (Blade stack) provides login, logout, password reset, and password
confirmation. Fortify is not added on top; Breeze's published controllers are edited directly
so the auth path stays readable in this repository. ADR-0001 covers the platform choice.

| Setting | Value | Reason |
|---|---|---|
| Session driver | `database` | Sessions must survive a php-fpm restart mid-shift, and an admin must be able to kill a session |
| `SESSION_LIFETIME` | 480 minutes (one full shift) | Re-typing a password at the counter during a rush is how passwords end up on sticky notes |
| `SESSION_EXPIRE_ON_CLOSE` | `true` | Closing the browser ends the shift |
| Idle screen lock | 10 minutes of no input | See below |
| Password minimum | 10 characters, uncompromised check off (no outbound internet), no composition rules | Length beats character classes; the machine cannot reach the HIBP API |
| Failed-login lockout | 5 attempts per username+IP, 15-minute lockout, escalating to 60 minutes after three lockouts | Slows guessing without letting one typo-prone cashier be locked out all afternoon |
| Remember me | Disabled on shared terminals | A "remember me" cookie on the counter machine is an unattended login |
| Password confirmation | Required before user management, permission changes, and settings changes | Re-proves the person at an unlocked terminal |

**Idle lock**: after 10 minutes without input, an opaque overlay covers the screen and the
current user must re-enter their password to continue. The session is not destroyed and the POS
cart is not lost — a cashier who steps away must not lose a half-built bill, or they will stop
locking. After 60 minutes locked, the session is destroyed and any cart is auto-held.

**Login logging**: every attempt, successful or not, writes a `login_logs` row (user or
attempted username, IP, user agent, outcome, timestamp). Successful logins also stamp
`users.last_login_at`. Visible at `audit.logins`.

Users are deactivated, never deleted. `is_active = false` blocks login at the
`verified.active` middleware and immediately invalidates existing sessions for that user.

> **Cave law:** every user is a real person with their own login. Shared accounts, a "counter"
> login, or a password written by the till destroy the audit trail — after which every rule in
> this document is decorative.

## 2. Authorization

Three layers, all of which must agree:

1. **Route middleware** — `can:permission.key` on every route group. The coarse gate.
2. **Policies** — per-model, for the questions that depend on state rather than on role: a
   confirmed purchase cannot be edited, a cancelled sale cannot be returned, a return cannot
   exceed the quantity sold, a user cannot deactivate themselves.
3. **Query scoping** — the data a role may not see is not selected. See section 2.3.

Gates are registered from the seeded permission table in `AuthServiceProvider`, with a `before`
callback that grants an admin everything *except* nothing — admins genuinely hold all keys —
and that hard-denies four keys to non-admins regardless of the runtime grid:
`stock.adjust`, `report.profit`, `role.permission`, `user.create`.

### 2.1 Permission matrix by role

Defaults seeded by `RoleAndPermissionSeeder`. The grid is editable at runtime by an admin
through `roles.permissions.update`, and every change is audited.

| Module / action | Admin | Pharmacist | Cashier |
|---|---|---|---|
| `dashboard.view` | yes | yes | yes (without profit and cost tiles) |
| `medicine.view` | yes | yes | yes |
| `medicine.create` / `.update` | yes | yes | no |
| `medicine.delete` / `.import` | yes | no | no |
| `category.*`, `manufacturer.*`, `unit.*` (view) | yes | yes | yes |
| `category.create/update/delete`, `manufacturer.*`, `unit.manage` | yes | yes | no |
| `supplier.view` | yes | yes | no |
| `supplier.create` / `.update` | yes | yes | no |
| `supplier.delete` | yes | no | no |
| `supplier.ledger` / `.payment` | yes | yes | no |
| `customer.view` / `.create` / `.update` | yes | yes | yes |
| `customer.delete` | yes | no | no |
| `customer.ledger` | yes | yes | no |
| `customer.credit_limit` | yes | no | no |
| `customer.credit_override` | yes | no | no |
| `purchase.view` / `.create` / `.update` | yes | yes | no |
| `purchase.confirm` | yes | yes | no |
| `purchase.cancel` | yes | no | no |
| `purchase_return.view` / `.create` | yes | yes | no |
| `inventory.view` | yes | yes | yes (quantities only, no cost or valuation) |
| `inventory.ledger` | yes | yes | no |
| `inventory.verify` | yes | yes | no |
| `inventory.price_change` | yes | yes | no |
| `inventory.quarantine` | yes | yes | no |
| `stock.adjust` | **yes (admin only, hard)** | no | no |
| `stock.opening` | yes | no | no |
| `stock.writeoff` | yes | yes | no |
| `sale.create` | yes | yes | yes |
| `sale.view` | yes | yes | own sales only |
| `sale.void` | yes | yes | no |
| `sale.discount_override` (above 10%) | yes | yes | no |
| `sale.prescription_override` | yes | yes | no |
| `return.view` / `.create` | yes | yes | no |
| `payment.receive` | yes | yes | yes |
| `payment.refund` | yes | yes | no |
| `report.view` | yes | yes | no |
| `report.sales` | yes | yes | no |
| `report.purchase` | yes | yes | no |
| `report.profit` | **yes (admin only, hard)** | no | no |
| `report.stock` / `.expiry` / `.movers` | yes | yes | no |
| `report.valuation` (shows cost) | yes | no | no |
| `report.gst` | yes | yes | no |
| `report.aging` | yes | yes | no |
| `audit.view` / `.logins` / `.export` | yes | no | no |
| `settings.view` / `.update` / `.backup` | yes | no | no |
| `user.view` / `.create` / `.update` / `.deactivate` / `.reset_password` | yes | no | no |
| `role.view` / `.permission` | **yes (admin only, hard)** | no | no |

This matrix is the maintained copy; `brain/05-routes-and-modules.md` carries the key list and
the route mapping, and does not repeat the grid.

### 2.2 Cashier restrictions worth naming

- A cashier sees `sales.index` filtered to their own `user_id` — enough to reprint a bill they
  just made, not enough to browse a colleague's day.
- A cashier may create a customer (needed at the counter) but never change a credit limit.
- A cashier may not give a discount above 10%; attempting it opens an override prompt requiring
  a pharmacist or admin credential, and the override is audited with both user ids.
- A cashier may not complete a bill containing a Schedule H line without a prescription number
  or a logged pharmacist override.

### 2.3 Cost data is filtered at the query layer

> **Cave law:** cost never reaches a cashier's browser. `purchase_price`, `effective_cost`, and
> `cost_price_at_sale` are excluded by the `SELECT`, not by a Blade `@can`. A hidden column in
> a rendered page is still a disclosed column in the response body.

Mechanics:

- `MedicineBatch`, `SaleItem`, and `PurchaseItem` expose a `withoutCost()` scope naming the
  permitted columns explicitly. Every POS endpoint and every cashier-reachable list uses it.
- The models' `$hidden` arrays include the cost attributes as a second line of defence, so an
  accidental `toJson()` on a fully-loaded model still does not leak. `$hidden` is the belt; the
  scope is the trousers.
- Valuation and profit reports are the only places cost is selected, and both sit behind
  admin-only keys.
- Test 9 in `brain/07-testing-strategy.md` iterates every cashier-reachable route and asserts
  the raw response body contains none of those strings. A new route that leaks cost fails CI.

## 3. `audit_logs`

One table, `audit_logs`, append-only:

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | |
| `user_id` | bigint, nullable | Null only for system actions (scheduler, console). Never deleted — users are deactivated, not removed |
| `action` | varchar | Stable dotted verb: `sale.void`, `discount.override`, `batch.price_changed`, `stock.adjusted`, `role.permission_changed`, `auth.login`, `auth.login_failed`, `prescription.overridden` |
| `model_type` / `model_id` | varchar / bigint, nullable | Polymorphic target |
| `old_values` | `jsonb`, nullable | Only the changed keys, not the whole row |
| `new_values` | `jsonb`, nullable | Same |
| `context` | `jsonb`, nullable | Reason text, approving user id for overrides, invoice number, route name |
| `ip_address` | inet | The LAN address of the terminal |
| `user_agent` | varchar, nullable | |
| `created_at` | timestamptz | `Asia/Kolkata` at display, stored with zone |

`jsonb` and not `json`: values are queried, not just stored — "every price change on medicine
712 last quarter" is a GIN-indexed containment query, not a full scan. GIN indexes on
`old_values` and `new_values`, b-tree on `(model_type, model_id)`, `(user_id, created_at)`, and
`(action, created_at)`.

### Watched events

| Event | Action key | Captured beyond old/new |
|---|---|---|
| Sale void / cancellation | `sale.void` | Invoice number, reason text (mandatory), reversing transaction ids |
| Discount above the 10% threshold | `discount.override` | Requesting user, approving user, percentage, line or bill scope |
| Selling price or MRP change on a batch | `batch.price_changed` | Batch, medicine, both prices |
| Stock adjustment | `stock.adjusted` | Batch, `AdjustmentReason`, quantity delta, mandatory note |
| Expiry write-off / quarantine | `batch.written_off`, `batch.quarantined` | Batch, quantity, value at cost |
| Permission or role change | `role.permission_changed`, `user.role_changed` | Target user or role, keys added and removed |
| User created / deactivated / password reset by admin | `user.created`, `user.deactivated`, `user.password_reset` | Acting admin |
| Login, logout, failed login | `auth.login`, `auth.logout`, `auth.login_failed` | Attempted username on failure; never the password, not even hashed |
| Prescription override on a Schedule H sale | `prescription.overridden` | Medicine, sale, approving pharmacist, reason |
| Credit limit change and credit-limit override | `customer.credit_limit_changed`, `credit.overridden` | Old and new limit, or outstanding and shortfall |
| Purchase confirm and cancel | `purchase.confirmed`, `purchase.cancelled` | Supplier, invoice number, total |
| Settings change (GSTIN, licence numbers, invoice series) | `settings.updated` | Keys changed |
| Backup run and restore | `backup.completed`, `backup.restored` | Outcome, size, target |

Writing is centralised: model observers registered in one provider, plus explicit
`AuditService::record()` calls for the events that are not a model save (login, override
approval). No module decides for itself whether to audit.

> **Cave law:** `audit_logs` is append-only. There is no update path, no delete path, and no
> route under `/audit` that writes. The database role the application connects as holds only
> `INSERT` and `SELECT` on that table; `UPDATE` and `DELETE` are revoked, so even a bug cannot
> rewrite history.

**Retention:** audit rows are kept **eight years**, matching the longest record-retention duty
in section 5 plus a margin. Nothing is pruned automatically; if the table ever needs
management, rows older than eight years are moved to a dated archive table and dumped, never
dropped. `login_logs` is separate and kept two years.

Audit rows are included in the nightly backup and are covered by the restore drill in
`brain/09-deployment.md`. An audit trail that is not backed up is not an audit trail.

## 4. Data protection

**What is stored about a customer:** name, phone (indexed — it is the primary lookup),
optional address, optional doctor name, credit limit, outstanding balance, sale history, and
prescription numbers with the prescribing doctor's name.

**What is deliberately not stored:** no diagnosis, no clinical note, no scanned prescription
image, no email marketing list, no date of birth, no government identity number (no Aadhaar, no
PAN) for retail customers, and no payment card data whatsoever — card payments are captured on
the bank's own terminal and only the mode, amount, and the terminal's reference number are
recorded.

Rules:

- Prescription details are recorded because the law requires the record, and for no other
  purpose. They are not used for analytics, and the customer-facing reports do not aggregate by
  medicine and named person.
- Customer records are soft-deleted, never hard-deleted, because sale history must remain
  resolvable. A deletion request is honoured by anonymising the party record (name and phone
  replaced with a tombstone) while leaving the invoice rows intact, since tax records may not
  be destroyed on request.
- Exports (CSV, PDF) that contain customer names are permission-gated and their generation is
  audited. Report exports write to a temp path and are deleted after download.
- Backups are encrypted at rest with `age` or GPG using a key held **off** the shop machine.
  An unencrypted dump on a USB stick in a drawer is the most likely real breach in this
  system's life. Keys are never stored in the repository or in `.env`.
- `.env` is `0600`, owned by the deploy user, and never committed. Rotating `APP_KEY` breaks
  every encrypted column and every session; it is a documented incident procedure, not a
  routine.
- Logs must not contain PII or secrets. Request logging excludes `password`,
  `password_confirmation`, and `_token`; `LOG_LEVEL` is `warning` in production.

## 5. Regulatory duties

Indian retail pharmacy. This section states what the software must make possible; it is not
legal advice, and the shop's own licence conditions prevail where they are stricter.

### Schedule H / H1 record keeping

- Every medicine flagged `is_prescription_required` requires, at sale, a prescription number,
  the prescribing doctor's name, and the patient (customer) record — or an explicit pharmacist
  override that is audited with a reason.
- Schedule H1 drugs additionally require a bound, separate register: the system supports this
  by producing a dated H1 register report (drug name, quantity, patient name and address,
  doctor's name, prescription date) that can be printed and pasted or transcribed into the
  physical register, and by retaining the same data in `prescriptions`.
- The prescription number appears on the invoice — A4 and thermal both.
- H1 register data is retained **three years**; the system's eight-year audit retention covers
  it comfortably.

### GST invoice mandatory fields

Every tax invoice carries: supplier (shop) name, address, and **GSTIN**; a consecutive invoice
number unique within the financial year; date of issue; recipient name and address, plus
recipient GSTIN where registered; **HSN code per line**; description, quantity, unit, and
taxable value per line; the **tax rate and amount split into CGST and SGST** (IGST for
inter-state); total tax; total invoice value; whether tax is payable on reverse charge; and a
signature or digital signature line. The GST summary is presented per rate slab (0/5/12/18).
Layout is specified in `brain/06-ui-conventions.md`; the numbers come from the GST service
tested by test 10 in `brain/07-testing-strategy.md`.

Invoice numbers are consecutive per financial year with no gaps, which is why they come from a
locked counter and not from `count() + 1` — ADR-0006. A voided sale keeps its number and is
marked cancelled; the number is never reissued.

### Drug licence

The retail drug licence numbers (Form 20B / 21B, and 20/21 where applicable) are printed on
every invoice and receipt, alongside the registered pharmacist's name and registration number.
They are stored in shop settings, and a change to them is an audited event — an invoice printed
with the wrong licence number is a compliance problem, not a typo.

### Retention summary

| Record | Retain |
|---|---|
| Sales invoices, purchase invoices, credit and debit notes | 8 years (GST: 72 months from the annual return due date; 8 years is the safe round-up) |
| Prescription records / Schedule H and H1 register data | 3 years minimum; kept 8 for consistency |
| Stock ledger (`stock_transactions`) | 8 years — it is the evidence behind every stock figure on a filed return |
| `audit_logs` | 8 years |
| `login_logs` | 2 years |
| Backups | 30 days rolling, plus a monthly copy kept 12 months |

> **Cave law:** nothing in the sales, purchase, prescription, stock-ledger, or audit tables is
> ever deleted by application code. No cleanup job, no admin screen, no "tidy old data" button.
> Corrections are new rows that reverse old ones.

## 6. Threat notes for a shop LAN

The server is not exposed to the internet: nginx binds to the LAN interface, the firewall
(`ufw`) allows 80/443 and SSH from the LAN only, and PostgreSQL listens on localhost. That
removes most of the internet threat model and leaves the ones that actually happen in shops.

| Threat | What it looks like | Control |
|---|---|---|
| **Shared terminal** | A cashier walks away logged in; the next person bills, discounts, or looks up a customer as them | Individual logins, 10-minute idle lock, 8-hour session cap, password confirmation before sensitive actions, every action carrying `user_id`. The audit trail names a person because the login named a person |
| **Borrowed credentials** | "Just use my login, I'll approve it" — especially for discount and prescription overrides | Overrides require the approver's password at the moment of approval and record both the requesting and the approving user id. Login logs make a pharmacist's account active at the counter while they are on leave visible |
| **USB scanner injection** | A barcode scanner is a keyboard. A crafted barcode can type arbitrary characters, including function keys or a URL | Barcode input is accepted only as digits and is length-validated before lookup; anything else is ignored. Nothing scanned is evaluated, rendered as HTML, or used to build SQL. The POS binds its shortcut keys itself and ignores unexpected control sequences. Physically, scanners are configured to prefix/suffix a known sentinel so injected keystrokes are distinguishable from a real scan |
| **Insider stock shrinkage** | Stock leaves without a sale, then an "adjustment — counting error" hides the gap | `stock.adjust` is admin-only and can never be granted to another role. Every adjustment demands an `AdjustmentReason` and a note, and is audited. The stock ledger is append-only, so the removal is always visible even after the balance is corrected. Adjustment-frequency-by-user and adjustment-value-by-reason are standing report views, and the dashboard flags any batch adjusted more than once in a month |
| **Sale deleted to pocket cash** | Bill printed, cash taken, sale removed | Sales are immutable (ADR-0005): no edit route, no delete route, no `UPDATE`/`DELETE` grant that would allow it quietly. A void writes a reversing transaction and an audit row with a mandatory reason, and voids-by-user is a report |
| **Price manipulation** | Selling price on a batch quietly lowered for a friend, then restored | `inventory.price_change` is audited with both values; the profit report shows the margin dip against the snapshot cost regardless |
| **Silent ledger corruption** (bug or tampering) | Batch balance no longer matches its transactions | `stock:verify` nightly and in CI; a mismatch alerts the owner the next morning. There is no `--fix` |
| **Database access outside the app** | Someone with `psql` edits a row directly | The application's database role holds no `UPDATE`/`DELETE` on `stock_transactions`, `audit_logs`, or `sales`. Superuser access is the owner's alone, and the nightly backup gives a before-picture to compare against |
| **Lost or stolen machine / drive** | The shop computer walks | Full-disk encryption on the server, encrypted backups, and no card data stored to lose |
| **Backup that never worked** | The one day it is needed, it does not restore | The restore drill in `brain/09-deployment.md`, run quarterly, result recorded |

What the audit trail does about all of these is the same thing: it makes the action attributable
and non-repudiable after the fact. It does not prevent anything. Prevention here is the
permission matrix and the immutability rules; the audit trail is what makes the prevention
enforceable when someone tests it.
