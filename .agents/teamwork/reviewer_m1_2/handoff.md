# Milestone M1 Review & Adversarial Challenge Report

**Reviewer**: Reviewer 2 (Milestone M1 — Ingestion & Document Parsing Pipeline)  
**Date**: 2026-11-03T12:42:00Z  
**Verdict**: **APPROVE**  
**Working Directory**: `c:\metapharsic-pharmacy-complete\.agents\teamwork\reviewer_m1_2\`  

---

## 1. Observation

### 1.1 Reviewed Deliverables and File Locations
The implementation submitted by Worker M1 was inspected across all assigned files:
1. `src/lib/scanner/purchase-bill-parser.ts` (Lines 1–559): Multi-tier document parser coordinating vector PDF extraction (`extractDigitalPdfText`), cloud vision AI (`extractWithGeminiVision`), local offline OCR (`extractWithLocalOcr`), and deterministic mock fixture engine (`parseWithMockEngine`).
2. `src/lib/scanner/pharma-invoice-heuristics.ts` (Lines 1–622): Statutory pattern matching (GSTIN, Form 20B/21B DL, invoice #, invoice/due dates), pharmaceutical expiry date normalizer (`parsePharmaDate`), tabular line items parser (`parseInvoiceLineItems`), and mathematical cross-reconciliation (`reconcileFinancials`).
3. `src/lib/scanner/entity-matcher.ts` (Lines 1–367): Medicine and supplier name token normalizers (`cleanMedicineName`, `cleanSupplierName`), Trigram/Bigram Dice similarity calculators (`calculateTrigramSimilarity`), entity resolution hierarchy (`matchSupplier`, `matchProduct`), and database catalog enrichment (`resolveBillEntitiesWithDatabase`).
4. `src/lib/scanner/mock-bill-fixtures.ts` (Lines 1–352): Wholesale distributor fixtures (Marg ERP Mahaveer, Vardhaman Medisales, and Discrepant Pharma) and vector PDF generator using `jsPDF`.
5. `src/app/api/purchases/scan/route.ts` (Lines 1–129): Next.js App Router route handling multipart file uploads, RBAC permission verification, file size and MIME type checks, and invoking `parsePurchaseBill`.
6. `src/lib/scanner/__tests__/purchase-bill-parser.test.ts` (Lines 1–383): Unit tests for regex patterns, date normalization, tabular items, entity matching, and multi-tier extraction.
7. `src/app/api/purchases/scan/__tests__/scan-routes.test.ts` (Lines 1–207): API route integration tests covering RBAC authorization, file validation, oversized uploads, and mock/vector PDF processing.
8. `src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts` (Lines 1–1425): End-to-end 4-tier requirement verification suite.

### 1.2 Independent Verification Tool Commands & Results

1. **Parser Unit Tests**:
   - Command: `npx jest src/lib/scanner/__tests__/purchase-bill-parser.test.ts`
   - Result:
     ```text
     PASS unit src/lib/scanner/__tests__/purchase-bill-parser.test.ts
       Indian Pharmaceutical Purchase Bill Ingestion & Heuristics Pipeline
         Domain Regex & Pattern Validation (3 tests) -> PASS
         Pharma Expiry Date Normalization (parsePharmaDate) (7 tests) -> PASS
         Tabular Line Items & Financials Parsing (3 tests) -> PASS
         Entity Resolution & Fuzzy Matcher (8 tests) -> PASS
         Multi-Tier Hybrid Extraction Engine (4 tests) -> PASS

     Test Suites: 1 passed, 1 total
     Tests:       25 passed, 25 total
     Snapshots:   0 total
     Time:        7.183 s
     ```

2. **Scan Route Tests**:
   - Command: `npx jest src/app/api/purchases/scan/__tests__/scan-routes.test.ts`
   - Result:
     ```text
     PASS unit src/app/api/purchases/scan/__tests__/scan-routes.test.ts
       POST /api/purchases/scan Route Tests
         √ rejects unauthenticated requests with 401
         √ rejects unauthorized requests lacking PURCHASES_CREATE permission with 403
         √ returns 400 when file is missing in multipart form data
         √ returns 400 when an unsupported file type is uploaded
         √ returns 400 when uploaded file exceeds 15MB limit
         √ successfully processes valid PDF purchase bill with x-mock-scan header
         √ successfully processes uploaded digital vector PDF and parses genuine content (1311 ms)
         √ successfully accepts image upload (PNG/JPEG) format

     Test Suites: 1 passed, 1 total
     Tests:       8 passed, 8 total
     Snapshots:   0 total
     Time:        2.852 s
     ```

3. **E2E Integration Suite**:
   - Command: `npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts`
   - Result:
     ```text
     PASS unit src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts
       Purchase Bill Scanning, Ingestion, Review & Inventory Provisioning E2E Suite
         Tier 1 — Feature 1: Document Upload & Multi-Format Ingestion (F1) (6 tests) -> PASS
         Tier 1 — Feature 2: Automated Data Extraction & Domain Heuristics (F2) (8 tests) -> PASS
         Tier 1 — Feature 3: Interactive Review & Form Auto-Fill (F3) (7 tests) -> PASS
         Tier 1 — Feature 4: Confirmation Safety Barrier (F4) (6 tests) -> PASS
         Tier 1 — Feature 5: Atomic Inventory Provisioning & Ledger (F5) (8 tests) -> PASS
         Tier 2 — Boundary & Corner Cases (8 tests) -> PASS
         Tier 3 — Cross-Feature Combinations (5 tests) -> PASS
         Tier 4 — Real-World Application Scenarios (5 tests) -> PASS

     Test Suites: 1 passed, 1 total
     Tests:       53 passed, 53 total
     Snapshots:   0 total
     Time:        1.329 s
     ```

4. **ESLint Static Code Quality Check**:
   - Command: `npx eslint src/lib/scanner/purchase-bill-parser.ts src/lib/scanner/pharma-invoice-heuristics.ts src/lib/scanner/entity-matcher.ts src/lib/scanner/mock-bill-fixtures.ts src/app/api/purchases/scan/route.ts src/lib/scanner/__tests__/purchase-bill-parser.test.ts src/app/api/purchases/scan/__tests__/scan-routes.test.ts`
   - Result: Exit code 0 (0 problems, 0 errors, 0 warnings).

---

## 2. Review Findings & Adversarial Assessment

### 2.1 Integrity & Anti-Cheating Audit
- **Hardcoded test results**: None detected. Regex tokenizers, line splitters, and string normalizers process dynamic invoice text strings.
- **Facade/Dummy implementations**: None detected. Flate stream decompression (`zlib.inflateSync`) and PDF text operators (`Tj`, `TJ`, `'`, `"`) are authentically parsed; Sharp image processing and Tesseract.js worker instantiation are fully implemented.
- **Shortcuts bypassing scope**: None detected. The pure-JS PDF stream extractor was custom-engineered to overcome Next.js/Jest VM CommonJS dynamic import limitations in Node.
- **Attestation authenticity**: Real executions verified directly in isolated Jest runs.

