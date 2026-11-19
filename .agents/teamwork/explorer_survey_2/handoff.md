# Purchase UI and Flow Explorer — Comprehensive Survey & Architecture Report

**Explorer**: Explorer 2 (Purchase UI and Flow Explorer)  
**Date**: 2026-11-03  
**Working Directory**: `c:\metapharsic-pharmacy-complete\.agents\teamwork\explorer_survey_2`  
**Target Domain**: Purchase Bill Scanning, Automated Data Extraction, Dual-View Interactive Review UI, and Safe Inventory Provisioning  

---

## 1. Observation

### 1.1 Existing Purchase Route Structure and Pages

A thorough audit of `src/app/(dashboard)/purchases/` reveals the following route hierarchy and components:

1. **`src/app/(dashboard)/purchases/page.tsx` (Purchase Management Suite)**:
   - Server Component checking permissions `can(PERMISSIONS.PURCHASES_READ)` and session.
   - Fetches paginated purchases using `listPurchases(defaultQuery, session.user)` from `@/lib/purchases/purchase-service`.
   - Header buttons:
     - `Agency & Distributor Bills` linking to `/purchases/agency` with icon `<Building2 className="h-4 w-4 text-primary" />`.
     - `New Purchase Order` linking to `ROUTES.PURCHASES_NEW` (`/purchases/new`) with icon `<Plus className="h-4 w-4" />`.
   - Renders `<PurchasesView initialRows={initialRows} initialPagination={firstPage.pagination} />`.

2. **`src/components/purchases/purchases-view.tsx` & `purchase-lifecycle-tabs.tsx`**:
   - Manages a 10-stage procurement lifecycle:
     - Stage 0: `overview` (Pipeline Overview & Ageing)
     - Stage 1: `requisitions` (Purchase Requisitions with Auto-Reorder)
     - Stage 2: `quotations` (Supplier Quotation Comparison Matrix)
     - Stage 3: `orders` (Purchase Orders & Commitments)
     - Stage 4: `receipts` (Goods Receipt Dock & GRN Inspection)
     - Stage 5: `invoices` (3-Way Matching: PO vs GRN vs Bill)
     - Stage 6: `payments` (Accounts Payable & Ledger)
     - Stage 7: `agencies` (Distributor Bills & Statements)
     - Stage 8: `returns` (Purchase Returns & Debit Notes)
     - Stage 9: `suppliers` (Supplier Master Profiles)
   - Features existing modal integrations:
     - `<NewPurchaseOrderDialog />`
     - `<AdvancedGrnModal />`
     - `<ThreeWayMatchModal />`
     - `<AutoPoModal />`

3. **`src/app/(dashboard)/purchases/new/page.tsx` (Purchase Order Creation Form)**:
   - Client component with four structured sections:
     - **Section A: Order details**: Supplier selection (`SearchableSelect`), Statutory Gate License check (`ShieldCheck` / `ShieldAlert`), Branch selector, PO Date, Expected Delivery, Payment Terms.
     - **Section B: Order items**: Line items array, medicine search (`SearchableSelect`), Quantity, Purchase Unit, Rate per unit (PTR), Discount %, GST % (0, 5, 12, 18, 28), Free Quantity, effective rate footnote.
     - **Section C: Additional charges and schemes**: Freight/shipping charges, Supplier Trade Schemes (`10+1 Free Goods`, `20+2 Free Goods`, `5% Cash Settlement Discount`), Delivery notes.
     - **Section D: Order summary**: Taxable amount, Estimated GST, Freight, Estimated PO total, Validation Report (`CheckCircle2` / `AlertCircle`), Draft Data copy, Submit.

4. **`src/app/(dashboard)/purchases/[id]/page.tsx` & `src/app/(dashboard)/purchases/[id]/receive/page.tsx`**:
   - `[id]/page.tsx`: Status badges (`DRAFT`, `ORDERED`, `SENT`, `PARTIALLY_RECEIVED`, `RECEIVED`, `INVOICED`, `CANCELLED`). Action buttons for `Receive Goods (GRN)` and `Return to Vendor`.
   - `[id]/receive/page.tsx`: Goods Receipt Note form using React Hook Form + Zod (`createGrnSchema`). Binds batch number, expiry date, manufacturing date, purchase price, MRP, cold chain temperature log (`2-8°C`), and QC pass/fail.

