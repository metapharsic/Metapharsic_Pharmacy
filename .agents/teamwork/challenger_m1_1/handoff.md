# Empirical Adversarial Challenge Report: Milestone M1 (Ingestion & Document Parsing Pipeline)

**Challenger**: Challenger 1 (critic, specialist)  
**Date**: 2026-11-03T12:43:00Z  
**Target Milestone**: M1 (Ingestion & Document Parsing Pipeline)  
**Target Worker**: Worker M1  
**Verdict**: `REQUEST_CHANGES`  
**Overall Risk Assessment**: HIGH  

---

## 1. Observation

Direct empirical evidence gathered by executing stress tests and inspecting implementation files:

### 1.1 Test Suite Execution
- **Existing Worker Tests**:
  Command: `npx jest src/lib/scanner/__tests__/purchase-bill-parser.test.ts src/app/api/purchases/scan/__tests__/scan-routes.test.ts --forceExit`
  Result:
  ```text
  PASS unit src/lib/scanner/__tests__/purchase-bill-parser.test.ts
  PASS unit src/app/api/purchases/scan/__tests__/scan-routes.test.ts
  Test Suites: 2 passed, 2 total
  Tests:       33 passed, 33 total
  Snapshots:   0 total
  Time:        5.464 s
  ```
- **Adversarial Test Suite Executed**:
  Command: `npx jest src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts --forceExit`
  File: `src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts` (25 automated test cases)
  Result:
  ```text
  PASS unit src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts
  Test Suites: 1 passed, 1 total
  Tests:       25 passed, 25 total
  Snapshots:   0 total
  Time:        3.27 s
  ```
- **Consolidated Test Suite**:
  Command: `npx jest src/lib/scanner/__tests__/purchase-bill-parser.test.ts src/app/api/purchases/scan/__tests__/scan-routes.test.ts src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts --forceExit`
  Result: `3 passed, 3 total; 58 passed, 58 total; Time: 6.658 s`.

### 1.2 Verbatim Code Anomalies Directly Observed

1. **GST % vs Discount % Collision Bug**:
   File: `src/lib/scanner/pharma-invoice-heuristics.ts`, lines 390–401:
   ```typescript
   // Extract GST % slab (0, 5, 12, 18, 28) if explicitly labeled with %
   const gstMatch = rawLine.match(/\b(0|5|12|18|28)\s*%/i)
   if (gstMatch) {
     taxPercent = parseInt(gstMatch[1], 10)
   }

   // Extract discount % if explicitly labeled with %
   const discMatch = rawLine.match(/(\d+(?:\.\d+)?)\s*%/g)
   if (discMatch && discMatch.length > 1) {
     // If multiple percentages found (e.g. Disc 2% GST 12%)
     discountPercent = parseFloat(discMatch[0].replace('%', ''))
   }
   ```
   *Empirical Verification*:
   Input line: `"MEDICINE A 10'S 3004 B01 08/28 40 4 100.00 150.00 5% 12% 4256.00"`
   Result: `gstMatch` matches `"5%"` (the discount percentage), setting `taxPercent = 5` instead of `12`. Both `discountPercent` and `taxPercent` evaluate to `5%`.

2. **0 Billed Quantity Coerced to 1**:
   File: `src/lib/scanner/pharma-invoice-heuristics.ts`, line 373:
   ```typescript
   billedQuantity = Math.floor(numbersInAfter[0]) || 1
   ```
   *Empirical Verification*:
   Input line: `"PROMOTIONAL SAMPLE 10'S 3004 SAM01 08/28 0 5 0.00 0.00 0.00 0% 0.00"`
   In JavaScript, `Math.floor(0) || 1` evaluates to `1`.
   Result: `items[0].billedQuantity` becomes `1` instead of `0`.

