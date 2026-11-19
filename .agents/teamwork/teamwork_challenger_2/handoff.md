# Adversarial Challenge Report — Admin Bill Operations, Inventory Reversals & RBAC Security

**Reviewer**: Challenger 2 (`teamwork_challenger_2`)  
**Target Milestone**: Milestone 4 — Admin Bill Modification, Cancellation, Inventory Reversal, & RBAC Security  
**Verdict**: **APPROVE**  
**Date**: 2026-11-02T15:14:00Z  

---

## 1. Observation

Direct empirical observations from source inspection and test execution across the codebase:

### 1.1 Source Code Inspection

1. **RBAC Guard in Core Service (`src/lib/sales/sales-service.ts`)**:
   - In `cancelSale` (lines 1438–1446):
     ```typescript
     const permissions = actor.permissions ?? []
     const roles = (actor as { roles?: string[] }).roles ?? []
     const isAuthorized =
       permissions.includes(PERMISSIONS.SALES_VOID) ||
       roles.some((r) => ['admin', 'owner', 'manager', 'super_admin'].includes(r.toLowerCase()))

     if (!isAuthorized) {
       throw new Error('Forbidden: requires permission sales:void or Admin role to cancel sales')
     }
     ```
   - In `editSale` (lines 1655–1663):
     ```typescript
     const permissions = actor.permissions ?? []
     const roles = (actor as { roles?: string[] }).roles ?? []
     const canEdit =
       permissions.includes(PERMISSIONS.SALES_VOID) ||
       roles.some((r) => ['admin', 'owner', 'manager', 'super_admin'].includes(r.toLowerCase()))

     if (!canEdit) {
       throw new Error('Forbidden: requires permission sales:void or Admin role to edit sales')
     }
     ```

2. **RBAC Guard in Route Handlers (`src/app/api/sales/[id]/route.ts` & `src/app/api/sales/[id]/cancel/route.ts`)**:
   - `PATCH /api/sales/:id` (lines 74–89) strictly enforces `isAuthorized`, returning HTTP 403 Forbidden:
     ```json
     { "success": false, "error": { "code": "FORBIDDEN", "message": "Forbidden: requires permission sales:void or Admin role to edit sales" } }
     ```
   - `DELETE /api/sales/:id` (lines 141–156) strictly enforces `isAuthorized`, returning HTTP 403 Forbidden:
     ```json
     { "success": false, "error": { "code": "FORBIDDEN", "message": "Forbidden: requires permission sales:void or Admin role to cancel sales" } }
     ```
   - `POST /api/sales/:id/cancel` (lines 17–32) strictly enforces `isAuthorized`, returning HTTP 403 Forbidden:
     ```json
     { "success": false, "error": { "code": "FORBIDDEN", "message": "Forbidden: requires permission sales:void or Admin role to cancel sales" } }
     ```

3. **RBAC Guard in Server Actions (`src/app/(dashboard)/sales/[id]/sale-actions.ts`)**:
   - `cancelSaleAction` (lines 15–21) and `editSaleAction` (lines 40–46) check session authorization and throw:
     ```typescript
     throw new Error('Forbidden: requires permission sales:void or Admin role to cancel sales')
     ```

4. **Inventory Reversal & Partial Return Protection (`src/lib/sales/sales-service.ts`)**:
   - In `cancelSale` (lines 1478–1481):
     ```typescript
     const alreadyReturned = item.returnedQuantity || 0
     const netRestoreQty = Math.max(0, item.quantity - alreadyReturned)
     if (netRestoreQty <= 0) continue
     ```
   - In aggregate inventory update (lines 1488–1494):
     ```typescript
     totalQuantity: { increment: netRestoreQty },
     availableQuantity: { increment: netRestoreQty },
     ```
   - In movement audit logging (lines 1497–1510):
     ```typescript
     type: 'RETURN_IN',
     quantity: netRestoreQty,
     referenceType: 'SALE',
     referenceId: sale.id,
     ```

