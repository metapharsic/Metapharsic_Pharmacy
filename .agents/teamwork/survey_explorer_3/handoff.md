# Survey Report: Sales & Billing Backend, Admin Bill Modification, Deletion & Inventory Reversal

**Agent**: Survey Explorer 3 (`teamwork_explorer`)  
**Mission**: Investigate sales/billing backend, schema, stock decrement logic, admin bill modification and cancellation with inventory reversal, audit logging, and RBAC permission enforcement.  
**Target File**: `c:\metapharsic-pharmacy-complete\.agents\teamwork\survey_explorer_3\handoff.md`  
**Timestamp**: 2026-11-02T14:15:00Z  

---

## 1. Observation

### 1.1 Database Schema Analysis (`prisma/schema.prisma`)
The relevant data models and their relational constraints were inspected directly from `prisma/schema.prisma`:

1. **`Sale` (lines 585–630)**:
   - Primary key: `id String @id @default(cuid())`
   - Invoice: `invoiceNumber String @unique`
   - Status field: `status SaleStatus @default(COMPLETED)`
     - Enum `SaleStatus`: `COMPLETED`, `CANCELLED`, `PARTIALLY_RETURNED`, `FULLY_RETURNED` (lines 631–636).
   - Cancellation tracking: `cancelledAt DateTime?`, `cancelledReason String?` (lines 611–612).
   - Payment status: `paymentStatus PaymentStatus @default(PAID)` (`PAID`, `PARTIAL`, `CREDIT`, `OVERPAID`).
   - Financial totals: `subtotal`, `discountAmount`, `discountPercent`, `taxAmount`, `cgstAmount`, `sgstAmount`, `igstAmount`, `totalAmount`, `amountPaid`, `balanceDue`.
   - Relational links:
     - `items`: `SaleItem[]` (lines 620, 669 with `onDelete: Cascade`)
     - `payments`: `Payment[]` (lines 621, 703)
     - `returns`: `SaleReturn[]` (lines 622, 911)
     - `ScheduleH1Register`: `ScheduleH1Register[]` (lines 623, 1371)
     - `commissions`: `DoctorCommission[]` (lines 587, 1341)
     - `createdBy`: `User @relation("SaleCreatedBy", fields: [createdById], references: [id])`

2. **`SaleItem` & `SaleItemBatch` (lines 645–688)**:
   - `SaleItem`: `id`, `saleId`, `productId`, `productName`, `productSku`, `quantity`, `billedUnits`, `looseUnits`, `unitPrice`, `discountPercent`, `discountAmount`, `taxPercent`, `taxAmount`, `totalAmount`, `returnedQuantity Int @default(0)`.
   - `SaleItemBatch`: Connects each sale line item to the exact physical batch from which stock was deducted:
     - `id String @id @default(cuid())`
     - `saleItemId String` (references `SaleItem.id` on delete cascade)
     - `batchId String` (references `Batch.id`)
     - `quantity Int` (units deducted from this specific batch)
     - `unitPrice Decimal`

3. **`Batch` (lines 500–557)**:
   - `id`, `productId`, `batchNumber`, `expiryDate`, `mrp`, `purchasePrice`
   - Quantities: `quantity Int @default(0)`, `reservedQuantity Int @default(0)`, `soldQuantity Int @default(0)`
   - Status: `status BatchStatus @default(ACTIVE)`
     - Enum `BatchStatus`: `ACTIVE`, `BLOCKED`, `EXPIRED`, `DISPOSED`, `EXHAUSTED` (lines 537–543)
   - Available stock math: `available = quantity - reservedQuantity - soldQuantity`
   - Log history: `statusLogs BatchStatusLog[]`

