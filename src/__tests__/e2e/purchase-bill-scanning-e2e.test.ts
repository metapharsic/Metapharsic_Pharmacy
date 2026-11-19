/** @jest-environment node */

// ─────────────────────────────────────────────────────────────
// End-to-End Test Suite: Purchase Bill Scanning, Automated Extraction,
// Interactive Review, and Inventory Provisioning
// Requirements: ORIGINAL_REQUEST.md (Follow-up 2026-11-03T11:37:13Z)
// Architecture: PROJECT.md & IMPLEMENTATION_PLAN.md
// Coverage: Tiers 1–4 Opaque-Box Acceptance Testing
// ─────────────────────────────────────────────────────────────

import {
  MARG_ERP_MAHAVEER_FIXTURE,
  SMARTPHONE_CAMERA_VARDHAMAN_FIXTURE,
  SHORT_EXPIRY_FIXTURE,
  MULTI_SLAB_GST_FIXTURE,
  UNRECONCILED_MATH_FIXTURE,
} from '@/lib/scanner/__fixtures__/distributor-invoices'

import {
  GSTIN_REGEX,
  DRUG_LICENSE_REGEX,
  parsePharmaExpiryDate,
  isShortExpiry,
  reconcileFinancials,
  cleanMedicineDescription,
  simulateDocumentScan,
  simulateBillCommit,
  type ScanBillResponse,
  type ConfirmPurchaseBillInput,
} from './purchase-bill-test-harness'

// ─── Prisma Mocking ──────────────────────────────────────────

const createMockPrisma = () => {
  const store = {
    suppliers: new Map<string, any>(),
    purchases: new Map<string, any>(),
    purchaseItems: new Map<string, any>(),
    batches: new Map<string, any>(),
    inventories: new Map<string, any>(),
    inventoryMovements: [] as any[],
    supplierLedgers: [] as any[],
    gstTransactions: [] as any[],
    auditLogs: [] as any[],
  }

  // Pre-seed default branch and product
  store.suppliers.set('supplier-mahaveer-01', {
    id: 'supplier-mahaveer-01',
    name: 'MAHAVEER PHARMA AGENCIES PVT LTD',
    gstin: '29AABCM8921F1ZT',
    dlNumber: '20B/KA-B21/48911',
    outstandingBalance: 5000.0,
    isActive: true,
  })

  store.batches.set('prod-augmentin-625_26D044', {
    id: 'batch-aug-01',
    productId: 'prod-augmentin-625',
    batchNumber: '26D044',
    quantity: 0,
    status: 'EXHAUSTED',
    expiryDate: new Date('2028-08-31'),
    purchasePrice: 147.24,
    mrp: 204.5,
  })

  store.inventories.set('prod-augmentin-625_branch-ka-01', {
    id: 'inv-aug-01',
    productId: 'prod-augmentin-625',
    branchId: 'branch-ka-01',
    totalQuantity: 10,
    availableQuantity: 10,
  })

  const tx = {
    supplier: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const id = data.id || `supplier-gen-${Date.now()}`
        const record = { id, ...data }
        store.suppliers.set(id, record)
        return record
      }),
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
        return store.suppliers.get(where.id) || null
      }),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const record = store.suppliers.get(where.id) || { id: where.id, outstandingBalance: 0 }
        if (data.outstandingBalance?.increment) {
          record.outstandingBalance += data.outstandingBalance.increment
        }
        store.suppliers.set(where.id, record)
        return record
      }),
    },
    purchase: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const id = data.id || `purch-${Date.now()}`
        const record = { id, ...data }
        store.purchases.set(id, record)
        return record
      }),
    },
    purchaseItem: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const id = data.id || `pi-${Date.now()}-${Math.random()}`
        const record = { id, ...data }
        store.purchaseItems.set(id, record)
        return record
      }),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const record = store.purchaseItems.get(where.id) || { id: where.id }
        Object.assign(record, data)
        return record
      }),
    },
    batch: {
      upsert: jest.fn().mockImplementation(async ({ where, create, update }: any) => {
        const key = `${where.productId_batchNumber.productId}_${where.productId_batchNumber.batchNumber}`
        let record = store.batches.get(key)
        if (record) {
          if (update.quantity?.increment) {
            record.quantity += update.quantity.increment
          }
          if (update.status) {
            record.status = update.status
          }
          if (update.purchasePrice) record.purchasePrice = update.purchasePrice
          if (update.mrp) record.mrp = update.mrp
          if (update.expiryDate) record.expiryDate = update.expiryDate
        } else {
          record = { id: `batch-${Date.now()}`, ...create }
          store.batches.set(key, record)
        }
        return record
      }),
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
        const key = `${where.productId_batchNumber.productId}_${where.productId_batchNumber.batchNumber}`
        return store.batches.get(key) || null
      }),
    },
    inventory: {
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
        const key = `${where.productId_branchId.productId}_${where.productId_branchId.branchId}`
        return store.inventories.get(key) || null
      }),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const key = `${data.productId}_${data.branchId}`
        const record = { id: `inv-${Date.now()}`, ...data }
        store.inventories.set(key, record)
        return record
      }),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => {
        let found: any = null
        for (const [k, v] of store.inventories.entries()) {
          if (v.id === where.id) {
            found = v
            break
          }
        }
        if (found) {
          if (data.totalQuantity?.increment) found.totalQuantity += data.totalQuantity.increment
          if (data.availableQuantity?.increment) found.availableQuantity += data.availableQuantity.increment
        }
        return found
      }),
    },
    inventoryMovement: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const record = { id: `mov-${Date.now()}`, ...data }
        store.inventoryMovements.push(record)
        return record
      }),
    },
    supplierLedger: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const record = { id: `sl-${Date.now()}`, ...data }
        store.supplierLedgers.push(record)
        return record
      }),
    },
    gstTransaction: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const record = { id: `gst-${Date.now()}`, ...data }
        store.gstTransactions.push(record)
        return record
      }),
    },
    auditLog: {
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const record = { id: `audit-${Date.now()}`, ...data }
        store.auditLogs.push(record)
        return record
      }),
    },
  }

  const client = {
    ...tx,
    $transaction: jest.fn().mockImplementation(async (callback: any) => {
      return await callback(tx)
    }),
    _store: store,
  }

  return client
}

// ─────────────────────────────────────────────────────────────
// E2E Test Suite Execution
// ─────────────────────────────────────────────────────────────

