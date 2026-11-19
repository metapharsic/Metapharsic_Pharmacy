# Survey Explorer 2 Handoff Report: Invoicing, PDF Generation & WhatsApp Sharing

## 1. Observation

### 1.1 Invoicing Architecture & Display Mechanisms
- **Component Implementations**:
  - `src/components/pos/receipt-invoice.tsx`: Primary component for invoice presentation. Used in:
    - POS 1 checkout completion modal: `src/components/pos/pos-client.tsx:2746` (`<ReceiptInvoice sale={completedSale as unknown as ReceiptData} showPrintButton={true} />`).
    - POS 2 checkout completion modal: `src/components/pos2/pos2-client.tsx:2743` (`<ReceiptInvoice sale={completedSale as unknown as ReceiptData} showPrintButton={true} />`).
    - Touchscreen scan dispenser modal: `src/components/pos/touchscreen-scan-dispenser-modal.tsx:834`.
    - Sale Invoice Dialog: `src/components/sales/sale-invoice-dialog.tsx:31` (`<ReceiptInvoice sale={sale} showPrintButton={true} />`).
    - Edit Sale Dialog: `src/components/sales/edit-sale-dialog.tsx:505`.
    - Sale Bill Detail Dialog: `src/components/sales/sale-bill-detail-dialog.tsx:320`.
    - Sale Details Page: `src/app/(dashboard)/sales/[id]/page.tsx:89`.
    - POS 2 re-export: `src/components/pos2/receipt-invoice.tsx:8-9` (`export * from '@/components/pos/receipt-invoice'`).
  - Print button actions:
    - `src/components/pos/receipt-invoice.tsx:365-367`: `const handlePrint = () => { window.print() }`.
    - `src/app/(dashboard)/sales/[id]/sale-action-buttons.tsx:34-37`: `const handlePrint = () => { window.print() }`.
  - Global Print CSS:
    - `src/components/pos/receipt-invoice.tsx:662-691`:
      ```css
      @media print {
        @page { margin: 4mm; size: auto; }
        body { visibility: hidden; background: #fff !important; }
        #printable-receipt, #printable-receipt * { visibility: visible !important; }
        #printable-receipt {
          position: absolute !important;
          left: 0 !important; top: 0 !important;
          width: ${printVariant === 'slip' ? '80mm' : '100%'} !important;
          max-width: 100% !important; border: none !important; box-shadow: none !important;
          padding: 0 !important; margin: 0 auto !important;
        }
        .no-print { display: none !important; }
      }
      ```
- **Backend & APIs**:
  - `src/app/api/sales/route.ts` and `src/app/api/sales/[id]/route.ts`: Expose sales metadata and JSON data.
  - **Zero PDF routes exist**: There is currently NO `src/app/api/sales/[id]/pdf` or any server-side PDF generator route in the entire codebase.
  - Grep search for `jspdf` across `src/`: 0 results found.
- **Dependencies Installed**:
  - `package.json:78-79`: `"jspdf": "^2.5.1"`, `"jspdf-autotable": "^3.8.2"`, `"@types/jspdf": "^2.0.0"`.
  - `package.json:99`: `"xlsx": "^0.18.5"`.
  - Empirically verified via Node runtime:
    - `node -e "const { jsPDF } = require('jspdf'); ..."` -> Generated 3,163 byte PDF buffer.
    - `node -e "const { jsPDF } = require('jspdf'); require('jspdf-autotable'); ..."` -> Generated 4,008 byte PDF buffer with table.
    - `node -e "const XLSX = require('xlsx'); ..."` -> Generated 15,951 byte valid Excel workbook buffer.

### 1.2 Layout & Alignment Defects in Current Invoices
1. **Column Overcrowding & Width Squeezing on 80mm Slips**:
   - `src/components/pos/receipt-invoice.tsx:518-530`:
     The table defines 8 horizontal columns:
     `#` (`w-6`), `Description / Composition` (auto/flex), `Batch` (`w-14`), `Exp` (`w-12`), `Qty` (`w-10`), `MRP` (`w-12`), `Rate` (`w-12`), `Amount` (`w-14`).
   - On an 80mm thermal receipt (`max-w-sm` container ~300px), 8 horizontal columns cause severe text clipping, wrap-around of numbers, and cut-off medicine names.
   - For A4/A5 full invoices, the exact same hardcoded narrow widths (`w-14`, `w-12`) are reused, leaving vast awkward blank spaces and unaligned columns.
