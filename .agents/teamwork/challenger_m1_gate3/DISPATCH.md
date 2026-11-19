# Dispatch — Challenger M1 Gate 3 (Iteration 3)

**Role**: `teamwork_challenger`  
**Mission**: Perform empirical adversarial verification and stress testing on the Milestone M1 Residual Fix.
**Focus**: Specifically verify that 6-column invoices omitting discount column (`Qty Free Rate MRP GST% Total`), scheme syntax (`50+5`), promotional zero-qty samples (`0 5`), multi-page invoices with subtotals, and empty inputs are 100% correctly parsed and mathematically reconciled.
**Target Files**: `src/lib/scanner/pharma-invoice-heuristics.ts`, `src/lib/scanner/purchase-bill-parser.ts`
**Worker Handoff**: `c:\metapharsic-pharmacy-complete\.agents\teamwork\worker_m1_res_fix\handoff.md`
**Mandatory Requirement**: Read `c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md` before starting.

## Verification Commands
1. Run adversarial reproduction script:
   `npx tsx -e "import { parseInvoiceLineItems } from './src/lib/scanner/pharma-invoice-heuristics'; const line = 'AUGMENTIN 625 10\'S 3004 BAT01 08/28 10 0 100.00 140.00 12% 1120.00'; const items = parseInvoiceLineItems(['ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP GST% TOTAL', line]); console.log('discountPercent:', items[0].discountPercent, 'totalAmount:', items[0].totalAmount);"`
   Must verify: `discountPercent: 0, totalAmount: 1120`.
2. Run test suites:
   `npx jest src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts src/lib/scanner/__tests__/purchase-bill-parser.test.ts --forceExit`
   `npx jest src/app/api/purchases/scan/__tests__/scan-routes.test.ts src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit`

Write your handoff report to:
`c:\metapharsic-pharmacy-complete\.agents\teamwork\challenger_m1_gate3\handoff.md`
Include an explicit verdict: `APPROVE` or `REQUEST_CHANGES`.

## 2026-11-03T13:32:27Z
You are challenger_m1_gate3, a teamwork_challenger subagent.
Your working directory is: c:\metapharsic-pharmacy-complete\.agents\teamwork\challenger_m1_gate3\

Read your dispatch instructions in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\challenger_m1_gate3\DISPATCH.md
Read the worker handoff in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\worker_m1_res_fix\handoff.md
Read the previous challenger report in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\challenger_m1_fix\handoff.md
Read the original user request in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md

Tasks:
1. Initialize progress.md in your working directory.
2. Empirically verify that 6-column invoices omitting discount columns parse with discountPercent: 0 and totalAmount correct.
   Run: npx tsx -e "import { parseInvoiceLineItems } from './src/lib/scanner/pharma-invoice-heuristics'; const line = 'AUGMENTIN 625 10\'S 3004 BAT01 08/28 10 0 100.00 140.00 12% 1120.00'; const items = parseInvoiceLineItems(['ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP GST% TOTAL', line]); console.log('discountPercent:', items[0].discountPercent, 'totalAmount:', items[0].totalAmount);"
3. Run all test suites:
   - npx jest src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts src/lib/scanner/__tests__/purchase-bill-parser.test.ts --forceExit
   - npx jest src/app/api/purchases/scan/__tests__/scan-routes.test.ts src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit
4. Write handoff.md with an explicit verdict (APPROVE or REQUEST_CHANGES) and notify orchestrator when done via send_message.