5. **`src/app/(dashboard)/purchases/agency/page.tsx` & `src/components/purchases/agency-purchases-view.tsx`**:
   - Organizes purchase bills by distributor agency, displays invoice numbers, invoice dates, amounts, item-level batch snapshots, credit limits, and outstanding balances.

6. **`src/components/scanner/ai-strip-scanner-modal.tsx` (Existing Optical AI Scanning Architecture)**:
   - Already implements multi-threaded scanning, camera stream acquisition, image/photo upload (`FileReader` data URL -> base64), optical analysis via `/api/inventory/scan/camera-frame`, and direct inventory ingestion via `/api/inventory/scan/commit`.
   - Employs audio cues (`playBarcodeBeep`, `playBarcodeErrorSound`), Sonner toasts, and preview states.

---

### 1.2 Form Handling, Validation, and Component Libraries

- **Form Framework**: React Hook Form (`react-hook-form` v7.52.2) combined with `@hookform/resolvers/zod` (v3.9.0) and Zod (v3.23.8). Used extensively with `useForm`, `useWatch`, and `useFieldArray`.
- **UI Components & Radix Primitives**:
  - Dialogs: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` (`@radix-ui/react-dialog` via `src/components/ui/dialog.tsx`).
  - Alert Dialogs & Confirmation: `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogHeader` (`@radix-ui/react-alert-dialog` via `src/components/ui/alert-dialog.tsx`).
  - Dropdown & Selection: `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` (`src/components/ui/select.tsx`).
  - Popovers & Dropdowns: `Popover`, `PopoverContent`, `PopoverTrigger` (`@radix-ui/react-popover`).
  - Tabs: `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` (`@radix-ui/react-tabs`).
  - Cards & Badges: `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Badge` (`src/components/ui/card.tsx`, `src/components/ui/badge.tsx`).
  - Tables: `Table`, `TableHeader`, `TableHead`, `TableRow`, `TableBody`, `TableCell` (`src/components/ui/table.tsx`).
- **Fuzzy Search Component**:
  - `src/components/ui/searchable-select.tsx`:
    - Accepts `options: SearchableSelectOption[]` (`value`, `label`, `sublabel`, `badge`, `badgeVariant`, `keywords`).
    - Internal input searches against `label`, `sublabel`, `badge`, and `keywords`.
    - Supports `allowCustom` for entering non-catalog items.
- **Confirmation Barrier**:
  - `src/components/shared/confirmation-dialog.tsx`: Global modal wired to `src/lib/stores/ui-store.ts` (`openConfirmDialog()`), ensuring destructive or irreversible state modifications require user affirmation.
- **Notifications**: Sonner (`sonner` v1.5.0) and Radix toast via `src/lib/hooks/use-toast.ts`.

---

### 1.3 Database Models & Inventory Ingestion (Prisma Schema)

Direct inspection of `prisma/schema.prisma` shows how purchases and inventory are structured:

1. **`model Purchase`**:
   - `id`: CUID
   - `purchaseNumber`: String (unique identifier, e.g. `PO-1730634123456`)
   - `branchId`: Foreign key to `Branch`
   - `supplierId`: Foreign key to `Supplier`
   - `invoiceNumber`: String? (Distributor bill/invoice number)
   - `invoiceDate`: DateTime?
   - `purchaseDate`: DateTime (default now)
   - `status`: `PurchaseStatus` (`DRAFT`, `ORDERED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `INVOICED`, `CANCELLED`)
   - `subtotal`, `discountAmount`, `taxAmount`, `totalAmount`, `amountPaid`, `balanceDue`: Decimal(12, 2)
   - `notes`: Text?
   - `receivedAt`: DateTime?
   - `createdById`: Foreign key to `User`

2. **`model PurchaseItem`**:
   - `purchaseId`: Foreign key to `Purchase`
   - `productId`: Foreign key to `Product`
   - `batchId`: Foreign key to `Batch` (optional link)
   - `orderedQuantity`: Int
   - `receivedQuantity`: Int
   - `freeQuantity`: Int (default 0)
   - `unitCost`: Decimal(12, 2)
   - `mrp`: Decimal(12, 2)
   - `ptr`: Decimal(12, 2)?
   - `discountPercent`: Decimal(5, 2)
   - `taxPercent`: Decimal(5, 2)
   - `taxAmount`: Decimal(12, 2)
   - `totalAmount`: Decimal(12, 2)
   - `batchNumber`: String?
   - `expiryDate`: DateTime?
   - `manufacturingDate`: DateTime?

