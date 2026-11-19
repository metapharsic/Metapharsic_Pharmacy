# Exploration Report & Remediation Strategy: Milestone M1 Ingestion & Parsing Pipeline

**Explorer**: Explorer M1 Fix 3  
**Date**: 2026-11-03T12:50:00Z  
**Target Milestone**: M1 (Ingestion & Document Parsing Pipeline)  
**Assigned Scope**: Defect 5 (Blank text confidence bonus & reconciled state) + Consolidated Remediation Strategy across all 5 defects and TypeScript PSM warning.

---

## 1. Observation

Direct empirical observations gathered from inspecting code, executing test suites, running static type checkers, and analyzing Challenger 1 / Reviewer 1 findings:

### 1.1 Direct Observations by Defect

#### Defect 1: GST % vs Discount % Overwrite Collision
- **File**: `src/lib/scanner/pharma-invoice-heuristics.ts`, lines 390–401
- **Verbatim Code**:
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
- **Observed Behavior**:
  For line `"MEDICINE A 10'S 3004 B01 08/28 40 4 100.00 150.00 5% 12% 4256.00"`, `gstMatch` executes a left-to-right search on `rawLine` and matches `"5%"`. Because `5` is in `(0|5|12|18|28)`, `taxPercent` is overwritten to `5` instead of `12`. `discMatch` also matches `"5%"`. Both evaluate to 5%, corrupting tax calculation and total variance.

#### Defect 2: 0 Billed Quantity Coerced to 1
- **File**: `src/lib/scanner/pharma-invoice-heuristics.ts`, line 373
- **Verbatim Code**:
  ```typescript
  billedQuantity = Math.floor(numbersInAfter[0]) || 1
  ```
- **Observed Behavior**:
  In promotional bonus-only lines (`"PROMOTIONAL SAMPLE 10'S 3004 SAM01 08/28 0 5 0.00 0.00 0.00 0% 0.00"`), `numbersInAfter[0]` is `0`. In JavaScript, `Math.floor(0) || 1` evaluates to `1`. Consequently, 0 billed units become 1 billed unit, generating phantom inventory and erroneous accounts payable liability.

#### Defect 3: Scheme Syntax (`QTY+FREE`) Data Loss & Description Collision
- **File**: `src/lib/scanner/pharma-invoice-heuristics.ts`, lines 367–374
- **Verbatim Code**:
  ```typescript
  const schemeMatch = rawLine.match(/(\d+)\s*\+\s*(\d+)/)
  if (schemeMatch) {
    billedQuantity = parseInt(schemeMatch[1], 10)
    freeQuantity = parseInt(schemeMatch[2], 10)
  } else if (numbersInAfter.length >= 2) {
    // If standard table columns: Qty, Free, Rate, MRP, ...
  ```
- **Observed Behavior**:
  1. `schemeMatch` tests `rawLine`, which contains medicine brand descriptions before expiry. A product named `"ACECLOFENAC + PARACETAMOL 100+325"` matches `100+325`, mistakenly setting `billedQuantity = 100` and `freeQuantity = 325`.
  2. Because of `if (schemeMatch) ... else if (numbersInAfter.length >= 2)`, when a legitimate scheme like `50+5` matches, the parser branches into the `if` and completely skips extracting `unitCost` and `mrp`, leaving `unitCost = 0.00` and `mrp = 100` (fallback).

#### Defect 4: Multi-Page Early Truncation on Sub-Total
- **File**: `src/lib/scanner/pharma-invoice-heuristics.ts`, lines 260–274
- **Verbatim Code**:
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
- **Observed Behavior**:
  When processing multi-page documents where Page 1 ends with `"SUB-TOTAL PAGE 1: 7500.00"` or `"SUB-TOTAL C/F"`, the loop executes `break`, dropping all line items on Page 2 and subsequent pages.