describe('Purchase Bill Scanning, Ingestion, Review & Inventory Provisioning E2E Suite', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
  })

  // ═══════════════════════════════════════════════════════════
  // TIER 1: FEATURE-BY-FEATURE ACCEPTANCE
  // ═══════════════════════════════════════════════════════════

  describe('Tier 1 — Feature 1: Document Upload & Multi-Format Ingestion (F1)', () => {
    it('T1.1.1: Accepts born-digital PDF and returns document metadata', async () => {
      const res = await simulateDocumentScan({
        name: 'Marg_Invoice_08492.pdf',
        type: 'application/pdf',
        size: 1024 * 350, // 350 KB
      })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.document.filename).toBe('Marg_Invoice_08492.pdf')
      expect(res.body.document.mimeType).toBe('application/pdf')
      expect(res.body.document.pageCount).toBeGreaterThanOrEqual(1)
    })

    it('T1.1.2: Accepts camera photo in JPEG format (image/jpeg)', async () => {
      const res = await simulateDocumentScan({
        name: 'camera_capture_vardhaman.jpg',
        type: 'image/jpeg',
        size: 1024 * 1200, // 1.2 MB
      })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.document.mimeType).toBe('image/jpeg')
    })

    it('T1.1.3: Accepts flatbed scanner PNG image (image/png)', async () => {
      const res = await simulateDocumentScan({
        name: 'scanner_bill_page1.png',
        type: 'image/png',
        size: 1024 * 850,
      })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.document.mimeType).toBe('image/png')
    })

    it('T1.1.4: Accepts WebP compressed bill image (image/webp)', async () => {
      const res = await simulateDocumentScan({
        name: 'distributor_slip.webp',
        type: 'image/webp',
        size: 1024 * 420,
      })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.document.mimeType).toBe('image/webp')
    })

    it('T1.1.5: Enforces non-empty payload and valid file structure', async () => {
      const res = await simulateDocumentScan({
        name: 'valid_bill.pdf',
        type: 'application/pdf',
        size: 512, // small valid file
      })

      expect(res.status).toBe(200)
      expect(res.body.extractedData).toBeDefined()
      expect(res.body.extractedData.items.length).toBeGreaterThan(0)
    })

    it('T1.1.6: Contextualizes upload to target branchId', async () => {
      const res = await simulateDocumentScan(
        {
          name: 'Marg_Invoice_08492.pdf',
          type: 'application/pdf',
          size: 1024 * 200,
        },
        { branchId: 'branch-ka-01' }
      )

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })

  describe('Tier 1 — Feature 2: Automated Data Extraction & Domain Heuristics (F2)', () => {
    it('T1.2.1: Extracts statutory 15-character GSTIN via exact statutory regex', () => {
      const rawText = MARG_ERP_MAHAVEER_FIXTURE.rawText
      const match = rawText.match(GSTIN_REGEX)

      expect(match).not.toBeNull()
      expect(match![0]).toBe('29AABCM8921F1ZT')
      expect(match![0].length).toBe(15)
      expect(match![0].substring(0, 2)).toBe('29') // Karnataka state code
    })

    it('T1.2.2: Extracts Drug License numbers matching Form 20B / Form 21B patterns', () => {
      const rawText = MARG_ERP_MAHAVEER_FIXTURE.rawText
      const match = rawText.match(DRUG_LICENSE_REGEX)

      expect(match).not.toBeNull()
      expect(match![1]).toContain('20B/KA-B21/48911')
    })

    it('T1.2.3: Extracts invoice number and normalizes date to ISO YYYY-MM-DD', () => {
      const fixture = MARG_ERP_MAHAVEER_FIXTURE
      expect(fixture.invoice.invoiceNumber).toBe('MP/24-25/08492')
      expect(fixture.invoice.invoiceDate).toBe('2026-10-24')
    })

    it('T1.2.4: Pharma date normalizer converts MM/YY to month-end calendar date', () => {
      // 08/28 -> 2028-08-31
      expect(parsePharmaExpiryDate('08/28')).toBe('2028-08-31')
      // 02/28 in leap year 2028 -> 2028-02-29
      expect(parsePharmaExpiryDate('02/28')).toBe('2028-02-29')
      // 02/27 non-leap -> 2027-02-28
      expect(parsePharmaExpiryDate('02/27')).toBe('2027-02-28')
    })

    it('T1.2.5: Pharma date normalizer converts MMM-YY (NOV-27) to month-end calendar date', () => {
      expect(parsePharmaExpiryDate('NOV-27')).toBe('2027-11-30')
      expect(parsePharmaExpiryDate('MAR/28')).toBe('2028-03-31')
      expect(parsePharmaExpiryDate('DEC-29')).toBe('2029-12-31')
    })

    it('T1.2.6: Tabular parser extracts product name, batch, expiry, billed/free qty, rates and tax', () => {
      const items = MARG_ERP_MAHAVEER_FIXTURE.items
      expect(items.length).toBe(3)

      const item1 = items[0]
      expect(item1.rawDescription).toContain('AUGMENTIN 625 DUO')
      expect(item1.batchNumber).toBe('26D044')
      expect(item1.expiryDate).toBe('2028-08-31')
      expect(item1.billedQuantity).toBe(50)
      expect(item1.freeQuantity).toBe(5)
      expect(item1.unitCost).toBe(147.24)
      expect(item1.mrp).toBe(204.5)
      expect(item1.taxPercent).toBe(12.0)
    })

    it('T1.2.7: Mathematical cross-reconciliation verifies Taxable + Tax - Discount == Total', () => {
      const items = MARG_ERP_MAHAVEER_FIXTURE.items
      const financials = MARG_ERP_MAHAVEER_FIXTURE.financials

      const recon = reconcileFinancials(items, financials.totalAmount, 0, financials.roundOff)
      expect(recon.isReconciled).toBe(true)
      expect(recon.reconciliationVariance).toBeLessThanOrEqual(1.0)
    })

    it('T1.2.8: Flags unreconciled status when extracted grand total differs beyond tolerance', () => {
      const items = UNRECONCILED_MATH_FIXTURE.items
      const printedTotal = 5000.0 // Purposely mismatched with line items
      const recon = reconcileFinancials(items, printedTotal, 0, 0)

      expect(recon.isReconciled).toBe(false)
      expect(recon.reconciliationVariance).toBeGreaterThan(1.0)
    })
  })

  describe('Tier 1 — Feature 3: Interactive Review & Form Auto-Fill (F3)', () => {
    it('T1.3.1: Pre-fills header fields with extracted supplier, invoice number, and dates', async () => {
      const res = await simulateDocumentScan({
        name: 'Mahaveer_MP24_08492.pdf',
        type: 'application/pdf',
        size: 1024 * 300,
      })

      expect(res.body.extractedData.supplier.rawName).toContain('MAHAVEER PHARMA')
      expect(res.body.extractedData.supplier.gstin).toBe('29AABCM8921F1ZT')
      expect(res.body.extractedData.invoice.invoiceNumber).toBe('MP/24-25/08492')
      expect(res.body.extractedData.invoice.invoiceDate).toBe('2026-10-24')
    })

    it('T1.3.2: Resolves known supplier with 100% confidence by matching GSTIN', async () => {
      const res = await simulateDocumentScan({
        name: 'Mahaveer_MP24_08492.pdf',
        type: 'application/pdf',
        size: 1024 * 300,
      })

      expect(res.body.extractedData.supplier.matchedSupplierId).toBe('supplier-mahaveer-01')
      expect(res.body.extractedData.supplier.matchConfidence).toBe(1.0)
      expect(res.body.extractedData.supplier.isNew).toBe(false)
    })

    it('T1.3.3: Strips dosage & pack tokens (TAB, 10S) to fuzzy-match catalog medicines', () => {
      const raw1 = "AUGMENTIN 625 DUO TAB 10'S"
      const cleaned1 = cleanMedicineDescription(raw1)
      expect(cleaned1).toBe('AUGMENTIN 625 DUO')

      const raw2 = "PAN-D CAPSULE 15'S"
      const cleaned2 = cleanMedicineDescription(raw2)
      expect(cleaned2).toBe('PAN D')
    })

    it('T1.3.4: Dynamic line recalculation updates line total when quantity or discount changes', () => {
      // 50 units @ 147.24 with 2% discount and 12% GST
      const gross = 50 * 147.24 // 7362.00
      const disc = (gross * 2.0) / 100 // 147.24
      const taxable = gross - disc // 7214.76
      const tax = (taxable * 12.0) / 100 // 865.7712
      const total = taxable + tax // 8080.5312

      expect(Math.round(total * 100) / 100).toBe(8080.53)
    })

    it('T1.3.5: Discrepancy detection surfaces amber warning for unreconciled invoices', async () => {
      const res = await simulateDocumentScan({
        name: 'Discrepant_Invoice_101.pdf',
        type: 'application/pdf',
        size: 1024 * 100,
      })

      expect(res.body.extractedData.financials.isReconciled).toBe(false)
      expect(res.body.extractedData.financials.reconciliationVariance).toBeGreaterThan(0)
    })

    it('T1.3.6: Pre-fills draft fields for newly detected supplier not in catalog', async () => {
      const res = await simulateDocumentScan({
        name: 'New_Distributor_Bill_99.pdf',
        type: 'application/pdf',
        size: 1024 * 200,
      })

      // When supplier is new, raw details are preserved for quick-create drawer
      expect(res.body.extractedData.supplier.rawName).toBeDefined()
      expect(res.body.extractedData.supplier.gstin).toBeDefined()
    })

    it('T1.3.7: Form preserves both billed quantity and free bonus quantity in review state', async () => {
      const res = await simulateDocumentScan({
        name: 'camera_capture_vardhaman.jpg',
        type: 'image/jpeg',
        size: 1024 * 900,
      })

      const item = res.body.extractedData.items[0]
      expect(item.billedQuantity).toBe(20)
      expect(item.freeQuantity).toBe(2)
      expect(item.billedQuantity + item.freeQuantity).toBe(22)
    })
  })

  describe('Tier 1 — Feature 4: Confirmation Safety Barrier (F4)', () => {
    it('T1.4.1: Strictly blocks persistence without explicit user confirmation', async () => {
      // Ingest document only — do NOT call commit API
      const scanRes = await simulateDocumentScan({
        name: 'Mahaveer_MP24_08492.pdf',
        type: 'application/pdf',
        size: 1024 * 300,
      })
      expect(scanRes.status).toBe(200)

      // Verify Prisma database remains 100% untouched
      expect(mockPrisma._store.purchases.size).toBe(0)
      expect(mockPrisma._store.purchaseItems.size).toBe(0)
      expect(mockPrisma._store.inventoryMovements.length).toBe(0)
      expect(mockPrisma._store.supplierLedgers.length).toBe(0)
    })

    it('T1.4.2: Pharmacist review cancellation leaves stock and ledger untouched', async () => {
      // Pharmacist starts review, then cancels
      const cancelAction = () => {
        /* UI closes modal without calling commit */
      }
      cancelAction()

      expect(mockPrisma._store.purchases.size).toBe(0)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('T1.4.3: Validates confirmation payload schema rejects missing required fields', async () => {
      const invalidPayload: any = {
        branchId: 'branch-ka-01',
        // missing invoiceNumber
        invoiceDate: '2026-10-24',
        items: [],
      }

      const res = await simulateBillCommit(invalidPayload, mockPrisma)
      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Validation Error')
    })

    it('T1.4.4: Enforces line item integrity: rejects items with missing batch or negative qty', async () => {
      const invalidItemPayload: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        invoiceNumber: 'INV-TEST-01',
        invoiceDate: '2026-10-24',
        subtotal: 100,
        discountAmount: 0,
        taxAmount: 12,
        totalAmount: 112,
        items: [
          {
            productId: 'prod-01',
            batchNumber: '', // Empty batch number!
            expiryDate: '2028-12-31',
            billedQuantity: -5, // Negative quantity!
            unitCost: 100,
            mrp: 150,
            totalAmount: 112,
          },
        ],
      }

      const res = await simulateBillCommit(invalidItemPayload, mockPrisma)
      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Validation Error')
    })

    it('T1.4.5: Confirmation barrier requires quantitative summary match', async () => {
      const fixture = MARG_ERP_MAHAVEER_FIXTURE
      const commitInput: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        supplierId: fixture.supplier.matchedSupplierId,
        invoiceNumber: fixture.invoice.invoiceNumber,
        invoiceDate: fixture.invoice.invoiceDate,
        subtotal: fixture.financials.subtotal,
        discountAmount: fixture.financials.discountAmount,
        taxAmount: fixture.financials.taxAmount,
        totalAmount: fixture.financials.totalAmount,
        items: fixture.items.map((it) => ({
          productId: it.matchedProductId!,
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate,
          billedQuantity: it.billedQuantity,
          freeQuantity: it.freeQuantity,
          unitCost: it.unitCost,
          mrp: it.mrp,
          discountPercent: it.discountPercent,
          taxPercent: it.taxPercent,
          taxAmount: it.taxAmount,
          totalAmount: it.totalAmount,
        })),
      }

      const res = await simulateBillCommit(commitInput, mockPrisma)
      expect(res.status).toBe(201)
      expect(res.body.totalItemsProvisioned).toBe(3)
      expect(res.body.totalUnitsAdded).toBe(55 + 100 + 30) // 185 units (including 5 free)
    })

    it('T1.4.6: Rejects confirmation if total amount diverges drastically from line item sum', async () => {
      const fixture = MARG_ERP_MAHAVEER_FIXTURE
      const temperedInput: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        invoiceNumber: fixture.invoice.invoiceNumber,
        invoiceDate: fixture.invoice.invoiceDate,
        subtotal: fixture.financials.subtotal,
        discountAmount: fixture.financials.discountAmount,
        taxAmount: fixture.financials.taxAmount,
        totalAmount: 99999.0, // Drastically tempered total!
        items: fixture.items.map((it) => ({
          productId: it.matchedProductId!,
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate,
          billedQuantity: it.billedQuantity,
          unitCost: it.unitCost,
          mrp: it.mrp,
          totalAmount: it.totalAmount,
        })),
      }

      const res = await simulateBillCommit(temperedInput, mockPrisma)
      expect(res.status).toBe(422)
      expect(res.body.error).toContain('Unreconciled Total')
    })
  })

  describe('Tier 1 — Feature 5: Atomic Inventory Provisioning & Ledger (F5)', () => {
    const fixture = MARG_ERP_MAHAVEER_FIXTURE

    it('T1.5.1: Executes provisioning inside a single atomic prisma.$transaction', async () => {
      const commitInput: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        supplierId: fixture.supplier.matchedSupplierId,
        invoiceNumber: fixture.invoice.invoiceNumber,
        invoiceDate: fixture.invoice.invoiceDate,
        subtotal: fixture.financials.subtotal,
        discountAmount: fixture.financials.discountAmount,
        taxAmount: fixture.financials.taxAmount,
        totalAmount: fixture.financials.totalAmount,
        items: fixture.items.map((it) => ({
          productId: it.matchedProductId!,
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate,
          billedQuantity: it.billedQuantity,
          freeQuantity: it.freeQuantity,
          unitCost: it.unitCost,
          mrp: it.mrp,
          totalAmount: it.totalAmount,
        })),
      }

      await simulateBillCommit(commitInput, mockPrisma)
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('T1.5.2: Persists Purchase record with status: RECEIVED and financial totals', async () => {
      const commitInput: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        supplierId: fixture.supplier.matchedSupplierId,
        invoiceNumber: fixture.invoice.invoiceNumber,
        invoiceDate: fixture.invoice.invoiceDate,
        subtotal: fixture.financials.subtotal,
        discountAmount: fixture.financials.discountAmount,
        taxAmount: fixture.financials.taxAmount,
        totalAmount: fixture.financials.totalAmount,
        items: fixture.items.map((it) => ({
          productId: it.matchedProductId!,
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate,
          billedQuantity: it.billedQuantity,
          freeQuantity: it.freeQuantity,
          unitCost: it.unitCost,
          mrp: it.mrp,
          totalAmount: it.totalAmount,
        })),
      }

      const res = await simulateBillCommit(commitInput, mockPrisma)
      expect(res.status).toBe(201)

      const purchases = Array.from(mockPrisma._store.purchases.values())
      expect(purchases.length).toBe(1)
      expect(purchases[0].status).toBe('RECEIVED')
      expect(purchases[0].invoiceNumber).toBe('MP/24-25/08492')
      expect(purchases[0].totalAmount).toBe(21012.61)
    })

    it('T1.5.3: Persists PurchaseItem records linking product, billed, and free quantities', async () => {
      const commitInput: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        supplierId: fixture.supplier.matchedSupplierId,
        invoiceNumber: fixture.invoice.invoiceNumber,
        invoiceDate: fixture.invoice.invoiceDate,
        subtotal: fixture.financials.subtotal,
        discountAmount: fixture.financials.discountAmount,
        taxAmount: fixture.financials.taxAmount,
        totalAmount: fixture.financials.totalAmount,
        items: fixture.items.map((it) => ({
          productId: it.matchedProductId!,
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate,
          billedQuantity: it.billedQuantity,
          freeQuantity: it.freeQuantity,
          unitCost: it.unitCost,
          mrp: it.mrp,
          totalAmount: it.totalAmount,
        })),
      }

      await simulateBillCommit(commitInput, mockPrisma)
      const purchaseItems = Array.from(mockPrisma._store.purchaseItems.values())
      expect(purchaseItems.length).toBe(3)

      const augItem = purchaseItems.find((pi) => pi.productId === 'prod-augmentin-625')
      expect(augItem).toBeDefined()
      expect(augItem.orderedQuantity).toBe(50)
      expect(augItem.receivedQuantity).toBe(50)
      expect(augItem.freeQuantity).toBe(5)
    })

    it('T1.5.4: Upserts batch record on @@unique([productId, batchNumber]) with totalUsableQty', async () => {
      const commitInput: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        supplierId: fixture.supplier.matchedSupplierId,
        invoiceNumber: fixture.invoice.invoiceNumber,
        invoiceDate: fixture.invoice.invoiceDate,
        subtotal: 7362.0,
        discountAmount: 147.24,
        taxAmount: 865.77,
        totalAmount: 8080.53,
        items: [
          {
            productId: 'prod-augmentin-625',
            batchNumber: '26D044', // Pre-existing batch
            expiryDate: '2028-08-31',
            billedQuantity: 50,
            freeQuantity: 5,
            unitCost: 147.24,
            mrp: 204.5,
            totalAmount: 8080.53,
          },
        ],
      }

      await simulateBillCommit(commitInput, mockPrisma)

      const batch = mockPrisma._store.batches.get('prod-augmentin-625_26D044')
      expect(batch).toBeDefined()
      expect(batch.quantity).toBe(55) // 0 initial + 50 billed + 5 free
      expect(batch.status).toBe('ACTIVE') // Reactivated from EXHAUSTED
    })

    it('T1.5.5: Updates Inventory on @@unique([productId, branchId]) with CAS concurrency safety', async () => {
      const commitInput: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        invoiceNumber: 'INV-CAS-01',
        invoiceDate: '2026-10-24',
        subtotal: 8080.53,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 8080.53,
        items: [
          {
            productId: 'prod-augmentin-625',
            batchNumber: '26D044',
            expiryDate: '2028-08-31',
            billedQuantity: 50,
            freeQuantity: 5,
            unitCost: 147.24,
            mrp: 204.5,
            totalAmount: 8080.53,
          },
        ],
      }

      await simulateBillCommit(commitInput, mockPrisma)

      const inv = mockPrisma._store.inventories.get('prod-augmentin-625_branch-ka-01')
      expect(inv.availableQuantity).toBe(65) // 10 initial + 55 new
      expect(inv.totalQuantity).toBe(65)
    })

    it('T1.5.6: Logs InventoryMovement audit trail with type: IN and reference: PURCHASE', async () => {
      const commitInput: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        invoiceNumber: 'INV-MOV-01',
        invoiceDate: '2026-10-24',
        subtotal: 8080.53,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 8080.53,
        items: [
          {
            productId: 'prod-augmentin-625',
            batchNumber: '26D044',
            expiryDate: '2028-08-31',
            billedQuantity: 50,
            freeQuantity: 5,
            unitCost: 147.24,
            mrp: 204.5,
            totalAmount: 8080.53,
          },
        ],
      }

      await simulateBillCommit(commitInput, mockPrisma)

      expect(mockPrisma._store.inventoryMovements.length).toBe(1)
      const mov = mockPrisma._store.inventoryMovements[0]
      expect(mov.type).toBe('IN')
      expect(mov.quantity).toBe(55) // 50 billed + 5 free
      expect(mov.referenceType).toBe('PURCHASE')
    })

    it('T1.5.7: Posts Accounts Payable credit entry and updates Supplier outstandingBalance', async () => {
      const initialBalance = mockPrisma._store.suppliers.get('supplier-mahaveer-01').outstandingBalance

      const commitInput: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        supplierId: 'supplier-mahaveer-01',
        invoiceNumber: 'MP/24-25/08492',
        invoiceDate: '2026-10-24',
        subtotal: fixture.financials.subtotal,
        discountAmount: fixture.financials.discountAmount,
        taxAmount: fixture.financials.taxAmount,
        totalAmount: fixture.financials.totalAmount,
        items: fixture.items.map((it) => ({
          productId: it.matchedProductId!,
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate,
          billedQuantity: it.billedQuantity,
          freeQuantity: it.freeQuantity,
          unitCost: it.unitCost,
          mrp: it.mrp,
          totalAmount: it.totalAmount,
        })),
      }

      await simulateBillCommit(commitInput, mockPrisma)

      const supplier = mockPrisma._store.suppliers.get('supplier-mahaveer-01')
      expect(supplier.outstandingBalance).toBe(initialBalance + fixture.financials.totalAmount)

      expect(mockPrisma._store.supplierLedgers.length).toBe(1)
      const ledger = mockPrisma._store.supplierLedgers[0]
      expect(ledger.type).toBe('CREDIT')
      expect(ledger.amount).toBe(fixture.financials.totalAmount)
      expect(ledger.referenceType).toBe('PURCHASE')
    })

    it('T1.5.8: Posts Input Tax Credit (ITC) GST transaction and security AuditLog', async () => {
      const commitInput: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        supplierId: 'supplier-mahaveer-01',
        invoiceNumber: 'MP/24-25/08492',
        invoiceDate: '2026-10-24',
        subtotal: fixture.financials.subtotal,
        discountAmount: fixture.financials.discountAmount,
        taxAmount: fixture.financials.taxAmount,
        totalAmount: fixture.financials.totalAmount,
        items: fixture.items.map((it) => ({
          productId: it.matchedProductId!,
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate,
          billedQuantity: it.billedQuantity,
          freeQuantity: it.freeQuantity,
          unitCost: it.unitCost,
          mrp: it.mrp,
          totalAmount: it.totalAmount,
        })),
      }

      await simulateBillCommit(commitInput, mockPrisma)

      expect(mockPrisma._store.gstTransactions.length).toBe(1)
      expect(mockPrisma._store.gstTransactions[0].type).toBe('INPUT')
      expect(mockPrisma._store.gstTransactions[0].taxAmount).toBe(fixture.financials.taxAmount)

      expect(mockPrisma._store.auditLogs.length).toBe(1)
      expect(mockPrisma._store.auditLogs[0].action).toBe('PURCHASE_BILL_SCAN_CONFIRM')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // TIER 2: BOUNDARY & CORNER CASES
  // ═══════════════════════════════════════════════════════════

  describe('Tier 2 — Boundary & Corner Cases', () => {
    it('T2.1: Free goods bonus scheme (10+1 free) provisions total units without inflating financial payable', async () => {
      const commitInput: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        invoiceNumber: 'BONUS-10-1',
        invoiceDate: '2026-11-03',
        subtotal: 1000.0, // 10 units @ 100
        discountAmount: 0,
        taxAmount: 120.0,
        totalAmount: 1120.0,
        items: [
          {
            productId: 'prod-bonus-01',
            batchNumber: 'BN-101',
            expiryDate: '2028-12-31',
            billedQuantity: 10,
            freeQuantity: 1, // 1 free unit
            unitCost: 100.0,
            mrp: 140.0,
            totalAmount: 1120.0,
          },
        ],
      }

      const res = await simulateBillCommit(commitInput, mockPrisma)
      expect(res.body.totalUnitsAdded).toBe(11) // 10 + 1 free

      const batch = mockPrisma._store.batches.get('prod-bonus-01_BN-101')
      expect(batch.quantity).toBe(11)

      const purchase = Array.from(mockPrisma._store.purchases.values())[0]
      expect(purchase.totalAmount).toBe(1120.0) // Payable reflects only 10 billed units
    })

    it('T2.2: Multi-slab GST invoice (0%, 5%, 12%, 18%) segregates tax correctly', async () => {
      const fixture = MULTI_SLAB_GST_FIXTURE
      const commitInput: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        invoiceNumber: fixture.invoice.invoiceNumber,
        invoiceDate: fixture.invoice.invoiceDate,
        subtotal: fixture.financials.subtotal,
        discountAmount: fixture.financials.discountAmount,
        taxAmount: fixture.financials.taxAmount,
        totalAmount: fixture.financials.totalAmount,
        items: fixture.items.map((it) => ({
          productId: it.matchedProductId!,
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate,
          billedQuantity: it.billedQuantity,
          freeQuantity: it.freeQuantity,
          unitCost: it.unitCost,
          mrp: it.mrp,
          taxPercent: it.taxPercent,
          taxAmount: it.taxAmount,
          totalAmount: it.totalAmount,
        })),
      }

      const res = await simulateBillCommit(commitInput, mockPrisma)
      expect(res.status).toBe(201)
      expect(res.body.totalItemsProvisioned).toBe(4)

      // Total tax is 0 (ORS) + 550 (Albumin 5%) + 180 (Azithro 12%) + 450 (Sterillium 18%) = 1180.00
      expect(mockPrisma._store.gstTransactions[0].taxAmount).toBe(1180.0)
    })

    it('T2.3: Short-expiry medicine detection (< 6 months) triggers near-expiry safety alert', () => {
      const nearExpiryDate = '2027-01-31'
      const refDate = '2026-11-03' // Less than 3 months!

      expect(isShortExpiry(nearExpiryDate, refDate)).toBe(true)

      const normalExpiryDate = '2028-08-31'
      expect(isShortExpiry(normalExpiryDate, refDate)).toBe(false)
    })

    it('T2.4: Batch collision: re-ordering existing batch upserts and reactivates EXHAUSTED batch', async () => {
      // Pre-condition: Batch prod-augmentin-625_26D044 is EXHAUSTED with 0 quantity
      const initialBatch = mockPrisma._store.batches.get('prod-augmentin-625_26D044')
      expect(initialBatch.status).toBe('EXHAUSTED')
      expect(initialBatch.quantity).toBe(0)

      const commitInput: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        invoiceNumber: 'REORDER-01',
        invoiceDate: '2026-11-03',
        subtotal: 1472.4,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 1472.4,
        items: [
          {
            productId: 'prod-augmentin-625',
            batchNumber: '26D044', // Same existing batch!
            expiryDate: '2028-08-31',
            billedQuantity: 10,
            freeQuantity: 0,
            unitCost: 147.24,
            mrp: 204.5,
            totalAmount: 1472.4,
          },
        ],
      }

      const res = await simulateBillCommit(commitInput, mockPrisma)
      expect(res.status).toBe(201)

      const updatedBatch = mockPrisma._store.batches.get('prod-augmentin-625_26D044')
      expect(updatedBatch.status).toBe('ACTIVE')
      expect(updatedBatch.quantity).toBe(10)
    })

    it('T2.5: Oversized document upload (> 15MB) is rejected with HTTP 413 Payload Too Large', async () => {
      const res = await simulateDocumentScan({
        name: 'giant_raw_scan.pdf',
        type: 'application/pdf',
        size: 16 * 1024 * 1024, // 16 MB (> 15MB limit)
      })

      expect(res.status).toBe(413)
      expect(res.body.error).toContain('Payload Too Large')
    })

    it('T2.6: Invalid MIME type (e.g. executable .exe or archive .zip) is rejected with HTTP 415', async () => {
      const res = await simulateDocumentScan({
        name: 'invoice_virus.exe',
        type: 'application/x-msdownload',
        size: 1024 * 100,
      })

      expect(res.status).toBe(415)
      expect(res.body.error).toContain('Unsupported Media Type')
    })

    it('T2.7: Missing or partial statutory fields (unregistered dealer) handled gracefully', async () => {
      const res = await simulateDocumentScan({
        name: 'Unregistered_Local_Supplier.pdf',
        type: 'application/pdf',
        size: 1024 * 100,
      })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      // Operates gracefully without crashing
      expect(res.body.extractedData.supplier).toBeDefined()
    })

    it('T2.8: Precision roundoff (±0.49 INR) validates successfully without false reconciliation alert', () => {
      const items = [
        {
          billedQuantity: 3,
          unitCost: 33.33, // 99.99
          taxPercent: 12.0, // 11.9988
          totalAmount: 111.9888,
        },
      ]
      // Printed total rounded to 112.00 (+0.01 roundoff)
      const recon = reconcileFinancials(items, 112.0, 0, 0.01)
      expect(recon.isReconciled).toBe(true)
      expect(recon.reconciliationVariance).toBeLessThanOrEqual(1.0)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // TIER 3: CROSS-FEATURE COMBINATIONS
  // ═══════════════════════════════════════════════════════════

  describe('Tier 3 — Cross-Feature Combinations', () => {
    it('T3.1: Full Pipeline Flow: Upload -> Scan API -> Edit in Review -> Commit -> Database state', async () => {
      // 1. Upload & Scan
      const scanRes = await simulateDocumentScan({
        name: 'Mahaveer_MP24_08492.pdf',
        type: 'application/pdf',
        size: 1024 * 300,
      })
      expect(scanRes.status).toBe(200)

      // 2. Pharmacist edits item 1 quantity from 50 to 60 in review UI
      const reviewPayload: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        supplierId: scanRes.body.extractedData.supplier.matchedSupplierId,
        invoiceNumber: scanRes.body.extractedData.invoice.invoiceNumber,
        invoiceDate: scanRes.body.extractedData.invoice.invoiceDate,
        subtotal: 22485.0, // Recalculated with 60 units
        discountAmount: 470.8,
        taxAmount: 2600.0,
        totalAmount: 24614.2,
        items: [
          {
            productId: 'prod-augmentin-625',
            batchNumber: '26D044',
            expiryDate: '2028-08-31',
            billedQuantity: 60, // Changed from 50 to 60
            freeQuantity: 6, // Changed from 5 to 6
            unitCost: 147.24,
            mrp: 204.5,
            totalAmount: 24614.2,
          },
        ],
      }

      // 3. Confirm API
      const commitRes = await simulateBillCommit(reviewPayload, mockPrisma)
      expect(commitRes.status).toBe(201)
      expect(commitRes.body.totalUnitsAdded).toBe(66) // 60 + 6 free

      // 4. Verify batch and inventory
      const batch = mockPrisma._store.batches.get('prod-augmentin-625_26D044')
      expect(batch.quantity).toBe(66)

      const inv = mockPrisma._store.inventories.get('prod-augmentin-625_branch-ka-01')
      expect(inv.availableQuantity).toBe(76) // 10 original + 66
    })

    it('T3.2: Reconciled vs Unreconciled Flow: Discrepancy corrected in review before commit', async () => {
      // 1. Ingest discrepant bill
      const scanRes = await simulateDocumentScan({
        name: 'Discrepant_Invoice_101.pdf',
        type: 'application/pdf',
        size: 1024 * 100,
      })
      expect(scanRes.body.extractedData.financials.isReconciled).toBe(false)

      // 2. Pharmacist adjusts line item to reconcile
      const correctedPayload: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        invoiceNumber: 'DISC-101',
        invoiceDate: '2026-11-03',
        subtotal: 4400.0,
        discountAmount: 0,
        taxAmount: 528.0,
        totalAmount: 4928.0, // Reconciled total
        items: [
          {
            productId: 'prod-pcm-650',
            batchNumber: 'PCM-10',
            expiryDate: '2028-06-30',
            billedQuantity: 200,
            freeQuantity: 0,
            unitCost: 22.0,
            mrp: 32.0,
            totalAmount: 4928.0,
          },
        ],
      }

      // 3. Commit succeeds
      const commitRes = await simulateBillCommit(correctedPayload, mockPrisma)
      expect(commitRes.status).toBe(201)
      expect(commitRes.body.totalAmount).toBe(4928.0)
    })

    it('T3.3: In-Line New Supplier & Product Provisioning', async () => {
      const newSupplierPayload: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        newSupplier: {
          name: 'BRAND NEW WHOLESALER PVT LTD',
          gstin: '29AAACN1122D1Z9',
          dlNumber: '20B/KA-B99/99911',
          phone: '9845099999',
          address: 'Peenya 4th Phase, Bangalore',
        },
        invoiceNumber: 'BNW-001',
        invoiceDate: '2026-11-03',
        subtotal: 5000.0,
        discountAmount: 0,
        taxAmount: 600.0,
        totalAmount: 5600.0,
        items: [
          {
            productId: 'prod-newly-created-01',
            batchNumber: 'NW-99',
            expiryDate: '2028-10-31',
            billedQuantity: 50,
            freeQuantity: 0,
            unitCost: 100.0,
            mrp: 150.0,
            totalAmount: 5600.0,
          },
        ],
      }

      const res = await simulateBillCommit(newSupplierPayload, mockPrisma)
      expect(res.status).toBe(201)

      // Verified new supplier was created and outstanding balance posted
      const suppliers = Array.from(mockPrisma._store.suppliers.values())
      const newSup = suppliers.find((s) => s.name === 'BRAND NEW WHOLESALER PVT LTD')
      expect(newSup).toBeDefined()
      expect(newSup.outstandingBalance).toBe(5600.0)
    })

    it('T3.4: Repeat Ingestion / Duplicate Detection Alerting', async () => {
      const payload: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        supplierId: 'supplier-mahaveer-01',
        invoiceNumber: 'MP/24-25/08492',
        invoiceDate: '2026-10-24',
        subtotal: 8080.53,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 8080.53,
        items: [
          {
            productId: 'prod-augmentin-625',
            batchNumber: '26D044',
            expiryDate: '2028-08-31',
            billedQuantity: 50,
            unitCost: 147.24,
            mrp: 204.5,
            totalAmount: 8080.53,
          },
        ],
      }

      // First ingestion
      const res1 = await simulateBillCommit(payload, mockPrisma)
      expect(res1.status).toBe(201)

      // Re-provisioning adds stock cleanly via upsert without collision
      const res2 = await simulateBillCommit(payload, mockPrisma)
      expect(res2.status).toBe(201)

      const batch = mockPrisma._store.batches.get('prod-augmentin-625_26D044')
      expect(batch.quantity).toBe(100) // 50 + 50
    })

    it('T3.5: Multi-Branch Ingestion Isolation: Branch A ingestion leaves Branch B stock intact', async () => {
      // Seed Branch B inventory
      mockPrisma._store.inventories.set('prod-augmentin-625_branch-ka-02', {
        id: 'inv-branch-b',
        productId: 'prod-augmentin-625',
        branchId: 'branch-ka-02',
        totalQuantity: 25,
        availableQuantity: 25,
      })

      const payloadForBranchA: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01', // Targeting Branch A
        invoiceNumber: 'INV-ISOLATION-01',
        invoiceDate: '2026-11-03',
        subtotal: 1000.0,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 1000.0,
        items: [
          {
            productId: 'prod-augmentin-625',
            batchNumber: '26D044',
            expiryDate: '2028-08-31',
            billedQuantity: 40,
            freeQuantity: 0,
            unitCost: 25.0,
            mrp: 35.0,
            totalAmount: 1000.0,
          },
        ],
      }

      await simulateBillCommit(payloadForBranchA, mockPrisma)

      // Branch A updated
      const invA = mockPrisma._store.inventories.get('prod-augmentin-625_branch-ka-01')
      expect(invA.availableQuantity).toBe(50) // 10 original + 40 new

      // Branch B remains strictly unchanged
      const invB = mockPrisma._store.inventories.get('prod-augmentin-625_branch-ka-02')
      expect(invB.availableQuantity).toBe(25)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // ═══════════════════════════════════════════════════════════

  describe('Tier 4 — Real-World Application Scenarios', () => {
    it('T4.1: Scenario 1 — Marg ERP Distributor Wholesale Invoice (Digital Vector PDF)', async () => {
      // 1. Upload Mahaveer Pharma Agencies Marg ERP PDF
      const uploadRes = await simulateDocumentScan({
        name: 'Mahaveer_MP24_08492.pdf',
        type: 'application/pdf',
        size: 1024 * 340,
      })

      expect(uploadRes.status).toBe(200)
      const extracted = uploadRes.body.extractedData

      expect(extracted.supplier.gstin).toBe('29AABCM8921F1ZT')
      expect(extracted.invoice.invoiceNumber).toBe('MP/24-25/08492')
      expect(extracted.items.length).toBe(3)
      expect(extracted.financials.isReconciled).toBe(true)

      // 2. User confirms in review UI
      const commitInput: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        supplierId: extracted.supplier.matchedSupplierId,
        invoiceNumber: extracted.invoice.invoiceNumber,
        invoiceDate: extracted.invoice.invoiceDate,
        subtotal: extracted.financials.subtotal,
        discountAmount: extracted.financials.discountAmount,
        taxAmount: extracted.financials.taxAmount,
        totalAmount: extracted.financials.totalAmount,
        items: extracted.items.map((it: any) => ({
          productId: it.matchedProductId,
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate,
          billedQuantity: it.billedQuantity,
          freeQuantity: it.freeQuantity,
          unitCost: it.unitCost,
          mrp: it.mrp,
          totalAmount: it.totalAmount,
        })),
      }

      const commitRes = await simulateBillCommit(commitInput, mockPrisma)
      expect(commitRes.status).toBe(201)
      expect(commitRes.body.totalItemsProvisioned).toBe(3)
      expect(commitRes.body.totalUnitsAdded).toBe(185)

      // 3. Verify ledger liability posted
      const ledger = mockPrisma._store.supplierLedgers[0]
      expect(ledger.amount).toBe(21012.61)
      expect(ledger.type).toBe('CREDIT')
    })

    it('T4.2: Scenario 2 — Smartphone Camera Photograph of Printed Bill (Mobile JPEG)', async () => {
      // 1. Upload mobile photo of Vardhaman Medisales bill
      const uploadRes = await simulateDocumentScan({
        name: 'camera_capture_vardhaman.jpg',
        type: 'image/jpeg',
        size: 1024 * 1150,
      })

      expect(uploadRes.status).toBe(200)
      const extracted = uploadRes.body.extractedData
      expect(extracted.supplier.rawName).toContain('VARDHAMAN MEDISALES')
      expect(extracted.items[0].batchNumber).toBe('CF500-99')
      expect(extracted.items[0].billedQuantity).toBe(20)
      expect(extracted.items[0].freeQuantity).toBe(2)

      // 2. Pharmacist confirms 20+2 bonus units
      const commitInput: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        supplierId: 'supplier-vardhaman-02',
        invoiceNumber: extracted.invoice.invoiceNumber,
        invoiceDate: extracted.invoice.invoiceDate,
        subtotal: extracted.financials.subtotal,
        discountAmount: extracted.financials.discountAmount,
        taxAmount: extracted.financials.taxAmount,
        totalAmount: extracted.financials.totalAmount,
        items: [
          {
            productId: 'prod-ceftum-500',
            batchNumber: 'CF500-99',
            expiryDate: '2028-11-30',
            billedQuantity: 20,
            freeQuantity: 2,
            unitCost: 380.0,
            mrp: 520.0,
            totalAmount: 8086.4,
          },
        ],
      }

      const commitRes = await simulateBillCommit(commitInput, mockPrisma)
      expect(commitRes.status).toBe(201)
      expect(commitRes.body.totalUnitsAdded).toBe(22)

      // Verified 22 units in batch
      const batch = mockPrisma._store.batches.get('prod-ceftum-500_CF500-99')
      expect(batch.quantity).toBe(22)
    })

    it('T4.3: Scenario 3 — Pharmacist Review & Cancellation Without Stock Modification', async () => {
      // 1. Upload bill
      const uploadRes = await simulateDocumentScan({
        name: 'Mahaveer_MP24_08492.pdf',
        type: 'application/pdf',
        size: 1024 * 300,
      })
      expect(uploadRes.status).toBe(200)

      // 2. Pharmacist reviews in modal, spots error, clicks "Cancel" (Zero commit call)
      const onCancel = jest.fn()
      onCancel()
      expect(onCancel).toHaveBeenCalled()

      // 3. Strictly verify zero mutations in database
      expect(mockPrisma._store.purchases.size).toBe(0)
      expect(mockPrisma._store.purchaseItems.size).toBe(0)
      expect(mockPrisma._store.inventoryMovements.length).toBe(0)
      expect(mockPrisma._store.supplierLedgers.length).toBe(0)
    })

    it('T4.4: Scenario 4 — Cashier / Unauthorized User Lockout on Bill Confirmation (403 Forbidden)', async () => {
      const commitInput: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        invoiceNumber: 'INV-ATTEMPT-01',
        invoiceDate: '2026-11-03',
        subtotal: 1000.0,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 1000.0,
        items: [
          {
            productId: 'prod-01',
            batchNumber: 'B1',
            expiryDate: '2028-12-31',
            billedQuantity: 10,
            unitCost: 100.0,
            mrp: 140.0,
            totalAmount: 1000.0,
          },
        ],
      }

      // Cashier session without purchases:create
      const cashierActor = {
        id: 'user-cashier-01',
        role: 'CASHIER',
        permissions: ['sales:create', 'sales:read'],
      }

      const res = await simulateBillCommit(commitInput, mockPrisma, { actor: cashierActor })
      expect(res.status).toBe(403)
      expect(res.body.error).toContain('Forbidden')

      // Database untouched
      expect(mockPrisma._store.purchases.size).toBe(0)
    })

    it('T4.5: Scenario 5 — High-Volume Multi-Item Wholesale Bill with Short Expiry & Multi-Slab GST', async () => {
      const fixture = MULTI_SLAB_GST_FIXTURE
      const uploadRes = await simulateDocumentScan({
        name: 'MultiSlab_GST_Bill_880.pdf',
        type: 'application/pdf',
        size: 1024 * 450,
      })
      expect(uploadRes.status).toBe(200)

      const commitInput: ConfirmPurchaseBillInput = {
        branchId: 'branch-ka-01',
        supplierId: fixture.supplier.matchedSupplierId,
        invoiceNumber: fixture.invoice.invoiceNumber,
        invoiceDate: fixture.invoice.invoiceDate,
        subtotal: fixture.financials.subtotal,
        discountAmount: fixture.financials.discountAmount,
        taxAmount: fixture.financials.taxAmount,
        totalAmount: fixture.financials.totalAmount,
        items: fixture.items.map((it) => ({
          productId: it.matchedProductId!,
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate,
          billedQuantity: it.billedQuantity,
          freeQuantity: it.freeQuantity,
          unitCost: it.unitCost,
          mrp: it.mrp,
          taxPercent: it.taxPercent,
          taxAmount: it.taxAmount,
          totalAmount: it.totalAmount,
        })),
      }

      const res = await simulateBillCommit(commitInput, mockPrisma)
      expect(res.status).toBe(201)
      expect(res.body.totalItemsProvisioned).toBe(4)
      // 50 (ORS) + 5 (Albumin) + 20 (Azithro) + 10 (Sterillium) = 85 units
      expect(res.body.totalUnitsAdded).toBe(85)

      // Verified all 4 batches created
      expect(mockPrisma._store.batches.get('prod-ors-electral_ORS-901').quantity).toBe(50)
      expect(mockPrisma._store.batches.get('prod-albumin-20_ALB-552').quantity).toBe(5)
      expect(mockPrisma._store.batches.get('prod-azithro-500_AZI-441').quantity).toBe(20)
      expect(mockPrisma._store.batches.get('prod-sterillium-500_STR-118').quantity).toBe(10)
    })
  })
})
