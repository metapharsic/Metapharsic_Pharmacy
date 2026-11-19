// ─────────────────────────────────────────────────────────────
// GSTR-1 Exporter & GST Reporting Engine
// Generates GSTR-1 compliant CSV, JSON, and Summary metrics
// for B2B (Table 4), B2C Small (Table 7), and HSN Summary (Table 12).
// ─────────────────────────────────────────────────────────────
import { format } from 'date-fns'

import type { Gstr1B2bLine, Gstr1B2cLine, Gstr1HsnLine, Gstr1ReportSummary } from './tally-types'
import type { SaleForTally } from './tally-xml-builder'

/**
 * Standardize Indian state code / Place of supply. Defaults to home state if missing.
 */
function resolvePlaceOfSupply(customerState?: string | null): string {
  if (!customerState || customerState.trim() === '') {
    return '29-Karnataka' // Default state code & name matching pharmacy location
  }
  return customerState.trim()
}

/**
 * Map product unit to official GST Unit Quantity Code (UQC).
 */
function mapToUqc(unit?: string): string {
  if (!unit) return 'NOS'
  const u = unit.toUpperCase().trim()
  if (u.includes('TAB') || u.includes('STRIP')) return 'BOX'
  if (u.includes('BOT') || u.includes('BTL') || u.includes('ML')) return 'BTL'
  if (u.includes('KG') || u.includes('GM')) return 'KGS'
  if (u.includes('TUBE')) return 'TUB'
  if (u.includes('INJ') || u.includes('VIAL')) return 'VIAL'
  return 'NOS'
}

/**
 * Calculate comprehensive GSTR-1 summaries and breakdown tables from sales vouchers.
 */