2. **Missing Statutory HSN Codes in Line Items**:
   - `src/components/pos/receipt-invoice.tsx:33`: `ReceiptItem` has `hsnCode?: string | null`.
   - In lines 518-571, the `hsnCode` is never rendered in the table header or table body. Under Indian GST Rule 46 (Statutory Drug Tax Invoice), HSN classification (e.g. `3004` for medicaments) is legally required per line item. It only appears as a static string `"GST HSN 3004"` in the footer disclaimer (line 648).
3. **Hardcoded GST Rate Label**:
   - `src/components/pos/receipt-invoice.tsx:589-592`:
     `<span>GST Tax Breakdown (CGST 6% + SGST 6%):</span>`
   - Pharmaceutical products in India have multiple GST slabs: 0% (essential life-saving), 5% (vaccines, ORS), 12% (standard pharmaceuticals), 18% (nutraceuticals/antiseptics), and 28%.
   - Hardcoding `(CGST 6% + SGST 6%)` produces legally false tax breakdowns when products have 0%, 5%, 18% GST or interstate IGST.
4. **Totals Alignment & Tabular Figures**:
   - Financial totals (lines 576-613) use standard font weights without tabular figures (`tabular-nums`), causing decimal points and currency symbols to wobble vertically between lines.
5. **No Export or Download Capability**:
   - User has only a browser print button (`window.print()`). There is no button or capability to download or export a `.pdf` file.
   - In `reports-hub-client.tsx:190-257` and `compliance-reports-view.tsx:202-218`, all reports export only as `.csv` (using `papaparse` or raw CSV strings). No Excel (.xlsx) export exists, and the user requested Excel files with clean column formatting.

