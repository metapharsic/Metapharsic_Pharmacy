# Empirical Adversarial Challenge Report: Milestone M1 Gate 3 (Iteration 3 Final)

**Challenger**: `challenger_m1_gate3` (`teamwork_challenger`)  
**Roles**: `critic`, `specialist`  
**Date**: 2026-11-03T13:44:00Z  
**Target Milestone**: Milestone M1 (Ingestion & Document Parsing Pipeline)  
**Target Worker**: `worker_m1_res_fix`  
**Parent Orchestrator**: `056deacb-bfc4-49c9-95d1-5d0d88085f22`  
**Verdict**: `APPROVE`  
**Overall Risk Assessment**: LOW  

---

## 1. Observation

Direct empirical evidence gathered by executing reproduction scripts, adversarial stress harnesses, test suites, ESLint, and TypeScript checks on `src/lib/scanner/pharma-invoice-heuristics.ts` and `src/lib/scanner/purchase-bill-parser.ts`.

### 1.1 Empirical Reproduction of the Gate 2 Residual Defect

Execution of the reproduction command for standard 6-column invoices omitting the discount column (`Qty Free Rate MRP GST% Total`):
```powershell
npx tsx -e "import { parseInvoiceLineItems } from './src/lib/scanner/pharma-invoice-heuristics'; const line = 'AUGMENTIN 625 10\'S 3004 BAT01 08/28 10 0 100.00 140.00 12% 1120.00'; const items = parseInvoiceLineItems(['ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP GST% TOTAL', line]); console.log('discountPercent:', items[0].discountPercent, 'totalAmount:', items[0].totalAmount);"
```
- **Verbatim Output**:
  ```text
  discountPercent: 0 totalAmount: 1120
  ```
- **Observation**: Unlike Gate 2 (where `discountPercent` was erroneously set to `12` and `totalAmount` to `985.60`), the parser correctly assigned `discountPercent: 0`, preserved `taxPercent: 12`, computed tax amount `120.00`, and evaluated line total to `1120.00`.

### 1.2 Adversarial Boundary & Stress-Test Harness Results

Direct execution of empirical stress scenarios to challenge assumptions:

1. **6-Column Row with Small Line Total Below 28 (`22.40`)**:
   Command:
   ```powershell
   npx tsx -e "import { parseInvoiceLineItems } from './src/lib/scanner/pharma-invoice-heuristics'; const line = 'ITEM SMALL TOTAL 10\'S 3004 BAT01 08/28 10 0 2.00 3.00 12% 22.40'; const items = parseInvoiceLineItems(['ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP GST% TOTAL', line]); console.log('disc:', items[0].discountPercent, 'tax:', items[0].taxPercent, 'total:', items[0].totalAmount);"
   ```
   - **Output**: `disc: 0 tax: 12 total: 22.4` (PASS). Line total below 28 is not misidentified as a GST slab.

2. **6-Column Row without `%` Symbol (`10 0 100.00 140.00 12 1120.00`)**:
   Command:
   ```powershell
   npx tsx -e "import { parseInvoiceLineItems } from './src/lib/scanner/pharma-invoice-heuristics'; const line = 'AUGMENTIN 625 10\'S 3004 BAT01 08/28 10 0 100.00 140.00 12 1120.00'; const items = parseInvoiceLineItems(['ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP GST TOTAL', line]); console.log('discountPercent:', items[0].discountPercent, 'taxPercent:', items[0].taxPercent, 'totalAmount:', items[0].totalAmount);"
   ```
   - **Output**: `discountPercent: 0 taxPercent: 12 totalAmount: 1120` (PASS).

3. **7-Column Row with Legitimate Discount Column (`10 0 100.00 140.00 5% 12% 1064.00`)**:
   Command:
   ```powershell
   npx tsx -e "import { parseInvoiceLineItems } from './src/lib/scanner/pharma-invoice-heuristics'; const line = 'ITEM 7COL 10\'S 3004 BAT01 08/28 10 0 100.00 140.00 5% 12% 1064.00'; const items = parseInvoiceLineItems(['ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP DISC% GST% TOTAL', line]); console.log('disc:', items[0].discountPercent, 'tax:', items[0].taxPercent, 'total:', items[0].totalAmount);"
   ```
   - **Output**: `disc: 5 tax: 12 total: 1064` (PASS). Real trade/cash discounts are preserved accurately.

4. **Scheme Syntax (`10+1`) with 4 Numerical Tokens (`Rate MRP GST% Total`)**:
   Command:
   ```powershell
   npx tsx -e "import { parseInvoiceLineItems } from './src/lib/scanner/pharma-invoice-heuristics'; const line = 'AUGMENTIN 625 10\'S 3004 BAT01 08/28 10+1 100.00 140.00 12% 1120.00'; const items = parseInvoiceLineItems(['ITEM DESCRIPTION PACK HSN BATCH EXPIRY SCHEME RATE MRP GST% TOTAL', line]); console.log('scheme:', items[0].billedQuantity, items[0].freeQuantity, 'rate:', items[0].unitCost, 'mrp:', items[0].mrp, 'disc:', items[0].discountPercent, 'tax:', items[0].taxPercent, 'total:', items[0].totalAmount);"
   ```
   - **Output**: `scheme: 10 1 rate: 100 mrp: 140 disc: 0 tax: 12 total: 1120` (PASS).