export function processGstr1Data(sales: SaleForTally[]): {
  b2bLines: Gstr1B2bLine[]
  b2cLines: Gstr1B2cLine[]
  hsnLines: Gstr1HsnLine[]
  summary: Gstr1ReportSummary
} {
  const b2bLines: Gstr1B2bLine[] = []
  const b2cMap = new Map<string, Gstr1B2cLine>()
  const hsnMap = new Map<string, Gstr1HsnLine>()

  let b2bInvoicesCount = 0
  let b2bTaxableValue = 0
  let b2cInvoicesCount = 0
  let b2cTaxableValue = 0
  let totalCgst = 0
  let totalSgst = 0
  let totalIgst = 0
  let totalTax = 0
  let totalInvoiceValue = 0

  for (const sale of sales) {
    const isB2b = Boolean(sale.customer?.gstin && sale.customer.gstin.trim().length === 15)
    const placeOfSupply = resolvePlaceOfSupply(sale.customer?.state)
    const saleDateObj = typeof sale.saleDate === 'string' ? new Date(sale.saleDate) : sale.saleDate
    const invDateStr = format(saleDateObj, 'dd-MMM-yyyy')
    const invoiceTotal = Number(sale.totalAmount)

    if (isB2b) {
      b2bInvoicesCount++
    } else {
      b2cInvoicesCount++
    }

    totalInvoiceValue += invoiceTotal

    // Group items in this sale by tax rate for B2B/B2C reporting
    const rateGroup = new Map<
      number,
      { taxable: number; cgst: number; sgst: number; igst: number }
    >()

    const isInterstate = Boolean(
      sale.customer?.state &&
      !sale.customer.state.includes('Karnataka') &&
      !sale.customer.state.startsWith('29')
    )

    for (const item of sale.items) {
      const itemTotal = Number(item.totalAmount)
      const itemTax = Number(item.taxAmount || 0)
      const taxable = itemTotal - itemTax
      const rate = taxable > 0 ? Math.round((itemTax / taxable) * 100) : 0

      const igst = isInterstate ? itemTax : 0
      const cgst = isInterstate ? 0 : itemTax / 2
      const sgst = isInterstate ? 0 : itemTax / 2

      const current = rateGroup.get(rate) || { taxable: 0, cgst: 0, sgst: 0, igst: 0 }
      current.taxable += taxable
      current.cgst += cgst
      current.sgst += sgst
      current.igst += igst
      rateGroup.set(rate, current)

      // Aggregate for Table 12 HSN Summary
      const hsn = item.product.hsnCode?.trim() || '3004' // Default 3004 (Medicaments)
      const uqc = mapToUqc(item.product.unitOfMeasure || undefined)
      const hsnKey = `${hsn}_${uqc}`

      const currentHsn = hsnMap.get(hsnKey) || {
        hsnCode: hsn,
        description: item.product.name.slice(0, 30),
        uqc,
        totalQuantity: 0,
        totalValue: 0,
        taxableValue: 0,
        integratedTaxAmount: 0,
        centralTaxAmount: 0,
        stateTaxAmount: 0,
        cessAmount: 0,
      }

      currentHsn.totalQuantity += item.quantity
      currentHsn.totalValue += itemTotal
      currentHsn.taxableValue += taxable
      currentHsn.integratedTaxAmount += igst
      currentHsn.centralTaxAmount += cgst
      currentHsn.stateTaxAmount += sgst
      hsnMap.set(hsnKey, currentHsn)
    }

    for (const [rate, val] of rateGroup.entries()) {
      totalCgst += val.cgst
      totalSgst += val.sgst
      totalIgst += val.igst
      totalTax += val.cgst + val.sgst + val.igst

      if (isB2b) {
        b2bTaxableValue += val.taxable
        b2bLines.push({
          customerGstin: sale.customer!.gstin!,
          customerName: sale.customer!.name,
          invoiceNumber: sale.invoiceNumber,
          invoiceDate: invDateStr,
          invoiceValue: invoiceTotal,
          placeOfSupply,
          reverseCharge: 'N',
          invoiceType: 'Regular',
          taxRate: rate,
          taxableValue: Number(val.taxable.toFixed(2)),
          cgstAmount: Number(val.cgst.toFixed(2)),
          sgstAmount: Number(val.sgst.toFixed(2)),
          igstAmount: Number(val.igst.toFixed(2)),
          cessAmount: 0,
        })
      } else {
        b2cTaxableValue += val.taxable
        const b2cKey = `${placeOfSupply}_${rate}`
        const currentB2c = b2cMap.get(b2cKey) || {
          type: 'OE',
          placeOfSupply,
          taxRate: rate,
          taxableValue: 0,
          cessAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
        }
        currentB2c.taxableValue += val.taxable
        currentB2c.cgstAmount += val.cgst
        currentB2c.sgstAmount += val.sgst
        currentB2c.igstAmount += val.igst
        b2cMap.set(b2cKey, currentB2c)
      }
    }
  }

  const b2cLines = Array.from(b2cMap.values()).map((line) => ({
    ...line,
    taxableValue: Number(line.taxableValue.toFixed(2)),
    cgstAmount: Number(line.cgstAmount.toFixed(2)),
    sgstAmount: Number(line.sgstAmount.toFixed(2)),
    igstAmount: Number(line.igstAmount.toFixed(2)),
  }))

  const hsnLines = Array.from(hsnMap.values()).map((line) => ({
    ...line,
    totalValue: Number(line.totalValue.toFixed(2)),
    taxableValue: Number(line.taxableValue.toFixed(2)),
    integratedTaxAmount: Number(line.integratedTaxAmount.toFixed(2)),
    centralTaxAmount: Number(line.centralTaxAmount.toFixed(2)),
    stateTaxAmount: Number(line.stateTaxAmount.toFixed(2)),
  }))

  const firstDate =
    sales.length > 0
      ? typeof sales[0].saleDate === 'string'
        ? new Date(sales[0].saleDate)
        : sales[0].saleDate
      : undefined
  const lastDate =
    sales.length > 0
      ? typeof sales[sales.length - 1].saleDate === 'string'
        ? new Date(sales[sales.length - 1].saleDate)
        : sales[sales.length - 1].saleDate
      : undefined

  const summary: Gstr1ReportSummary = {
    period: {
      startDate: firstDate ? format(firstDate, 'yyyy-MM-dd') : undefined,
      endDate: lastDate ? format(lastDate, 'yyyy-MM-dd') : undefined,
    },
    totalInvoices: sales.length,
    b2bInvoicesCount,
    b2bTaxableValue: Number(b2bTaxableValue.toFixed(2)),
    b2cInvoicesCount,
    b2cTaxableValue: Number(b2cTaxableValue.toFixed(2)),
    totalTaxableValue: Number((b2bTaxableValue + b2cTaxableValue).toFixed(2)),
    totalCgst: Number(totalCgst.toFixed(2)),
    totalSgst: Number(totalSgst.toFixed(2)),
    totalIgst: Number(totalIgst.toFixed(2)),
    totalTax: Number(totalTax.toFixed(2)),
    totalInvoiceValue: Number(totalInvoiceValue.toFixed(2)),
    hsnCount: hsnLines.length,
  }

  return { b2bLines, b2cLines, hsnLines, summary }
}

/**
 * Generate GSTR-1 CSV format compatible with Excel and GST offline filing utilities.
 */
