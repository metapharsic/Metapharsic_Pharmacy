# E2E Test Infra: Purchase Bill Scanning, Automated Extraction, Interactive Review & Inventory Provisioning

## Test Philosophy
- **Opaque-Box & Requirement-Driven**: Derived directly from authoritative `ORIGINAL_REQUEST.md` (Follow-up 2026-11-03T11:37:13Z) and `PROJECT.md`.
- **Progressive Testability & Independence**: Tests verify contract specifications, mathematical reconciliation invariants, security authorization barriers, and atomic transactional state mutations.
- **Methodology**: 4-Tier Hierarchical Testing Strategy:
  - **Tier 1: Feature-by-Feature Coverage** (>=5 test cases per core feature)
  - **Tier 2: Boundary & Corner Cases** (Extreme values, bonus goods, multi-slab GST, short expiry, batch collisions, oversized/invalid files)
  - **Tier 3: Cross-Feature Combinations** (Multi-step workflows: Ingest -> Parse -> Review UI -> Confirmation Safety Barrier -> Atomic Provisioning -> Stock & Ledger mutation)
  - **Tier 4: Real-World Application Scenarios** (Authentic wholesale distributor invoices, smartphone camera captures, cancellation safety, cashier lockout)

---

## Feature Inventory

| # | Feature | Specification Source | Tier 1 (Min >=5) | Tier 2 (Boundaries) | Tier 3 (Cross) |
|---|---------|----------------------|:----------------:|:-------------------:|:--------------:|
| 1 | Document & Image Ingestion | ORIGINAL_REQUEST §R2, PROJECT.md F1, F2, F10 | 6 | 6 | ✓ |
| 2 | Automated Data Extraction & Heuristics | ORIGINAL_REQUEST §R2, PROJECT.md F4, F5, F6, F7 | 8 | 6 | ✓ |
| 3 | Interactive Review & Form Auto-Fill | ORIGINAL_REQUEST §R3, PROJECT.md F8, F9, F23, F24, F26 | 7 | 5 | ✓ |
| 4 | Explicit Confirmation Barrier | ORIGINAL_REQUEST §R4, PROJECT.md F27 | 6 | 5 | ✓ |
| 5 | Atomic Inventory Provisioning & Ledger | ORIGINAL_REQUEST §R4, PROJECT.md F11-F18 | 8 | 6 | ✓ |

---

## Test Architecture

- **Test Runner**: Jest 29 (`ts-jest`, `@jest-environment node`)
- **Execution Command**:
  ```bash
  npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts
  ```
- **Test Case Layout**:
  - Test Suite File: `src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts`
  - Fixtures & Test Helpers: `src/__tests__/e2e/purchase-bill-test-fixtures.ts` or co-located in test suite
- **Environment**: Node.js test environment with transactional mocks for Prisma, simulated multipart uploads, and mock auth guards.

---

## Real-World Application Scenarios (Tier 4)

| # | Scenario | Features Exercised | Expected Observable Behavior |
|---|----------|--------------------|------------------------------|
| **T4.1** | **Marg ERP Distributor Wholesale Invoice (Digital Vector PDF)** | F1, F2, F3, F4, F5 | Digital PDF from Mahaveer Pharma Agencies is uploaded; GSTIN, DL, invoice #, and 3 line items extracted; math reconciled; pharmacist reviews and confirms; atomic transaction creates purchase record, upserts batches, increments available inventory via CAS, and logs supplier ledger credit. |
| **T4.2** | **Smartphone Camera Bill Capture with Bonus Scheme (10+1 Free)** | F1, F2, F3, F4, F5 | Mobile smartphone photograph of printed bill from Vardhaman Medisales; OCR preprocessing extracts line items with trade bonus scheme (10 billed + 1 free); inventory incremented by total usable units (11), financial total billed on 10 units. |
| **T4.3** | **Pharmacist Review & Cancellation Without Stock Modification** | F3, F4, F5 | Pharmacist uploads bill, reviews pre-filled data, spots an incorrect supplier or discrepancy, and cancels the review dialog; verified that ZERO inventory records are created, ZERO batch quantities modified, and ZERO ledger entries posted. |
| **T4.4** | **Cashier / Unauthorized Role Tamper Defense (403 Forbidden)** | F4, F5 | Non-privileged user (Cashier or Dispenser lacking `purchases:create` permission) attempts to call `POST /api/purchases/scan/commit`; request is strictly rejected with HTTP 403 Forbidden with zero database mutation. |
| **T4.5** | **Multi-Item Wholesale Bill with Short-Expiry & Multi-Slab GST** | F2, F3, F4, F5 | Complex distributor invoice containing mixed tax slabs (0%, 5%, 12%, 18%), including a short-expiry item (< 6 months) triggering amber safety warnings in the review form; verified proper tax grouping and batch expiry persistence. |

---

## Coverage Thresholds & Enforcement

- **Tier 1: Feature Acceptance**: Minimum 5 test cases per core feature (Total >= 35 tests).
- **Tier 2: Boundary & Corner Cases**: Minimum 5 test cases per domain boundary (Free goods, multi-slab GST, short expiry, batch collisions, oversized files, invalid MIME types).
- **Tier 3: Cross-Feature Combinations**: Pairwise end-to-end integration across upload -> parse -> review -> confirmation barrier -> atomic provisioning.
- **Tier 4: Real-World Scenarios**: 5 end-to-end production pharmacy operational scenarios.
- **Zero Accidental Mutation Guarantee**: Verified that no inventory or financial mutation ever occurs prior to explicit confirmation.
