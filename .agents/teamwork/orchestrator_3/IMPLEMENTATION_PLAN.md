# Architectural and Implementation Plan: Purchase Bill Scanning, Automated Data Extraction, Interactive Review, and Inventory Provisioning

**Project**: Metapharsic Pharmacy Production Application  
**Author**: Project Orchestration Team (orchestrator_3)  
**Date**: 2026-11-03  
**Status**: APPROVED FOR EXECUTION  
**Integrity Mode**: Development  

---

## 1. Executive Summary & Scope

Modern retail and hospital pharmacies in India process dozens of wholesale purchase invoices daily from pharmaceutical distributors (e.g., Mahaveer Pharma Agencies, Vardhaman Medisales). Currently, manual entry of multi-line distributor bills—including 15-character GSTINs, drug license numbers, batch numbers, variable expiry formats, pack sizes, PTR/MRP rates, trade discount schemes (e.g. 10+1 free goods), and multi-tier GST tax slabs—is time-consuming and error-prone.

This architectural and implementation plan introduces an end-to-end automated purchase bill ingestion pipeline into the production pharmacy application:
1. **Document & Image Ingestion**: Pharmacists upload bill documents in PDF (digital vector or scanned) or image (JPEG, PNG) format.
2. **Hybrid OCR & Parsing Engine**: A high-performance 4-tier extraction pipeline extracts supplier metadata, statutory drug license numbers, invoice identifiers, and line item tables with field-level confidence scoring and mathematical cross-reconciliation.
3. **Interactive Dual-View Review Interface**: A synchronized split-pane UI presents the uploaded document preview alongside editable, pre-filled bill fields with fuzzy product/supplier catalog matching.
4. **Explicit Confirmation Barrier**: A non-bypassable confirmation safety barrier prevents accidental stock mutations until the pharmacist reviews and explicitly affirms the extracted bill details.
5. **Atomic Inventory Provisioning**: Upon confirmation, an atomic database transaction persists the purchase bill record, upserts pharmaceutical batches (`productId_batchNumber`), increments branch inventory with Compare-And-Swap (CAS) concurrency safety, logs inventory movement audit trails, posts accounts payable entries in the supplier ledger, and records input tax credit (ITC) GST transactions.
6. **Comprehensive Automated Testing**: A 4-tier test suite verifies unit parsing, API endpoints, transactional database mutations, and end-to-end acceptance workflows.

---