4. **`Inventory` & `InventoryMovement` (lines 405–452)**:
   - `Inventory`: `id`, `productId`, `branchId`, `totalQuantity Int @default(0)`, `reservedQuantity Int @default(0)`, `availableQuantity Int @default(0)`. Compound unique: `@@unique([productId, branchId])`.
   - `InventoryMovement`: `id`, `inventoryId`, `type MovementType`, `quantity Int`, `quantityBefore Int`, `quantityAfter Int`, `referenceType String?` (`"SALE"`, `"PURCHASE"`, `"ADJUSTMENT"`, `"RETURN"`), `referenceId String?`, `batchId String?`, `createdById String?`.
     - Enum `MovementType`: `IN`, `OUT`, `ADJUSTMENT`, `RETURN_IN`, `RETURN_OUT`, `TRANSFER`, `WRITE_OFF`.

5. **`AuditLog` (lines 1286–1305)**:
   - `id String @id @default(cuid())`
   - `userId String?` (references `User.id`)
   - `action String` (`"SALE_CREATE"`, `"SALE_UPDATE"`, `"SALE_CANCEL"`, etc.)
   - `entity String` (`"Sale"`)
   - `entityId String?` (sale ID)
   - `oldData Json?`
   - `newData Json?`
   - `ipAddress String?`, `userAgent String?`, `metadata Json?`, `createdAt DateTime @default(now())`

6. **Users, Roles & Permissions (`prisma/schema.prisma` lines 21–181 & `prisma/seeds/roles.ts`)**:
   - `UserRole`: Many-to-many relationship linking `User` to `Role`.
   - `RolePermission`: Many-to-many relationship linking `Role` to `Permission`.
   - Seeded system roles (`prisma/seeds/roles.ts`):
     - `owner`: full administrative privileges (`permissions: 'ALL'`).
     - `manager`: supervisory privileges, explicitly including `sales:void`, `sales:create`, `sales:read`, etc.
     - `pharmacist`: dispensing privileges (`sales:create`, `sales:read`, `sales:discount`), explicitly **omitting** `sales:void`.
     - `cashier`: checkout counter privileges (`sales:create`, `sales:read`, `invoices:print`), explicitly **omitting** `sales:void`.

---

### 1.2 Sales Creation & Stock Decrement Trace (`src/lib/sales/sales-service.ts`)
In `createSale(command: CreateSaleCommand, actor: SaleActor)` (lines 962–1434):
1. **Transaction Isolation**: Runs in `prisma.$transaction` at `'Serializable'` isolation level with automatic retry via `runWithRetry`.
2. **Batch Allocation**: Selects active, non-expired batches using FEFO (`allocateFefo`) or FIFO.
3. **Batch Stock Mutation (lines 1179–1219)**:
   - Updates batch with optimistic CAS:
     ```ts
     const newSold = batch.soldQuantity + a.allocatedQuantity
     await tx.batch.updateMany({
       where: { id: batch.id, quantity: batch.quantity, soldQuantity: batch.soldQuantity, status: 'ACTIVE' },
       data: { soldQuantity: newSold },
     })
     ```
   - If `batch.quantity - batch.reservedQuantity - newSold === 0`, marks batch status as `'EXHAUSTED'` and writes an audit entry to `tx.batchStatusLog.create(...)`.
   - Records each allocated batch into `SaleItemBatch` (`itemBatchMoves`).
4. **Aggregate Inventory Mutation (lines 1221–1239)**:
   - Updates product-branch inventory via CAS:
     ```ts
     await tx.inventory.updateMany({
       where: { id: inventory.id, updatedAt: inventory.updatedAt },
       data: { totalQuantity: afterTotal, availableQuantity: afterAvailable },
     })
     ```
   - Creates `InventoryMovement` with `type: 'OUT'`, `quantity: -quantity`, `referenceType: 'SALE'`, `referenceId: sale.id`.
5. **Credit Sales & Ledgers (lines 1373–1394)**:
   - If `balanceDue > 0` on a credit sale, updates `Customer.outstandingBalance += balanceDue` and inserts a `DEBIT` entry into `customerLedger`.
