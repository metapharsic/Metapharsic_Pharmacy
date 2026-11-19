# Handoff Report: Purchase Bill & Inventory Data Model Investigation

**Agent**: Explorer 1 (Purchase and Inventory Data Model Explorer)  
**Date**: 2026-11-03  
**Working Directory**: `c:\metapharsic-pharmacy-complete\.agents\teamwork\explorer_survey_1\`  
**Target Milestone**: Purchase Bill Scanning, Automated Extraction, Interactive Review & Inventory Provisioning  

---

## 1. Observation

Direct examination of the database schema, backend services, API routes, and test suites yielded the following verbatim findings, file paths, line numbers, and architectural patterns:

### 1.1 Prisma Schema Models & Constraints (`prisma/schema.prisma`)

#### `Purchase` (Lines 793–825)
- **Primary Key**: `id String @id @default(cuid())`
- **Unique Constraint**: `purchaseNumber String @unique` (e.g., format `PO-1730635400000`)
- **Foreign Keys**:
  - `branchId String` -> `branch Branch @relation(fields: [branchId], references: [id])`
  - `supplierId String` -> `supplier Supplier @relation(fields: [supplierId], references: [id])`
  - `createdById String` -> `createdBy User @relation("PurchaseCreatedBy", fields: [createdById], references: [id])`
- **Bill Metadata**:
  - `invoiceNumber String?` (distributor's printed tax invoice/bill number)
  - `invoiceDate DateTime?` (date printed on distributor bill)
  - `purchaseDate DateTime @default(now())`
  - `expectedDate DateTime?`
  - `receivedAt DateTime?`
- **Status Enum**: `status PurchaseStatus @default(DRAFT)`
  - Enum values (lines 827–834): `DRAFT`, `ORDERED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `INVOICED`, `CANCELLED`
- **Financial Totals (All Decimal(12, 2))**:
  - `subtotal Decimal @default(0)`
  - `discountAmount Decimal @default(0)`
  - `taxAmount Decimal @default(0)`
  - `totalAmount Decimal @default(0)`
  - `amountPaid Decimal @default(0)`
  - `balanceDue Decimal @default(0)`
  - `notes String? @db.Text`
- **Relations**: `items PurchaseItem[]`, `batches Batch[]`, `returns PurchaseReturn[]`
- **Indices**: `@@index([purchaseNumber])`, `@@index([supplierId])`, `@@map("purchases")`

#### `PurchaseItem` (Lines 836–861)
- **Primary Key**: `id String @id @default(cuid())`
- **Relations**:
  - `purchaseId String` -> `purchase Purchase @relation(fields: [purchaseId], references: [id], onDelete: Cascade)`
  - `productId String` -> `product Product @relation(fields: [productId], references: [id])`
  - `batchId String?` -> `batch Batch? @relation(fields: [batchId], references: [id])`
- **Quantities**:
  - `orderedQuantity Int` (in PO flow) / billed quantity (in invoice flow)
  - `receivedQuantity Int @default(0)`
  - `freeQuantity Int @default(0)` (Bonus goods scheme, e.g. 10+1 free)
- **Pricing & Tax**:
  - `unitCost Decimal @db.Decimal(12, 2)` (Purchase rate / PTR)
  - `mrp Decimal @db.Decimal(12, 2)` (Maximum retail price)
  - `ptr Decimal? @db.Decimal(12, 2)`
  - `discountPercent Decimal @default(0) @db.Decimal(5, 2)`
  - `taxPercent Decimal @default(0) @db.Decimal(5, 2)` (GST %: 0, 5, 12, 18, 28)
  - `taxAmount Decimal @default(0) @db.Decimal(12, 2)`
  - `totalAmount Decimal @db.Decimal(12, 2)`
- **Batch Tracking on Item**:
  - `batchNumber String?`
  - `expiryDate DateTime?`
  - `manufacturingDate DateTime?`

#### `Supplier` (Lines 1040–1070)
- **Fields**: `id String @id @default(cuid())`, `name String`, `contactPerson String?`, `phone String?`, `email String?`, `gstin String?`, `pan String?`, `dlNumber String?` (Drug License No.), `address String?`, `city String?`, `state String?`, `pincode String?`, `bankName String?`, `bankAccount String?`, `bankIfsc String?`, `creditDays Int @default(30)`, `outstandingBalance Decimal @default(0) @db.Decimal(12, 2)`, `isActive Boolean @default(true)`, `notes String?`.
- **Constraint / Index**: `@@index([name])`, `@@map("suppliers")`. Note: `gstin` is not marked unique in Prisma schema, but application code (`purchase-service.ts:107-114`) enforces uniqueness among active suppliers.