5. **Exhausted Batch Reactivation & Status Logs (`src/lib/sales/sales-service.ts`)**:
   - In `cancelSale` (lines 1522–1542):
     ```typescript
     const newSold = Math.max(0, batch.soldQuantity - batchRestore)
     const shouldReactivate = batch.status === 'EXHAUSTED' && newSold < batch.quantity

     await tx.batch.update({
       where: { id: ib.batchId },
       data: {
         soldQuantity: newSold,
         status: shouldReactivate ? 'ACTIVE' : batch.status,
       },
     })

     if (shouldReactivate) {
       await tx.batchStatusLog.create({
         data: {
           batchId: batch.id,
           fromStatus: 'EXHAUSTED',
           toStatus: 'ACTIVE',
           reason: `Batch reactivated after Admin cancelled sale ${sale.invoiceNumber}`,
           changedById: actor.id,
         },
       })
     }
     ```

6. **Customer Credit & Ledger Reversal (`src/lib/sales/sales-service.ts`)**:
   - In `cancelSale` (lines 1556–1578):
     ```typescript
     const balanceDueNum = Number(sale.balanceDue)
     if (sale.customerId && balanceDueNum > 0 && tx.customer && tx.customerLedger) {
       const customer = await tx.customer.findUnique({ where: { id: sale.customerId } })
       if (customer) {
         const currentBal = new Prisma.Decimal(customer.outstandingBalance)
         const newBal = currentBal.sub(new Prisma.Decimal(balanceDueNum))
         await tx.customer.update({
           where: { id: sale.customerId },
           data: { outstandingBalance: newBal },
         })
         await tx.customerLedger.create({
           data: {
             customerId: sale.customerId,
             type: 'CREDIT',
             amount: new Prisma.Decimal(balanceDueNum),
             balance: newBal,
             description: `Reversal of credit invoice ${sale.invoiceNumber} (Sale Cancelled)`,
             referenceType: 'SALE',
             referenceId: sale.id,
             entryDate: new Date(),
           },
         })
       }
     }
     ```

7. **Idempotency Guard (`src/lib/sales/sales-service.ts`)**:
   - In `cancelSale` (lines 1463):
     ```typescript
     if (sale.status === 'CANCELLED') throw new Error('Sale is already cancelled')
     ```

8. **Audit Trail Snapshots (`src/lib/sales/sales-service.ts`)**:
   - In `cancelSale` (lines 1594–1623): creates `AuditLog` record with `action: 'SALE_CANCEL'`, `entity: 'Sale'`, `oldData` snapshot (`status`, `totalAmount`, `items`), `newData` snapshot (`status: 'CANCELLED'`, `cancelledReason`, `cancelledAt`), and `metadata` (`invoiceNumber`, `totalAmount`, `cancelledBy`, `reason`).
   - In `editSale` (lines 1973–2009): creates `AuditLog` record with `action: 'SALE_UPDATE'`, `entity: 'Sale'`, `oldData` snapshot (`totalAmount`, `subtotal`, items), `newData` snapshot (`totalAmount`, `subtotal`, items, `reason`), and `metadata` (`invoiceNumber`, `oldTotal`, `newTotal`, `reason`).

---

### 1.2 Empirical Test Execution & Results

Two dedicated adversarial test suites were constructed and executed:

