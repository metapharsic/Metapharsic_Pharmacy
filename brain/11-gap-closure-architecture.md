# Gap Closure Architecture — Phase 8

**Phase**: Phase 8 — Gap Closure
**Status**: Planned (not yet started)

---

## 1. Why & Scope

Anonymized competitive research against established competitor pharmacy software (vendor
names withheld per project convention — no vendor name appears anywhere in this or any
other `brain/` doc) surfaced five feature gaps in the current build. This document is the
architecture for closing exactly those five, prioritized as given, no more:

1. Scheme/offer engine (buy-N-get-N, slab discounts)
2. Prescription image/scan attach
3. Separate Doctor master
4. Fast/slow-mover as a standalone report page
5. Drug license number + renewal reminder (shop-level compliance)

Nothing else is in scope for Phase 8. If work here surfaces adjacent gaps, they go in
`brain/state/BACKLOG.md`, not into this phase.

---

## 2. Gap 1 — Scheme / Offer Engine

**Problem**: `DiscountPolicy` only supports a flat bill-level percentage discount. No
buy-N-get-N ("buy 2 get 1"), no slab discounts (e.g. "10% above ₹500, 15% above ₹1000"),
no per-medicine or per-category scoping.

**Schema**:
- New table `discount_schemes`: `id`, `name`, `type` enum (`buy_x_get_y`, `slab_percent`,
  `slab_flat`), `scope_type` enum (`medicine`, `category`, `all`), `scope_id` (nullable FK,
  meaning depends on `scope_type`), `buy_qty` (nullable, for `buy_x_get_y`), `get_qty`
  (nullable), `slab_rules` (JSON array of `{min_amount, discount_value}` for slab types),
  `starts_on`, `ends_on`, `is_active` boolean, timestamps.
- No changes to `medicine_batches` or `stock_transactions`.

**Ownership**: A new `DiscountSchemeService` owns scheme lookup and discount computation
only. It is queried by `SalesService` during bill totaling and returns a discount amount
(and, for `buy_x_get_y`, which sale line gets the free unit flagged at zero price). It
never writes to `stock_transactions` or touches `InventoryService` — the free unit in a
buy-N-get-N offer is still a normal sale line with a normal stock deduction, just priced
at zero. `DiscountPolicy`'s existing flat bill-level discount stays as-is and stacks with
scheme discounts only if `SalesService` explicitly allows it (open question — recommend:
mutually exclusive at launch, revisit later).

> **Cave law:** the scheme engine computes an amount; it never issues a `stock_transactions`
> row itself. Stock deduction for scheme-driven free units still flows through the single
> door (`InventoryService`), same as any paid unit (law 1).

**UI**: New admin screen `schemes/index.blade.php` + `schemes/create.blade.php` (CRUD for
`discount_schemes`, pharmacy-domain/admin role only). POS screen (`pos/index.blade.php`)
gains an "applicable offers" indicator per line item and an adjusted total; cashier sees
the discount applied, not the scheme's cost impact — this is a pricing screen, not a cost
screen, so law 2 is not implicated as long as no purchase cost is surfaced.

**Cave law interaction**: Law 1 (see above). Law 6 — the discount amount must be captured
on `sale_items` (add `scheme_discount_amount` column) at time of sale, snapshotted, so a
later change to a scheme definition does not retroactively alter historical bills.

---

## 3. Gap 2 — Prescription Image / Scan Attach

**Problem**: `prescriptions` table (migration `2026_08_26_000005`) exists with no file or
image column. No way to attach a scanned or photographed prescription to a record.

**Schema**:
- Migration adding to `prescriptions`: `file_path` (nullable string, storage-relative
  path), `file_mime` (nullable string), `file_size_bytes` (nullable integer), `uploaded_at`
  (nullable timestamp), `uploaded_by` (nullable FK to `users`).
- No stock or sale table touched.

**Ownership**: New `PrescriptionAttachmentService` (or a method on the existing
`PrescriptionService` if one exists — confirm during 8b) owns validation (file type,
max size, e.g. JPEG/PNG/PDF up to ~5MB) and storage write. Laravel's `Storage` facade
abstracts the disk; no controller writes files directly.

**Open question — storage backend**: codebase's current `config/filesystems.php` disk
configuration was not confirmed while writing this doc. Default to Laravel's local
`public` disk for Phase 8 (simplest, works for a single-shop on-prem deployment matching
the rest of the stack) and leave a documented switch to an S3-compatible disk as a
follow-up ADR if/when multi-branch or cloud deployment is planned. Do not build against
S3 assumptions until that ADR exists.

**UI**: Prescription entry screen (wherever `prescriptions` are currently created/viewed —
likely tied to the sale/POS flow for Schedule H drugs) gains a file upload input and a
thumbnail/preview on the prescription detail view.