6. **Statutory & Audit Logging (lines 1396–1428)**:
   - Posts line-item records to `GstTransaction`.
   - Records Doctor commission in `DoctorCommission`.
   - Creates `AuditLog`:
     ```ts
     await tx.auditLog.create({
       data: {
         userId: actor.id,
         action: 'SALE_CREATE',
         entity: 'Sale',
         entityId: sale.id,
         metadata: { invoiceNumber: sale.invoiceNumber, totalAmount: totals.totalAmount, ... },
       },
     })
     ```

---

### 1.3 Existing Bill Modification & Deletion Analysis

#### A. Bill Modification (`editSale` in `src/lib/sales/sales-service.ts` lines 1530–1874)
- **Endpoint**: `PATCH /api/sales/[id]` in `src/app/api/sales/[id]/route.ts`.
- **Server Action**: `editSaleAction` in `src/app/(dashboard)/sales/[id]/sale-actions.ts`.
- **UI Dialog**: `EditSaleDialog` in `src/components/sales/edit-sale-dialog.tsx`.
- **Stock Reversal & Deduction**:
  - Compares `diff = oldQty - newQty`:
    - `diff > 0` (reducing quantity):
      - Decrements `batch.soldQuantity -= diff`.
      - If batch status was `'EXHAUSTED'`, restores status to `'ACTIVE'` and writes a `batchStatusLog` entry.
      - Increments `inventory.totalQuantity` and `inventory.availableQuantity` by `diff`.
      - Writes `InventoryMovement` with `type: 'RETURN_IN'`, `referenceType: 'SALE'`.
      - Handles immediate customer cash refund via negative `Payment` entry if overpaid.
    - `diff < 0` (increasing quantity):
      - Verifies available stock and batch quantity.
      - Increments `batch.soldQuantity += |diff|` and decrements `inventory`.
      - Writes `InventoryMovement` with `type: 'OUT'`.
    - `newQty === 0`: Deletes `SaleItem` and `SaleItemBatch` (validates that at least 1 item remains).
  - Recalculates subtotal, discounts, CGST, SGST, IGST, totalAmount, amountPaid, and balanceDue.
  - Re-posts GST transaction entries.
  - Records `tx.auditLog.create({ action: 'SALE_UPDATE', entity: 'Sale', entityId: sale.id, metadata: { ... } })`.

#### B. Bill Cancellation (`cancelSale` in `src/lib/sales/sales-service.ts` lines 1437–1504)
- **Endpoint**: `POST /api/sales/[id]/cancel` in `src/app/api/sales/[id]/cancel/route.ts`.
- **Server Action**: `cancelSaleAction` in `src/app/(dashboard)/sales/[id]/sale-actions.ts`.
- **UI Dialog**: `SaleActionButtons` in `src/app/(dashboard)/sales/[id]/sale-action-buttons.tsx` and `sale-bill-detail-dialog.tsx`.
- **Missing Endpoint**: There is **no `DELETE /api/sales/[id]`** endpoint in `src/app/api/sales/[id]/route.ts`.
- **Current Execution**:
  - Updates `sale.status = 'CANCELLED'`, `cancelledAt = new Date()`, `cancelledReason = reason`.
  - Increments `inventory.totalQuantity` and `availableQuantity` by `item.quantity`.
  - Creates `InventoryMovement` with `type: 'RETURN_IN'`, `referenceType: 'SALE'`.
  - Decrements `batch.soldQuantity` by `ib.quantity`.

---

### 1.4 Identified Critical Deficiencies and Vulnerabilities

1. **CRITICAL RBAC LOOPHOLE in `editSale` (Line 1534)**:
   In `src/lib/sales/sales-service.ts`:
   ```ts
   const canEdit =
     permissions.includes(PERMISSIONS.SALES_CREATE) ||
     permissions.includes(PERMISSIONS.SALES_VOID) ||
     roles.some((r) => ['admin', 'owner', 'manager'].includes(r.toLowerCase()))
   ```
   **Vulnerability**: Checking `permissions.includes(PERMISSIONS.SALES_CREATE)` grants **every Cashier and Pharmacist** permission to modify finalized sales!
   In `src/app/api/sales/[id]/route.ts` (lines 69–71), `PATCH` only calls `const sessionUser = await requireAuth()`. It does not check permissions. A cashier can directly send a `PATCH` request to edit invoices.
   In `src/app/(dashboard)/sales/[id]/page.tsx` (lines 71–72), `canEditSale` checks `canCreate || canCancel || isAdminOrManager`, rendering the edit button to cashiers.

