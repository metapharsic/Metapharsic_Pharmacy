# Handoff Report — Explorer M1 Fix 1

**Agent**: Explorer M1 Fix 1 (Investigation & Synthesis)  
**Date**: 2026-11-03T12:47:00Z  
**Target Milestone**: Milestone M1 Ingestion & Document Parsing Pipeline (Remediation)  
**Assigned Scope**: Defect 1 (GST % vs. Discount % Collision) & Defect 4 (Multi-Page Early Loop Break)  
**Target File**: `src/lib/scanner/pharma-invoice-heuristics.ts`  

---

## 1. Observation

Direct empirical evidence gathered from the codebase and test execution:

### 1.1 Baseline Test Suite Execution
- **Existing Scanner Unit Tests & Route Tests**:
  Command: `npx jest src/lib/scanner/__tests__/purchase-bill-parser.test.ts src/app/api/purchases/scan/__tests__/scan-routes.test.ts --forceExit`
  Result: 2 test suites passed, 33 tests passed cleanly.
- **E2E Purchase Bill Suite**:
  Command: `npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit`
  Result: 1 test suite passed, 53 tests passed cleanly.
- **Production Enhancements E2E Suite**:
  Command: `npx jest src/__tests__/e2e/production-enhancements-e2e.test.ts --forceExit`
  Result: 1 test suite passed, 52 tests passed cleanly.
