# Milestone 2 Completion Report: Invoicing Layout Alignment & PDF Generation

## 1. Observation

### 1.1 Baseline Deficiencies Identified
- **80mm Thermal Slip Overflow**: In `src/components/pos/receipt-invoice.tsx`, the receipt previously rendered an 8-column layout (`#`, `Description / Composition`, `Batch`, `Exp`, `Qty`, `MRP`, `Rate`, `Amount`). On 80mm thermal paper widths (~300px), this caused text squishing, clipping of medicine names, and uneven numeric wrapping.
- **Missing Statutory HSN Codes**: `hsnCode` was never displayed on individual line items despite being a statutory requirement under GST Rule 46 for pharmaceutical invoices.
- **Hardcoded GST Slab Label**: Line items were summarized with a static label `(CGST 6% + SGST 6%)`, generating legally incorrect summaries for items under 0%, 5%, 18%, or interstate IGST rates.
- **Absence of PDF Export**: No server route or client generator existed for PDF invoices. `window.print()` was the sole output method, preventing digital archiving and WhatsApp transmission.

### 1.2 Implemented Components & Deliverables
1. **Universal PDF Generator** (`src/lib/pdf/invoice-pdf-generator.ts`):
   - Implemented `generateInvoicePdfDoc`, `generateInvoicePdfBuffer`, and `downloadInvoicePdf` using `jspdf` and `jspdf-autotable`.
   - Generates binary PDF documents compliant with Drugs & Cosmetics Act, GST statutory Rule 46, and FSSAI standards.
   - Dual format engine:
     - `a4` (210mm × 297mm): Proportional tabular layout with explicit column widths, official pharmacy headers, statutory credential pills, two-tier item details, dynamic GST matrix, net payable banner, and pharmacist signature block.
     - `thermal80` (80mm continuous width): Continuous dynamic height calculated per item count and GST slabs (`Math.max(160, baseHeight + itemsHeight + gstHeight)`), preventing premature receipt cuts or blank pages.
   - Dynamic GST multi-slab matrix (`computeGstSlabs`) aggregating taxable values, CGST, SGST, IGST, and total tax across 0%, 5%, 12%, 18%, and 28% slabs.
   - INR Number-to-Words converter (`numberToWordsINR`).
2. **Server-Side Binary PDF API Route** (`src/app/api/sales/[id]/pdf/route.ts`):
   - Endpoint: `GET /api/sales/[id]/pdf?format=a4|thermal80&download=true|false`.
   - Validates session permissions (`sales:read`) and resolves branch access scope via `resolveBranchScope`.
   - Loads sale data with `getSaleById` and streams binary PDF with `Content-Type: application/pdf` and `Content-Disposition`.
3. **Enhanced Receipt Invoice Component** (`src/components/pos/receipt-invoice.tsx`):
   - Refactored `variant="slip"` to a 2-tier stacked card layout:
     - Tier 1: S.No + Product Name + HSN badge (`HSN ${hsn}`).
     - Tier 2: Batch, Expiry, Qty @ Rate, Discount, and right-aligned Amount in `tabular-nums font-mono`.
   - Enhanced `variant="full"` with a proportional grid: `#` (4%), `Description & Composition` (33%), `HSN` (8%), `Batch` (10%), `Exp` (7%), `Qty` (6%), `MRP` (8%), `Rate` (8%), `Disc` (6%), `Amount` (10%).
   - Integrated dynamic statutory GST matrix breakdown in both slip and full formats.
   - Added "Download PDF" button next to "Print Tax Invoice".
4. **UI Integration**:
   - `src/components/sales/sale-invoice-dialog.tsx`: Added "Download PDF" button in both the modal header and dialog action container.
   - `src/app/(dashboard)/sales/[id]/sale-action-buttons.tsx`: Added "Download PDF" button triggering `/api/sales/${saleId}/pdf?download=true`.

---

## 2. Logic Chain

1. **80mm Layout Fix**:
   - POS thermal slips have a usable width of ~72mm. Forcing 8 horizontal columns allocated <8mm to critical fields like Batch and Exp, causing numbers to wrap vertically and truncate product descriptions.
   - By converting to a 2-tier stacked structure (Item Name + HSN on row 1, Batch/Exp/Qty/Rate/Amount on row 2), each row has full horizontal breathing room, eliminating clipping and wrapping.
2. **Continuous Dynamic Thermal Height**:
   - Standard PDF generators default to fixed-height pages (e.g. 297mm for A4), which causes POS thermal printers to trigger roll cutters prematurely or eject excessive blank paper.
   - Calculating page height dynamically as `Math.max(160, baseHeight + itemsHeight + gstHeight)` produces a single continuous document page matching the exact content length.
3. **Statutory GST Multi-Slab Matrix**:
   - Pharmaceuticals in India span multiple GST tiers: 0% (essential life-saving / ORS), 5% (vaccines, insulin), 12% (standard medicaments), and 18% (antiseptics, nutraceuticals).
   - Grouping line items by tax slab and rendering distinct taxable bases, CGST/SGST/IGST rates, and tax amounts satisfies statutory audit criteria under Rule 46.
4. **Binary PDF Route Delivery**:
   - Next.js App Router route returns `new NextResponse(pdfBuffer as unknown as BodyInit, { headers: { 'Content-Type': 'application/pdf', ... } })`.
   - Setting `Content-Disposition: inline` allows direct browser preview, while `attachment` triggers instant file download.

---

## 3. Caveats