3. **Scheme Syntax (`QTY+FREE`) Zeroes Unit Cost & MRP**:
   File: `src/lib/scanner/pharma-invoice-heuristics.ts`, lines 367–374:
   ```typescript
   const schemeMatch = rawLine.match(/(\d+)\s*\+\s*(\d+)/)
   if (schemeMatch) {
     billedQuantity = parseInt(schemeMatch[1], 10)
     freeQuantity = parseInt(schemeMatch[2], 10)
   } else if (numbersInAfter.length >= 2) {
     // If standard table columns: Qty, Free, Rate, MRP, ...
   ```
   *Empirical Verification*:
   Input line: `"AUGMENTIN 625 10'S 3004 AUG01 08/28 50+5 140.00 200.00 12%"`
   Result: Because `schemeMatch` matches, the `else if` block is skipped. `unitCost` remains `0`, `mrp` falls back to `100`, and line totals calculate to `0.00`.

4. **Multi-Page Early Truncation on Sub-Total**:
   File: `src/lib/scanner/pharma-invoice-heuristics.ts`, lines 261–274:
   ```typescript
   const upper = rawLine.toUpperCase()
   if (
     upper.startsWith('SUB-TOTAL') ||
     upper.startsWith('SUB TOTAL') ||
     upper.startsWith('TAXABLE AMOUNT') ||
     upper.startsWith('TOTAL TAX') ||
     upper.startsWith('GRAND TOTAL') ||
     upper.startsWith('NET PAYABLE') ||
     upper.startsWith('BANK DETAILS') ||
     upper.startsWith('TERMS & CONDITIONS')
   ) {
     break
   }
   ```
   *Empirical Verification*:
   Input: A two-page document where Page 1 concludes with `"SUB-TOTAL PAGE 1: 7500.00"`.
   Result: The parser breaks out of the line item loop on Page 1. All line items on Page 2 and subsequent pages are silently dropped.

5. **Empty Invoice Reconciled State**:
   File: `src/lib/scanner/pharma-invoice-heuristics.ts`, lines 577, 610:
   *Empirical Verification*:
   `parsePharmaInvoiceText("")` produces `reconciliationVariance: 0` (`0 <= 1.0` is true), which marks `financials.isReconciled: true` and awards a +0.15 confidence bonus to a blank string, returning `overallConfidence: 0.35`.

---

## 2. Logic Chain

1. **Premise**: In Indian wholesale pharma invoicing, commercial discounts (Cash Discount CD%, Trade Discount TD%) frequently match common GST statutory percentages (0%, 5%, 12%, 18%).
2. **Observation Step 1**: Line 391 executes `rawLine.match(/\b(0|5|12|18|28)\s*%/i)` before or after column extraction, matching the *first* percentage found in the entire line from left to right.
3. **Inference 1**: In standard distributor bills where Discount precedes GST (e.g. `AZITHRAL ... 5% 12%`), `gstMatch` matches `5%` and overwrites `taxPercent` with `5%` instead of `12%`.
4. **Impact 1**: Tax is computed at 5% instead of 12%, generating an incorrect financial summary, wrong ITC claim, and failing cross-reconciliation.
5. **Observation Step 2**: Line 373 uses the JavaScript logical OR operator `|| 1` for default fallback: `billedQuantity = Math.floor(numbersInAfter[0]) || 1`.
6. **Inference 2**: When an invoice lists zero billed quantity (`QTY: 0, FREE: 5` for physician samples, bonus packs, or clinical trial samples), `0 || 1` evaluates to `1`.
7. **Impact 2**: The system records 1 billed item and 5 free items, creating a false liability in Accounts Payable and provisioning extra inventory stock in Milestone M2.
8. **Observation Step 3**: Line 367 uses an `if (schemeMatch) ... else if (numbersInAfter.length >= 2)` conditional structure.
9. **Inference 3**: Invoices using standard scheme syntax `50+5` (e.g. 50 billed + 5 free) never enter the `else if` branch, preventing extraction of `unitCost` and `mrp`.
10. **Impact 3**: `unitCost` remains `0.00`, causing taxable value to be 0 and dropping financial information.
11. **Conclusion**: While the engine exhibits high fault tolerance (never crashes on corrupted streams, handles exotic expiry dates and leap years flawlessly), these three calculation flaws in `pharma-invoice-heuristics.ts` corrupt inventory quantities and financial totals during ingestion.