#### Command 1: RBAC Penetration Suite
```bash
npx jest sales-adversarial-rbac
```
**Output**:
```text
PASS unit src/app/api/sales/[id]/__tests__/sales-adversarial-rbac.test.ts
  Adversarial RBAC Penetration Suite (Admin Bill Ops, Inventory Reversal, & Routes)
    Penetration Vector 1: PATCH /api/sales/:id (Bill Modification)
      √ rejects Cashier with HTTP 403 Forbidden (21 ms)
      √ rejects Pharmacist lacking sales:void with HTTP 403 Forbidden (3 ms)
      √ rejects unprivileged Staff/Intern with HTTP 403 Forbidden (2 ms)
      √ rejects Malicious Guest with HTTP 403 Forbidden (7 ms)
      √ allows Admin persona with HTTP 200 OK (4 ms)
      √ allows Pharmacist WITH sales:void permission with HTTP 200 OK (1 ms)
      √ allows Manager persona with HTTP 200 OK (1 ms)
      √ rejects malformed PATCH request (missing items array) with HTTP 400 Bad Request (2 ms)
    Penetration Vector 2: DELETE /api/sales/:id (Bill Cancellation & Stock Reversal)
      √ rejects Cashier session with HTTP 403 Forbidden (2 ms)
      √ rejects Pharmacist lacking sales:void with HTTP 403 Forbidden (1 ms)
      √ allows Owner persona with HTTP 200 OK (2 ms)
      √ allows Super Admin persona with HTTP 200 OK (2 ms)
    Penetration Vector 3: POST /api/sales/:id/cancel
      √ rejects Cashier session with HTTP 403 Forbidden (2 ms)
      √ rejects Pharmacist lacking sales:void with HTTP 403 Forbidden (1 ms)
      √ rejects short cancellation reason (< 3 chars) with HTTP 400 Validation Error (5 ms)
      √ allows Pharmacist WITH sales:void permission with HTTP 200 OK (2 ms)
    Penetration Vector 4: Server Actions (cancelSaleAction & editSaleAction)
      √ rejects Cashier invoking cancelSaleAction with Forbidden error (24 ms)
      √ rejects Pharmacist without sales:void invoking cancelSaleAction with Forbidden error (1 ms)
      √ rejects Cashier invoking editSaleAction with Forbidden error (2 ms)
      √ rejects Pharmacist without sales:void invoking editSaleAction with Forbidden error (1 ms)
      √ allows Admin invoking cancelSaleAction and triggers revalidatePath
      √ allows Admin invoking editSaleAction and returns updated sale (1 ms)

Test Suites: 1 passed, 1 total
Tests:       22 passed, 22 total
```

#### Command 2: Adversarial Inventory Reversal & Stress Suite
```bash
npx jest sales-adversarial-stress
```
**Output**:
```text
PASS unit src/lib/sales/__tests__/sales-adversarial-stress.test.ts
  Empirical Adversarial Stress Suite: Admin Bill Ops, Inventory Reversal, and Audit Logs
    Direct Service RBAC Lockdown
      √ blocks Cashier calling editSale with Forbidden error (41 ms)
      √ blocks Pharmacist without sales:void calling editSale with Forbidden error (1 ms)
      √ blocks Cashier calling cancelSale with Forbidden error (2 ms)
      √ blocks Pharmacist without sales:void calling cancelSale with Forbidden error
      √ blocks unauthenticated / empty actor from editSale and cancelSale (1 ms)
    Inventory Reversal with Partial Return Guard
      √ restores net quantity Math.max(0, quantity - returnedQuantity) when 2 of 10 units already returned (4 ms)
      √ bypasses inventory update completely when all units were already returned (netRestoreQty = 0) (2 ms)
      √ safely handles over-returned anomalous state (returnedQuantity > quantity) without negative stock restore (1 ms)
      √ correctly handles multi-item invoice with mixed return ratios (1 ms)
    Batch Reactivation & BatchStatusLog Creation
      √ reactivates EXHAUSTED batch to ACTIVE and writes BatchStatusLog entry (1 ms)
      √ does NOT write BatchStatusLog when batch was already ACTIVE (1 ms)
      √ correctly restores multi-batch line item split where both batches were EXHAUSTED (1 ms)
    Customer Credit Ledger Reversals
      √ reduces outstanding balance by full balanceDue and creates CREDIT ledger entry (2 ms)
      √ reduces outstanding balance by ONLY balanceDue on partial payment credit sale (1 ms)
      √ does NOT modify customer balance or ledger if bill was fully paid (balanceDue = 0) (1 ms)
    Idempotency & Boundary Error Paths
      √ strictly rejects double-cancellation attempt with "Sale is already cancelled" (5 ms)
      √ rejects cancellation for non-existent sale ID with "Not Found: sale"
      √ rejects editSale on a sale that is already CANCELLED (2 ms)
    AuditLog Records Validation (SALE_CANCEL & SALE_UPDATE)
      √ writes enriched AuditLog on SALE_CANCEL with comprehensive oldData and newData snapshots (1 ms)
      √ writes enriched AuditLog on SALE_UPDATE with oldData and newData financial snapshots (3 ms)

Test Suites: 1 passed, 1 total
Tests:       20 passed, 20 total
```

