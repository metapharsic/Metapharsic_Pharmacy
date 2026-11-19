# Dispatch for Worker M2: Invoicing Layout Alignment & PDF Generation

## Mission
Implement Milestone 2 (M2) per `PROJECT.md` to satisfy Requirement R2:
1. Fix invoice layout and column alignment in `src/components/pos/receipt-invoice.tsx`:
   - 80mm Thermal Slip (`variant="slip"`): Convert from the squished 8-column layout to a clean 2-tier stacked card layout (Line 1: S.No + Product Name + HSN code; Line 2: Batch, Expiry, Qty @ Rate, Discount, Amount). Eliminates clipping, text wrapping, and overflow.
   - A4 / A5 Full Tax Invoice (`variant="full"`): Ensure clean grid alignment with explicit proportional column widths, right-aligned `tabular-nums font-mono` for all numeric amounts.
   - Statutory Compliance: Add HSN code per line item (defaulting to product HSN or `3004`).
   - Dynamic GST Slab Matrix: Replace hardcoded `(CGST 6% + SGST 6%)` with dynamic multi-slab aggregation (0%, 5%, 12%, 18%) calculating taxable value, CGST, SGST, IGST, and total GST per slab.
2. Create universal PDF generator `src/lib/pdf/invoice-pdf-generator.ts` using `jspdf` and `jspdf-autotable`:
   - Generates valid binary PDF documents for both A4 (`format: 'a4'`) and 80mm continuous thermal slip (`format: 'thermal80'`).
   - Formats pharmacy branding, DL numbers, GSTIN, invoice metadata, customer/doctor info, itemized table, dynamic GST matrix, amount in words (INR), and pharmacist signature block.
   - Supports both Node.js (returns `Buffer`) and browser (returns `Blob` or triggers instant download).
3. Create server-side API route `src/app/api/sales/[id]/pdf/route.ts`:
   - Handles `GET /api/sales/[id]/pdf?format=a4|thermal80&download=true|false`.
   - Validates session, loads sale details via `getSaleById` or Prisma, generates PDF buffer, and returns `NextResponse` with `Content-Type: application/pdf` and `Content-Disposition`.
4. Integrate "Download PDF" buttons into UI:
   - `src/components/pos/receipt-invoice.tsx`: Add "Download PDF" button next to "Print".
   - `src/components/sales/sale-invoice-dialog.tsx`: Add "Download PDF" button.
   - `src/app/(dashboard)/sales/[id]/sale-action-buttons.tsx`: Add "Download PDF" button.
5. Write automated unit tests:
   - `src/lib/pdf/__tests__/invoice-pdf-generator.test.ts`: Verify valid PDF buffer generated, `%PDF-1.` header, line items, HSN, and GST matrix.
   - `src/app/api/sales/[id]/pdf/__tests__/sale-pdf-route.test.ts`: Verify API route returns HTTP 200 and application/pdf.
   Run tests using Jest and ensure all pass cleanly.

## Exclusive Write Ownership
You own the following files exclusively:
- `src/lib/pdf/invoice-pdf-generator.ts`
- `src/lib/pdf/__tests__/invoice-pdf-generator.test.ts`
- `src/app/api/sales/[id]/pdf/route.ts`
- `src/app/api/sales/[id]/pdf/__tests__/sale-pdf-route.test.ts`
- `src/components/pos/receipt-invoice.tsx`
- `src/components/sales/sale-invoice-dialog.tsx`
- `src/app/(dashboard)/sales/[id]/sale-action-buttons.tsx`
Do NOT modify files outside the invoicing subsystem.

## Context & Input Files
- Read `c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md`
- Read `c:\metapharsic-pharmacy-complete\PROJECT.md`
- Read `c:\metapharsic-pharmacy-complete\.agents\teamwork\survey_explorer_2\handoff.md`

## MANDATORY INTEGRITY WARNING
> DO NOT CHEAT. All implementations must be genuine. DO NOT
> hardcode test results, create dummy/facade implementations, or
> circumvent the intended task. A teamwork_auditor will independently
> verify your work. Integrity violations WILL be detected and your
> work WILL be rejected.

## Deliverables & Handoff
Write your completion report to `c:\metapharsic-pharmacy-complete\.agents\teamwork\teamwork_worker_m2_pdf\handoff.md` following the standard handoff protocol with exact test execution commands and results.
When finished, notify the orchestrator via send_message.