---

## 3. Caveats

1. **OCR / Bitmap Visual Extraction**:
   Adversarial testing focused on digital vector PDF streams, heuristic string layout parsing, and API route validation. Cloud Vision (`gemini-2.5-flash`) requires a live Google API key not present in offline CI.
2. **GSTIN Modulo 36 Checksum**:
   The statutory GSTIN regex validates the standard 15-character pattern (`\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}`). It does not calculate the Luhn Mod 36 checksum digit, which is typical for regex heuristics but noted as a caveat.
3. **Negative Rates in Invoices**:
   The number sanitizer strips `-`, transforming negative rates into positive numbers. In wholesale purchase invoices, negative items (credit adjustments) are uncommon on fresh purchase bills, but should be handled cleanly if returns are processed.

---

## 4. Conclusion & Actionable Verdict

### Verdict: `REQUEST_CHANGES`

Worker M1 must apply targeted modifications to `src/lib/scanner/pharma-invoice-heuristics.ts` before Milestone M1 can be approved for integration with Milestone M2 and M3.

### Required Changes for Worker M1:

1. **Fix GST % vs Discount % Collision (`pharma-invoice-heuristics.ts`)**:
   Do not overwrite `taxPercent` with the first `%` regex match if `taxPercent` was already extracted from the column position, or parse all percentage matches in sequence:
   ```typescript
   const pctMatches = Array.from(rawLine.matchAll(/(\d+(?:\.\d+)?)\s*%/g))
   if (pctMatches.length >= 2) {
     discountPercent = parseFloat(pctMatches[0][1])
     taxPercent = parseFloat(pctMatches[1][1])
   } else if (pctMatches.length === 1) {
     const val = parseFloat(pctMatches[0][1])
     if ([0, 5, 12, 18, 28].includes(val) && discountPercent === 0) {
       taxPercent = val
     } else {
       discountPercent = val
     }
   }
   ```

2. **Fix 0 Billed Quantity Coercion (`pharma-invoice-heuristics.ts:373`)**:
   Replace `Math.floor(numbersInAfter[0]) || 1` with an explicit check that preserves 0:
   ```typescript
   billedQuantity = numbersInAfter.length > 0 && !isNaN(numbersInAfter[0]) ? Math.floor(numbersInAfter[0]) : 1
   ```

3. **Fix Scheme Syntax Extraction (`pharma-invoice-heuristics.ts:367`)**:
   When `schemeMatch` matches, do not skip extraction of rate, MRP, and taxes from `numbersInAfter`:
   ```typescript
   const schemeMatch = rawLine.match(/(\d+)\s*\+\s*(\d+)/)
   if (schemeMatch) {
     billedQuantity = parseInt(schemeMatch[1], 10)
     freeQuantity = parseInt(schemeMatch[2], 10)
     if (numbersInAfter.length >= 2) {
       unitCost = numbersInAfter[0] || 0
       mrp = numbersInAfter[1] || unitCost * 1.3
     }
   } else if (numbersInAfter.length >= 2) {
     ...
   ```

4. **Multi-Page Subtotal Break (`pharma-invoice-heuristics.ts:261`)**:
   Only terminate line item extraction on terminal totals (`GRAND TOTAL`, `NET PAYABLE`, `NET AMOUNT`) or check for page break separators, allowing items across multiple pages to be captured.

5. **Empty Invoice Reconciliation State (`pharma-invoice-heuristics.ts:577`)**:
   Ensure `isReconciled = items.length > 0 && reconciliationVariance <= 1.0`.

---

## 5. Verification Method

To independently verify these findings and check subsequent fixes:

1. **Run the Adversarial Test Suite**:
   ```powershell
   npx jest src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts --forceExit
   ```
   *Verifies*:
   - Buffer corruption safety (empty, truncated, corrupted zlib streams)
   - Exotic expiry parsing (`31-MAR-2028`, `02/28` leap year vs `02/26` non-leap year)
   - GSTIN case insensitivity
   - 0% and 28% GST boundary calculations
   - Demonstrations of the 3 identified calculation defects

