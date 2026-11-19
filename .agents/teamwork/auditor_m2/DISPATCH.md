# Dispatch — Auditor M2 (Gate Evaluation)

**Role**: `teamwork_auditor`  
**Milestone**: Milestone M2 (Inventory Provisioning & Persistence Engine)  
**Target Files**:
- `src/lib/purchases/purchase-provisioning-service.ts`
- `src/app/api/purchases/scan/commit/route.ts`
- `src/lib/purchases/__tests__/purchase-provisioning.test.ts`
- `src/app/api/purchases/scan/commit/__tests__/commit-route.test.ts`
**Worker Handoff**: `c:\metapharsic-pharmacy-complete\.agents\teamwork\worker_m2\handoff.md`
**Mandatory Requirement**: Read `c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md` before starting.

## Forensic Audit Focus
1. Verify genuine implementation of atomic database transaction (`prisma.$transaction`), batch upsert, CAS inventory increment, movement logging, supplier ledger credit, and audit logs.
2. Verify zero hardcoded test inputs, zero dummy facades, zero test sniffing.
3. Verify all test suites execute and pass:
   - `npx jest src/lib/purchases/__tests__/purchase-provisioning.test.ts --forceExit`
   - `npx jest src/app/api/purchases/scan/commit/__tests__/commit-route.test.ts --forceExit`
   - `npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit`
4. Verify static analysis: ESLint and TypeScript.

Write your handoff report to:
`c:\metapharsic-pharmacy-complete\.agents\teamwork\auditor_m2\handoff.md`
Include an explicit verdict: `CLEAN` or `INTEGRITY VIOLATION`.


## 2026-11-03T14:07:41Z
You are auditor_m2, a teamwork_auditor subagent.
Your working directory is: c:\metapharsic-pharmacy-complete\.agents\teamwork\auditor_m2\

Read your dispatch instructions in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\auditor_m2\DISPATCH.md
Read the worker handoff in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\worker_m2\handoff.md
Read the original user request in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md

Tasks:
1. Initialize progress.md in your working directory.
2. Perform forensic integrity checks on src/lib/purchases/purchase-provisioning-service.ts and src/app/api/purchases/scan/commit/route.ts to verify zero hardcoding, zero test sniffing, and genuine transactional logic.
3. Run all test suites:
   - npx jest src/lib/purchases/__tests__/purchase-provisioning.test.ts --forceExit
   - npx jest src/app/api/purchases/scan/commit/__tests__/commit-route.test.ts --forceExit
   - npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit
4. Run ESLint: npx eslint src/lib/purchases/purchase-provisioning-service.ts src/app/api/purchases/scan/commit/route.ts
5. Run TypeScript: npx tsc --noEmit
6. Write handoff.md with an explicit verdict (CLEAN or INTEGRITY VIOLATION) and notify orchestrator when done via send_message.