#### Defect 5: Blank Text Confidence Bonus & Empty Invoice Reconciled State
- **File**: `src/lib/scanner/pharma-invoice-heuristics.ts`, lines 575–577, 604–612
- **Verbatim Code**:
  ```typescript
  const reconciliationVariance = round2(Math.abs(computedGrandTotal - effectiveGrandTotal))
  // Reconciled if variance is within Rs. 1.00 (standard rounding tolerance)
  const isReconciled = reconciliationVariance <= 1.0
  ```
  ```typescript
  let score = 0.2 // baseline for text presence
  if (supplier.gstin) score += 0.25
  if (supplier.dlNumber) score += 0.15
  if (invoice.invoiceNumber && !invoice.invoiceNumber.startsWith('INV-')) score += 0.1
  if (items.length > 0) score += 0.15
  if (financials.isReconciled) score += 0.15

  const overallConfidence = round2(Math.min(1.0, score))
  ```
- **Observed Behavior**:
  Calling `parsePharmaInvoiceText("")` or with pure whitespace returns `items = []`. `computedGrandTotal = 0`, `effectiveGrandTotal = 0`, so `reconciliationVariance = 0`. Because `0 <= 1.0`, `isReconciled` is marked `true`. The parser awards `0.2` (baseline) + `0.15` (`financials.isReconciled`), yielding `overallConfidence: 0.35` for a completely blank string!

#### TypeScript Typing Mismatch (`TS2322`)
- **File**: `src/lib/scanner/purchase-bill-parser.ts`, line 360
- **Verbatim Error**:
  ```text
  src/lib/scanner/purchase-bill-parser.ts(360,7): error TS2322: Type '"6"' is not assignable to type 'PSM | undefined'.
  ```
- **Verbatim Code**:
  ```typescript
  await worker.setParameters({
    tessedit_pageseg_mode: '6', // Uniform block of text
  })
  ```
- **Concurrent Execution Risk** (Reviewer 1 Finding 2):
  `getCachedTesseractWorker()` checks `if (!cachedWorkerInstance)` synchronously, leaving a window during asynchronous initialization where multiple worker instances can be initialized concurrently.

### 1.2 Adversarial Test Suite State
- **File**: `src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts`
- **Observed Behavior**:
  Lines 78, 123, 254, 280, 295 assert the *defective* behaviors:
  - Line 78: `expect(emptyResult.overallConfidence).toBe(0.35)`
  - Line 123: `expect(parsed.items.length).toBe(1)` (Page 2 item excluded)
  - Line 254: `expect(items[0].taxPercent).toBe(5)`
  - Line 280: `expect(items[0].billedQuantity).toBe(1)`
  - Line 295: `expect(items[0].unitCost).toBe(0)`
- **Impact**: Fixing the code without updating these test assertions would cause test failures because the test suite was intentionally written by Challenger 1 to demonstrate the bugs.

---

## 2. Logic Chain

1. **Premise**: An OCR and invoice ingestion engine must extract accurate mathematical values, prevent false-positive confidence on blank streams, capture items across multi-page invoices, and maintain clean TypeScript compilation.
2. **Defect 1 Reasoning**:
   - In standard Indian wholesale invoices, column order is `... Rate | MRP | Disc% | GST% | Total`.
   - Matching any percentage against `\b(0|5|12|18|28)\s*%` first causes discounts of 0%, 5%, 12%, 18% to be misclassified as tax rates.
   - Solution: Extract all percentage tokens in sequence from `afterExpiry` (or line). If 2 percentages are present, the first is discount % and the second is GST %. If 1 percentage is present, inspect prefix context (`DISC`, `CD`, `TD`); if preceded by discount label, assign to discount, otherwise assign to GST if in standard slabs `[0, 5, 12, 18, 28]`.
3. **Defect 2 Reasoning**:
   - `0` is a falsy value in JavaScript.
   - Using `Math.floor(numbersInAfter[0]) || 1` unconditionally replaces valid 0 quantities with 1.
   - Solution: Use `!isNaN(numbersInAfter[0]) ? Math.max(0, Math.floor(numbersInAfter[0])) : 1`.
4. **Defect 3 Reasoning**:
   - Medicine brand names frequently contain dosages separated by `+` (e.g. `ACECLOFENAC + PARACETAMOL 100+325`).
   - Line-level regex matching captures `100+325` as scheme quantities before reaching expiry.
   - Solution: Only evaluate `schemeMatch` on `afterExpiry`. When matched, parse remaining numeric tokens in `afterExpiry` to populate `unitCost`, `mrp`, and line totals.