2. **CRITICAL DEFECT: No AuditLog in `cancelSale`**:
   In `src/lib/sales/sales-service.ts` lines 1437–1504, `tx.auditLog.create` is **never called**!
   Requirement R4 explicitly commands: *"Bill deletion or modification must use soft deletion / cancellation, revert inventory stock quantities accordingly, and record audit log entries."*

3. **CRITICAL DEFECT: No Batch Status Reactivation in `cancelSale`**:
   When stock is cancelled and returned to a batch whose status was set to `'EXHAUSTED'`, `cancelSale` decrements `soldQuantity` but **fails to reset `status` back to `'ACTIVE'`** and does not create a `batchStatusLog` record (unlike `editSale` which does reactivate batches). The batch remains permanently `'EXHAUSTED'`, preventing store staff from dispensing returned stock.

4. **INVENTORY INFLATION RISK: Double-Restock on Partial Returns in `cancelSale`**:
   `cancelSale` restores `item.quantity` without checking `item.returnedQuantity`. If a customer had previously returned 2 tablets of a 10-tablet bill (via `createSaleReturn`), `cancelSale` adds all 10 tablets back to stock instead of the remaining 8, creating phantom stock.

5. **CUSTOMER LEDGER NOT REVERSED in `cancelSale`**:
   If a credit sale with `balanceDue > 0` is cancelled, `customer.outstandingBalance` is not decreased, and no reversal entry is added to `customerLedger`.

6. **GST & COMMISSION ORPHANING in `cancelSale`**:
   `GstTransaction` and `DoctorCommission` records linked to the cancelled sale are not cleared or reversed.

7. **Missing Standard `DELETE /api/sales/[id]` Route**:
   REST API consumers expect `DELETE /api/sales/[id]` to trigger soft deletion / cancellation with reason and inventory reversal.

---

## 2. Logic Chain

```
Observation: prisma/seeds/roles.ts defines 'cashier' with 'sales:create' and 'sales:read', but explicitly NO 'sales:void'.
Observation: Requirement R4 states "Non-admin users cannot modify or delete finalized bills."
Observation: src/lib/sales/sales-service.ts:1534 permits anyone with PERMISSIONS.SALES_CREATE to execute editSale.
Observation: src/app/api/sales/[id]/route.ts:71 requires only requireAuth() for PATCH.
Observation: src/app/(dashboard)/sales/[id]/page.tsx:72 enables canEditSale if canCreate is true.
  ==> Logic Step 1: Cashiers are currently able to view the edit dialog and successfully edit bills via API and UI.
  ==> Logic Step 2: To enforce R4, SALES_CREATE must be eliminated from authorization checks for editing and voiding. Only users with SALES_VOID or explicit Admin/Owner/Manager roles must be permitted.

Observation: prisma/schema.prisma lines 604 & 611-612 contain status: SaleStatus, cancelledAt: DateTime?, and cancelledReason: String?.
Observation: Hard deletion of Sale would violate cascade constraints on schedule_h1_register, audit_logs, doctor_commissions, and payments.
  ==> Logic Step 3: Bill "deletion" must be implemented strictly as Soft Deletion (setting status = 'CANCELLED', timestamping cancelledAt, and persisting cancelledReason).

Observation: src/lib/sales/sales-service.ts lines 1455-1502 execute stock restoration without calling tx.auditLog.create.
Observation: Requirement R4 mandates audit log entries for bill deletion/modification.
  ==> Logic Step 4: cancelSale must execute tx.auditLog.create with action: 'SALE_CANCEL', capturing entity: 'Sale', entityId: sale.id, oldData snapshot, newData snapshot, and metadata (invoiceNumber, totalAmount, reason, actor).

Observation: createSale sets batch.status = 'EXHAUSTED' when soldQuantity reaches batch.quantity.
Observation: cancelSale decrements soldQuantity but does not update batch.status.
  ==> Logic Step 5: When soldQuantity is decremented below batch.quantity on an EXHAUSTED batch, batch.status must be updated to ACTIVE and logged to BatchStatusLog.

Observation: SaleItem tracks returnedQuantity when customer returns are processed via createSaleReturn.
Observation: cancelSale increments inventory by item.quantity indiscriminately.
  ==> Logic Step 6: The quantity restored to inventory and batches upon cancellation must strictly equal:
      restoreQty = Math.max(0, item.quantity - (item.returnedQuantity || 0)).
```