#### `Batch` (Lines 500–535)
- **Fields**:
  - `id String @id @default(cuid())`
  - `productId String` (foreign key)
  - `batchNumber String`
  - `manufacturingDate DateTime?`
  - `expiryDate DateTime` (REQUIRED NOT-NULL)
  - `dpcoCeiling Decimal? @db.Decimal(10, 2)`
  - `purchasePrice Decimal @db.Decimal(12, 2)` (REQUIRED NOT-NULL)
  - `ptr Decimal? @db.Decimal(12, 2)`
  - `pts Decimal? @db.Decimal(12, 2)`
  - `mrp Decimal @db.Decimal(12, 2)` (REQUIRED NOT-NULL)
  - `quantity Int @default(0)` (Usable current quantity in stock)
  - `reservedQuantity Int @default(0)`
  - `soldQuantity Int @default(0)`
  - `status BatchStatus @default(ACTIVE)` (ACTIVE, BLOCKED, EXPIRED, DISPOSED, EXHAUSTED)
  - `blockedReason String?`
  - `supplierRef String?`
  - `purchaseId String?`
  - `branchId String?`
- **Crucial Schema Constraint**:
  - `@@unique([productId, batchNumber])` (Line 531)
  - Indices: `@@index([productId, expiryDate])`, `@@index([expiryDate])`

#### `Inventory` (Lines 405–420)
- **Fields**:
  - `id String @id @default(cuid())`
  - `productId String`
  - `branchId String`
  - `totalQuantity Int @default(0)`
  - `reservedQuantity Int @default(0)`
  - `availableQuantity Int @default(0)`
  - `updatedAt DateTime @updatedAt`
- **Crucial Schema Constraint**:
  - `@@unique([productId, branchId])` (Line 418)

#### `InventoryMovement` (Lines 422–442)
- **Fields**:
  - `id String @id @default(cuid())`
  - `inventoryId String`
  - `type MovementType` (Enums: `IN`, `OUT`, `ADJUSTMENT`, `RETURN_IN`, `RETURN_OUT`, `TRANSFER`, `WRITE_OFF`)
  - `quantity Int`
  - `quantityBefore Int`
  - `quantityAfter Int`
  - `referenceType String?` (e.g. "PURCHASE", "GRN", "AI_STRIP_SCAN")
  - `referenceId String?` (Purchase ID or GRN number)
  - `batchId String?`
  - `notes String?`
  - `createdById String?`
  - `createdAt DateTime @default(now())`

#### `Product` (Lines 300–356)
- **Fields**: `id`, `name`, `genericName?`, `sku @unique`, `barcode? @unique`, `description?`, `manufacturer?`, `composition?`, `drugSchedule @default(NONE)`, `storageCondition?`, `isPrescriptionRequired @default(false)`, `unitOfMeasure @default("Strip")`, `tabsPerStrip? Int`, `packSize?`, `hsnCode?`, `gstRate Decimal @default(12.00)`, `cgstRate @default(6.00)`, `sgstRate @default(6.00)`, `igstRate @default(12.00)`, `mrp Decimal(12, 2)`, `costPrice Decimal(12, 2)?`, `rackId String?`, `minStockLevel Int @default(10)`, `reorderLevel Int @default(20)`.

#### `SupplierLedger` (Lines 1072–1088)
- **Fields**: `id`, `supplierId`, `type LedgerEntryType` (`DEBIT`, `CREDIT`), `amount Decimal(12, 2)`, `balance Decimal(12, 2)`, `referenceType String?`, `referenceId String?`, `description String`, `entryDate DateTime @default(now())`.

