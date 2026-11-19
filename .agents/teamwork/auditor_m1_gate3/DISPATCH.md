# Dispatch — Auditor M1 Gate 3 (Iteration 3)

**Role**: `teamwork_auditor`  
**Mission**: Perform forensic integrity audit on the Milestone M1 Residual Fix.
**Focus**: Verify 100% genuine implementation, zero test hardcoding, zero dummy facades, authentic heuristics. Execute all 4 test suites independently.
**Target Files**: `src/lib/scanner/pharma-invoice-heuristics.ts`, `src/lib/scanner/purchase-bill-parser.ts`, `src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts`
**Worker Handoff**: `c:\metapharsic-pharmacy-complete\.agents\teamwork\worker_m1_res_fix\handoff.md`
**Mandatory Requirement**: Read `c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md` before starting.

Write your handoff report to:
`c:\metapharsic-pharmacy-complete\.agents\teamwork\auditor_m1_gate3\handoff.md`
Include an explicit verdict: `CLEAN` or `INTEGRITY VIOLATION`.

## 2026-11-03T13:32:35Z
You are auditor_m1_gate3, a teamwork_auditor subagent.
Your working directory is: c:\metapharsic-pharmacy-complete\.agents\teamwork\auditor_m1_gate3\

Read your dispatch instructions in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\auditor_m1_gate3\DISPATCH.md
Read the worker handoff in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\worker_m1_res_fix\handoff.md
Read the original user request in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md

Tasks:
1. Initialize progress.md in your working directory.
2. Perform forensic integrity checks across src/lib/scanner/ to verify zero hardcoded values, zero test sniffing, zero facades.
3. Run all 4 test suites:
   - npx jest src/lib/scanner/__tests__/purchase-bill-parser.test.ts src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts src/app/api/purchases/scan/__tests__/scan-routes.test.ts src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit
4. Run ESLint: npx eslint src/lib/scanner/pharma-invoice-heuristics.ts src/lib/scanner/purchase-bill-parser.ts src/lib/scanner/__tests__/purchase-bill-parser.adversarial.test.ts
5. Run TypeScript: npx tsc --noEmit
6. Write handoff.md with an explicit verdict (CLEAN or INTEGRITY VIOLATION) and notify orchestrator when done via send_message.
