# Dispatch for Worker M4: Admin Bill Modification, Deletion, Inventory Reversal & RBAC Lockdown

## Mission
Implement Milestone 4 (M4) per `PROJECT.md` to satisfy Requirement R4:
1. Core Sales Service Hardening (`src/lib/sales/sales-service.ts`):
   - `editSale`:
     - Remove `PERMISSIONS.SALES_CREATE` from authorization check. Require `PERMISSIONS.SALES_VOID` or Admin/Owner/Manager role (`['admin', 'owner', 'manager', 'super_admin']`).
     - Adjust inventory diffs (restoring stock when item quantity decreases, deducting stock when increasing).
     - Enrich `tx.auditLog.create` with `action: 'SALE_UPDATE'`, capturing `oldData` snapshot, `newData` snapshot, reason, and metadata.
   - `cancelSale`:
     - Enforce authorization: require `PERMISSIONS.SALES_VOID` or Admin/Owner/Manager role.
     - Soft deletion: update `sale.status = 'CANCELLED'`, set `cancelledAt = new Date()`, set `cancelledReason = reason`.
     - Revert aggregate `Inventory`: increment `totalQuantity` and `availableQuantity` by net quantity `Math.max(0, item.quantity - (item.returnedQuantity || 0))` (protects against phantom stock on partial returns).
     - Record `InventoryMovement` with `type: 'RETURN_IN'`, `referenceType: 'SALE'`.
     - Revert `Batch.soldQuantity` by net quantity. If batch was `'EXHAUSTED'` and `soldQuantity < quantity`, reactivate batch to `'ACTIVE'` and create `BatchStatusLog` entry.
     - Revert customer credit ledger and outstanding balance if credit sale with `balanceDue > 0`.
     - Delete or reverse linked `GstTransaction` and `DoctorCommission` records.
     - Record mandatory `tx.auditLog.create` with `action: 'SALE_CANCEL'`, capturing `oldData`, `newData`, `metadata` (invoiceNumber, totalAmount, reason, cancelledBy).
2. API Routes Hardening:
   - `src/app/api/sales/[id]/route.ts`:
     - Protect `PATCH` route with `requirePermission(PERMISSIONS.SALES_VOID)` or admin role verification. Block cashiers/non-admin users with `403 Forbidden`.
     - Implement `DELETE` route protected by `requirePermission(PERMISSIONS.SALES_VOID)` or admin role verification. Parses optional `{ reason }` from query/body, calls `cancelSale`, and returns `{ success: true, message: 'Sale cancelled and inventory restored' }`.
   - `src/app/api/sales/[id]/cancel/route.ts`:
     - Ensure proper RBAC and error handling.
3. Server Actions & UI Lockdown:
   - `src/app/(dashboard)/sales/[id]/sale-actions.ts`: Check admin/manager or `sales:void` permission in `editSaleAction` and `cancelSaleAction`.
   - `src/app/(dashboard)/sales/[id]/page.tsx`: Condition `canEditSale` and `canCancelSale` on `(canCancel || isAdminOrManager) && sale.status === 'COMPLETED'`. Hide/disable edit and cancel buttons for cashiers.
   - `src/components/sales/sale-bill-detail-dialog.tsx`: Condition Edit and Cancel buttons on `(canCancel || isAdminOrManager)`.
4. Automated Unit & Route Tests:
   - `src/lib/sales/__tests__/sales-admin-ops.test.ts`:
     - Test that cashiers with `sales:create` get 403 / Forbidden on `editSale` and `cancelSale`.
     - Test that Admin / `sales:void` successfully edits bill, adjusts inventory, and records `AuditLog` (`SALE_UPDATE`).
     - Test that Admin / `sales:void` cancels bill, restores inventory, reactivates `EXHAUSTED` batches, logs `BatchStatusLog`, and records `AuditLog` (`SALE_CANCEL`).
     - Test partial return handling (does not over-restore returned quantity).
   - `src/app/api/sales/[id]/__tests__/sales-rbac-routes.test.ts`:
     - Test `PATCH /api/sales/:id` returns 403 Forbidden for cashiers.
     - Test `DELETE /api/sales/:id` returns 403 Forbidden for cashiers.
     - Test `DELETE /api/sales/:id` returns 200 OK for admins.
   Run tests using Jest and ensure all pass cleanly.

## Exclusive Write Ownership
You own the following files exclusively:
- `src/lib/sales/sales-service.ts`
- `src/lib/sales/__tests__/sales-admin-ops.test.ts`
- `src/app/api/sales/[id]/route.ts`
- `src/app/api/sales/[id]/cancel/route.ts`
- `src/app/api/sales/[id]/__tests__/sales-rbac-routes.test.ts`
- `src/app/(dashboard)/sales/[id]/sale-actions.ts`
- `src/app/(dashboard)/sales/[id]/page.tsx`
- `src/components/sales/sale-bill-detail-dialog.tsx`
Do NOT modify files outside the sales and billing admin subsystem.

## Context & Input Files
- Read `c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md`
- Read `c:\metapharsic-pharmacy-complete\PROJECT.md`
- Read `c:\metapharsic-pharmacy-complete\.agents\teamwork\survey_explorer_3\handoff.md`

## MANDATORY INTEGRITY WARNING
> DO NOT CHEAT. All implementations must be genuine. DO NOT
> hardcode test results, create dummy/facade implementations, or
> circumvent the intended task. A teamwork_auditor will independently
> verify your work. Integrity violations WILL be detected and your
> work WILL be rejected.

## Deliverables & Handoff
Write your completion report to `c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_worker_m4_admin\handoff.md` following the standard handoff protocol with exact test execution commands and results.
When finished, notify the orchestrator via send_message.

## 2026-11-02T14:17:25Z
You are Worker M4 (teamwork_worker).
Your working directory is: c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_worker_m4_admin\
Your dispatch instructions are at: c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_worker_m4_admin\DISPATCH.md
MANDATORY: Read the full user request at: c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.
Read PROJECT.md at: c:\metapharsic-pharmacy-complete\PROJECT.md
Read Explorer 3's survey at: c:\metapharsic-pharmacy-complete\.agents\teamwork\survey_explorer_3\handoff.md