#### `GstTransaction` (Lines 1179–1206)
- **Fields**: `id`, `branchId`, `type GstTxType` (`B2B`, `B2C`, `NIL_RATED`), `referenceType String` (`SALE` or `PURCHASE`), `referenceId String`, `referenceLineId String`, `invoiceNumber String`, `invoiceDate DateTime`, `partyGstin String?`, `partyName String?`, `partyState String?`, `hsnCode String?`, `taxableAmount Decimal(12, 2)`, `cgstAmount Decimal(12, 2)`, `sgstAmount Decimal(12, 2)`, `igstAmount Decimal(12, 2)`, `totalTax Decimal(12, 2)`, `totalAmount Decimal(12, 2)`, `returnPeriod String?` ("MM-YYYY"), `isFiled Boolean @default(false)`.
- **Constraint**: `@@unique([referenceType, referenceId, referenceLineId])` (Line 1202).

---

### 1.2 Existing Backend Implementation Inspection

1. **`src/lib/purchases/purchase-service.ts`**:
   - `createPurchase` (lines 277–396): Creates PO header and `PurchaseItem` records in status `DRAFT` or `ORDERED`. Computes line discounts, taxes, and order totals. Does *not* increment stock or create batches.
   - `createGrn` (lines 548–747): Receives goods against an existing PO.
     - Performs expiry validation: `expiryDate < sixMonthsFromNow` triggers an error.
     - Creates `Batch` records with `tx.batch.create(...)`.
     - Updates `Inventory` with CAS check (`where: { id: inventory.id, updatedAt: inventory.updatedAt }`).
     - Logs `InventoryMovement` with `type: 'IN'`, `referenceType: 'GRN'`, `referenceId: command.purchaseId`.
     - Increments `purchaseItem.receivedQuantity`.
     - Updates PO status to `PARTIALLY_RECEIVED` or `RECEIVED`.
   - `threeWayMatch` (lines 839–919): Compares PO vs Invoice quantities and amounts with tolerance percent (default 2%).
   - `recordSupplierPayment` (lines 923–986): Reduces supplier balance and creates `CREDIT` in `SupplierLedger`.

2. **`src/lib/purchases/purchase-lifecycle-service.ts`**:
   - `processAdvancedGoodsReceipt` (lines 799–985): Handles cold chain, storage rack assignment, QC inspection, and separate quarantine batches (`batchNumber-REJ` with `status: 'BLOCKED'`).
   - Supports free quantities (line 831): `const usableQty = accepted + free`, which adds `usableQty` to `batch.quantity` and branch `inventory.totalQuantity`.
   - `processThreeWayMatchAndInvoice` (lines 1007–1142): Verifies supplier invoice number uniqueness (`supplierId_invoiceNumber`), marks status `INVOICED`, posts `CREDIT` to `SupplierLedger` (liability), increments `supplier.outstandingBalance`.

3. **`src/lib/scanner/auto-inventory-service.ts`**:
   - `analyzeScannedStrip` (lines 18–206): Multi-stage product matching algorithm:
     1. Barcode match against `Product.barcode` and `ProductBarcode`.
     2. Brand name match with prefix/exact insensitive check.
     3. Generic salt token match (e.g. "Amoxicillin" from "Amoxicillin + Clavulanic Acid").
   - `commitScannedInventory` (lines 211–363): Transactional inventory provisioning:
     - Handles product creation if new.
     - Uses `tx.inventory.upsert(...)` on `productId_branchId`.
     - Uses `tx.batch.upsert(...)` on `productId_batchNumber` (lines 307–331) with:
       ```ts
       update: {
         quantity: { increment: input.quantityToAdd },
         expiryDate: targetExpiry,
         mrp: input.mrp,
         purchasePrice,
       }
       ```
     - Creates `InventoryMovement` (`type: 'IN'`, `referenceType: 'AI_STRIP_SCAN'`).

4. **`src/lib/finance/gst-service.ts`**:
   - `postGstTransactionForPurchase` (lines 102–150): Directly creates `GstTransaction` records for input tax credit (ITC) for each line item of a purchase, accepting an optional `txClient` for execution inside a Prisma transaction.

5. **`src/lib/scanner/camera-ocr-service.ts` & `src/app/api/inventory/scan/camera-frame/route.ts`**:
   - Already establishes an asynchronous multi-pass OCR ingestion strategy:
     - Pre-processing with `sharp` (grayscale, contrast, resizing).
     - Multi-tier text extraction: Gemini 2.5 Flash Vision (via `GEMINI_API_KEY`) with direct fallback to local `tesseract.js` + `pharma-ocr-engine.ts`.
     - Date parser (`parsePharmaDate` in `pharma-ocr-engine.ts`) handles `MM/YY`, `MM/YYYY`, named months `AUG 2026`, and sets the date to the last day of the expiry month.

