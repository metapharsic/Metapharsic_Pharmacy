# Dispatch for Forensic Auditor: Integrity Verification & Anti-Cheating Forensics

## Mission
Perform comprehensive forensic integrity audit across all modified and newly created files for the Pharmacy Production Enhancements (Milestones M1–M5).
Verify strictly that NO CHEATING, fake implementations, hardcoded outputs, mock short-circuits, or facade logic exist.

## Forensic Checks to Perform
1. Static Analysis & Deception Scan:
   - Grep across all source files in `src/` for hardcoded test outputs, conditional test skips, dummy responses, fake success flags, or bypass logic.
   - Verify that `excel-export-service.ts` genuinely calls SheetJS `XLSX.write` to generate binary workbooks from dynamic database data.
   - Verify that `invoice-pdf-generator.ts` genuinely calls `jsPDF` and `jspdf-autotable` to construct binary PDF documents.
   - Verify that `sales-service.ts` genuinely performs Prisma transactions (`tx.sale.update`, `tx.inventory.update`, `tx.batch.update`, `tx.auditLog.create`).
2. XML/CSV Elimination Audit:
   - Inspect all dispensary reporting views and endpoints. Verify that NO reports are generated or exported in XML format, and all reporting downloads produce Excel (.xlsx) files.
3. RBAC Lockdown Audit:
   - Verify that `editSale` and `cancelSale` genuinely verify `sales:void` or Admin roles, and that cashiers are strictly blocked from editing or cancelling finalized bills across API routes (`PATCH`, `DELETE`, `POST /cancel`), server actions, and UI components.
4. Inventory Reversal Audit:
   - Verify that `cancelSale` accounts for `item.returnedQuantity` to prevent phantom stock inflation.
   - Verify that `EXHAUSTED` batches are genuinely reactivated to `ACTIVE` and recorded in `BatchStatusLog`.
   - Verify that `AuditLog` is created on bill cancellation.
5. Provide your binary audit verdict (`CLEAN` or `INTEGRITY VIOLATION`) with detailed evidence in:
   `c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_auditor_1\handoff.md`.

## Context Files
- `c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\metapharsic-pharmacy-complete\PROJECT.md`
- `c:\metapharsic-pharmacy-complete\TEST_READY.md`


## 2026-11-02T15:06:00Z
You are Forensic Auditor (teamwork_auditor).
Your working directory is: c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_auditor_1\
Your dispatch instructions are at: c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_auditor_1\DISPATCH.md
MANDATORY: Read the full user request at: c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.
Read PROJECT.md at: c:\metapharsic-pharmacy-complete\PROJECT.md
Read TEST_READY.md at: c:\metapharsic-pharmacy-complete\TEST_READY.md

Your task:
Perform forensic integrity verification across all modified and newly created files in this repository.
Inspect:
1. Static analysis: Scan for mock short-circuits, hardcoded test strings, fake returns, facade implementations, or circumvented logic.
2. Genuine implementation verification: Confirm that SheetJS XLSX.write actually generates binary workbooks, jsPDF actually renders PDF documents, Prisma transactional updates actually modify Inventory and Batch models, and RBAC checks actually inspect session permissions/roles.
3. XML elimination: Confirm that NO XML reports exist in reporting routes or downloads.
4. RBAC lockdown: Confirm cashiers are genuinely blocked from modifying or deleting finalized bills.
5. Provide your binary audit verdict (CLEAN or INTEGRITY VIOLATION) with full evidence in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_auditor_1\handoff.md
When finished, notify the orchestrator via send_message.