3. **`model Batch`**:
   - `productId`, `batchNumber`, `manufacturingDate`, `expiryDate`, `purchasePrice`, `ptr`, `mrp`, `quantity`, `reservedQuantity`, `soldQuantity`, `status` (`ACTIVE`, `BLOCKED`, `EXPIRED`, `DISPOSED`, `EXHAUSTED`), `purchaseId`, `branchId`.

4. **`model Inventory` & `model InventoryMovement`**:
   - `Inventory`: unique on `(productId, branchId)`, tracks `totalQuantity` and `availableQuantity`.
   - `InventoryMovement`: tracks `type: 'IN'`, `quantity`, `quantityBefore`, `quantityAfter`, `referenceType: 'PURCHASE'`, `referenceId`, `batchId`.

---

### 1.4 Existing UI / Component Test Patterns

Inspection of existing tests in `src/components/products/product-import-dialog.test.tsx` and `src/components/inventory/__tests__/dead-stock-view.test.tsx` confirms:
- Jest runner with `jest-environment-jsdom`.
- Testing Library (`@testing-library/react`): `render`, `screen`, `waitFor`, `fireEvent`.
- Mocking of global `fetch`, `next/navigation` (`useRouter`, `useSearchParams`), and `useToast` / `sonner`.
- Verification of disabled states, file input change events, error alert display, and user interactions.

---

## 2. Logic Chain

1. **User Requirement & Problem Definition**:
   The pharmacy application requires automated purchase bill scanning from photo/document uploads (PDF, PNG, JPEG), optical parsing of distributor bills, an interactive review interface to inspect and correct extracted data side-by-side with the uploaded bill, and a safe confirmation barrier before automatically provisioning inventory batches and stock levels.

2. **UI Architecture Placement**:
   - To provide seamless access without cluttering the existing workflow, the Bill Scanner should be accessible from two high-traffic procurement gateways:
     1. The primary **Purchase Management Suite** (`/purchases`): a prominent button **"Scan Purchase Bill"** next to "New Purchase Order".
     2. The **Agency & Distributor Bills** view (`/purchases/agency`): a **"Scan & Ingest Invoice"** button.
     3. A dedicated interactive workspace view at `/purchases/scan` (with responsive full-screen modal fallback `PurchaseBillScannerModal.tsx`), accommodating the high-density dual-view inspection requirements.

