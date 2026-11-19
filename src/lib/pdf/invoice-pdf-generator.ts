// ─────────────────────────────────────────────────────────────
// Universal PDF Invoice Generator — Metapharsic Pharmacy Management
// Supports A4 Full Tax Invoice & 80mm Continuous Thermal POS Slip
// Compliant with Drugs & Cosmetics Act, GST Rules & FSSAI Standards
// ─────────────────────────────────────────────────────────────

import { format, isValid, parseISO } from 'date-fns'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface InvoicePdfOptions {
  format?: 'a4' | 'thermal80' | 'slip' | 'full' // default: 'a4'
  pharmacyName?: string
  gstin?: string
  dlNumber?: string
  address?: string
  phone?: string
  email?: string
}

export interface GstSlabSummary {
  slab: number
  slabLabel: string
  taxableAmount: number
  cgstRate: number
  cgstAmount: number
  sgstRate: number
  sgstAmount: number
  igstRate: number
  igstAmount: number
  totalTax: number
}

export interface InvoiceBranch {
  name?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  phone?: string | null
  email?: string | null
  gstin?: string | null
  dlNumber?: string | null
  fssaiNumber?: string | null
  regPharmacist?: string | null
  organization?: {
    name?: string | null
    legalName?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    pincode?: string | null
    phone?: string | null
    email?: string | null
    gstin?: string | null
    dlNumber?: string | null
  } | null
}

export interface InvoiceLineItem {
  id?: string
  productName: string
  genericName?: string | null
  composition?: string | null
  hsnCode?: string | null
  batchNumber?: string | null
  expiryDate?: string | Date | null
  quantity: number | string
  unitPrice: number | string
  mrp?: number | string | null
  discountAmount?: number | string | null
  discountPercent?: number | string | null
  taxPercent?: number | string | null
  cgstPercent?: number | string | null
  sgstPercent?: number | string | null
  igstPercent?: number | string | null
  cgstAmount?: number | string | null
  sgstAmount?: number | string | null
  igstAmount?: number | string | null
  taxAmount?: number | string | null
  totalAmount: number | string
  tabsCut?: number | null
  itemBatches?: Array<{
    batch?: {
      batchNumber?: string | null
      expiryDate?: string | Date | null
    } | null
  }> | null
}

export interface InvoicePayment {
  method: string
  amount: number | string
  reference?: string | null
}

export interface InvoiceSaleData {
  id?: string
  invoiceNumber?: string | null
  saleDate?: string | Date | null
  subtotal?: number | string | null
  discountAmount?: number | string | null
  discountPercent?: number | string | null
  taxAmount?: number | string | null
  cgstAmount?: number | string | null
  sgstAmount?: number | string | null
  igstAmount?: number | string | null
  totalAmount: number | string
  amountPaid?: number | string | null
  cashTendered?: number | string | null
  changeAmount?: number | string | null
  paymentStatus?: string | null
  customer?: {
    name?: string | null
    phone?: string | null
  } | null
  customerName?: string | null
  customerPhone?: string | null
  doctor?: {
    name?: string | null
    regNumber?: string | null
  } | null
  doctorName?: string | null
  prescription?: {
    doctorName?: string | null
    doctorRegNumber?: string | null
  } | null
  createdBy?: {
    name?: string | null
  } | null
  branch?: InvoiceBranch | null
  items: InvoiceLineItem[]
  payments?: InvoicePayment[] | null
}

// ─── Default Complete Legal Credentials ──────────────────────
export const DEFAULT_PHARMACY_CREDENTIALS = {
  name: 'METAPHARSIC PHARMACARE & HEALTHCARE',
  legalName: 'Metapharsic Healthcare Solutions Pvt. Ltd.',
  facilityType: 'Licensed Chemist & Retail Hospital Pharmacy',
  address: '123, Healthcare Complex, Medical Square, Health Nagar',
  cityStatePin: 'Bangalore, Karnataka - 560001',
  phone: '+91 98765 43210 / 080-23456789',
  email: 'billing@metapharsic.com',
  website: 'www.metapharsic.com',
  gstin: '29ABCDE1234F1Z5',
  dlNumber20B: 'DL-20B-KA-12345',
  dlNumber21B: 'DL-21B-KA-67890',
  fssaiNumber: '11524000000123',
  regPharmacist: 'R.Ph. Anita Roy (Reg. No: 129482)',
}

