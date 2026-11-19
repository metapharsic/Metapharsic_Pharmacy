# Empirical Adversarial Challenge Report: Milestone M1 Fix (Iteration 2 Gate)

**Challenger**: Challenger M1 Fix (critic, specialist)  
**Date**: 2026-11-03T13:17:00Z  
**Target Milestone**: Milestone M1 (Ingestion & Document Parsing Pipeline)  
**Target Worker**: Worker M1 Fix  
**Verdict**: `REQUEST_CHANGES`  
**Overall Risk Assessment**: MEDIUM-HIGH  

---

## 1. Observation

Direct empirical evidence gathered by executing test commands, running static analysis, and performing adversarial stress tests on `src/lib/scanner/pharma-invoice-heuristics.ts` and `src/lib/scanner/purchase-bill-parser.ts`.

### 1.1 Test Suite & Static Analysis Results
1. **Adversarial Test Suite**:
   Command: `npx jest src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts --forceExit`
   Result: **PASS** (1 test suite, 26 tests passed, 0 failed; Time: 1.264 s).
2. **Unit & Ingestion Test Suite**:
   Command: `npx jest src/lib/scanner/__tests__/purchase-bill-parser.test.ts --forceExit`
   Result: **PASS** (1 test suite, 25 tests passed, 0 failed; Time: 4.774 s).
3. **API & End-to-End Test Suite**:
   Command: `npx jest src/app/api/purchases/scan/__tests__/scan-routes.test.ts src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit`
   Result: **PASS** (2 test suites, 61 tests passed, 0 failed; Time: 4.252 s).
4. **ESLint Scanner Static Analysis**:
   Command: `npx eslint src/lib/scanner/pharma-invoice-heuristics.ts src/lib/scanner/purchase-bill-parser.ts src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts`
   Result: **0 errors, 0 warnings**.
5. **TypeScript Compilation in `src/lib/scanner/`**:
   Command: `npx tsc --noEmit`
   Result: Error TS2322 previously reported on `PSM` in `src/lib/scanner/purchase-bill-parser.ts(360,7)` has been completely resolved. `src/lib/scanner/` has **0 TypeScript errors**.

---

### 1.2 Status of the 5 Defects Previously Reported in Gate 1

| # | Defect Description | Gate 1 Status | M1 Fix Status | Empirical Verification Notes |
|---|--------------------|---------------|---------------|------------------------------|
| 1 | GST% vs Disc% collision when discount precedes GST (`5% disc, 12% GST`) | **FAILED** | **PARTIAL / REGRESSION** | Multi-percent lines (`5% 12%`) now pass. However, a **critical residual defect** was uncovered on 6-column bills without a discount column (`Qty Free Rate MRP GST% Total`), where `discountPercent` is falsely set to the GST% (e.g. 12% discount), breaking financial reconciliation. |
| 2 | 0 Billed Quantity preserved for promotional samples (`QTY: 0, FREE: 5`) | **FAILED** | **RESOLVED** | `Math.max(0, parsedBilled)` correctly preserves `billedQuantity: 0`, `freeQuantity: 5`, and total amount `0.00`. |
| 3 | Scheme syntax (`50+5`) rate/MRP retention | **FAILED** | **RESOLVED** | Scheme syntax properly strips the token from `afterExpiry` and parses rate (`140.00`) and MRP (`200.00`). Combination dosage drugs (`100+325`) in descriptions are not falsely matched. |
| 4 | Multi-page invoice continuation over intermediate subtotals | **FAILED** | **RESOLVED** | Non-terminal page separators (`SUB-TOTAL`, `PAGE TOTAL`, `TAXABLE AMOUNT`, `PAGE \d+`) now execute `continue`, allowing line items across Pages 2 and 3 to be captured. `break` is reserved for true document footers. |
| 5 | Empty/blank invoice text returns 0.0 confidence and unreconciled state | **FAILED** | **RESOLVED** | Blank strings and pure whitespace return early with `overallConfidence: 0.0`, `isReconciled: false`, and `items: []`. |

---

### 1.3 Verbatim Residual Defect Uncovered in Defect 1

#### Defect: Phantom Discount Injected on Tabular Invoices Without Discount Column
- **File**: `src/lib/scanner/pharma-invoice-heuristics.ts`, lines 436–441 and lines 449–465.
- **Code Extract**:
  ```typescript
  // Lines 436-441:
  if (numbersInAfter.length >= 6) {
    discountPercent = numbersInAfter[4] || 0
    taxPercent = numbersInAfter[5] || 12
  } else if (numbersInAfter.length === 5) {
    taxPercent = numbersInAfter[4] || 12
  }

  // Lines 449-465:
  const pctMatches = Array.from(afterExpiry.matchAll(/(\d+(?:\.\d+)?)\s*%/g))
  if (pctMatches.length >= 2) {
    discountPercent = parseFloat(pctMatches[0][1])
    taxPercent = parseFloat(pctMatches[pctMatches.length - 1][1])
  } else if (pctMatches.length === 1) {
    const val = parseFloat(pctMatches[0][1])
    const idx = afterExpiry.indexOf(pctMatches[0][0])
    const beforePct = afterExpiry.slice(0, idx).toUpperCase()
    if (beforePct.includes('DISC') || beforePct.includes('CD') || beforePct.includes('TD')) {
      discountPercent = val
    } else if ([0, 5, 12, 18, 28].includes(val)) {
      taxPercent = val
      // BUG: discountPercent is NOT reset to 0 here!
    } else {
      discountPercent = val
    }
  }
  ```