**Cave law interaction**: POS-adjacent — a prescription is typically attached at or before
time of sale for scheduled drugs. Law 8 (sales are stone) means once a sale is finalized,
the attached prescription record referenced by that sale is also not mutated in a way that
rewrites history; corrections follow the same return/cancellation path as the sale itself.
No inventory law is directly implicated.

---

## 4. Gap 3 — Separate Doctor Master

**Problem**: `doctor_name` is a free-text column on `Customer`. No `Doctor` model/table,
no registration number, no per-doctor reporting (e.g. prescriptions-by-doctor, referral
volume).

**Schema**:
- New table `doctors`: `id`, `name`, `registration_no` (nullable, unique when present),
  `phone` (nullable), `clinic_name` (nullable), `commission_percent` (nullable decimal
  `5,2`), `is_active` boolean, timestamps.
- `prescriptions` (and/or `customers`) gains nullable `doctor_id` FK to `doctors`.

**Design choice — migration of existing free text**: `Customer.doctor_name` stays as a
denormalized fallback column rather than being force-migrated. Rationale: existing values
are uncontrolled free text (misspellings, "Dr." prefixes inconsistently applied, walk-in
notes like "referred by clinic staff") and a blind migration would create low-quality
`doctors` rows that pollute the new master from day one. Instead:
- `doctor_id` is added and preferred wherever present.
- A one-time data-cleanup script (T-08xx below) proposes candidate `doctors` rows from
  distinct non-null `Customer.doctor_name` values for manual review/merge by
  pharmacy-domain, rather than auto-inserting them.
- `Customer.doctor_name` is kept read-only/legacy on the UI once `doctor_id` exists, not
  dropped, so historical customer records are not silently altered.

**Ownership**: Plain Eloquent CRUD via a `DoctorController`, no dedicated service needed —
this is master data, not a stock or sale mutation path.

**UI**: New `doctors/index.blade.php`, `doctors/create.blade.php`; customer/prescription
forms get a doctor picker (typeahead against `doctors`, with an "add new doctor" inline
option) replacing the free-text field going forward.

**Cave law interaction**: None. Pure master data — no stock, no cost, no sale mutation.

---

## 5. Gap 4 — Fast/Slow-Mover Standalone Report

**Problem**: Fast/slow-mover analysis exists only as a dashboard top-5 widget, wired this
session via a raw `DB::table` query directly in `dashboard/index.blade.php`. Not a real
report: no date-range filter, no pagination, no export, no category/branch breakdown.

**Schema**: None required — this is computed from existing `sale_items` /
`stock_transactions` data.

**Ownership**: Extract the raw query out of the Blade view into a proper
`MoverReportService` (or a query object) with a testable, parameterized method
(`fastMovers(dateRange, limit)`, `slowMovers(dateRange, limit)`). This is strictly a
read path — no writes.

**UI**: New route + view `reports/movers.blade.php` with date-range picker, fast/slow
toggle, sortable table, CSV export. Dashboard widget is refactored to call the same
service method (deduplicating the query logic) rather than keeping its own copy.

**Cave law interaction**: Read-only reporting. Law 2 still applies if the report ever
shows margin/cost per item — restrict any cost column to admin/pharmacist roles, not
cashier-visible, consistent with how cost is already excluded from cashier-facing screens.

---

## 6. Gap 5 — Drug License Number + Renewal Reminder

**Problem**: No shop-level Drug License (DL) number field anywhere. This is the pharmacy's
own retail DL, not a per-medicine field — a compliance/regulatory record, one row per shop.