---

### 1.3 Existing Test Suite & Mocking Conventions

- **Unit tests**: Located in `src/**/__tests__/*.test.ts`. Use Jest with `ts-jest` and `node` environment.
- **Route tests** (e.g. `src/app/api/purchases/__tests__/purchase-routes.test.ts`):
  - Mock `requirePermission` from `@/lib/auth/auth-helpers`.
  - Mock the underlying service functions (e.g. `createPurchase: jest.fn()`).
  - Validate 401 Unauthorized, 403 Forbidden, 400 ZodError validation, and 200/201 success payload.
- **Integration tests** (e.g. `src/lib/purchases/purchase-service.integration.test.ts`):
  - Target real PostgreSQL (`pharma_test` schema via `DATABASE_URL` configured in `jest.setup.ts`).
  - Use `prisma.$executeRawUnsafe("TRUNCATE TABLE ... CASCADE")` in `resetDb()`.
  - Seed organizations, branches, users, products, suppliers.
  - Test transactions end-to-end against live DB.

---

## 2. Logic Chain

1. **Direct Purchase Bill Entry vs PO-GRN Cycle**:
   - *Observation*: The existing system provides `createPurchase` (creates PO in DRAFT) and `createGrn` (receives stock against PO). However, physical purchase bills received by retail pharmacies are finalized invoices that require immediate purchase persistence, inventory provisioning, batch upserting, and accounts payable posting upon user review and confirmation.
   - *Deduction*: A dedicated direct purchase bill provisioning service (`confirmAndProvisionPurchaseBill` or similar) is needed that consolidates:
     1. Supplier resolution / auto-creation
     2. Purchase record persistence (status: `RECEIVED` or `INVOICED`)
     3. Product catalog matching / creation
     4. Batch upserting (`productId_batchNumber`)
     5. Branch inventory increment (`productId_branchId`)
     6. Inventory movement logging (`IN`, `referenceType: 'PURCHASE'`)
     7. Supplier ledger entry (`CREDIT`) & balance update
     8. GST ITC transaction generation (`GstTransaction`)
     All within a single atomic `prisma.$transaction`.

2. **Batch Number Collisions & The `@@unique([productId, batchNumber])` Constraint**:
   - *Observation*: `Batch` enforces `@@unique([productId, batchNumber])`. In `purchase-service.ts:622`, `tx.batch.create` is used, which fails with error code `P2002` if a distributor supplies units belonging to an already known batch. In contrast, `auto-inventory-service.ts:307` uses `tx.batch.upsert` with `{ quantity: { increment: addedQty } }`.
   - *Deduction*: When provisioning from purchase bills, the system must use `upsert` semantics for batches. If the batch exists:
     - Increment `quantity: { increment: usableQty }`.
     - Revive batch status: If current status is `EXHAUSTED` (quantity was 0), transition it back to `ACTIVE`.
     - Update latest `expiryDate`, `mrp`, and `purchasePrice`.
     - If the batch is new: create it with `quantity: usableQty`, `status: 'ACTIVE'`, `purchaseId`.

3. **Free Quantity / Bonus Scheme Item Mechanics**:
   - *Observation*: `PurchaseItem` records `orderedQuantity`, `receivedQuantity`, and `freeQuantity`. `unitCost` is charged only on billed units. In `purchase-lifecycle-service.ts:831`, `usableQty = accepted + free`.
   - *Deduction*:
     - Inventory stock addition: `stockIncrement = billedQuantity + freeQuantity`. Both `Inventory.totalQuantity` and `Inventory.availableQuantity` must increment by `usableQty`.
     - Financial line calculation: `lineSubtotal = billedQuantity * unitCost`. Line tax and line total exclude free quantity from taxable base, but effective cost per strip/tablet becomes `lineTotal / (billedQuantity + freeQuantity)`.

