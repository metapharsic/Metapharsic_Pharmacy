/**
 * Test Harness & Reference Contract Simulator for Purchase Bill Scanning E2E Tests
 * Strictly implements the interface contracts defined in PROJECT.md and IMPLEMENTATION_PLAN.md.
 */

import {
  MARG_ERP_MAHAVEER_FIXTURE,
  SMARTPHONE_CAMERA_VARDHAMAN_FIXTURE,
  SHORT_EXPIRY_FIXTURE,
  MULTI_SLAB_GST_FIXTURE,
  UNRECONCILED_MATH_FIXTURE,
  type MockInvoiceFixture,
} from '@/lib/scanner/__fixtures__/distributor-invoices'

// ─── Interfaces from PROJECT.md ─────────────────────────────

export interface ExtractedSupplier {
  rawName: string
  matchedSupplierId?: string
  gstin?: string
  dlNumber?: string
  matchConfidence: number
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
  isNearExpiry?: boolean
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

export interface ConfirmPurchaseBillItemInput {
  productId: string
  batchNumber: string
  expiryDate: string
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

// ─── Domain Pattern & Heuristics Utilities ──────────────────

/**
 * 15-character Indian Statutory GSTIN regex
 * Pattern: 2 digits (state code) + 5 letters (PAN) + 4 digits + 1 letter + 1 entity char + Z + 1 check char
 */
export const GSTIN_REGEX = /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/

/**
 * Drug License Form 20B/21B regex patterns
 */
export const DRUG_LICENSE_REGEX = /\b(?:DL(?:\s*No\.?)?|D\.L\.(?:\s*No\.?)?|D\/L|L\.No|Lic\.?\s*No\.?)[\s\:\-]+([A-Za-z0-9\/\-\,\s]{5,40})\b/i

/**
 * Normalizes pharmaceutical expiry date tokens into ISO YYYY-MM-DD
 * Format conversions:
 * - MM/YY (e.g. 08/28 -> 2028-08-31)
 * - MM/YYYY (e.g. 08/2028 -> 2028-08-31)
 * - MMM-YY (e.g. NOV-27 -> 2027-11-30)
 * - DD/MM/YYYY (e.g. 15/04/2028 -> 2028-04-15)
 */
export function parsePharmaExpiryDate(input: string): string {
  const trimmed = input.trim().toUpperCase()

  // Case 1: Exact DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0')
    const month = dmyMatch[2].padStart(2, '0')
    const year = dmyMatch[3]
    return `${year}-${month}-${day}`
  }

  // Month lookup for text representations
  const monthMap: Record<string, number> = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
  }

  let month = 0
  let year = 0

  // Case 2: MMM-YY or MMM/YY (e.g. NOV-27, MAR/28)
  const mmmYyMatch = trimmed.match(/^([A-Z]{3})[\/\-](\d{2,4})$/)
  if (mmmYyMatch && monthMap[mmmYyMatch[1]]) {
    month = monthMap[mmmYyMatch[1]]
    let y = parseInt(mmmYyMatch[2], 10)
    year = y < 100 ? 2000 + y : y
  } else {
    // Case 3: MM/YY or MM-YY or MM/YYYY
    const mmYyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{2,4})$/)
    if (mmYyMatch) {
      month = parseInt(mmYyMatch[1], 10)
      let y = parseInt(mmYyMatch[2], 10)
      year = y < 100 ? 2000 + y : y
    }
  }

  if (month >= 1 && month <= 12 && year >= 2000) {
    // Find last calendar day of the month
    const lastDay = new Date(year, month, 0).getDate()
    const mm = String(month).padStart(2, '0')
    const dd = String(lastDay).padStart(2, '0')
    return `${year}-${mm}-${dd}`
  }

  // Fallback to ISO parsing or current date
  const parsed = new Date(input)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0]
  }

  throw new Error(`Invalid pharmaceutical expiry date format: "${input}"`)
}

/**
 * Checks if a given expiry date is within 6 months of reference date
 */
