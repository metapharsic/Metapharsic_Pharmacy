# Project: Purchase Bill Scanning, Automated Extraction, Interactive Review & Inventory Provisioning

## Architecture
- **Framework & Runtime**: Next.js 14.2.5 (App Router), React 18.3.1, TypeScript 5.5.4, Prisma ORM 5.17.0 (PostgreSQL), Jest 29.7.0.
- **Document Ingestion & Multi-Tier Extraction Engine**:
  - `src/lib/scanner/purchase-bill-parser.ts`: Multi-tier document parser coordinating vector PDF extraction (`pdf-parse`), cloud vision AI (`gemini-2.5-flash`), local offline OCR (`sharp` + `tesseract.js`), and deterministic test mock fixtures.
  - `src/lib/scanner/pharma-invoice-heuristics.ts`: Domain pattern matching for Indian wholesale invoices: 15-character statutory GSTIN (`\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}`), Drug License numbers (20B/21B), invoice numbers, dates (`parsePharmaDate` normalizing to month-end calendar dates), line item tabular layouts, and mathematical cross-reconciliation.
  - `src/lib/scanner/entity-matcher.ts`: Hierarchical fuzzy matching for suppliers (GSTIN -> DL -> Trigram name similarity) and medicines (dosage/pack normalization -> Barcode/SKU -> Trigram brand similarity).
  - `src/app/api/purchases/scan/route.ts`: Multipart document upload endpoint returning parsed preview JSON with confidence metrics and reconciliation status.
- **Inventory Provisioning & Persistence Engine**:
  - `src/lib/purchases/purchase-provisioning-service.ts`: Atomic `prisma.$transaction` executing:
    1. Supplier resolution / creation
    2. Purchase record persistence (`status: 'RECEIVED'`, financial decimals)
    3. PurchaseItem persistence (billed quantity, free bonus quantity, rates, taxes)
    4. Collision-safe `Batch.upsert` on `@@unique([productId, batchNumber])` with quantity increment by `billedQuantity + freeQuantity` and reactivation from `EXHAUSTED` to `ACTIVE`
    5. Concurrency-safe CAS `Inventory` increment on `@@unique([productId, branchId])`
    6. Audit trail logging in `InventoryMovement` (`type: 'IN'`, `referenceType: 'PURCHASE'`)
    7. Accounts payable credit liability posting in `SupplierLedger` and `Supplier.outstandingBalance`
    8. Input Tax Credit (ITC) generation in `GstTransaction`
    9. Security `AuditLog` entry recording.
  - `src/app/api/purchases/scan/commit/route.ts`: Secure confirmation endpoint strictly enforcing user confirmation before modifying database or inventory.
