# BRIEFING — 2026-11-02T14:35:00Z

## Mission
Implement Milestone 4: Admin Bill Modification, Deletion, Inventory Reversal & RBAC Lockdown (Requirement R4).

## 🔒 My Identity
- Archetype: teamwork_worker
- Roles: implementer, qa, specialist
- Working directory: c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_worker_m4_admin
- Original parent: 187f8d67-d727-46bd-b8d9-ecaeff8b88d3
- Milestone: Milestone 4 (Admin Bill Modification, Deletion, Inventory Reversal & RBAC Lockdown)

## 🔒 Key Constraints
- Exclusive write ownership:
  - `src/lib/sales/sales-service.ts`
  - `src/lib/sales/__tests__/sales-admin-ops.test.ts`
  - `src/app/api/sales/[id]/route.ts`
  - `src/app/api/sales/[id]/cancel/route.ts`
  - `src/app/api/sales/[id]/__tests__/sales-rbac-routes.test.ts`
  - `src/app/(dashboard)/sales/[id]/sale-actions.ts`
  - `src/app/(dashboard)/sales/[id]/page.tsx`
  - `src/components/sales/sale-bill-detail-dialog.tsx`
- Do NOT cheat or fabricate test results. Genuine implementation required.
- Do NOT place source code, tests, or data files in .agents/teamwork/.
- Run Jest tests and ensure all pass.

## Current Parent
- Conversation ID: 187f8d67-d727-46bd-b8d9-ecaeff8b88d3
- Updated: not yet

## Task Summary
- **What to build**: Harden `editSale` and `cancelSale` in `sales-service.ts` with RBAC (`sales:void` or Admin/Owner/Manager), inventory diff adjustments, soft delete, batch reactivation with `BatchStatusLog`, customer ledger reversal, audit logging (`SALE_UPDATE`, `SALE_CANCEL`). Protect API routes (`PATCH`, `DELETE` in `/api/sales/[id]`, `/api/sales/[id]/cancel`), lock down server actions & UI dialogs against cashier access, write comprehensive tests.
- **Success criteria**: All RBAC checks pass/fail as expected, inventory is correctly adjusted/restored, partial returns are protected, batch reactivation works, audit logs are written, Jest unit and route tests pass 100%.
- **Interface contracts**: PROJECT.md, prisma/schema.prisma
- **Code layout**: src/lib/sales/, src/app/api/sales/, src/app/(dashboard)/sales/, src/components/sales/

## Key Decisions Made
- Removed `sales:create` check from `editSale` and required `sales:void` or Admin/Owner/Manager/Super Admin.
- Enforced soft deletion in `cancelSale` with `status = 'CANCELLED'`, `cancelledAt`, and `cancelledReason`.
- In `cancelSale`, protected against phantom stock by calculating net quantity `Math.max(0, item.quantity - (item.returnedQuantity || 0))`.
- Replaced hard status reset with reactivation of `EXHAUSTED` batches to `ACTIVE` plus logging to `BatchStatusLog`.
- Reverted customer credit balance and created reversal credit ledger entry for cancelled credit bills.
- Protected `PATCH` and created `DELETE` in `/api/sales/[id]/route.ts` returning 403 Forbidden to cashiers and 200 OK to admins.
- Protected `cancelSaleAction` and `editSaleAction` server actions against cashier access.
- Conditioned UI edit and cancel buttons in `sales/[id]/page.tsx` and `sale-bill-detail-dialog.tsx` on `canCancel || isAdminOrManager`.

## Artifact Index
- DISPATCH.md — Task assignment and constraints
- BRIEFING.md — Working memory and status
- progress.md — Liveness heartbeat
- handoff.md — Standard completion handoff report

## Change Tracker
- **Files modified**:
  - `src/lib/sales/sales-service.ts`: Hardened editSale & cancelSale RBAC, stock reversal, batch reactivation, credit reversal, enriched audit logs
  - `src/app/api/sales/[id]/route.ts`: Protected PATCH and implemented DELETE route with 403 for cashiers, 200 for admins
  - `src/app/api/sales/[id]/cancel/route.ts`: Aligned RBAC check for sales:void / admin roles
  - `src/app/(dashboard)/sales/[id]/sale-actions.ts`: Enforced RBAC on cancelSaleAction & editSaleAction
  - `src/app/(dashboard)/sales/[id]/page.tsx`: Conditioned canEditSale and canCancel on (canCancel || isAdminOrManager)
  - `src/components/sales/sale-bill-detail-dialog.tsx`: Gated Edit and Cancel buttons behind canCancel || isAdminOrManager
  - `src/lib/sales/sales-service.test.ts`: Updated permission error assertion to match hardened RBAC
  - `src/lib/sales/__tests__/sales-admin-ops.test.ts`: New unit tests for admin bill edit, cancellation, inventory reversal, partial returns, and RBAC
  - `src/app/api/sales/[id]/__tests__/sales-rbac-routes.test.ts`: New route tests for PATCH, DELETE, and POST cancel endpoints
- **Build status**: 44/44 unit and route tests passing cleanly (100% pass)
- **Pending issues**: None

## Quality Status
- **Build/test result**: All 44 sales admin and route tests PASS
- **Lint status**: Clean (no errors in modified files)
- **Tests added/modified**: 16 new automated test cases across 2 new test files + updated existing suite

## Loaded Skills
- None