export function parseNum(val: unknown): number {
  if (val === null || val === undefined) return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (typeof val === 'string') {
    const n = Number(val)
    return isNaN(n) ? 0 : n
  }
  if (typeof val === 'object' && val !== null && 'toString' in val) {
    const fn = (val as { toString: unknown }).toString
    if (typeof fn === 'function') {
      const s = String(fn.call(val))
      const n = Number(s)
      return isNaN(n) ? 0 : n
    }
  }
  return 0
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function formatDateDisplay(dInput: string | Date | null | undefined): string {
  if (!dInput) return '-'
  const d = typeof dInput === 'string' ? parseISO(dInput) : dInput
  if (!isValid(d)) return typeof dInput === 'string' ? dInput : '-'
  return format(d, 'dd-MMM-yyyy')
}

export function formatTimeDisplay(dInput: string | Date | null | undefined): string {
  if (!dInput) return '-'
  const d = typeof dInput === 'string' ? parseISO(dInput) : dInput
  if (!isValid(d)) return '-'
  return format(d, 'hh:mm a')
}

export function formatExpDate(dInput: string | Date | null | undefined): string {
  if (!dInput) return '-'
  const d = typeof dInput === 'string' ? parseISO(dInput) : dInput
  if (!isValid(d)) return String(dInput)
  return format(d, 'MM/yy')
}

// Number to Words Converter for Indian Rupee Invoices
export function numberToWordsINR(amount: number): string {
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ]
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
  ]

  function convertChunk(num: number): string {
    let str = ''
    if (num >= 100) {
      str += ones[Math.floor(num / 100)] + ' Hundred '
      num %= 100
    }
    if (num >= 20) {
      str += tens[Math.floor(num / 10)] + ' '
      num %= 10
    }
    if (num > 0) {
      str += ones[num] + ' '
    }
    return str
  }

  const intPart = Math.floor(amount)
  const decPart = Math.round((amount - intPart) * 100)

  if (intPart === 0 && decPart === 0) return 'Rupees Zero Only'

  let words = ''
  const crore = Math.floor(intPart / 10000000)
  let remainder = intPart % 10000000
  const lakh = Math.floor(remainder / 100000)
  remainder %= 100000
  const thousand = Math.floor(remainder / 1000)
  const hundred = remainder % 1000

  if (crore > 0) words += convertChunk(crore) + 'Crore '
  if (lakh > 0) words += convertChunk(lakh) + 'Lakh '
  if (thousand > 0) words += convertChunk(thousand) + 'Thousand '
  if (hundred > 0) words += convertChunk(hundred)

  words = words.trim() ? `Rupees ${words.trim()}` : ''

  if (decPart > 0) {
    const paiseWords = convertChunk(decPart).trim()
    words += `${words ? ' and ' : ''}${paiseWords} Paise`
  }

  return `${words} Only`
}

/**
 * Aggregates line items into dynamic GST multi-slab matrix
 * Supports 0%, 5%, 12%, 18%, 28% or any custom tax rate
 */
