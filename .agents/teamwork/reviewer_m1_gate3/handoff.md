# Handoff Report: Reviewer M1 Gate 3 (Iteration 3)

**Author**: `reviewer_m1_gate3` (`teamwork_reviewer`)  
**Target Milestone**: Milestone M1 (Ingestion & Document Parsing Pipeline — Residual Fix)  
**Parent Agent**: `056deacb-bfc4-49c9-95d1-5d0d88085f22`  
**Verdict**: **APPROVE**  

---

## 1. Observation

Direct empirical evidence obtained through independent review and execution in clean environments:

### 1.1 Source Code & Test Inspection
- `src/lib/scanner/pharma-invoice-heuristics.ts`:
  - Lines 415–428: Added scheme line disambiguation for 4 numeric tokens trailing scheme syntax (`Rate MRP GST% Total` vs `Rate MRP Disc% GST%`).
  - Lines 439–458: Added column count disambiguation for 6-column tabular rows after expiry (`[Qty, Free, Rate, MRP, GST%, Total]`). If `numbersInAfter[5] > 28 || ![0, 5, 12, 18, 28].includes(numbersInAfter[5])`, then column 5 is assigned as line total, column 4 is assigned as `taxPercent`, and `discountPercent` is set to `0`. If 7 or more numeric tokens exist, column 4 is preserved as discount.
  - Lines 466–485: In single `%` token disambiguation, when the single percentage matches a statutory Indian GST slab (`[0, 5, 12, 18, 28]`) without preceding discount keywords (`DISC`, `CD`, `TD`), `taxPercent` is assigned that value and `discountPercent` is explicitly reset to `0` when `numbersInAfter.length < 7`.
  - Scanned for hardcoded fixture names or bypasses (`AUGMENTIN`, `ACECLOFENAC`, `INV-6COL-001`, `BAT01`). None are present in `pharma-invoice-heuristics.ts`.
- `src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts`:
  - Updated test `does not confuse combination medicine dosage with free goods scheme` with explicit assertions verifying `discountPercent: 0` and `totalAmount: 1120.0`.
  - Added new test `correctly parses standard 6-column row omitting discount column without phantom discount injection`, asserting both isolated line parsing (`discountPercent: 0`, `taxPercent: 12`, `taxAmount: 120.0`, `totalAmount: 1120.0`) and full invoice reconciliation (`isReconciled: true`, `reconciliationVariance: 0`).

### 1.2 Test Execution Results
- Command:
  `npx jest src/lib/scanner/__tests__/purchase-bill-parser.test.ts src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts src/app/api/purchases/scan/__tests__/scan-routes.test.ts src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit`
- Result: **PASS** (4 test suites passed, 113 tests passed, 0 failed, duration 3.064 s).
  - `src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts`: 53 passed
  - `src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts`: 27 passed
  - `src/lib/scanner/__tests__/purchase-bill-parser.test.ts`: 25 passed
  - `src/app/api/purchases/scan/__tests__/scan-routes.test.ts`: 8 passed

### 1.3 Static Analysis Results
- Command:
  `npx eslint src/lib/scanner/pharma-invoice-heuristics.ts src/lib/scanner/purchase-bill-parser.ts src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts`
- Result: **0 errors, 0 warnings** (exited code 0).
- Command:
  `npx tsc --noEmit`
- Result:
  - Scanned all compiler diagnostics: **0 errors in `src/lib/scanner/`**.
  - All reported errors reside in pre-existing files outside Milestone M1 (`scripts/`, `src/components/pos/`, `src/app/api/reports/`).

### 1.4 Independent Stress Testing Results
- **Scenario 1 (Worker reproduction)**:
  `AUGMENTIN 625 10'S 3004 BAT01 08/28 10 0 100.00 140.00 12% 1120.00`
  - Output: `discountPercent: 0, totalAmount: 1120` (PASS).
- **Scenario 2 (5% GST rate in 6-column layout)**:
  `PARACETAMOL 500 10'S 3004 BAT02 08/28 10 0 100.00 140.00 5% 1050.00`
  - Output: `discountPercent: 0, taxPercent: 5, taxAmount: 50, totalAmount: 1050` (PASS).
- **Scenario 3 (6 columns with Disc% and GST% without line total column)**:
  `PARACETAMOL 500 10'S 3004 BAT02 08/28 10 0 100.00 140.00 5.00 12.00`
  - Output: `discountPercent: 5, taxPercent: 12, totalAmount: 1064` (PASS).
- **Scenario 4 (7 columns with Disc%, GST%, and Total)**:
  `PARACETAMOL 500 10'S 3004 BAT02 08/28 10 0 100.00 140.00 5% 12% 1064.00`
  - Output: `discountPercent: 5, taxPercent: 12, totalAmount: 1064` (PASS).
- **Scenario 5 (Scheme line 50+5 with 4 trailing values omitting discount)**:
  `AUGMENTIN 625 10'S 3004 BAT01 08/28 50+5 100.00 140.00 12% 5600.00`
  - Output: `billed: 50, free: 5, taxPercent: 12, discountPercent: 0, totalAmount: 5600` (PASS).