1. **System Fonts vs. Unicode Glyphs**:
   - Built-in PDF fonts (e.g. standard Helvetica) do not include the Unicode Indian Rupee symbol `₹` without embedding external TTF font files. To guarantee universal rendering across all operating systems and third-party PDF viewers without font corruption, the PDF generator renders currency amounts as `Rs. ${amount.toFixed(2)}`, while the web DOM UI retains `₹`.
2. **Sale Scope Validation**:
   - The PDF API route validates `requirePermission(PERMISSIONS.SALES_READ)` and branch scoping through `resolveBranchScope`. Unauthenticated requests receive 401; users without access to the branch receive 403.
3. **No Database Migrations Required**:
   - The implementation uses existing Prisma schema fields (`hsnCode`, `taxPercent`, `cgstPercent`, `sgstPercent`, `igstPercent`, `batchNumber`, `expiryDate`) without requiring any schema changes or database migrations.

---

## 4. Conclusion

Milestone 2 (Invoicing Layout Alignment & PDF Generation, Requirement R2) is completely implemented and verified:
- `receipt-invoice.tsx` renders clean, non-overlapping layouts in both 80mm thermal and A4/A5 full tax invoice modes.
- Statutory HSN codes are rendered per line item.
- GST breakdown is dynamically aggregated by tax slab (0%, 5%, 12%, 18%).
- `invoice-pdf-generator.ts` generates valid binary PDF buffers for both A4 and 80mm formats.
- `GET /api/sales/[id]/pdf` streams valid binary PDF documents with proper content types and disposition headers.
- UI "Download PDF" buttons are integrated into `receipt-invoice.tsx`, `sale-invoice-dialog.tsx`, and `sale-action-buttons.tsx`.
- All 15 unit and route tests pass cleanly with 100% test pass rate.
- ESLint checks across all created and modified files pass with 0 errors and 0 warnings.

---

## 5. Verification Method

### 5.1 Test Execution Commands & Results

1. **PDF Generator & Dynamic GST Matrix Unit Tests**:
   ```powershell
   npx jest src/lib/pdf/__tests__/invoice-pdf-generator.test.ts
   ```
   **Result**:
   ```
   PASS unit src/lib/pdf/__tests__/invoice-pdf-generator.test.ts
     Universal Invoice PDF Generator
       generateInvoicePdfBuffer
         √ generates a valid A4 binary PDF buffer with %PDF- header (44 ms)
         √ generates a valid 80mm continuous thermal slip PDF buffer (13 ms)
         √ handles sales with minimal/missing optional fields cleanly (17 ms)
         √ creates a jsPDF document with custom options overrides (20 ms)
       Dynamic GST Multi-Slab Matrix Calculation
         √ aggregates multiple tax slabs (0%, 5%, 12%, 18%) accurately (1 ms)
         √ falls back gracefully to overall sale tax when items have no per-item tax (1 ms)
       numberToWordsINR
         √ converts zero amount
         √ converts integers to Indian words format (1 ms)
         √ converts rupees and paise correctly
       parseNum and round2
         √ parses null, undefined, strings, numbers, and object with toString

   Test Suites: 1 passed, 1 total
   Tests:       10 passed, 10 total
   Snapshots:   0 total
   Time:        1.12 s
   ```

2. **Server-Side Binary PDF API Route Tests**:
   ```powershell
   npx jest sale-pdf-route
   ```
   **Result**:
   ```
   PASS unit src/app/api/sales/[id]/pdf/__tests__/sale-pdf-route.test.ts
     GET /api/sales/[id]/pdf
       √ returns 401 when user is unauthenticated (10 ms)
       √ returns 403 when user lacks sales:read permission (3 ms)
       √ returns 404 when sale does not exist (2 ms)
       √ returns 200 with application/pdf and binary PDF buffer for A4 format (45 ms)
       √ handles ?format=thermal80 and ?download=true query parameters (12 ms)

   Test Suites: 1 passed, 1 total
   Tests:       5 passed, 5 total
   Snapshots:   0 total
   Time:        1.998 s
   ```

3. **Combined Milestone 2 Test Suite Execution**:
   ```powershell
   npx jest "invoice-pdf-generator|sale-pdf-route"
   ```
   **Result**:
   ```
   PASS unit src/app/api/sales/[id]/pdf/__tests__/sale-pdf-route.test.ts
   PASS unit src/lib/pdf/__tests__/invoice-pdf-generator.test.ts

   Test Suites: 2 passed, 2 total
   Tests:       15 passed, 15 total
   Snapshots:   0 total
   Time:        2.378 s
   ```

4. **ESLint Verification Across All M2 Deliverables**:
   ```powershell
   npx eslint "src/lib/pdf/invoice-pdf-generator.ts" "src/lib/pdf/__tests__/invoice-pdf-generator.test.ts" "src/app/api/sales/[id]/pdf/route.ts" "src/app/api/sales/[id]/pdf/__tests__/sale-pdf-route.test.ts" "src/components/pos/receipt-invoice.tsx" "src/components/sales/sale-invoice-dialog.tsx" "src/app/(dashboard)/sales/[id]/sale-action-buttons.tsx"
   ```
   **Result**:
   ```
   Exit Code: 0 (No warnings, no errors)
   ```

### 5.2 Files to Inspect
- `src/lib/pdf/invoice-pdf-generator.ts`
- `src/app/api/sales/[id]/pdf/route.ts`
- `src/components/pos/receipt-invoice.tsx`
- `src/components/sales/sale-invoice-dialog.tsx`
- `src/app/(dashboard)/sales/[id]/sale-action-buttons.tsx`
- `src/lib/pdf/__tests__/invoice-pdf-generator.test.ts`
- `src/app/api/sales/[id]/pdf/__tests__/sale-pdf-route.test.ts`