---

## 3. Caveats

1. **Closed Financial Periods (`PeriodLock`)**:
   If an invoice belongs to a closed accounting period locked in `period_locks`, modifying or cancelling the bill could alter filed GST balances. The implementation should check whether the sale date falls within a locked period and prevent cancellation/modification unless overridden by a Super Admin.
2. **Physical Cash Handling**:
   When an admin edits or cancels a cash bill, the system can record negative payment entries (`CASH` refund). However, actual cash in the physical POS cash drawer must be reconciled by the store manager at end-of-day.
3. **Prescription Drug Registers (Schedule H / H1 / X)**:
   For scheduled drugs already registered in `schedule_h1_register`, soft cancellation preserves the audit entry so drug inspectors can verify that the sale was voided rather than deleted to conceal unaccounted stock.

---

## 4. Architectural Recommendations & Detailed Design

### 4.1 RBAC Enforcement Architecture (4-Layer Protection)

| Layer | File Path | Current State | Required Fix |
|---|---|---|---|
| **1. API Route (PATCH)** | `src/app/api/sales/[id]/route.ts` | Uses `requireAuth()` only | Replace with `await requirePermission(PERMISSIONS.SALES_VOID)` or verify admin/manager role; return `403 Forbidden` for cashiers. |
| **2. API Route (DELETE)** | `src/app/api/sales/[id]/route.ts` | Method missing | Add `DELETE` method protected by `requirePermission(PERMISSIONS.SALES_VOID)`. Delegates to `cancelSale(params.id, reason, user)`. |
| **3. API Route (Cancel)** | `src/app/api/sales/[id]/cancel/route.ts` | Uses `requirePermission(PERMISSIONS.SALES_VOID)` | Retain protection; ensure robust error mapping. |
| **4. Server Action** | `src/app/(dashboard)/sales/[id]/sale-actions.ts` | Checks `!session?.user` | Add explicit check: `session.user.permissions?.includes(PERMISSIONS.SALES_VOID) \|\| session.user.roles?.some(r => ['admin', 'owner', 'manager'].includes(r.toLowerCase()))`. |
| **5. Core Service** | `src/lib/sales/sales-service.ts` (`editSale`) | Allows `PERMISSIONS.SALES_CREATE` | Remove `PERMISSIONS.SALES_CREATE`. Allow only `PERMISSIONS.SALES_VOID` or admin/owner/manager roles. |
| **6. Core Service** | `src/lib/sales/sales-service.ts` (`cancelSale`) | Requires `sales:void` only | Support admin/owner/manager role bypass in case permissions array is missing the explicit string. |
| **7. Dashboard UI** | `src/app/(dashboard)/sales/[id]/page.tsx` | `canEditSale = (canCreate \|\| canCancel \|\| isAdminOrManager)` | Fix to `canEditSale = (canCancel \|\| isAdminOrManager) && sale.status === 'COMPLETED'`. |
| **8. Bill Dialog UI** | `src/components/sales/sale-bill-detail-dialog.tsx` | Cancel button shown; Edit button missing | Condition Cancel and Edit buttons on `(canCancel \|\| isAdminOrManager)`. |

---

### 4.2 Admin Bill Cancellation / Soft Deletion Specification (`cancelSale`)

