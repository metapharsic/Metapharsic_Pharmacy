/**
 * Metapharsic Lifesciences & Pharmacare
 * Professional Invoice & Pharmacy Table Excel Export Engine (.xlsx)
 *
 * Implements statutory Indian GST compliance formatting:
 * - Tab 1: Formatted Tax Invoice with full pharmacy credentials, customer/patient info,
 *          line items (HSN, Batch, Expiry, Qty, Free, MRP, Rate, Disc, GST, Amount),
 *          financial totals, amount in words, and statutory warnings.
 * - Tab 2: HSN-wise GST summary table (Taxable Value, CGST, SGST, IGST, Total Tax).
 * - Client-side single-click download with automatic column auto-fitting and currency formatting.
 * - Pure functions for high testability and Web Worker compatibility.
 */

import {
  buildWorkbook,
  downloadExcelWorkbook,
  type ExcelSheetConfig,
  type ExcelWorkbookConfig,
} from './excel-export-service'
import { checkDiscountExemption } from '@/lib/pricing/discount-exemption'

export interface PharmacyCredentials {
  name: string
  legalName?: string
  address: string
  cityStatePin: string
  gstin: string
  dlNumber: string
  fssaiNumber: string
  regPharmacist: string
  phone: string
  email: string
}

export const DEFAULT_PHARMACY_INFO: PharmacyCredentials = {
  name: 'METAPHARSIC LIFESCIENCES & PHARMACARE',
  legalName: 'Metapharsic Healthcare Solutions Private Limited',
  address: 'Plot 42, Metro Health City, HITEC City Phase 2',
  cityStatePin: 'Hyderabad, Telangana - 500081',
  gstin: '36AAAAA0000A1Z5',
  dlNumber: 'DL No. 20B/21B-TS/HYD/2026/88912',
  fssaiNumber: 'FSSAI Lic. 13626011000492',
  regPharmacist: 'Reg. Pharmacist: TS-PH-78921',
  phone: '+91 99855 89599',
  email: 'billing@metapharsic.com',
}

function round2(num: number): number {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100
}

function parseNum(val: unknown, fallback = 0): number {
  if (val == null) return fallback
  if (typeof val === 'number') return isNaN(val) ? fallback : val
  if (typeof val === 'object' && val && 'toNumber' in val && typeof (val as { toNumber: () => number }).toNumber === 'function') {
    return (val as { toNumber: () => number }).toNumber()
  }
  const n = parseFloat(String(val))
  return isNaN(n) ? fallback : n
}

/**
 * Pure Indian Rupee currency words formatter
 */
export function numberToWordsINR(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'Rupees Zero Only'
  const rounded = Math.round((Math.abs(amount) + Number.EPSILON) * 100) / 100
  const intPart = Math.floor(rounded)
  const decPart = Math.round((rounded - intPart) * 100)

  if (intPart === 0 && decPart === 0) return 'Rupees Zero Only'

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function convertTwoDigits(n: number): string {
    if (n === 0) return ''
    if (n < 10) return units[n]
    if (n < 20) return teens[n - 10]
    const t = Math.floor(n / 10)
    const u = n % 10
    return `${tens[t]}${u > 0 ? ` ${units[u]}` : ''}`
  }

  function convertThreeDigits(n: number): string {
    const h = Math.floor(n / 100)
    const rest = n % 100
    let str = ''
    if (h > 0) str += `${units[h]} Hundred`
    if (rest > 0) {
      if (str) str += ' '
      str += convertTwoDigits(rest)
    }
    return str
  }

  let words = ''
  let remaining = intPart

  const crore = Math.floor(remaining / 10000000)
  if (crore > 0) {
    words += `${convertThreeDigits(crore)} Crore `
    remaining %= 10000000
  }

  const lakh = Math.floor(remaining / 100000)
  if (lakh > 0) {
    words += `${convertThreeDigits(lakh)} Lakh `
    remaining %= 100000
  }

  const thousand = Math.floor(remaining / 1000)
  if (thousand > 0) {
    words += `${convertThreeDigits(thousand)} Thousand `
    remaining %= 1000
  }

  const hundreds = remaining
  if (hundreds > 0) {
    words += `${convertThreeDigits(hundreds)} `
  }

  words = words.trim() ? `Rupees ${words.trim()}` : ''

  if (decPart > 0) {
    const paiseWords = convertTwoDigits(decPart)
    if (words) {
      words += ` and ${paiseWords} Paise`
    } else {
      words = `${paiseWords} Paise`
    }
  }

  return `${words} Only`
}