## 2. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PRESENTATION LAYER (Next.js 14)                             │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  /purchases/scan  &  /purchases (Scan Modal / Dedicated Workspace)                           │
│  ┌─────────────────────────────────┐   ┌──────────────────────────────────────────────────┐ │
│  │     Document Dropzone / URL     │   │      Multi-Stage Progress Indicator              │ │
│  │   (PDF / JPEG / PNG up to 15MB) │   │   (Upload -> Extract -> Fuzzy Match -> Review)   │ │
│  └─────────────────────────────────┘   └──────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                       Split Dual-View Interactive Review Interface                     │ │
│  │  ┌───────────────────────────────┐     ┌────────────────────────────────────────────┐  │ │
│  │  │  Document Preview Pane (45%)  │     │   Editable Structured Review Form (55%)    │  │ │
│  │  │  - Zoom (50%-300%), Pan       │     │   - Supplier & Invoice Metadata Header     │  │ │
│  │  │  - Multi-page PDF navigation  │     │   - Dynamic Line Items Grid                │  │ │
│  │  │  - Page rotation              │     │   - SearchableSelect Fuzzy Medicine Match  │  │ │
│  │  │                               │     │   - Live Tax & Discount Recalculation      │  │ │
│  │  └───────────────────────────────┘     └────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                │                                            │
│                               Click "Commit & Provision"                                    │
│                                                ▼                                            │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                Explicit Confirmation Barrier (AlertDialog Modal)                       │ │
│  │   - Executive Bill Summary: Supplier, Invoice #, Total Line Items, Units, Total ₹      │ │
│  │   - Discrepancy Warnings (Math reconciliation, short-expiry alert < 6 months)          │ │
│  │   - Mandatory "Confirm and Provision Stock" explicit user affirmation                  │ │
│  └────────────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                         │ POST /api/purchases/scan/commit
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                APPLICATION & INGESTION SERVICES                             │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  POST /api/purchases/scan                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                     4-Tier Hybrid Parsing & Extraction Engine                          │ │
│  │  Tier 1: pdf-parse Stream Extractor (Born-digital PDFs, 15-50ms, 100% vector accuracy) │ │
│  │  Tier 2: Cloud AI Vision (gemini-2.5-flash when GEMINI_API_KEY is available)           │ │
│  │  Tier 3: Local Offline OCR (Sharp contrast normalization + Tesseract.js Worker)        │ │
│  │  Tier 4: Deterministic Mock Fixture Engine (CI & Test mode, 2ms execution)             │ │
│  └────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                │                                            │
│                                                ▼                                            │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                        Indian Pharmacy Invoice Domain Parser                           │ │
│  │  - Statutory Header Regex: GSTIN (15-char), Drug License (20B/21B), Invoice #, Dates   │ │
│  │  - Tabular Item Layout Parser: Product, Pack, Batch, Expiry, Qty, Free, Rate, MRP, GST │ │
│  │  - Pharma Date Resolver: Normalizes MM/YY, MM/YYYY, MMM-YY to month-end calendar date │ │
│  │  - Math Reconciler: Taxable + Tax - Discount ± RoundOff == Extracted Grand Total        │ │
│  └────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                │                                            │
│                                                ▼                                            │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                        Entity Resolution & Fuzzy Matcher                               │ │
│  │  - Supplier Match: GSTIN (100%) -> DL (95%) -> Trigram Name Similarity (>=85%)         │ │
│  │  - Product Match: Clean dosage/pack tokens -> Barcode/SKU -> Trigram Similarity        │ │
│  │  - Unresolved: Proposes quick-create pre-filled drafts for new suppliers/products      │ │
│  └────────────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                       ATOMIC PERSISTENCE & INVENTORY PROVISIONING LAYER                     │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│  purchase-provisioning-service.ts  inside  prisma.$transaction (Timeout: 15000ms)           │
│  1. Resolve or Create Supplier (GSTIN, DL, Name, Contact, Address)                          │
│  2. Persist Purchase record (status: 'RECEIVED', invoiceNumber, invoiceDate, Totals)        │
│  3. For each Line Item:                                                                     │
│     a. Create PurchaseItem record (orderedQty, receivedQty, freeQty, unitCost, MRP, GST)   │
│     b. Upsert Batch on @@unique([productId, batchNumber]):                                  │
│        - Increment quantity by (billedQuantity + freeQuantity)                              │
│        - Reactivate status from 'EXHAUSTED' to 'ACTIVE'                                     │
│        - Update expiryDate, purchasePrice, and MRP                                          │
│     c. CAS Update Inventory on @@unique([productId, branchId]):                             │
│        - Increment totalQuantity and availableQuantity by (billedQuantity + freeQuantity)   │
│     d. Create InventoryMovement (type: 'IN', refType: 'PURCHASE', refId: purchase.id)       │
│  4. Post Accounts Payable SupplierLedger credit entry & increment outstandingBalance        │
│  5. Post GstTransaction for Input Tax Credit (ITC) compliance                               │
│  6. Record comprehensive AuditLog (action: 'PURCHASE_BILL_SCAN_CONFIRM')                    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Ingestion, OCR & Document Parsing Pipeline

### 3.1 Supported Input Formats
- **PDF Documents** (`application/pdf`): Born-digital vector PDFs and scanned bitmap PDFs (up to 15MB).
- **Image Documents** (`image/jpeg`, `image/png`, `image/webp`): Photos captured via mobile smartphone cameras or flatbed scanners.

### 3.2 4-Tier Hybrid Extraction Strategy