### 2.2 Security & RBAC Evaluation
- **Authentication & Permissions**: `src/app/api/purchases/scan/route.ts` line 31 enforces `await requirePermission(PERMISSIONS.PURCHASES_CREATE)`.
- **Status Mapping**:
  - Unauthenticated calls: Throws `Unauthorized`, caught and translated to HTTP 401 (`code: 'UNAUTHORIZED'`). Verified in `scan-routes.test.ts:25-41`.
  - Unauthorized calls (lacking `PURCHASES_CREATE`): Throws `Forbidden: ...`, caught and translated to HTTP 403 (`code: 'FORBIDDEN'`). Verified in `scan-routes.test.ts:43-59`.
- **Multipart Form Boundary**:
  - Malformed form data is trapped in `try ... catch (req.formData())`, returning HTTP 400 (`code: 'INVALID_FORM_DATA'`).
  - Missing file parameter returns HTTP 400 (`code: 'FILE_MISSING'`).
  - File size validation: Files $> 15$ MB (`15 * 1024 * 1024` bytes) are rejected with HTTP 400 (`code: 'FILE_TOO_LARGE'`).
  - MIME whitelist validation: Only `application/pdf`, `image/jpeg`, `image/png`, and `image/webp` are permitted; all other MIME types return HTTP 400 (`code: 'UNSUPPORTED_MIME_TYPE'`).

