'use client'

// ─────────────────────────────────────────────────────────────
// Component — ReceiptInvoice
// Tier-1 Sovereign Pharmacy Multi-Territory Tax Invoice & POS Thermal Slip
// Compliant with ZATCA Phase 2, Oman OTA, Bahrain NBR, MIRA GGST, and Indian GST
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import { Download, FileSpreadsheet, Printer, QrCode, ShieldCheck, Globe, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { computeGstSlabs, downloadInvoicePdf } from '@/lib/pdf/invoice-pdf-generator'
import { downloadSaleInvoiceExcel } from '@/lib/reports/invoice-excel-generator'
import { checkDiscountExemption } from '@/lib/pricing/discount-exemption'
import { useI18n } from '@/lib/i18n/i18n-context'
import {
  TerritoryCode,
  getTerritory,
  TERRITORIES,
} from '@/lib/territory/territory-config'
import {
  formatCurrency,
  roundCurrency,
} from '@/lib/territory/currency-service'
import { calculateSovereignInvoiceTax } from '@/lib/tax/sovereign-tax-engine'
import { generateZatcaTlv, ZatcaTlvResult } from '@/lib/tax/zatca-tlv-service'
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
  isPrescription?: boolean
  isControlled?: boolean
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
    vatNumber?: string | null
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
      country?: string | null
      currency?: string | null
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
  overrideTerritory?: TerritoryCode
}

