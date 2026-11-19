/**
 * Type definitions and helper functions for Purchase Bill Scanner
 */

export interface ReviewBillItem {
  id: string
  rawDescription?: string
  productId: string
  productName: string
  sku?: string
  packSize?: string
  hsnCode?: string
  matchConfidence: number // 0 to 1 or 0 to 100
  isNewProduct: boolean
  batchNumber: string
  expiryDate: string // YYYY-MM-DD
  billedQuantity: number
  freeQuantity: number
  unitCost: number // PTR
  mrp: number
  ptr?: number
  tabsPerStrip?: number
  stripSellingPrice?: number
  tabletCost?: number
  tabletSellingPrice?: number
  discountPercent: number
  taxPercent: number
  taxAmount: number
  totalAmount: number
  isShortExpiry?: boolean
  validationErrors?: string[]
}

export interface ReviewBillThread {
  threadId: string
  name: string
  pid: number
  status: 'COMPLETED' | 'RUNNING' | 'FAILED' | string
  progressPercent: number
  itemsScanned: number
  discrepanciesCount: number
  executionDurationMs: number
  memoryUsageMb: number
  summary?: Record<string, any>
}

export interface ReviewBillData {
  supplierName: string
  supplierId?: string
  supplierGstin?: string
  supplierDlNumber?: string
  supplierPan?: string
  supplierPhone?: string
  supplierEmail?: string
  supplierAddress?: string
  supplierCity?: string
  supplierState?: string
  supplierPincode?: string
  supplierConfidence: number
  isNewSupplier: boolean
  invoiceNumber: string
  invoiceDate: string // YYYY-MM-DD
  dueDate?: string // YYYY-MM-DD
  branchId: string
  paymentMethod?: 'CASH' | 'CARD' | 'UPI' | 'NETBANKING' | 'CHEQUE' | 'CREDIT'
  paymentReference?: string
  amountPaid?: number
  creditDays?: number
  notes?: string
  items: ReviewBillItem[]
  subtotal: number
  taxAmount: number
  discountAmount: number
  roundOff: number
  totalAmount: number
  rawExtractedTotal?: number
  isReconciled: boolean
  reconciliationVariance: number
  confidence: number
  file?: File | null
  fileUrl?: string | null
  fileName?: string
  mimeType?: string
  pageCount?: number
  threads?: ReviewBillThread[]
  merkleRoot?: string
  integrityHash?: string
}

export type ScanStage = 'uploading' | 'ocr' | 'extracting' | 'matching' | 'ready' | 'error'

export interface ScanStageInfo {
  id: ScanStage
  label: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'error'
}

export interface MasterSupplier {
  id: string
  name: string
  gstin?: string | null
  dlNumber?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
}

export interface MasterProduct {
  id: string
  name: string
  sku: string
  mrp: number
  costPrice?: number
  ptr?: number
  unitOfMeasure?: string
  gstRate?: number
}

export interface MasterBranch {
  id: string
  name: string
  isHeadOffice?: boolean
}

// ─── Mathematical Helpers ─────────────────────────────────────

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100
}

export function computeLineItemAmounts(item: {
  billedQuantity: number
  unitCost: number
  discountPercent: number
  taxPercent: number
}) {
  const billedQty = Math.max(0, item.billedQuantity || 0)
  const cost = Math.max(0, item.unitCost || 0)
  const discPct = Math.min(100, Math.max(0, item.discountPercent || 0))
  const taxPct = Math.min(100, Math.max(0, item.taxPercent || 0))

  const taxable = round2(billedQty * cost * (1 - discPct / 100))
  const taxAmount = round2(taxable * (taxPct / 100))
  const totalAmount = round2(taxable + taxAmount)

  return {
    taxable,
    taxAmount,
    totalAmount,
  }
}

export function computeBillTotals(
  items: ReviewBillItem[],
  extractedTotal?: number,
  roundOffAdjustment = 0
) {
  let subtotal = 0
  let totalTax = 0
  let totalDiscount = 0

  for (const item of items) {
    const rawBilled = item.billedQuantity * item.unitCost
    const disc = round2(rawBilled * (item.discountPercent / 100))
    totalDiscount += disc
    const taxable = round2(rawBilled - disc)
    subtotal += taxable
    totalTax += item.taxAmount
  }

  subtotal = round2(subtotal)
  totalTax = round2(totalTax)
  totalDiscount = round2(totalDiscount)

  const computedTotal = round2(subtotal + totalTax + roundOffAdjustment)
  const targetTotal = extractedTotal !== undefined ? extractedTotal : computedTotal
  const variance = round2(Math.abs(computedTotal - targetTotal))
  const isReconciled = variance <= 1.0

  return {
    subtotal,
    taxAmount: totalTax,
    discountAmount: totalDiscount,
    roundOff: roundOffAdjustment,
    totalAmount: computedTotal,
    variance,
    isReconciled,
  }
}

export function isShortExpiryDate(expiryIsoString: string): boolean {
  if (!expiryIsoString) return false
  const exp = new Date(expiryIsoString)
  if (isNaN(exp.getTime())) return false

  const today = new Date()
  const sixMonthsAhead = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate())
  return exp <= sixMonthsAhead
}