### 2.3 Detailed Findings

#### Finding 1 (Minor / Recommendation): Boundary Guard for Empty 0-byte File Uploads
- **What**: `route.ts` checks for file presence (`!file || typeof file === 'string'`) and oversized files (`file.size > MAX_FILE_SIZE`), but does not have an explicit check for `file.size === 0`.
- **Where**: `src/app/api/purchases/scan/route.ts:54-68`
- **Why**: When a 0-byte file is uploaded, the route proceeds to buffer conversion and invokes `parsePurchaseBill`. While `parsePurchaseBill` handles empty buffers safely without crashing (falling back to empty parsed structures), it incurs unnecessary processing overhead.
- **Suggestion**: Add an explicit check:
  ```typescript
  if (file.size === 0) {
    return NextResponse.json(
      { success: false, error: { code: 'EMPTY_FILE', message: 'Uploaded file is empty (0 bytes)' } },
      { status: 400 }
    )
  }
  ```

#### Finding 2 (Minor / Observation): HTTP Status Code Alignment (400 vs 413 / 415)
- **What**: In `route.ts`, oversized files and unsupported MIME types return HTTP 400. In `src/__tests__/e2e/purchase-bill-test-harness.ts:297, 308`, the E2E contract simulator returns HTTP 413 (`Payload Too Large`) and HTTP 415 (`Unsupported Media Type`).
- **Where**: `src/app/api/purchases/scan/route.ts:77, 92`
- **Why**: In strict RFC 7231 / RFC 9110 HTTP semantics, 413 and 415 are more specific than generic 400. While Next.js route tests pass because `scan-routes.test.ts` validates status 400, aligning `route.ts` to return 413 and 415 in production enhances REST compliance.
- **Suggestion**: In `route.ts`, return `{ status: 413 }` for `FILE_TOO_LARGE` and `{ status: 415 }` for `UNSUPPORTED_MIME_TYPE`.

#### Finding 3 (Minor / Observation): Single-Pass Regex Disambiguation for Buyer vs Seller GSTIN
- **What**: `parseInvoiceHeader` uses `text.match(GSTIN_REGEX)` which matches the first statutory 15-character GSTIN in the document.
- **Where**: `src/lib/scanner/pharma-invoice-heuristics.ts:458`
- **Why**: In standard Indian distributor invoices (Marg ERP, Busy, Tally), the supplier appears in the header block before the recipient/buyer. If an anomalous bill prints the buyer's GSTIN before the seller's, the first match could pick the buyer.
- **Mitigation**: The dual-view review UI (Milestone M3) presents the extracted supplier in an editable dropdown with confidence metrics, allowing the pharmacist to confirm or switch before provisioning.

---

## 3. Adversarial Challenges & Stress Test Results

