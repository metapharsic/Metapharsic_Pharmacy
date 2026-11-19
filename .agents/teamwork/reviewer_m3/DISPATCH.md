# DISPATCH — Reviewer M3

## Assignment: Milestone M3 Interactive Review UI Verification
- **Role**: `teamwork_reviewer`
- **Working Directory**: `c:\metapharsic-pharmacy-complete\.agents\teamwork\reviewer_m3\`
- **Mandatory Requirements Source**: `c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md` (READ THIS FIRST)
- **Project Scope Document**: `c:\metapharsic-pharmacy-complete\PROJECT.md`
- **Worker Report**: `c:\metapharsic-pharmacy-complete\.agents\teamwork\worker_m3\handoff.md`

## Scope of Review
Inspect all files authored/modified for Milestone M3:
- Components in `src/components/purchases/bill-scanner/`:
  - `types.ts`
  - `document-upload-zone.tsx`
  - `scanning-progress-card.tsx`
  - `document-preview-pane.tsx`
  - `bill-metadata-form.tsx`
  - `line-item-row-editor.tsx`
  - `line-items-review-table.tsx`
  - `bill-summary-footer.tsx`
  - `bill-confirmation-dialog.tsx`
  - `purchase-bill-scanner-view.tsx`
  - `index.ts`
- Route page: `src/app/(dashboard)/purchases/scan/page.tsx`
- Navigation update: `src/app/(dashboard)/purchases/page.tsx` & `src/lib/constants/routes.ts`
- Test suite: `src/components/purchases/bill-scanner/__tests__/bill-scanner.test.tsx`

## Verification Checks Required
1. Run and document component tests:
   `npx jest src/components/purchases/bill-scanner/__tests__/bill-scanner.test.tsx --forceExit`
2. Run and document end-to-end tests:
   `npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit`
3. Run ESLint:
   `npx eslint src/components/purchases/bill-scanner/ "src/app/(dashboard)/purchases/scan/"`
4. Run TypeScript checks:
   `npx tsc --noEmit`
5. Inspect code quality, accessibility, usability, and domain logic:
   - Verify dual-view pane layout (45% document preview, 55% structured review table).
   - Verify dynamic math recalculation on line item edits (`computeLineItemAmounts`, `computeBillTotals`).
   - Verify bonus units (`freeQuantity`) correctly increment usable inventory while only `billedQuantity` drives taxable amounts.
   - Verify variance alert banner displays when computed total diverges from OCR total by > ₹1.00.
   - Verify short-expiry warning badge alerts when expiry is within 6 months.
   - Verify confirmation barrier dialog modal: non-bypassable `AlertDialog` with mandatory confirmation checkbox before commit can proceed.
   - Verify proper RBAC check and route protection on `/purchases/scan`.

## Deliverables
Write self-contained `handoff.md` in `c:\metapharsic-pharmacy-complete\.agents\teamwork\reviewer_m3\` with clear verdict:
**APPROVE** or **REQUEST_CHANGES**.


## 2026-11-03T15:10:12Z
You are the Reviewer for Milestone M3 (Dual-View Interactive Review UI).
Your working directory is: c:\metapharsic-pharmacy-complete\.agents\teamwork\reviewer_m3\
Please read your assignment in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\reviewer_m3\DISPATCH.md
Also read the authoritative user requirements in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\ORIGINAL_REQUEST.md
Read the project scope and interfaces in:
c:\metapharsic-pharmacy-complete\PROJECT.md
And read Worker M3's handoff report in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\worker_m3\handoff.md

Conduct a complete code review, run the required test suites and linting checks:
- npx jest src/components/purchases/bill-scanner/__tests__/bill-scanner.test.tsx --forceExit
- npx jest src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts --forceExit
- npx eslint src/components/purchases/bill-scanner/ "src/app/(dashboard)/purchases/scan/"
- npx tsc --noEmit

Document all findings and provide your clear verdict (APPROVE or REQUEST_CHANGES) in:
c:\metapharsic-pharmacy-complete\.agents\teamwork\reviewer_m3\handoff.md
Send a completion message back when done.