/**
 * Builds the Excel workbook configuration for a Sale Tax Invoice
 */
export function buildSaleInvoiceWorkbookConfig(
  sale: any,
  options?: { filename?: string; pharmacy?: Partial<PharmacyCredentials> }
): ExcelWorkbookConfig {
  const pharmacy = { ...DEFAULT_PHARMACY_INFO, ...(options?.pharmacy || {}) }
  const invNumber = sale.invoiceNumber || `INV-${Date.now()}`
  const filename = options?.filename || `Tax_Invoice_${invNumber}`

  const saleDateStr = sale.saleDate
    ? new Date(sale.saleDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-IN')

  const customerName = sale.customer?.name || sale.customerName || 'Walk-in Patient'
  const customerPhone = sale.customer?.phone || sale.customerPhone || '—'
  const doctorName = sale.doctor?.name || sale.doctorName || sale.prescription?.doctorName || 'Self / OTC'
  const doctorReg = sale.doctor?.regNumber || sale.prescription?.doctorRegNumber || '—'
  const paymentMode =
    sale.payments && sale.payments.length > 0
      ? sale.payments.map((p: any) => `${p.method}${p.reference ? ` (${p.reference})` : ''}`).join(', ')
      : 'Cash'

  const totalAmount = parseNum(sale.totalAmount)

  const itemHeaders = [
    'S.No',
    'Medicine / Product Description',
    'HSN Code',
    'Batch #',
    'Expiry (MM/YY)',
    'Qty',
    'Free',
    'MRP (₹)',
    'Rate (₹)',
    'Disc %',
    'Taxable Value (₹)',
    'CGST %',
    'CGST (₹)',
    'SGST %',
    'SGST (₹)',
    'Total (₹)',
  ]

  const items = sale.items || []
  let totalBilledUnits = 0
  let totalFreeUnits = 0
  let totalTaxableVal = 0
  let totalCgstVal = 0
  let totalSgstVal = 0

  const hsnMap = new Map<
    string,
    { hsn: string; taxable: number; cgstRate: number; cgst: number; sgstRate: number; sgst: number; totalTax: number }
  >()

  const itemRows: (string | number)[][] = items.map((it: any, idx: number) => {
    const qty = parseNum(it.quantity, 1)
    const free = parseNum(it.freeQuantity || it.free, 0)
    totalBilledUnits += qty
    totalFreeUnits += free

    const unitPrice = parseNum(it.unitPrice || it.rate || it.costPrice || 0)
    const mrp = parseNum(it.mrp, unitPrice * 1.25)
    const discPct = parseNum(it.discountPercent || it.disc, 0)
    const taxPct = parseNum(it.taxPercent || it.gst, 5)

    const gross = qty * unitPrice
    const discAmt = round2(gross * (discPct / 100))
    const taxable = round2(gross - discAmt)
    totalTaxableVal += taxable

    const cgstPct = round2(taxPct / 2)
    const sgstPct = round2(taxPct / 2)
    const cgstAmt = round2(taxable * (cgstPct / 100))
    const sgstAmt = round2(taxable * (sgstPct / 100))
    totalCgstVal += cgstAmt
    totalSgstVal += sgstAmt

    const lineTotal = parseNum(it.totalAmount, taxable + cgstAmt + sgstAmt)

    const hsn = String(it.hsnCode || '3004').trim()
    const existing = hsnMap.get(hsn) || {
      hsn,
      taxable: 0,
      cgstRate: cgstPct,
      cgst: 0,
      sgstRate: sgstPct,
      sgst: 0,
      totalTax: 0,
    }
    existing.taxable = round2(existing.taxable + taxable)
    existing.cgst = round2(existing.cgst + cgstAmt)
    existing.sgst = round2(existing.sgst + sgstAmt)
    existing.totalTax = round2(existing.cgst + existing.sgst)
    hsnMap.set(hsn, existing)

    const batchNo = it.batchNumber || it.batch?.batchNumber || 'BAT-01'
    let expFormatted = '12/28'
    if (it.expiryDate || it.batch?.expiryDate) {
      const expD = new Date(it.expiryDate || it.batch?.expiryDate)
      if (!isNaN(expD.getTime())) {
        expFormatted = `${String(expD.getMonth() + 1).padStart(2, '0')}/${String(expD.getFullYear()).slice(-2)}`
      }
    }

    const exemption = checkDiscountExemption(it.product || it)
    const baseName = it.productName || it.name || 'Pharmaceutical formulation'
    const displayName = exemption.isExempt
      ? `${baseName} [${exemption.badgeText || 'Discount Exempt'}]`
      : baseName
    const displayDisc = exemption.isExempt ? 0 : discPct

    return [
      idx + 1,
      displayName,
      hsn,
      batchNo,
      expFormatted,
      qty,
      free,
      mrp,
      unitPrice,
      displayDisc,
      taxable,
      cgstPct,
      cgstAmt,
      sgstPct,
      sgstAmt,
      lineTotal,
    ]
  })

  const invoiceSheet: ExcelSheetConfig = {
    sheetName: 'Tax Invoice',
    title: `${pharmacy.name} - RETAIL TAX INVOICE`,
    subtitle: `${pharmacy.address}, ${pharmacy.cityStatePin}`,
    metadata: {
      'Official System Watermark': 'METAPHARSIC LIFESCIENCES PHARMACARE [AUTHENTICATED SYSTEM DOCUMENT]',
      'GSTIN / UIN': pharmacy.gstin,
      'Drug License': pharmacy.dlNumber,
      'FSSAI License': pharmacy.fssaiNumber,
      Pharmacist: pharmacy.regPharmacist,
      'Invoice Number': invNumber,
      'Invoice Date': saleDateStr,
      'Payment Method': paymentMode,
      'Patient / Customer': `${customerName} (Mob: ${customerPhone})`,
      'Prescribing Doctor': `${doctorName} (Reg: ${doctorReg})`,
      'Taxable Subtotal': `₹ ${round2(totalTaxableVal).toFixed(2)}`,
      'Total CGST': `₹ ${round2(totalCgstVal).toFixed(2)}`,
      'Total SGST': `₹ ${round2(totalSgstVal).toFixed(2)}`,
      'Total Net Amount': `₹ ${round2(totalAmount).toFixed(2)}`,
      'Amount in Words': numberToWordsINR(totalAmount),
    },
    headers: itemHeaders,
    data: itemRows,
    summaryRow: [
      'TOTALS',
      `${items.length} Medicines`,
      '—',
      '—',
      '—',
      totalBilledUnits,
      totalFreeUnits,
      '—',
      '—',
      '—',
      round2(totalTaxableVal),
      '—',
      round2(totalCgstVal),
      '—',
      round2(totalSgstVal),
      round2(totalAmount),
    ],
  }

  const hsnHeaders = [
    'HSN Code',
    'Description',
    'Taxable Value (₹)',
    'CGST Rate %',
    'CGST Amount (₹)',
    'SGST Rate %',
    'SGST Amount (₹)',
    'Total Tax (₹)',
  ]

  const hsnRows = Array.from(hsnMap.values()).map((h) => [
    h.hsn,
    'Pharmaceutical Products (Medicaments)',
    h.taxable,
    h.cgstRate,
    h.cgst,
    h.sgstRate,
    h.sgst,
    h.totalTax,
  ])

  const hsnSheet: ExcelSheetConfig = {
    sheetName: 'GST Tax Summary',
    title: 'HSN / SAC WISE GST TAX BREAKUP & AUDIT',
    subtitle: `Tax Breakup for Invoice #${invNumber}`,
    metadata: {
      'Invoice Number': invNumber,
      'Invoice Date': saleDateStr,
      GSTIN: pharmacy.gstin,
    },
    headers: hsnHeaders,
    data: hsnRows,
    summaryRow: [
      'TOTAL GST',
      'All HSN Slabs',
      round2(totalTaxableVal),
      '—',
      round2(totalCgstVal),
      '—',
      round2(totalSgstVal),
      round2(totalCgstVal + totalSgstVal),
    ],
  }

  return {
    filename,
    organizationName: pharmacy.name,
    sheets: [invoiceSheet, hsnSheet],
  }
}

/**
 * Builds the Excel workbook configuration for a Purchase Bill
 */
export function buildPurchaseBillWorkbookConfig(
  purchase: any,
  options?: { filename?: string; pharmacy?: Partial<PharmacyCredentials> }
): ExcelWorkbookConfig {
  const pharmacy = { ...DEFAULT_PHARMACY_INFO, ...(options?.pharmacy || {}) }
  const billNumber = purchase.invoiceNumber || purchase.purchaseNumber || `PB-${Date.now()}`
  const filename = options?.filename || `Purchase_Bill_${billNumber}`

  const billDateStr = purchase.invoiceDate || purchase.purchaseDate
    ? new Date(purchase.invoiceDate || purchase.purchaseDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-IN')

  const supplier = purchase.supplier || {}
  const supplierName = supplier.name || 'Wholesale Pharma Agency'
  const supplierGstin = supplier.gstin || '—'
  const supplierDl = supplier.dlNumber || '—'
  const supplierPhone = supplier.phone || '—'
  const status = purchase.status || 'RECEIVED'

  const subtotal = parseNum(purchase.subtotal)
  const discount = parseNum(purchase.discountAmount)
  const taxAmount = parseNum(purchase.taxAmount)
  const roundOff = parseNum(purchase.roundOff)
  const totalAmount = parseNum(purchase.totalAmount)
  const amountPaid = parseNum(purchase.amountPaid, 0)
  const balanceDue = parseNum(purchase.balanceDue, Math.max(0, totalAmount - amountPaid))

  const headers = [
    'S.No',
    'Medicine / Product Name',
    'SKU',
    'HSN Code',
    'Batch #',
    'Expiry (YYYY-MM-DD)',
    'Ordered Qty',
    'Received Qty',
    'Free Qty',
    'Unit Cost / PTR (₹)',
    'MRP (₹)',
    'Disc %',
    'Tax %',
    'Tax Amt (₹)',
    'Line Total (₹)',
  ]

  const items = purchase.items || []
  let totalOrdered = 0
  let totalReceived = 0
  let totalFree = 0
  let totalTaxAmt = 0

  const hsnMap = new Map<string, { hsn: string; taxable: number; taxRate: number; taxAmount: number }>()

  const rows = items.map((it: any, idx: number) => {
    const prodName = it.product?.name || it.productName || it.name || `Medicine-${idx + 1}`
    const sku = it.product?.sku || it.sku || `SKU-${idx + 1}`
    const hsn = it.hsnCode || it.product?.hsnCode || '3004'
    const batch = it.batchNumber || it.batch?.batchNumber || 'BAT-01'
    const expiry = it.expiryDate || (it.batch?.expiryDate ? new Date(it.batch.expiryDate).toISOString().slice(0, 10) : '2028-12-31')

    const ordered = parseNum(it.orderedQuantity, 1)
    const received = parseNum(it.receivedQuantity, ordered)
    const free = parseNum(it.freeQuantity, 0)

    totalOrdered += ordered
    totalReceived += received
    totalFree += free

    const unitCost = parseNum(it.unitCost || it.costPrice || it.ptr, 0)
    const mrp = parseNum(it.mrp || it.product?.mrp, unitCost * 1.25)
    const discPct = parseNum(it.discountPercent, 0)
    const taxPct = parseNum(it.taxPercent || it.taxRate, 5)

    const gross = received * unitCost
    const discAmt = round2(gross * (discPct / 100))
    const taxable = round2(gross - discAmt)
    const lineTax = parseNum(it.taxAmount, round2(taxable * (taxPct / 100)))
    totalTaxAmt += lineTax
    const lineTotal = parseNum(it.totalAmount, round2(taxable + lineTax))

    const existing = hsnMap.get(hsn) || { hsn, taxable: 0, taxRate: taxPct, taxAmount: 0 }
    existing.taxable = round2(existing.taxable + taxable)
    existing.taxAmount = round2(existing.taxAmount + lineTax)
    hsnMap.set(hsn, existing)

    return [
      idx + 1,
      prodName,
      sku,
      hsn,
      batch,
      expiry,
      ordered,
      received,
      free,
      unitCost,
      mrp,
      discPct,
      taxPct,
      lineTax,
      lineTotal,
    ]
  })

  const billSheet: ExcelSheetConfig = {
    sheetName: 'Purchase Invoice',
    title: 'PURCHASE BILL & INVENTORY RECEIPT',
    subtitle: `Distributor Invoicing: ${supplierName}`,
    metadata: {
      'Official System Watermark': 'METAPHARSIC LIFESCIENCES PHARMACARE [AUTHENTICATED SYSTEM DOCUMENT]',
      'Distributor / Supplier': supplierName,
      'Supplier GSTIN': supplierGstin,
      'Supplier Drug License': supplierDl,
      'Supplier Contact': supplierPhone,
      'Bill / Invoice Number': billNumber,
      'Bill Date': billDateStr,
      'Order Status': status,
      'Subtotal (Taxable)': `₹ ${subtotal.toFixed(2)}`,
      'Discount Allowed': `₹ ${discount.toFixed(2)}`,
      'Tax Amount': `₹ ${taxAmount.toFixed(2)}`,
      'Round-Off': `₹ ${roundOff.toFixed(2)}`,
      'Total Payable': `₹ ${totalAmount.toFixed(2)}`,
      'Balance Due': `₹ ${balanceDue.toFixed(2)}`,
      'Total in Words': numberToWordsINR(totalAmount),
    },
    headers,
    data: rows,
    summaryRow: [
      'TOTALS',
      `${items.length} Products`,
      '—',
      '—',
      '—',
      '—',
      totalOrdered,
      totalReceived,
      totalFree,
      '—',
      '—',
      '—',
      '—',
      round2(totalTaxAmt),
      round2(totalAmount),
    ],
  }

  const hsnHeaders = ['HSN Code', 'Category Description', 'Taxable Value (₹)', 'GST Rate %', 'Tax Amount (₹)']
  const hsnRows = Array.from(hsnMap.values()).map((h) => [
    h.hsn,
    'Pharmaceutical Formulations',
    h.taxable,
    h.taxRate,
    h.taxAmount,
  ])

  const hsnSheet: ExcelSheetConfig = {
    sheetName: 'HSN GST Breakup',
    title: 'INPUT TAX CREDIT (ITC) HSN BREAKUP',
    subtitle: `Purchase Invoice #${billNumber}`,
    headers: hsnHeaders,
    data: hsnRows,
    summaryRow: ['TOTAL ITC', 'All HSN Slabs', subtotal, '—', round2(totalTaxAmt)],
  }

  return {
    filename,
    organizationName: pharmacy.name,
    sheets: [billSheet, hsnSheet],
  }
}

/**
 * Builds the Excel workbook configuration for a Scanned Bill Review
 */
export function buildBillReviewWorkbookConfig(
  billData: any,
  options?: { filename?: string }
): ExcelWorkbookConfig {
  const invNumber = billData.invoiceNumber || `BILL-${Date.now()}`
  const filename = options?.filename || `Scanned_Bill_${invNumber}`

  const headers = [
    '#',
    'Medicine / Product Name',
    'Batch #',
    'Expiry Date',
    'Billed Qty',
    'Free Qty',
    'PTR / Unit Cost (₹)',
    'MRP (₹)',
    'Disc %',
    'GST Slab %',
    'Line Total (₹)',
    'Status',
  ]

  const items = billData.items || []
  let totalBilled = 0
  let totalFree = 0
  let totalAmountSum = 0

  const rows = items.map((it: any, idx: number) => {
    const name = it.productName || it.rawDescription || `Medicine-${idx + 1}`
    const batch = it.batchNumber || 'N/A'
    const expiry = it.expiryDate || 'N/A'
    const billed = parseNum(it.billedQuantity, 1)
    const free = parseNum(it.freeQuantity, 0)
    const cost = parseNum(it.unitCost, 0)
    const mrp = parseNum(it.mrp, cost * 1.25)
    const disc = parseNum(it.discountPercent, 0)
    const gst = parseNum(it.taxPercent, 5)
    const total = parseNum(it.totalAmount, cost * billed)

    totalBilled += billed
    totalFree += free
    totalAmountSum += total

    return [
      idx + 1,
      name,
      batch,
      expiry,
      billed,
      free,
      cost,
      mrp,
      disc,
      gst,
      total,
      it.isNewProduct ? 'Auto-Provision to Inventory' : 'Matched Catalog Item',
    ]
  })

  const sheet: ExcelSheetConfig = {
    sheetName: 'Scanned Bill Review',
    title: 'INGESTED PURCHASE BILL - AUDIT & VERIFICATION',
    subtitle: `Supplier: ${billData.supplierName || 'Wholesale Distributor'} • Invoice #${invNumber}`,
    metadata: {
      'Official System Watermark': 'METAPHARSIC LIFESCIENCES PHARMACARE [AUTHENTICATED SYSTEM DOCUMENT]',
      Supplier: billData.supplierName || 'Distributor Agency',
      'Supplier GSTIN': billData.supplierGstin || '—',
      'Supplier DL': billData.supplierDlNumber || '—',
      'Invoice Number': invNumber,
      'Invoice Date': billData.invoiceDate || new Date().toISOString().slice(0, 10),
      'Billed Total': `₹ ${round2(totalAmountSum).toFixed(2)}`,
      'Total Units': totalBilled + totalFree,
      'Reconciliation Status': billData.isReconciled ? 'Reconciled' : 'Review Required',
    },
    headers,
    data: rows,
    summaryRow: [
      'TOTALS',
      `${items.length} Medicines`,
      '—',
      '—',
      totalBilled,
      totalFree,
      '—',
      '—',
      '—',
      '—',
      round2(totalAmountSum),
      'Ready to Commit',
    ],
  }

  return {
    filename,
    organizationName: 'Metapharsic Lifesciences',
    sheets: [sheet],
  }
}

/**
 * Downloads a complete formatted Tax Invoice Excel workbook for Sales / POS
 */
export function downloadSaleInvoiceExcel(
  sale: any,
  options?: { filename?: string; pharmacy?: Partial<PharmacyCredentials> }
): void {
  const config = buildSaleInvoiceWorkbookConfig(sale, options)
  downloadExcelWorkbook(config)
}

/**
 * Downloads a complete formatted Purchase Bill Excel workbook
 */
export function downloadPurchaseBillExcel(
  purchase: any,
  options?: { filename?: string; pharmacy?: Partial<PharmacyCredentials> }
): void {
  const config = buildPurchaseBillWorkbookConfig(purchase, options)
  downloadExcelWorkbook(config)
}

/**
 * Downloads a Scanned / Extracted Review Bill to Excel
 */
export function downloadBillReviewExcel(
  billData: any,
  options?: { filename?: string }
): void {
  const config = buildBillReviewWorkbookConfig(billData, options)
  downloadExcelWorkbook(config)
}