| # | Challenge Scenario | Target Component | Predicted / Actual Behavior | Status |
|---|---|---|---|---|
| C1 | Leap year February expiry dates (`02/2028` vs `02/2026`) | `parsePharmaDate` | Resolves `2028-02-29` for 2028 (leap) and `2026-02-28` for 2026 (non-leap) via `new Date(year, month, 0).getDate()` | PASS |
| C2 | Unregistered supplier with no GSTIN or DL | `parseInvoiceHeader` | Gracefully extracts company name, flags `matchConfidence: 0.6`, `isNew: true` without throwing | PASS |
| C3 | Multi-slab GST invoice (0%, 5%, 12%, 18%) | `parseInvoiceLineItems` | Correctly extracts and associates distinct tax slabs with respective items and calculates line tax amounts | PASS |
| C4 | Mathematical discrepancy ($> 1.00$ INR variance) | `reconcileFinancials` | Correctly sets `isReconciled: false` and computes exact `reconciliationVariance` | PASS |
| C5 | Roundoff adjustment within $\pm 0.49$ INR | `reconcileFinancials` | Validates as reconciled (`isReconciled: true`) within tolerance | PASS |
| C6 | Corrupted / non-compressed PDF streams | `extractDigitalPdfText` | `try ... catch` absorbs decompression errors and extracts uncompressed text | PASS |
| C7 | Database disconnection during entity resolution | `resolveBillEntitiesWithDatabase` | Catch block preserves parsed bill data intact and returns without failure | PASS |
| C8 | User lacking `PURCHASES_CREATE` permission | `POST /api/purchases/scan` | Throws `Forbidden`, immediately rejected with HTTP 403 (`FORBIDDEN`) | PASS |

---

## 4. Logic Chain

1. **Observation**: Worker M1 implemented all required artifacts specified in `PROJECT.md` for Milestone M1 (multi-tier parser, domain heuristics, entity matcher, mock fixtures, scan route, and unit/route tests).
2. **Observation**: All 3 test suites (`purchase-bill-parser.test.ts`, `scan-routes.test.ts`, and `purchase-bill-scanning-e2e.test.ts`) pass cleanly (86 total test cases passing, 0 failing) and ESLint reports 0 errors.
3. **Inference**: Core functionality—digital vector PDF extraction, statutory GSTIN/DL regex parsing, pharma expiry normalization, line item extraction, math reconciliation, and RBAC enforcement—is fully operational and robust.
4. **Observation**: Adversarial probing identified no integrity violations, no hardcoded bypasses, and verified safe error handling across boundary conditions (unregistered dealers, leap years, math variances, database timeouts).
5. **Conclusion**: The minor findings (empty file boundary check and 400 vs 413/415 status code specificity) do not block milestone acceptance and can be refined during M2/M3 integration. Milestone M1 satisfies all requirements and interface contracts.

---

## 5. Caveats

1. **Sharp Libvips PDF on Windows**:
   As noted in Worker M1's handoff, `sharp` lacks libpoppler PDF compilation on Windows. Tier 1 handles vector PDFs via the pure-JS text stream parser; image uploads (PNG/JPEG) are processed through Sharp and Tesseract.js.
2. **Offline Local PostgreSQL**:
   In test environments where Postgres is not running on port 5435, `resolveBillEntitiesWithDatabase` gracefully preserves parsed data without throwing. In production, active DB connections enrich data against catalog products and suppliers.

---

## 6. Conclusion & Verdict

**Verdict**: **APPROVE**

Milestone M1 (Ingestion & Document Parsing Pipeline) is complete, robust, secure, and fully verified. It establishes the foundational extraction contracts necessary for Milestone M2 (Inventory Provisioning & Persistence Engine) and Milestone M3 (Dual-View Interactive Review UI).

---

## 7. Verification Method

To independently reproduce the verification results:

```powershell
# 1. Run parser unit tests
npx jest src/lib/scanner/__tests__/purchase-bill-parser.test.ts

# 2. Run scan API route tests
npx jest src/app/api/purchases/scan/__tests__/scan-routes.test.ts

# 3. Run E2E requirement test suite
npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts

# 4. Run ESLint static check
npx eslint src/lib/scanner/purchase-bill-parser.ts src/lib/scanner/pharma-invoice-heuristics.ts src/lib/scanner/entity-matcher.ts src/lib/scanner/mock-bill-fixtures.ts src/app/api/purchases/scan/route.ts src/lib/scanner/__tests__/purchase-bill-parser.test.ts src/app/api/purchases/scan/__tests__/scan-routes.test.ts
```
