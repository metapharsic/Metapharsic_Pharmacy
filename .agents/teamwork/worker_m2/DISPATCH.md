# Dispatch — Worker M2: Inventory Provisioning & Persistence Engine

**Role**: `teamwork_worker`  
**Milestone**: Milestone M2 (Inventory Provisioning & Persistence Engine)  
**Assigned Features**:
- F11: Transactional Provisioning Service (`src/lib/purchases/purchase-provisioning-service.ts`) executing atomic `prisma.$transaction`.
- F12: Purchase Record Persistence (`Purchase` with `status: 'RECEIVED'` and `PurchaseItem` records).
- F13: Collision-Safe Batch Upsert (`tx.batch.upsert` on `@@unique([productId, batchNumber])` with quantity increment and reactivation from `EXHAUSTED` to `ACTIVE`).
- F14: Free Quantity Bonus Stock Provisioning (`billedQuantity + freeQuantity` into usable inventory).
- F15: CAS Branch Inventory Increments (`@@unique([productId, branchId])`).
- F16: Inventory Movement Audit Logging (`InventoryMovement` with `type: 'IN'`, `referenceType: 'PURCHASE'`).
- F17: Accounts Payable Ledger Posting (`SupplierLedger` credit liability and `Supplier.outstandingBalance`).
- F18: Input Tax Credit (ITC) GST Posting (`postGstTransactionForPurchase` integration).
- F19: Bill Confirmation API Route (`POST /api/purchases/scan/commit` with auth, RBAC `purchases:create`, and Zod validation).

---

## 🔒 Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

---

## Technical Specifications
Read:
- `c:\metapharsic-pharmacy-complete\PROJECT.md`
- `c:\metapharsic-pharmacy-complete\.agents\teamwork\orchestrator_3\IMPLEMENTATION_PLAN.md` (Sections 3 & 6)
- `c:\metapharsic-pharmacy-complete\src\__tests__\e2e\purchase-bill-test-harness.ts`
- `c:\metapharsic-pharmacy-complete\src\__tests__\e2e\purchase-bill-scanning-e2e.test.ts`
- `c:\metapharsic-pharmacy-complete\prisma\schema.prisma`

### Write Ownership (Exclusive to Worker M2):
- `src/lib/purchases/purchase-provisioning-service.ts` (create)
- `src/lib/purchases/__tests__/purchase-provisioning.test.ts` (create)
- `src/app/api/purchases/scan/commit/route.ts` (create)
- `src/app/api/purchases/scan/commit/__tests__/commit-route.test.ts` (create)

---

## Implementation Requirements

### 1. `src/lib/purchases/purchase-provisioning-service.ts`
Define Zod schema `commitPurchasePayloadSchema` and TypeScript type `CommitPurchasePayload`:
```typescript
{
  branchId: string (uuid)
  supplierId?: string (optional)
  newSupplier?: {
    name: string
    gstin?: string
    dlNumber?: string
    phone?: string
    email?: string
    address?: string
  }
  invoiceNumber: string
  invoiceDate: string (ISO date or parseable)
  items: Array<{
    productId: string
    batchNumber: string
    expiryDate: string
    billedQuantity: number (min 0)
    freeQuantity?: number (default 0)
    unitCost: number
    mrp: number
    ptr?: number
    discountPercent?: number (default 0)
    taxPercent?: number (default 0)
    taxAmount?: number (default 0)
    totalAmount: number
  }>
  subtotal: number
  discountAmount?: number
  taxAmount?: number
  roundOff?: number
  totalAmount: number
  notes?: string
}
```

Implement `provisionPurchaseBill(payload: CommitPurchasePayload, sessionUser: { id: string; name?: string })`:
- Execute inside `prisma.$transaction(async (tx) => { ... }, { timeout: 15000 })`.
- Handle existing supplier vs `newSupplier` creation.
- Create `Purchase` record with:
  - `purchaseNumber: 'PB-' + Date.now()` (or sequential counter)
  - `status: 'RECEIVED'`
  - `balanceDue: payload.totalAmount`
  - `createdById: sessionUser.id`
- For each item:
  - `totalUsableQty = item.billedQuantity + (item.freeQuantity || 0)`
  - Create `PurchaseItem`
  - `tx.batch.upsert` with `where: { productId_batchNumber: { productId: item.productId, batchNumber: item.batchNumber.trim().toUpperCase() } }`:
    - `create`: `{ productId, batchNumber, expiryDate, purchasePrice: item.unitCost, mrp: item.mrp, ptr: item.ptr || item.unitCost, quantity: totalUsableQty, status: 'ACTIVE', branchId, purchaseId }`
    - `update`: `{ quantity: { increment: totalUsableQty }, status: 'ACTIVE', purchasePrice: item.unitCost, mrp: item.mrp, expiryDate: new Date(item.expiryDate) }`
  - Update `purchaseItem.batchId = batch.id`
  - `tx.inventory`: check `findUnique({ where: { productId_branchId: { productId, branchId } } })`. Update with `{ totalQuantity: { increment: totalUsableQty }, availableQuantity: { increment: totalUsableQty } }` or create if none exists.
  - Log `tx.inventoryMovement.create`: `{ type: 'IN', referenceType: 'PURCHASE', referenceId: purchase.id, batchId: batch.id, quantity: totalUsableQty, ... }`