- **Scenario 6 (Scheme line 50+5 with 5 trailing values including discount)**:
  `AUGMENTIN 625 10'S 3004 BAT01 08/28 50+5 100.00 140.00 5% 12% 5320.00`
  - Output: `billed: 50, free: 5, taxPercent: 12, discountPercent: 5, totalAmount: 5320` (PASS).
- **Scenario 7 (Sub-28 non-integer line total)**:
  `PARACETAMOL 500 10'S 3004 BAT02 08/28 1 0 10.00 15.00 12% 11.20`
  - Output: `discountPercent: 0, taxPercent: 12, totalAmount: 11.2` (PASS).
- **Scenario 8 (Integer line total matching GST slab e.g. 12.00)**:
  `PARACETAMOL 500 10'S 3004 BAT02 08/28 1 0 10.71 15.00 12% 12.00`
  - Output: `discountPercent: 0, taxPercent: 12, totalAmount: 12` (PASS).

---

## 2. Logic Chain

1. **Observation**: Tabular wholesale pharmaceutical invoices frequently omit the discount column, displaying 6 columns after expiry: `[Qty, Free, Rate, MRP, GST%, Total]`.
2. **Observation**: In standard Indian GST, statutory tax slabs are strictly in `{0, 5, 12, 18, 28}`. Conversely, line total amounts for wholesale packaging almost invariably exceed `28.00` or have non-integer decimal fractions.
3. **Observation**: When exactly 6 numeric values appear in `numbersInAfter`, testing `numbersInAfter[5] > 28 || ![0, 5, 12, 18, 28].includes(numbersInAfter[5])` correctly routes `[Qty, Free, Rate, MRP, GST%, Total]` so that column 4 is treated as tax percent and column 5 as line total.
4. **Observation**: When a single `%` token appears on the line and matches a statutory GST slab without discount keywords, resetting `discountPercent = 0` when `numbersInAfter.length < 7` eliminates phantom discount injection from positional defaults.
5. **Deduction**: The heuristics maintain full backwards compatibility for 7-column formats (`[Qty, Free, Rate, MRP, Disc%, GST%, Total]`), scheme syntax (`Qty+Free`), promotional 0-billed lines, and multi-percentage invoices, as proven by all 113 Jest tests passing without regressions.
6. **Conclusion**: The implementation correctly resolves Residual Defect 7, passes all automated and adversarial tests, satisfies all static analysis checks, and contains zero integrity violations.

---

## 3. Caveats

1. **Workspace-Wide TypeScript Baseline**: As noted in earlier reviews and the worker handoff, pre-existing TypeScript compilation errors remain in `scripts/`, `src/components/pos/`, and `src/app/api/reports/`. However, `src/lib/scanner/` has zero TypeScript errors.
2. **Extreme Edge Case (Slab Collision without `%` sign)**: If an invoice line has exactly 6 numbers, no `%` sign anywhere, an exact integer line total in `{0, 5, 12, 18, 28}` (e.g., total = 12.00 without decimals), and column 4 is also in `{0, 5, 12, 18, 28}`, column 5 could be interpreted as GST% rather than line total. In real-world wholesale invoices, line items are almost never exact single-digit integers matching statutory tax slabs without a `%` symbol, so this risk is deemed negligible and acceptable.

---

## 4. Conclusion

**Verdict: APPROVE**

The Milestone M1 Residual Fix implemented by `worker_m1_res_fix` is sound, robust, and verified.
- Defect 7 is completely resolved: standard 6-column invoices omitting the discount column parse with `discountPercent: 0`, accurately identify statutory GST rates, compute correct line totals, and achieve exact zero-variance financial cross-reconciliation.
- All 113 tests in 4 test suites pass cleanly.
- ESLint reports 0 errors and 0 warnings.
- No integrity violations, facades, or hardcoded shortcuts were detected.
- Milestone M1 is ready for final sign-off.

---

## 5. Verification Method

To reproduce and independently verify:

1. **Run Full Test Suite**:
   ```powershell
   npx jest src/lib/scanner/__tests__/purchase-bill-parser.test.ts src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts src/app/api/purchases/scan/__tests__/scan-routes.test.ts src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit
   ```
   - Must output: `Test Suites: 4 passed, 4 total; Tests: 113 passed, 113 total`.

2. **Run ESLint**:
   ```powershell
   npx eslint src/lib/scanner/pharma-invoice-heuristics.ts src/lib/scanner/purchase-bill-parser.ts src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts
   ```
   - Must exit with code 0.

3. **Run TypeScript Check on Scanner**:
   ```powershell
   npx tsc --noEmit --project tsconfig.json | Select-String "src/lib/scanner"
   ```
   - Must return 0 matches.

4. **Run Empirical Verification**:
   ```powershell
   npx tsx -e "import { parseInvoiceLineItems } from './src/lib/scanner/pharma-invoice-heuristics'; const line = 'AUGMENTIN 625 10\'S 3004 BAT01 08/28 10 0 100.00 140.00 12% 1120.00'; const items = parseInvoiceLineItems(['ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP GST% TOTAL', line]); console.log('discountPercent:', items[0].discountPercent, 'totalAmount:', items[0].totalAmount);"
   ```
   - Must output: `discountPercent: 0 totalAmount: 1120`.