- **Interactive Review UI Layer**:
  - `src/app/(dashboard)/purchases/scan/page.tsx`: Dedicated full-workspace review page.
  - `src/components/purchases/bill-scanner/`:
    - `purchase-bill-scanner-view.tsx`: Master coordinator managing upload state, document preview, and review form.
    - `document-upload-zone.tsx`: Drag-and-drop file upload supporting PDF, PNG, and JPEG.
    - `document-preview-pane.tsx`: Zoom (50%-300%), pan, rotate, and multi-page PDF navigation.
    - `bill-metadata-form.tsx`: Header metadata editing (Supplier, Invoice #, Date, Branch).
    - `line-items-review-table.tsx`: Dynamic editable table with `SearchableSelect` fuzzy medicine search.
    - `line-item-row-editor.tsx`: Live recalculation of line totals, discounts, taxes, and confidence badges.
    - `bill-summary-footer.tsx`: Financial summary with discrepancy warnings.
    - `bill-confirmation-dialog.tsx`: Explicit confirmation barrier modal showing quantitative summary before commit.
- **Testing & Verification Layer**:
  - Deterministic fixture mock engine enabling sub-second unit and integration test runs.
  - 4-Tier test suite verifying document ingestion, OCR parsing, interactive review form, confirmation safety barrier, and atomic inventory provisioning.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | PDF Text Stream Extraction Engine | Pure-JS `pdf-parse` direct text extraction for digital vector distributor PDFs (15–50ms) | M1 | survey_3 |
| 2 | Image Preprocessing & OCR Fallback | Sharp normalization and Tesseract.js worker offloading for scanned/image bills | M1 | survey_3 |
| 3 | Deterministic Mock Ingestion Engine | Zero-network, fixture-based parsing engine for CI/test runs | M1 | survey_3 |
| 4 | Indian Wholesale Pharma Header Parser | Regex and layout heuristics for 15-char GSTIN, Form 20B/21B DL, invoice #, and dates | M1 | survey_3 |
| 5 | Tabular Line Item Parser | Column offset detection for description, pack, batch #, expiry, billed qty, free qty, PTR, MRP, disc %, GST slabs | M1 | survey_3 |
| 6 | Pharma Expiry Date Normalizer | Resolves MM/YY, MM/YYYY, MMM-YY into last day of month | M1 | survey_1, survey_3 |
| 7 | GST & Math Cross-Reconciliation | Taxable + Tax - Disc ± RoundOff == Grand Total verification | M1 | survey_3 |
| 8 | Supplier Entity Resolution | GSTIN (100%) -> DL (95%) -> Trigram name similarity | M1 | survey_1, survey_3 |
| 9 | Product Entity Resolution | Clean dosage/pack tokens -> Barcode/SKU -> Trigram similarity | M1 | survey_1, survey_3 |
| 10 | Document Scan API Route | `POST /api/purchases/scan` handling multipart uploads with Zod validation | M1 | survey_2, survey_3 |
| 11 | Transactional Provisioning Service | `purchase-provisioning-service.ts` executing atomic `prisma.$transaction` | M2 | survey_1 |
| 12 | Purchase Bill Record Persistence | Persist `Purchase` (status: `RECEIVED`) and `PurchaseItem` records | M2 | survey_1 |
| 13 | Collision-Safe Batch Upsert | `tx.batch.upsert` on `(productId, batchNumber)` with quantity increment and reactivation | M2 | survey_1 |
| 14 | Free Quantity Bonus Stock Provisioning | Provision `billedQuantity + freeQuantity` into usable inventory | M2 | survey_1 |
| 15 | CAS Branch Inventory Increments | Concurrency-safe `Inventory` update on `(productId, branchId)` | M2 | survey_1 |
| 16 | Inventory Movement Audit Logging | Log `InventoryMovement` with `type: 'IN'`, `referenceType: 'PURCHASE'` | M2 | survey_1 |
| 17 | Accounts Payable Ledger Posting | Post `SupplierLedger` credit liability and update outstanding balance | M2 | survey_1 |
| 18 | Input Tax Credit (ITC) GST Posting | Post `GstTransaction` records via `postGstTransactionForPurchase` | M2 | survey_1 |
| 19 | Bill Confirmation API Route | `POST /api/purchases/scan/commit` with auth and Zod validation | M2 | survey_1, survey_2 |
| 20 | Document Upload Dropzone Component | Drag-and-drop & file picker supporting PDF, PNG, JPEG up to 15MB | M3 | survey_2 |
| 21 | Scanning Progress Card | Animated multi-stage progress indicator with extraction status | M3 | survey_2 |
| 22 | Document Preview Pane | Left pane with zoom, pan, rotate, and multi-page PDF navigation | M3 | survey_2 |
| 23 | Structured Bill Metadata Form | Top section with supplier selection, invoice #, date, and branch | M3 | survey_2 |
| 24 | Line Items Review Table | Right pane editable table with `SearchableSelect` fuzzy medicine matching | M3 | survey_2 |
| 25 | Line Item Row Editor & Dynamic Math | Real-time line item recalculations, confidence badges, short-expiry warnings | M3 | survey_2 |
| 26 | Bill Summary Footer & Math Alert | Subtotal, tax breakdown, discount, roundoff, and variance alert | M3 | survey_2 |
| 27 | Explicit Confirmation Barrier Modal | Non-bypassable `AlertDialog` safety barrier before saving or modifying stock | M3 | survey_2 |
| 28 | Purchases Navigation Integration | "Scan Purchase Bill" trigger on `/purchases` and dedicated `/purchases/scan` page | M3 | survey_2 |
| 29 | Requirement-Driven E2E Test Suite | 4-tier test suite verifying end-to-end bill scanning, parsing, review, confirmation barrier, database persistence, and inventory stock increments | M4 | original_request |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Ingestion & Document Parsing Pipeline | Document ingestion API, 4-tier hybrid extraction engine, Indian pharmacy invoice heuristics, date normalizer, math reconciler, entity resolution service | none | DONE |
| M2 | Inventory Provisioning & Persistence Engine | Transactional confirmation service, `POST /api/purchases/scan/commit`, batch upsert with `@@unique` safety, CAS inventory updates, movement logs, supplier ledger, GST ITC | none | DONE |
| M3 | Dual-View Interactive Review UI | Split dual-view workspace (`/purchases/scan`), zoomable preview pane, editable structured review form, fuzzy medicine select, dynamic line items grid, confirmation barrier modal | M1, M2 | DONE |
| M4 | Dual-Track Acceptance & Verification | Comprehensive 4-tier requirement-driven test suite (Tiers 1–4), end-to-end verification, regression testing, and forensic audit | M1, M2, M3 | DONE |

---

## Interface Contracts

### `POST /api/purchases/scan` (Document Scan Ingestion Contract)
```typescript
export interface ExtractedSupplier {
  rawName: string
  matchedSupplierId?: string
  gstin?: string
  dlNumber?: string
  matchConfidence: number // 0.0 - 1.0
  isNew: boolean
}

export interface ExtractedLineItem {
  id: string
  rawDescription: string
  matchedProductId?: string
  matchedProductName?: string
  matchConfidence: number
  isNewProduct: boolean
  packSize?: string
  hsnCode?: string
  batchNumber: string
  expiryDate: string // ISO YYYY-MM-DD (normalized to month-end)
  billedQuantity: number
  freeQuantity: number
  unitCost: number // PTR
  mrp: number
  discountPercent: number
  taxPercent: number
  taxAmount: number
  totalAmount: number
}

export interface ExtractedFinancials {
  subtotal: number
  taxAmount: number
  discountAmount: number
  roundOff: number
  totalAmount: number
  isReconciled: boolean
  reconciliationVariance: number
}

export interface ScanBillResponse {
  success: boolean
  confidence: number
  document: {
    filename: string
    mimeType: string
    pageCount: number
  }
  extractedData: {
    supplier: ExtractedSupplier
    invoice: {
      invoiceNumber: string
      invoiceDate: string
      dueDate?: string
    }
    items: ExtractedLineItem[]
    financials: ExtractedFinancials
  }
}
```

### `POST /api/purchases/scan/commit` (Confirmation & Provisioning Contract)
```typescript
export interface ConfirmPurchaseBillItemInput {
  productId: string
  batchNumber: string
  expiryDate: string // YYYY-MM-DD
  billedQuantity: number
  freeQuantity?: number
  unitCost: number
  mrp: number
  ptr?: number
  discountPercent?: number
  taxPercent?: number
  taxAmount?: number
  totalAmount: number
}

export interface ConfirmPurchaseBillInput {
  branchId: string
  supplierId?: string
  newSupplier?: {
    name: string
    gstin?: string
    dlNumber?: string
    phone?: string
    address?: string
  }
  invoiceNumber: string
  invoiceDate: string
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  notes?: string
  items: ConfirmPurchaseBillItemInput[]
}

export interface ConfirmPurchaseBillResult {
  success: boolean
  purchaseId: string
  purchaseNumber: string
  totalItemsProvisioned: number
  totalUnitsAdded: number
  totalAmount: number
  status: 'RECEIVED'
}
```

---

## Code Layout
- `src/lib/scanner/purchase-bill-parser.ts`: Main document parsing orchestrator (Tier 1-4 hybrid engine).
- `src/lib/scanner/pharma-invoice-heuristics.ts`: Regex patterns for Indian pharma GSTIN, DL, dates, tabular items, and math reconciliation.
- `src/lib/scanner/entity-matcher.ts`: Fuzzy matching service for suppliers and medicines.
- `src/lib/scanner/mock-bill-fixtures.ts`: Deterministic invoice fixtures for CI test runs.
- `src/app/api/purchases/scan/route.ts`: Document scan API route.
- `src/lib/purchases/purchase-provisioning-service.ts`: Atomic transactional purchase confirmation & inventory provisioning service.
- `src/app/api/purchases/scan/commit/route.ts`: Bill confirmation API route.
- `src/app/(dashboard)/purchases/scan/page.tsx`: Dedicated purchase bill scanning review page.
- `src/components/purchases/bill-scanner/purchase-bill-scanner-view.tsx`: Master interactive review view.
- `src/components/purchases/bill-scanner/document-upload-zone.tsx`: Drag-and-drop upload component.
- `src/components/purchases/bill-scanner/document-preview-pane.tsx`: Document preview pane with zoom/pan/rotate.
- `src/components/purchases/bill-scanner/bill-metadata-form.tsx`: Header metadata editor.
- `src/components/purchases/bill-scanner/line-items-review-table.tsx`: Line items table with fuzzy search.
- `src/components/purchases/bill-scanner/line-item-row-editor.tsx`: Row editor with dynamic calculation.
- `src/components/purchases/bill-scanner/bill-summary-footer.tsx`: Financial summary & discrepancy alert.
- `src/components/purchases/bill-scanner/bill-confirmation-dialog.tsx`: Explicit confirmation barrier modal.
- `src/lib/scanner/__tests__/purchase-bill-parser.test.ts`: Parser and heuristics unit tests.
- `src/lib/purchases/__tests__/purchase-provisioning.test.ts`: Provisioning service integration tests.
- `src/app/api/purchases/scan/__tests__/scan-routes.test.ts`: Scan & commit route tests.
- `src/components/purchases/bill-scanner/__tests__/bill-scanner.test.tsx`: UI component tests.
- `src/__tests__/e2e/purchase-bill-scanning-e2e.test.ts`: End-to-end acceptance tests.