2. **Run Full Scanner & API Route Suites**:
   ```powershell
   npx jest src/lib/scanner/__tests__/purchase-bill-parser.test.ts src/app/api/purchases/scan/__tests__/scan-routes.test.ts src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts --forceExit
   ```
   *Expected Result*: All 3 test suites pass cleanly (58 tests total).

3. **Run Lint Check**:
   ```powershell
   npx eslint src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts
   ```
   *Expected Result*: 0 problems.

---

## Stress Test Results Matrix

| # | Stress Scenario | Expected Behavior | Actual Behavior | Result |
|---|-----------------|-------------------|-----------------|--------|
| 1 | Empty Buffer `Buffer.alloc(0)` | Graceful fallback, no crash | `{ text: '', pageCount: 1 }` | **PASS** |
| 2 | Non-PDF Garbage Bytes | Safe parse fallback, no crash | Processed without exception | **PASS** |
| 3 | Corrupted FlateDecode Stream | Catch zlib error, continue | Handled via `try/catch` | **PASS** |
| 4 | Truncated PDF (no `%%EOF`) | Fallback extraction, no crash | Returned empty text, 1 page | **PASS** |
| 5 | Empty string & unicode whitespace | Return empty items, no throw | Returned empty items | **PASS** |
| 6 | Bizarre whitespace (`\t`, `\r\n`, `\u00A0`) | Parse items accurately | Billed/free qty & items parsed | **PASS** |
| 7 | Mixed case GSTIN `29aabcm8921f1zt` | Match & uppercase to `29AABCM8921F1ZT` | Normalized to uppercase | **PASS** |
| 8 | Structurally invalid GSTIN | Reject via `GSTIN_REGEX` | Rejected | **PASS** |
| 9 | Form 20B/21B DL variations | Extract Form 20B / 21B | All 4 variations matched | **PASS** |
| 10 | Leap year February `02/28` & `02/2028` | Normalize to `2028-02-29` | Normalized to `2028-02-29` | **PASS** |
| 11 | Non-leap year February `02/26` & `02/2026` | Normalize to `2026-02-28` | Normalized to `2026-02-28` | **PASS** |
| 12 | Exotic format `31-MAR-2028` | Normalize to `2028-03-31` | Normalized to `2028-03-31` | **PASS** |
| 13 | 30-day months (`04/28`, `06/27`, `09/28`) | Normalize to 30th | All normalized to 30th | **PASS** |
| 14 | Out-of-range months (`00/28`, `13/28`) | Return `null` | Returned `null` | **PASS** |
| 15 | 0% GST (tax exempt) | `taxPercent: 0, taxAmount: 0` | Correctly parsed | **PASS** |
| 16 | 28% luxury GST slab | `taxPercent: 28, taxAmount: 2800` | Correctly parsed | **PASS** |
| 17 | 100% discount boundary | `taxAmount: 0, totalAmount: 0` | Correctly parsed | **PASS** |
| 18 | Large financial values (> 2.4M INR) | Accurate math cross-reconciliation | `isReconciled: true, variance <= 1.0` | **PASS** |
| 19 | Dual `%` signs (`5% 12%`) | `disc: 5%, tax: 12%` | `gstMatch` overwrites tax to 5% | **FAIL (BUG)** |
| 20 | Free-only promotional item (`0 + 5`) | `billedQty: 0, freeQty: 5` | `0 || 1` forces `billedQty: 1` | **FAIL (DEFECT)** |
| 21 | Scheme syntax `50+5` | Extract rate & MRP | Skips rate/MRP parsing (`unitCost = 0`) | **FAIL (DATA LOSS)** |
| 22 | Multi-page invoice with Page 1 subtotal | Parse items on all pages | `break` on subtotal drops Page 2 items | **FAIL (LIMITATION)** |
