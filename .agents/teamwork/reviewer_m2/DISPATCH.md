# Dispatch — Reviewer M2 (Gate Evaluation)

**Role**: `teamwork_reviewer`  
**Milestone**: Milestone M2 (Inventory Provisioning & Persistence Engine)  
**Target Files**:
- `src/lib/purchases/purchase-provisioning-service.ts`
- `src/app/api/purchases/scan/commit/route.ts`
- `src/lib/purchases/__tests__/purchase-provisioning.test.ts`
- `src/app/api/purchases/scan/commit/__tests__/commit-route.test.ts`
**Worker Handoff**: `c:\metapharsic-pharmacy-complete\.agents\teamwork\worker_m2\handoff.md`
**Mandatory Requirement**: Read `c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md` before starting.

## Verification Checklist
1. Concurrency safety: `tx.batch.upsert` composite unique `@@unique([productId, batchNumber])` and batch reactivation from `EXHAUSTED` to `ACTIVE`.
2. Free goods invariant: usable inventory increments by `billedQuantity + freeQuantity`, while financial liability reflects only billed goods.
3. CAS branch inventory update on `@@unique([productId, branchId])`.
4. Audit logs: `InventoryMovement` and `AuditLog` creation.
5. Accounts Payable: `SupplierLedger` and `Supplier.outstandingBalance` updates.
6. Run test suites:
   - `npx jest src/lib/purchases/__tests__/purchase-provisioning.test.ts --forceExit`
   - `npx jest src/app/api/purchases/scan/commit/__tests__/commit-route.test.ts --forceExit`
   - `npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit`
7. Static checks:
   - `npx eslint src/lib/purchases/purchase-provisioning-service.ts src/app/api/purchases/scan/commit/route.ts`
   - `npx tsc --noEmit`

Write your handoff report to:
`c:\metapharsic-pharmacy-complete\.agents\teamwork\reviewer_m2\handoff.md`
Include an explicit verdict: `APPROVE` or `REQUEST_CHANGES`.

## 2026-11-03T14:07:25Z
You are reviewer_m2, a teamwork_reviewer subagent.
Your working directory is: c:\metapharsic-pharmacy-complete\.agents\teamwork\reviewer_m2\

Read your dispatch instructions in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\reviewer_m2\DISPATCH.md
Read the worker handoff in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\worker_m2\handoff.md
Read the original user request in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md

Tasks:
1. Initialize progress.md in your working directory.
2. Review the code changes in src/lib/purchases/purchase-provisioning-service.ts and src/app/api/purchases/scan/commit/route.ts.
3. Run all test suites and static checks:
   - npx jest src/lib/purchases/__tests__/purchase-provisioning.test.ts --forceExit
   - npx jest src/app/api/purchases/scan/commit/__tests__/commit-route.test.ts --forceExit
   - npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit
   - npx eslint src/lib/purchases/purchase-provisioning-service.ts src/app/api/purchases/scan/commit/route.ts
   - npx tsc --noEmit
4. Write handoff.md with an explicit verdict (APPROVE or REQUEST_CHANGES) and notify orchestrator when done via send_message.