4. **Supplier Matching Hierarchy**:
   - *Observation*: `Supplier` has `gstin` (15 chars), `dlNumber` (Drug License), and `name`. In India, supplier GSTIN is unique to the legal distributor entity and is printed on all standard pharma bills.
   - *Deduction*: When OCR extracts supplier details:
     - Tier 1 (Confidence 100%): Match by normalized GSTIN (`where: { gstin: extractedGstin.trim(), isActive: true }`).
     - Tier 2 (Confidence 95%): Match by Drug License (`where: { dlNumber: extractedDl.trim(), isActive: true }`).
     - Tier 3 (Confidence 75–85%): Case-insensitive fuzzy name/phone matching (`contains` mode `insensitive`).
     - Fallback: If no match, present supplier form with prefilled fields in the review UI for one-click creation.

5. **Medicine / Catalog Matching Hierarchy**:
   - *Observation*: `auto-inventory-service.ts` successfully implements a 3-tier heuristic: Barcode -> Brand Name -> Generic Salt composition.
   - *Deduction*: Purchase bill items should follow this established pattern:
     - Exact SKU or Barcode match (if bill has item barcode/code).
     - Normalized Brand name match (stripping common suffixes like "10X10", "TAB", "CAP", "10S", "500MG").
     - Generic salt composition match.
     - Review UI allows chemist to confirm suggested catalog match, pick from autocomplete, or trigger new product creation inline.

6. **Transaction Boundary & Atomicity**:
   - *Observation*: Incomplete multi-table mutations leave orphan purchase records or skewed inventory.
   - *Deduction*: Confirmation MUST occur in `prisma.$transaction(async (tx) => { ... }, { timeout: 15000 })`. If any batch upsert, inventory update, or ledger posting fails, the entire bill and stock mutation roll back cleanly.

---

## 3. Caveats

1. **Document Formats**: Purchase bills in Indian pharmacies arrive as printed paper scanned via smartphone camera (JPEG/PNG) or digital PDFs generated from Marg ERP, Tally Prime, Busy, or BusyWin. PDF documents can either contain vector text (extractable via text parser) or scanned bitmaps (requiring OCR).
2. **Cold Chain & Regulatory Holds**: If a bill contains cold-chain medicines (StorageCondition: REFRIGERATED) or Schedule H1/Narcotic drugs, stock should be provisioned with appropriate batch status or audit register entries.
3. **Period Locking**: The application includes financial period locking (`assertPeriodOpen` in `src/lib/finance/period-lock-service.ts`). Bill confirmation must respect period locking for the specified `invoiceDate`.
4. **Offline Mode**: If external AI APIs (e.g. Gemini Vision) are unavailable or offline, the local pipeline (`sharp` + `tesseract.js` worker + regex parser) must act as a reliable fallback.

---

## 4. Conclusion & Technical Recommendations

To support purchase bill scanning, automated data extraction, interactive review, and automatic inventory provisioning:

### 4.1 Recommended Service Architecture

1. **Bill Ingestion & Parsing Engine (`src/lib/purchases/bill-scanner-service.ts`)**:
   - Accepts uploaded file buffer (image `image/jpeg`, `image/png` or `application/pdf`).
   - If PDF: extracts embedded text directly; if scanned/image, renders page to image buffer via `sharp` or PDF converter.
   - OCR Extraction:
     - Tier 1: Multimodal Vision extraction using structured JSON prompt (mirroring `camera-frame/route.ts`).
     - Tier 2: Local fallback with `sharp` contrast/dewarping + `tesseract.js` + `pharma-ocr-engine.ts` regex parsing.
   - Output normalized DTO:
     ```ts
     export interface ExtractedPurchaseBill {
       supplier: {
         name?: string
         gstin?: string
         dlNumber?: string
         phone?: string
         address?: string
         matchedSupplierId?: string | null
         matchConfidence: number
       }
       invoice: {
         invoiceNumber?: string
         invoiceDate?: string // ISO YYYY-MM-DD
         dueDate?: string
         paymentTerms?: string
       }
       items: Array<{
         rawText: string
         productName: string
         matchedProductId?: string | null
         matchConfidence: number
         batchNumber: string
         expiryDate: string // ISO YYYY-MM-DD (last day of month)
         manufacturingDate?: string | null
         billedQuantity: number
         freeQuantity: number
         unitCost: number
         mrp: number
         discountPercent: number
         taxPercent: number
         taxAmount: number
         totalAmount: number
         hsnCode?: string
       }>
       totals: {
         subtotal: number
         discountAmount: number
         taxAmount: number
         roundOff: number
         totalAmount: number
       }
     }
     ```