```typescript
export async function cancelSale(saleId: string, reason: string, actor: SaleActor): Promise<void> {
  const permissions = actor.permissions ?? []
  const roles = (actor as { roles?: string[] }).roles ?? []
  const isAuthorized =
    permissions.includes(PERMISSIONS.SALES_VOID) ||
    roles.some((r) => ['admin', 'owner', 'manager', 'super_admin'].includes(r.toLowerCase()))

  if (!isAuthorized) {
    throw new Error('Forbidden: requires permission sales:void or Admin role to cancel sales')
  }

  await runWithRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.findUnique({
          where: { id: saleId },
          include: {
            items: {
              include: {
                itemBatches: { include: { batch: true } },
              },
            },
            customer: true,
          },
        })
        if (!sale) throw new Error('Not Found: sale')
        if (sale.status === 'CANCELLED') throw new Error('Sale is already cancelled')

        await assertBranchAccess(actor, sale.branchId)

        // 1. Soft Delete: Update Sale Status and Record Justification
        await tx.sale.update({
          where: { id: saleId },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledReason: reason,
          },
        })

        // 2. Revert Inventory and Batch Stock (accounting for any partial returns)
        for (const item of sale.items) {
          const alreadyReturned = item.returnedQuantity || 0
          const netRestoreQty = Math.max(0, item.quantity - alreadyReturned)
          if (netRestoreQty <= 0) continue

          // Restore product-branch aggregate inventory
          const inv = await tx.inventory.findUnique({
            where: { productId_branchId: { productId: item.productId, branchId: sale.branchId } },
          })
          if (inv) {
            await tx.inventory.update({
              where: { id: inv.id },
              data: {
                totalQuantity: { increment: netRestoreQty },
                availableQuantity: { increment: netRestoreQty },
              },
            })

            // Record audit movement
            await tx.inventoryMovement.create({
              data: {
                inventoryId: inv.id,
                type: 'RETURN_IN',
                quantity: netRestoreQty,
                quantityBefore: inv.availableQuantity,
                quantityAfter: inv.availableQuantity + netRestoreQty,
                referenceType: 'SALE',
                referenceId: sale.id,
                notes: `Sale cancelled: ${sale.invoiceNumber} (${reason})`,
                createdById: actor.id,
              },
            })
          }

          // Restore batch sold quantities and reactivate EXHAUSTED batches
          let remainingToRestore = netRestoreQty
          for (const ib of item.itemBatches) {
            if (remainingToRestore <= 0) break
            const batchRestore = Math.min(ib.quantity, remainingToRestore)
            remainingToRestore -= batchRestore

            const batch = await tx.batch.findUnique({ where: { id: ib.batchId } })
            if (batch) {
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
            }
          }
        }

        // 3. Revert Customer Ledger & Outstanding Balance if Credit Sale
        const balanceDueNum = Number(sale.balanceDue)
        if (sale.customerId && balanceDueNum > 0 && tx.customer && tx.customerLedger) {
          const customer = await tx.customer.findUnique({ where: { id: sale.customerId } })
          if (customer) {
            const newBal = customer.outstandingBalance.sub(new Prisma.Decimal(balanceDueNum))
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

        // 4. Clean up / Reverse GST & Doctor Commission records
        if (tx.gstTransaction?.deleteMany) {
          await tx.gstTransaction.deleteMany({
            where: { referenceType: 'SALE', referenceId: sale.id },
          })
        }
        if (tx.doctorCommission?.deleteMany) {
          await tx.doctorCommission.deleteMany({
            where: { saleId: sale.id },
          })
        }

        // 5. Mandatory Audit Log Entry
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'SALE_CANCEL',
            entity: 'Sale',
            entityId: sale.id,
            oldData: {
              status: sale.status,
              totalAmount: Number(sale.totalAmount),
              items: sale.items.map((i) => ({
                id: i.id,
                productId: i.productId,
                productName: i.productName,
                quantity: i.quantity,
                returnedQuantity: i.returnedQuantity,
              })),
            },
            newData: {
              status: 'CANCELLED',
              cancelledReason: reason,
              cancelledAt: new Date().toISOString(),
            },
            metadata: {
              invoiceNumber: sale.invoiceNumber,
              totalAmount: Number(sale.totalAmount),
              cancelledBy: actor.id,
              reason,
            },
          },
        })
      },
      { isolationLevel: 'Serializable', maxWait: 5000, timeout: 15000 }
    )
  )
}
```