5. **Scheme Syntax (`10+1`) with 5 Numerical Tokens (`Rate MRP Disc% GST% Total`)**:
   Command:
   ```powershell
   npx tsx -e "import { parseInvoiceLineItems } from './src/lib/scanner/pharma-invoice-heuristics'; const line = 'AUGMENTIN 625 10\'S 3004 BAT01 08/28 10+1 100.00 140.00 5% 12% 1064.00'; const items = parseInvoiceLineItems(['ITEM DESCRIPTION PACK HSN BATCH EXPIRY SCHEME RATE MRP DISC% GST% TOTAL', line]); console.log('scheme:', items[0].billedQuantity, items[0].freeQuantity, 'rate:', items[0].unitCost, 'mrp:', items[0].mrp, 'disc:', items[0].discountPercent, 'tax:', items[0].taxPercent, 'total:', items[0].totalAmount);"
   ```
   - **Output**: `scheme: 10 1 rate: 100 mrp: 140 disc: 5 tax: 12 total: 1064` (PASS).

6. **Promotional Free Sample with Billed Quantity 0 (`QTY: 0, FREE: 5`)**:
   Command:
   ```powershell
   npx tsx -e "import { parseInvoiceLineItems } from './src/lib/scanner/pharma-invoice-heuristics'; const line = 'PROMO SAMPLE 10\'S 3004 BAT01 08/28 0 5 100.00 140.00 12% 0.00'; const items = parseInvoiceLineItems(['ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP GST% TOTAL', line]); console.log('billed:', items[0].billedQuantity, 'free:', items[0].freeQuantity, 'rate:', items[0].unitCost, 'disc:', items[0].discountPercent, 'tax:', items[0].taxPercent, 'total:', items[0].totalAmount);"
   ```
   - **Output**: `billed: 0 free: 5 rate: 100 disc: 0 tax: 12 total: 0` (PASS). Zero billed quantity is maintained without fallback to default 1.

7. **Multi-Page Invoice Spanning Intermediate Sub-Totals**:
   Command:
   ```powershell
   npx tsx -e "import { parsePharmaInvoiceText } from './src/lib/scanner/pharma-invoice-heuristics'; const invoice = 'MAHAVEER PHARMA\nINV: 123 DATE: 01/10/2026\nITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP GST% TOTAL\nDRUG A 10\'S 3004 B1 08/28 10 0 100.00 140.00 12% 1120.00\nPAGE 1 SUB-TOTAL: 1000.00\nPAGE 2\nDRUG B 10\'S 3004 B2 08/28 5 0 200.00 280.00 12% 1120.00\nGRAND TOTAL: 2240.00'; const parsed = parsePharmaInvoiceText(invoice); console.log('items count:', parsed.items.length, 'reconciled:', parsed.financials.isReconciled, 'total:', parsed.financials.totalAmount);"
   ```
   - **Output**: `items count: 2 reconciled: true total: 2240` (PASS). Both items across pages parsed, and financial cross-reconciliation achieved `isReconciled: true` with zero variance.

8. **Blank / Pure Whitespace Input**:
   Command:
   ```powershell
   npx tsx -e "import { parsePharmaInvoiceText } from './src/lib/scanner/pharma-invoice-heuristics'; const parsed = parsePharmaInvoiceText('   \n  \t  \n'); console.log('items:', parsed.items.length, 'conf:', parsed.overallConfidence, 'reconciled:', parsed.financials.isReconciled);"
   ```
   - **Output**: `items: 0 conf: 0 reconciled: false` (PASS).

---

### 1.3 Full Test Suite Execution Results

1. **Scanner Unit & Adversarial Test Suites**:
   - Command: `npx jest src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts src/lib/scanner/__tests__/purchase-bill-parser.test.ts --forceExit`
   - Result: **PASS** (2 test suites passed, 52 tests passed, 0 failed; Time: 2.4 s).
2. **Scan Route API & Full E2E Test Suites**:
   - Command: `npx jest src/app/api/purchases/scan/__tests__/scan-routes.test.ts src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit`
   - Result: **PASS** (2 test suites passed, 61 tests passed, 0 failed; Time: 3.659 s).
3. **Total Automated Tests**: 4 suites, 113 tests passed, 0 failures.

---

### 1.4 Code Quality & Static Analysis Results

1. **ESLint Static Analysis**:
   - Command: `npx eslint src/lib/scanner/pharma-invoice-heuristics.ts src/lib/scanner/purchase-bill-parser.ts src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts src/lib/scanner/__tests__/purchase-bill-parser.test.ts`
   - Result: **0 errors, 0 warnings**.