3. **Multi-Step Interactive Flow**:
   - **Step 1: Ingestion & Drag-and-Drop Dropzone**:
     - Users drag or select PDF, PNG, or JPEG files.
     - Client validates MIME type and file size (up to 15MB).
     - Generates instant client-side object URL for live image/PDF rendering.
   - **Step 2: Processing & Feedback Stage**:
     - Visual stepper/progress bar (`Uploading` -> `OCR Processing` -> `Entity Extraction` -> `Catalog Matching`).
     - Real-time progress percentage and status notifications.
     - Immediate failure fallback with descriptive error alerts if OCR cannot detect bill content.
   - **Step 3: Split Dual-View Review Interface**:
     - Left pane (45% width): High-performance document viewer (zoom, pan, multi-page PDF navigation, page rotation).
     - Right pane (55% width): Editable structured review form organized into Bill Metadata (Supplier, Invoice #, Invoice Date, Branch) and Line Items Table.
   - **Step 4: Fuzzy Medicine Matching & Inline Catalog Resolution**:
     - For each line item extracted by OCR, the system runs fuzzy text matching against `Product` records (using `SearchableSelect`).
     - Matches display confidence badges (e.g. `98% Match: Augmentin 625 Duo`).
     - Unrecognized medicines trigger an inline "Add New Product" quick drawer or allow manual search/selection.
   - **Step 5: Dynamic Arithmetic & Statutory Compliance**:
     - Each line item auto-calculates: Subtotal, Discounted Taxable Base, GST Amount (0/5/12/18/28%), and Line Total.
     - Summary bar compares **Computed Total** vs **Extracted Bill Total** to flag any math discrepancies or rounding variances.
     - Expiry validation flags any batch with expiry date less than 6 months from today.
   - **Step 6: Explicit Confirmation Barrier**:
     - Clicking "Commit & Provision Stock" triggers an `AlertDialog` confirmation barrier.
     - Shows an executive summary (Supplier, Invoice #, Total Items, Total Stock Units Added, Total Value).
     - Explains the irreversible consequences (stock increments, batch creation, audit log).
     - Requires explicit confirmation to commit.
   - **Step 7: Atomic Database Provisioning**:
     - Submits payload to `/api/purchases/scan/commit`.
     - Transactionally creates `Purchase`, `PurchaseItem`, `Batch`, updates `Inventory` via CAS, logs `InventoryMovement`, and logs `AuditLog`.

---

## 3. Detailed Proposed UI Architecture & Components

### 3.1 Component Directory Structure

The new purchase bill scanning UI will be encapsulated in modular components under `src/components/purchases/bill-scanner/`:

```
src/components/purchases/bill-scanner/
├── purchase-bill-scanner-view.tsx       # Main dual-view interactive review container
├── document-upload-zone.tsx             # Drag-and-drop dropzone supporting PDF, PNG, JPEG
├── scanning-progress-card.tsx           # Multi-stage parsing progress & status banner
├── document-preview-pane.tsx            # Left pane: PDF/image viewer with zoom, pan, rotate
├── bill-metadata-form.tsx               # Top section: Supplier, Invoice #, Date, Branch
├── line-items-review-table.tsx          # Right pane table: Item rows, fuzzy medicine select, batches, rates
├── line-item-row-editor.tsx             # Individual editable line item with math recalculation
├── bill-summary-footer.tsx              # Summary calculations, discrepancy checks, action buttons
├── bill-confirmation-dialog.tsx         # Safety barrier modal before inventory provisioning
└── types.ts                             # TypeScript interfaces for OCR extraction and review state
```

---

### 3.2 State Flow Diagram

```
[ User Lands on /purchases or /purchases/scan ]
                      │
                      ▼
┌──────────────────────────────────────────────┐
│        1. Document Upload Zone               │
│   (Drag & Drop / File Input / Mobile Cam)    │
│   Accepts: image/jpeg, image/png, application/pdf
└──────────────────────────────────────────────┘
                      │ File selected
                      ▼
┌──────────────────────────────────────────────┐
│        2. Document Ingestion & OCR           │
│   - Generate Client Object URL Preview       │
│   - Send Multipart/Base64 to Scan API        │
│   - Progress: Uploading -> OCR -> Extracting │
└──────────────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │ Success                   │ Parsing Failed
        ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│ 3. Dual-View Review UI    │ │ Error Alert Banner        │
│ ┌───────────┬───────────┐ │ │ - "Could not read bill"   │
│ │ Document  │ Editable  │ │ │ - Retry or Manual Input   │
│ │ Preview   │ Form      │ │ └───────────────────────────┘
│ │ (PDF/Img) │ - Vendor  │ │
│ │ Zoom/Pan  │ - Items   │ │
│ └───────────┴───────────┘ │
└───────────────────────────┘
              │ User inspects & edits:
              ├─ Fuzzy medicine matching (SearchableSelect)
              ├─ Corrects batch #, expiry date, quantities
              ├─ Edits rate, discount %, GST slab
              └─ Cross-checks total vs document preview
              │
              ▼
┌──────────────────────────────────────────────┐
│ 4. Validation & Pre-Commit Check             │
│ - Math reconciliation (Computed vs Extracted)│
│ - Expiry validation (min 6 months)           │
│ - Required fields complete (Supplier, Batch) │
└──────────────────────────────────────────────┘
              │ Click "Commit & Provision"
              ▼
┌──────────────────────────────────────────────┐
│ 5. Explicit Confirmation Barrier (Modal)     │
│ - Summary: Supplier, Invoice #, Qty, Total ₹ │
│ - Warning: Updates live inventory & batches  │
│ - Action: "Confirm & Update Live Stock"      │
└──────────────────────────────────────────────┘
              │ User confirms
              ▼
┌──────────────────────────────────────────────┐
│ 6. Backend Atomic Provisioning               │
│ - POST /api/purchases/scan/commit            │
│ - DB Transaction: Purchase + Batches + Stock │
│ - InventoryMovements + AuditLog recorded     │
└──────────────────────────────────────────────┘
              │ Success
              ▼
┌──────────────────────────────────────────────┐
│ 7. Success State & Navigation                │
│ - Sonner Toast: "Invoice [X] provisioned!"   │
│ - Redirect to /purchases/[id] or /inventory  │
└──────────────────────────────────────────────┘
```

---

### 3.3 TypeScript Data Contracts (`types.ts`)

```typescript
export interface ExtractedBillItem {
  tempId: string
  rawText: string
  productId?: string
  productName: string
  matchedProductSku?: string
  matchConfidence: number // 0 to 100
  isNewProductCandidate?: boolean
  batchNumber: string
  expiryDate: string // YYYY-MM-DD
  manufacturingDate?: string
  quantity: number
  freeQuantity: number
  unitCost: number
  mrp: number
  discountPercent: number
  taxPercent: number
  hsnCode?: string
  storageRack?: string
  storageBox?: string
  lineTaxableAmount: number
  lineTaxAmount: number
  lineTotalAmount: number
  validationErrors?: string[]
}

export interface ExtractedBillData {
  supplierName?: string
  supplierGstin?: string
  supplierDlNumber?: string
  matchedSupplierId?: string
  invoiceNumber: string
  invoiceDate: string // YYYY-MM-DD
  branchId: string
  paymentTerms?: string
  notes?: string
  rawExtractedTotal?: number
  items: ExtractedBillItem[]
  ocrConfidence: number
  documentType: 'PDF' | 'IMAGE'
  fileUrl: string
  fileName: string
}
```

---

### 3.4 Key Interactive Features & UI Components

#### Feature 1: Document Upload Zone (`document-upload-zone.tsx`)
- Drag-and-drop zone using standard HTML5 drag events (`onDragOver`, `onDragLeave`, `onDrop`) with Tailwind dash-borders (`border-2 border-dashed`).
- File input accepting `accept=".pdf,image/png,image/jpeg,image/jpg"`.
- Displays file metadata (Name, Size, Type, Page count if PDF).
- Camera capture toggle for pharmacy counter tablets.

#### Feature 2: Scanning & Parsing Feedback (`scanning-progress-card.tsx`)
- Progress bar (`@radix-ui/react-progress` with smooth CSS animation).
- Multi-step status indicator:
  1. File Upload (100%)
  2. OCR Text Recognition (Tesseract / Vision Worker)
  3. LLM / Regex Entity Extraction (Invoice #, Supplier, Date, Line Items)
  4. Catalog Fuzzy Matching (Matching against PostgreSQL `Product` and `Supplier` tables)
- Status badge indicating confidence level (`High Confidence > 85%`, `Moderate > 60%`, `Low < 60%`).

#### Feature 3: Split Dual-View Workspace (`document-preview-pane.tsx` & `line-items-review-table.tsx`)
- High-resolution split layout:
  - **Left Viewport (45%)**:
    - For images: Interactive Canvas / SVG wrapper with Zoom In (`+`), Zoom Out (`-`), Fit to Width, and 90° Rotate controls.
    - For PDFs: Native `<iframe>` / `<embed>` or PDF canvas renderer with multi-page navigation.
  - **Right Viewport (55%)**:
    - Scrollable structured review form with floating summary bar.
    - Vendor and Invoice metadata fields at the top.
    - Full editable items grid below.

#### Feature 4: Interactive Verification & Line Item Editor
- **Fuzzy Medicine Selector**:
  - Leverages existing `SearchableSelect` component.
  - Each extracted product row is pre-filtered. If an exact match is found, SKU, HSN, and GST are auto-bound.
  - If match confidence is < 70%, row highlights in soft amber (`bg-amber-500/10 border-amber-500/30`) with a `Review Match` badge.
  - Allows instant re-selection or "+ Create New Product" shortcut.
- **Batch & Expiry Controls**:
  - Batch number input auto-capitalizes (`uppercase font-mono font-bold`).
  - Expiry date input validates that the date is at least 6 months into the future.
- **Dynamic Arithmetic Recalculation**:
  - Modifying Quantity, PTR/Cost, Discount %, or GST % immediately updates line totals and triggers the summary bar recalculation.
  - Detects discrepancies between the sum of line items and the OCR bill total.

#### Feature 5: Explicit Confirmation Barrier (`bill-confirmation-dialog.tsx`)
- Built using `AlertDialog` (`src/components/ui/alert-dialog.tsx`) or `ConfirmationDialog`.
- Blocks immediate accidental commits.
- Highlights:
  - Supplier: `Apollo Pharmaceuticals Ltd`
  - Invoice: `INV-2026-9081` dated `03 Nov 2026`
  - Total Line Items: `12 items`
  - Total Stock Quantity: `240 units` (including `20 free goods units`)
  - Total Purchase Value: `₹28,450.00`
  - Receiving Branch: `Main Pharmacy Branch`
- Warning callout: *"Committing this purchase bill will immediately create 12 active batches and increase stock levels in the live inventory database. Ensure physical stocks match before confirming."*
- Checkbox requirement: `[x] I have verified all batch numbers, expiry dates, and rates against the physical invoice.`
- Confirm button: `Confirm & Ingest Stock` (styled in emerald green).

---

## 4. Caveats

1. **OCR Quality on Low-Resolution Invoices**: Poorly lit mobile phone captures, crumpled thermal receipts, or dot-matrix invoices can cause character misrecognitions (e.g., mistaking `0` for `O`, `1` for `I`, or misreading decimal points in MRP/Cost). The interactive review interface is deliberately designed as a **human-in-the-loop** verification barrier to catch and correct these before database persistence.
2. **Multi-Page PDFs**: Invoices spanning multiple pages require a page-switching control in the document preview pane and multi-page aggregation in the OCR parser.
3. **New Medicine Cataloging**: When a bill contains a newly launched formulation not yet registered in the pharmacy's `Product` master table, the UI must allow immediate creation of a new product with basic attributes (Name, SKU, MRP, GST) without abandoning the purchase bill scanning session.
4. **Scope Constraint**: As an Explorer, this investigation is read-only. No application source code has been altered.

---

## 5. Conclusion

The pharmacy application possesses a well-architected foundation for procurement and inventory:
1. Complete Prisma data model with `Purchase`, `PurchaseItem`, `Batch`, `Inventory`, and `InventoryMovement`.
2. Existing UI primitives (React Hook Form, Zod, Radix UI, `SearchableSelect`, `ConfirmationDialog`, Lucide icons).
3. Precedent multi-threaded optical scanning implementation in `ai-strip-scanner-modal.tsx`.
4. Robust component and integration testing patterns using Jest and React Testing Library.

Introducing purchase bill scanning via the proposed dual-view review UI at `/purchases/scan` (or via `PurchaseBillScannerModal`) provides the exact workflow requested: seamless document upload, real-time OCR parsing feedback, side-by-side verification with fuzzy medicine lookup, and an explicit safety barrier before atomic inventory provisioning.

---

## 6. Verification Method

To independently verify the frontend components, dependencies, and test patterns observed:

1. **Verify Existing Purchase Routes & Components**:
   - Inspect `src/app/(dashboard)/purchases/page.tsx`
   - Inspect `src/app/(dashboard)/purchases/new/page.tsx`
   - Inspect `src/components/purchases/purchases-view.tsx`
   - Inspect `src/components/purchases/agency-purchases-view.tsx`
   - Inspect `src/components/scanner/ai-strip-scanner-modal.tsx`

2. **Verify Shared UI Primitives**:
   - Inspect `src/components/ui/searchable-select.tsx`
   - Inspect `src/components/shared/confirmation-dialog.tsx`
   - Inspect `src/lib/stores/ui-store.ts`

3. **Verify Database Models & Services**:
   - Inspect `prisma/schema.prisma` lines 790–900 (`Purchase`, `PurchaseItem`, `Batch`)
   - Inspect `src/lib/purchases/purchase-service.ts` lines 310–390 (`createPurchase`), 550–740 (`createGrn`)

4. **Verify Test Suite Execution**:
   - Run unit tests: `npm run test:unit`
   - Inspect component test patterns: `src/components/products/product-import-dialog.test.tsx` and `src/components/inventory/__tests__/dead-stock-view.test.tsx`.