export function generateGstr1Csv(sales: SaleForTally[]): string {
  const { b2bLines, b2cLines, hsnLines } = processGstr1Data(sales)

  const rows: string[] = []

  // Section 1: B2B Invoices (Table 4)
  rows.push('# ─── GSTR-1 Table 4: B2B Invoices ────────────────────────────────────')
  rows.push(
    [
      'GSTIN/UIN of Recipient',
      'Receiver Name',
      'Invoice Number',
      'Invoice Date',
      'Invoice Value',
      'Place Of Supply',
      'Reverse Charge',
      'Invoice Type',
      'Rate',
      'Taxable Value',
      'CGST Amount',
      'SGST Amount',
      'IGST Amount',
      'Cess Amount',
    ].join(',')
  )

  if (b2bLines.length === 0) {
    rows.push('# No B2B sales registered in selected period')
  } else {
    for (const b of b2bLines) {
      rows.push(
        [
          `"${b.customerGstin}"`,
          `"${b.customerName.replace(/"/g, '""')}"`,
          `"${b.invoiceNumber}"`,
          `"${b.invoiceDate}"`,
          b.invoiceValue.toFixed(2),
          `"${b.placeOfSupply}"`,
          b.reverseCharge,
          b.invoiceType,
          `${b.taxRate}%`,
          b.taxableValue.toFixed(2),
          b.cgstAmount.toFixed(2),
          b.sgstAmount.toFixed(2),
          b.igstAmount.toFixed(2),
          b.cessAmount.toFixed(2),
        ].join(',')
      )
    }
  }

  rows.push('')

  // Section 2: B2C Small Invoices (Table 7)
  rows.push('# ─── GSTR-1 Table 7: B2C (Small) Invoices ────────────────────────────')
  rows.push(['Type', 'Place Of Supply', 'Rate', 'Taxable Value', 'Cess Amount'].join(','))

  if (b2cLines.length === 0) {
    rows.push('# No B2C sales registered in selected period')
  } else {
    for (const c of b2cLines) {
      rows.push(
        [
          c.type,
          `"${c.placeOfSupply}"`,
          `${c.taxRate}%`,
          c.taxableValue.toFixed(2),
          c.cessAmount.toFixed(2),
        ].join(',')
      )
    }
  }

  rows.push('')

  // Section 3: HSN-wise Summary (Table 12)
  rows.push('# ─── GSTR-1 Table 12: HSN Summary of Outward Supplies ────────────────')
  rows.push(
    [
      'HSN',
      'Description',
      'UQC',
      'Total Quantity',
      'Total Value',
      'Taxable Value',
      'Integrated Tax Amount',
      'Central Tax Amount',
      'State/UT Tax Amount',
      'Cess Amount',
    ].join(',')
  )

  for (const h of hsnLines) {
    rows.push(
      [
        `"${h.hsnCode}"`,
        `"${h.description.replace(/"/g, '""')}"`,
        h.uqc,
        h.totalQuantity,
        h.totalValue.toFixed(2),
        h.taxableValue.toFixed(2),
        h.integratedTaxAmount.toFixed(2),
        h.centralTaxAmount.toFixed(2),
        h.stateTaxAmount.toFixed(2),
        h.cessAmount.toFixed(2),
      ].join(',')
    )
  }

  return rows.join('\r\n')
}

/**
 * Generate standard Sales Register CSV for accounting audit and Tally import assistance.
 */