| Engine Tier | Strategy | When Activated | Latency | Accuracy |
|---|---|---|---|---|
| **Tier 1** | Pure JS PDF Text Extraction (`pdf-parse`) | Incoming file is PDF with text layer | 15–50 ms | 100% character accuracy |
| **Tier 2** | Cloud Vision AI (`gemini-2.5-flash`) | Image/Scanned PDF + `GEMINI_API_KEY` present | 800–1800 ms | 98.5% spatial accuracy |
| **Tier 3** | Local Sharp + Tesseract.js Worker | Image/Scanned PDF offline fallback | 2500–6000 ms | 90–94% heuristic accuracy |
| **Tier 4** | Deterministic Mock Engine | `NODE_ENV === 'test'` or test header | 1–3 ms | 100% deterministic |

#### Tier 1: Born-Digital PDF Parsing (`pdf-parse`)
Over 80% of wholesale bills from Marg ERP, Busy, and Tally are emailed as pure digital vector PDFs. `pdf-parse` extracts text streams with exact character offsets in milliseconds without spawning heavy OCR workers or calling external APIs.

#### Tier 2 & 3: Image OCR & Preprocessing
When an image or bitmap PDF is received:
1. `sharp` performs contrast enhancement, grayscale normalization, deskewing, and thresholding.
2. If `GEMINI_API_KEY` is available, `gemini-2.5-flash` executes structured multimodal extraction with JSON schema constraints.
3. Otherwise, a cached local `tesseract.js` worker processes the image using Page Segmentation Mode 6 (uniform block of text) with optimized whitelist dictionaries.

#### Tier 4: Deterministic Mock Fixture Engine
In test environments, the engine returns predefined structured fixtures for sample invoices, ensuring zero flaky tests, zero external network dependency, and ultra-fast CI pipeline execution.

### 3.3 Indian Pharmaceutical Invoice Domain Heuristics

Wholesale pharma bills in India follow statutory norms under the Drugs and Cosmetics Act (1940) and GST Acts (2017):

1. **Statutory Header Metadata**:
   - **GSTIN**: 15-character statutory alphanumeric regex: `\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b`.
   - **Drug License Number**: Matches Form 20B / Form 21B patterns: `\b(?:DL|D\.L\.|D/L|L\.No|Lic\.?\s*No\.?)[\s\:\-]+([A-Za-z0-9\/\-\,\s]{5,40})\b`.
   - **Invoice Number**: `\b(?:INV|INVOICE|BILL|MEMO|CASH\s*MEMO)[\s\.\:\#\-]+([A-Za-z0-9\/\-_]{3,25})\b`.
   - **Invoice Date**: `\b(?:DATE|DT|INVOICE\s*DATE|BILL\s*DATE)[\s\:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b`, normalized to ISO `YYYY-MM-DD`.

2. **Tabular Line Item Heuristics**:
   - Column header detection identifies column positions: `Description`, `Pack`, `HSN`, `Batch`, `Expiry`, `Qty`, `Free`, `Rate / PTR`, `MRP`, `Disc %`, `GST %`, `Amount`.
   - **Product Name**: Uppercase pharmaceutical title stripped of dosage and pack indicators.
   - **Batch Number**: Alphanumeric token (3–15 characters, e.g. `26D044`, `PN8901`).
   - **Expiry Date Normalization**:
     * `08/28` or `08/2028` -> `2028-08-31` (last calendar day of the month)
     * `NOV-27` or `11-27` -> `2027-11-30`
     * `15/04/2028` -> `2028-04-15`
   - **Quantities**: Separate extraction of `Billed Quantity` and `Free Quantity` (bonus scheme goods, e.g. 10+1 free).
   - **Pricing**: Purchase Rate (PTR), MRP, Trade Discount %, and GST tax slab (0%, 5%, 12%, 18%, 28%).

3. **Mathematical Cross-Reconciliation**:
   - Computes:
     $$\text{Line Taxable} = (\text{Billed Qty} \times \text{Rate}) \times (1 - \text{Discount} / 100)$$
     $$\text{Line Tax} = \text{Line Taxable} \times (\text{GST} / 100)$$
     $$\text{Line Total} = \text{Line Taxable} + \text{Line Tax}$$
     $$\text{Computed Total} = \sum \text{Line Total} - \text{Cash Discount} \pm \text{RoundOff}$$
   - Validates that $|\text{Computed Total} - \text{Extracted Grand Total}| \le 1.00$ INR.