- Update `tx.supplier.update`: `{ where: { id: supplierId }, data: { outstandingBalance: { increment: payload.totalAmount } } }`
- Create `tx.supplierLedger.create`: `{ supplierId, type: 'CREDIT', amount: payload.totalAmount, referenceType: 'PURCHASE', referenceId: purchase.id, description: 'Purchase Bill Inv #' + payload.invoiceNumber }`
- Call GST ITC posting helper if available (with fallback safety): `postGstTransactionForPurchase(purchase.id, tx)`.
- Create `tx.auditLog.create`: `{ action: 'PURCHASE_BILL_SCAN_CONFIRM', entity: 'Purchase', entityId: purchase.id, userId: sessionUser.id, branchId, details: ... }`
- Return `{ purchase, itemsProvisioned: payload.items.length, totalUsableQty }`.

### 2. `src/app/api/purchases/scan/commit/route.ts`
- Handle `POST /api/purchases/scan/commit`.
- Check authentication via `auth()` or session provider; return 401 if unauthenticated.
- Check RBAC permissions (e.g. `purchases:create` / `PURCHASES_CREATE`); return 403 if unauthorized.
- Validate body with `commitPurchasePayloadSchema`; return 400 with Zod errors if invalid.
- Call `provisionPurchaseBill`.
- Return 200/201 with `{ success: true, data: { purchaseId: purchase.id, purchaseNumber: purchase.purchaseNumber, totalAmount: purchase.totalAmount } }`.

### 3. Comprehensive Unit & Integration Tests
- `src/lib/purchases/__tests__/purchase-provisioning.test.ts`: test atomic transaction, supplier upsert, batch upsert with quantity increment and reactivation, CAS inventory update, AP ledger entry, free goods stock increment, and rollback on error.
- `src/app/api/purchases/scan/commit/__tests__/commit-route.test.ts`: test 401 unauthenticated, 403 unauthorized, 400 validation error, and 200 successful commit.

---

## Verification Commands
1. `npx jest src/lib/purchases/__tests__/purchase-provisioning.test.ts --forceExit`
2. `npx jest src/app/api/purchases/scan/commit/__tests__/commit-route.test.ts --forceExit`
3. `npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit`
4. `npx eslint src/lib/purchases/purchase-provisioning-service.ts src/app/api/purchases/scan/commit/route.ts`
5. `npx tsc --noEmit`

Write your handoff report to:
`c:\metapharsic-pharmacy-complete\.agents\teamwork\worker_m2\handoff.md`

## 2026-11-03T13:48:38Z
You are worker_m2, a teamwork_worker subagent.
Working directory: c:\metapharsic-pharmacy-complete\.agents\teamwork\worker_m2\
Sender: 056deacb-bfc4-49c9-95d1-5d0d88085f22

Tasks:
1. Initialize progress.md in your working directory.
2. Implement src/lib/purchases/purchase-provisioning-service.ts with atomic prisma.$transaction provisioning:
   - commitPurchasePayloadSchema (Zod validation)
   - provisionPurchaseBill function handling supplier upsert, Purchase/PurchaseItem records, collision-safe Batch.upsert (@@unique([productId, batchNumber])) with reactivation of EXHAUSTED batches, usable inventory increment (billedQty + freeQty), CAS Inventory update, InventoryMovement audit log, SupplierLedger AP liability, GST ITC posting, and AuditLog recording.
3. Implement src/app/api/purchases/scan/commit/route.ts:
   - POST route with auth, RBAC purchases:create check, payload validation, and service execution.
4. Implement unit & integration test suites:
   - src/lib/purchases/__tests__/purchase-provisioning.test.ts
   - src/app/api/purchases/scan/commit/__tests__/commit-route.test.ts
5. Run verification:
   - npx jest src/lib/purchases/__tests__/purchase-provisioning.test.ts --forceExit
   - npx jest src/app/api/purchases/scan/commit/__tests__/commit-route.test.ts --forceExit
   - npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit
   - npx eslint src/lib/purchases/purchase-provisioning-service.ts src/app/api/purchases/scan/commit/route.ts
   - npx tsc --noEmit
6. Write handoff.md in your working directory and notify orchestrator when done via send_message.