export function generateSalesRegisterCsv(sales: SaleForTally[]): string {
  const rows: string[] = []

  rows.push(
    [
      'Invoice No',
      'Date',
      'Customer',
      'GSTIN',
      'Payment Mode',
      'Item Name',
      'Batch',
      'Expiry',
      'HSN',
      'Qty',
      'Rate',
      'Taxable Value',
      'GST Rate',
      'CGST',
      'SGST',
      'IGST',
      'Total Amount',
    ].join(',')
  )

  for (const s of sales) {
    const saleDateObj = typeof s.saleDate === 'string' ? new Date(s.saleDate) : s.saleDate
    const invDateStr = format(saleDateObj, 'yyyy-MM-dd')
    const custName = s.customer?.name || 'Cash Customer'
    const gstin = s.customer?.gstin || ''
    const paymentMode = s.payments && s.payments.length > 0 ? s.payments[0].method : 'Cash'

    const isInterstate = Boolean(
      s.customer?.state &&
      !s.customer.state.includes('Karnataka') &&
      !s.customer.state.startsWith('29')
    )

    for (const item of s.items) {
      const itemTotal = Number(item.totalAmount)
      const itemTax = Number(item.taxAmount || 0)
      const taxable = itemTotal - itemTax
      const rate = taxable > 0 ? Math.round((itemTax / taxable) * 100) : 0
      const igst = isInterstate ? itemTax : 0
      const cgst = isInterstate ? 0 : itemTax / 2
      const sgst = isInterstate ? 0 : itemTax / 2

      const batchNum =
        item.itemBatches && item.itemBatches.length > 0 ? item.itemBatches[0].batch.batchNumber : ''
      const expDate =
        item.itemBatches && item.itemBatches.length > 0 && item.itemBatches[0].batch.expiryDate
          ? format(
              typeof item.itemBatches[0].batch.expiryDate === 'string'
                ? new Date(item.itemBatches[0].batch.expiryDate)
                : item.itemBatches[0].batch.expiryDate,
              'dd-MMM-yyyy'
            )
          : ''

      rows.push(
        [
          `"${s.invoiceNumber}"`,
          invDateStr,
          `"${custName.replace(/"/g, '""')}"`,
          `"${gstin}"`,
          paymentMode,
          `"${item.product.name.replace(/"/g, '""')}"`,
          `"${batchNum}"`,
          expDate,
          `"${item.product.hsnCode || ''}"`,
          item.quantity,
          Number(item.unitPrice).toFixed(2),
          taxable.toFixed(2),
          `${rate}%`,
          cgst.toFixed(2),
          sgst.toFixed(2),
          igst.toFixed(2),
          itemTotal.toFixed(2),
        ].join(',')
      )
    }
  }

  return rows.join('\r\n')
}

/**
 * Generate official GST Portal Offline Tool JSON schema.
 */
export function generateGstr1Json(sales: SaleForTally[], gstin = '29ABCDE1234F1Z5'): string {
  const { b2bLines, b2cLines, hsnLines } = processGstr1Data(sales)

  const firstDate =
    sales.length > 0
      ? typeof sales[0].saleDate === 'string'
        ? new Date(sales[0].saleDate)
        : sales[0].saleDate
      : new Date()
  const fp = format(firstDate, 'MMyyyy')

  // Group B2B by recipient GSTIN
  const b2bGroup = new Map<string, { inv: Array<Record<string, unknown>> }>()
  for (const b of b2bLines) {
    const group = b2bGroup.get(b.customerGstin) || { inv: [] }
    let existingInv = group.inv.find((i) => i.inum === b.invoiceNumber)
    if (!existingInv) {
      existingInv = {
        inum: b.invoiceNumber,
        idt: b.invoiceDate,
        val: b.invoiceValue,
        pos: b.placeOfSupply.split('-')[0],
        rchrg: b.reverseCharge,
        inv_typ: 'R',
        itms: [],
      }
      group.inv.push(existingInv)
    }
    const itms = existingInv.itms as Array<Record<string, unknown>>
    itms.push({
      num: itms.length + 1,
      itm_det: {
        rt: b.taxRate,
        txval: b.taxableValue,
        iamt: b.igstAmount,
        camt: b.cgstAmount,
        samt: b.sgstAmount,
        csamt: b.cessAmount,
      },
    })
    b2bGroup.set(b.customerGstin, group)
  }

  const b2bOutput = Array.from(b2bGroup.entries()).map(([ctin, val]) => ({
    ctin,
    inv: val.inv,
  }))

  const b2csOutput = b2cLines.map((c) => ({
    sply_ty: 'INTRA',
    pos: c.placeOfSupply.split('-')[0],
    typ: c.type,
    rt: c.taxRate,
    txval: c.taxableValue,
    iamt: c.igstAmount,
    camt: c.cgstAmount,
    samt: c.sgstAmount,
    csamt: c.cessAmount,
  }))

  const hsnOutput = {
    data: hsnLines.map((h, idx) => ({
      num: idx + 1,
      hsn_sc: h.hsnCode,
      desc: h.description,
      uqc: h.uqc,
      qty: h.totalQuantity,
      val: h.totalValue,
      txval: h.taxableValue,
      iamt: h.integratedTaxAmount,
      camt: h.centralTaxAmount,
      samt: h.stateTaxAmount,
      csamt: h.cessAmount,
    })),
  }

  const payload = {
    gstin,
    fp,
    gt: 0,
    cur_gt: 0,
    b2b: b2bOutput,
    b2cs: b2csOutput,
    hsn: hsnOutput,
  }

  return JSON.stringify(payload, null, 2)
}