---

## 4. Entity Resolution & Fuzzy Catalog Matching

### 4.1 Supplier Resolution Hierarchy
1. **Tier 1 (Confidence 100%)**: Exact match on extracted 15-character GSTIN against `Supplier.gstin` (`isActive: true`).
2. **Tier 2 (Confidence 95%)**: Match on Drug License number against `Supplier.dlNumber`.
3. **Tier 3 (Confidence 75–85%)**: Case-insensitive fuzzy string match on Supplier Name using trigram and Levenshtein distance ($\ge 85\%$ similarity).
4. **Fallback**: If no match is found, the system flags `NEW_SUPPLIER` and pre-populates the supplier creation drawer with the extracted GSTIN, DL number, address, and name.

### 4.2 Medicine & Product Resolution Hierarchy
Extracted medicine names from bills often include abbreviations (e.g., `AUGMENTIN 625 DUO TAB 10'S`).
1. **Token Normalization**:
   - Strip dosage tags: `TAB`, `TABLET`, `CAP`, `CAPSULE`, `SYP`, `INJ`, `OINT`, `GEL`.
   - Strip pack strings: `10'S`, `15'S`, `10X10`, `100ML`.
   - Strip pharmacopeia tags: `IP`, `BP`, `USP`.
2. **Matching Hierarchy**:
   - Exact match on barcode or SKU.
   - Exact normalized brand name match against active `Product.name`.
   - Trigram similarity match:
     * Similarity $\ge 85\%$: Auto-select matched product (Confidence: HIGH).
     * Similarity between $60\%$ and $84\%$: Suggest top 3 candidate products for 1-click pharmacist selection (Confidence: MEDIUM).
     * Similarity $< 60\%$: Present option to create new product pre-filled with extracted pack size, HSN, MRP, PTR, and GST slab.

---

## 5. Dual-View Interactive Review UI Architecture

### 5.1 Component Breakdown (`src/components/purchases/bill-scanner/`)

```
src/components/purchases/bill-scanner/
├── purchase-bill-scanner-view.tsx       # Main container coordinating state and dual view
├── document-upload-zone.tsx             # Drag-and-drop dropzone (PDF, PNG, JPEG)
├── scanning-progress-card.tsx           # Multi-stage parsing progress card
├── document-preview-pane.tsx            # Left pane: Zoom, pan, rotate, multi-page PDF viewer
├── bill-metadata-form.tsx               # Top section: Supplier select, invoice #, invoice date, branch
├── line-items-review-table.tsx          # Right pane table: Item rows with SearchableSelect
├── line-item-row-editor.tsx             # Row editor with live recalculation and confidence badge
├── bill-summary-footer.tsx              # Tax reconciliation summary, discrepancy alerts, action bar
├── bill-confirmation-dialog.tsx         # Confirmation safety barrier modal before database commit
└── types.ts                             # Shared TypeScript types and validation schemas
```

### 5.2 User Experience Flow
1. **Navigation Entry**: The pharmacist clicks **"Scan Purchase Bill"** on `/purchases` or `/purchases/agency`, opening the `/purchases/scan` interface.
2. **Ingestion & Visual Progress**: Drag-and-dropping a bill renders an instant client-side preview and initiates the extraction pipeline. An animated stepper displays progress: `Uploading` -> `Extracting Document Text` -> `Resolving Products & Suppliers` -> `Ready for Review`.
3. **Split Dual-View Workspace**:
   - **Left Pane (45%)**: High-resolution document viewer with zoom (50% to 300%), pan, rotate (90° steps), and multi-page PDF navigation.
   - **Right Pane (55%)**: Structured editable review form.
4. **Interactive Line Item Editing**:
   - Product selection uses `SearchableSelect` with fuzzy search and confidence badges.
   - Batch numbers auto-capitalize; expiry dates validate for future validity and alert if $<6$ months away.
   - Quantity and Free Quantity fields auto-recalculate line totals and effective unit rates.
