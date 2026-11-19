# Test Ready Report — Purchase Bill Scanning, Review & Inventory Provisioning E2E Suite

**Generated Date**: 2026-11-03  
**Test Suite Path**: `src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts`  
**Test Runner**: Jest 29 (`ts-jest`, `@jest-environment node`)  
**Execution Command**: `npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts`  
**Overall Status**: ✅ **100% PASSED (53 / 53 tests passing in 2.84s)**

---

## Executive Summary

The comprehensive end-to-end (E2E) integration test suite covering **Purchase Bill Scanning, Automated Data Extraction, Interactive Review, and Inventory Provisioning** is fully implemented, verified, and passing without error or regression. The test suite operates against realistic Indian wholesale pharmaceutical distributor bills (e.g. Marg ERP digital PDFs and mobile camera captures), validating statutory compliance, mathematical cross-reconciliation, entity matching, confirmation safety barriers, and transactional inventory mutations.

| Domain / Milestone | Total Tests | Passed | Failed | Status |
| :--- | :---: | :---: | :---: | :---: |
| **Tier 1 — Core Feature 1: Document Upload & Multi-Format Ingestion** | 6 | 6 | 0 | ✅ PASS |
| **Tier 1 — Core Feature 2: Automated Data Extraction & Domain Heuristics** | 8 | 8 | 0 | ✅ PASS |
| **Tier 1 — Core Feature 3: Interactive Review & Form Auto-Fill** | 7 | 7 | 0 | ✅ PASS |
| **Tier 1 — Core Feature 4: Confirmation Safety Barrier** | 6 | 6 | 0 | ✅ PASS |
| **Tier 1 — Core Feature 5: Atomic Inventory Provisioning & Ledger** | 8 | 8 | 0 | ✅ PASS |
| **Tier 2 — Boundary & Corner Cases** | 8 | 8 | 0 | ✅ PASS |
| **Tier 3 — Cross-Feature Combinations** | 5 | 5 | 0 | ✅ PASS |
| **Tier 4 — Real-World Application Scenarios** | 5 | 5 | 0 | ✅ PASS |
| **Total** | **53** | **53** | **0** | ✅ **100% PASS** |

---

## Detailed Test Inventory & Matrix

### Tier 1 — Feature-by-Feature Acceptance (T1.1.1 – T1.5.8)

#### Core Feature 1: Document Upload & Multi-Format Ingestion (F1)
- **T1.1.1**: Accepts born-digital vector PDF (`application/pdf`) and returns document metadata (`filename`, `mimeType`, `pageCount`).
- **T1.1.2**: Accepts camera photo in JPEG format (`image/jpeg`) from mobile capture.
- **T1.1.3**: Accepts flatbed scanner PNG image (`image/png`) and processes file buffer.
- **T1.1.4**: Accepts WebP compressed bill image (`image/webp`) document uploads.
- **T1.1.5**: Enforces non-empty payload and valid structured document extraction.
- **T1.1.6**: Contextualizes upload to target `branchId` (defaults to active user branch).

#### Core Feature 2: Automated Data Extraction & Domain Heuristics (F2)
- **T1.2.1**: Extracts statutory 15-character GSTIN via exact regex (`\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b`).
- **T1.2.2**: Extracts Drug License numbers matching Form 20B / Form 21B statutory patterns (`D.L. No.: 20B/KA-B21/48911`).
- **T1.2.3**: Extracts invoice number and normalizes date to ISO `YYYY-MM-DD`.
- **T1.2.4**: Pharma date normalizer converts `MM/YY` (e.g. `08/28`) and leap year dates (`02/28`) to month-end calendar date.
- **T1.2.5**: Pharma date normalizer converts `MMM-YY` (e.g. `NOV-27`, `MAR/28`) to month-end calendar date.
- **T1.2.6**: Tabular parser extracts product name, batch number, expiry date, billed/free qty, unit cost (PTR), MRP, discount %, and tax %.
- **T1.2.7**: Mathematical cross-reconciliation verifies `Taxable + Tax - Discount == Total` within Rs 1.00 tolerance.
- **T1.2.8**: Flags unreconciled status when extracted grand total differs beyond tolerance.

#### Core Feature 3: Interactive Review & Form Auto-Fill (F3)
- **T1.3.1**: Pre-fills header fields with extracted supplier, invoice number, and dates.
- **T1.3.2**: Resolves known supplier with 100% confidence by matching GSTIN.
- **T1.3.3**: Strips dosage & pack tokens (`TAB`, `CAPSULE`, `10'S`) to fuzzy-match catalog medicines.
- **T1.3.4**: Dynamic line recalculation updates line total when quantity or discount changes.
- **T1.3.5**: Discrepancy detection surfaces amber warning for unreconciled invoices.
- **T1.3.6**: Pre-fills draft fields for newly detected supplier not in catalog.
- **T1.3.7**: Form preserves both billed quantity and free bonus quantity in review state.

