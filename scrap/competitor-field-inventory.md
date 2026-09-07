# Scrap: Competitor Field Inventory — Pharmacy Software Field Inventory

Purpose: pull every concrete field, screen, and input surfaced by established Indian pharmacy
retail software (Vendor A, Vendor B's Pharma ERP, Vendor C) via public marketing pages,
listings, and a training-manual reference — then map each one against what Metapharsic Pharmacy
already has (`brain/10-screen-specs.md`) so gaps are visible at a glance.

Research method: `WebSearch` + `WebFetch` against public vendor pages (see Sources at bottom).
No login-gated demo, PDF manual body, or paid trial was accessible — this is a field inventory
built from marketing/feature pages and one training-manual listing page, not a live product
teardown. Treat every row as "vendor claims this field/feature exists," not verified firsthand.

---

## 1. Sales / Billing screen — fields these vendors surface

| Field / capability | Vendor A | Vendor B | Vendor C | Metapharsic status |
|---|---|---|---|---|
| Medicine search (name/generic/barcode) | Yes | Yes (prescription auto-fill) | Yes | **Have** — `pos/index.blade.php` search + barcode scan |
| Batch selection at sale | Yes (Batch And Rack Mgmt) | Yes (FEFO dispensing) | Yes | **Have** — FEFO auto-allocation |
| MRP / selling price display | Implied (billing) | Yes (captured per item) | Yes | **Have** |
| Discount % (line + bill) | Yes (Discount And Scheme Mgmt) | Yes | Yes | **Have** — bill-discount input added this session |
| Scheme/offer management (buy-N-get-N, slab discounts) | Yes, explicit | Not called out | Not called out | **Gap** — no scheme/offer engine, only flat % discount |
| Loyalty points | Yes (Loyalty Program Mgmt) | Not called out | Not called out | **Gap** — no loyalty system |
| Customer/patient-wise billing record | Yes | Yes (patient-wise records) | Yes | **Have** — customer linked to sale |
| Doctor field on bill | Yes (Doctor/Patient reports) | Implied (prescription-based) | Not confirmed | **Partial** — `doctor_name` exists on Customer, not per-sale |
| Prescription image/scan attach | Not confirmed | Yes (Rx image scanning, per techjockey roundup) | Not confirmed | **Gap** — `prescriptions` table exists but no image/file upload found in screen specs |
| Schedule H / H1 / X / narcotics block | Yes, explicit ("restricted item tracking") | Yes (Schedule H, H1, X drug register) | Not confirmed | **Have (partial)** — Schedule H hard-block exists (DR-RX-02); H1/X/narcotics register not itemized separately |
| Credit limit / outstanding check at billing | Implied (customer mgmt) | Yes (per techjockey roundup: "live credit limit control") | Not confirmed | **Have** — `CreditLimitExceededException` server-enforced |
| Home delivery flag/workflow | Yes, explicit | Not called out | Not called out | **Gap** — no delivery flag on sale |
| Multi-counter / multi-till sync | Yes (Multi Store Mgmt) | Yes (real-time stock sync across counters) | Yes | **Partial** — held-bills are per-user/session-cache, not a shared multi-till ledger |
| SMS/email bill alert to customer | Yes, explicit | Not called out | Not confirmed | **Gap** — no SMS/email hook found in screen specs |
| Bill hold/recall | Not explicitly listed (implied by any POS) | Not explicitly listed | Not explicitly listed | **Have** — built this session |
| Round-off handling | Implied by GST billing | Implied | Implied | **Have** — `round_off` column, DR-GST-08 |
| Split payment (cash/card/UPI/credit) | Implied | Implied | Implied | **Have** |

## 2. Purchase Entry screen — fields

| Field / capability | Vendor A | Vendor B | Vendor C | Metapharsic status |
|---|---|---|---|---|
| Supplier selection | Yes | Yes | Yes | **Have** |
| Purchase order → auto purchase entry | Yes ("Smart Purchase", auto-ordering) | Not explicit | Not confirmed | **Gap** — no PO stage before purchase entry; purchase is entered directly |
| Batch no. + expiry date capture per line | Yes | Yes, explicit | Yes | **Have** |
| MRP vs purchase (cost) price, separate fields | Implied | Yes | Yes | **Have** — `purchase_price` vs `mrp`/`selling_price` separate |
| Free/bonus quantity per line | Implied by "scheme" features | Not explicit | Not confirmed | **Have** — free-goods `effective_cost` (cave law 5) |
| Auto reorder-level trigger from purchase history | Yes, explicit | Yes ("reorder level management, automatic low-stock alerts") | Not confirmed | **Gap** — `min_stock_level` exists as a static field; no auto-suggested reorder qty from sales velocity |
| Supplier-wise / company-wise / product-wise / batch-wise stock views | Yes, explicit (4 named views) | Not itemized this granularly | Not confirmed | **Partial** — inventory index has some filters; not all 4 named cross-cuts confirmed present |
| Draft → confirm → cancel purchase states | Not confirmed as named states | Not confirmed | Not confirmed | **Have** — purchase status enum (draft/confirmed/cancelled) already exceeds what's documented for competitors |
| Rack/location assignment on receipt | Yes ("Batch And Rack Management") | Not explicit | Not confirmed | **Have** — rack/shelf/location fields exist on medicines (Phase-6 addition) |

## 3. Medicine / Item Master screen — fields

| Field | Vendor A | Vendor B | Vendor C | Metapharsic status |
|---|---|---|---|---|
| Generic name | Implied (drug info mgmt) | Not explicit on this page | Not confirmed | **Have** — `generic_name` |
| HSN code | Implied (GST filing) | Yes, explicit ("HSN Chapter 30 mapping") | Not confirmed | **Have** — `hsn_code` |
| GST rate slab | Yes | Yes, explicit (multi-rate handling) | Yes | **Have** — 0/5/12/18 CHECK constraint |
| Pack size / unit | Implied | Not explicit | Not confirmed | **Have** — `pack_size`, `unit` |
| Barcode | Yes, explicit | Yes | Yes | **Have** |
| Schedule H / narcotics flag on item itself | Yes (restricted item tracking) | Yes (Schedule H/H1/X register) | Not confirmed | **Have** — `is_prescription_required` boolean; no separate H1/X/narcotics classification field |
| Rack/bin/shelf location | Yes | Not explicit | Not confirmed | **Have** |
| Min stock / reorder level | Implied | Yes, explicit | Not confirmed | **Have** — `min_stock_level` |
| Drug license no. tied to item/company | Not on item; Vendor B ties it to the business itself | Yes ("manage drug licence details, renewal alerts, print on invoice") | Not confirmed | **Gap** — no drug-license-number field anywhere (shop's own DL number, not per-medicine) — worth adding as a shop-settings field with renewal-date reminder |
| Manufacturer/company | Implied | Implied | Implied | **Have** |
| Storage temperature/zone | Not found in vendor pages | Not found | Not found | **Have — Metapharsic exceeds here** (cold-chain zone tracking not advertised by any of the three) |

## 4. Inventory / Stock screens — fields

| Field / capability | Vendor A | Vendor B | Vendor C | Metapharsic status |
|---|---|---|---|---|
| Batch-wise stock register | Yes, explicit | Yes, explicit | Yes | **Have** |
| Near-expiry alert (30/60/90-day windows) | Yes ("Expiry Stock alerts") | Yes, explicit ("90/60/30-day notifications") | Not confirmed | **Have** — expiry-report screen with window select |
| Negative-stock alert/block | Yes, explicit | Not explicit | Not confirmed | **Have** — DR-ADJ-07, cannot go below zero |
| Slow/fast mover report | Implied ("smart reporting") | Yes, explicit | Not confirmed | **Gap (partial)** — dashboard top-medicines just wired this session; a dedicated fast/slow-mover report view is still TBD per earlier screen-spec gaps |
| Stock valuation report | Implied | Implied | Implied | **Have** — `reports/stock-valuation.blade.php` |
| Multi-store/location stock sync | Yes, explicit | Yes, explicit | Yes | **Gap** — Metapharsic is single-shop scoped by design (no multi-branch sync); acceptable for v1 scope, flag if shop expands |
| Auto-block sale of expired batch | Not explicit but implied by FEFO | Yes, explicit ("automatic blocking of expired items") | Not confirmed | **Have** — `ExpiredBatchException`, hard server block |

## 5. GST / Compliance — fields

| Field / capability | Vendor A | Vendor B | Vendor C | Metapharsic status |
|---|---|---|---|---|
| GST-ready invoice, CGST/SGST split | Yes | Yes | Yes | **Have** |
| HSN-wise summary report | Implied | Yes | Not confirmed | **Have** — `reports/gst.blade.php` has HSN summary |
| E-way bill generation | Not called out here | Yes, explicit | Not confirmed | **Gap** — no e-way bill generation (likely out of v1 scope — pharmacy retail sales rarely need it, more relevant to B2B/distribution) |
| E-invoicing (IRN) | Not called out here | Yes, explicit | Not confirmed | **Gap** — no e-invoice/IRN integration; only relevant once turnover crosses the e-invoicing mandate threshold |
| GST return export (JSON/Excel/CSV for GSTR filing) | Implied | Implied | Not confirmed | **Gap** — GST report exists on-screen but no GSTR-ready export format confirmed in screen specs |
| Drug license renewal reminder | Not confirmed | Yes, explicit | Not confirmed | **Gap** — see item-master row above |

## 6. Customer / Doctor / Prescription — fields

| Field | Vendor A | Vendor B | Vendor C | Metapharsic status |
|---|---|---|---|---|
| Customer master (name, phone, address) | Yes | Yes | Yes | **Have** |
| Credit limit / outstanding balance | Implied | Yes, explicit | Not confirmed | **Have** |
| Doctor master (separate from customer) | Yes ("Doctor/Patient wise Reports") | Implied | Not confirmed | **Gap** — Metapharsic only has a free-text `doctor_name` on Customer, no separate Doctor master table with its own commission/reporting |
| Doctor commission tracking | Not explicit here, but common in the category (per techjockey roundup) | Not confirmed | Not confirmed | **Gap** — not present, likely low priority unless the shop runs a referral-commission model |
| Appointment reminders | Yes, explicit | Not confirmed | Not confirmed | **Gap** — out of scope for a pharmacy POS, more of a clinic feature; probably correctly excluded |
| Prescription record with image/scan | Not confirmed for Vendor A | Yes (per techjockey roundup: "Rx image scanning") | Not confirmed | **Gap** — `prescriptions` table has no file/image column per current screen specs |

## 7. Reports — breadth comparison

| Report type | Vendor A | Vendor B | Metapharsic status |
|---|---|---|---|
| Sales register | Yes | Yes | **Have** |
| Purchase register | Yes | Yes | **Have** |
| GST/HSN summary | Yes | Yes | **Have** |
| Profit report | Implied | Implied | **Have** (admin-only, cave law 2) |
| Stock valuation | Implied | Implied | **Have** |
| Expiry report | Yes | Yes | **Have** |
| Fast/slow mover | Implied | Yes, explicit | **Gap (partial)** — dashboard top-5 only, no full report view yet |
| Customer/supplier aging | Implied | Not explicit | **Have** |
| Supplier performance analysis | Not explicit | Yes, explicit ("track supplier performance metrics") | **Gap** — no supplier scorecard/performance report |
| "1000+ report types" (Vendor A's own marketing claim) | Yes (marketing number, not itemized) | — | N/A — vendor marketing claim, not a real comparison point |

---

## 8. Net-new gap list (ranked by how much it'd actually help a real shop)

1. **Scheme/offer engine** (buy-N-get-N, slab discounts) — flat % discount only today; Vendor A leads here.
2. **Prescription image/scan attach** — `prescriptions` table exists, no file upload column found.
3. **Separate Doctor master** — currently just a text field on Customer, no doctor-level reporting.
4. **Fast/slow-mover as a real report page**, not just dashboard top-5.
5. **Drug license number + renewal reminder** — shop-level compliance field, zero-cost to add.
6. **GSTR-ready export** (JSON/Excel) from the GST report — currently on-screen only.
7. **SMS/email bill notification** to customer.
8. **Auto-suggested reorder quantity** from sales velocity, not just a static min-stock threshold.
9. **Supplier performance report** (on-time %, quality flags).
10. **Home-delivery flag/workflow** on a sale.

Items explicitly judged OUT of scope for a single-shop retail pharmacy (present in the big
distribution-focused competitors but not worth building): multi-branch stock sync, e-way bill
generation, e-invoicing/IRN, appointment reminders, loyalty points, doctor commission payout.

---

## 9. Caveats

- No paid demo, login-gated admin panel, or full PDF manual was reachable — everything above is
  sourced from public marketing/listing pages plus one training-manual reference page that itself
  failed to render its content (JS-gated), so Vendor A's *exact* field-by-field screen layout is not
  independently verified, only its advertised feature list.
- "Have" rows are cross-checked against `brain/10-screen-specs.md` and this session's real code
  changes (held-bills, F2 modal, stock-adjustment listing) — not re-verified against live running
  screens for this pass.
- Vendor marketing language ("1000+ reports", "smart reporting") is preserved in quotes where it
  couldn't be reduced to a concrete field — flagged as such, not treated as a real spec.

## Sources

Sourced from public marketing/comparison pages of three established Indian pharmacy retail
software products (names withheld per project convention); available on request from research
notes.