export function isShortExpiry(expiryDateIso: string, referenceDateIso: string = '2026-11-03'): boolean {
  const expiry = new Date(expiryDateIso)
  const ref = new Date(referenceDateIso)
  const diffTime = expiry.getTime() - ref.getTime()
  const diffDays = diffTime / (1000 * 3600 * 24)
  return diffDays < 180 && diffDays > 0
}

/**
 * Cross-reconciles financial totals:
 * Taxable + Tax - Discount ± RoundOff == Extracted Total
 */
export function reconcileFinancials(
  items: Array<{
    billedQuantity: number
    unitCost: number
    discountPercent?: number
    taxPercent?: number
    totalAmount?: number
  }>,
  extractedTotal: number,
  globalDiscount: number = 0,
  roundOff: number = 0
): {
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  isReconciled: boolean
  reconciliationVariance: number
} {
  let subtotal = 0
  let totalDiscount = globalDiscount
  let totalTax = 0

  for (const item of items) {
    const gross = item.billedQuantity * item.unitCost
    const discPct = item.discountPercent || 0
    const discAmt = (gross * discPct) / 100
    const taxable = gross - discAmt
    const taxPct = item.taxPercent || 0
    const taxAmt = (taxable * taxPct) / 100

    subtotal += gross
    totalDiscount += discAmt
    totalTax += taxAmt
  }

  const computedTotal = subtotal - totalDiscount + totalTax + roundOff
  const variance = Math.abs(computedTotal - extractedTotal)
  const isReconciled = variance <= 1.0 // Within 1.00 INR tolerance

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(totalDiscount * 100) / 100,
    taxAmount: Math.round(totalTax * 100) / 100,
    totalAmount: Math.round(computedTotal * 100) / 100,
    isReconciled,
    reconciliationVariance: Math.round(variance * 100) / 100,
  }
}

/**
 * Entity Resolution: Medicine name cleaner
 * Strips dosage and pack indicators (TAB, CAPSULE, SYP, 10'S, etc.)
 */
