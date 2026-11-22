import { format } from 'date-fns'

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}

export function generatePurchasesRegisterCsv(purchases: any[]): string {
  const rows: string[] = []
  rows.push(
    [
      'Purchase Invoice No',
      'PO Number',
      'Date',
      'Supplier Name',
      'Supplier GSTIN',
      'Supplier State',
      'Item Name',
      'SKU',
      'HSN Code',
      'Quantity',
      'Unit',
      'Unit Cost',
      'Taxable Value',
      'GST Rate',
      'Tax Amount',
      'Total Amount',
    ].join(',')
  )

  for (const p of purchases) {
    const pDate = p.purchaseDate ? format(new Date(p.purchaseDate), 'yyyy-MM-dd') : ''
    const supplierName = p.supplier?.name || 'Cash Vendor'
    const supplierGstin = p.supplier?.gstin || ''
    const supplierState = p.supplier?.state || ''

    if (p.items && p.items.length > 0) {
      for (const item of p.items) {
        const qty = Number(item.quantity || 0)
        const cost = Number(item.unitCost || 0)
        const taxable = Number(item.taxableAmount || qty * cost)
        const tax = Number(item.taxAmount || 0)
        const total = Number(item.totalAmount || taxable + tax)
        const gstRate = taxable > 0 ? `${Math.round((tax / taxable) * 100)}%` : '0%'

        rows.push(
          [
            escapeCsv(p.invoiceNumber || p.purchaseNumber),
            escapeCsv(p.purchaseNumber || ''),
            pDate,
            escapeCsv(supplierName),
            escapeCsv(supplierGstin),
            escapeCsv(supplierState),
            escapeCsv(item.product?.name || 'Item'),
            escapeCsv(item.product?.sku || ''),
            escapeCsv(item.product?.hsnCode || ''),
            qty,
            escapeCsv(item.product?.unitOfMeasure || 'Nos'),
            cost.toFixed(2),
            taxable.toFixed(2),
            escapeCsv(gstRate),
            tax.toFixed(2),
            total.toFixed(2),
          ].join(',')
        )
      }
    } else {
      const total = Number(p.totalAmount || 0)
      const tax = Number(p.taxAmount || 0)
      const taxable = total - tax
      rows.push(
        [
          escapeCsv(p.invoiceNumber || p.purchaseNumber),
          escapeCsv(p.purchaseNumber || ''),
          pDate,
          escapeCsv(supplierName),
          escapeCsv(supplierGstin),
          escapeCsv(supplierState),
          escapeCsv('Consolidated Purchase'),
          escapeCsv(''),
          escapeCsv(''),
          1,
          escapeCsv('Lot'),
          taxable.toFixed(2),
          taxable.toFixed(2),
          escapeCsv('12%'),
          tax.toFixed(2),
          total.toFixed(2),
        ].join(',')
      )
    }
  }

  return rows.join('\r\n')
}

export function generateCustomersCsv(customers: any[]): string {
  const rows: string[] = []
  rows.push(
    [
      'Customer Name',
      'Phone Number',
      'Email',
      'GSTIN',
      'Address',
      'City',
      'State',
      'Pincode',
      'Credit Limit',
      'Outstanding Balance',
      'Ledger Group',
    ].join(',')
  )

  for (const c of customers) {
    rows.push(
      [
        escapeCsv(c.name),
        escapeCsv(c.phone || ''),
        escapeCsv(c.email || ''),
        escapeCsv(c.gstin || ''),
        escapeCsv(c.address || ''),
        escapeCsv(c.city || ''),
        escapeCsv(c.state || ''),
        escapeCsv(c.pincode || ''),
        Number(c.creditLimit || 0).toFixed(2),
        Number(c.outstandingBalance || 0).toFixed(2),
        escapeCsv('Sundry Debtors'),
      ].join(',')
    )
  }

  return rows.join('\r\n')
}

export function generateSuppliersCsv(suppliers: any[]): string {
  const rows: string[] = []
  rows.push(
    [
      'Supplier Name',
      'Phone Number',
      'Email',
      'GSTIN',
      'PAN',
      'Drug License No',
      'Address',
      'City',
      'State',
      'Pincode',
      'Bank Name',
      'Bank Account Number',
      'Bank IFSC',
      'Outstanding Balance',
      'Ledger Group',
    ].join(',')
  )

  for (const s of suppliers) {
    rows.push(
      [
        escapeCsv(s.name),
        escapeCsv(s.phone || ''),
        escapeCsv(s.email || ''),
        escapeCsv(s.gstin || ''),
        escapeCsv(s.pan || ''),
        escapeCsv(s.dlNumber || ''),
        escapeCsv(s.address || ''),
        escapeCsv(s.city || ''),
        escapeCsv(s.state || ''),
        escapeCsv(s.pincode || ''),
        escapeCsv(s.bankName || ''),
        escapeCsv(s.bankAccount || ''),
        escapeCsv(s.bankIfsc || ''),
        Number(s.outstandingBalance || 0).toFixed(2),
        escapeCsv('Sundry Creditors'),
      ].join(',')
    )
  }

  return rows.join('\r\n')
}

