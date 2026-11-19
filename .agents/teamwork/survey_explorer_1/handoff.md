# Survey Report: Reporting Infrastructure, Excel (.xlsx) Exports & Worker Architecture

**Author:** Survey Explorer 1 (`survey_explorer_1`)  
**Date:** 2026-11-02T14:16:00Z  
**Target:** Orchestrator & Team Engineers  
**Scope:** Reporting Infrastructure (Daily, Weekly, Monthly), Excel (.xlsx) Exports, Deprecation of XML/CSV downloads, Background Worker Thread Architecture  

---

## 1. Observation

### 1.1 Existing Reporting Infrastructure & Endpoints

The codebase implements reporting across two primary layers: a unified backend service layer (`src/lib/reports/report-service.ts`, `src/lib/reports/daily-closing-digest-service.ts`) and specialized App Router API routes (`src/app/api/reports/...`).

#### 1.1.1 API Routes (`src/app/api/reports/...`)
1. **Sales & Financials:** `GET /api/reports/sales` (`src/app/api/reports/sales/route.ts:18-45`)
   - Delegates to `ReportService.getSalesFinancials(branchId, startDate, endDate)`.
   - Uses `parseDateRange(query)` from `src/lib/reports/report-params.ts:29-45`.
2. **Detailed Sales Ledger:** `GET /api/reports/sales-detailed` (`src/app/api/reports/sales-detailed/route.ts:9-109`)
   - Fetches recent 200 sales with items, batches, customer, and prescription doctor details.
3. **Daily Stock Position:** `GET /api/reports/stock` (`src/app/api/reports/stock/route.ts`)
   - Delegates to `ReportService.getDailyStockPosition(branchId, pagination)`.
4. **Near Expiry Stock:** `GET /api/reports/expiry` (`src/app/api/reports/expiry/route.ts`)
   - Delegates to `ReportService.getNearExpiry(branchId, daysThreshold, pagination)`.
5. **Consumption Report:** `GET /api/reports/consumption` (`src/app/api/reports/consumption/route.ts`)
   - Delegates to `ReportService.getConsumptionReport(branchId, startDate, endDate, pagination)`.
6. **Supplier Performance:** `GET /api/reports/supplier` (`src/app/api/reports/supplier/route.ts`)
   - Delegates to `ReportService.getSupplierPerformance(branchId, startDate, endDate, pagination)`.
7. **Schedule H & H1 Register:** `GET /api/reports/schedule-h` (`src/app/api/reports/schedule-h/route.ts`)
   - Delegates to `ReportService.getScheduleHRegister(branchId, filter, pagination)`.
8. **Gross Profit Analytics:** `GET /api/reports/gross-profit` (`src/app/api/reports/gross-profit/route.ts`)
   - Delegates to `ReportService.getGrossProfitReport(branchId, filter)`.
9. **Doctor Performance & Commissions:** `GET /api/reports/doctors` (`src/app/api/reports/doctors/route.ts`)
   - Delegates to `ReportService.getDoctorPerformanceReport(search)`.
10. **Prescription Register:** `GET /api/reports/prescriptions` (`src/app/api/reports/prescriptions/route.ts:9-85`)
   - Returns prescription ledger with doctor, patient, and billing status.
11. **Narcotics Register (Schedule X & H1):** `GET /api/reports/narcotics` (`src/app/api/reports/narcotics/route.ts`)
   - Delegates to `ReportService.getNarcoticRegister(branchId, startDate, endDate, pagination)`.
12. **Daily Closing WhatsApp Digest:** `POST /api/reports/daily-closing/whatsapp` (`src/app/api/reports/daily-closing/whatsapp/route.ts`)
   - Delegates to `DailyClosingDigestService.sendClosingDigest(branchId, recipientPhone, targetDate)`.

#### 1.1.2 UI Views (`src/app/(dashboard)/reports/...` and `src/components/reports/...`)
1. `src/app/(dashboard)/reports/page.tsx`:
   - Hub page hosting `<OwnerWhatsAppDigestCard />`, `<ReportsHubClient />`, and links to `/reports/inventory`, `/reports/supplier`, and `/reports/narcotics`.
2. `src/components/reports/reports-hub-client.tsx`:
   - Multi-tab client view for "Sales & Financials", "Prescriptions & Dispensing", and "Doctors & Referrals".
3. `src/app/(dashboard)/reports/sales/page.tsx`:
   - Sales revenue breakdown and daily financial trend view.
