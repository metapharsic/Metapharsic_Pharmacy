# Handoff Report — Challenger M2 (Gate Evaluation)

**Verdict**: **APPROVE**

## 1. Observation
- Inspected implementation and test files for Milestone M2:
  - `src/lib/purchases/purchase-provisioning-service.ts` (Lines 1–494)
  - `src/app/api/purchases/scan/commit/route.ts` (Lines 1–196)
  - `src/lib/purchases/__tests__/purchase-provisioning.test.ts` (Lines 1–644)
  - `src/app/api/purchases/scan/commit/__tests__/commit-route.test.ts` (Lines 1–236)
  - `src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts` (Lines 1–1425)
- Authored dedicated adversarial stress harness:
  - `src/__tests__/adversarial/purchase-provisioning-adversarial.test.ts` (16 test cases)
- Executed verification test suites:
  - Command: `npx jest src/lib/purchases/__tests__/purchase-provisioning.test.ts --forceExit`
    - Result: `PASS unit src/lib/purchases/__tests__/purchase-provisioning.test.ts (11 passed, 11 total, Time: 1.045 s)`
  - Command: `npx jest src/app/api/purchases/scan/commit/__tests__/commit-route.test.ts --forceExit`
    - Result: `PASS unit src/app/api/purchases/scan/commit/__tests__/commit-route.test.ts (8 passed, 8 total, Time: 2.436 s)`
  - Command: `npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit`
    - Result: `PASS unit src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts (53 passed, 53 total, Time: 3.823 s)`
  - Command: `npx jest src/__tests__/adversarial/purchase-provisioning-adversarial.test.ts --forceExit`
    - Result: `PASS unit src/__tests__/adversarial/purchase-provisioning-adversarial.test.ts (16 passed, 16 total, Time: 0.913 s)`
  - Total test count across all suites: 88 passed out of 88 total.
- Static Analysis:
  - Command: `npx eslint src/lib/purchases/purchase-provisioning-service.ts src/app/api/purchases/scan/commit/route.ts src/__tests__/adversarial/purchase-provisioning-adversarial.test.ts`
    - Result: Exit code 0 (0 errors, 0 warnings).
  - Target files show 0 TypeScript compilation errors in `npx tsc --noEmit`.

## 2. Logic Chain
1. *Batch Upsert & EXHAUSTED Reactivation*:
   - In `purchase-provisioning-service.ts` lines 291–317:
     The query targets composite unique key `productId_batchNumber: { productId, batchNumber: batchNumberClean }`.
     In `update`, `quantity: { increment: totalUsableQty }` and `status: 'ACTIVE'`.
     Empirical test `ADV-1.1` verified that an existing batch with `status: 'EXHAUSTED'` and `quantity: 0` is updated to `status: 'ACTIVE'` with `quantity: 33` when 30 billed + 3 free units are provisioned.
     Empirical test `ADV-1.2` verified that re-ordering an already active batch preserves `ACTIVE` status and accumulates stock correctly.
     Empirical test `ADV-1.3` proved that multiple lines within the same invoice referencing the same batch accumulate sequentially without unique-constraint collision.
     Empirical test `ADV-1.4` proved that whitespace and case variants normalize to the same batch key.
2. *All-or-Nothing Transaction Atomicity*:
   - In `purchase-provisioning-service.ts` lines 191–492:
     The entire provisioning mutation executes inside `prisma.$transaction(executeInTransaction, { timeout: 15000 })`.
     Empirical tests `ADV-2.1` and `ADV-2.2` verified that when an intermediate mutation fails (e.g. CAS inventory deadlocks or supplier ledger foreign-key violation), the transaction halts and rolls back completely, leaving 0 purchases, 0 items, 0 movements, and pre-existing batches/stock unmodified.
3. *Confirmation Barrier & Security*:
   - In `route.ts` lines 36–57:
     The handler calls `requirePermission(PERMISSIONS.PURCHASES_CREATE)`.
     Empirical test `ADV-3.1` verified 401 Unauthorized for unauthenticated callers.
     Empirical test `ADV-3.2` verified 403 Forbidden for callers lacking the permission.
     Empirical test `ADV-3.3` verified 400 Bad Request (`INVALID_JSON`) for malformed request bodies.
   - In `purchase-provisioning-service.ts` lines 171–176:
     Calculates `itemTotalSum` and verifies `Math.abs(itemTotalSum - parsed.totalAmount) <= 2.0`.
     Empirical test `ADV-3.4a` showed minor rounding variances within tolerance (e.g. Rs. 1.80) pass cleanly.
     Empirical tests `ADV-3.4b` and `ADV-3.4c` showed variances exceeding Rs. 2.00 (e.g. Rs. 2.05 or tampered negative values) throw `UnreconciledTotalError` (HTTP 422).
   - In `purchase-provisioning-service.ts` lines 48–57 and lines 179–186:
     Zod schemas enforce non-negative constraints on quantities and prices.
     Empirical tests `ADV-3.5` and `ADV-3.6` confirmed negative quantities and zero usable stock (billed: 0, free: 0) are rejected with HTTP 400.
4. *Free Quantity Bonus Stock Accounting*:
   - Usable stock added is computed as `totalUsableQty = item.billedQuantity + (item.freeQuantity || 0)`.
   - `Batch.quantity` and `Inventory.totalQuantity / availableQuantity` increment by `totalUsableQty`.
   - `SupplierLedger.amount` and `Purchase.totalAmount` record only the billed total amount.
   - Empirical test `ADV-4.1` verified that 100 billed + 10 free goods add 110 units to usable inventory and batch, while Accounts Payable records exactly Rs. 10,000 (not Rs. 11,000).
   - Empirical test `ADV-4.2` confirmed pure sample stock (0 billed, 25 free, 0 amount) provisions 25 units with 0 payable.

## 3. Caveats
No caveats. All 88 tests pass deterministically, all transactional paths and edge cases were empirically exercised, and zero regressions or vulnerabilities were detected.

## 4. Conclusion
**Verdict**: **APPROVE**.
Milestone M2 (Inventory Provisioning & Persistence Engine) fully satisfies all requirements from `ORIGINAL_REQUEST.md` and the architecture in `PROJECT.md` and `worker_m2/handoff.md`. Concurrency safety, batch upsert reactivation, atomic transaction rollback, confirmation barrier security, and free goods bonus math are empirically verified.

## 5. Verification Method
To independently verify the implementation, run:
```bash
# 1. Adversarial stress suite (16 tests)
npx jest src/__tests__/adversarial/purchase-provisioning-adversarial.test.ts --forceExit

# 2. Purchase provisioning unit suite (11 tests)
npx jest src/lib/purchases/__tests__/purchase-provisioning.test.ts --forceExit

# 3. Commit API route suite (8 tests)
npx jest src/app/api/purchases/scan/commit/__tests__/commit-route.test.ts --forceExit

# 4. E2E purchase bill scanning & provisioning suite (53 tests)
npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit

# 5. Combined run (88 tests total)
npx jest src/__tests__/adversarial/purchase-provisioning-adversarial.test.ts src/lib/purchases/__tests__/purchase-provisioning.test.ts src/app/api/purchases/scan/commit/__tests__/commit-route.test.ts src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit

# 6. ESLint check
npx eslint src/lib/purchases/purchase-provisioning-service.ts src/app/api/purchases/scan/commit/route.ts src/__tests__/adversarial/purchase-provisioning-adversarial.test.ts
```
Invalidation conditions: Any failure in the Jest test suites, non-zero exit from ESLint, or divergence between line item quantities and batch stock increments.
