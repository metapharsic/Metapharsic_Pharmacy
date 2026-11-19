# Progress Tracking - Milestone 4

Last visited: 2026-11-02T14:36:00Z

## Status
Completed implementation, testing, and hardening of Milestone 4: Admin Bill Modification, Deletion, Inventory Reversal & RBAC Lockdown.

## Summary of Accomplishments
1. Hardened `editSale` in `src/lib/sales/sales-service.ts`:
   - Removed `sales:create` check. Required `sales:void` or Admin/Owner/Manager/Super Admin.
   - Enriched `AuditLog` (`action: 'SALE_UPDATE'`) with full `oldData` and `newData` snapshots.
2. Hardened `cancelSale` in `src/lib/sales/sales-service.ts`:
   - Enforced RBAC (`sales:void` or Admin/Owner/Manager/Super Admin).
   - Soft deletion with `status = 'CANCELLED'`, `cancelledAt`, and `cancelledReason`.
   - Inventory restoration with partial return protection (`netRestoreQty = Math.max(0, item.quantity - (item.returnedQuantity || 0))`).
   - Batch sold quantity decrement and reactivation of `EXHAUSTED` batches to `ACTIVE` with `BatchStatusLog`.
   - Customer credit ledger and outstanding balance reversal for unpaid/credit bills.
   - GST transaction and doctor commission cleanup.
   - Mandatory `AuditLog` (`action: 'SALE_CANCEL'`) with `oldData`, `newData`, and metadata.
3. Protected `PATCH` and created `DELETE` route in `src/app/api/sales/[id]/route.ts`:
   - Both return 403 Forbidden to cashiers/pharmacists without `sales:void`.
   - `DELETE` returns 200 OK `{ success: true, message: 'Sale cancelled and inventory restored' }` for admins.
4. Protected `POST /api/sales/[id]/cancel`:
   - Aligned RBAC check returning 403 Forbidden to non-admin/cashiers.
5. Server actions and UI lockdown:
   - Protected `editSaleAction` and `cancelSaleAction` in `sale-actions.ts`.
   - Gated `canEditSale` and `canCancel` in `sales/[id]/page.tsx` on `(canCancel || isAdminOrManager) && sale.status === 'COMPLETED'`.
   - Gated `EditSaleDialog` and `Cancel Sale` buttons in `sale-bill-detail-dialog.tsx` on `canCancel || isAdminOrManager`.
6. Testing:
   - Added `src/lib/sales/__tests__/sales-admin-ops.test.ts` (8/8 tests pass).
   - Added `src/app/api/sales/[id]/__tests__/sales-rbac-routes.test.ts` (8/8 tests pass).
   - Verified `src/lib/sales/sales-service.test.ts` (28/28 tests pass).
   - Total 44/44 tests pass.
