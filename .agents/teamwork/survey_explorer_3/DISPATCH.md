# Dispatch for Survey Explorer 3: Admin Bill Modification, Deletion & Inventory Reversal

## Mission
Investigate the sales and billing backend, database schema, and admin management logic. Specifically investigate how bills (Sales) are stored, how inventory/batches are decremented during sales, how cancellation or modification of bills should be implemented (soft deletion / cancellation status, adjusting/reverting inventory stock quantities, recording audit logs), and how role-based permissions (Admin vs Cashier/Non-admin) are enforced.

## Input Files to Read
- `c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md` (Read the full request, especially the latest follow-up)
- `prisma/schema.prisma`
- Existing sales/billing APIs and services (`src/app/api/sales/...`, `src/lib/billing/...`, `src/lib/services/...`, `src/lib/permissions/...` or `src/lib/auth/...`)
- Audit log mechanism in the codebase (`AuditLog` model or audit service)

## Expected Deliverables
Write your comprehensive survey findings to `c:\metapharsic-pharmacy-complete\.agents\teamwork\survey_explorer_3\handoff.md`.
Include:
1. Prisma schema analysis: `Sale`, `SaleItem`, `Inventory`, `Batch`, `AuditLog`, `User`, `Role`, `Permission`.
2. How sales creation currently modifies stock (does it update `Batch.quantity`, `Inventory.stock`, create `StockMovement` records?).
3. Current bill edit/delete capabilities (is there an existing endpoint or is it missing/read-only?).
4. Detailed design for Admin Bill Modification: updating items, recalculating totals/taxes, adjusting inventory diffs (restoring old stock, deducting new stock), and writing audit logs.
5. Detailed design for Admin Bill Deletion/Cancellation: soft deletion flag/status (`CANCELLED` / `isDeleted`), full inventory reversal (returning batch and inventory stock), stock movement logs, and audit trail.
6. Role-based access control: verifying that only Admin users can modify or delete bills, while cashiers/non-admin users are strictly blocked.
7. Exact file paths, API contracts, interfaces, and automated test strategies.


## 2026-11-02T13:57:28Z
You are Survey Explorer 3 (teamwork_explorer).
Your working directory is: c:\metapharsic-pharmacy-complete\.agents\teamwork\survey_explorer_3\
Your dispatch instructions are at: c:\metapharsic-pharmacy-complete\.agents\teamwork\survey_explorer_3\DISPATCH.md
MANDATORY: Read the full user request at: c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.

Your task:
Investigate the sales and billing backend, database schema, and admin management logic.
Specifically investigate how bills (Sales) are stored, how inventory/batches are decremented during sales, how cancellation or modification of bills should be implemented (soft deletion / cancellation status, adjusting/reverting inventory stock quantities, recording audit logs), and how role-based permissions (Admin vs Cashier/Non-admin) are enforced.
Write your detailed findings and architectural recommendations to:
c:\metapharsic-pharmacy-complete\.agents\teamwork\survey_explorer_3\handoff.md
Follow the standard handoff protocol (Observation, Logic Chain, Caveats, Conclusion).
When finished, notify the orchestrator via send_message.


## 2026-11-02T14:10:06Z
**Context**: Billing Admin, inventory reversal and RBAC survey
**Content**: Checking in on survey progress. Please provide an update on your findings or complete your handoff.md if ready.
**Action**: Update progress.md with your latest findings and send your handoff report when finished.