4. `src/app/(dashboard)/reports/inventory/page.tsx`:
   - Tabbed view: Daily Stock Position, Near-Expiry, and Consumption.
5. `src/components/reports/compliance-reports-view.tsx` (hosted on `src/app/(dashboard)/reports/compliance/page.tsx`):
   - Tabbed statutory view: Schedule H/H1, Gross Profit, Near-Expiry, and Doctor Commissions.
6. `src/app/(dashboard)/reports/supplier/page.tsx`:
   - Supplier procurement volume, fulfillment rate, and outstanding ledger balance.
7. `src/app/(dashboard)/reports/narcotics/page.tsx`:
   - Schedule X & H1 movement audit log.

---

### 1.2 Current Export Mechanisms & Discrepancies

#### 1.2.1 Installed Libraries (`package.json`)
- Line 99: `"xlsx": "^0.18.5"` is installed in `dependencies`.
- Line 86: `"papaparse": "^5.7.0"` is installed in `dependencies`.
- Line 78-79: `"jspdf": "^2.5.1"`, `"jspdf-autotable": "^3.8.2"` are installed in `dependencies`.

#### 1.2.2 Existing Export Implementation in Reports
Every single report view currently exports CSV via client-side `papaparse` or raw string joining:
- **`reports-hub-client.tsx:189-256`:**
  ```typescript
  const downloadCSV = async (data: any[], filename: string) => {
    const Papa = (await import('papaparse')).default
    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    ...
  }
  const exportSalesCSV = () => { ... downloadCSV(rows, 'Sales_Report') }
  const exportPrescriptionsCSV = () => { ... downloadCSV(rows, 'Prescriptions_Report') }
  const exportDoctorsCSV = () => { ... downloadCSV(rows, 'Doctors_Performance_Report') }
  ```
- **`src/app/(dashboard)/reports/sales/page.tsx:54-66`:**
  Calls `Papa.unparse(data.dailyBreakdown)` and downloads `'sales_report.csv'`.
- **`src/app/(dashboard)/reports/inventory/page.tsx:94-118`:**
  Calls `Papa.unparse(...)` and downloads `daily_stock_position.csv`, `near_expiry_report.csv`, or `consumption_report.csv`.
- **`src/components/reports/compliance-reports-view.tsx:201-223`:**
  Custom comma-joining function `exportToCsv(rows, filename)` generating `.csv` for `Schedule-H-Register`, `Near-Expiry-Stock`, `Gross-Profit-Report`, `Doctor-Commissions`.
- **`src/app/(dashboard)/reports/supplier/page.tsx:53-64`:**
  Calls `Papa.unparse` and downloads `'supplier_performance.csv'`.
- **`src/app/(dashboard)/reports/narcotics/page.tsx:56-67`:**
  Calls `Papa.unparse` and downloads `'narcotic_register.csv'`.

#### 1.2.3 Existing XML Exports
- In `src/app/api/tally/export/route.ts:17`:
  `const format = (searchParams.get('format') ?? 'xml') as TallyExportFormat`
- In `src/components/vouchers/receipt-voucher-form.tsx:353`:
  `window.open('/api/vouchers/receipt/${voucherId}/tally-xml?download=true', '_blank')`
- In `src/lib/tally/tally-service.ts:224`:
  Exports `.xml` vouchers for sales, purchases, daybook, batch summary, etc.

#### 1.2.4 Absence of Daily / Weekly / Monthly Period Selectors
- Currently, `report-params.ts` only provides `parseDateRange(query)`, which parses arbitrary strings `startDate` and `endDate`.
- None of the report UI components (`reports-hub-client.tsx`, `sales/page.tsx`, `inventory/page.tsx`, `compliance-reports-view.tsx`) feature explicit period presets for "Daily (Today)", "Weekly (Last 7 Days)", or "Monthly (Current Month / Last 30 Days)".

---

### 1.3 Worker Thread & Background Processing Architecture

The codebase contains two worker architectures:
1. **Inventory Analytics Worker:**
   - Files: `src/lib/inventory/inventory-analytics-service.ts:193-385` & `src/lib/inventory/workers/inventory-analytics.worker.js`.
   - Uses multi-path resolution (`getAnalyticsWorkerPath`) across `process.cwd()`, `__dirname`, and `.next/server/`.
   - Uses deep serialization `sanitizePayload` to convert Prisma `Decimal` instances and `Date`s to primitives, avoiding `DataCloneError`.
   - Handles timeout (5000ms), worker termination, and seamless fallback to synchronous pure functions (`executeSynchronousFallback`).