**Schema**:
- New table `shop_licenses` (preferred over overloading a `settings` table, since renewal
  needs its own date/status lifecycle): `id`, `license_type` (e.g. `retail_dl_20`,
  `retail_dl_21` — India's Schedule H/H1 retail DL categories), `license_number`,
  `issued_on`, `expires_on`, `issuing_authority` (nullable), `is_active` boolean,
  timestamps. Supports multiple license rows since pharmacies often hold more than one DL
  category concurrently.

**Ownership**: Plain CRUD, no service layer needed beyond a scheduled command
`php artisan license:check-expiry` (Laravel scheduler, daily) that flags licenses expiring
within a configurable window (e.g. 60/30/7 days) and surfaces a dashboard banner /
notification. No stock or sale interaction whatsoever.

**UI**: `settings/licenses.blade.php` — simple list + create/edit form, admin-only.
Dashboard gets a compliance banner when a license is within its renewal window or expired.

**Cave law interaction**: None. Pure master/compliance data, read-only elsewhere in the
system.

---

## 7. Phase Breakdown

Sub-phases run in the priority order given. Agent roles are drawn from the existing
9-agent roster only (backend-engineer, pharmacy-domain, frontend-engineer, db-architect,
qa-tester, and others already on the roster) — no new agent role is introduced for Phase 8.

### Phase 8a — Scheme / Offer Engine
- T-0801 `db-architect`: migration for `discount_schemes`, plus `scheme_discount_amount` on `sale_items`.
- T-0802 `backend-engineer`: `DiscountSchemeService` (lookup + computation only, no stock writes).
- T-0803 `backend-engineer`: wire `SalesService` to call the scheme service during bill totaling; decide stacking rule vs. `DiscountPolicy`.
- T-0804 `pharmacy-domain`: define slab/buy-N-get-N business rules and edge cases (partial quantities, expired scheme mid-cart).
- T-0805 `frontend-engineer`: admin scheme CRUD screens + POS applicable-offer indicator.
- T-0806 `qa-tester`: scheme calculation test matrix (buy_x_get_y rounding, slab boundaries, stacking).

**Exit condition**: schemes are creatable by admin, correctly discount POS bills of both
types without any direct write to `stock_transactions`, and `scheme_discount_amount` is
snapshotted on every affected `sale_items` row.

### Phase 8b — Prescription Image / Scan Attach
- T-0807 `db-architect`: migration adding `file_path`/`file_mime`/`file_size_bytes`/`uploaded_at`/`uploaded_by` to `prescriptions`.
- T-0808 `backend-engineer`: file upload validation + storage write (local `public` disk per Phase 8 default; confirm `config/filesystems.php` state first).
- T-0809 `frontend-engineer`: upload input + thumbnail preview on the prescription screen.
- T-0810 `qa-tester`: reject-on-bad-mimetype / oversize tests, confirm upload survives sale finalization unmodified (law 8).

**Exit condition**: a prescription record can have an image/PDF attached and viewed;
storage backend choice is documented (local disk, ADR flag left for future S3 migration).

### Phase 8c — Separate Doctor Master
- T-0811 `db-architect`: migration for `doctors` table + `doctor_id` FK on `prescriptions`/`customers`.
- T-0812 `backend-engineer`: `DoctorController` CRUD.
- T-0813 `pharmacy-domain`: review/merge script output turning distinct `Customer.doctor_name` values into candidate `doctors` rows (manual approval, not auto-migration).
- T-0814 `frontend-engineer`: doctor picker/typeahead on customer & prescription forms, `doctors` admin screens.
- T-0815 `qa-tester`: confirm legacy `doctor_name` values remain untouched and readable after `doctor_id` rollout.

**Exit condition**: new prescriptions/customers can be linked to a `doctors` row with
registration number and commission %; existing free-text data is preserved, not
destructively migrated; a doctor-wise prescription report is possible.

### Phase 8d — Fast/Slow-Mover Standalone Report
- T-0816 `backend-engineer`: extract `MoverReportService` from the raw `DB::table` query in `dashboard/index.blade.php`.
- T-0817 `frontend-engineer`: `reports/movers.blade.php` with date-range filter, fast/slow toggle, CSV export.
- T-0818 `backend-engineer`: refactor dashboard widget to call the shared service (remove duplicated query).
- T-0819 `qa-tester`: verify report totals match dashboard widget for the same date range; verify cashier role cannot see cost columns if any are added.

**Exit condition**: `/reports/movers` is a real page independent of the dashboard, backed
by a single reusable service, with no raw SQL left inline in a Blade view.

### Phase 8e — Drug License Number + Renewal Reminder
- T-0820 `db-architect`: migration for `shop_licenses`.
- T-0821 `backend-engineer`: `settings/licenses` CRUD + `license:check-expiry` scheduled command.
- T-0822 `frontend-engineer`: licenses settings screen + dashboard expiry banner.
- T-0823 `qa-tester`: verify scheduler flags licenses at each threshold window (60/30/7 days) and that expired licenses surface distinctly from soon-to-expire.

**Exit condition**: shop DL numbers are recorded with expiry tracking, and an expiring or
expired license produces a visible dashboard warning without manual checking.

---

## 8. Cross-Sub-Phase Dependencies

- **8a → none.** Scheme engine has no hard dependency on doctor master (8c) or any other
  sub-phase; it only needs `SalesService` and `sale_items`, both already in place.
- **8b → open question.** Needs the storage-backend decision (local disk vs.
  S3-compatible) resolved or explicitly deferred before implementation starts, since it
  determines whether `PrescriptionAttachmentService` targets `Storage::disk('public')` or
  something else. Recommend proceeding with local disk as the Phase 8 default per §3 and
  filing an ADR only if a future phase needs remote/multi-branch storage.
- **8c → none blocking**, but the `doctors` review/merge task (T-0813) is manual and can
  run in parallel with 8a/8b since it does not touch sales or stock.
- **8d → none.** Pure extraction/refactor of existing read-only logic; can run any time,
  independent of the other four.
- **8e → none.** Pure compliance master data; fully independent.

No sub-phase blocks another's start. All five can, in principle, run in parallel across
agents; the 8a–8e ordering above reflects priority, not a dependency chain.