5. **Defect 4 Reasoning**:
   - Multi-page invoices routinely print `SUB-TOTAL PAGE 1`, `SUB-TOTAL C/F`, or `TAXABLE AMOUNT` at page boundaries.
   - Breaking the loop on `SUB-TOTAL` drops all subsequent pages.
   - Solution: Use `continue` for `SUB-TOTAL`, `SUB TOTAL`, `SUBTOTAL`, `PAGE`, `TAXABLE AMOUNT`, `TOTAL TAX`. Only `break` on true terminal footers (`GRAND TOTAL`, `NET PAYABLE`, `BANK DETAILS`, `TERMS & CONDITIONS`).
6. **Defect 5 Reasoning**:
   - Empty input text represents zero information.
   - An empty invoice cannot be reconciled (`items.length === 0`).
   - Solution:
     1. In `reconcileFinancials`: `isReconciled = items.length > 0 && reconciliationVariance <= 1.0`.
     2. In `parsePharmaInvoiceText`: If `!text || !text.trim()`, return immediately with `items: []`, `overallConfidence: 0.0`, and `financials.isReconciled: false`.
7. **TypeScript & Concurrency Reasoning**:
   - `worker.setParameters` expects `PSM` enum from `tesseract.js`.
   - A promise-based singleton pattern `cachedWorkerPromise` ensures single-instance initialization under concurrent requests while passing `(PSM?.SINGLE_BLOCK ?? '6') as any` or `PSM.SINGLE_BLOCK`.

---

## 3. Caveats

1. **Other Workspace TypeScript Errors**:
   Running `npm run type-check` reveals pre-existing typing errors in unrelated files (e.g., `generate_dummy.ts`, `multithreaded_pos_wiring_and_validation.ts`, `receipt-invoice.tsx`). The only error in the scanner module is `purchase-bill-parser.ts(360,7)`. The Worker should strictly focus on the scanner files.
2. **Negative Rates (Credit Notes)**:
   The number sanitizer strips `-` for rates. Purchase bills are almost universally positive debits; debit notes / returns should be handled via a dedicated credit memo workflow if needed in future milestones.
3. **No other caveats**: The 5 defects and the TS warning have unambiguous, deterministic solutions.

---

## 4. Conclusion & Remediation Instructions for Fix Worker

Worker M1 must apply exact edits to three files:
1. `src/lib/scanner/pharma-invoice-heuristics.ts`
2. `src/lib/scanner/purchase-bill-parser.ts`
3. `src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts`

### 4.1 Target 1: `src/lib/scanner/pharma-invoice-heuristics.ts`

#### Edit 1.1: Multi-Page Non-Truncation (Lines 260–274)
Replace:
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
With:
```typescript
    const upper = rawLine.toUpperCase()

    // Skip page subtotals or intermediate tax summary rows instead of breaking
    if (
      upper.startsWith('SUB-TOTAL') ||
      upper.startsWith('SUB TOTAL') ||
      upper.startsWith('SUBTOTAL') ||
      upper.includes('PAGE') ||
      upper.startsWith('TOTAL TAX') ||
      upper.startsWith('TAXABLE AMOUNT')
    ) {
      continue
    }

    // Break only on true terminal invoice footers
    if (
      upper.startsWith('GRAND TOTAL') ||
      upper.startsWith('NET PAYABLE') ||
      upper.startsWith('NET AMOUNT') ||
      upper.startsWith('TOTAL AMOUNT') ||
      upper.startsWith('AMOUNT CHARGEABLE') ||
      upper.startsWith('BANK DETAILS') ||
      upper.startsWith('TERMS & CONDITIONS') ||
      upper.startsWith('TERMS AND CONDITIONS') ||
      upper.startsWith('FOR ') ||
      upper.startsWith('AUTHORISED SIGNATORY')
    ) {
      break
    }
```