2. **Reporting Analytics Worker:**
   - Files: `src/lib/reports/reporting-worker-bridge.ts:14-87` & `src/lib/reports/workers/reporting-analytics.worker.js:358-396`.
   - Executes 4 worker commands: `COMPUTE_SALES_FINANCIALS`, `COMPUTE_GROSS_PROFIT`, `AUDIT_SCHEDULE_H_COMPLIANCE`, `AGGREGATE_DOCTOR_REFERRALS`.
   - **Vulnerability observed in `reporting-worker-bridge.ts:29`:**
     Only uses `path.resolve(__dirname, 'workers/reporting-analytics.worker.js')`, which fails if bundled inside Next.js `.next/server/chunks/`.
   - **Vulnerability observed in `reporting-worker-bridge.ts:67`:**
     Does not call `sanitizePayload()` before `worker.postMessage(...)`. If Prisma models containing `Decimal` objects (e.g. `saleItem.unitPrice`) or un-sanitized objects are posted, Node.js throws `DataCloneError`.

---

## 2. Logic Chain

1. **Requirement R1 states:**
   - "Export daily, weekly, and monthly reports in Excel format (.xlsx) with clean alignment and structure."
   - "No reports must be generated or exported in XML format; all report downloads must be Excel files."
2. **From Observation 1.2.1:** SheetJS (`xlsx` v0.18.5) is already installed in the root `package.json`, meaning no new npm package installations are required.
3. **From Observation 1.2.2 & 1.2.3:** Currently, all report downloads produce `.csv` files, while certain accounting ledger exports default to `.xml`. To satisfy R1, all CSV download buttons across the reporting suite must be replaced with Excel (`.xlsx`) downloads with proper column alignments, numerical formatting, and multi-row headers, and XML formats must be eliminated from all report export paths.
4. **From Observation 1.2.4:** To allow users to export daily, weekly, and monthly reports easily, we need a unified period resolution utility in `src/lib/reports/report-params.ts` that calculates `startDate` and `endDate` from a `period` parameter (`daily`, `weekly`, `monthly`, or `custom`), and UI period selectors (Dropdown/Tabs) in `reports-hub-client.tsx` and related report views.
5. **From Observation 1.3:** For heavy datasets (e.g., monthly sales registers with 10,000+ line items), processing off the main Node.js event loop is required (Requirement R5). The proven pattern from `inventory-analytics-service.ts` (multi-path worker resolution, payload sanitization, timeout management, and synchronous fallback) should be applied to `reporting-worker-bridge.ts` and extended to support worker-assisted report dataset compilation.
6. **Implementation Approach:**
   - Build a centralized server-side and client-compatible Excel generation utility: `src/lib/reports/excel-export-service.ts`.
   - Create a dedicated streaming endpoint: `GET /api/reports/export` returning `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` with Content-Disposition attachment.
   - Upgrade `src/lib/reports/reporting-worker-bridge.ts` with resilient worker path resolution and payload sanitization.
   - Update all report UI components to feature Daily/Weekly/Monthly period filters and single-click Excel (.xlsx) export buttons.

---

## 3. Caveats

1. **Integration Test Database:** As observed during test execution (`report-service.integration.test.ts`), integration tests require a running PostgreSQL instance on `localhost:5435`. Unit tests mock Prisma and run without an external database. All automated testing for report exports must include mock-based unit tests (`jest --selectProjects unit`).
2. **SheetJS (`xlsx`) Styling in Community Edition:** SheetJS v0.18.5 open-source edition natively supports column widths (`ws['!cols']`), cell number formatting (`z: '₹#,##0.00'`), and row heights, but does not render background fills without Pro styles. Clean layout must be achieved via optimal column widths, structured multi-line header rows, clear visual section dividers, and right/left alignments.
3. **Tally Accounting XML vs. Dispensary Reports:** Tally XML for accounting import is an external ERP integration format (`/api/vouchers/receipt/:id/tally-xml`). Dispensary business intelligence reports (Daily/Weekly/Monthly Sales, Stock Position, Compliance, Expiry, Consumption, Gross Profit, Doctors) must strictly export as `.xlsx` and never offer XML.

---

## 4. Conclusion & Architectural Recommendations

### 4.1 Recommended File Architecture

