# Dispatch — Challenger M2 (Gate Evaluation)

**Role**: `teamwork_challenger`  
**Milestone**: Milestone M2 (Inventory Provisioning & Persistence Engine)  
**Target Files**:
- `src/lib/purchases/purchase-provisioning-service.ts`
- `src/app/api/purchases/scan/commit/route.ts`
- `src/lib/purchases/__tests__/purchase-provisioning.test.ts`
- `src/app/api/purchases/scan/commit/__tests__/commit-route.test.ts`
**Worker Handoff**: `c:\metapharsic-pharmacy-complete\.agents\teamwork\worker_m2\handoff.md`
**Mandatory Requirement**: Read `c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md` before starting.

## Adversarial Challenge Focus
1. Test batch upsert collision handling and reactivation of `EXHAUSTED` batches to `ACTIVE`.
2. Test partial rollback on database transaction errors (all-or-nothing guarantee).
3. Test confirmation barrier safety: unauthorized or unauthenticated commit attempts, unreconciled totals (> Rs. 2.00 variance), negative quantities, and tampering.
4. Test free quantity bonus stock arithmetic: ensure `Batch.quantity` and `Inventory.availableQuantity` include free goods, while `Purchase.totalAmount` and `SupplierLedger.amount` do NOT charge for free goods.
5. Run test suites:
   - `npx jest src/lib/purchases/__tests__/purchase-provisioning.test.ts --forceExit`
   - `npx jest src/app/api/purchases/scan/commit/__tests__/commit-route.test.ts --forceExit`
   - `npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit`

Write your handoff report to:
`c:\metapharsic-pharmacy-complete\.agents\teamwork\challenger_m2\handoff.md`
Include an explicit verdict: `APPROVE` or `REQUEST_CHANGES`.