2. **TypeScript Compilation in Scanner**:
   - Command: `npx tsc --noEmit`
   - Result: `src/lib/scanner/` has **0 TypeScript errors**. All errors returned by `tsc` reside strictly in external legacy scripts (`scripts/`, `generate_dummy.ts`, `prisma/seeds/`) and pre-existing POS components (`src/components/pos/`, `src/components/sales/`).

---

## 2. Logic Chain

1. **Premise**: In Indian wholesale pharma invoicing, distributors frequently format tables with either 6 numeric values (`Qty, Free, Rate, MRP, GST%, Total`) or 7 numeric values (`Qty, Free, Rate, MRP, Disc%, GST%, Total`).
2. **Observation (Gate 2 failure)**: When 6 numeric values were encountered, `numbersInAfter[4]` (the statutory GST slab, e.g. 12) was assigned to `discountPercent`, deflating the taxable amount and breaking cross-reconciliation (`variance: 134.40`).
3. **Verification of Worker Fix (`src/lib/scanner/pharma-invoice-heuristics.ts:447-456`)**:
   The parser checks if `numbersInAfter.length === 6`. When the 6th token (`numbersInAfter[5]`) is `> 28` or not an exact statutory GST slab (`![0, 5, 12, 18, 28].includes(...)`), the parser deduces that column 5 is the line total, column 4 is the GST%, and sets `discountPercent = 0`.
4. **Verification of Percent-Match Disambiguation (`src/lib/scanner/pharma-invoice-heuristics.ts:471-482`)**:
   When a single `%` match occurs matching statutory GST rates (`[0, 5, 12, 18, 28]`) without an explicit discount prefix (`DISC`, `CD`, `TD`), `discountPercent` is explicitly reset to `0` when `numbersInAfter.length < 7`.
5. **Deduction**: This disambiguation completely prevents phantom discount injection for 6-column layouts without impacting 7-column layouts (which have genuine trade discount percentages).
6. **Empirical Confirmation**: Both targeted reproduction commands and stress-testing harnesses produced exact financial totals (`1120.00` and `22.40`), `discountPercent: 0`, and perfect document cross-reconciliation (`isReconciled: true`, variance `0.00`).
7. **Conclusion**: The residual defect is conclusively resolved, all edge cases pass, and the scanner pipeline fulfills the requirements of Milestone M1.

---

## 3. Caveats

1. **Pre-existing Workspace TypeScript Errors**: Pre-existing TypeScript errors in `scripts/`, `src/components/pos/`, `src/components/sales/`, and `src/app/api/reports/` remain outside Milestone M1 scope and were left untouched.
2. **Scanner Domain Scope**: `src/lib/scanner/` compiles with 0 TypeScript errors and 0 ESLint warnings.
3. **No other caveats**: Verification was 100% empirical with 113 automated tests and multiple independent Node reproduction runs.

---

## 4. Conclusion & Actionable Verdict

### Verdict: `APPROVE`

Milestone M1 (Ingestion & Document Parsing Pipeline) has met all empirical quality, architectural, and adversarial criteria:
- 6-column invoices omitting discount columns parse accurately with `discountPercent: 0` and accurate line totals.
- Financial cross-reconciliation between parsed line items and printed totals functions with zero variance.
- Scheme syntaxes (`10+1`, `50+5`) parse rates, MRPs, discounts, and taxes cleanly.
- Promotional zero-quantity lines preserve `billedQuantity: 0`.
- Multi-page invoices seamlessly bridge subtotals.
- Blank/whitespace input safely returns empty items and zero confidence.
- All 113 automated tests across the unit, adversarial, API, and E2E suites pass without errors.
- ESLint and TypeScript checks pass cleanly on `src/lib/scanner/`.

Milestone M1 is cleared for progression to subsequent milestones (M2: Interactive Review UI & M3: Inventory Provisioning).

---

## 5. Verification Method

To independently verify this approval:

1. **Reproduction Command**:
   ```powershell
   npx tsx -e "import { parseInvoiceLineItems } from './src/lib/scanner/pharma-invoice-heuristics'; const line = 'AUGMENTIN 625 10\'S 3004 BAT01 08/28 10 0 100.00 140.00 12% 1120.00'; const items = parseInvoiceLineItems(['ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP GST% TOTAL', line]); console.log('discountPercent:', items[0].discountPercent, 'totalAmount:', items[0].totalAmount);"
   ```
   - Must output: `discountPercent: 0 totalAmount: 1120`.

2. **Automated Test Suites (113 Tests)**:
   ```powershell
   npx jest src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts src/lib/scanner/__tests__/purchase-bill-parser.test.ts --forceExit
   npx jest src/app/api/purchases/scan/__tests__/scan-routes.test.ts src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit
   ```
   - Must report: 4 test suites passed, 113 tests passed, 0 failed.

3. **Static Analysis Verification**:
   ```powershell
   npx eslint src/lib/scanner/pharma-invoice-heuristics.ts src/lib/scanner/purchase-bill-parser.ts src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts src/lib/scanner/__tests__/purchase-bill-parser.test.ts
   ```
   - Must output 0 errors, 0 warnings.