#### Command 3: Full Sales & Integration Regression Run
```bash
npx jest sales-adversarial sales-admin-ops sales-rbac-routes production-enhancements-e2e
```
**Output**:
```text
PASS unit src/app/api/sales/[id]/__tests__/sales-rbac-routes.test.ts
PASS unit src/app/api/sales/[id]/__tests__/sales-adversarial-rbac.test.ts
PASS unit src/__tests__/e2e/production-enhancements-e2e.test.ts
PASS unit src/lib/sales/__tests__/sales-admin-ops.test.ts
PASS unit src/lib/sales/__tests__/sales-adversarial-stress.test.ts

Test Suites: 5 passed, 5 total
Tests:       110 passed, 110 total
Snapshots:   0 total
Time:        4.943 s
```

---

## 2. Logic Chain

1. **Security & RBAC Perimeter Integrity**:
   - *Observation*: Lines 74–89, 141–156 in `src/app/api/sales/[id]/route.ts` and lines 17–32 in `src/app/api/sales/[id]/cancel/route.ts` check for `PERMISSIONS.SALES_VOID` or roles `['admin', 'owner', 'manager', 'super_admin']`.
   - *Logic*: Non-admin personas (cashiers, pharmacists without void permission, interns, guest users) do not possess `sales:void` or privileged administrative roles. Thus, any HTTP request (`PATCH`, `DELETE`, `POST /cancel`) is rejected immediately at the route handler level with HTTP 403 Forbidden.
   - *Defense-in-Depth*: In `src/lib/sales/sales-service.ts` (lines 1444 and 1661) and `sale-actions.ts` (lines 19 and 44), identical authorization checks are enforced. If an attacker bypasses the HTTP route or invokes server actions directly, the core service rejects the call and aborts the transaction before any database mutations occur.

2. **Partial Return Protection (Zero Phantom Inventory)**:
   - *Observation*: Line 1480 of `src/lib/sales/sales-service.ts` calculates `netRestoreQty = Math.max(0, item.quantity - alreadyReturned)`.
   - *Logic*: When a sale has 10 units and 2 units were previously returned, 2 units were already replenished to inventory during the return transaction. Restoring 10 units on bill cancellation would create 2 "phantom" units in stock. `Math.max(0, 10 - 2) = 8` ensures only the remaining 8 units are incremented in `Inventory` and decremented from `Batch.soldQuantity`. When all units were returned (`5 - 5 = 0`), the loop continues without performing any inventory or batch updates.

3. **Batch Reactivation Correctness**:
   - *Observation*: Lines 1523–1542 of `src/lib/sales/sales-service.ts` evaluate `shouldReactivate = batch.status === 'EXHAUSTED' && newSold < batch.quantity`.
   - *Logic*: A batch is marked `EXHAUSTED` when all units are sold. Decrementing `soldQuantity` upon bill cancellation means available units now exist. Updating the status from `EXHAUSTED` to `ACTIVE` restores the batch to active dispensary dispensation.
   - *Audit Trail*: Because this status transition represents a regulatory state change in batch management, writing a `BatchStatusLog` with `fromStatus: 'EXHAUSTED'`, `toStatus: 'ACTIVE'`, and the actor ID guarantees full compliance with drug batch lifecycle tracking. Active batches decremented without status change do not trigger redundant logs.