5. **Pre-Commit Mathematical Validation**:
   - The footer displays **Computed Net Total** vs **Extracted Bill Total**. If variance exceeds Rs. 1.00, an amber warning banner highlights the mismatch for pharmacist verification.
6. **Safety Confirmation Barrier**: Clicking "Commit & Provision" opens a mandatory confirmation dialog displaying the supplier, invoice number, item count, total units, and total payable amount. The system will NOT save or alter inventory without this explicit confirmation.

---

## 6. Atomic Inventory Provisioning & Data Integrity

### 6.1 Database Transaction Flow

The confirmation endpoint `POST /api/purchases/scan/commit` executes within a single atomic `prisma.$transaction(async (tx) => { ... }, { timeout: 15000 })`:

```typescript
// Core Provisioning Transaction
await prisma.$transaction(async (tx) => {
  // 1. Supplier Resolution / Upsert
  let supplierId = payload.supplierId;
  if (!supplierId && payload.newSupplier) {
    const createdSupplier = await tx.supplier.create({ data: payload.newSupplier });
    supplierId = createdSupplier.id;
  }

  // 2. Persist Purchase Header
  const purchase = await tx.purchase.create({
    data: {
      purchaseNumber: `PB-${Date.now()}`,
      branchId: payload.branchId,
      supplierId,
      invoiceNumber: payload.invoiceNumber,
      invoiceDate: new Date(payload.invoiceDate),
      purchaseDate: new Date(),
      status: 'RECEIVED',
      subtotal: payload.subtotal,
      discountAmount: payload.discountAmount,
      taxAmount: payload.taxAmount,
      totalAmount: payload.totalAmount,
      balanceDue: payload.totalAmount,
      createdById: sessionUser.id,
      notes: payload.notes || 'Ingested via Automated Purchase Bill Scanner',
    },
  });

  // 3. Process Each Line Item
  for (const item of payload.items) {
    const totalUsableQty = item.billedQuantity + (item.freeQuantity || 0);

    // a. Create PurchaseItem Record
    const purchaseItem = await tx.purchaseItem.create({
      data: {
        purchaseId: purchase.id,
        productId: item.productId,
        orderedQuantity: item.billedQuantity,
        receivedQuantity: item.billedQuantity,
        freeQuantity: item.freeQuantity || 0,
        unitCost: item.unitCost,
        mrp: item.mrp,
        ptr: item.ptr || item.unitCost,
        discountPercent: item.discountPercent || 0,
        taxPercent: item.taxPercent || 0,
        taxAmount: item.taxAmount || 0,
        totalAmount: item.totalAmount,
        batchNumber: item.batchNumber.trim().toUpperCase(),
        expiryDate: new Date(item.expiryDate),
      },
    });

    // b. Batch Upsert (handling @@unique([productId, batchNumber]))
    const batch = await tx.batch.upsert({
      where: {
        productId_batchNumber: {
          productId: item.productId,
          batchNumber: item.batchNumber.trim().toUpperCase(),
        },
      },
      create: {
        productId: item.productId,
        batchNumber: item.batchNumber.trim().toUpperCase(),
        expiryDate: new Date(item.expiryDate),
        purchasePrice: item.unitCost,
        mrp: item.mrp,
        ptr: item.ptr || item.unitCost,
        quantity: totalUsableQty,
        status: 'ACTIVE',
        purchaseId: purchase.id,
        branchId: payload.branchId,
      },
      update: {
        quantity: { increment: totalUsableQty },
        status: 'ACTIVE', // Reactivate batch if previously EXHAUSTED
        purchasePrice: item.unitCost,
        mrp: item.mrp,
        expiryDate: new Date(item.expiryDate),
      },
    });

    // Link batchId back to purchaseItem
    await tx.purchaseItem.update({
      where: { id: purchaseItem.id },
      data: { batchId: batch.id },
    });

    // c. CAS Inventory Update (handling @@unique([productId, branchId]))
    const currentInv = await tx.inventory.findUnique({
      where: {
        productId_branchId: {
          productId: item.productId,
          branchId: payload.branchId,
        },
      },
    });

    if (currentInv) {
      await tx.inventory.update({
        where: { id: currentInv.id },
        data: {
          totalQuantity: { increment: totalUsableQty },
          availableQuantity: { increment: totalUsableQty },
        },
      });
    } else {
      await tx.inventory.create({
        data: {
          productId: item.productId,
          branchId: payload.branchId,
          totalQuantity: totalUsableQty,
          availableQuantity: totalUsableQty,
        },
      });
    }

    // d. Log InventoryMovement Audit Trail
    await tx.inventoryMovement.create({
      data: {
        inventoryId: currentInv ? currentInv.id : (await tx.inventory.findUniqueOrThrow({ where: { productId_branchId: { productId: item.productId, branchId: payload.branchId } } })).id,
        type: 'IN',
        quantity: totalUsableQty,
        quantityBefore: currentInv ? currentInv.availableQuantity : 0,
        quantityAfter: (currentInv ? currentInv.availableQuantity : 0) + totalUsableQty,
        referenceType: 'PURCHASE',
        referenceId: purchase.id,
        batchId: batch.id,
        notes: `Purchase bill auto-provision: Inv #${payload.invoiceNumber}, Batch ${item.batchNumber}`,
        createdById: sessionUser.id,
      },
    });
  }

  // 4. Accounts Payable & Supplier Ledger Posting
  await tx.supplier.update({
    where: { id: supplierId },
    data: {
      outstandingBalance: { increment: payload.totalAmount },
    },
  });

  await tx.supplierLedger.create({
    data: {
      supplierId,
      type: 'CREDIT',
      amount: payload.totalAmount,
      balance: (await tx.supplier.findUniqueOrThrow({ where: { id: supplierId } })).outstandingBalance,
      referenceType: 'PURCHASE',
      referenceId: purchase.id,
      description: `Purchase Bill Inv #${payload.invoiceNumber}`,
    },
  });

  // 5. Input Tax Credit (ITC) GST Posting
  await postGstTransactionForPurchase(purchase.id, tx);

  // 6. Security Audit Log
  await tx.auditLog.create({
    data: {
      action: 'PURCHASE_BILL_SCAN_CONFIRM',
      entity: 'Purchase',
      entityId: purchase.id,
      userId: sessionUser.id,
      branchId: payload.branchId,
      details: JSON.stringify({
        invoiceNumber: payload.invoiceNumber,
        supplierId,
        itemCount: payload.items.length,
        totalAmount: payload.totalAmount,
      }),
    },
  });

  return purchase;
});
```

### 6.2 Key Data Integrity Invariants
1. **Free Quantity Stock Addition**: `totalUsableQty = billedQuantity + freeQuantity`. Both are added to stock, ensuring bonus goods are available for dispensing.
2. **Financial Cost Invariant**: Financial line totals reflect only billed units: $\text{taxableBase} = \text{billedQuantity} \times \text{unitCost} \times (1 - \text{discount} / 100)$.
3. **Batch Collision Immunity**: Using `tx.batch.upsert` with `{ quantity: { increment: totalUsableQty } }` eliminates `P2002` duplicate key errors when reordering an existing batch, and automatically restores `EXHAUSTED` batches to `ACTIVE`.
4. **Strict Confirmation Barrier**: No database table, batch record, inventory count, or ledger is touched until the confirmation modal is confirmed by the user.

---

## 7. API Route Specifications & Data Contracts

### 7.1 Document Scan Endpoint: `POST /api/purchases/scan`
- **Authentication**: Required (`requirePermission(PERMISSIONS.PURCHASES_CREATE)`).
- **Content-Type**: `multipart/form-data`.
- **Payload**:
  - `file`: Binary file (PDF, JPEG, PNG, up to 15MB).
  - `branchId`: Optional branch identifier (defaults to user's branch).
- **Response**: `200 OK`
```json
{
  "success": true,
  "confidence": 0.94,
  "document": {
    "filename": "Mahaveer_MP24_08492.pdf",
    "mimeType": "application/pdf",
    "pageCount": 1
  },
  "extractedData": {
    "supplier": {
      "rawName": "MAHAVEER PHARMA AGENCIES PVT LTD",
      "matchedSupplierId": "cuid_supplier_123",
      "gstin": "29AABCM8921F1ZT",
      "dlNumber": "20B/KA-B21/48911",
      "matchConfidence": 1.0,
      "isNew": false
    },
    "invoice": {
      "invoiceNumber": "MP/24-25/08492",
      "invoiceDate": "2026-10-24",
      "dueDate": "2026-11-23"
    },
    "items": [
      {
        "id": "item_1",
        "rawDescription": "AUGMENTIN 625 DUO TAB 10'S",
        "matchedProductId": "cuid_prod_augmentin",
        "matchedProductName": "Augmentin 625 Duo",
        "matchConfidence": 0.96,
        "isNewProduct": false,
        "packSize": "10'S",
        "hsnCode": "3004",
        "batchNumber": "26D044",
        "expiryDate": "2028-08-31",
        "billedQuantity": 50,
        "freeQuantity": 5,
        "unitCost": 147.24,
        "mrp": 204.50,
        "discountPercent": 2.0,
        "taxPercent": 12.0,
        "taxAmount": 865.77,
        "totalAmount": 8080.53
      }
    ],
    "financials": {
      "subtotal": 23814.76,
      "taxAmount": 2465.78,
      "discountAmount": 144.29,
      "roundOff": 0.25,
      "totalAmount": 26136.00,
      "isReconciled": true,
      "reconciliationVariance": 0.00
    }
  }
}
```

### 7.2 Bill Confirmation Endpoint: `POST /api/purchases/scan/commit`
- **Authentication**: Required (`requirePermission(PERMISSIONS.PURCHASES_CREATE)`).
- **Content-Type**: `application/json`.
- **Validation**: Strict Zod schema (`confirmPurchaseBillSchema`).
- **Response**: `201 Created`
```json
{
  "success": true,
  "purchaseId": "cuid_purch_987",
  "purchaseNumber": "PB-1730635400000",
  "totalItemsProvisioned": 3,
  "totalUnitsAdded": 185,
  "totalAmount": 26136.00,
  "status": "RECEIVED"
}
```

---

## 8. Milestone Decomposition & Implementation Roadmap

| Milestone | Name | Scope & Responsibilities | Dependencies | Status |
|---|---|---|---|---|
| **M1** | Ingestion & Document Parsing Pipeline | Document ingestion endpoint (`POST /api/purchases/scan`), 4-tier extraction engine (`pdf-parse`, sharp/tesseract, mock fixture), Indian pharmacy regex/layout heuristics, date normalizer, math reconciler, and entity resolution service. | none | PLANNED |
| **M2** | Inventory Provisioning & Persistence Engine | Transactional confirmation service (`purchase-provisioning-service.ts`), `POST /api/purchases/scan/commit` endpoint, batch upsert with `@@unique` safety, CAS branch inventory update, inventory movement logging, supplier ledger credit, and GST ITC generation. | none | PLANNED |
| **M3** | Dual-View Interactive Review UI | Split dual-view workspace (`/purchases/scan`), zoomable/pannable document preview pane, editable structured review form, fuzzy medicine selection (`SearchableSelect`), line item calculations, and explicit confirmation barrier dialog. | M1, M2 | PLANNED |
| **M4** | Dual-Track Acceptance & Verification | Comprehensive 4-tier test suite (Tiers 1–4) covering document parsing, entity matching, UI review flow, confirmation barrier cancellation, transactional database provisioning, and regression verification. | M1, M2, M3 | PLANNED |

---

## 9. Automated Testing & Verification Plan

### 9.1 Verification Tiers

```
┌────────────────────────────────────────────────────────────────────────┐
│                        4-TIER VERIFICATION PLAN                        │
├────────────────────────────────────────────────────────────────────────┤
│ Tier 1: Unit Feature Verification (>=5 per feature)                    │
│ - PDF text extraction (`pdf-parse`)                                    │
│ - Indian pharmacy invoice regex (GSTIN, DL 20B/21B, Invoice #, Date)   │
│ - Pharmaceutical expiry date resolver (MM/YY, MM/YYYY, MMM-YY)         │
│ - Tabular line items extraction (Qty, Free, Rate, MRP, Batch, Disc)    │
│ - Math cross-reconciliation (Subtotal + Taxes - Discounts == Total)    │
│ - Supplier & Product fuzzy entity matching                             │
├────────────────────────────────────────────────────────────────────────┤
│ Tier 2: Boundary & Corner Cases (>=5 per feature)                      │
│ - Free goods bonus scheme items (e.g. 10+1 free, 100+10 free)          │
│ - Zero-tax (0%) and multi-slab GST invoices (5%, 12%, 18%)             │
│ - Expired or short-expiry medicine detection (< 6 months)              │
│ - Re-ordered duplicate batch numbers (verifying upsert & reactivation) │
│ - Corrupt/unsupported file formats & oversized uploads (>15MB)         │
│ - Missing statutory fields (missing GSTIN, missing DL number)          │
├────────────────────────────────────────────────────────────────────────┤
│ Tier 3: Cross-Feature Integration Tests                                │
│ - Document scan API (`POST /api/purchases/scan`) end-to-end            │
│ - Confirmation barrier validation (rejecting commits without review)   │
│ - Atomic purchase bill confirmation (`POST /api/purchases/scan/commit`)│
│ - Inventory quantity increments and CAS concurrency validation         │
│ - InventoryMovement audit trail creation (`type: IN`)                  │
│ - Supplier ledger balance updates and credit entry persistence         │
├────────────────────────────────────────────────────────────────────────┤
│ Tier 4: Real-World Acceptance Scenarios                                │
│ - Multi-item wholesale distributor invoice (Marg ERP PDF)              │
│ - Mobile camera photo upload of printed bill (JPEG/PNG)                │
│ - Mixed-line invoice with bonus schemes and multi-slab GST             │
│ - Unrecognized supplier & new product inline catalog provisioning      │
│ - Pharmacist review cancellation without touching inventory            │
└────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Test Execution Commands
- Unit & Parsing Tests: `npm test -- src/lib/scanner/__tests__/purchase-bill-parser.test.ts`
- Service & Provisioning Tests: `npm test -- src/lib/purchases/__tests__/purchase-provisioning.test.ts`
- API Route Tests: `npm test -- src/app/api/purchases/scan/__tests__/scan-routes.test.ts`
- UI Component Tests: `npm test -- src/components/purchases/bill-scanner/__tests__/bill-scanner.test.tsx`
- Full Test Suite: `npm test`

---

## 10. Risk Management & Mitigations

| Identified Risk | Impact | Mitigation Strategy |
|---|---|---|
| **Oversized / Scanned PDF Latency** | High latency or memory spike during OCR | `pdf-parse` extracts text instantly for born-digital PDFs; images offload to worker threads with timeout guards (8s) and clear progress feedback. |
| **Batch Number Collision (`P2002`)** | Transaction failure if batch exists | Enforce `tx.batch.upsert` with `{ quantity: { increment } }` and reactivate `EXHAUSTED` batches to `ACTIVE`. |
| **Accidental Stock Modification** | Incorrect stock values in production | Implement strict **Confirmation Barrier**: no database or stock mutation can execute without explicit user confirmation in the dialog. |
| **Unmatched Catalog Products** | Pharmacist blocked on new medicine | Provide inline quick-create product option and fuzzy autocomplete with candidate suggestions. |
| **Flaky CI Builds Due to OCR Binaries** | CI test failures in environments without OCR | Implement a **Deterministic Mock Engine** active during test runs, returning pre-validated invoice fixtures in ~2ms. |

---

## 11. Approval & Next Steps

This plan fulfills all requirements specified in **R1 (Implementation Plan)**, **R2 (Scanning & Extraction)**, **R3 (Interactive Review)**, and **R4 (Confirmation & Inventory Provisioning)**.

Upon review:
1. Update `PROJECT.md` at root with the active architecture, feature inventory, milestones, and interface contracts.
2. Formally deliver this plan to the Sentinel parent agent.
3. Spawn Milestone Sub-orchestrators and E2E Testing Orchestrator to execute the implementation phases.