#### Core Feature 4: Confirmation Safety Barrier (F4)
- **T1.4.1**: Strictly blocks database or stock persistence without explicit user confirmation.
- **T1.4.2**: Pharmacist review cancellation leaves stock, batches, and ledger 100% untouched.
- **T1.4.3**: Validates confirmation payload schema rejects missing required fields.
- **T1.4.4**: Enforces line item integrity: rejects items with missing batch or negative quantities.
- **T1.4.5**: Confirmation barrier requires quantitative summary match before commit.
- **T1.4.6**: Rejects confirmation if total amount diverges drastically from line item sum (HTTP 422).

#### Core Feature 5: Atomic Inventory Provisioning & Ledger (F5)
- **T1.5.1**: Executes provisioning inside a single atomic `prisma.$transaction`.
- **T1.5.2**: Persists `Purchase` record with `status: 'RECEIVED'` and financial totals.
- **T1.5.3**: Persists `PurchaseItem` records linking product, billed, and free quantities.
- **T1.5.4**: Upserts batch record on `@@unique([productId, batchNumber])` with `totalUsableQty = billedQuantity + freeQuantity` and reactivates `EXHAUSTED` status to `ACTIVE`.
- **T1.5.5**: Updates Inventory on `@@unique([productId, branchId])` with CAS concurrency safety.
- **T1.5.6**: Logs `InventoryMovement` audit trail with `type: 'IN'` and `referenceType: 'PURCHASE'`.
- **T1.5.7**: Posts Accounts Payable credit entry and updates `Supplier.outstandingBalance`.
- **T1.5.8**: Posts Input Tax Credit (ITC) GST transaction and security `AuditLog`.

---

### Tier 2 — Boundary & Corner Cases (T2.1 – T2.8)
- **T2.1**: Free goods bonus scheme (10+1 free) provisions total units (11) without inflating financial payable (10 units).
- **T2.2**: Multi-slab GST invoice (0%, 5%, 12%, 18%) segregates tax correctly across tax categories.
- **T2.3**: Short-expiry medicine detection (< 6 months) triggers near-expiry safety alert.
- **T2.4**: Batch collision: re-ordering existing batch upserts and reactivates `EXHAUSTED` batch to `ACTIVE`.
- **T2.5**: Oversized document upload (> 15MB) is rejected with HTTP 413 Payload Too Large.
- **T2.6**: Invalid MIME type (e.g. executable `.exe` or archive `.zip`) is rejected with HTTP 415.
- **T2.7**: Missing or partial statutory fields (unregistered dealer) handled gracefully without failure.
- **T2.8**: Precision roundoff (±0.49 INR) validates successfully without false reconciliation alert.

---

### Tier 3 — Cross-Feature Combinations (T3.1 – T3.5)
- **T3.1**: Full Pipeline Flow: Upload -> Scan API -> Edit in Review -> Commit -> Database state verified.
- **T3.2**: Reconciled vs Unreconciled Flow: Discrepancy detected and corrected in review before commit.
- **T3.3**: In-Line New Supplier & Product Provisioning: Auto-creation of supplier and product stock.
- **T3.4**: Repeat Ingestion / Duplicate Detection Alerting: Idempotent batch upserting without duplicate key errors.
- **T3.5**: Multi-Branch Ingestion Isolation: Branch A ingestion leaves Branch B stock completely intact.

---

### Tier 4 — Real-World Application Scenarios (T4.1 – T4.5)
- **T4.1: Scenario 1 — Marg ERP Distributor Wholesale Invoice (Digital Vector PDF)**:
  - Distributor: Mahaveer Pharma Agencies Pvt Ltd (`29AABCM8921F1ZT`, DL `20B/KA-B21/48911`)
  - Invoice: `MP/24-25/08492` with 3 items (Augmentin 625 Duo, Pan-D, Telma 40)
  - Full flow: Ingest -> Parse -> Reconcile -> Confirm -> Purchase `RECEIVED` -> Batches upserted -> Inventory CAS incremented -> Supplier ledger credit posted.
- **T4.2: Scenario 2 — Smartphone Camera Photograph of Printed Bill (Mobile JPEG)**:
  - Mobile photo capture from Vardhaman Medisales with trade bonus scheme (20 billed + 2 free Ceftum 500mg).
  - Provisioned 22 usable units into batch and inventory; accounts payable credited for 20 billed units.
- **T4.3: Scenario 3 — Pharmacist Review & Cancellation Without Stock Modification**:
  - Pharmacist uploads bill, reviews extracted line items, notices incorrect pricing from distributor, clicks "Cancel".
  - Strictly verifies that NO purchase is created, NO batches modified, NO inventory changed, NO movement logged.
- **T4.4: Scenario 4 — Cashier / Unauthorized User Lockout on Bill Confirmation (403 Forbidden)**:
  - Cashier lacking `purchases:create` permission attempts commit; rejected with HTTP 403 Forbidden; database untouched.
- **T4.5: Scenario 5 — High-Volume Multi-Item Wholesale Bill with Short Expiry & Multi-Slab GST**:
  - Multi-item bill spanning 0% (ORS), 5% (Albumin), 12% (Azithromycin), and 18% (Sterillium).
  - All 4 batches and inventory records provisioned cleanly with respective tax amounts and batch expiries.

---

## Verification Reproducibility Command

```bash
npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts
```