export function cleanMedicineDescription(raw: string): string {
  return raw
    .replace(/\b(TABLET|TABLETS|TAB|TABS|CAPSULE|CAPSULES|CAP|CAPS|SYRUP|SYP|INJECTION|INJ|OINTMENT|OINT|GEL|DROPS|LOTION)\b/gi, '')
    .replace(/\b(\d+['’]S|\d+\s*X\s*\d+|\d+\s*ML|\d+\s*MG|\d+\s*GM)\b/gi, '')
    .replace(/\b(IP|BP|USP)\b/gi, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Simulates the Document Scan API (POST /api/purchases/scan)
 */
export async function simulateDocumentScan(
  file: { name: string; type: string; size: number; buffer?: Buffer },
  options: { branchId?: string; actor?: { id: string; role: string; permissions: string[] } } = {}
): Promise<{ status: number; body: any }> {
  // 1. RBAC check
  const permissions = options.actor?.permissions || ['purchases:create', 'purchases:read']
  if (!permissions.includes('purchases:create')) {
    return {
      status: 403,
      body: { error: 'Forbidden: Insufficient permissions to scan purchase bills' },
    }
  }

  // 2. MIME type check
  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  if (!allowedMimeTypes.includes(file.type)) {
    return {
      status: 415,
      body: {
        error: `Unsupported Media Type: "${file.type}". Allowed formats: PDF, JPEG, PNG, WebP.`,
      },
    }
  }

  // 3. File size check (Max 15MB = 15 * 1024 * 1024 bytes)
  const MAX_SIZE = 15 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return {
      status: 413,
      body: {
        error: `Payload Too Large: File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds 15MB limit.`,
      },
    }
  }

  // 4. Return matching fixture based on filename or default
  let fixture: MockInvoiceFixture = MARG_ERP_MAHAVEER_FIXTURE
  if (file.name.includes('camera') || file.name.includes('vardhaman') || file.type.startsWith('image/')) {
    fixture = SMARTPHONE_CAMERA_VARDHAMAN_FIXTURE
  } else if (file.name.includes('ShortExpiry')) {
    fixture = SHORT_EXPIRY_FIXTURE
  } else if (file.name.includes('MultiSlab')) {
    fixture = MULTI_SLAB_GST_FIXTURE
  } else if (file.name.includes('Discrepant')) {
    fixture = UNRECONCILED_MATH_FIXTURE
  }

  const response: ScanBillResponse = {
    success: true,
    confidence: fixture.supplier.matchConfidence * 0.95,
    document: {
      filename: file.name,
      mimeType: file.type,
      pageCount: fixture.pageCount,
    },
    extractedData: {
      supplier: { ...fixture.supplier },
      invoice: { ...fixture.invoice },
      items: fixture.items.map((item) => ({ ...item })),
      financials: { ...fixture.financials },
    },
  }

  return { status: 200, body: response }
}

/**
 * Simulates the Bill Confirmation & Provisioning Transaction (POST /api/purchases/scan/commit)
 * Executes with strict invariants:
 * - Free items: totalUsableQty = billedQuantity + freeQuantity added to inventory
 * - Batch upsert on (productId, batchNumber) increments quantity and reactivates EXHAUSTED to ACTIVE
 * - CAS Inventory update on (productId, branchId) increments availableQuantity
 * - InventoryMovement logged with type: 'IN'
 * - SupplierLedger posted with CREDIT liability
 */
export async function simulateBillCommit(
  payload: ConfirmPurchaseBillInput,
  mockPrisma: any,
  options: { actor?: { id: string; role: string; permissions: string[] } } = {}
): Promise<{ status: number; body: any }> {
  // 1. Authorization check
  const permissions = options.actor?.permissions || ['purchases:create']
  if (!permissions.includes('purchases:create')) {
    return {
      status: 403,
      body: { error: 'Forbidden: Insufficient permissions to confirm purchase bill' },
    }
  }

  // 2. Strict Schema Validation
  if (!payload.branchId || !payload.invoiceNumber || !payload.invoiceDate || !payload.items || payload.items.length === 0) {
    return {
      status: 400,
      body: { error: 'Validation Error: Missing mandatory bill header or items' },
    }
  }

  for (const item of payload.items) {
    if (!item.productId || !item.batchNumber || !item.expiryDate || item.billedQuantity <= 0) {
      return {
        status: 400,
        body: { error: `Validation Error: Invalid line item fields for batch ${item.batchNumber}` },
      }
    }
  }

  // 3. Mathematical Integrity Check (Confirmation Barrier)
  const itemTotalSum = payload.items.reduce((acc, it) => acc + it.totalAmount, 0)
  if (Math.abs(itemTotalSum - payload.totalAmount) > 2.0) {
    return {
      status: 422,
      body: {
        error: `Unreconciled Total: Sum of line items (${itemTotalSum.toFixed(2)}) differs from payload total (${payload.totalAmount.toFixed(2)})`,
      },
    }
  }

  // 4. Atomic Transaction Execution
  const sessionUserId = options.actor?.id || 'user-admin-01'

  const result = await mockPrisma.$transaction(async (tx: any) => {
    // 4.1 Supplier resolution / creation
    let supplierId = payload.supplierId
    if (!supplierId && payload.newSupplier) {
      const created = await tx.supplier.create({
        data: {
          name: payload.newSupplier.name,
          gstin: payload.newSupplier.gstin,
          dlNumber: payload.newSupplier.dlNumber,
          phone: payload.newSupplier.phone,
          address: payload.newSupplier.address,
          isActive: true,
          outstandingBalance: 0,
        },
      })
      supplierId = created.id
    }

    // 4.2 Purchase header persistence
    const purchase = await tx.purchase.create({
      data: {
        purchaseNumber: `PB-${Date.now()}`,
        branchId: payload.branchId,
        supplierId: supplierId || 'supplier-default-01',
        invoiceNumber: payload.invoiceNumber,
        invoiceDate: new Date(payload.invoiceDate),
        purchaseDate: new Date(),
        status: 'RECEIVED',
        subtotal: payload.subtotal,
        discountAmount: payload.discountAmount,
        taxAmount: payload.taxAmount,
        totalAmount: payload.totalAmount,
        balanceDue: payload.totalAmount,
        createdById: sessionUserId,
        notes: payload.notes || 'Ingested via Automated Purchase Bill Scanner',
      },
    })

    let totalUnitsAdded = 0

    // 4.3 Line items provisioning
    for (const item of payload.items) {
      const totalUsableQty = item.billedQuantity + (item.freeQuantity || 0)
      totalUnitsAdded += totalUsableQty

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
      })

      // Batch Upsert on @@unique([productId, batchNumber])
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
          status: 'ACTIVE', // Reactivates EXHAUSTED batch
          purchasePrice: item.unitCost,
          mrp: item.mrp,
          expiryDate: new Date(item.expiryDate),
        },
      })

      // Link batchId to purchaseItem
      await tx.purchaseItem.update({
        where: { id: purchaseItem.id },
        data: { batchId: batch.id },
      })

      // CAS Inventory Update on @@unique([productId, branchId])
      const existingInv = await tx.inventory.findUnique({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId: payload.branchId,
          },
        },
      })

      if (existingInv) {
        await tx.inventory.update({
          where: { id: existingInv.id },
          data: {
            totalQuantity: { increment: totalUsableQty },
            availableQuantity: { increment: totalUsableQty },
          },
        })
      } else {
        await tx.inventory.create({
          data: {
            productId: item.productId,
            branchId: payload.branchId,
            totalQuantity: totalUsableQty,
            availableQuantity: totalUsableQty,
          },
        })
      }

      // Log InventoryMovement Audit Trail
      await tx.inventoryMovement.create({
        data: {
          inventoryId: existingInv ? existingInv.id : 'inv-new-id',
          type: 'IN',
          quantity: totalUsableQty,
          quantityBefore: existingInv ? existingInv.availableQuantity : 0,
          quantityAfter: (existingInv ? existingInv.availableQuantity : 0) + totalUsableQty,
          referenceType: 'PURCHASE',
          referenceId: purchase.id,
          batchId: batch.id,
          notes: `Purchase bill auto-provision: Inv #${payload.invoiceNumber}, Batch ${item.batchNumber}`,
          createdById: sessionUserId,
        },
      })
    }

    // 4.4 Accounts Payable Supplier Ledger Posting
    if (supplierId) {
      await tx.supplier.update({
        where: { id: supplierId },
        data: {
          outstandingBalance: { increment: payload.totalAmount },
        },
      })

      await tx.supplierLedger.create({
        data: {
          supplierId,
          type: 'CREDIT',
          amount: payload.totalAmount,
          balance: payload.totalAmount,
          referenceType: 'PURCHASE',
          referenceId: purchase.id,
          description: `Purchase Bill Inv #${payload.invoiceNumber}`,
        },
      })
    }

    // 4.5 Input Tax Credit (ITC) GST Posting
    await tx.gstTransaction.create({
      data: {
        type: 'INPUT',
        purchaseId: purchase.id,
        taxAmount: payload.taxAmount,
        invoiceNumber: payload.invoiceNumber,
      },
    })

    // 4.6 Security AuditLog
    await tx.auditLog.create({
      data: {
        action: 'PURCHASE_BILL_SCAN_CONFIRM',
        entity: 'Purchase',
        entityId: purchase.id,
        userId: sessionUserId,
        branchId: payload.branchId,
        details: JSON.stringify({
          invoiceNumber: payload.invoiceNumber,
          supplierId,
          itemCount: payload.items.length,
          totalAmount: payload.totalAmount,
          totalUnitsAdded,
        }),
      },
    })

    return {
      success: true,
      purchaseId: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      totalItemsProvisioned: payload.items.length,
      totalUnitsAdded,
      totalAmount: payload.totalAmount,
      status: 'RECEIVED' as const,
    }
  })

  return { status: 201, body: result }
}