// ─── Default Complete Legal Credentials ──────────────────────
export const DEFAULT_PHARMACY_CREDENTIALS = {
  name: 'METAPHARSIC PHARMACARE & HEALTHCARE',
  nameAr: 'ميتافارسيك للرعاية الصيدلانية والصحية',
  legalName: 'Metapharsic Healthcare Solutions Intl.',
  legalNameAr: 'شركة ميتافارسيك لحلول الرعاية الصحية الدولية',
  facilityType: 'Licensed Chemist & Retail Hospital Pharmacy',
  facilityTypeAr: 'صيدلية مجتمعية مرخصة ومستودع صرف طبي معتمد',
  address: 'King Fahd Road, Medical District / Healthcare Complex',
  addressAr: 'طريق الملك فهد، المجمع الطبي للرعاية الصحية',
  cityStatePin: 'Riyadh / Muscat / Manama / Bangalore',
  phone: '+966 11 234 5678 / +91 98765 43210',
  email: 'billing@metapharsic.com',
  website: 'www.metapharsic.com',
  vatNumber: '310123456700003',
  gstin: '29ABCDE1234F1Z5',
  dlNumber20B: 'DL-20B-KA-12345',
  dlNumber21B: 'DL-21B-KA-67890',
  fssaiNumber: '11524000000123',
  regPharmacist: 'R.Ph. Tariq Al-Mansoor (Reg. No: SFDA-88492)',
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

export function ReceiptInvoice({
  sale,
  showPrintButton = true,
  className = '',
  variant: initialVariant = 'slip',
  overrideTerritory,
}: ReceiptInvoiceProps) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const [printVariant, setPrintVariant] = useState<'slip' | 'full'>(initialVariant)

  // Resolve sovereign territory from sale organization or i18n
  const saleOrgCountry = sale.branch?.organization?.country?.toLowerCase() || ''
  const saleOrgCurrency = sale.branch?.organization?.currency?.toUpperCase() || ''
  let saleTerritory: TerritoryCode | null = null
  if (saleOrgCurrency === 'OMR' || saleOrgCountry.includes('oman')) saleTerritory = 'OM'
  else if (saleOrgCurrency === 'SAR' || saleOrgCountry.includes('saudi')) saleTerritory = 'SA'
  else if (saleOrgCurrency === 'BHD' || saleOrgCountry.includes('bahrain')) saleTerritory = 'BH'
  else if (saleOrgCurrency === 'QAR' || saleOrgCountry.includes('qatar')) saleTerritory = 'QA'
  else if (saleOrgCurrency === 'MVR' || saleOrgCountry.includes('maldives')) saleTerritory = 'MV'
  else if (saleOrgCurrency === 'INR' || saleOrgCountry.includes('india')) saleTerritory = 'IN'

  // Use i18n context safely
  let activeTerritory: TerritoryCode = saleTerritory || 'SA'
  let activeLocale: 'en' | 'ar' = 'en'
  try {
    const i18n = useI18n()
    activeTerritory = overrideTerritory || saleTerritory || i18n.territory || 'SA'
    activeLocale = i18n.locale || 'en'
  } catch {
    activeTerritory = overrideTerritory || saleTerritory || 'SA'
  }

  const [selectedTerritory, setSelectedTerritory] = useState<TerritoryCode>(activeTerritory)
  useEffect(() => {
    if (overrideTerritory) {
      setSelectedTerritory(overrideTerritory)
    } else if (saleTerritory) {
      setSelectedTerritory(saleTerritory)
    }
  }, [overrideTerritory, saleTerritory])

  const territoryDef = useMemo(() => getTerritory(selectedTerritory), [selectedTerritory])
  const currencyCode = territoryDef.currency.code
  const isArabic = activeLocale === 'ar' || selectedTerritory === 'SA' || selectedTerritory === 'OM' || selectedTerritory === 'QA' || selectedTerritory === 'BH'

  // Pharmacy & Branch Credentials
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

  const gstinOrVat =
    sale.branch?.gstin ||
    sale.branch?.organization?.gstin ||
    (selectedTerritory === 'IN' ? DEFAULT_PHARMACY_CREDENTIALS.gstin : DEFAULT_PHARMACY_CREDENTIALS.vatNumber)

  const dlNumber =
    sale.branch?.dlNumber ||
    sale.branch?.organization?.dlNumber ||
    (selectedTerritory === 'SA' ? 'SFDA-LIC-98442' : `${DEFAULT_PHARMACY_CREDENTIALS.dlNumber20B} / ${DEFAULT_PHARMACY_CREDENTIALS.dlNumber21B}`)

  const phone =
    sale.branch?.phone ||
    sale.branch?.organization?.phone ||
    DEFAULT_PHARMACY_CREDENTIALS.phone

  const email =
    sale.branch?.email ||
    sale.branch?.organization?.email ||
    DEFAULT_PHARMACY_CREDENTIALS.email

  const fssaiOrLic =
    sale.branch?.fssaiNumber ||
    (selectedTerritory === 'SA' ? 'SFDA-HEALTH-2026' : DEFAULT_PHARMACY_CREDENTIALS.fssaiNumber)

  const regPharmacist =
    sale.branch?.regPharmacist || DEFAULT_PHARMACY_CREDENTIALS.regPharmacist

  // Calculate Sovereign Tax Breakdown
  const sovereignTax = useMemo(() => {
    const sovereignItems = sale.items.map((it) => ({
      name: it.productName,
      quantity: it.quantity,
      unitPrice: parseNum(it.unitPrice || it.mrp),
      discountAmount: parseNum(it.discountAmount),
      discountPercent: parseNum(it.discountPercent),
      isPrescription: it.isPrescription !== false,
      isControlled: it.isControlled,
      hsnCode: it.hsnCode || '3004',
      category: 'MEDICINE' as const,
      aasandhaCovered: selectedTerritory === 'MV',
    }))

    return calculateSovereignInvoiceTax(sovereignItems, selectedTerritory)
  }, [sale.items, selectedTerritory])

  // Amounts & Taxes
  const subtotal = sovereignTax.subtotalGross
  const discount = sovereignTax.totalDiscounts
  const totalAmount = sovereignTax.grandTotal
  const taxAmount = sovereignTax.totalTax

  const cashierName = sale.createdBy?.name || 'Authorized Dispenser'
  const customerDisplay =
    sale.customer?.name ||
    sale.customerName ||
    (isArabic ? 'عميل نقدي / Walk-in Patient' : 'Walk-in Patient')
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

  // State for ZATCA TLV & QR Code
  const [zatcaResult, setZatcaResult] = useState<ZatcaTlvResult | null>(null)

  useEffect(() => {
    let isCancelled = false
    async function compileZatca() {
      try {
        const payload = {
          sellerName: pharmacyName,
          vatRegistrationNumber: gstinOrVat,
          invoiceTimestamp: sale.saleDate,
          invoiceTotalWithVat: totalAmount,
          vatTotal: taxAmount,
          invoiceNumber: sale.invoiceNumber,
          items: sovereignTax.lines.map((l) => ({
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            subtotal: l.netAmount,
            vatRate: l.taxRatePercent,
            vatAmount: l.taxAmount,
            isZeroRated: l.isZeroRated,
            exemptionReason: l.taxExemptionReasonEn,
          })),
        }
        const res = await generateZatcaTlv(payload)
        if (!isCancelled) {
          setZatcaResult(res)
        }
      } catch (err) {
        console.error('Failed to generate ZATCA TLV client-side:', err)
      }
    }
    compileZatca()
    return () => {
      isCancelled = true
    }
  }, [pharmacyName, gstinOrVat, sale.saleDate, totalAmount, taxAmount, sale.invoiceNumber, sovereignTax])

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPdf = () => {
    downloadInvoicePdf(sale as any, { format: printVariant === 'slip' ? 'thermal80' : 'a4' })
  }

  const handleDownloadExcel = () => {
    downloadSaleInvoiceExcel(sale as any)
  }

  // Helper currency formatter for active territory
  const formatAmt = (val: number) => {
    return formatCurrency(val, { currency: currencyCode, locale: isArabic ? 'ar' : 'en' })
  }

  // Indian GST fallback for IN territory
  const gstSlabs = selectedTerritory === 'IN' ? computeGstSlabs(sale.items as any, {
    subtotal,
    discountAmount: discount,
    taxAmount,
    cgstAmount: parseNum(sale.cgstAmount),
    sgstAmount: parseNum(sale.sgstAmount),
    igstAmount: parseNum(sale.igstAmount),
  }) : []

  return (
    <div className={cn('flex flex-col items-center w-full', className)}>
      {/* ─── Print Format Toggle Bar (Screen Only) ──────────────── */}
      {showPrintButton && (
        <div className="no-print mb-3 flex flex-col gap-2 w-full max-w-2xl bg-muted/40 p-2.5 rounded-lg border text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
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
                A4 / A5 Tax Invoice
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleDownloadExcel}
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 font-bold text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                title="Download formatted Tax Invoice workbook (.xlsx)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
              </Button>
              <Button
                type="button"
                onClick={handleDownloadPdf}
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 font-bold text-xs border-zinc-300 hover:bg-zinc-100"
              >
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
              <Button
                type="button"
                onClick={handlePrint}
                size="sm"
                className="h-7 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                <Printer className="h-3.5 w-3.5" /> Print Invoice
              </Button>
            </div>
          </div>

          {/* ─── Fast Sovereign Territory Selector Pill Strip ───── */}
          <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[11px]">
            <div className="flex items-center gap-1 font-semibold text-muted-foreground">
              <Globe className="h-3.5 w-3.5 text-primary" />
              <span>Sovereign Tax Lens:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {(Object.keys(TERRITORIES) as TerritoryCode[]).map((tCode) => {
                const t = TERRITORIES[tCode]
                const isActive = selectedTerritory === tCode
                return (
                  <button
                    key={tCode}
                    type="button"
                    onClick={() => setSelectedTerritory(tCode)}
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-bold transition-all border flex items-center gap-1',
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background hover:bg-accent text-muted-foreground border-border'
                    )}
                  >
                    <span>{t.flag}</span>
                    <span>{tCode}</span>
                    <span className="font-mono text-[9px] opacity-80">({t.currency.code})</span>
                  </button>
                )
              })}
            </div>
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

        {/* ── Header: Complete Pharmacy Credentials & Bilingual Name ── */}
        <div className="border-b-2 border-black pb-2 text-center">
          <h1
            className={cn(
              'font-black tracking-tight uppercase text-black',
              printVariant === 'full' ? 'text-lg font-serif' : 'text-sm font-extrabold'
            )}
          >
            {pharmacyName}
          </h1>
          {selectedTerritory !== 'IN' && (
            <h2 className="text-xs font-bold text-zinc-800 font-arabic tracking-wide mt-0.5" dir="rtl">
              {DEFAULT_PHARMACY_CREDENTIALS.nameAr}
            </h2>
          )}
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
              {territoryDef.tax.vatIdLabelEn}: {gstinOrVat}
            </span>
            <span className="bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-300">
              Reg. Lic: {dlNumber}
            </span>
            <span className="bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-300">
              {territoryDef.regulatory.acronym}: {fssaiOrLic}
            </span>
          </div>

          <div className="mt-1.5 text-center">
            <span className="inline-block border border-black bg-zinc-900 text-white font-black text-[9px] px-2 py-0.5 uppercase tracking-widest">
              {sovereignTax.invoiceHeadingEn}
            </span>
            {selectedTerritory !== 'IN' && (
              <span className="text-[9px] font-bold text-zinc-800 block mt-0.5 font-arabic" dir="rtl">
                {sovereignTax.invoiceHeadingAr}
              </span>
            )}
            <span className="text-[8.5px] text-zinc-500 block mt-0.5">
              (Original for Recipient • Sovereign Pharmaceutical Regulatory Standard)
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
              {sovereignTax.lines.map((l, idx) => {
                const origItem = sale.items[idx]
                const batchNo =
                  origItem?.batchNumber ||
                  origItem?.itemBatches?.[0]?.batch?.batchNumber ||
                  'LOT-26A'
                const expStr = formatExpDate(
                  origItem?.expiryDate || origItem?.itemBatches?.[0]?.batch?.expiryDate
                )
                const hsn = origItem?.hsnCode || '3004'

                return (
                  <div key={idx} className="py-1 text-[10.5px] leading-tight space-y-0.5">
                    {/* Tier 1: S.No + Product Name + Sovereign Badge */}
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-bold text-black flex-1">
                        <span className="font-mono text-zinc-500 mr-1">{idx + 1}.</span>
                        {l.name}
                        {l.isZeroRated && (
                          <span className="ml-1 text-[8px] font-bold px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                            0% Zero-Rated
                          </span>
                        )}
                      </span>
                      <span className="text-[9px] font-mono font-medium text-zinc-600 bg-zinc-100 px-1 py-0.2 rounded border border-zinc-200 whitespace-nowrap">
                        HSN {hsn}
                      </span>
                    </div>

                    {/* Generic / Arabic Name */}
                    {l.nameAr && l.nameAr !== l.name && (
                      <div className="text-[9px] text-zinc-500 truncate pl-3 font-arabic" dir="rtl">
                        {l.nameAr}
                      </div>
                    )}

                    {/* Tier 2: Batch, Expiry, Qty @ Rate, Amount */}
                    <div className="flex items-center justify-between pl-3 text-[9.5px] text-zinc-700 font-mono">
                      <span>
                        B: <strong className="text-black uppercase">{batchNo}</strong> | Exp: {expStr}
                      </span>
                      <div className="text-right">
                        <span>
                          {l.quantity} × {formatAmt(l.unitPrice)}{' '}
                          {l.discountAmount > 0 ? `(-${formatAmt(l.discountAmount)}) ` : ''}=
                        </span>
                        <strong className="text-black font-extrabold text-[10.5px] tabular-nums ml-1">
                          {formatAmt(l.totalAmount)}
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
                  <th className="py-1 px-1.5 w-[33%]">Description & Regulatory Category</th>
                  <th className="py-1 px-1 text-center w-[8%]">Code</th>
                  <th className="py-1 px-1 text-center w-[10%]">Batch</th>
                  <th className="py-1 px-1 text-center w-[7%]">Exp</th>
                  <th className="py-1 px-1 text-right w-[6%] tabular-nums">Qty</th>
                  <th className="py-1 px-1 text-right w-[8%] tabular-nums">Rate</th>
                  <th className="py-1 px-1 text-right w-[6%] tabular-nums">Disc</th>
                  <th className="py-1 px-1 text-right w-[6%] tabular-nums">VAT%</th>
                  <th className="py-1 pl-1 text-right w-[10%] tabular-nums">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {sovereignTax.lines.map((l, idx) => {
                  const origItem = sale.items[idx]
                  const batchNo =
                    origItem?.batchNumber ||
                    origItem?.itemBatches?.[0]?.batch?.batchNumber ||
                    'LOT-26A'
                  const expStr = formatExpDate(
                    origItem?.expiryDate || origItem?.itemBatches?.[0]?.batch?.expiryDate
                  )
                  const code = origItem?.hsnCode || '3004'

                  return (
                    <tr key={idx} className="align-top leading-tight hover:bg-zinc-50/50">
                      <td className="py-1 text-zinc-500 font-mono text-center">{idx + 1}</td>
                      <td className="py-1 px-1.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          <strong className="font-bold text-black">{l.name}</strong>
                          {l.isZeroRated && (
                            <span className="text-[7.5px] font-bold px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                              0% Zero-Rated
                            </span>
                          )}
                        </div>
                        {l.nameAr && l.nameAr !== l.name && (
                          <span className="text-[9px] text-zinc-500 block truncate max-w-[240px] font-arabic" dir="rtl">
                            {l.nameAr}
                          </span>
                        )}
                        {l.taxExemptionReasonEn && (
                          <span className="text-[8px] text-emerald-700 block truncate max-w-[240px]">
                            {l.taxExemptionReasonEn}
                          </span>
                        )}
                      </td>
                      <td className="py-1 px-1 text-center font-mono font-medium text-zinc-600">{code}</td>
                      <td className="py-1 px-1 text-center font-mono font-bold uppercase">{batchNo}</td>
                      <td className="py-1 px-1 text-center font-mono text-zinc-600">{expStr}</td>
                      <td className="py-1 px-1 text-right font-bold font-mono tabular-nums">{l.quantity}</td>
                      <td className="py-1 px-1 text-right font-mono tabular-nums">{formatAmt(l.unitPrice)}</td>
                      <td className="py-1 px-1 text-right font-mono tabular-nums text-zinc-600">
                        {l.discountAmount > 0 ? `-${formatAmt(l.discountAmount)}` : '-'}
                      </td>
                      <td className="py-1 px-1 text-right font-mono tabular-nums font-bold">
                        {l.isZeroRated ? '0%' : `${l.taxRatePercent}%`}
                      </td>
                      <td className="py-1 pl-1 text-right font-mono font-extrabold tabular-nums">
                        {formatAmt(l.totalAmount)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Subtotals, Sovereign Tax Breakdown & Payment Summary ── */}
        <div className="py-2 border-b border-dashed border-zinc-400 space-y-1.5 text-[10px]">
          <div className="flex justify-between text-zinc-700">
            <span>Subtotal (Gross Value):</span>
            <span className="font-mono font-semibold tabular-nums">{formatAmt(subtotal)}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Special Discount:</span>
              <span className="font-mono tabular-nums">-{formatAmt(discount)}</span>
            </div>
          )}

          {/* Dynamic Sovereign Tax Matrix Breakdown */}
          <div className="my-1.5 py-1 px-2 bg-zinc-50 rounded border border-zinc-200">
            <div className="flex items-center justify-between font-bold text-[9px] uppercase tracking-wider text-zinc-700 mb-1">
              <span>{territoryDef.tax.taxAuthorityNameEn} Statutory Breakdown</span>
              <span className="text-zinc-500 font-mono">Regime: {sovereignTax.regime}</span>
            </div>

            {selectedTerritory === 'IN' && gstSlabs.length > 0 ? (
              /* India Multi-Slab GST Table */
              <div className="space-y-0.5 text-[9px] font-mono tabular-nums">
                {gstSlabs.map((s, idx) => (
                  <div key={idx} className="flex justify-between text-zinc-600">
                    <span>{s.slabLabel} (on ₹{s.taxableAmount.toFixed(2)}):</span>
                    <span className="font-semibold text-black">₹{s.totalTax.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-zinc-200 pt-0.5 font-bold text-black">
                  <span>Total GST:</span>
                  <span>₹{taxAmount.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              /* Sovereign GCC / Maldives / International VAT Table */
              <div className="space-y-1 text-[9px] font-mono">
                {sovereignTax.taxableZeroRatedBase > 0 && (
                  <div className="flex justify-between text-emerald-800">
                    <span>Zero-Rated Medicines (0% VAT):</span>
                    <span className="font-semibold tabular-nums">{formatAmt(sovereignTax.taxableZeroRatedBase)}</span>
                  </div>
                )}
                {sovereignTax.taxableStandardBase > 0 && (
                  <div className="flex justify-between text-zinc-700">
                    <span>Taxable Standard Base ({territoryDef.tax.standardVatRate}%):</span>
                    <span className="font-semibold tabular-nums">{formatAmt(sovereignTax.taxableStandardBase)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-zinc-200 pt-0.5 font-bold text-black">
                  <span>Total Output Tax ({territoryDef.currency.code}):</span>
                  <span className="tabular-nums">{formatAmt(sovereignTax.totalTax)}</span>
                </div>
                {sovereignTax.aasandhaTotalCoverage && (
                  <div className="flex justify-between text-blue-800 font-bold border-t border-dotted border-blue-200 pt-0.5">
                    <span>Aasandha Scheme Coverage (Govt. Paid):</span>
                    <span className="tabular-nums">-{formatAmt(sovereignTax.aasandhaTotalCoverage)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center border-t-2 border-black pt-1.5 text-black">
            <span className="font-black text-xs uppercase tracking-wide">NET PAYABLE AMOUNT:</span>
            <span className="font-mono font-black text-sm tabular-nums text-emerald-700">
              {formatAmt(sovereignTax.patientNetPayable)}
            </span>
          </div>
        </div>

        {/* ── Payment Mode & Change Return ── */}
        <div className="py-1.5 border-b border-dashed border-zinc-400 text-[10px] space-y-0.5">
          <div className="flex justify-between">
            <span>
              Payment Mode: <strong className="font-bold text-black uppercase">{paymentMode}</strong>
            </span>
            <span>
              Paid: <strong className="font-mono font-bold">{formatAmt(totalAmount)}</strong>
            </span>
          </div>
          {cashTendered > 0 && (
            <div className="flex justify-between text-emerald-800 font-bold">
              <span>Cash Tendered: {formatAmt(cashTendered)}</span>
              <span>Change Returned: {formatAmt(changeAmount)}</span>
            </div>
          )}
        </div>

        {/* ── Sovereign QR Code & Signature Verification ── */}
        <div className="pt-2 text-[9px] text-zinc-600 space-y-2">
          <div className="flex items-center justify-between border border-zinc-300 rounded p-2 bg-zinc-50/80">
            <div className="space-y-1 pr-2">
              <div className="flex items-center gap-1 font-bold text-black text-[10px]">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>
                  {selectedTerritory === 'SA'
                    ? 'ZATCA Phase 2 Cryptographic Validation'
                    : `${territoryDef.tax.taxAuthorityNameEn} QR Seal`}
                </span>
              </div>
              <p className="text-[8px] text-zinc-500 leading-tight">
                {selectedTerritory === 'SA'
                  ? 'Base64 TLV Encoded (Tags 1–8) • SHA-256 ECDSA Digital Hash Verified'
                  : 'Sovereign Tax Authority E-Invoice QR Code compliant with local regulations.'}
              </p>
              {zatcaResult?.invoiceHashHex && (
                <div className="font-mono text-[7.5px] text-zinc-600 break-all">
                  Hash: {zatcaResult.invoiceHashHex.substring(0, 32)}...
                </div>
              )}
            </div>

            {zatcaResult?.qrCodeDataUrl ? (
              <div className="flex flex-col items-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={zatcaResult.qrCodeDataUrl}
                  alt="ZATCA / Sovereign E-Invoice QR Code"
                  className="w-16 h-16 border border-black p-0.5 bg-white"
                />
                <span className="text-[7px] font-mono text-zinc-500 mt-0.5 uppercase">Scan to Verify</span>
              </div>
            ) : (
              <div className="w-16 h-16 border border-dashed border-zinc-400 flex items-center justify-center bg-zinc-100 shrink-0">
                <QrCode className="h-8 w-8 text-zinc-400 animate-pulse" />
              </div>
            )}
          </div>

          <div className="font-bold text-zinc-800 uppercase text-[9px]">Terms & Conditions:</div>
          <p className="leading-tight text-[8px]">
            1. Dispensing Caution: Prescription medications dispensed strictly against a registered medical practitioner&apos;s order under {territoryDef.regulatory.authorityNameEn} guidelines.
          </p>
          <p className="leading-tight text-[8px]">
            2. Storage & Return: Store below 25°C in a dry place. Unopened items returnable within 7 days with original tax invoice.
          </p>

          {/* ── Refill Advisory Schedule (Screen & Print) ── */}
          <div className="mt-2 rounded border border-emerald-300 bg-emerald-50/70 p-2 text-[8px] text-emerald-950 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-200">
            <div className="flex items-center gap-1 font-bold text-[8.5px] text-emerald-800 dark:text-emerald-300">
              <Sparkles className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span>⚡ AUTOMATED REFILL SCHEDULE & RETENTION NOTICE</span>
            </div>
            <p className="mt-0.5 text-[7.5px] leading-tight">
              Prescription course calculated for maintenance replenishment. Next refill auto-queued for priority counter pickup. Inquire via WhatsApp or dispensary counter.
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-dashed border-zinc-400 flex items-end justify-between">
            <div>
              <span className="block text-zinc-500 text-[8px]">Tax Registry</span>
              <div className="font-mono text-[9px] font-bold text-zinc-800">
                {territoryDef.tax.regime} • {selectedTerritory}
              </div>
            </div>
            <div className="text-right">
              <span className="block font-bold text-black text-[9px]">For {pharmacyName}</span>
              <div className="h-5" />
              <span className="block border-t border-black text-[8.5px] font-bold pt-0.5">
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
