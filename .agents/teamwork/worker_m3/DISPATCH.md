# Dispatch — Worker M3: Dual-View Interactive Review UI

**Role**: `teamwork_worker`  
**Milestone**: Milestone M3 (Dual-View Interactive Review UI)  
**Assigned Features**:
- F20: Document Upload Dropzone Component (`document-upload-zone.tsx` supporting PDF, PNG, JPEG up to 15MB).
- F21: Scanning Progress Card (`scanning-progress-card.tsx` animated multi-stage progress indicator with extraction status).
- F22: Document Preview Pane (`document-preview-pane.tsx` left pane with zoom 50%-300%, pan, rotate, and multi-page PDF navigation).
- F23: Structured Bill Metadata Form (`bill-metadata-form.tsx` supplier selection, invoice #, date, branch).
- F24: Line Items Review Table (`line-items-review-table.tsx` right pane editable table with `SearchableSelect` fuzzy medicine search).
- F25: Line Item Row Editor & Dynamic Math (`line-item-row-editor.tsx` real-time line item recalculations, confidence badges, short-expiry warnings).
- F26: Bill Summary Footer & Math Alert (`bill-summary-footer.tsx` subtotal, tax breakdown, discount, roundoff, and variance alert).
- F27: Explicit Confirmation Barrier Modal (`bill-confirmation-dialog.tsx` non-bypassable `AlertDialog` safety barrier before saving or modifying stock).
- F28: Purchases Navigation Integration ("Scan Purchase Bill" trigger on `/purchases` and dedicated `/purchases/scan/page.tsx`).

---

## 🔒 Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

---

## Technical Specifications
Read:
- `c:\metapharsic-pharmacy-complete\PROJECT.md`
- `c:\metapharsic-pharmacy-complete\.agents\teamwork\orchestrator_3\IMPLEMENTATION_PLAN.md` (Sections 4 & 5)
- `c:\metapharsic-pharmacy-complete\.agents\teamwork\explorer_survey_2\handoff.md`
- `src/lib/purchases/purchase-provisioning-service.ts`
- `src/app/api/purchases/scan/route.ts`
- `src/app/api/purchases/scan/commit/route.ts`

### Target Files to Create / Modify:
1. `src/components/purchases/bill-scanner/types.ts`
2. `src/components/purchases/bill-scanner/document-upload-zone.tsx`
3. `src/components/purchases/bill-scanner/scanning-progress-card.tsx`
4. `src/components/purchases/bill-scanner/document-preview-pane.tsx`
5. `src/components/purchases/bill-scanner/bill-metadata-form.tsx`
6. `src/components/purchases/bill-scanner/line-item-row-editor.tsx`
7. `src/components/purchases/bill-scanner/line-items-review-table.tsx`
8. `src/components/purchases/bill-scanner/bill-summary-footer.tsx`
9. `src/components/purchases/bill-scanner/bill-confirmation-dialog.tsx`
10. `src/components/purchases/bill-scanner/purchase-bill-scanner-view.tsx`
11. `src/app/(dashboard)/purchases/scan/page.tsx`
12. `src/app/(dashboard)/purchases/page.tsx` (add "Scan Purchase Bill" button)
13. `src/components/purchases/bill-scanner/__tests__/bill-scanner.test.tsx`

---

## Key Functional & Design Requirements
1. **Split Dual-View Workspace**:
   - Left 45%: Document preview (zoom 50%-300%, rotate 90°, pan, multi-page PDF navigation).
   - Right 55%: Structured editable review form.
2. **Dynamic Math Recalculation**:
   - Line taxable = `round2(billedQuantity * unitCost * (1 - discountPercent / 100))`.
   - Line tax = `round2(lineTaxable * (taxPercent / 100))`.
   - Line total = `round2(lineTaxable + lineTax)`.
   - Billed quantity vs free quantity: free quantity is added to usable units without increasing financial charge.
3. **Variance & Discrepancy Alert**:
   - Compare computed invoice total against extracted invoice total. If variance > Rs. 1.00, display amber warning banner highlighting discrepancy.
4. **Explicit Confirmation Barrier**:
   - `AlertDialog` modal summarizing Supplier, Invoice #, Item Count, Total Units (Billed + Free), and Total Payable.
   - Strict safety rule: No stock or database mutation occurs until explicit user click on "Confirm & Provision Inventory".
   - On confirmation, post to `POST /api/purchases/scan/commit` and handle success/error with toast and redirection.

---

## Verification Commands
1. `npx jest src/components/purchases/bill-scanner/__tests__/bill-scanner.test.tsx --forceExit`
2. `npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit`
3. `npx eslint src/components/purchases/bill-scanner/ src/app/(dashboard)/purchases/scan/`
4. `npx tsc --noEmit`

Write your completion report to:
`c:\metapharsic-pharmacy-complete\.agents\teamwork\worker_m3\handoff.md`