2. **Interactive Review Data Contract**:
   - The review UI presents an editable table pre-populated with `ExtractedPurchaseBill`.
   - Chemist can:
     - Confirm or re-link Supplier (with "Create New Supplier" option).
     - Verify and edit invoice number and invoice date.
     - For each line item: confirm matched catalog product, change quantity/free quantity, edit batch number and expiry date, or toggle "Create as New Medicine".
     - Inspect calculated tax totals and gross payable amount.

3. **Atomic Provisioning Engine (`src/lib/purchases/purchase-provisioning-service.ts`)**:
   - Method signature:
     ```ts
     export async function confirmAndProvisionPurchaseBill(
       input: ConfirmPurchaseBillInput,
       actor: AuthUser
     ): Promise<ProvisionedPurchaseBillResult>
     ```
   - Transaction workflow:
     1. Branch access check (`assertBranchAccess`).
     2. Period lock validation (`assertPeriodOpen`).
     3. Supplier resolution: find or create supplier.
     4. Duplicate bill check: verify `invoiceNumber` does not already exist for `supplierId`.
     5. Sequential purchase number generation (`PO-${Date.now()}` or branch prefix).
     6. Product creation for any newly approved catalog products.
     7. Create `Purchase` record in status `RECEIVED` (or `INVOICED`).
     8. For each item:
        - Upsert `Batch` on `productId_batchNumber`:
          - `create`: `quantity = billedQuantity + freeQuantity`, `purchasePrice = unitCost`, `mrp`, `expiryDate`, `status = ACTIVE`.
          - `update`: `quantity: { increment: billedQuantity + freeQuantity }`, update prices, revert status from `EXHAUSTED` to `ACTIVE`.
        - Upsert `Inventory` on `productId_branchId`:
          - `totalQuantity: { increment: billedQuantity + freeQuantity }`
          - `availableQuantity: { increment: billedQuantity + freeQuantity }`
        - Create `PurchaseItem` linked to `Purchase.id` and `Batch.id`.
        - Create `InventoryMovement`: `type: 'IN'`, `quantity: billedQuantity + freeQuantity`, `referenceType: 'PURCHASE'`, `referenceId: purchase.id`, `batchId: batch.id`.
     9. Post Supplier Ledger: create `SupplierLedger` record (`type: 'CREDIT'`, `balance: currentBalance + totalAmount`).
     10. Increment `supplier.outstandingBalance: { increment: totalAmount }`.
     11. Call `postGstTransactionForPurchase(purchase.id, tx)`.
     12. Audit log creation: `PURCHASE_BILL_CONFIRMED`.

---

## 5. Verification Method

To independently verify the observations, schema mappings, and provisioning logic:

1. **Schema Verification**:
   - Check Prisma models and unique indexes:
     ```powershell
     Select-String -Path "prisma\schema.prisma" -Pattern "model (Purchase|Batch|Inventory|Supplier)"
     ```
   - Verify `Batch` unique constraint: line 531 `@@unique([productId, batchNumber])`.
   - Verify `Inventory` unique constraint: line 418 `@@unique([productId, branchId])`.
   - Verify `GstTransaction` unique constraint: line 1202 `@@unique([referenceType, referenceId, referenceLineId])`.

2. **Existing Purchase & Inventory Services Inspection**:
   - Inspect existing PO creation: `src/lib/purchases/purchase-service.ts` line 277.
   - Inspect existing GRN receiving: `src/lib/purchases/purchase-service.ts` line 548.
   - Inspect advanced GRN & free quantity: `src/lib/purchases/purchase-lifecycle-service.ts` line 799.
   - Inspect strip scanner batch upserting: `src/lib/scanner/auto-inventory-service.ts` line 307.
   - Inspect GST purchase transaction posting: `src/lib/finance/gst-service.ts` line 102.

3. **Automated Testing Suite Verification**:
   - Run unit tests for purchases and scanner:
     ```powershell
     npm run test:unit -- src/app/api/purchases/__tests__/purchase-routes.test.ts src/app/api/inventory/scan/__tests__/scan-routes.test.ts
     ```
   - Ensure clean execution without regressions.