---

### 4.3 Admin Bill Modification Specification (`editSale`)

1. **Permission Hardening**:
   ```typescript
   const canEdit =
     permissions.includes(PERMISSIONS.SALES_VOID) ||
     roles.some((r) => ['admin', 'owner', 'manager', 'super_admin'].includes(r.toLowerCase()))

   if (!canEdit) {
     throw new Error('Forbidden: requires permission sales:void or Admin role to edit sales')
   }
   ```
2. **Audit Log Enrichment**:
   In `editSale`, add `oldData` and `newData` snapshots to `tx.auditLog.create`:
   ```typescript
   await tx.auditLog.create({
     data: {
       userId: actor.id,
       action: 'SALE_UPDATE',
       entity: 'Sale',
       entityId: sale.id,
       oldData: {
         totalAmount: Number(sale.totalAmount),
         subtotal: Number(sale.subtotal),
         items: sale.items.map((i) => ({
           id: i.id,
           productId: i.productId,
           quantity: i.quantity,
           totalAmount: Number(i.totalAmount),
         })),
       },
       newData: {
         totalAmount: newTotals.totalAmount,
         subtotal: newTotals.subtotal,
         items: remainingItems.map((i) => ({
           id: i.id,
           productId: i.productId,
           quantity: i.quantity,
           totalAmount: Number(i.totalAmount),
         })),
         reason,
       },
       metadata: {
         invoiceNumber: sale.invoiceNumber,
         oldTotal: Number(sale.totalAmount),
         newTotal: newTotals.totalAmount,
         reason,
       },
     },
   })
   ```

---

## 5. Verification Method

### 5.1 Automated Unit Tests (`src/lib/sales/sales-service.test.ts`)
Run command:
```bash
npx jest src/lib/sales/sales-service.test.ts
```

New automated test cases to add:
1. **`editSale RBAC`**:
   - Asserts that an actor with `permissions: ['sales:create']` (Cashier role) receives:
     `Forbidden: requires permission sales:void or Admin role to edit sales`.
   - Asserts that an actor with `roles: ['owner']` or `permissions: ['sales:void']` successfully executes `editSale`.
2. **`cancelSale RBAC`**:
   - Asserts that an actor with `permissions: ['sales:create']` receives:
     `Forbidden: requires permission sales:void or Admin role to cancel sales`.
   - Asserts that an actor with `roles: ['owner']` or `permissions: ['sales:void']` successfully executes `cancelSale`.
3. **`cancelSale Inventory Reversal & Batch Reactivation`**:
   - Asserts `tx.inventory.update` increments `availableQuantity` and `totalQuantity`.
   - Asserts `tx.batch.update` decrements `soldQuantity` and flips `status: 'ACTIVE'` when batch was `'EXHAUSTED'`.
   - Asserts `tx.batchStatusLog.create` is invoked.
4. **`cancelSale Partial Return Handling`**:
   - When `item.quantity = 10` and `item.returnedQuantity = 2`, asserts only `8` units are restored to inventory and batch.
5. **`cancelSale AuditLog Recording`**:
   - Asserts `tx.auditLog.create` is called with `action: 'SALE_CANCEL'`, `entity: 'Sale'`, `oldData`, `newData`, and `metadata`.

### 5.2 API Route Integration Tests
Run command:
```bash
npx jest src/app/api/sales
```
- Test `PATCH /api/sales/:id` returns `403 Forbidden` when called with cashier session.
- Test `DELETE /api/sales/:id` returns `403 Forbidden` when called with cashier session.
- Test `DELETE /api/sales/:id` returns `200 OK` and cancels sale when called with admin session.