export function computeGstSlabs(
  items: InvoiceLineItem[],
  saleTotals?: {
    subtotal?: number | string | null
    discountAmount?: number | string | null
    taxAmount?: number | string | null
    cgstAmount?: number | string | null
    sgstAmount?: number | string | null
    igstAmount?: number | string | null
  }
): GstSlabSummary[] {
  const slabMap = new Map<
    number,
    {
      taxableAmount: number
      cgstAmount: number
      sgstAmount: number
      igstAmount: number
      totalTax: number
      hasIgst: boolean
    }
  >()

  let totalItemTax = 0

  if (Array.isArray(items) && items.length > 0) {
    for (const it of items) {
      const qty = parseNum(it.quantity) || 1
      const unitPrice = parseNum(it.unitPrice || it.mrp)
      const discAmt = parseNum(it.discountAmount)
      const lineTotal = parseNum(it.totalAmount)
      const lineTax = parseNum(it.taxAmount)
      totalItemTax += lineTax

      let slabRate = parseNum(it.taxPercent)
      const cgstPct = parseNum(it.cgstPercent)
      const sgstPct = parseNum(it.sgstPercent)
      const igstPct = parseNum(it.igstPercent)

      if (slabRate === 0 && (cgstPct > 0 || sgstPct > 0 || igstPct > 0)) {
        slabRate = cgstPct + sgstPct + igstPct
      }

      // If slabRate is still 0 but line has tax amount and total
      if (slabRate === 0 && lineTax > 0 && lineTotal > lineTax) {
        const taxable = lineTotal - lineTax
        if (taxable > 0) {
          slabRate = round2((lineTax / taxable) * 100)
        }
      }

      // Normalize slab to common standard rates if within 0.2% tolerance
      const standardSlabs = [0, 5, 12, 18, 28]
      for (const std of standardSlabs) {
        if (Math.abs(slabRate - std) < 0.2) {
          slabRate = std
          break
        }
      }

      const gross = round2(unitPrice * qty)
      const lineSubtotal = Math.max(0, gross - discAmt)
      const taxable = lineTax > 0 && lineTotal > lineTax ? round2(lineTotal - lineTax) : lineSubtotal

      let cgst = parseNum(it.cgstAmount)
      let sgst = parseNum(it.sgstAmount)
      const igst = parseNum(it.igstAmount)

      if (cgst === 0 && sgst === 0 && igst === 0 && lineTax > 0) {
        cgst = round2(lineTax / 2)
        sgst = round2(lineTax - cgst)
      }

      const existing = slabMap.get(slabRate) || {
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalTax: 0,
        hasIgst: igst > 0 || igstPct > 0,
      }

      existing.taxableAmount = round2(existing.taxableAmount + taxable)
      existing.cgstAmount = round2(existing.cgstAmount + cgst)
      existing.sgstAmount = round2(existing.sgstAmount + sgst)
      existing.igstAmount = round2(existing.igstAmount + igst)
      existing.totalTax = round2(existing.totalTax + lineTax)
      if (igst > 0) existing.hasIgst = true

      slabMap.set(slabRate, existing)
    }
  }

  // Fallback: If items had no tax info but sale.taxAmount > 0
  const overallTax = parseNum(saleTotals?.taxAmount)
  if (totalItemTax === 0 && overallTax > 0) {
    const subtotal = parseNum(saleTotals?.subtotal)
    const discount = parseNum(saleTotals?.discountAmount)
    const taxableBase = Math.max(0, subtotal - discount)
    let effectiveRate = taxableBase > 0 ? round2((overallTax / taxableBase) * 100) : 12

    for (const std of [5, 12, 18, 28]) {
      if (Math.abs(effectiveRate - std) < 1.0) {
        effectiveRate = std
        break
      }
    }

    let cgst = parseNum(saleTotals?.cgstAmount)
    let sgst = parseNum(saleTotals?.sgstAmount)
    const igst = parseNum(saleTotals?.igstAmount)

    if (cgst === 0 && sgst === 0 && igst === 0) {
      cgst = round2(overallTax / 2)
      sgst = round2(overallTax - cgst)
    }

    slabMap.clear()
    slabMap.set(effectiveRate, {
      taxableAmount: taxableBase,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      totalTax: overallTax,
      hasIgst: igst > 0,
    })
  }

  // If map is empty, produce a default 0% exempt row
  if (slabMap.size === 0) {
    const subtotal = parseNum(saleTotals?.subtotal)
    const discount = parseNum(saleTotals?.discountAmount)
    const taxableBase = Math.max(0, subtotal - discount)
    slabMap.set(0, {
      taxableAmount: taxableBase,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalTax: 0,
      hasIgst: false,
    })
  }

  const result: GstSlabSummary[] = []
  const sortedRates = Array.from(slabMap.keys()).sort((a, b) => a - b)

  for (const slab of sortedRates) {
    const data = slabMap.get(slab)!
    const isInterstate = data.hasIgst
    const halfRate = round2(slab / 2)

    result.push({
      slab,
      slabLabel: slab === 0 ? 'Exempt (0%)' : `GST ${slab}%`,
      taxableAmount: data.taxableAmount,
      cgstRate: isInterstate ? 0 : halfRate,
      cgstAmount: data.cgstAmount,
      sgstRate: isInterstate ? 0 : halfRate,
      sgstAmount: data.sgstAmount,
      igstRate: isInterstate ? slab : 0,
      igstAmount: data.igstAmount,
      totalTax: data.totalTax,
    })
  }

  return result
}

/**
 * Universal jsPDF Builder supporting A4 and 80mm continuous thermal slip
 */