#### Edit 1.2: Scheme Syntax, 0 Billed Qty, and Dual % Collision (Lines 359–402)
Replace:
```typescript
  let billedQuantity = 1
  let freeQuantity = 0
  let unitCost = 0
  let mrp = 0
  let discountPercent = 0
  let taxPercent = 12

  // Look for explicit free qty or scheme (e.g. 50+5 or "QTY FREE")
  const schemeMatch = rawLine.match(/(\d+)\s*\+\s*(\d+)/)
  if (schemeMatch) {
    billedQuantity = parseInt(schemeMatch[1], 10)
    freeQuantity = parseInt(schemeMatch[2], 10)
  } else if (numbersInAfter.length >= 2) {
    // If standard table columns: Qty, Free, Rate, MRP, ...
    billedQuantity = Math.floor(numbersInAfter[0]) || 1
    if (numbersInAfter.length >= 4) {
      freeQuantity = Math.floor(numbersInAfter[1]) || 0
      unitCost = numbersInAfter[2] || 0
      mrp = numbersInAfter[3] || 0
      if (numbersInAfter.length >= 6) {
        discountPercent = numbersInAfter[4] || 0
        taxPercent = numbersInAfter[5] || 12
      } else if (numbersInAfter.length === 5) {
        taxPercent = numbersInAfter[4] || 12
      }
    } else {
      unitCost = numbersInAfter[1] || 0
      mrp = numbersInAfter[2] || unitCost * 1.3
    }
  }

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
With:
```typescript
  let billedQuantity = 1
  let freeQuantity = 0
  let unitCost = 0
  let mrp = 0
  let discountPercent = 0
  let taxPercent = 12

  // Defect 3 Fix: Only match scheme syntax (e.g. 50+5) in afterExpiry
  // to prevent matching combination medicine dosages (e.g. 100+325) in product description
  const schemeMatch = afterExpiry.match(/(\d+)\s*\+\s*(\d+)/)
  if (schemeMatch) {
    billedQuantity = parseInt(schemeMatch[1], 10)
    freeQuantity = parseInt(schemeMatch[2], 10)

    // Extract unitCost and mrp from tokens remaining after scheme syntax
    const remainingAfterScheme = afterExpiry.replace(schemeMatch[0], ' ')
    const numbersAfterScheme = remainingAfterScheme
      .split(/\s+/)
      .map((w) => w.replace(/[^\d\.]/g, ''))
      .filter((w) => w.length > 0)
      .map(Number)
      .filter((n) => !isNaN(n))

    if (numbersAfterScheme.length >= 2) {
      unitCost = numbersAfterScheme[0] || 0
      mrp = numbersAfterScheme[1] || round2(unitCost * 1.35)
      if (numbersAfterScheme.length >= 4) {
        discountPercent = numbersAfterScheme[2] || 0
        taxPercent = numbersAfterScheme[3] || 12
      } else if (numbersAfterScheme.length === 3) {
        taxPercent = numbersAfterScheme[2] || 12
      }
    } else if (numbersAfterScheme.length === 1) {
      unitCost = numbersAfterScheme[0] || 0
      mrp = round2(unitCost * 1.35)
    }
  } else if (numbersInAfter.length >= 2) {
    // Defect 2 Fix: Explicitly preserve 0 billed quantity for promotional samples
    billedQuantity = !isNaN(numbersInAfter[0]) ? Math.max(0, Math.floor(numbersInAfter[0])) : 1
    if (numbersInAfter.length >= 4) {
      freeQuantity = !isNaN(numbersInAfter[1]) ? Math.max(0, Math.floor(numbersInAfter[1])) : 0
      unitCost = numbersInAfter[2] || 0
      mrp = numbersInAfter[3] || 0
      if (numbersInAfter.length >= 6) {
        discountPercent = numbersInAfter[4] || 0
        taxPercent = numbersInAfter[5] || 12
      } else if (numbersInAfter.length === 5) {
        taxPercent = numbersInAfter[4] || 12
      }
    } else {
      unitCost = numbersInAfter[1] || 0
      mrp = numbersInAfter[2] || round2(unitCost * 1.35)
    }
  }

  // Defect 1 Fix: Disambiguate Discount % and GST % without collision
  const pctMatches = Array.from(afterExpiry.matchAll(/(\d+(?:\.\d+)?)\s*%/g))
  if (pctMatches.length >= 2) {
    // Standard wholesale format: discount precedes GST (e.g. Rate MRP Disc% GST%)
    discountPercent = parseFloat(pctMatches[0][1])
    taxPercent = parseFloat(pctMatches[1][1])
  } else if (pctMatches.length === 1) {
    const val = parseFloat(pctMatches[0][1])
    const idx = afterExpiry.indexOf(pctMatches[0][0])
    const beforePct = afterExpiry.slice(0, idx).toUpperCase()
    if (beforePct.includes('DISC') || beforePct.includes('CD') || beforePct.includes('TD')) {
      discountPercent = val
    } else if ([0, 5, 12, 18, 28].includes(val)) {
      taxPercent = val
    } else {
      discountPercent = val
    }
  }