```
src/
├── lib/
│   └── reports/
│       ├── excel-export-service.ts            [NEW] Central Excel (.xlsx) builder (SheetJS)
│       ├── report-params.ts                  [ENHANCE] Add parseReportPeriod ('daily'|'weekly'|'monthly')
│       ├── reporting-worker-bridge.ts        [ENHANCE] Add multi-path resolution & sanitizePayload
│       └── workers/
│           └── reporting-analytics.worker.js [ENHANCE] Heavy aggregation & bucketing
├── app/
│   └── api/
│       └── reports/
│           └── export/
│               ├── route.ts                  [NEW] Streaming endpoint for daily/weekly/monthly .xlsx
│               └── __tests__/
│                   └── reports-export-route.test.ts [NEW] Route unit tests
└── components/
    └── reports/
        ├── reports-hub-client.tsx            [ENHANCE] Period selector (Daily/Weekly/Monthly) + Excel download
        └── compliance-reports-view.tsx       [ENHANCE] Replace CSV export with Excel (.xlsx) export
```

### 4.2 Excel Export Service Contract (`src/lib/reports/excel-export-service.ts`)

```typescript
export interface ExcelSheetConfig {
  sheetName: string
  title: string
  subtitle?: string
  metadata?: Record<string, string | number>
  headers: string[]
  data: (string | number | boolean | null | undefined)[][]
  columnWidths?: number[]
  summaryRow?: (string | number | null)[]
}

export interface ExcelWorkbookConfig {
  filename: string
  organizationName?: string
  sheets: ExcelSheetConfig[]
}

export function generateExcelWorkbook(config: ExcelWorkbookConfig): Buffer
```

**Key Features:**
1. **Dynamic Column Widths:** Computes max length of contents per column with minimum and maximum clamps (e.g. 12 to 45 chars).
2. **Cell Formatting:** Distinguishes string labels (left), currencies/totals (right), quantities (right), and dates (centered).
3. **Executive Summary Header:** Embeds organization name, branch name, report date/period, and generation timestamp in top rows.
4. **Multi-Sheet Support:** Generates workbooks with "Executive Summary" sheet + "Detailed Ledger" sheet.

### 4.3 Period Resolver (`src/lib/reports/report-params.ts`)

```typescript
export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom'

export function parseReportPeriod(query: Record<string, string | undefined>): {
  period: ReportPeriod
  startDate: Date
  endDate: Date
  label: string
}
```
- `'daily'`: `startOfDay(now)` to `endOfDay(now)`.
- `'weekly'`: `startOfWeek(now, { weekStartsOn: 1 })` to `endOfWeek(now, { weekStartsOn: 1 })` (or last 7 days).
- `'monthly'`: `startOfMonth(now)` to `endOfMonth(now)`.
- `'custom'`: Parsed via `startDate` and `endDate` query parameters.

### 4.4 Worker Thread Resilience Strategy
- Update `reporting-worker-bridge.ts` to implement:
  ```typescript
  function getReportingWorkerPath(): string {
    const candidates = [
      path.resolve(process.cwd(), 'src/lib/reports/workers/reporting-analytics.worker.js'),
      path.resolve(__dirname, 'workers/reporting-analytics.worker.js'),
      path.resolve(__dirname, 'reporting-analytics.worker.js'),
      path.resolve(process.cwd(), '.next/server/reporting-analytics.worker.js'),
      path.resolve(process.cwd(), '.next/server/chunks/reporting-analytics.worker.js'),
    ]
    for (const c of candidates) if (existsSync(c)) return c
    return candidates[0]
  }
  ```
- Sanitize payload with recursive Decimal stripping before `worker.postMessage(...)`.

---

## 5. Verification Method

1. **Automated Unit Tests:**
   Run Jest unit test suite for reports:
   ```powershell
   npx jest --selectProjects unit src/app/api/reports/ src/lib/reports/
   ```
2. **Excel Format & Structure Validation:**
   Write a unit test `src/lib/reports/__tests__/excel-export-service.test.ts` that:
   - Generates daily, weekly, and monthly workbooks.
   - Passes the generated `Buffer` into `XLSX.read(buffer, { type: 'buffer' })`.
   - Verifies sheets count, sheet names, header rows, column count, and cell values.
   - Verifies the buffer header starts with the standard ZIP magic bytes for `.xlsx` (`PK\x03\x04`).
3. **API Route Verification:**
   Verify `GET /api/reports/export?reportType=sales&period=daily` returns HTTP 200 with headers:
   - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
   - `Content-Disposition: attachment; filename="sales_report_daily_*.xlsx"`
4. **Invalidation Conditions:**
   - Any report download producing `.xml` or `.csv`.
   - Unhandled `DataCloneError` in worker thread when processing Prisma decimals.
   - Main thread UI blocking during heavy report export.