export function generateStockItemsCsv(products: any[]): string {
  const rows: string[] = []
  rows.push(
    [
      'SKU',
      'Item Name',
      'HSN Code',
      'Unit of Measure',
      'GST Rate %',
      'MRP (₹)',
      'Cost Price (₹)',
      'Opening Stock Qty',
      'Opening Stock Valuation (₹)',
      'Taxability',
    ].join(',')
  )

  for (const p of products) {
    rows.push(
      [
        escapeCsv(p.sku),
        escapeCsv(p.name),
        escapeCsv(p.hsnCode || ''),
        escapeCsv(p.unit || 'Strip'),
        Number(p.gstRate || 0).toFixed(1),
        Number(p.mrp || 0).toFixed(2),
        Number(p.costPrice || 0).toFixed(2),
        Number(p.openingBalance || 0),
        Number(p.openingValue || 0).toFixed(2),
        escapeCsv('Taxable'),
      ].join(',')
    )
  }

  return rows.join('\r\n')
}

export function generateDaybookCsv(sales: any[], purchases: any[]): string {
  const rows: string[] = []
  rows.push(
    [
      'Date',
      'Voucher Type',
      'Voucher No',
      'Party Name',
      'Tender / Mode',
      'Subtotal (₹)',
      'Tax Amount (₹)',
      'Net Amount (₹)',
      'Narration',
    ].join(',')
  )

  const entries: Array<{
    date: Date
    voucherType: string
    voucherNo: string
    party: string
    tender: string
    subtotal: number
    tax: number
    total: number
    narration: string
  }> = []

  for (const s of sales) {
    const d = s.saleDate ? new Date(s.saleDate) : new Date()
    const tender = s.payments && s.payments.length > 0 ? s.payments[0].method : 'Cash'
    entries.push({
      date: d,
      voucherType: 'Sales Voucher',
      voucherNo: s.invoiceNumber,
      party: s.customer?.name || 'Counter Cash Sale',
      tender,
      subtotal: Number(s.subtotal || 0),
      tax: Number(s.taxAmount || 0),
      total: Number(s.totalAmount || 0),
      narration: `Retail Sale via ${tender} [${s.invoiceNumber}]`,
    })
  }

  for (const p of purchases) {
    const d = p.purchaseDate ? new Date(p.purchaseDate) : new Date()
    entries.push({
      date: d,
      voucherType: 'Purchase Voucher',
      voucherNo: p.invoiceNumber || p.purchaseNumber,
      party: p.supplier?.name || 'Wholesale Supplier',
      tender: 'Credit / Bank',
      subtotal: Number(p.subtotal || 0),
      tax: Number(p.taxAmount || 0),
      total: Number(p.totalAmount || 0),
      narration: `Supplier Inward GRN [${p.invoiceNumber || p.purchaseNumber}]`,
    })
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime())

  for (const e of entries) {
    rows.push(
      [
        format(e.date, 'yyyy-MM-dd'),
        escapeCsv(e.voucherType),
        escapeCsv(e.voucherNo),
        escapeCsv(e.party),
        escapeCsv(e.tender),
        e.subtotal.toFixed(2),
        e.tax.toFixed(2),
        e.total.toFixed(2),
        escapeCsv(e.narration),
      ].join(',')
    )
  }

  return rows.join('\r\n')
}

export function generateDebitNotesCsv(returns: any[]): string {
  const rows: string[] = []
  rows.push(
    [
      'Debit Note No',
      'Return Date',
      'Supplier Name',
      'Supplier GSTIN',
      'Original Purchase Invoice',
      'Reason for Return',
      'Subtotal (₹)',
      'Input Tax Reversal (₹)',
      'Total Debit Note Value (₹)',
    ].join(',')
  )

  for (const r of returns) {
    const rDate = r.returnDate ? format(new Date(r.returnDate), 'yyyy-MM-dd') : ''
    const supplierName = r.supplier?.name || 'Vendor'
    const gstin = r.supplier?.gstin || ''
    const origInvoice = r.purchase?.invoiceNumber || r.purchase?.purchaseNumber || ''
    const subtotal = Number(r.subtotal || 0)
    const tax = Number(r.taxAmount || 0)
    const total = Number(r.totalAmount || subtotal + tax)

    rows.push(
      [
        escapeCsv(r.returnNumber || `DN-${r.id.slice(-6)}`),
        rDate,
        escapeCsv(supplierName),
        escapeCsv(gstin),
        escapeCsv(origInvoice),
        escapeCsv(r.reason || 'Expired / Damaged Stock Return'),
        subtotal.toFixed(2),
        tax.toFixed(2),
        total.toFixed(2),
      ].join(',')
    )
  }

  return rows.join('\r\n')
}

export function generateUnitsCsv(units: any[]): string {
  const rows: string[] = []
  rows.push(
    ['Unit Name', 'Symbol', 'Formal Name', 'Decimal Places', 'UQC Code', 'Conversion Factor'].join(
      ','
    )
  )

  for (const u of units) {
    rows.push(
      [
        escapeCsv(u.name || u.symbol),
        escapeCsv(u.symbol),
        escapeCsv(u.formalName || u.name),
        u.decimalPlaces || 0,
        escapeCsv(u.uqc || 'NOS'),
        u.conversionFactor || 1,
      ].join(',')
    )
  }

  return rows.join('\r\n')
}

export function generatePriceListsCsv(rules: any[]): string {
  const rows: string[] = []
  rows.push(
    [
      'Product Name',
      'Unit of Measure',
      'Price Level Tier',
      'Standard Rate (₹)',
      'Discount %',
      'Applicable Slabs',
    ].join(',')
  )

  for (const r of rules) {
    rows.push(
      [
        escapeCsv(r.productName),
        escapeCsv(r.unit || 'Strip'),
        escapeCsv(r.priceLevel),
        Number(r.rate || 0).toFixed(2),
        Number(r.discountPercent || 0).toFixed(2),
        escapeCsv(r.slabs || 'Standard (All Quantities)'),
      ].join(',')
    )
  }

  return rows.join('\r\n')
}