export function generateInvoicePdfDoc(sale: InvoiceSaleData, options?: InvoicePdfOptions): jsPDF {
  const isThermal = options?.format === 'thermal80' || options?.format === 'slip'

  // Pharmacy & Branch Legal Credentials
  const pharmacyName =
    options?.pharmacyName ||
    sale.branch?.organization?.name ||
    sale.branch?.name ||
    DEFAULT_PHARMACY_CREDENTIALS.name

  const legalEntityName =
    sale.branch?.organization?.legalName ||
    DEFAULT_PHARMACY_CREDENTIALS.legalName

  const facilityType = DEFAULT_PHARMACY_CREDENTIALS.facilityType

  const pharmacyAddress =
    options?.address ||
    sale.branch?.address ||
    sale.branch?.organization?.address ||
    DEFAULT_PHARMACY_CREDENTIALS.address

  const cityStatePin = [
    sale.branch?.city || sale.branch?.organization?.city,
    sale.branch?.state || sale.branch?.organization?.state,
    sale.branch?.pincode || sale.branch?.organization?.pincode,
  ]
    .filter(Boolean)
    .join(', ') || DEFAULT_PHARMACY_CREDENTIALS.cityStatePin

  const gstin =
    options?.gstin ||
    sale.branch?.gstin ||
    sale.branch?.organization?.gstin ||
    DEFAULT_PHARMACY_CREDENTIALS.gstin

  const dlNumber =
    options?.dlNumber ||
    sale.branch?.dlNumber ||
    sale.branch?.organization?.dlNumber ||
    `${DEFAULT_PHARMACY_CREDENTIALS.dlNumber20B} / ${DEFAULT_PHARMACY_CREDENTIALS.dlNumber21B}`

  const phone =
    options?.phone ||
    sale.branch?.phone ||
    sale.branch?.organization?.phone ||
    DEFAULT_PHARMACY_CREDENTIALS.phone

  const email =
    options?.email ||
    sale.branch?.email ||
    sale.branch?.organization?.email ||
    DEFAULT_PHARMACY_CREDENTIALS.email

  const fssaiNumber = sale.branch?.fssaiNumber || DEFAULT_PHARMACY_CREDENTIALS.fssaiNumber
  const regPharmacist = sale.branch?.regPharmacist || DEFAULT_PHARMACY_CREDENTIALS.regPharmacist

  // Amounts & Taxes
  const subtotal = parseNum(sale.subtotal)
  const discount = parseNum(sale.discountAmount)
  const totalAmount = parseNum(sale.totalAmount)
  const taxAmount = parseNum(sale.taxAmount)
  let cgst = parseNum(sale.cgstAmount)
  let sgst = parseNum(sale.sgstAmount)
  const igst = parseNum(sale.igstAmount)

  if (cgst === 0 && sgst === 0 && igst === 0 && taxAmount > 0) {
    cgst = round2(taxAmount / 2)
    sgst = round2(taxAmount - cgst)
  }

  const rawTotal = subtotal - discount + taxAmount
  const roundOff = round2(totalAmount - rawTotal)

  const cashierName = sale.createdBy?.name || 'Authorized Dispenser'
  const customerDisplay = sale.customer?.name || sale.customerName || 'Walk-in Patient'
  const customerPhone = sale.customer?.phone || sale.customerPhone || null

  const doctorName =
    sale.doctor?.name || sale.doctorName || sale.prescription?.doctorName || null
  const doctorReg =
    sale.doctor?.regNumber || sale.prescription?.doctorRegNumber || null

  const paymentMode =
    sale.payments && sale.payments.length > 0
      ? sale.payments
          .map((p) => `${p.method}${p.reference ? ` [${p.reference}]` : ''}`)
          .join(', ')
      : 'Cash'

  const cashTendered = parseNum(sale.cashTendered)
  const changeAmount = parseNum(sale.changeAmount)

  const items: InvoiceLineItem[] = Array.isArray(sale.items) ? sale.items : []
  const gstSlabs = computeGstSlabs(items, {
    subtotal,
    discountAmount: discount,
    taxAmount,
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: igst,
  })

  // Helper for autotable finalY
  const getTableFinalY = (documentInstance: jsPDF): number => {
    interface ExtendedJsPdf extends jsPDF {
      lastAutoTable?: { finalY: number }
    }
    return (documentInstance as ExtendedJsPdf).lastAutoTable?.finalY ?? 0
  }

  // ═════════════════════════════════════════════════════════════
  // ─── THERMAL 80MM LAYOUT ─────────────────────────────────────
  // ═════════════════════════════════════════════════════════════
  if (isThermal) {
    // Dynamic height calculation to ensure continuous slip without extra page breaks
    const baseHeight = 52 + 28 + 36 + 32 + 16
    const itemsHeight = Math.max(items.length * 11, 20)
    const gstHeight = Math.max(gstSlabs.length * 6 + 14, 20)
    const totalEstimatedHeight = Math.max(160, baseHeight + itemsHeight + gstHeight)

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, totalEstimatedHeight],
    })

    const pageWidth = 80
    const margin = 4
    let currentY = 6

    // Header
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(pharmacyName.toUpperCase(), pageWidth / 2, currentY, { align: 'center' })
    currentY += 4

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.text(legalEntityName, pageWidth / 2, currentY, { align: 'center' })
    currentY += 3.2
    doc.text(facilityType, pageWidth / 2, currentY, { align: 'center' })
    currentY += 3.2
    doc.text(`${pharmacyAddress}, ${cityStatePin}`, pageWidth / 2, currentY, { align: 'center' })
    currentY += 3.2
    doc.text(`Phone: ${phone}`, pageWidth / 2, currentY, { align: 'center' })
    currentY += 3.2

    // Statutory Badges
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.text(`GSTIN: ${gstin} | DL: ${dlNumber}`, pageWidth / 2, currentY, { align: 'center' })
    currentY += 3.5

    // Document Title Banner
    doc.setFillColor(30, 41, 59)
    doc.rect(margin, currentY, pageWidth - margin * 2, 4.5, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.text('TAX INVOICE / RETAIL CASH MEMO', pageWidth / 2, currentY + 3.2, { align: 'center' })
    doc.setTextColor(0, 0, 0)
    currentY += 6

    // Metadata Grid
    doc.setDrawColor(180, 180, 180)
    doc.setLineDashPattern([1, 1], 0)
    doc.line(margin, currentY, pageWidth - margin, currentY)
    currentY += 2.5

    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.text(`Invoice: ${sale.invoiceNumber || 'INV-001'}`, margin, currentY)
    doc.setFont('helvetica', 'normal')
    doc.text(`Date: ${formatDateDisplay(sale.saleDate)} ${formatTimeDisplay(sale.saleDate)}`, pageWidth - margin, currentY, { align: 'right' })
    currentY += 3.2

    doc.text(`Patient: ${customerDisplay}`, margin, currentY)
    doc.text(`Status: ${sale.paymentStatus || 'PAID'}`, pageWidth - margin, currentY, { align: 'right' })
    currentY += 3.2

    if (customerPhone) {
      doc.text(`Phone: ${customerPhone}`, margin, currentY)
    }
    if (doctorName) {
      doc.text(`Dr: ${doctorName}${doctorReg ? ` (${doctorReg})` : ''}`, pageWidth - margin, currentY, { align: 'right' })
    }
    if (customerPhone || doctorName) currentY += 3.2

    doc.text(`Dispensed By: ${cashierName}`, margin, currentY)
    doc.text(`Pharmacist: ${regPharmacist}`, pageWidth - margin, currentY, { align: 'right' })
    currentY += 3.5

    doc.line(margin, currentY, pageWidth - margin, currentY)
    doc.setLineDashPattern([], 0) // reset dash
    currentY += 1.5

    // 80mm Table — 2-Tier Stacked Layout
    const tableBody: string[][] = items.map((it, idx) => {
      const batchNo =
        it.batchNumber || it.itemBatches?.[0]?.batch?.batchNumber || 'LOT-26A'
      const expStr = formatExpDate(it.expiryDate || it.itemBatches?.[0]?.batch?.expiryDate)
      const hsn = it.hsnCode || '3004'
      const rateVal = parseNum(it.unitPrice || it.mrp)
      const totalVal = parseNum(it.totalAmount)

      return [
        String(idx + 1),
        `${it.productName}\nHSN: ${hsn} | B: ${batchNo} | Exp: ${expStr}`,
        String(it.quantity),
        `Rs. ${rateVal.toFixed(2)}`,
        `Rs. ${totalVal.toFixed(2)}`,
      ]
    })

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['#', 'Item / HSN / Batch', 'Qty', 'Rate', 'Amount']],
      body: tableBody,
      theme: 'plain',
      styles: {
        fontSize: 6,
        cellPadding: 1,
        overflow: 'linebreak',
        textColor: [20, 20, 20],
      },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 6,
      },
      columnStyles: {
        0: { cellWidth: 5, halign: 'center' },
        1: { cellWidth: 35, halign: 'left' },
        2: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 11, halign: 'right' },
        4: { cellWidth: 13, halign: 'right', fontStyle: 'bold' },
      },
    })

    currentY = getTableFinalY(doc) + 2.5

    // Dynamic GST Matrix (Thermal Compact)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.text('GST TAX BREAKDOWN MATRIX', margin, currentY)
    currentY += 2

    const gstRows: string[][] = gstSlabs.map((s) => [
      s.slabLabel,
      `Rs. ${s.taxableAmount.toFixed(2)}`,
      `${s.cgstRate}%: Rs. ${s.cgstAmount.toFixed(2)}`,
      `${s.sgstRate}%: Rs. ${s.sgstAmount.toFixed(2)}`,
      `Rs. ${s.totalTax.toFixed(2)}`,
    ])

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Slab', 'Taxable', 'CGST', 'SGST', 'Total GST']],
      body: gstRows,
      theme: 'grid',
      styles: {
        fontSize: 5.5,
        cellPadding: 0.8,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: 14, halign: 'right' },
        2: { cellWidth: 16, halign: 'right' },
        3: { cellWidth: 16, halign: 'right' },
        4: { cellWidth: 12, halign: 'right', fontStyle: 'bold' },
      },
    })

    currentY = getTableFinalY(doc) + 3

    // Totals Box
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.text('Subtotal (Gross):', margin, currentY)
    doc.text(`Rs. ${subtotal.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' })
    currentY += 2.8

    if (discount > 0) {
      doc.text('Special Discount:', margin, currentY)
      doc.text(`-Rs. ${discount.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' })
      currentY += 2.8
    }

    doc.text('GST Tax Amount:', margin, currentY)
    doc.text(`Rs. ${taxAmount.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' })
    currentY += 2.8

    if (roundOff !== 0) {
      doc.text('Round-Off:', margin, currentY)
      doc.text(
        `${roundOff > 0 ? '+' : ''}Rs. ${roundOff.toFixed(2)}`,
        pageWidth - margin,
        currentY,
        { align: 'right' }
      )
      currentY += 2.8
    }

    // Net Payable Banner
    currentY += 0.5
    doc.setFillColor(15, 23, 42)
    doc.rect(margin, currentY, pageWidth - margin * 2, 6, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('NET PAYABLE:', margin + 2, currentY + 4.2)
    doc.text(`Rs. ${totalAmount.toFixed(2)}`, pageWidth - margin - 2, currentY + 4.2, { align: 'right' })
    doc.setTextColor(0, 0, 0)
    currentY += 8

    // Amount in words
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(5.5)
    doc.text(numberToWordsINR(totalAmount), margin, currentY)
    currentY += 3.2

    // Payment details
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.text(`Payment Mode: ${paymentMode}`, margin, currentY)
    doc.text(`Paid: Rs. ${totalAmount.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' })
    currentY += 2.8

    if (cashTendered > 0) {
      doc.text(`Received: Rs. ${cashTendered.toFixed(2)} | Change: Rs. ${changeAmount.toFixed(2)}`, margin, currentY)
      currentY += 2.8
    }

    // Terms and Signatory
    currentY += 1.5
    doc.setDrawColor(180, 180, 180)
    doc.line(margin, currentY, pageWidth - margin, currentY)
    currentY += 2.5

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.5)
    doc.text('Statutory Notice & Terms:', margin, currentY)
    currentY += 2.2
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5)
    doc.text('1. Schedule H/H1 drugs dispensed against valid prescription only.', margin, currentY)
    currentY += 2
    doc.text('2. Goods once sold will not be returned after 7 days.', margin, currentY)
    currentY += 2
    doc.text('3. Store medicines in cool, dry place away from sunlight.', margin, currentY)
    currentY += 3.5

    // Signature
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.5)
    doc.text(`For ${pharmacyName}`, pageWidth - margin, currentY, { align: 'right' })
    currentY += 5
    doc.line(pageWidth - margin - 30, currentY, pageWidth - margin, currentY)
    currentY += 2.2
    doc.setFontSize(5)
    doc.text('Authorized Signatory / Reg. Pharmacist', pageWidth - margin, currentY, { align: 'right' })

    return doc
  }

  // ═════════════════════════════════════════════════════════════
  // ─── A4 FULL TAX INVOICE LAYOUT ──────────────────────────────
  // ═════════════════════════════════════════════════════════════
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = 210
  const margin = 10
  const usableWidth = pageWidth - margin * 2 // 190mm
  let currentY = 12

  // 1. Pharmacy Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(15, 23, 42) // slate-900
  doc.text(pharmacyName.toUpperCase(), pageWidth / 2, currentY, { align: 'center' })
  currentY += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(51, 65, 85) // slate-700
  doc.text(legalEntityName, pageWidth / 2, currentY, { align: 'center' })
  currentY += 4
  doc.text(facilityType, pageWidth / 2, currentY, { align: 'center' })
  currentY += 4
  doc.text(`${pharmacyAddress}, ${cityStatePin}`, pageWidth / 2, currentY, { align: 'center' })
  currentY += 4
  doc.text(`Helpline: ${phone} | Email: ${email}`, pageWidth / 2, currentY, { align: 'center' })
  currentY += 4

  // Statutory Credentials Pills Box
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(margin, currentY, usableWidth, 6, 1, 1, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(30, 41, 59)
  const credsText = `GSTIN: ${gstin}    |    D.L. No: ${dlNumber}    |    FSSAI: ${fssaiNumber}`
  doc.text(credsText, pageWidth / 2, currentY + 4.2, { align: 'center' })
  currentY += 8.5

  // Title Banner
  doc.setFillColor(15, 23, 42)
  doc.rect(margin, currentY, usableWidth, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('TAX INVOICE / RETAIL CASH MEMO', pageWidth / 2, currentY + 4.8, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  currentY += 9

  // 2. Invoice & Patient Metadata Box (2-column grid with bordered box)
  doc.setDrawColor(203, 213, 225)
  doc.rect(margin, currentY, usableWidth, 22)

  doc.setFontSize(8)
  const leftColX = margin + 3
  const midX = margin + usableWidth / 2 + 3

  let metaY = currentY + 4.5
  doc.setFont('helvetica', 'bold')
  doc.text('Invoice No:', leftColX, metaY)
  doc.setFont('helvetica', 'normal')
  doc.text(sale.invoiceNumber || 'INV-001', leftColX + 22, metaY)

  doc.setFont('helvetica', 'bold')
  doc.text('Patient Name:', midX, metaY)
  doc.setFont('helvetica', 'normal')
  doc.text(customerDisplay, midX + 24, metaY)

  metaY += 4.5
  doc.setFont('helvetica', 'bold')
  doc.text('Date & Time:', leftColX, metaY)
  doc.setFont('helvetica', 'normal')
  doc.text(`${formatDateDisplay(sale.saleDate)} ${formatTimeDisplay(sale.saleDate)}`, leftColX + 22, metaY)

  doc.setFont('helvetica', 'bold')
  doc.text('Mobile No:', midX, metaY)
  doc.setFont('helvetica', 'normal')
  doc.text(customerPhone || 'N/A', midX + 24, metaY)

  metaY += 4.5
  doc.setFont('helvetica', 'bold')
  doc.text('Dispensed By:', leftColX, metaY)
  doc.setFont('helvetica', 'normal')
  doc.text(cashierName, leftColX + 22, metaY)

  doc.setFont('helvetica', 'bold')
  doc.text('Ref. Doctor:', midX, metaY)
  doc.setFont('helvetica', 'normal')
  doc.text(doctorName ? `Dr. ${doctorName}${doctorReg ? ` (${doctorReg})` : ''}` : 'N/A', midX + 24, metaY)

  metaY += 4.5
  doc.setFont('helvetica', 'bold')
  doc.text('Pharmacist:', leftColX, metaY)
  doc.setFont('helvetica', 'normal')
  doc.text(regPharmacist, leftColX + 22, metaY)

  doc.setFont('helvetica', 'bold')
  doc.text('Payment Status:', midX, metaY)
  doc.setFont('helvetica', 'normal')
  doc.text(sale.paymentStatus || 'PAID', midX + 24, metaY)

  currentY += 24.5

  // 3. Line Items Table with jspdf-autotable
  const tableData: string[][] = items.map((it, idx) => {
    const batchNo =
      it.batchNumber || it.itemBatches?.[0]?.batch?.batchNumber || 'LOT-26A'
    const expStr = formatExpDate(it.expiryDate || it.itemBatches?.[0]?.batch?.expiryDate)
    const hsn = it.hsnCode || '3004'
    const mrpVal = parseNum(it.mrp || it.unitPrice)
    const rateVal = parseNum(it.unitPrice)
    const discPct = parseNum(it.discountPercent)
    const discAmt = parseNum(it.discountAmount)
    const discDisplay = discPct > 0 ? `${discPct}%` : discAmt > 0 ? `Rs. ${discAmt.toFixed(2)}` : '0%'
    const totalVal = parseNum(it.totalAmount)

    const desc = it.genericName || it.composition
      ? `${it.productName}\n(${it.genericName || it.composition})`
      : it.productName

    return [
      String(idx + 1),
      desc,
      hsn,
      batchNo,
      expStr,
      String(it.quantity),
      `Rs. ${mrpVal.toFixed(2)}`,
      `Rs. ${rateVal.toFixed(2)}`,
      discDisplay,
      `Rs. ${totalVal.toFixed(2)}`,
    ]
  })

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [
      ['#', 'Description / Composition', 'HSN', 'Batch', 'Exp', 'Qty', 'MRP', 'Rate', 'Disc', 'Amount'],
    ],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      overflow: 'linebreak',
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 50, halign: 'left' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 12, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 16, halign: 'right' },
      7: { cellWidth: 16, halign: 'right' },
      8: { cellWidth: 14, halign: 'right' },
      9: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  })

  currentY = getTableFinalY(doc) + 4

  // 4. Dynamic Multi-Slab GST Matrix
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('GST TAX BREAKDOWN MATRIX (STATUTORY RULE 46 COMPLIANT)', margin, currentY)
  currentY += 2

  const gstMatrixRows: string[][] = gstSlabs.map((s) => [
    s.slabLabel,
    `Rs. ${s.taxableAmount.toFixed(2)}`,
    `${s.cgstRate}%`,
    `Rs. ${s.cgstAmount.toFixed(2)}`,
    `${s.sgstRate}%`,
    `Rs. ${s.sgstAmount.toFixed(2)}`,
    `${s.igstRate}%`,
    `Rs. ${s.igstAmount.toFixed(2)}`,
    `Rs. ${s.totalTax.toFixed(2)}`,
  ])

  // Total Row for GST Matrix
  const totalTaxable = gstSlabs.reduce((sum, s) => sum + s.taxableAmount, 0)
  const totalCgst = gstSlabs.reduce((sum, s) => sum + s.cgstAmount, 0)
  const totalSgst = gstSlabs.reduce((sum, s) => sum + s.sgstAmount, 0)
  const totalIgst = gstSlabs.reduce((sum, s) => sum + s.igstAmount, 0)
  const totalTaxAll = gstSlabs.reduce((sum, s) => sum + s.totalTax, 0)

  gstMatrixRows.push([
    'TOTAL',
    `Rs. ${totalTaxable.toFixed(2)}`,
    '-',
    `Rs. ${totalCgst.toFixed(2)}`,
    '-',
    `Rs. ${totalSgst.toFixed(2)}`,
    '-',
    `Rs. ${totalIgst.toFixed(2)}`,
    `Rs. ${totalTaxAll.toFixed(2)}`,
  ])

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [
      ['GST Slab', 'Taxable Value', 'CGST %', 'CGST Amt', 'SGST %', 'SGST Amt', 'IGST %', 'IGST Amt', 'Total GST'],
    ],
    body: gstMatrixRows,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [30, 41, 59],
      fontStyle: 'bold',
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold' },
      1: { cellWidth: 26, halign: 'right' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 16, halign: 'center' },
      7: { cellWidth: 20, halign: 'right' },
      8: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
  })

  currentY = getTableFinalY(doc) + 4

  // 5. Financial Summary & Net Payable Banner
  const totalsBoxX = margin + 100
  const totalsBoxWidth = usableWidth - 100 // 90mm

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Subtotal (Gross Value):', totalsBoxX, currentY)
  doc.text(`Rs. ${subtotal.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' })
  currentY += 4

  if (discount > 0) {
    doc.text('Special Discount:', totalsBoxX, currentY)
    doc.text(`-Rs. ${discount.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' })
    currentY += 4
  }

  doc.text('Total GST Tax Amount:', totalsBoxX, currentY)
  doc.text(`Rs. ${taxAmount.toFixed(2)}`, pageWidth - margin, currentY, { align: 'right' })
  currentY += 4

  if (roundOff !== 0) {
    doc.text('Round-Off Adjustment:', totalsBoxX, currentY)
    doc.text(
      `${roundOff > 0 ? '+' : ''}Rs. ${roundOff.toFixed(2)}`,
      pageWidth - margin,
      currentY,
      { align: 'right' }
    )
    currentY += 4
  }

  // Net Payable Banner
  currentY += 1
  doc.setFillColor(15, 23, 42)
  doc.rect(totalsBoxX - 2, currentY, totalsBoxWidth + 2, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('NET PAYABLE:', totalsBoxX + 2, currentY + 5.5)
  doc.text(`Rs. ${totalAmount.toFixed(2)}`, pageWidth - margin - 2, currentY + 5.5, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  currentY += 11

  // Amount in words (INR)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Amount in Words:', margin, currentY)
  doc.setFont('helvetica', 'italic')
  doc.text(numberToWordsINR(totalAmount), margin + 30, currentY)
  currentY += 4.5

  // Payment Mode
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Payment Mode: ${paymentMode}    |    Paid: Rs. ${totalAmount.toFixed(2)}`, margin, currentY)
  if (cashTendered > 0) {
    doc.text(`    |    Cash Tendered: Rs. ${cashTendered.toFixed(2)}    |    Change: Rs. ${changeAmount.toFixed(2)}`, margin + 70, currentY)
  }
  currentY += 6

  // 6. Statutory Terms & Pharmacist Signature Block
  doc.setDrawColor(203, 213, 225)
  doc.line(margin, currentY, pageWidth - margin, currentY)
  currentY += 4

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text('Terms & Conditions:', margin, currentY)
  currentY += 3.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text('1. Caution: Schedule H & H1 prescription drugs are dispensed strictly against a registered medical practitioner prescription.', margin, currentY)
  currentY += 3.2
  doc.text('2. Goods once sold will not be returned after 7 days or if strip blister / vial seal is damaged or unsealed.', margin, currentY)
  currentY += 3.2
  doc.text('3. Storage Condition: Store medicines in a cool, dry and hygienic environment away from direct sunlight.', margin, currentY)
  currentY += 5

  // Signatures line
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text('GST HSN Code: 3004 (Medicaments)', margin, currentY)

  const sigX = pageWidth - margin
  doc.text(`For ${pharmacyName}`, sigX, currentY, { align: 'right' })
  currentY += 10
  doc.line(sigX - 60, currentY, sigX, currentY)
  currentY += 3.5
  doc.setFontSize(7)
  doc.text('Authorized Signatory / Registered Pharmacist', sigX, currentY, { align: 'right' })

  return doc
}

/**
 * Generates binary Buffer for server-side response or file persistence
 */
export function generateInvoicePdfBuffer(sale: InvoiceSaleData, options?: InvoicePdfOptions): Buffer {
  const doc = generateInvoicePdfDoc(sale, options)
  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}

/**
 * Triggers client-side instant file download in browser environments
 */
export function downloadInvoicePdf(
  sale: InvoiceSaleData,
  options?: InvoicePdfOptions,
  customFilename?: string
): void {
  const doc = generateInvoicePdfDoc(sale, options)
  const formatSuffix =
    options?.format === 'thermal80' || options?.format === 'slip'
      ? 'Thermal-80mm'
      : 'Tax-Invoice'
  const filename = customFilename || `Invoice-${sale.invoiceNumber || 'POS'}-${formatSuffix}.pdf`
  doc.save(filename)
}