- **Adversarial Suite (Challenger 1)**:
  Command: `npx jest src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts --forceExit`
  Result: 1 test suite passed, 25 tests passed (wherein tests #19 and #22 explicitly asserted the buggy behavior).

---

### 1.2 Verbatim Code Observation: Defect 1 (GST % vs Discount % Regex Collision)
**File**: `src/lib/scanner/pharma-invoice-heuristics.ts`, lines 390–401:
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

**Verbatim Reproduction**:
- Input raw line:
  `"MEDICINE A 10'S 3004 B01 08/28 40 4 100.00 150.00 5% 12% 4256.00"`
- Step 1: Positional parsing in lines 378–380 parses `numbersInAfter[4] = 5` into `discountPercent = 5` and `numbersInAfter[5] = 12` into `taxPercent = 12`.
- Step 2: Line 391 executes `rawLine.match(/\b(0|5|12|18|28)\s*%/i)`. Because `String.prototype.match` without `/g` returns the *first* match, it matches `"5%"` (the commercial discount).
- Step 3: Line 393 sets `taxPercent = 5`, completely overwriting the correct `12%` tax rate!
- Step 4: Line 397 executes `rawLine.match(/(\d+(?:\.\d+)?)\s*%/g)`, which finds `["5%", "12%"]`. Line 400 sets `discountPercent = 5`.
- Result: `discountPercent = 5` and `taxPercent = 5`. `taxPercent` is corrupted from `12` to `5`.
- **Additional Hazard Discovered**: In medicines with active ingredient concentrations (e.g., `"DEXTROSE 5% 500ML"` or `"BETADINE 10% SOLUTION"`), searching `rawLine` matches the medicine strength in `beforeExpiry` as a percentage!

---

### 1.3 Verbatim Code Observation: Defect 4 (Multi-Page Early Loop Break)
**File**: `src/lib/scanner/pharma-invoice-heuristics.ts`, lines 260–274:
```typescript
// Break when hitting footer totals or bank details
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

**Verbatim Reproduction**:
- Input multi-page invoice text:
  ```text
  TAX INVOICE
  MAHAVEER PHARMA AGENCIES PVT LTD           INV: MP-101
  GSTIN: 29AABCM8921F1ZT                     DATE: 10/10/2026
  --------------------------------------------------------------------------------
  ITEM DESCRIPTION        PACK   HSN   BATCH   EXPIRY   QTY  FREE   RATE     MRP   DISC% GST%
  AUGMENTIN 625 DUO       10'S   3004  BAT01   08/28     50     0  150.00  200.00  0.00  12%
  SUB-TOTAL PAGE 1: 7500.00
  --------------------------------- PAGE 2 ---------------------------------------
  PAN 40 TABLETS          15'S   3004  BAT02   11/27     40     0  100.00  140.00  0.00  12%
  GRAND TOTAL: 11500.00
  ```
- Step 1: Line 6 (`AUGMENTIN 625 DUO ...`) is parsed successfully into `items[0]`.
- Step 2: Line 7 (`SUB-TOTAL PAGE 1: 7500.00`) is evaluated.
- Step 3: `upper.startsWith('SUB-TOTAL')` evaluates to `true`.
- Step 4: Line 272 executes `break`, terminating the `for` loop prematurely!
- Step 5: Page 2 line item `PAN 40 TABLETS` is never examined.
- Result: Line item extraction halts at Page 1. All line items on Page 2 and subsequent pages are silently dropped.

---

## 2. Logic Chain

### 2.1 Logic Chain for Defect 1 (GST % vs Discount % Collision)
1. **Premise 1**: In Indian pharmaceutical wholesale distribution (CGST/SGST Acts 2017), commercial trade discounts (CD%, TD%) are deducted from the gross price *before* calculating GST. Therefore, tabular invoice layouts uniformly arrange columns as `[Rate] [MRP] [Discount %] [GST %] [Amount]`.
2. **Premise 2**: In standard Indian distributor bills, trade discounts often match common GST statutory rates: `0%`, `5%`, `10%`, or `12%`.
3. **Inference from Obs 1.2**: When both discount and tax percentage signs are present in a line (e.g. `5% 12%` or `0% 12%`), `rawLine.match(/\b(0|5|12|18|28)\s*%/i)` finds the first `%` symbol from the left. Since `0` and `5` are both valid GST slabs, the discount percentage is matched as the GST slab, erroneously setting `taxPercent = 5` or `0`.
4. **Impact**: Tax is calculated at 5% instead of 12%, corrupting the line item `taxAmount`, total payable, Input Tax Credit (ITC) reconciliation, and failing mathematical cross-reconciliation.
5. **Medicine Name False Positive Hazard**: If regex matching runs against the entire `rawLine`, medicine strength descriptions such as `"DEXTROSE 5% 500ML"` or `"BETADINE 10% SOLUTION"` in `beforeExpiry` trigger false percentage matches.
6. **Solution Formulation**:
   - Scope percentage extraction to `afterExpiry` (which contains only numeric financial columns), eliminating false positives from product names.
   - Extract all percentage matches in sequence using `matchAll(/(\d+(?:\.\d+)?)\s*%/g)`.
   - When 2 or more percentages are present in `afterExpiry`, the first is discount (`discountPercent = parseFloat(matches[0][1])`) and the last is GST (`taxPercent = parseFloat(matches[matches.length - 1][1])`).
   - When exactly 1 percentage is present: if it belongs to standard GST slabs `[0, 5, 12, 18, 28]`, assign to `taxPercent`; otherwise assign to `discountPercent`.

### 2.2 Logic Chain for Defect 4 (Multi-Page Early Loop Break)
1. **Premise 1**: Real-world wholesale purchase bills frequently span multiple pages (2 to 10 pages for high-volume chemist orders).
2. **Premise 2**: Distributor billing systems (Marg ERP, Busy, Tally, AlignBooks) print intermediate page summaries at the bottom of each page: `SUB-TOTAL PAGE 1: ...`, `SUB-TOTAL C/F: ...`, `PAGE TOTAL: ...`, or `TAXABLE AMOUNT: ...`.
3. **Inference from Obs 1.3**: The loop termination guard in line 262 uses `break` indiscriminately for both intermediate sub-totals (`SUB-TOTAL`, `SUB TOTAL`, `TAXABLE AMOUNT`, `TOTAL TAX`) and terminal invoice footers (`GRAND TOTAL`, `NET PAYABLE`).
4. **Distinction**:
   - **Terminal Footers**: `GRAND TOTAL`, `NET PAYABLE`, `NET AMOUNT`, `TOTAL AMOUNT`, `BANK DETAILS`, `TERMS & CONDITIONS`, `AUTHORIZED SIGNATORY` indicate the absolute end of the document. These MUST execute `break`.
   - **Non-Terminal Section Summaries**: `SUB-TOTAL`, `SUB TOTAL`, `PAGE TOTAL`, `TAXABLE AMOUNT`, `TOTAL TAX`, `CGST`, `SGST`, `IGST`, `PAGE \d+`, `CONTINUED` occur between pages or sections. These MUST execute `continue` (skip), allowing the loop to process items on subsequent pages.
   - **Repeated Column Headers**: Column header rows (`ITEM ... BATCH ... QTY ... RATE ...`) repeated on Pages 2, 3, etc., must also execute `continue`.
5. **Safety Guarantee**: In `tryParseItemFromLine`, an item line is only parsed if it possesses a valid pharmaceutical expiry date (`parsePharmaDate(expiry)` returning a date between 2020 and 2045) and numeric rate/quantity columns. Footer summary lines like `SUB-TOTAL: 2500.00` have no expiry date and cannot be mistakenly parsed as medicines.

---

## 3. Caveats

1. **Other Independent Defects (Defects 2, 3, 5)**:
   - Defect 2 (0 billed quantity coerced to 1 via `|| 1`), Defect 3 (scheme syntax `50+5` skipping rate/MRP), and Defect 5 (empty string confidence bonus) are assigned to Explorer M1 Fix 2 and Explorer M1 Fix 3. The code changes recommended here for Defects 1 and 4 are completely modular and do not collide with or conflict with those fixes.
2. **Adversarial Test Suite Updates**:
   - In `src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts`, tests at line 106 and line 243 were authored to *demonstrate* the bugs by asserting the buggy output (`expect(items[0].taxPercent).toBe(5)` and `expect(parsed.items.length).toBe(1)`).
   - When the fixes are implemented, those tests MUST be updated to assert the corrected behavior (`taxPercent: 12` and `items.length: 2`).
3. **Negative Line Items (Credit Notes / Returns)**:
   - Indian wholesale invoices with returns or credit adjustments may have negative values. The current number sanitizer strips minus signs. Handled as a documented caveat since purchase bills for stock intake are positive transactions.

---

## 4. Conclusion & Recommended Fix Strategy

### 4.1 Exact Recommended Code Change: Defect 4 (Multi-Page Loop Break)
**Target File**: `src/lib/scanner/pharma-invoice-heuristics.ts`  
**Target Function**: `parseInvoiceLineItems(lines: string[])`  
**Lines**: 260–274  

**Replace existing lines 260–274 with**:
```typescript
    const upper = rawLine.toUpperCase()

    // Break only on true terminal invoice footer boundaries (grand totals, bank details, terms)
    if (
      upper.startsWith('GRAND TOTAL') ||
      upper.startsWith('NET PAYABLE') ||
      upper.startsWith('NET AMOUNT') ||
      upper.startsWith('TOTAL AMOUNT') ||
      upper.startsWith('BANK DETAILS') ||
      upper.startsWith('TERMS & CONDITIONS') ||
      upper.startsWith('FOR ') ||
      upper.startsWith('AUTHORIZED SIGNATORY')
    ) {
      break
    }

    // Skip section subtotals, tax summaries, page markers, and continuation labels across multi-page invoices
    if (
      upper.startsWith('SUB-TOTAL') ||
      upper.startsWith('SUB TOTAL') ||
      upper.startsWith('PAGE TOTAL') ||
      upper.startsWith('TAXABLE AMOUNT') ||
      upper.startsWith('TOTAL TAX') ||
      upper.startsWith('CGST') ||
      upper.startsWith('SGST') ||
      upper.startsWith('IGST') ||
      /^(?:--+|\=\=+|\*\*\+)?\s*PAGE\s*\d+/i.test(upper) ||
      upper.includes('CONTINUED')
    ) {
      continue
    }

    // Skip repeated table header lines on subsequent pages
    if (
      (upper.includes('ITEM') || upper.includes('PRODUCT') || upper.includes('DESCRIPTION') || upper.includes('PARTICULARS')) &&
      (upper.includes('BATCH') || upper.includes('B.NO') || upper.includes('LOT') || upper.includes('QTY')) &&
      (upper.includes('RATE') || upper.includes('MRP') || upper.includes('EXPIRY'))
    ) {
      continue
    }
```

---

### 4.2 Exact Recommended Code Change: Defect 1 (GST % vs Discount % Collision)
**Target File**: `src/lib/scanner/pharma-invoice-heuristics.ts`  
**Target Function**: `tryParseItemFromLine(...)`  
**Lines**: 390–401  

**Replace existing lines 390–401 with**:
```typescript
  // Extract explicit percentages (Discount % and GST %) from afterExpiry (falling back to rawLine)
  // Scoping to afterExpiry eliminates collisions with active medicine concentration percentages (e.g. Dextrose 5%)
  const pctSource = afterExpiry.includes('%') ? afterExpiry : rawLine
  const pctMatches = Array.from(pctSource.matchAll(/(\d+(?:\.\d+)?)\s*%/g))

  if (pctMatches.length >= 2) {
    // Standard pharmaceutical wholesale layout: Discount % precedes GST % slab (e.g. "5% 12%" or "0% 12%")
    discountPercent = parseFloat(pctMatches[0][1])
    taxPercent = parseFloat(pctMatches[pctMatches.length - 1][1])
  } else if (pctMatches.length === 1) {
    const val = parseFloat(pctMatches[0][1])
    if ([0, 5, 12, 18, 28].includes(val)) {
      taxPercent = val
    } else {
      discountPercent = val
    }
  }
```

---

### 4.3 Recommended Updates to Adversarial Test Suite
**Target File**: `src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts`

1. **Update Test 19 (Line 243–256)**:
```typescript
    it('correctly resolves distinct discount % and tax % without collision when both use % signs', () => {
      const lineWithCollidingPercentages = "MEDICINE A 10'S 3004 B01 08/28 40 4 100.00 150.00 5% 12% 4256.00"
      const items = parseInvoiceLineItems([
        'ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP DISC% GST% TOTAL',
        lineWithCollidingPercentages,
      ])
      expect(items.length).toBe(1)
      expect(items[0].discountPercent).toBe(5)
      expect(items[0].taxPercent).toBe(12)
      expect(items[0].taxAmount).toBe(456.0)
      expect(items[0].totalAmount).toBe(4256.0)
    })
```

2. **Update Test 22 (Line 106–126)**:
```typescript
    it('correctly parses line items across multiple pages when intermediate SUB-TOTAL occurs', () => {
      const multiPageText = `
TAX INVOICE
MAHAVEER PHARMA AGENCIES PVT LTD           INV: MP-101
GSTIN: 29AABCM8921F1ZT                     DATE: 10/10/2026
--------------------------------------------------------------------------------
ITEM DESCRIPTION        PACK   HSN   BATCH   EXPIRY   QTY  FREE   RATE     MRP   DISC% GST%
AUGMENTIN 625 DUO       10'S   3004  BAT01   08/28     50     0  150.00  200.00  0.00  12%
SUB-TOTAL PAGE 1: 7500.00
--------------------------------- PAGE 2 ---------------------------------------
PAN 40 TABLETS          15'S   3004  BAT02   11/27     40     0  100.00  140.00  0.00  12%
GRAND TOTAL: 11500.00
`
      const parsed = parsePharmaInvoiceText(multiPageText)
      expect(parsed.items.length).toBe(2)
      expect(parsed.items[0].batchNumber).toBe('BAT01')
      expect(parsed.items[1].batchNumber).toBe('BAT02')
      expect(parsed.items[1].rawDescription).toContain('PAN 40 TABLETS')
      expect(parsed.items[1].billedQuantity).toBe(40)
      expect(parsed.items[1].unitCost).toBe(100.0)
    })
```

---

## 5. Verification Method

To independently verify that the fixes completely resolve Defects 1 and 4 without regressions:

1. **Run Scanner Unit & API Route Tests**:
   ```powershell
   npx jest src/lib/scanner/__tests__/purchase-bill-parser.test.ts src/app/api/purchases/scan/__tests__/scan-routes.test.ts --forceExit
   ```
   *Expected*: All 33 unit tests pass.

2. **Run Purchase Bill Scanning E2E Suite**:
   ```powershell
   npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit
   ```
   *Expected*: All 53 E2E tests pass.

3. **Run Production Enhancements E2E Suite**:
   ```powershell
   npx jest src/__tests__/e2e/production-enhancements-e2e.test.ts --forceExit
   ```
   *Expected*: All 52 E2E tests pass.

4. **Run Challenger 1 & 2 Adversarial Verification Suites**:
   ```powershell
   npx jest src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts src/lib/scanner/__tests__/adversarial-m1-verification.test.ts --forceExit
   ```
   *Expected*: All 44 tests pass.

5. **Lint Verification**:
   ```powershell
   npx eslint src/lib/scanner/pharma-invoice-heuristics.ts src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts
   ```
   *Expected*: 0 errors, 0 warnings.