### 1.3 WhatsApp Sharing Infrastructure
- **Existing Service**:
  - `src/lib/whatsapp/whatsapp-service.ts`:
    - `normalizePhoneNumber(rawPhone)`: Cleans digits and converts 10-digit Indian numbers to E.164 (`+91...`).
    - `generateWaMeLink(phone, text)`: Constructs `https://wa.me/${cleanDigits}?text=${encodeURIComponent(text)}`.
    - `WhatsAppService.sendMessage(options)`: Supports 4 channels:
      1. Meta WhatsApp Business Cloud API (`WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`).
      2. Twilio Programmable WhatsApp (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`).
      3. UltraMsg Gateway (`ULTRAMSG_INSTANCE_ID`, `ULTRAMSG_TOKEN`).
      4. Local Simulation / Browser wa.me Link fallback.
- **Existing Reports Integration**:
  - `src/lib/reports/daily-closing-digest-service.ts`: Formats comprehensive End-of-Day (11:30 PM) WhatsApp text digest with cash count, gross profit, near-expiry alerts, Schedule H compliance, and top doctor.
  - `src/components/reports/owner-whatsapp-digest-card.tsx` and `src/components/sales/whatsapp-eod-dialog.tsx`: UI dialogs for dispatching or previewing daily closing reports.
  - Weekly and Monthly report WhatsApp formats are currently NOT implemented.
  - Invoice WhatsApp sharing (sending bill summary with PDF download link to patient/customer) is currently NOT implemented.

### 1.4 Asynchronous / Worker Threads Architecture
- **Existing Worker Implementations**:
  - `src/lib/inventory/workers/inventory-analytics.worker.js` with `src/lib/inventory/inventory-analytics-service.ts`: Dispatches CPU-bound dead stock analytics to Node.js `worker_threads` with a 5000ms timeout and synchronous fallback.
  - `src/lib/reports/workers/reporting-analytics.worker.js` with `src/lib/reports/reporting-worker-bridge.ts`: Dispatches sales financials, gross profit, and compliance auditing to Node `worker_threads`.

---

## 2. Logic Chain

### 2.1 Why Current Invoices Fail User & Regulatory Requirements
1. **Observation**: `receipt-invoice.tsx:518-530` forces 8 columns into an 80mm slip and `window.print()` triggers browser print dialog with no file output.
2. **Inference**: Browser `window.print()` cannot satisfy Requirement R2 ("Generate and export all invoices in PDF format"). In retail pharmacies, cashiers must be able to download a PDF, email a PDF, or transmit a direct PDF link to customers over WhatsApp.
3. **Inference**: On 80mm POS thermal printers (the primary pharmacy printer), 8 columns horizontally cannot fit legible medicine descriptions, batch numbers, and rates. Thermal slips require a clean stacked format (Line 1: Item & HSN; Line 2: Batch, Exp, Qty @ Rate, Disc, Amount). Full A4/A5 invoices require an aligned grid table with explicit percentage widths.
4. **Inference**: Hardcoding `(CGST 6% + SGST 6%)` violates GST compliance. The totals section must dynamically aggregate by GST slab (e.g. 0%, 5%, 12%, 18%).

### 2.2 Server-Side vs. Client-Side PDF Generation Strategy
1. **Observation**: `jspdf` and `jspdf-autotable` are already installed and tested working in both Node.js (generating valid buffer) and browser DOM.
2. **Inference**: A dual-tier PDF strategy is optimal:
   - **Tier A (Server-Side Route `GET /api/sales/[id]/pdf`)**:
     Provides an immutable, permanent URL for any sale: `http://<host>/api/sales/<id>/pdf?format=a4` or `?format=thermal80`.
     Can be linked directly in WhatsApp messages, emailed, or opened in a new tab.
   - **Tier B (Client-Side Instant Download)**:
     A shared helper `src/lib/pdf/invoice-pdf-generator.ts` uses the same `jsPDF` core to download the PDF instantly in the cashier's browser (`doc.save()`) without extra network latency.

### 2.3 WhatsApp Sharing: Click-to-Chat vs. Server API
1. **Observation**: `WhatsAppService` has Meta Cloud API, Twilio, UltraMsg, and `generateWaMeLink`.
2. **Inference**: Requiring server-side API credentials alone would break in environments without paid Meta/Twilio accounts. Conversely, click-to-chat (`wa.me`) requires zero credentials, zero setup, has zero cost, and opens WhatsApp Web/App directly with pre-populated text and link.
3. **Conclusion**: Provide a **Hybrid WhatsApp Architecture**:
   - **Client-Side One-Click (`wa.me`)**: Default action on the UI. Generates a deep link with pre-formatted invoice summary + direct PDF URL. When clicked, opens WhatsApp Web or the WhatsApp mobile app.
   - **Server-Side API**: Available when environment variables (`WHATSAPP_API_TOKEN` or `TWILIO_ACCOUNT_SID` or `ULTRAMSG_TOKEN`) are configured. A "Send via API" toggle in the dialog allows automated silent dispatch.
   - **Report Sharing**:
     - Daily: Use existing `DailyClosingDigestService`.
     - Weekly: Add `WeeklySummaryDigestService` (7-day sales, weekly gross profit, top 5 medicines, weekly collection breakdown).
     - Monthly: Add `MonthlySummaryDigestService` (30-day executive audit, COGS vs Revenue, Udhaar/Khata balance, supplier payables, Schedule H units).

### 2.4 Asynchronous / Background Worker Offloading
1. **Observation**: Node `worker_threads` is already the established pattern in `inventory-analytics-service.ts` and `reporting-worker-bridge.ts`.
2. **Inference**:
   - Single invoice PDF rendering (1-20 items) takes <15ms in Node.js and does not require spawning a separate worker thread.
   - Bulk invoice generation (e.g. monthly billing ledger with 5,000 invoices) or large Excel report exports (.xlsx generation for 50,000 rows) can saturate Node's V8 event loop.
   - Following the existing pattern, `reporting-worker-bridge.ts` should be extended with worker commands `GENERATE_EXCEL_REPORT` and `GENERATE_BATCH_INVOICE_PDF`, running in `reporting-analytics.worker.js` with automatic synchronous fallback.

---

## 3. Caveats
1. **Browser Pop-up Blockers**: Opening `window.open(waMeUrl, '_blank')` or `window.open(pdfUrl, '_blank')` must be triggered directly inside a user click event handler to prevent popup blocking.
2. **Thermal Printer Cutters**: 80mm POS slip PDFs rendered via `jsPDF` should use continuous page height or dynamic height based on item count (`autoTable.finalY + margin`), rather than fixed A4 pagination, to avoid premature roll cutting.
3. **WhatsApp Deep-Link Character Limits**: WhatsApp Web supports URLs up to ~2,000 characters. Invoice summaries must remain concise (top items itemized, remaining summarized as "+X more items", followed by the PDF link).
4. **Database Decimal Serialization**: Prisma returns `Decimal` objects for amounts. When passing data to `jsPDF` or Node worker threads, all numbers must be converted via `Number()` or `parseNum()` to prevent serialization failures.

---

## 4. Conclusion & Actionable Blueprint

### 4.1 Invoice Layout & Alignment Fixes
1. **Implement Dual-Mode Layout in `src/components/pos/receipt-invoice.tsx`**:
   - **80mm Thermal Slip (`variant="slip"`)**:
     - Switch from an 8-column table to a clean 2-tier stacked card table:
       - Line 1: `[S.No] ProductName` (bold) + `HSN: 3004` (muted)
       - Line 2: `Batch: B123 | Exp: 08/27 | 10 Qty × ₹15.00 | Disc: ₹0 | Total: ₹150.00`
     - Eliminates all horizontal clipping and text squishing on 80mm rolls.
   - **A4/A5 Full GST Tax Invoice (`variant="full"`)**:
     - Render full grid with dedicated columns: `S.No (5%)`, `Item Description & Composition (30%)`, `HSN (8%)`, `Batch (10%)`, `Exp (8%)`, `Qty (6%)`, `MRP (8%)`, `Rate (8%)`, `Disc % (7%)`, `GST % (6%)`, `Amount (10%)`.
     - Right-align numeric columns with `tabular-nums font-mono`.
   - **Dynamic GST Tax Breakdown Matrix**:
     - Compute tax amounts per GST slab (e.g. 0%, 5%, 12%, 18%) instead of hardcoding `(CGST 6% + SGST 6%)`.
     - Display: Tax Slab | Taxable Value | CGST | SGST | Total GST.

### 4.2 PDF Generation Implementation
1. **Client-Side PDF Generator (`src/lib/pdf/invoice-pdf-generator.ts`)**:
   - Uses `jspdf` and `jspdf-autotable`.
   - Function `exportInvoiceToPdf(sale: ReceiptData, options: { format: 'a4' | 'thermal80', action: 'download' | 'blob' })`.
   - Adds pharmacy header, legal license numbers, customer/doctor metadata, styled autotable, GST summary matrix, amount in words (INR), and authorized pharmacist signature block.
2. **Server-Side PDF Route (`src/app/api/sales/[id]/pdf/route.ts`)**:
   - `GET /api/sales/[id]/pdf?format=a4|thermal80&download=true|false`.
   - Validates user session / permissions.
   - Loads sale via `getSaleById`.
   - Generates binary PDF buffer using `generateInvoicePdfBuffer(sale)`.
   - Returns `NextResponse` with headers:
     `'Content-Type': 'application/pdf'`
     `'Content-Disposition': 'inline; filename="Invoice-INV-xxx.pdf"'` (or `attachment` if `download=true`).
3. **UI Integration**:
   - Update `ReceiptInvoice` (`src/components/pos/receipt-invoice.tsx`) to add a "Download PDF" button next to "Print Tax Invoice".
   - Update `SaleInvoiceDialog` (`src/components/sales/sale-invoice-dialog.tsx`) to provide "Download PDF" and "Open PDF in New Tab".
   - Update `SaleActionButtons` (`src/app/(dashboard)/sales/[id]/sale-action-buttons.tsx`) to include "Download PDF".

### 4.3 WhatsApp Sharing Architecture
1. **WhatsApp Invoice Sharing Dialog (`src/components/sales/whatsapp-invoice-dialog.tsx`)**:
   - Props: `{ open, onOpenChange, sale }`.
   - Displays pre-filled customer phone number (from sale.customer.phone).
   - Generates formatted WhatsApp text:
     ```
     🏥 *METAPHARSIC PHARMACARE*
     🧾 *TAX INVOICE: ${sale.invoiceNumber}*
     📅 Date: ${saleDate}
     👤 Patient: ${customerName}
     ━━━━━━━━━━━━━━━━━━━━
     ${itemsList}
     ━━━━━━━━━━━━━━━━━━━━
     💰 *Net Payable: ₹${totalAmount}*
     💳 Payment: ${paymentMethod}
     📄 *Download Official Tax Invoice PDF:*
     ${appUrl}/api/sales/${sale.id}/pdf
     ━━━━━━━━━━━━━━━━━━━━
     Thank you! Wishing you a speedy recovery!
     ```
   - Provides "1-Click Open WhatsApp Web / App" (`wa.me`) and "Send via WhatsApp API".
2. **Weekly and Monthly Report WhatsApp Digests**:
   - Extend `DailyClosingDigestService` or create `src/lib/reports/executive-digest-service.ts`:
     - `generateWeeklyDigest(branchId)`: Aggregates 7-day revenue, profit margin %, top 5 medicines, collection split.
     - `generateMonthlyDigest(branchId)`: Aggregates 30-day financials, COGS, customer Khata balance, supplier payables.
   - Extend `src/app/api/reports/daily-closing/whatsapp/route.ts` to support `?period=daily|weekly|monthly`.
   - Add "Share via WhatsApp" buttons on the Weekly and Monthly tabs in `reports-hub-client.tsx`.

### 4.4 Excel Report Exports (R1 Requirements)
1. **Replace CSV with Excel (.xlsx) in `src/components/reports/reports-hub-client.tsx`**:
   - Replace `exportSalesCSV`, `exportPrescriptionsCSV`, `exportDoctorsCSV` with `exportSalesExcel`, `exportPrescriptionsExcel`, `exportDoctorsExcel`.
   - Uses `xlsx` (`XLSX.utils.book_new()`, `XLSX.utils.json_to_sheet()`, `XLSX.writeFile()`).
   - Define custom column widths (`!cols`), uppercase formatted headers, formatted numbers, and auto-generated sheet names (e.g. `Daily_Sales_Report`, `Weekly_Sales_Report`, `Monthly_Sales_Report`).
   - Completely removes CSV / XML formats for report downloads, satisfying R1: "No reports must be generated or exported in XML format; all report downloads must be Excel files."

### 4.5 File Matrix for Implementation
| File Path | Action | Description |
|-----------|--------|-------------|
| `src/lib/pdf/invoice-pdf-generator.ts` | **Create** | High-precision jsPDF + AutoTable generator for A4 & 80mm thermal PDF invoices. |
| `src/app/api/sales/[id]/pdf/route.ts` | **Create** | App Router API endpoint returning binary PDF response with caching & inline/attachment headers. |
| `src/components/pos/receipt-invoice.tsx` | **Modify** | Fix column layout/alignment on 80mm slips, add HSN code, dynamic GST slab table, and "Download PDF" button. |
| `src/components/sales/whatsapp-invoice-dialog.tsx` | **Create** | Modal dialog for sharing invoice via WhatsApp (wa.me click-to-chat + API dispatch). |
| `src/lib/reports/excel-export-service.ts` | **Create** | Utility to generate styled `.xlsx` workbooks for Daily, Weekly, and Monthly reports. |
| `src/components/reports/reports-hub-client.tsx` | **Modify** | Replace CSV exports with `.xlsx` Excel downloads, add WhatsApp share button. |
| `src/lib/reports/executive-digest-service.ts` | **Create** | Weekly and monthly digest formatting and WhatsApp generation. |
| `src/lib/pdf/__tests__/invoice-pdf-generator.test.ts` | **Create** | Automated unit tests verifying PDF generation, header structure, and table alignment. |
| `src/app/api/sales/[id]/pdf/__tests__/sale-pdf-route.test.ts` | **Create** | Automated API route unit tests for PDF export. |

---

## 5. Verification Method

### 5.1 Automated Unit Tests
1. **PDF Generation Test**:
   ```bash
   npx jest src/lib/pdf/__tests__/invoice-pdf-generator.test.ts
   ```
   - Verifies `generateInvoicePdf` returns a valid PDF document buffer starting with `%PDF-1.`.
   - Verifies all line items, HSN codes, batches, and GST slabs appear in the generated document.
2. **PDF Route Test**:
   ```bash
   npx jest src/app/api/sales/[id]/pdf/__tests__/sale-pdf-route.test.ts
   ```
   - Verifies `GET /api/sales/sale-1/pdf` returns HTTP 200 with `Content-Type: application/pdf`.
3. **Excel Export Test**:
   ```bash
   npx jest src/lib/reports/__tests__/excel-export-service.test.ts
   ```
   - Verifies generated workbook contains valid worksheets and correct column headers without any XML leakage.
4. **Full Test Suite Execution**:
   ```bash
   npm run test:unit
   ```
   - Verify all existing and new unit tests pass cleanly.

### 5.2 Manual UI Verification
1. Navigate to `/sales` and open any sale details modal.
2. Click "Download PDF": verify a clean, properly aligned `.pdf` file is downloaded.
3. Open the downloaded PDF: verify medicine descriptions, HSN codes, batch numbers, expiry dates, quantities, rates, GST breakdown, and totals are aligned without wrapping or truncation.
4. Click "Share on WhatsApp": verify modal opens with customer phone preloaded, and clicking "Open WhatsApp" launches `https://wa.me/...` with clean Markdown text and PDF link.
5. Navigate to `/reports`, select Daily/Weekly/Monthly reports, click "Download Excel Report": verify an `.xlsx` file is downloaded (not `.csv` or `.xml`).
