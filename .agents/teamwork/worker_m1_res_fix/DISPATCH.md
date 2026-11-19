# Dispatch — Worker M1 Residual Fix (Iteration 3)

**Timestamp**: 2026-11-03T13:32:00Z  
**Worker**: `worker_m1_res_fix` (`teamwork_worker`)  
**Mission**: Apply the exact fix for Residual Defect 7 (Phantom Discount Injected on Tabular Invoices Without Discount Column) to `src/lib/scanner/pharma-invoice-heuristics.ts`, update adversarial test assertions in `src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts`, and run all test suites to verify 100% pass.

---

## 🔒 Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

---

## Target Files to Modify
1. `src/lib/scanner/pharma-invoice-heuristics.ts`
2. `src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts`

---

## Context & Defect Details
Read the full analysis in:
`c:\metapharsic-pharmacy-complete\.agents\teamwork\challenger_m1_fix\handoff.md`

### Defect:
On standard Indian 6-column invoices omitting a discount column:
`Qty Free Rate MRP GST% Total` (e.g. `10 0 100.00 140.00 12% 1120.00`),
the parser incorrectly assigns `discountPercent = 12`, deflating the taxable base to 880 and line total to 985.60, breaking math cross-reconciliation.

### Exact Required Code Changes:
In `src/lib/scanner/pharma-invoice-heuristics.ts`:

1. In column assignment (around lines 436–444):
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

2. In percentage disambiguation (around lines 460–466):
```typescript
} else if ([0, 5, 12, 18, 28].includes(val)) {
  taxPercent = val
  if (numbersInAfter.length < 7) {
    discountPercent = 0
  }
}
```

3. In `src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts`:
- Check line 304 test:
  ```typescript
  const line = "ACECLOFENAC + PARACETAMOL 100+325 TAB 10'S 3004 B1 08/28 10 0 100.00 150.00 12% 1120.00"
  ```
  Add assertion: `expect(items[0].discountPercent).toBe(0)` and `expect(items[0].totalAmount).toBe(1120.00)`.
- Add an explicit test case in the adversarial suite verifying standard 6-column rows without discount column:
  `Qty Free Rate MRP GST% Total` correctly parses with `discountPercent: 0`, `taxPercent: 12`, and `totalAmount: 1120.00`.

---

## Verification Commands
Execute:
1. `npx jest src/lib/scanner/__tests__/purchase-bill-parser.test.ts --forceExit`
2. `npx jest src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts --forceExit`
3. `npx jest src/app/api/purchases/scan/__tests__/scan-routes.test.ts --forceExit`
4. `npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit`
5. `npx eslint src/lib/scanner/pharma-invoice-heuristics.ts src/lib/scanner/purchase-bill-parser.ts src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts`
6. `npx tsc --noEmit` (ensure 0 errors in `src/lib/scanner/`)

Write completion report to:
`c:\metapharsic-pharmacy-complete\.agents\teamwork\worker_m1_res_fix\handoff.md`


## 2026-11-03T13:24:11Z
You are worker_m1_res_fix, a teamwork_worker subagent.
Your working directory is: c:\metapharsic-pharmacy-complete\.agents\teamwork\worker_m1_res_fix\

Read your dispatch instructions in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\worker_m1_res_fix\DISPATCH.md
Read the Challenger's defect report in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\challenger_m1_fix\handoff.md
Read the original user request in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Tasks:
1. Initialize progress.md in your working directory.
2. Modify src/lib/scanner/pharma-invoice-heuristics.ts to fix column disambiguation for 6-column invoices omitting a discount column (preventing GST slab from being assigned to discountPercent).
3. Modify src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts to verify discountPercent is 0 and totalAmount is correct for 6-column rows.
4. Run all 4 test suites:
   - npx jest src/lib/scanner/__tests__/purchase-bill-parser.test.ts --forceExit
   - npx jest src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts --forceExit
   - npx jest src/app/api/purchases/scan/__tests__/scan-routes.test.ts --forceExit
   - npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit
5. Run ESLint: npx eslint src/lib/scanner/pharma-invoice-heuristics.ts src/lib/scanner/purchase-bill-parser.ts src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts
6. Run TypeScript: npx tsc --noEmit
7. Write your handoff report to c:\metapharsic-pharmacy-complete\.agents\teamwork\worker_m1_res_fix\handoff.md and notify orchestrator when done via send_message.
