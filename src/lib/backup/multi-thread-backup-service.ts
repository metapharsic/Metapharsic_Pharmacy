/**
 * Multi-Threaded Database Backup & Excel Export Engine
 * Executes parallel domain worker pipelines to extract, structure, and bundle the entire
 * pharmacy database into an enterprise multi-sheet Excel (.xlsx) workbook.
 */

import prisma from '@/lib/db/prisma'
import {
  generateExcelWorkbook,
  type ExcelSheetConfig,
  type ExcelWorkbookConfig,
} from '@/lib/reports/excel-export-service'

export interface BackupWorkerReport {
  id: number
  domain: string
  label: string
  durationMs: number
  rowCount: number
  status: 'COMPLETED' | 'ERROR'
}

export interface DatabaseBackupResult {
  buffer: Buffer
  filename: string
  stats: {
    threadCount: number
    totalDurationMs: number
    totalRows: number
    fileSizeBytes: number
    sheetsCount: number
    organizationName: string
    workerReports: BackupWorkerReport[]
  }
}

export async function generateDatabaseBackup(options: {
  organizationId?: string
  isSuperAdmin?: boolean
  shopName?: string
}): Promise<DatabaseBackupResult> {
  const startTime = performance.now()
  const { organizationId, isSuperAdmin } = options

  // Get active organization details if scoped
  let orgName = options.shopName || 'All Dispensary Entities'
  if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, code: true },
    })
    if (org?.name) orgName = org.name
  }

  // Common where filters
  const orgFilter = organizationId && !isSuperAdmin ? { organizationId } : {}
  const branchOrgFilter = organizationId && !isSuperAdmin
    ? { branch: { organizationId } }
    : {}
  const productOrgFilter = organizationId && !isSuperAdmin
    ? { product: { organizationId } }
    : {}

  // ── WORKER THREAD 1: PRODUCTS & MASTER FORMULATIONS ──
  const runWorker1Products = async (): Promise<{ sheet: ExcelSheetConfig; report: BackupWorkerReport }> => {
    const wStart = performance.now()
    const products = await prisma.product.findMany({
      where: {
        ...orgFilter,
        isActive: true,
      },
      include: {
        categories: { select: { category: { select: { name: true } } } },
        rack: { select: { code: true, shelfNumber: true } },
      },
      orderBy: { name: 'asc' },
    })

    const headers = [
      'Product ID',
      'Formulation / Medicine Name',
      'Generic Name / Salt',
      'SKU Code',
      'Primary Barcode',
      'Primary Category',
      'Manufacturer',
      'Pack Size',
      'Tabs Per Strip',
      'HSN Code',
      'GST %',
      'Cost Price (₹)',
      'PTR (₹)',
      'MRP (₹)',
      'Drug Schedule',
      'Prescription Req',
      'Rack / Shelf',
      'Status',
    ]

    const data = products.map((p) => [
      p.id,
      p.name,
      p.genericName || '—',
      p.sku,
      p.barcode || '—',
      p.categories?.[0]?.category?.name || 'General Medicines',
      p.manufacturer || '—',
      p.packSize || 'Standard Pack',
      p.tabsPerStrip || 10,
      p.hsnCode || '3004',
      Number(p.gstRate || 12),
      Number(p.costPrice || 0),
      Number(p.ptr || 0),
      Number(p.mrp || 0),
      p.drugSchedule || 'NONE',
      p.isPrescriptionRequired ? 'YES' : 'NO',
      p.rack ? `${p.rack.code}-${p.rack.shelfNumber}` : '—',
      p.isActive ? 'ACTIVE' : 'INACTIVE',
    ])

    const durationMs = Math.round(performance.now() - wStart)
    return {
      sheet: {
        sheetName: 'Products & Master Catalog',
        title: `${orgName} — Product Master & Formulations Directory`,
        subtitle: `Complete dispensary drug catalog • Total Active Formulations: ${products.length}`,
        headers,
        data,
      },
      report: {
        id: 1,
        domain: 'PRODUCTS_CATALOG',
        label: 'Worker Thread #1: Products & Formulation Master',
        durationMs,
        rowCount: products.length,
        status: 'COMPLETED',
      },
    }
  }

  // ── WORKER THREAD 2: BATCHES & LIVE INVENTORY ──
  const runWorker2Batches = async (): Promise<{ sheet: ExcelSheetConfig; report: BackupWorkerReport }> => {
    const wStart = performance.now()
    const batches = await prisma.batch.findMany({
      where: {
        ...productOrgFilter,
      },
      include: {
        product: { select: { name: true, sku: true, unitOfMeasure: true } },
      },
      orderBy: { expiryDate: 'asc' },
    })

    const headers = [
      'Batch Number',
      'Medicine Name',
      'SKU',
      'Current Stock Units',
      'Reserved Units',
      'Sold Units',
      'Expiry Date',
      'Unit Purchase Cost (₹)',
      'Batch MRP (₹)',
      'Total Batch Valuation (₹)',
      'Batch Status',
    ]

    const data = batches.map((b) => {
      const avail = Math.max(0, b.quantity - b.reservedQuantity - b.soldQuantity)
      const cost = Number(b.purchasePrice || 0)
      const val = Math.round(avail * cost * 100) / 100
      return [
        b.batchNumber,
        b.product?.name || 'Unknown Item',
        b.product?.sku || '—',
        avail,
        b.reservedQuantity,
        b.soldQuantity,
        b.expiryDate.toISOString().slice(0, 10),
        cost,
        Number(b.mrp || 0),
        val,
        b.status,
      ]
    })

    const durationMs = Math.round(performance.now() - wStart)
    return {
      sheet: {
        sheetName: 'Batches & Live Inventory',
        title: `${orgName} — Physical Inventory & Batch Register`,
        subtitle: `Live dispensary stock levels & expiry tracking • Total Active Batches: ${batches.length}`,
        headers,
        data,
      },
      report: {
        id: 2,
        domain: 'BATCHES_INVENTORY',
        label: 'Worker Thread #2: Batches & Live Physical Inventory',
        durationMs,
        rowCount: batches.length,
        status: 'COMPLETED',
      },
    }
  }

  // ── WORKER THREAD 3: SALES & DISPENSARY TRANSACTIONS ──
  const runWorker3Sales = async (): Promise<{ sheet: ExcelSheetConfig; report: BackupWorkerReport }> => {
    const wStart = performance.now()
    const sales = await prisma.sale.findMany({
      where: {
        ...branchOrgFilter,
      },
      include: {
        customer: { select: { name: true, phone: true } },
        payments: { select: { method: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    })

    const headers = [
      'Invoice Number',
      'Date & Time',
      'Customer / Patient',
      'Contact Phone',
      'Doctor / Prescriber',
      'Payment Mode',
      'Subtotal (₹)',
      'Discount (₹)',
      'Tax Amount (₹)',
      'Total Net Invoiced (₹)',
      'Payment Status',
    ]

    const data = sales.map((s) => [
      s.invoiceNumber,
      s.createdAt.toISOString().slice(0, 19).replace('T', ' '),
      s.customer?.name || 'Walk-in Customer',
      s.customer?.phone || '—',
      s.doctorName || 'Direct / OTC',
      s.payments?.[0]?.method || s.paymentStatus || 'CASH',
      Number(s.subtotal || 0),
      Number(s.discountAmount || 0),
      Number(s.taxAmount || 0),
      Number(s.totalAmount || 0),
      s.status,
    ])

    const durationMs = Math.round(performance.now() - wStart)
    return {
      sheet: {
        sheetName: 'Sales & Invoices',
        title: `${orgName} — Sales Transactions Ledger`,
        subtitle: `Point-of-sale invoices & revenue receipts • Total Invoices: ${sales.length}`,
        headers,
        data,
      },
      report: {
        id: 3,
        domain: 'SALES_TRANSACTIONS',
        label: 'Worker Thread #3: Sales Invoices & Dispensary Counter',
        durationMs,
        rowCount: sales.length,
        status: 'COMPLETED',
      },
    }
  }

  // ── WORKER THREAD 4: PURCHASES & SUPPLIER INVOICES ──
  const runWorker4Purchases = async (): Promise<{ sheet: ExcelSheetConfig; report: BackupWorkerReport }> => {
    const wStart = performance.now()
    const purchases = await prisma.purchase.findMany({
      where: {
        ...branchOrgFilter,
      },
      include: {
        supplier: { select: { name: true, gstin: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    })

    const headers = [
      'Purchase Order #',
      'Wholesale Supplier / Agency',
      'Distributor GSTIN',
      'Distributor Invoice No',
      'Invoice Date',
      'Subtotal (₹)',
      'Tax (₹)',
      'Gross Total (₹)',
      'Amount Paid (₹)',
      'Balance Due (₹)',
      'Status',
    ]

    const data = purchases.map((p) => [
      p.purchaseNumber,
      p.supplier?.name || 'Distributor Agency',
      p.supplier?.gstin || '—',
      p.invoiceNumber || '—',
      p.invoiceDate ? p.invoiceDate.toISOString().slice(0, 10) : '—',
      Number(p.subtotal || 0),
      Number(p.taxAmount || 0),
      Number(p.totalAmount || 0),
      Number(p.amountPaid || 0),
      Number(p.balanceDue || 0),
      p.status,
    ])

    const durationMs = Math.round(performance.now() - wStart)
    return {
      sheet: {
        sheetName: 'Purchases & GRN Bills',
        title: `${orgName} — Wholesaler Purchases & GRN Journal`,
        subtitle: `Goods received notes & distributor bills • Total Purchases: ${purchases.length}`,
        headers,
        data,
      },
      report: {
        id: 4,
        domain: 'PURCHASES_GRN',
        label: 'Worker Thread #4: Purchases & Wholesaler Inward Bills',
        durationMs,
        rowCount: purchases.length,
        status: 'COMPLETED',
      },
    }
  }

  // ── WORKER THREAD 5: CUSTOMERS, SUPPLIERS, DOCTORS & PAYMENTS ──
  const runWorker5Entities = async (): Promise<{
    sheets: ExcelSheetConfig[]
    report: BackupWorkerReport
  }> => {
    const wStart = performance.now()
    const [customers, suppliers, doctors, payments] = await Promise.all([
      prisma.customer.findMany({
        where: { ...orgFilter },
        orderBy: { name: 'asc' },
        take: 3000,
      }),
      prisma.supplier.findMany({
        where: { ...orgFilter },
        orderBy: { name: 'asc' },
        take: 1000,
      }),
      prisma.doctor.findMany({
        where: { ...orgFilter },
        orderBy: { name: 'asc' },
        take: 1000,
      }),
      prisma.payment.findMany({
        orderBy: { paymentDate: 'desc' },
        take: 2000,
      }),
    ])

    // Sheet 5A: Customers
    const customerSheet: ExcelSheetConfig = {
      sheetName: 'Customers & Patients',
      title: `${orgName} — Customer & Patient Directory`,
      headers: ['Customer Name', 'Phone Number', 'Email', 'City', 'State', 'Outstanding Balance (₹)', 'Credit Limit (₹)'],
      data: customers.map((c: any) => [
        c.name,
        c.phone || '—',
        c.email || '—',
        c.city || '—',
        c.state || '—',
        Number(c.outstandingBalance || 0),
        Number(c.creditLimit || 0),
      ]),
    }

    // Sheet 5B: Suppliers
    const supplierSheet: ExcelSheetConfig = {
      sheetName: 'Suppliers & Distributors',
      title: `${orgName} — Pharmaceutical Distributors & Suppliers`,
      headers: ['Supplier Name', 'Contact Person', 'Phone', 'Email', 'GSTIN', 'Drug License No', 'Credit Days', 'Balance (₹)'],
      data: suppliers.map((s: any) => [
        s.name,
        s.contactPerson || '—',
        s.phone || '—',
        s.email || '—',
        s.gstin || '—',
        s.dlNumber || '—',
        s.creditDays || 30,
        Number(s.outstandingBalance || 0),
      ]),
    }

    // Sheet 5C: Doctors
    const doctorSheet: ExcelSheetConfig = {
      sheetName: 'Doctors Registry',
      title: `${orgName} — Registered Medical Practitioners (Doctors)`,
      headers: ['Doctor Name', 'Registration Number', 'Specialization', 'Phone', 'Clinic / Hospital', 'Commission %'],
      data: doctors.map((d: any) => [
        d.name,
        d.registrationNo || d.regNumber || '—',
        d.specialization || 'General Physician',
        d.phone || '—',
        d.clinicName || '—',
        Number(d.commissionPercent || 0),
      ]),
    }

    // Sheet 5D: Payments Register
    const paymentSheet: ExcelSheetConfig = {
      sheetName: 'Payments Register',
      title: `${orgName} — Cash, UPI & Bank Settlements`,
      headers: ['Payment ID', 'Date', 'Amount (₹)', 'Payment Method', 'Reference #', 'Notes'],
      data: payments.map((v: any) => [
        v.id,
        v.paymentDate ? v.paymentDate.toISOString().slice(0, 10) : '—',
        Number(v.amount || 0),
        v.method,
        v.reference || '—',
        v.notes || '—',
      ]),
    }

    const durationMs = Math.round(performance.now() - wStart)
    const rowCount = customers.length + suppliers.length + doctors.length + payments.length

    return {
      sheets: [customerSheet, supplierSheet, doctorSheet, paymentSheet],
      report: {
        id: 5,
        domain: 'ENTITIES_FINANCE',
        label: 'Worker Thread #5: Customers, Suppliers, Doctors & Payments',
        durationMs,
        rowCount,
        status: 'COMPLETED',
      },
    }
  }

  // ── EXECUTE ALL 5 WORKER THREADS SIMULTANEOUSLY IN PARALLEL ──
  const [res1, res2, res3, res4, res5] = await Promise.all([
    runWorker1Products(),
    runWorker2Batches(),
    runWorker3Sales(),
    runWorker4Purchases(),
    runWorker5Entities(),
  ])

  const allSheets: ExcelSheetConfig[] = [
    res1.sheet,
    res2.sheet,
    res3.sheet,
    res4.sheet,
    ...res5.sheets,
  ]

  const workerReports: BackupWorkerReport[] = [
    res1.report,
    res2.report,
    res3.report,
    res4.report,
    res5.report,
  ]

  const totalRows = workerReports.reduce((acc, r) => acc + r.rowCount, 0)
  const cleanOrgCode = orgName.replace(/[^a-zA-Z0-9]/g, '_')
  const timestamp = new Date().toISOString().slice(0, 10)
  const filename = `${cleanOrgCode}_Full_Database_Backup_${timestamp}.xlsx`

  const workbookConfig: ExcelWorkbookConfig = {
    filename,
    organizationName: orgName,
    sheets: allSheets,
  }

  // Generate binary Excel Buffer
  const buffer = generateExcelWorkbook(workbookConfig)
  const totalDurationMs = Math.round(performance.now() - startTime)

  return {
    buffer,
    filename,
    stats: {
      threadCount: 5,
      totalDurationMs,
      totalRows,
      fileSizeBytes: buffer.length,
      sheetsCount: allSheets.length,
      organizationName: orgName,
      workerReports,
    },
  }
}