4. **Financial Consistency in Customer Credit Reversals**:
   - *Observation*: Lines 1556–1578 of `src/lib/sales/sales-service.ts` check `balanceDueNum = Number(sale.balanceDue)` and update `Customer.outstandingBalance` by subtracting `balanceDueNum`.
   - *Logic*: For a credit sale with `balanceDue = 500`, the customer was previously debited 500 on their ledger. Cancelling the bill requires reversing this liability. Deducting 500 from `outstandingBalance` and posting a `CREDIT` entry in `CustomerLedger` resets their financial obligation. If the customer made a partial payment (e.g., total 1000, paid 400, balance 600), only the uncollected credit amount (600) is deducted from the ledger, preventing financial distortion.

5. **Idempotency & Re-cancellation Defense**:
   - *Observation*: Line 1463 of `src/lib/sales/sales-service.ts` asserts `if (sale.status === 'CANCELLED') throw new Error('Sale is already cancelled')`.
   - *Logic*: If an administrator or malicious actor submits multiple cancellation requests concurrently or sequentially, the first request transitions the status to `'CANCELLED'`. Any subsequent invocation is rejected immediately, preventing duplicate inventory restoration, multiple credit ledger entries, or double refunds.

6. **Statutory Audit Log Integrity**:
   - *Observation*: Lines 1594–1623 (`SALE_CANCEL`) and lines 1973–2009 (`SALE_UPDATE`) populate `AuditLog` records with `oldData`, `newData`, and `metadata`.
   - *Logic*: Under statutory pharmacy regulations, altering or voiding finalized bills requires an immutable audit trail showing the state before modification and the state after modification. The snapshots capture line items, quantities, financial totals, and user justification, ensuring tamper evidence.

---

## 3. Caveats

1. **Test Environment Scope**: Empirical tests were executed against Jest 29 with mocked Prisma ORM transactions to verify route-level responses, business calculations, and database transaction queries in isolation without requiring a live PostgreSQL instance.
2. **Thermal Hardware / Live WhatsApp API**: Physical 80mm thermal receipt printing and live Meta WhatsApp Cloud API network calls were not tested in this domain (verified separately by Challenger 1).
3. **No Uninvestigated Assumptions**: All 5 verification vectors specified in the dispatch instructions were directly exercised and tested.

---

## 4. Conclusion

**Verdict: APPROVE**

The implementation of Admin Bill Operations, Inventory Reversal, and RBAC Security in `src/lib/sales/sales-service.ts`, `src/app/api/sales/[id]/route.ts`, `src/app/api/sales/[id]/cancel/route.ts`, and `src/app/(dashboard)/sales/[id]/sale-actions.ts` satisfies all functional, architectural, and security requirements without defects:
1. **RBAC Penetration**: Cashiers and unprivileged staff are rejected with HTTP 403 Forbidden across all endpoints and actions. Only authorized administrators and `sales:void` holders succeed.
2. **Inventory Reversal**: Net stock restoration protects against over-restoration on partial returns; batches reactivate cleanly from `EXHAUSTED` to `ACTIVE` with `BatchStatusLog` audit records.
3. **Ledger & Credit Reversal**: Customer balances and ledgers are reversed based on `balanceDue`.
4. **Idempotency**: Duplicate cancellations are rejected.
5. **Audit Trail**: Detailed `SALE_CANCEL` and `SALE_UPDATE` snapshots are written to `AuditLog`.

All 110 tests across the sales and end-to-end test suites pass cleanly with 0 failures.

---

## 5. Verification Method

To independently execute and verify all empirical findings:

```bash
# 1. Run the RBAC penetration test suite
npx jest sales-adversarial-rbac

# 2. Run the inventory reversal, batch reactivation, and audit log stress test suite
npx jest sales-adversarial-stress

# 3. Run the full sales suite and E2E regression suite
npx jest sales-adversarial sales-admin-ops sales-rbac-routes production-enhancements-e2e
```

### Invalidation Conditions:
- Any cashiers or pharmacists without `sales:void` being able to edit or delete sales without HTTP 403.
- Bill cancellation restoring 10 units to inventory on a bill where 2 units were already returned.
- Batch status remaining `EXHAUSTED` after all sold units are restored via cancellation.
- Re-cancellation of an already cancelled bill succeeding or executing stock updates.
- Failure of any of the 110 automated tests.