#### Empirical Reproduction:
1. Input Line (Standard wholesale invoice row without discount column):
   ```text
   AUGMENTIN 625 DUO       10'S   3004  BAT01   08/28     10     0  100.00  140.00   12%  1120.00
   ```
   Column Layout: `Qty (10) | Free (0) | Rate (100.00) | MRP (140.00) | GST% (12%) | Total (1120.00)`
2. Observed Parsed Output:
   ```json
   {
     "id": "item-1",
     "rawDescription": "AUGMENTIN 625 DUO 10'S 3004",
     "batchNumber": "BAT01",
     "expiryDate": "2028-08-31",
     "billedQuantity": 10,
     "freeQuantity": 0,
     "unitCost": 100,
     "mrp": 140,
     "discountPercent": 12,
     "taxPercent": 12,
     "taxAmount": 105.6,
     "totalAmount": 985.6
   }
   ```
3. Full Invoice Financial Reconciliation Output:
   ```json
   "financials": {
     "subtotal": 1000,
     "taxAmount": 120,
     "discountAmount": 0,
     "roundOff": 0,
     "totalAmount": 1120,
     "isReconciled": false,
     "reconciliationVariance": 134.4
   }
   ```
4. Regression also occurs in Worker M1 Fix's own test line (`src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts:304`):
   ```typescript
   const line = "ACECLOFENAC + PARACETAMOL 100+325 TAB 10'S 3004 B1 08/28 10 0 100.00 150.00 12% 1120.00"
   ```
   The test asserted `billedQuantity: 10`, `unitCost: 100`, `taxPercent: 12`. However, inspection of the resulting object revealed `discountPercent: 12`, `taxAmount: 105.6`, `totalAmount: 985.6` (variance: 134.40 vs 1120.00 printed).

---

## 2. Logic Chain

1. **Premise**: In Indian pharmaceutical distribution, many invoices do not offer or list a cash/trade discount column (`DISC%`), displaying only: `Qty | Free | Rate | MRP | GST% | Amount` (6 numeric tokens in `afterExpiry`).
2. **Observation Step 1**: Line 436 tests `if (numbersInAfter.length >= 6)`. When exactly 6 numeric values are present, it assumes the columns are `[Qty, Free, Rate, MRP, Disc%, Tax%]`.
3. **Observation Step 2**: Line 437 executes `discountPercent = numbersInAfter[4] || 0`. In a 6-column bill, `numbersInAfter[4]` is the statutory GST rate (e.g. 12), and `numbersInAfter[5]` is the line total amount (e.g. 1120.00). Thus, `discountPercent` is set to `12`, and `taxPercent` is set to `1120.00`.
4. **Observation Step 3**: Lines 449–465 evaluate percentage matches via `afterExpiry.matchAll`. In a single-tax line (`12%`), `pctMatches.length === 1` and `val === 12`.
5. **Observation Step 4**: At line 460, `[0, 5, 12, 18, 28].includes(val)` evaluates to `true`. Line 461 sets `taxPercent = 12`.
6. **Inference 1**: Line 461 **never resets or zeroes** `discountPercent`. `discountPercent` retains the value `12` that was mistakenly assigned from `numbersInAfter[4]`.
7. **Inference 2**: Line 479 computes `lineTaxable = round2(10 * 100 * (1 - 12 / 100)) = 880.00` instead of `1000.00`. Line 480 computes `lineTax = round2(880 * 0.12) = 105.60` instead of `120.00`. Total line amount becomes `985.60` instead of `1120.00`.
8. **Inference 3**: During reconciliation (`reconcileFinancials`), computed total (`985.60`) differs from printed total (`1120.00`) by `134.40`. Because `134.40 > 1.0`, `financials.isReconciled` becomes `false`.
9. **Impact**: Any purchase invoice that does not contain a discount column fails mathematical cross-reconciliation, corrupts inventory valuations, records incorrect taxable amounts for GST Input Tax Credit (ITC), and posts incorrect payable amounts.
10. **Conclusion**: While the 5 specific tests in the test suite pass when explicit `0%` or dual `%` are supplied, the underlying parsing heuristic remains broken for standard 6-column invoices omitting the discount column.

---

## 3. Caveats

