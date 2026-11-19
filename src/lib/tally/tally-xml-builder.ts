// ─────────────────────────────────────────────────────────────
// Tally ERP / TallyPrime XML Builder Engine
// Generates standard <ENVELOPE> XML payloads for Tally import.
// ─────────────────────────────────────────────────────────────
import { format, parseISO } from 'date-fns'

import type {
  CompanySetupForTally,
  DebitNoteForTally,
  PriceListForTally,
  PriceRuleForTally,
  TallyConfig,
  UnitForTally,
} from './tally-types'

export type {
  CompanySetupForTally,
  DebitNoteForTally,
  PriceListForTally,
  PriceRuleForTally,
  UnitForTally,
}

// ─── Helpers ──────────────────────────────────────────────────

export function escapeXml(str: unknown): string {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function formatTallyDate(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput
  return format(d, 'yyyyMMdd')
}

export function formatTallyDisplayDate(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput
  return format(d, 'dd-MMM-yyyy')
}

export function formatNum(val: unknown, decimals = 2): string {
  const n = Number(val)
  if (isNaN(n)) return (0).toFixed(decimals)
  return n.toFixed(decimals)
}

function wrapEnvelope(messagesXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <DATA>
${messagesXml}
    </DATA>
  </BODY>
</ENVELOPE>`
}

// ─── Data Interfaces for Builder ─────────────────────────────

export interface SaleForTally {
  id: string
  invoiceNumber: string
  saleDate: Date | string
  subtotal: number | string | { toString(): string }
  discountAmount?: number | string | { toString(): string } | null
  taxAmount: number | string | { toString(): string }
  cgstAmount?: number | string | { toString(): string } | null
  sgstAmount?: number | string | { toString(): string } | null
  igstAmount?: number | string | { toString(): string } | null
  totalAmount: number | string | { toString(): string }
  roundOff?: number | string | { toString(): string } | null
  priceLevel?: string | null
  customer?: {
    id: string
    name: string
    gstin?: string | null
    state?: string | null
    phone?: string | null
    address?: string | null
    priceLevel?: string | null
  } | null
  payments?: {
    method: string
    amount: number | string | { toString(): string }
  }[]
  items: {
    id: string
    quantity: number
    unitPrice: number | string | { toString(): string }
    totalAmount: number | string | { toString(): string }
    taxAmount?: number | string | { toString(): string } | null
    product: {
      name: string
      sku?: string | null
      hsnCode?: string | null
      unitOfMeasure?: string | null
    }
    itemBatches?: {
      quantity: number
      batch: {
        batchNumber: string
        expiryDate?: Date | string | null
        manufacturingDate?: Date | string | null
      }
    }[]
  }[]
}

export interface PurchaseForTally {
  id: string
  purchaseNumber: string
  invoiceNumber?: string | null
  purchaseDate: Date | string
  subtotal: number | string | { toString(): string }
  taxAmount: number | string | { toString(): string }
  cgstAmount?: number | string | { toString(): string } | null
  sgstAmount?: number | string | { toString(): string } | null
  igstAmount?: number | string | { toString(): string } | null
  totalAmount: number | string | { toString(): string }
  supplier: {
    id: string
    name: string
    gstin?: string | null
    state?: string | null
    phone?: string | null
    address?: string | null
  }
  items: {
    id: string
    quantity: number
    unitCost: number | string | { toString(): string }
    totalAmount: number | string | { toString(): string }
    product: {
      name: string
      sku?: string | null
      hsnCode?: string | null
      unitOfMeasure?: string | null
    }
    batchNumber?: string | null
    expiryDate?: Date | string | null
    manufacturingDate?: Date | string | null
  }[]
}

export interface CustomerForTally {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  gstin?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  creditLimit?: number | null
  outstandingBalance?: number | null
  priceLevel?: string | null
}

export interface SupplierForTally {
  id: string
  name: string
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  gstin?: string | null
  pan?: string | null
  dlNumber?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  bankName?: string | null
  bankAccount?: string | null
  bankIfsc?: string | null
  outstandingBalance?: number | null
}

export interface ProductForTally {
  id: string
  name: string
  sku?: string | null
  barcode?: string | null
  hsnCode?: string | null
  unitOfMeasure?: string | null
  mrp?: number | string | { toString(): string } | null
  costPrice?: number | string | { toString(): string } | null
  gstRate?: number | string | { toString(): string } | null
  openingBalance?: number | string | { toString(): string } | null
  openingValue?: number | string | { toString(): string } | null
}

export type StockItemForTally = ProductForTally

// ─── Sales Vouchers Builder ───────────────────────────────────

export function buildSalesVouchersXml(sales: SaleForTally[], config: TallyConfig): string {
  const vouchersXml = sales
    .map((sale) => {
      const tallyDate = formatTallyDate(sale.saleDate)
      const invNum = escapeXml(sale.invoiceNumber)
      const primaryPayment = sale.payments?.[0]?.method ?? 'CASH'
      const partyLedger = sale.customer?.name
        ? escapeXml(sale.customer.name)
        : primaryPayment === 'BANK' || primaryPayment === 'UPI' || primaryPayment === 'CARD'
          ? escapeXml(config.bankLedger)
          : escapeXml(config.cashLedger)

      const buyerName = sale.customer?.name ? escapeXml(sale.customer.name) : 'Cash Customer'

      // Inventory entries
      const inventoryEntries = sale.items
        .map((item) => {
          const itemName = escapeXml(item.product.name)
          const uom = item.product.unitOfMeasure ? escapeXml(item.product.unitOfMeasure) : 'NOS'
          const itemTotal = Number(item.totalAmount)
          const itemTax = Number(item.taxAmount ?? 0)
          const taxable = Math.max(0, itemTotal - itemTax)

          const batchAllocations =
            item.itemBatches && item.itemBatches.length > 0
              ? item.itemBatches
                  .map((ib) => {
                    const batchNum = escapeXml(ib.batch.batchNumber)
                    const expPeriod = ib.batch.expiryDate
                      ? formatTallyDisplayDate(ib.batch.expiryDate)
                      : ''
                    const mfgPeriod = ib.batch.manufacturingDate
                      ? formatTallyDisplayDate(ib.batch.manufacturingDate)
                      : ''
                    const bAmount = (ib.quantity * Number(item.unitPrice)).toFixed(2)
                    return `            <BATCHALLOCATIONS.LIST>
              <BATCHNAME>${batchNum}</BATCHNAME>
              <GODOWNNAME>${escapeXml(config.defaultGodown)}</GODOWNNAME>
              ${mfgPeriod ? `<MFGDATE>${mfgPeriod}</MFGDATE>` : ''}
              ${expPeriod ? `<EXPIRYPERIOD>${expPeriod}</EXPIRYPERIOD>` : ''}
              <AMOUNT>-${bAmount}</AMOUNT>
              <ACTUALQTY>-${ib.quantity} ${uom}</ACTUALQTY>
              <BILLEDQTY>-${ib.quantity} ${uom}</BILLEDQTY>
            </BATCHALLOCATIONS.LIST>`
                  })
                  .join('\n')
              : `            <BATCHALLOCATIONS.LIST>
              <BATCHNAME>Primary Batch</BATCHNAME>
              <GODOWNNAME>${escapeXml(config.defaultGodown)}</GODOWNNAME>
              <AMOUNT>-${formatNum(itemTotal)}</AMOUNT>
              <ACTUALQTY>-${item.quantity} ${uom}</ACTUALQTY>
              <BILLEDQTY>-${item.quantity} ${uom}</BILLEDQTY>
            </BATCHALLOCATIONS.LIST>`

          return `          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>${itemName}</STOCKITEMNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <RATE>${formatNum(item.unitPrice)}/${uom}</RATE>
            <AMOUNT>-${formatNum(itemTotal)}</AMOUNT>
            <ACTUALQTY>-${item.quantity} ${uom}</ACTUALQTY>
            <BILLEDQTY>-${item.quantity} ${uom}</BILLEDQTY>
${batchAllocations}
            <ACCOUNTINGALLOCATIONS.LIST>
              <LEDGERNAME>${escapeXml(config.salesLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>-${formatNum(taxable)}</AMOUNT>
            </ACCOUNTINGALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>`
        })
        .join('\n')

      // Tax Ledger entries
      const taxEntries: string[] = []
      const cgst = Number(sale.cgstAmount ?? 0)
      const sgst = Number(sale.sgstAmount ?? 0)
      const igst = Number(sale.igstAmount ?? 0)

      if (cgst > 0) {
        taxEntries.push(`          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(config.cgstOutputLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${formatNum(cgst)}</AMOUNT>
          </LEDGERENTRIES.LIST>`)
      }
      if (sgst > 0) {
        taxEntries.push(`          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(config.sgstOutputLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${formatNum(sgst)}</AMOUNT>
          </LEDGERENTRIES.LIST>`)
      }
      if (igst > 0) {
        taxEntries.push(`          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(config.igstOutputLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${formatNum(igst)}</AMOUNT>
          </LEDGERENTRIES.LIST>`)
      }

      // Discount entry if any
      const discount = Number(sale.discountAmount ?? 0)
      if (discount > 0) {
        taxEntries.push(`          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(config.discountLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>${formatNum(discount)}</AMOUNT>
          </LEDGERENTRIES.LIST>`)
      }

      // Party Debit Balancing Entry
      const partyEntry = `          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${partyLedger}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>${formatNum(sale.totalAmount)}</AMOUNT>
          </LEDGERENTRIES.LIST>`

      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
          <DATE>${tallyDate}</DATE>
          <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${invNum}</VOUCHERNUMBER>
          <REFERENCE>${invNum}</REFERENCE>
          <PARTYLEDGERNAME>${partyLedger}</PARTYLEDGERNAME>
          <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
          <BASICBUYERNAME>${buyerName}</BASICBUYERNAME>
          ${sale.priceLevel ? `<PRICELEVEL>${escapeXml(sale.priceLevel)}</PRICELEVEL>` : sale.customer?.priceLevel ? `<PRICELEVEL>${escapeXml(sale.customer.priceLevel)}</PRICELEVEL>` : ''}
          ${sale.customer?.gstin ? `<PARTYGSTIN>${escapeXml(sale.customer.gstin)}</PARTYGSTIN>` : ''}
          ${sale.customer?.state ? `<STATENAME>${escapeXml(sale.customer.state)}</STATENAME>` : ''}
${inventoryEntries}
${taxEntries.join('\n')}
${partyEntry}
        </VOUCHER>
      </TALLYMESSAGE>`
    })
    .join('\n')

  return wrapEnvelope(vouchersXml)
}

// ─── Purchase Vouchers Builder ────────────────────────────────

export function buildPurchaseVouchersXml(
  purchases: PurchaseForTally[],
  config: TallyConfig
): string {
  const vouchersXml = purchases
    .map((purchase) => {
      const tallyDate = formatTallyDate(purchase.purchaseDate)
      const vchNum = escapeXml(purchase.purchaseNumber)
      const refNum = escapeXml(purchase.invoiceNumber || purchase.purchaseNumber)
      const supplierName = escapeXml(purchase.supplier.name)

      const inventoryEntries = purchase.items
        .map((item) => {
          const itemName = escapeXml(item.product.name)
          const uom = item.product.unitOfMeasure ? escapeXml(item.product.unitOfMeasure) : 'NOS'
          const itemTotal = Number(item.totalAmount)
          const expPeriod = item.expiryDate ? formatTallyDisplayDate(item.expiryDate) : ''
          const mfgPeriod = item.manufacturingDate ? formatTallyDisplayDate(item.manufacturingDate) : ''
          const batchNum = item.batchNumber ? escapeXml(item.batchNumber) : 'Primary Batch'

          return `          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>${itemName}</STOCKITEMNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <RATE>${formatNum(item.unitCost)}/${uom}</RATE>
            <AMOUNT>${formatNum(itemTotal)}</AMOUNT>
            <ACTUALQTY>${item.quantity} ${uom}</ACTUALQTY>
            <BILLEDQTY>${item.quantity} ${uom}</BILLEDQTY>
            <BATCHALLOCATIONS.LIST>
              <BATCHNAME>${batchNum}</BATCHNAME>
              <GODOWNNAME>${escapeXml(config.defaultGodown)}</GODOWNNAME>
              ${mfgPeriod ? `<MFGDATE>${mfgPeriod}</MFGDATE>` : ''}
              ${expPeriod ? `<EXPIRYPERIOD>${expPeriod}</EXPIRYPERIOD>` : ''}
              <AMOUNT>${formatNum(itemTotal)}</AMOUNT>
              <ACTUALQTY>${item.quantity} ${uom}</ACTUALQTY>
              <BILLEDQTY>${item.quantity} ${uom}</BILLEDQTY>
            </BATCHALLOCATIONS.LIST>
            <ACCOUNTINGALLOCATIONS.LIST>
              <LEDGERNAME>${escapeXml(config.purchaseLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>${formatNum(itemTotal)}</AMOUNT>
            </ACCOUNTINGALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>`
        })
        .join('\n')

      // Input tax entries
      const taxEntries: string[] = []
      const cgst = Number(purchase.cgstAmount ?? 0)
      const sgst = Number(purchase.sgstAmount ?? 0)
      const igst = Number(purchase.igstAmount ?? 0)

      if (cgst > 0) {
        taxEntries.push(`          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(config.cgstInputLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>${formatNum(cgst)}</AMOUNT>
          </LEDGERENTRIES.LIST>`)
      }
      if (sgst > 0) {
        taxEntries.push(`          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(config.sgstInputLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>${formatNum(sgst)}</AMOUNT>
          </LEDGERENTRIES.LIST>`)
      }
      if (igst > 0) {
        taxEntries.push(`          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(config.igstInputLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>${formatNum(igst)}</AMOUNT>
          </LEDGERENTRIES.LIST>`)
      }

      // Balancing supplier credit entry
      const supplierEntry = `          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${supplierName}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${formatNum(purchase.totalAmount)}</AMOUNT>
          </LEDGERENTRIES.LIST>`

      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Purchase" ACTION="Create" OBJVIEW="Invoice Voucher View">
          <DATE>${tallyDate}</DATE>
          <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${vchNum}</VOUCHERNUMBER>
          <REFERENCE>${refNum}</REFERENCE>
          <PARTYLEDGERNAME>${supplierName}</PARTYLEDGERNAME>
          <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
          ${purchase.supplier.gstin ? `<PARTYGSTIN>${escapeXml(purchase.supplier.gstin)}</PARTYGSTIN>` : ''}
          ${purchase.supplier.state ? `<STATENAME>${escapeXml(purchase.supplier.state)}</STATENAME>` : ''}
${inventoryEntries}
${taxEntries.join('\n')}
${supplierEntry}
        </VOUCHER>
      </TALLYMESSAGE>`
    })
    .join('\n')

  return wrapEnvelope(vouchersXml)
}

// ─── Masters: Customer Ledgers Builder ─────────────────────────

export function buildCustomerLedgersXml(customers: CustomerForTally[]): string {
  const ledgersXml = customers
    .map((c) => {
      const name = escapeXml(c.name)
      const gstin = escapeXml(c.gstin)
      const phone = escapeXml(c.phone)
      const state = escapeXml(c.state || '')
      const address = escapeXml([c.address, c.city, c.pincode].filter(Boolean).join(', '))
      const priceLevel = c.priceLevel ? escapeXml(c.priceLevel) : ''

      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="${name}" ACTION="Create">
          <NAME>${name}</NAME>
          <PARENT>Sundry Debtors</PARENT>
          <OPENINGBALANCE>0</OPENINGBALANCE>
          <ISBILLWISEON>Yes</ISBILLWISEON>
          ${priceLevel ? `<PRICELEVEL>${priceLevel}</PRICELEVEL>` : ''}
          ${address ? `<ADDRESS.LIST><ADDRESS>${address}</ADDRESS></ADDRESS.LIST>` : ''}
          ${state ? `<STATENAME>${state}</STATENAME>` : ''}
          ${c.pincode ? `<PINCODE>${escapeXml(c.pincode)}</PINCODE>` : ''}
          ${gstin ? `<PARTYGSTIN>${gstin}</PARTYGSTIN>` : ''}
          ${phone ? `<LEDGERPHONE>${phone}</LEDGERPHONE>` : ''}
        </LEDGER>
      </TALLYMESSAGE>`
    })
    .join('\n')

  return wrapEnvelope(ledgersXml)
}

// ─── Masters: Supplier Ledgers Builder ─────────────────────────

export function buildSupplierLedgersXml(suppliers: SupplierForTally[]): string {
  const ledgersXml = suppliers
    .map((s) => {
      const name = escapeXml(s.name)
      const gstin = escapeXml(s.gstin)
      const phone = escapeXml(s.phone)
      const state = escapeXml(s.state || '')
      const address = escapeXml([s.address, s.city, s.pincode].filter(Boolean).join(', '))

      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="${name}" ACTION="Create">
          <NAME>${name}</NAME>
          <PARENT>Sundry Creditors</PARENT>
          <OPENINGBALANCE>0</OPENINGBALANCE>
          <ISBILLWISEON>Yes</ISBILLWISEON>
          ${address ? `<ADDRESS.LIST><ADDRESS>${address}</ADDRESS></ADDRESS.LIST>` : ''}
          ${state ? `<STATENAME>${state}</STATENAME>` : ''}
          ${s.pincode ? `<PINCODE>${escapeXml(s.pincode)}</PINCODE>` : ''}
          ${gstin ? `<PARTYGSTIN>${gstin}</PARTYGSTIN>` : ''}
          ${s.pan ? `<PANNUMBER>${escapeXml(s.pan)}</PANNUMBER>` : ''}
          ${phone ? `<LEDGERPHONE>${phone}</LEDGERPHONE>` : ''}
        </LEDGER>
      </TALLYMESSAGE>`
    })
    .join('\n')

  return wrapEnvelope(ledgersXml)
}

// ─── Masters: Stock Items Builder ─────────────────────────────

export function buildStockItemsXml(products: ProductForTally[]): string {
  const itemsXml = products
    .map((p) => {
      const name = escapeXml(p.name)
      const uom = p.unitOfMeasure ? escapeXml(p.unitOfMeasure) : 'NOS'
      const hsn = p.hsnCode ? escapeXml(p.hsnCode) : ''
      const gstRate = p.gstRate ? formatNum(p.gstRate, 0) : '12'

      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <STOCKITEM NAME="${name}" ACTION="Create">
          <NAME>${name}</NAME>
          <PARENT>Primary</PARENT>
          <BASEUNITS>${uom}</BASEUNITS>
          <OPENINGBALANCE>0</OPENINGBALANCE>
          <ISBATCHWISEON>Yes</ISBATCHWISEON>
          <ISPERISHABLEON>Yes</ISPERISHABLEON>
          <HASTRANSMANUFACTURINGDATE>Yes</HASTRANSMANUFACTURINGDATE>
          <GSTAPPLICABLE>&#4; Applicable</GSTAPPLICABLE>
          <GSTTYPEOFSUPPLY>Goods</GSTTYPEOFSUPPLY>
          ${hsn ? `<HSNCODE>${hsn}</HSNCODE>` : ''}
          <GSTRATE>${gstRate}%</GSTRATE>
        </STOCKITEM>
      </TALLYMESSAGE>`
    })
    .join('\n')

  return wrapEnvelope(itemsXml)
}

// ─── Debit Notes Builder (Expired Stock & Purchase Returns) ───

export function buildDebitNotesXml(
  debitNotes: DebitNoteForTally[],
  config: TallyConfig
): string {
  const vouchersXml = debitNotes
    .map((dn) => {
      const tallyDate = formatTallyDate(dn.returnDate)
      const vchNum = escapeXml(dn.returnNumber)
      const refNum = escapeXml(dn.invoiceNumber || dn.returnNumber)
      const supplierName = escapeXml(dn.supplier.name)

      const inventoryEntries = dn.items
        .map((item) => {
          const itemName = escapeXml(item.product.name)
          const uom = item.product.unitOfMeasure ? escapeXml(item.product.unitOfMeasure) : 'NOS'
          const itemTotal = Number(item.totalAmount)
          const expPeriod = item.expiryDate ? formatTallyDisplayDate(item.expiryDate) : ''
          const mfgPeriod = item.manufacturingDate ? formatTallyDisplayDate(item.manufacturingDate) : ''
          const batchNum = item.batchNumber ? escapeXml(item.batchNumber) : 'Primary Batch'

          return `          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>${itemName}</STOCKITEMNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <RATE>${formatNum(item.unitCost)}/${uom}</RATE>
            <AMOUNT>-${formatNum(itemTotal)}</AMOUNT>
            <ACTUALQTY>-${item.quantity} ${uom}</ACTUALQTY>
            <BILLEDQTY>-${item.quantity} ${uom}</BILLEDQTY>
            <BATCHALLOCATIONS.LIST>
              <BATCHNAME>${batchNum}</BATCHNAME>
              <GODOWNNAME>${escapeXml(config.defaultGodown)}</GODOWNNAME>
              ${mfgPeriod ? `<MFGDATE>${mfgPeriod}</MFGDATE>` : ''}
              ${expPeriod ? `<EXPIRYPERIOD>${expPeriod}</EXPIRYPERIOD>` : ''}
              <AMOUNT>-${formatNum(itemTotal)}</AMOUNT>
              <ACTUALQTY>-${item.quantity} ${uom}</ACTUALQTY>
              <BILLEDQTY>-${item.quantity} ${uom}</BILLEDQTY>
            </BATCHALLOCATIONS.LIST>
            <ACCOUNTINGALLOCATIONS.LIST>
              <LEDGERNAME>${escapeXml(config.purchaseLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>-${formatNum(itemTotal)}</AMOUNT>
            </ACCOUNTINGALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>`
        })
        .join('\n')

      // Input tax credit reversal entries (Credits to Input Tax)
      const taxEntries: string[] = []
      const cgst = Number(dn.cgstAmount ?? 0)
      const sgst = Number(dn.sgstAmount ?? 0)
      const igst = Number(dn.igstAmount ?? 0)

      if (cgst > 0) {
        taxEntries.push(`          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(config.cgstInputLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${formatNum(cgst)}</AMOUNT>
          </LEDGERENTRIES.LIST>`)
      }
      if (sgst > 0) {
        taxEntries.push(`          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(config.sgstInputLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${formatNum(sgst)}</AMOUNT>
          </LEDGERENTRIES.LIST>`)
      }
      if (igst > 0) {
        taxEntries.push(`          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(config.igstInputLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${formatNum(igst)}</AMOUNT>
          </LEDGERENTRIES.LIST>`)
      }

      // Debit supplier account for total return value
      const supplierEntry = `          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${supplierName}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>${formatNum(dn.totalAmount)}</AMOUNT>
          </LEDGERENTRIES.LIST>`

      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Debit Note" ACTION="Create" OBJVIEW="Invoice Voucher View">
          <DATE>${tallyDate}</DATE>
          <VOUCHERTYPENAME>Debit Note</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${vchNum}</VOUCHERNUMBER>
          <REFERENCE>${refNum}</REFERENCE>
          <PARTYLEDGERNAME>${supplierName}</PARTYLEDGERNAME>
          <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
          <ISDEBITNOTE>Yes</ISDEBITNOTE>
          <ALLOWUSEOFEXPIREDBATCHES>Yes</ALLOWUSEOFEXPIREDBATCHES>
          <NARRATION>${escapeXml(`Pharma Debit Note - Supplier return: ${dn.reason}`)}</NARRATION>
          ${dn.supplier.gstin ? `<PARTYGSTIN>${escapeXml(dn.supplier.gstin)}</PARTYGSTIN>` : ''}
          ${dn.supplier.state ? `<STATENAME>${escapeXml(dn.supplier.state)}</STATENAME>` : ''}
${inventoryEntries}
${taxEntries.join('\n')}
${supplierEntry}
        </VOUCHER>
      </TALLYMESSAGE>`
    })
    .join('\n')

  return wrapEnvelope(vouchersXml)
}

// ─── Masters: Units & Compound Units Builder ──────────────────

export function buildUnitsXml(units: UnitForTally[]): string {
  const unitsXml = units
    .map((u) => {
      const name = escapeXml(u.name)
      const symbol = escapeXml(u.symbol || u.name)
      const decPlaces = u.decimalPlaces ?? (u.name.toLowerCase().includes('kg') ? 3 : 0)

      const isSimple = u.isSimple !== undefined ? u.isSimple : ((u as any).isSimpleUnit !== undefined ? (u as any).isSimpleUnit : !u.conversion)
      const uqc = (u as any).uqcCode || u.formalName

      if (isSimple) {
        return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <UNIT NAME="${name}" ACTION="Create">
          <NAME>${symbol}</NAME>
          <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>
          <DECIMALPLACES>${decPlaces}</DECIMALPLACES>
          <ORIGINALNAME>${name}</ORIGINALNAME>
          ${uqc ? `<REPORTINGUQC>${escapeXml(uqc)}</REPORTINGUQC>` : ''}
        </UNIT>
      </TALLYMESSAGE>`
      }

      // Compound unit: 1 Box = 10 Strips, 1 Strip = 10 Nos, 1 Kg = 1000 Grams
      const baseUnit = escapeXml(u.baseUnit || 'Box')
      const addUnit = escapeXml(u.additionalUnit || 'Nos')
      const conversion = u.conversion ?? 10

      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <UNIT NAME="${name}" ACTION="Create">
          <NAME>${name}</NAME>
          <ISSIMPLEUNIT>No</ISSIMPLEUNIT>
          <BASEUNITS>${baseUnit}</BASEUNITS>
          <ADDITIONALUNITS>${addUnit}</ADDITIONALUNITS>
          <CONVERSION>${conversion}</CONVERSION>
        </UNIT>
      </TALLYMESSAGE>`
    })
    .join('\n')

  return wrapEnvelope(unitsXml)
}

// ─── Masters: Multi-Tier Price List Builder ────────────────────

export function buildPriceListXml(priceList: PriceListForTally): string {
  const tallyDate = formatTallyDate(priceList.effectiveDate)

  // Group rules by price level
  const byLevel = new Map<string, PriceRuleForTally[]>()
  for (const r of priceList.rules) {
    const list = byLevel.get(r.priceLevel) ?? []
    list.push(r)
    byLevel.set(r.priceLevel, list)
  }

  const messages: string[] = []
  for (const [level, rules] of byLevel.entries()) {
    const levelXml = rules
      .map((r) => {
        const itemName = escapeXml(r.productName)
        const uom = r.unitOfMeasure ? escapeXml(r.unitOfMeasure) : 'NOS'
        const rate = formatNum(r.rate)
        const disc = r.discountPercent ? formatNum(r.discountPercent) : '0.00'

        return `          <ITEMPRICELIST.LIST>
            <STOCKITEMNAME>${itemName}</STOCKITEMNAME>
            <PRICELEVEL>${escapeXml(level)}</PRICELEVEL>
            <APPLICABLEFROM>${tallyDate}</APPLICABLEFROM>
            <PRICELEVELLIST.LIST>
              <RATE>${rate}/${uom}</RATE>
              <DISCOUNT>${disc}</DISCOUNT>
            </PRICELEVELLIST.LIST>
          </ITEMPRICELIST.LIST>`
      })
      .join('\n')

    messages.push(`      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <PRICELIST NAME="${escapeXml(level)}" ACTION="Create">
          <PRICELEVEL>${escapeXml(level)}</PRICELEVEL>
          <APPLICABLEFROM>${tallyDate}</APPLICABLEFROM>
${levelXml}
        </PRICELIST>
      </TALLYMESSAGE>`)
  }

  return wrapEnvelope(messages.join('\n'))
}

// ─── Statutory & Company Setup Builder (F11 Features) ─────────

export function buildCompanySetupXml(setup: CompanySetupForTally): string {
  const companyName = escapeXml(setup.companyName)
  const state = escapeXml(setup.stateName)
  const gstin = escapeXml(setup.gstin)

  const xml = `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <COMPANY NAME="${companyName}" ACTION="Alter">
          <NAME>${companyName}</NAME>
          ${setup.legalName ? `<FORMALNAME>${escapeXml(setup.legalName)}</FORMALNAME>` : ''}
          <STATENAME>${state}</STATENAME>
          <PARTYGSTIN>${gstin}</PARTYGSTIN>
          ${setup.dlNumber ? `<DRUGLICENSENUMBER>${escapeXml(setup.dlNumber)}</DRUGLICENSENUMBER>` : ''}
          ${setup.address ? `<ADDRESS.LIST><ADDRESS>${escapeXml(setup.address)}</ADDRESS></ADDRESS.LIST>` : ''}
          <ISGSTAPPLICABLE>Yes</ISGSTAPPLICABLE>
          <GSTREGISTRATIONTYPE>${setup.registrationType || 'Regular'}</GSTREGISTRATIONTYPE>
          <MAINTAINBATCHES>${setup.maintainBatchWise ? 'Yes' : 'No'}</MAINTAINBATCHES>
          <TRACKEXPIRYDATE>${setup.trackExpiryDates ? 'Yes' : 'No'}</TRACKEXPIRYDATE>
          <TRACKMFGDATE>${setup.trackMfgDates ? 'Yes' : 'No'}</TRACKMFGDATE>
          <USEMULTIPLEPRICELEVELS>Yes</USEMULTIPLEPRICELEVELS>
          <USEDEBITCREDITNOTES>Yes</USEDEBITCREDITNOTES>
        </COMPANY>
      </TALLYMESSAGE>`

  return wrapEnvelope(xml)
}

// ─── Masters: Duties & Taxes Ledgers Builder ───────────────────

export function buildDutiesTaxesLedgersXml(config: TallyConfig): string {
  const ledgers = [
    { name: config.cgstOutputLedger, parent: 'Duties & Taxes', taxType: 'GST', subType: 'Central Tax', rate: 9 },
    { name: config.sgstOutputLedger, parent: 'Duties & Taxes', taxType: 'GST', subType: 'State Tax', rate: 9 },
    { name: config.igstOutputLedger, parent: 'Duties & Taxes', taxType: 'GST', subType: 'Integrated Tax', rate: 18 },
    { name: config.cgstInputLedger, parent: 'Duties & Taxes', taxType: 'GST', subType: 'Central Tax', rate: 9 },
    { name: config.sgstInputLedger, parent: 'Duties & Taxes', taxType: 'GST', subType: 'State Tax', rate: 9 },
    { name: config.igstInputLedger, parent: 'Duties & Taxes', taxType: 'GST', subType: 'Integrated Tax', rate: 18 },
  ]

  const xml = ledgers
    .map((l) => {
      const name = escapeXml(l.name)
      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="${name}" ACTION="Create">
          <NAME>${name}</NAME>
          <PARENT>${escapeXml(l.parent)}</PARENT>
          <TAXTYPE>${l.taxType}</TAXTYPE>
          <GSTDUTYHEAD>${l.subType}</GSTDUTYHEAD>
          <RATEOFTAXCALCULATION>${l.rate}</RATEOFTAXCALCULATION>
        </LEDGER>
      </TALLYMESSAGE>`
    })
    .join('\n')

  return wrapEnvelope(xml)
}

// ─── Combined Day Book Bundle Builder ─────────────────────────

export function buildDayBookXml(
  sales: SaleForTally[],
  purchases: PurchaseForTally[],
  config: TallyConfig
): string {
  const salesVouchers = sales.length > 0 ? buildSalesVouchersXml(sales, config) : ''
  const purchaseVouchers = purchases.length > 0 ? buildPurchaseVouchersXml(purchases, config) : ''

  // Extract inner TALLYMESSAGE blocks from both
  const extractMessages = (xml: string) => {
    const match = xml.match(/<DATA>([\s\S]*?)<\/DATA>/)
    return match ? match[1].trim() : ''
  }

  const combined = [extractMessages(salesVouchers), extractMessages(purchaseVouchers)]
    .filter(Boolean)
    .join('\n')

  return wrapEnvelope(combined)
}

