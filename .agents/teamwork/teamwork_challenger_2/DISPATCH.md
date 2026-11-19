# Dispatch for Challenger 2: Adversarial Verification of Admin Bill Ops & RBAC Security

## Mission
Perform empirical adversarial stress testing of Admin Bill Modification, Cancellation, Inventory Reversal, and RBAC Security boundaries.
Empirically test:
1. Security & RBAC Penetration Testing:
   - Attempt bill modification (`PATCH /api/sales/:id` and `editSale`) using Cashier session (`permissions: ['sales:create', 'sales:read']`) and Pharmacist session. Assert HTTP 403 Forbidden / error thrown.
   - Attempt bill deletion (`DELETE /api/sales/:id`, `POST /api/sales/:id/cancel`, `cancelSale`) using Cashier session. Assert HTTP 403 Forbidden / error thrown.
   - Verify that only Admin, Owner, Manager, or holders of `sales:void` succeed.
2. Inventory Reversal Stress Testing:
   - Partial return interaction: Invoice with 10 units, 2 units returned prior via `createSaleReturn`. Cancel the bill. Assert that only 8 units are restored to inventory and batch, not 10.
   - Exhausted batch reactivation: Batch has quantity 20, soldQuantity 20, status `EXHAUSTED`. Bill is cancelled. Assert soldQuantity becomes 0, status becomes `ACTIVE`, and `BatchStatusLog` is recorded.
   - Credit sale cancellation: Bill with `balanceDue = 500`. Assert `Customer.outstandingBalance` is reduced by 500 and `CustomerLedger` contains a `CREDIT` reversal entry.
   - Idempotency: Attempt re-cancellation of already cancelled bill. Assert rejected with error.
3. Audit Log Validation:
   - Verify `AuditLog` records for `SALE_UPDATE` and `SALE_CANCEL` contain `oldData` snapshot, `newData` snapshot, and actor ID.
4. Execute empirical tests and record your verdict (`APPROVE` or `REQUEST_CHANGES`) in `c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_challenger_2\handoff.md`.

## Context Files
- `c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\metapharsic-pharmacy-complete\PROJECT.md`
- `c:\metapharsic-pharmacy-complete\TEST_READY.md`


## 2026-11-02T15:05:53Z
You are Challenger 2 (teamwork_challenger).
Your working directory is: c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_challenger_2\
Your dispatch instructions are at: c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_challenger_2\DISPATCH.md
MANDATORY: Read the full user request at: c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.
Read PROJECT.md at: c:\metapharsic-pharmacy-complete\PROJECT.md
Read TEST_READY.md at: c:\metapharsic-pharmacy-complete\TEST_READY.md

Your task:
Adversarially challenge and stress-test Admin Bill Operations, Inventory Reversals, and RBAC Security.
Penetration test: verify that cashiers and pharmacists without sales:void are rejected with 403 Forbidden on PATCH /api/sales/:id, DELETE /api/sales/:id, POST /api/sales/:id/cancel, editSale, and cancelSale.
Stress test inventory reversal: test net stock restoration on partially returned bills, batch reactivation from EXHAUSTED to ACTIVE, BatchStatusLog creation, customer credit ledger reversals, and idempotent re-cancellation rejection.
Verify that AuditLog records are written for SALE_UPDATE and SALE_CANCEL with oldData and newData snapshots.
Write your structured adversarial verdict (APPROVE or REQUEST_CHANGES) with empirical evidence in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_challenger_2\handoff.md
When finished, notify the orchestrator via send_message.