1. **Test Suite Green Mirage**: All 112 automated tests in the project currently pass. This is because existing mock fixtures (`RAW_INVOICE_MAHAVEER`, `RAW_INVOICE_VARDHAMAN`) explicitly supply either dual `%` (`5% 12%`) or an explicit `0.00` discount column, which bypassed the 6-token collision path during test execution.
2. **Pre-existing Workspace TypeScript Issues**: Pre-existing TS errors in `scripts/` and `src/components/pos/` remain as documented by Explorer 3 and Worker M1 Fix. `src/lib/scanner/` has zero TypeScript errors.
3. **No other caveats**: The defect was verified empirically on multiple test strings and full invoice documents.

---

## 4. Conclusion & Actionable Verdict

### Verdict: `REQUEST_CHANGES`

Worker M1 Fix must correct the column disambiguation logic in `src/lib/scanner/pharma-invoice-heuristics.ts` to properly handle 6-column tabular rows (`Qty, Free, Rate, MRP, GST%, Total`) without assigning the GST slab to `discountPercent`.

### Required Fix for Worker M1:

In `src/lib/scanner/pharma-invoice-heuristics.ts`:

1. **Distinguish 6-Column Layouts (with vs without Discount Column)**:
   A statutory GST slab is in `[0, 5, 12, 18, 28]`. A line total amount is almost always `> 28` or not a GST slab. If `numbersInAfter.length === 6` and `numbersInAfter[5] > 28`:
   - `numbersInAfter[4]` is the `taxPercent` (not discount).
   - `numbersInAfter[5]` is the `lineTotal` (not tax).
   - `discountPercent` is `0`.
   Only if `numbersInAfter.length >= 7` is index 4 discount and index 5 tax.
   ```typescript
   if (numbersInAfter.length >= 7) {
     discountPercent = numbersInAfter[4] || 0
     taxPercent = numbersInAfter[5] || 12
   } else if (numbersInAfter.length === 6) {
     // If column 5 is > 28 or not a valid GST slab, it is the line total, and column 4 is GST%
     if (numbersInAfter[5] > 28 || ![0, 5, 12, 18, 28].includes(numbersInAfter[5])) {
       taxPercent = numbersInAfter[4] || 12
       discountPercent = 0
     } else {
       discountPercent = numbersInAfter[4] || 0
       taxPercent = numbersInAfter[5] || 12
     }
   } else if (numbersInAfter.length === 5) {
     taxPercent = numbersInAfter[4] || 12
   }
   ```

2. **Ensure Single `%` Match Clears Injected Discount**:
   In lines 454–465, when `pctMatches.length === 1` and `val` matches statutory GST `[0, 5, 12, 18, 28]`:
   ```typescript
   } else if (pctMatches.length === 1) {
     const val = parseFloat(pctMatches[0][1])
     const idx = afterExpiry.indexOf(pctMatches[0][0])
     const beforePct = afterExpiry.slice(0, idx).toUpperCase()
     if (beforePct.includes('DISC') || beforePct.includes('CD') || beforePct.includes('TD')) {
       discountPercent = val
     } else if ([0, 5, 12, 18, 28].includes(val)) {
       taxPercent = val
       // If discount was not preceded by DISC/CD/TD, reset discount to 0
       if (numbersInAfter.length < 7) {
         discountPercent = 0
       }
     } else {
       discountPercent = val
     }
   }
   ```

3. **Add Test to Adversarial Suite**:
   Add a test case in `src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts` verifying that an invoice line with 6 columns (`Qty Free Rate MRP GST% Total`) parses with `discountPercent: 0`, `taxPercent: 12`, and `totalAmount: 1120.00`.

---

## 5. Verification Method

To independently reproduce this finding:

1. **Empirical Reproduction Test**:
   Run the following Node command:
   ```powershell
   npx tsx -e "import { parseInvoiceLineItems } from './src/lib/scanner/pharma-invoice-heuristics'; const line = 'AUGMENTIN 625 10\'S 3004 BAT01 08/28 10 0 100.00 140.00 12% 1120.00'; const items = parseInvoiceLineItems(['ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP GST% TOTAL', line]); console.log('discountPercent:', items[0].discountPercent, 'totalAmount:', items[0].totalAmount);"
   ```
   - **Current Output**: `discountPercent: 12, totalAmount: 985.6` (FAIL).
   - **Expected Output**: `discountPercent: 0, totalAmount: 1120.0` (PASS).

2. **Project Test Suite Commands**:
   ```powershell
   npx jest src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts --forceExit
   npx jest src/lib/scanner/__tests__/purchase-bill-parser.test.ts --forceExit
   ```

3. **Invalidation Condition**:
   This finding is invalidated if Worker M1 Fix updates `src/lib/scanner/pharma-invoice-heuristics.ts` so that 6-column rows with single GST percentages parse with `discountPercent === 0` and `isReconciled === true`, without breaking any of the existing 112 tests.
