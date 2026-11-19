# Dispatch for Reviewer 2: WhatsApp Sharing & Admin Bill Management / Reversal

## Mission
Review Milestone 3 (WhatsApp Sharing) and Milestone 4 (Admin Bill Modification, Deletion, Inventory Reversal & RBAC) against Requirements R3 and R4 in `ORIGINAL_REQUEST.md`.
Verify:
1. WhatsApp Sharing:
   - `src/components/sales/whatsapp-invoice-dialog.tsx`: Pre-fills phone, generates formatted Markdown summary with direct PDF link, launches 1-click `wa.me` chat and API dispatch.
   - `src/lib/reports/executive-digest-service.ts`: Formats Daily, Weekly, and Monthly digests with financial metrics and top medicines.
   - UI triggers in `reports-hub-client.tsx`, `sale-invoice-dialog.tsx`, and `sale-action-buttons.tsx`.
2. Admin Bill Operations & Inventory Reversal:
   - `src/lib/sales/sales-service.ts`: `editSale` and `cancelSale` strictly require `sales:void` or Admin/Owner/Manager role. Non-admins/cashiers receive 403 Forbidden.
   - Soft deletion: `cancelSale` sets `status = 'CANCELLED'`, `cancelledAt`, and `cancelledReason`.
   - Inventory restoration: Net unreturned quantity `Math.max(0, quantity - returnedQuantity)` is restored to `Inventory` and `Batch`.
   - Batch reactivation: When `soldQuantity < quantity` on an `EXHAUSTED` batch, flips status to `ACTIVE` and records `BatchStatusLog`.
   - Customer credit reversal: Decrements outstanding balance and logs `CustomerLedger` reversal.
   - Audit logs: Mandatory `AuditLog` recorded with `SALE_CANCEL` and `SALE_UPDATE` capturing oldData and newData snapshots.
   - API routes: `PATCH /api/sales/:id` and `DELETE /api/sales/:id` return 403 Forbidden for cashiers and 200 OK for admins.
3. Run the unit and E2E test suites:
   `npx jest src/lib/reports/__tests__/executive-digest-service.test.ts src/lib/sales/__tests__/sales-admin-ops.test.ts src/app/api/sales/[id]/__tests__/sales-rbac-routes.test.ts`
   `npx jest src/__tests__/e2e/production-enhancements-e2e.test.ts`
4. Write your structured verdict (`APPROVE` or `REQUEST_CHANGES`) in `c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_reviewer_2\handoff.md`.

## Context Files
- `c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\metapharsic-pharmacy-complete\PROJECT.md`
- `c:\metapharsic-pharmacy-complete\TEST_READY.md`


## 2026-11-02T15:05:40Z
[Message] timestamp=2026-11-02T15:05:40Z sender=187f8d67-d727-46bd-b8d9-ecaeff8b88d3 priority=MESSAGE_PRIORITY_HIGH content=You are Reviewer 2 (teamwork_reviewer).
Your working directory is: c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_reviewer_2\
Your dispatch instructions are at: c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_reviewer_2\DISPATCH.md
MANDATORY: Read the full user request at: c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.
Read PROJECT.md at: c:\metapharsic-pharmacy-complete\PROJECT.md
Read TEST_READY.md at: c:\metapharsic-pharmacy-complete\TEST_READY.md

Your task:
Review Milestone 3 (WhatsApp Sharing for Reports & Invoices) and Milestone 4 (Admin Bill Modification, Deletion, Inventory Reversal & RBAC Lockdown).
Verify that WhatsApp invoice and executive report digests work cleanly with wa.me deep links and API dispatch.
Verify that cashiers are strictly blocked from editing or cancelling finalized bills (403 Forbidden).
Verify that admin bill cancellation uses soft deletion, restores stock with partial return protection, reactivates EXHAUSTED batches to ACTIVE with BatchStatusLog, reverses customer credit balances, and logs mandatory AuditLog entries.
Run builds and unit/E2E tests using Jest.
Write your structured review verdict (APPROVE or REQUEST_CHANGES) with evidence in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_reviewer_2\handoff.md
When finished, notify the orchestrator via send_message.
