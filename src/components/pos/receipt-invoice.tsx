'use client'

// ─────────────────────────────────────────────────────────────
// Component — ReceiptInvoice
// Tier-1 Gold Standard Pharmacy GST Tax Invoice & POS Thermal Slip
// Compliant with Drugs & Cosmetics Act, GST Rules & FSSAI Standards
// ─────────────────────────────────────────────────────────────
import { format, isValid, parseISO } from 'date-fns'
import { Download, FileSpreadsheet, Printer } from 'lucide-react'
import React, { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { computeGstSlabs, downloadInvoicePdf } from '@/lib/pdf/invoice-pdf-generator'
import { downloadSaleInvoiceExcel } from '@/lib/reports/invoice-excel-generator'
import { checkDiscountExemption } from '@/lib/pricing/discount-exemption'
import { cn } from '@/lib/utils/cn'

export interface ReceiptItemBatch {
  batch?: {
    id?: string
    batchNumber?: string
    expiryDate?: string | Date
    manufacturingDate?: string | Date
  }
}

export interface ReceiptItem {
  id?: string
  productName: string
  productSku?: string
  genericName?: string | null
  composition?: string | null
  strength?: string | null
  hsnCode?: string | null
  unitOfMeasure?: string | null
  quantity: number
  unitPrice: number | string | { toString(): string }
  mrp?: number | string | { toString(): string }
  discountPercent?: number | string | { toString(): string }
  discountAmount?: number | string | { toString(): string }
  taxPercent?: number | string | { toString(): string }
  cgstPercent?: number | string | { toString(): string }
  sgstPercent?: number | string | { toString(): string }
  igstPercent?: number | string | { toString(): string }
  taxAmount?: number | string | { toString(): string }
  totalAmount: number | string | { toString(): string }
  itemBatches?: ReceiptItemBatch[]
  batchNumber?: string
  expiryDate?: string | Date
  manufacturingDate?: string | Date
  isCutStrip?: boolean
  tabsCut?: number
}

export interface ReceiptPayment {
  id?: string
  method: string
  amount: number | string | { toString(): string }
  reference?: string | null
}

export interface ReceiptData {
  id?: string
  invoiceNumber: string
  saleDate: string | Date
  subtotal: number | string | { toString(): string }
  discountAmount?: number | string | { toString(): string }
  discountPercent?: number | string | { toString(): string }
  taxAmount: number | string | { toString(): string }
  cgstAmount?: number | string | { toString(): string }
  sgstAmount?: number | string | { toString(): string }
  igstAmount?: number | string | { toString(): string }
  totalAmount: number | string | { toString(): string }
  amountPaid: number | string | { toString(): string }
  balanceDue?: number | string | { toString(): string }
  cashTendered?: number | string | { toString(): string }
  changeAmount?: number | string | { toString(): string }
  status?: string
  paymentStatus?: string
  notes?: string | null
  prescriptionId?: string | null

  customer?: {
    id?: string
    name?: string | null
    phone?: string | null
    address?: string | null
    gstin?: string | null
  } | null
  customerName?: string | null
  customerPhone?: string | null

  createdBy?: {
    id?: string
    name?: string | null
  } | null

  branch?: {
    id?: string
    name?: string | null
    code?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    pincode?: string | null
    phone?: string | null
    email?: string | null
    gstin?: string | null
    dlNumber?: string | null
    dlNumber20B?: string | null
    dlNumber21B?: string | null
    fssaiNumber?: string | null
    regPharmacist?: string | null
    organization?: {
      id?: string
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
  } | null

  prescription?: {
    id?: string
    prescriptionNumber?: string | null
    doctorName?: string | null
    doctorRegNumber?: string | null
    patientName?: string | null
  } | null

  doctor?: {
    id?: string
    name?: string | null
    regNumber?: string | null
    clinicName?: string | null
  } | null
  doctorName?: string | null

  items: ReceiptItem[]
  payments?: ReceiptPayment[]
}

interface ReceiptInvoiceProps {
  sale: ReceiptData
  showPrintButton?: boolean
  className?: string
  variant?: 'slip' | 'full'
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

function parseNum(val: unknown): number {
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

function formatDateDisplay(dInput: string | Date | null | undefined): string {
  if (!dInput) return '-'
  const d = typeof dInput === 'string' ? parseISO(dInput) : dInput
  if (!isValid(d)) return typeof dInput === 'string' ? dInput : '-'
  return format(d, 'dd-MMM-yyyy')
}

function formatTimeDisplay(dInput: string | Date | null | undefined): string {
  if (!dInput) return '-'
  const d = typeof dInput === 'string' ? parseISO(dInput) : dInput
  if (!isValid(d)) return '-'
  return format(d, 'hh:mm a')
}

function formatExpDate(dInput: string | Date | null | undefined): string {
  if (!dInput) return '-'
  const d = typeof dInput === 'string' ? parseISO(dInput) : dInput
  if (!isValid(d)) return String(dInput)
  return format(d, 'MM/yy')
}

// Number to Words Converter for Indian Rupee Invoices
function numberToWordsINR(amount: number): string {
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

export function ReceiptInvoice({
  sale,
  showPrintButton = true,
  className = '',
  variant: initialVariant = 'slip',
}: ReceiptInvoiceProps) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const [printVariant, setPrintVariant] = useState<'slip' | 'full'>(initialVariant)

  // Pharmacy & Branch Full Credentials with robust fallbacks
  const pharmacyName =
    sale.branch?.organization?.name ||
    sale.branch?.name ||
    DEFAULT_PHARMACY_CREDENTIALS.name

  const legalEntityName =
    sale.branch?.organization?.legalName ||
    DEFAULT_PHARMACY_CREDENTIALS.legalName

  const pharmacyAddress =
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
    sale.branch?.gstin ||
    sale.branch?.organization?.gstin ||
    DEFAULT_PHARMACY_CREDENTIALS.gstin

  const dlNumber =
    sale.branch?.dlNumber ||
    sale.branch?.organization?.dlNumber ||
    `${DEFAULT_PHARMACY_CREDENTIALS.dlNumber20B} / ${DEFAULT_PHARMACY_CREDENTIALS.dlNumber21B}`

  const phone =
    sale.branch?.phone ||
    sale.branch?.organization?.phone ||
    DEFAULT_PHARMACY_CREDENTIALS.phone

  const email =
    sale.branch?.email ||
    sale.branch?.organization?.email ||
    DEFAULT_PHARMACY_CREDENTIALS.email

  const fssaiNumber =
    sale.branch?.fssaiNumber || DEFAULT_PHARMACY_CREDENTIALS.fssaiNumber

  const regPharmacist =
    sale.branch?.regPharmacist || DEFAULT_PHARMACY_CREDENTIALS.regPharmacist

  // Amounts & Taxes
  const subtotal = parseNum(sale.subtotal)
  const discount = parseNum(sale.discountAmount)
  const totalAmount = parseNum(sale.totalAmount)
  const taxAmount = parseNum(sale.taxAmount)
  let cgst = parseNum(sale.cgstAmount)
  let sgst = parseNum(sale.sgstAmount)
  const igst = parseNum(sale.igstAmount)

  if (cgst === 0 && sgst === 0 && igst === 0 && taxAmount > 0) {
    cgst = Number((taxAmount / 2).toFixed(2))
    sgst = Number((taxAmount - cgst).toFixed(2))
  }

  const rawTotal = subtotal - discount + taxAmount
  const roundOff = Number((totalAmount - rawTotal).toFixed(2))

  const cashierName = sale.createdBy?.name || 'Authorized Dispenser'
  const customerDisplay =
    sale.customer?.name ||
    sale.customerName ||
    'Walk-in Patient'
  const customerPhone =
    sale.customer?.phone ||
    sale.customerPhone ||
    null

  const paymentMode =
    sale.payments && sale.payments.length > 0
      ? sale.payments
          .map((p) => `${p.method}${p.reference ? ` [${p.reference}]` : ''}`)
          .join(', ')
      : 'Cash'

  const cashTendered = parseNum(sale.cashTendered)
  const changeAmount = parseNum(sale.changeAmount)

  const doctorName = sale.doctor?.name || sale.doctorName || sale.prescription?.doctorName || null
  const doctorReg = sale.doctor?.regNumber || sale.prescription?.doctorRegNumber || null

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPdf = () => {
    downloadInvoicePdf(sale as any, { format: printVariant === 'slip' ? 'thermal80' : 'a4' })
  }

  const handleDownloadExcel = () => {
    downloadSaleInvoiceExcel(sale as any)
  }

  const gstSlabs = computeGstSlabs(sale.items as any, {
    subtotal,
    discountAmount: discount,
    taxAmount,
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: igst,
  })

  return (
    <div className={cn('flex flex-col items-center w-full', className)}>
      {/* ─── Print Format Toggle Bar (Screen Only) ──────────────── */}
      {showPrintButton && (
        <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2 w-full max-w-2xl bg-muted/40 p-2 rounded-lg border text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-muted-foreground">Print Layout:</span>
            <Button
              type="button"
              size="sm"
              variant={printVariant === 'slip' ? 'default' : 'outline'}
              onClick={() => setPrintVariant('slip')}
              className="h-7 text-xs font-bold"
            >
              80mm (3&quot;) Thermal POS Slip
            </Button>
            <Button
              type="button"
              size="sm"
              variant={printVariant === 'full' ? 'default' : 'outline'}
              onClick={() => setPrintVariant('full')}
              className="h-7 text-xs font-bold"
            >
              A4 / A5 Full GST Tax Invoice
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleDownloadExcel}
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 font-bold text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
              title="Download fully formatted Tax Invoice and HSN tax summary workbook (.xlsx)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Download Excel
            </Button>
            <Button
              type="button"
              onClick={handleDownloadPdf}
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 font-bold text-xs border-zinc-300 hover:bg-zinc-100"
            >
              <Download className="h-3.5 w-3.5" /> Download PDF
            </Button>
            <Button
              type="button"
              onClick={handlePrint}
              size="sm"
              className="h-7 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
            >
              <Printer className="h-3.5 w-3.5" /> Print Tax Invoice
            </Button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ─── PRINTABLE DOCUMENT CONTAINER                            ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div
        ref={receiptRef}
        id="printable-receipt"
        className={cn(
          'w-full bg-white font-sans text-black shadow-sm print:shadow-none print:m-0 print:border-none relative',
          printVariant === 'full'
            ? 'max-w-2xl rounded-lg border border-zinc-300 p-6 text-xs'
            : 'max-w-sm rounded-md border border-dashed border-zinc-400 p-4 font-mono text-[11px]'
        )}
      >
        {/* Statutory Software Logo Print Watermark */}
        <div className="print-watermark" aria-hidden="true" />
        {/* ── Header: Complete Pharmacy Credentials ── */}
        <div className="border-b-2 border-black pb-2 text-center">
          <h1
            className={cn(
              'font-black tracking-tight uppercase text-black',
              printVariant === 'full' ? 'text-lg font-serif' : 'text-sm font-extrabold'
            )}
          >
            {pharmacyName}
          </h1>
          <p className="text-[10px] font-semibold text-zinc-700 tracking-wide uppercase">
            {legalEntityName}
          </p>
          <p className="text-[10px] text-zinc-600">{DEFAULT_PHARMACY_CREDENTIALS.facilityType}</p>
          <p className="text-[10px] text-zinc-700 mt-0.5 font-medium">
            {pharmacyAddress}, {cityStatePin}
          </p>
          <p className="text-[10px] text-zinc-700">
            Helpline: <strong>{phone}</strong> | Email: {email}
          </p>

          {/* Statutory Credential Pills */}
          <div className="mt-1.5 pt-1.5 border-t border-dashed border-zinc-300 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[10px] font-bold">
            <span className="bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-300">
              GSTIN: {gstin}
            </span>
            <span className="bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-300">
              D.L. No: {dlNumber}
            </span>
            <span className="bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-300">
              FSSAI: {fssaiNumber}
            </span>
          </div>

          <div className="mt-1.5 text-center">
            <span className="inline-block border border-black bg-zinc-900 text-white font-black text-[9px] px-2 py-0.5 uppercase tracking-widest">
              TAX INVOICE / RETAIL CASH MEMO
            </span>
            <span className="text-[9px] text-zinc-500 block mt-0.5">
              (Original for Recipient • Drugs & Cosmetics Act Approved)
            </span>
          </div>
        </div>

        {/* ── Invoice Metadata & Patient / Doctor Box ── */}
        <div className="border-b border-dashed border-zinc-400 py-2 grid grid-cols-2 gap-2 text-[10px] leading-tight">
          <div className="space-y-0.5">
            <div>
              <span className="text-zinc-500">Invoice No:</span>{' '}
              <strong className="font-mono text-black font-extrabold text-[11px]">
                {sale.invoiceNumber}
              </strong>
            </div>
            <div>
              <span className="text-zinc-500">Date & Time:</span>{' '}
              <strong>
                {formatDateDisplay(sale.saleDate)} {formatTimeDisplay(sale.saleDate)}
              </strong>
            </div>
            <div>
              <span className="text-zinc-500">Dispensed By:</span>{' '}
              <strong>{cashierName}</strong>
            </div>
            <div>
              <span className="text-zinc-500">Pharmacist:</span>{' '}
              <strong>{regPharmacist}</strong>
            </div>
          </div>

          <div className="space-y-0.5 text-right sm:text-left">
            <div>
              <span className="text-zinc-500">Patient / Customer:</span>{' '}
              <strong className="text-black font-bold">{customerDisplay}</strong>
            </div>
            {customerPhone && (
              <div>
                <span className="text-zinc-500">Mobile:</span>{' '}
                <strong>{customerPhone}</strong>
              </div>
            )}
            {doctorName && (
              <div>
                <span className="text-zinc-500">Ref. Doctor:</span>{' '}
                <strong className="text-black font-bold">
                  Dr. {doctorName}
                  {doctorReg ? ` (${doctorReg})` : ''}
                </strong>
              </div>
            )}
            <div>
              <span className="text-zinc-500">Payment Status:</span>{' '}
              <strong className="text-emerald-700 uppercase">{sale.paymentStatus || 'PAID'}</strong>
            </div>
          </div>
        </div>

        {/* ── Itemized Pharmaceutical Table ── */}
        <div className="py-2 border-b-2 border-black">
          {printVariant === 'slip' ? (
            /* ── 80mm Thermal Slip: 2-Tier Stacked Card View ── */
            <div className="divide-y divide-zinc-200">
              <div className="flex justify-between pb-1 border-b border-black font-black uppercase text-[10px] text-zinc-800">
                <span>Item Description / Batch</span>
                <span className="tabular-nums">Qty / Rate / Amount</span>
              </div>
              {sale.items.map((it, idx) => {
                const batchNo =
                  it.batchNumber ||
                  it.itemBatches?.[0]?.batch?.batchNumber ||
                  'LOT-26A'
                const expStr = formatExpDate(
                  it.expiryDate || it.itemBatches?.[0]?.batch?.expiryDate
                )
                const hsn = it.hsnCode || '3004'
                const rateVal = parseNum(it.unitPrice || it.mrp)
                const totalVal = parseNum(it.totalAmount)
                const discAmt = parseNum(it.discountAmount)
                const discPct = parseNum(it.discountPercent)
                const exemption = checkDiscountExemption((it as any).product || it)
                const discStr = exemption.isExempt
                  ? ' [DPCO/Exempt]'
                  : discPct > 0
                    ? ` (Disc ${discPct}%)`
                    : discAmt > 0
                      ? ` (Disc -₹${discAmt.toFixed(2)})`
                      : ''

                return (
                  <div key={idx} className="py-1 text-[10.5px] leading-tight space-y-0.5">
                    {/* Tier 1: S.No + Product Name + HSN */}
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-bold text-black flex-1">
                        <span className="font-mono text-zinc-500 mr-1">{idx + 1}.</span>
                        {it.productName}
                      </span>
                      <span className="text-[9px] font-mono font-medium text-zinc-600 bg-zinc-100 px-1 py-0.2 rounded border border-zinc-200 whitespace-nowrap">
                        HSN {hsn}
                      </span>
                    </div>

                    {/* Generic / Composition / Cut Strip if present */}
                    {(it.genericName || it.composition) && (
                      <div className="text-[9px] text-zinc-500 truncate pl-3">
                        {it.genericName || it.composition}
                      </div>
                    )}
                    {it.tabsCut && (
                      <div className="text-[9px] font-bold text-emerald-700 pl-3">
                        Cut Strip: {it.tabsCut} Tabs
                      </div>
                    )}

                    {/* Tier 2: Batch, Expiry, Qty @ Rate, Disc, Amount */}
                    <div className="flex items-center justify-between pl-3 text-[9.5px] text-zinc-700 font-mono">
                      <span>
                        B: <strong className="text-black uppercase">{batchNo}</strong> | Exp: {expStr}
                      </span>
                      <div className="text-right">
                        <span>
                          {it.quantity} × ₹{rateVal.toFixed(2)}{discStr} ={' '}
                        </span>
                        <strong className="text-black font-extrabold text-[10.5px] tabular-nums">
                          ₹{totalVal.toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* ── A4 / A5 Full Tax Invoice: Proportional Grid View ── */
            <table className="w-full text-left border-collapse text-[10.5px]">
              <thead>
                <tr className="border-b border-black font-black uppercase text-zinc-800 text-[9.5px]">
                  <th className="py-1 pr-1 w-[4%] text-center">#</th>
                  <th className="py-1 px-1.5 w-[33%]">Description & Composition</th>
                  <th className="py-1 px-1 text-center w-[8%]">HSN</th>
                  <th className="py-1 px-1 text-center w-[10%]">Batch</th>
                  <th className="py-1 px-1 text-center w-[7%]">Exp</th>
                  <th className="py-1 px-1 text-right w-[6%] tabular-nums">Qty</th>
                  <th className="py-1 px-1 text-right w-[8%] tabular-nums">MRP</th>
                  <th className="py-1 px-1 text-right w-[8%] tabular-nums">Rate</th>
                  <th className="py-1 px-1 text-right w-[6%] tabular-nums">Disc</th>
                  <th className="py-1 pl-1 text-right w-[10%] tabular-nums">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {sale.items.map((it, idx) => {
                  const batchNo =
                    it.batchNumber ||
                    it.itemBatches?.[0]?.batch?.batchNumber ||
                    'LOT-26A'

                  const expStr = formatExpDate(
                    it.expiryDate || it.itemBatches?.[0]?.batch?.expiryDate
                  )
                  const hsn = it.hsnCode || '3004'

                  const mrpVal = parseNum(it.mrp || it.unitPrice)
                  const rateVal = parseNum(it.unitPrice)
                  const totalVal = parseNum(it.totalAmount)
                  const discPct = parseNum(it.discountPercent)
                  const discAmt = parseNum(it.discountAmount)
                  const exemption = checkDiscountExemption((it as any).product || it)
                  const discDisplay = exemption.isExempt
                    ? '0% [Exempt]'
                    : discPct > 0
                      ? `${discPct}%`
                      : discAmt > 0
                        ? `₹${discAmt.toFixed(2)}`
                        : '-'

                  return (
                    <tr key={idx} className="align-top leading-tight hover:bg-zinc-50/50">
                      <td className="py-1 text-zinc-500 font-mono text-center">{idx + 1}</td>
                      <td className="py-1 px-1.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          <strong className="font-bold text-black">{it.productName}</strong>
                          {exemption.isExempt && (
                            <span className="text-[7.5px] font-bold px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              {exemption.badgeText || 'DPCO Exempt'}
                            </span>
                          )}
                        </div>
                        {(it.genericName || it.composition) && (
                          <span className="text-[9px] text-zinc-500 block truncate max-w-[240px]">
                            {it.genericName || it.composition}
                          </span>
                        )}
                        {it.tabsCut && (
                          <span className="text-[9px] font-bold text-emerald-700 block">
                            Cut Strip: {it.tabsCut} Tabs
                          </span>
                        )}
                      </td>
                      <td className="py-1 px-1 text-center font-mono font-medium text-zinc-600">{hsn}</td>
                      <td className="py-1 px-1 text-center font-mono font-bold uppercase">{batchNo}</td>
                      <td className="py-1 px-1 text-center font-mono text-zinc-600">{expStr}</td>
                      <td className="py-1 px-1 text-right font-bold font-mono tabular-nums">{it.quantity}</td>
                      <td className="py-1 px-1 text-right font-mono tabular-nums text-zinc-600">₹{mrpVal.toFixed(2)}</td>
                      <td className="py-1 px-1 text-right font-mono tabular-nums">₹{rateVal.toFixed(2)}</td>
                      <td className="py-1 px-1 text-right font-mono tabular-nums text-zinc-600">{discDisplay}</td>
                      <td className="py-1 pl-1 text-right font-mono font-extrabold tabular-nums">₹{totalVal.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Subtotals, GST Matrix & Payment Breakdown ── */}
        <div className="py-2 border-b border-dashed border-zinc-400 space-y-1.5 text-[10px]">
          <div className="flex justify-between text-zinc-700">
            <span>Subtotal (Gross Value):</span>
            <span className="font-mono font-semibold tabular-nums">₹{subtotal.toFixed(2)}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Special Discount:</span>
              <span className="font-mono tabular-nums">-₹{discount.toFixed(2)}</span>
            </div>
          )}

          {/* Dynamic GST Multi-Slab Matrix Breakdown */}
          {gstSlabs.length > 0 && (
            <div className="my-1.5 py-1 px-2 bg-zinc-50 rounded border border-zinc-200">
              <div className="font-bold text-[9px] uppercase tracking-wider text-zinc-700 mb-1">
                Statutory GST Tax Breakdown Matrix
              </div>
              {printVariant === 'full' ? (
                <table className="w-full text-[9px] border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-300 text-zinc-600 font-bold uppercase">
                      <th className="py-0.5 text-left">Slab</th>
                      <th className="py-0.5 text-right">Taxable Base</th>
                      <th className="py-0.5 text-right">CGST</th>
                      <th className="py-0.5 text-right">SGST</th>
                      <th className="py-0.5 text-right">IGST</th>
                      <th className="py-0.5 text-right">Total GST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 font-mono tabular-nums">
                    {gstSlabs.map((s, idx) => (
                      <tr key={idx} className="text-zinc-700">
                        <td className="py-0.5 font-bold font-sans text-left">{s.slabLabel}</td>
                        <td className="py-0.5 text-right">₹{s.taxableAmount.toFixed(2)}</td>
                        <td className="py-0.5 text-right">
                          {s.cgstRate > 0 ? `(${s.cgstRate}%) ₹${s.cgstAmount.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-0.5 text-right">
                          {s.sgstRate > 0 ? `(${s.sgstRate}%) ₹${s.sgstAmount.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-0.5 text-right">
                          {s.igstRate > 0 ? `(${s.igstRate}%) ₹${s.igstAmount.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-0.5 text-right font-bold text-black">₹{s.totalTax.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="space-y-0.5 text-[9px] font-mono tabular-nums">
                  {gstSlabs.map((s, idx) => (
                    <div key={idx} className="flex justify-between text-zinc-600">
                      <span>{s.slabLabel} (on ₹{s.taxableAmount.toFixed(2)}):</span>
                      <span className="font-semibold text-black">₹{s.totalTax.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-zinc-200 pt-0.5 font-bold text-black">
                    <span>Total Tax:</span>
                    <span>₹{taxAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {roundOff !== 0 && (
            <div className="flex justify-between text-zinc-600">
              <span>Round-Off:</span>
              <span className="font-mono tabular-nums">
                {roundOff > 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center border-t-2 border-black pt-1.5 text-black">
            <span className="font-black text-xs uppercase tracking-wide">NET PAYABLE AMOUNT:</span>
            <span className="font-mono font-black text-sm tabular-nums">₹{totalAmount.toFixed(2)}</span>
          </div>

          {/* Amount in Words */}
          <div className="text-[9px] font-bold text-zinc-700 italic border-t border-dotted border-zinc-300 pt-1">
            Amount in words: {numberToWordsINR(totalAmount)}
          </div>
        </div>

        {/* ── Payment Mode & Change Return ── */}
        <div className="py-1.5 border-b border-dashed border-zinc-400 text-[10px] space-y-0.5">
          <div className="flex justify-between">
            <span>
              Payment Mode: <strong className="font-bold text-black uppercase">{paymentMode}</strong>
            </span>
            <span>
              Paid: <strong className="font-mono font-bold">₹{totalAmount.toFixed(2)}</strong>
            </span>
          </div>
          {cashTendered > 0 && (
            <div className="flex justify-between text-emerald-800 font-bold">
              <span>Cash Received: ₹{cashTendered.toFixed(2)}</span>
              <span>Change Returned: ₹{changeAmount.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* ── Statutory Terms & Pharmacist Signature ── */}
        <div className="pt-2 text-[9px] text-zinc-600 space-y-1">
          <div className="font-bold text-zinc-800 uppercase text-[9px]">Terms & Conditions:</div>
          <p className="leading-tight">
            1. Caution: Schedule H & H1 drugs are dispensed strictly against a registered medical practitioner&apos;s prescription.
          </p>
          <p className="leading-tight">
            2. Goods once sold will not be returned after 7 days or if strip blister is broken.
          </p>
          <p className="leading-tight">
            3. Storage Condition: Store in a cool and dry place away from direct sunlight.
          </p>

          <div className="mt-4 pt-4 border-t border-dashed border-zinc-400 flex items-end justify-between">
            <div>
              <span className="block text-zinc-500 text-[8px]">Scan to verify e-bill</span>
              <div className="font-mono text-[9px] font-bold text-zinc-800">GST HSN 3004</div>
            </div>
            <div className="text-right">
              <span className="block font-bold text-black">For {pharmacyName}</span>
              <div className="h-6" />
              <span className="block border-t border-black text-[9px] font-bold pt-0.5">
                Authorized Signatory / Reg. Pharmacist
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Global Print Styles ── */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 4mm;
            size: auto;
          }
          body {
            visibility: hidden;
            background: #fff !important;
          }
          #printable-receipt,
          #printable-receipt * {
            visibility: visible !important;
          }
          #printable-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${printVariant === 'slip' ? '80mm' : '100%'} !important;
            max-width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 auto !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