```

#### Edit 1.3: Empty Invoice Reconciliation State & Confidence (Lines 575–615)
In `reconcileFinancials`:
Replace:
```typescript
  const reconciliationVariance = round2(Math.abs(computedGrandTotal - effectiveGrandTotal))
  // Reconciled if variance is within Rs. 1.00 (standard rounding tolerance)
  const isReconciled = reconciliationVariance <= 1.0
```
With:
```typescript
  const reconciliationVariance = round2(Math.abs(computedGrandTotal - effectiveGrandTotal))
  // Reconciled only if there are items and variance is within Rs. 1.00 (standard rounding tolerance)
  const isReconciled = items.length > 0 && reconciliationVariance <= 1.0
```

In `parsePharmaInvoiceText`:
Replace:
```typescript
export function parsePharmaInvoiceText(text: string): ParsedInvoiceData {
  const lines = text.split(/\r?\n/)
  const { supplier, invoice } = parseInvoiceHeader(text)
  const items = parseInvoiceLineItems(lines)
  const financials = reconcileFinancials(items, text)
```
With:
```typescript
export function parsePharmaInvoiceText(text: string): ParsedInvoiceData {
  const trimmed = text ? text.trim() : ''
  if (!trimmed) {
    const { supplier, invoice } = parseInvoiceHeader('')
    return {
      supplier: {
        ...supplier,
        matchConfidence: 0.0,
      },
      invoice,
      items: [],
      financials: {
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        roundOff: 0,
        totalAmount: 0,
        isReconciled: false,
        reconciliationVariance: 0,
      },
      overallConfidence: 0.0,
    }
  }

  const lines = text.split(/\r?\n/)
  const { supplier, invoice } = parseInvoiceHeader(text)
  const items = parseInvoiceLineItems(lines)
  const financials = reconcileFinancials(items, text)
```

### 4.2 Target 2: `src/lib/scanner/purchase-bill-parser.ts`

#### Edit 2.1: TypeScript Warning & Synchronized Worker Singleton (Lines 350–365)
Replace:
```typescript
let cachedWorkerInstance: TesseractWorkerHandle | null = null

/**
 * Gets or initializes a cached Tesseract.js worker with pharma-optimized PSM.
 */
async function getCachedTesseractWorker(): Promise<TesseractWorkerHandle> {
  if (!cachedWorkerInstance) {
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('eng')
    await worker.setParameters({
      tessedit_pageseg_mode: '6', // Uniform block of text
    })
    cachedWorkerInstance = worker as unknown as TesseractWorkerHandle
  }
  return cachedWorkerInstance
}
```
With:
```typescript
let cachedWorkerPromise: Promise<TesseractWorkerHandle> | null = null

/**
 * Gets or initializes a cached Tesseract.js worker with pharma-optimized PSM.
 * Uses a promise-based singleton to ensure thread-safe initialization during concurrent requests.
 */
async function getCachedTesseractWorker(): Promise<TesseractWorkerHandle> {
  if (!cachedWorkerPromise) {
    cachedWorkerPromise = (async () => {
      const { createWorker, PSM } = await import('tesseract.js')
      const worker = await createWorker('eng')
      await worker.setParameters({
        tessedit_pageseg_mode: (PSM?.SINGLE_BLOCK ?? '6') as any, // Uniform block of text
      })
      return worker as unknown as TesseractWorkerHandle
    })()
  }
  return cachedWorkerPromise
}
```

### 4.3 Target 3: `src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts`

Update the 5 tests that previously asserted the defective behavior so they assert defect resolution:
1. **Lines 73–83**: Update empty string and whitespace test:
   ```typescript
   expect(emptyResult.items).toEqual([])
   expect(emptyResult.financials.isReconciled).toBe(false)
   expect(emptyResult.overallConfidence).toBe(0.0)

   expect(whitespaceResult.items).toEqual([])
   expect(whitespaceResult.financials.isReconciled).toBe(false)
   expect(whitespaceResult.overallConfidence).toBe(0.0)
   ```
2. **Lines 106–126**: Update multi-page test:
   ```typescript
   // Multi-page subtotal no longer terminates line item parsing
   expect(parsed.items.length).toBe(2)
   expect(parsed.items[0].batchNumber).toBe('BAT01')
   expect(parsed.items[1].batchNumber).toBe('BAT02')
   ```
3. **Lines 238–255**: Update dual percentage collision test:
   ```typescript
   expect(items.length).toBe(1)
   expect(items[0].discountPercent).toBe(5)
   expect(items[0].taxPercent).toBe(12) // Verified: 12% GST not overwritten
   expect(items[0].totalAmount).toBe(4256.00)
   ```
4. **Lines 269–282**: Update promotional 0 billed quantity test:
   ```typescript
   expect(items.length).toBe(1)
   expect(items[0].billedQuantity).toBe(0) // Verified: 0 quantity preserved
   expect(items[0].freeQuantity).toBe(5)
   ```
5. **Lines 284–297**: Update scheme syntax test:
   ```typescript
   expect(items.length).toBe(1)
   expect(items[0].billedQuantity).toBe(50)
   expect(items[0].freeQuantity).toBe(5)
   expect(items[0].unitCost).toBe(140.00) // Verified: unitCost parsed
   expect(items[0].mrp).toBe(200.00) // Verified: mrp parsed
   expect(items[0].taxPercent).toBe(12)
   ```
6. **Add new test**: Combination medicine with `+` in description:
   ```typescript
   it('does not confuse combination medicine dosage with free goods scheme', () => {
     const line = "ACECLOFENAC + PARACETAMOL 100+325 TAB 10'S 3004 B1 08/28 10 0 100.00 150.00 12% 1120.00"
     const items = parseInvoiceLineItems([
       'ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP DISC% GST% TOTAL',
       line,
     ])
     expect(items.length).toBe(1)
     expect(items[0].billedQuantity).toBe(10)
     expect(items[0].freeQuantity).toBe(0)
     expect(items[0].unitCost).toBe(100.00)
     expect(items[0].mrp).toBe(150.00)
     expect(items[0].taxPercent).toBe(12)
   })
   ```

---

## 5. Verification Method

To independently verify the complete fix after the Worker implements it:

1. **Adversarial Test Suite Verification**:
   ```powershell
   npx jest src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts --forceExit
   ```
   *Expected Result*: All 26 tests PASS cleanly.

2. **Full Scanner & Scan API Test Suite Execution**:
   ```powershell
   npx jest src/lib/scanner/__tests__/purchase-bill-parser.test.ts src/app/api/purchases/scan/__tests__/scan-routes.test.ts src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts src/lib/scanner/__tests__/adversarial-m1-verification.test.ts --forceExit
   ```
   *Expected Result*: 4 test suites pass, 0 failures.

3. **Scanner TypeScript Static Validation**:
   ```powershell
   npx tsc --noEmit
   ```
   *Expected Result*: Zero errors reported for `src/lib/scanner/purchase-bill-parser.ts` (specifically TS2322 is resolved).

4. **Lint Verification**:
   ```powershell
   npx eslint src/lib/scanner/pharma-invoice-heuristics.ts src/lib/scanner/purchase-bill-parser.ts src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts
   ```
   *Expected Result*: 0 errors, 0 warnings.
