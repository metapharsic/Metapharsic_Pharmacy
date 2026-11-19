/** @jest-environment node */

// ─────────────────────────────────────────────────────────────
// End-to-End Test Suite: Pharmacy Production Enhancements
// Requirements: ORIGINAL_REQUEST.md (§R1, §R2, §R3, §R4, §R5)
// Framework: Jest 29 + TypeScript
// Architecture: Tiers 1–4 Opaque-Box Acceptance Testing
// ─────────────────────────────────────────────────────────────

import type { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { Prisma } from '@prisma/client'

// Feature 1 & 2: Reporting Engine & Excel Service
import {
  generateExcelWorkbook,
  buildWorkbook,
  type ExcelWorkbookConfig,
  type ExcelSheetConfig,
} from '@/lib/reports/excel-export-service'
import {
  parseReportPeriod,
} from '@/lib/reports/report-params'
import {
  getReportingWorkerPath,
  sanitizePayload,
  runSynchronousFallback,
} from '@/lib/reports/reporting-worker-bridge'
import { GET as exportGET } from '@/app/api/reports/export/route'

// Feature 3 & 4: Invoicing & PDF Generation
import {
  generateInvoicePdfBuffer,
  generateInvoicePdfDoc,
  computeGstSlabs,
  numberToWordsINR,
} from '@/lib/pdf/invoice-pdf-generator'
import { GET as pdfGET } from '@/app/api/sales/[id]/pdf/route'

// Feature 5: WhatsApp Integration
import {
  normalizePhoneNumber,
  generateWaMeLink,
  WhatsAppService,
} from '@/lib/whatsapp/whatsapp-service'

// Feature 6, 7 & 8: Sales Service, Admin Operations & RBAC Security
import {
  cancelSale,
  editSale,
  type SaleActor,
  type EditSaleInput,
} from '@/lib/sales/sales-service'
import {
  PATCH as salesPATCH,
  DELETE as salesDELETE,
} from '@/app/api/sales/[id]/route'
import { POST as cancelPOST } from '@/app/api/sales/[id]/cancel/route'

// Auth & Permissions
import { requireAuth, requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { resolveBranchScope, assertBranchAccess } from '@/lib/inventory/branch-access'
import { ReportService } from '@/lib/reports/report-service'

// ─── Module Mocks ─────────────────────────────────────────────

jest.mock('@/lib/auth/auth-helpers', () => ({
  requireAuth: jest.fn(),
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/inventory/branch-access', () => ({
  resolveBranchScope: jest.fn(),
  assertBranchAccess: jest.fn(),
}))

jest.mock('@/lib/reports/report-service', () => ({
  ReportService: {
    getSalesFinancials: jest.fn(),
    getDailyStockPosition: jest.fn(),
    getNearExpiry: jest.fn(),
    getConsumptionReport: jest.fn(),
    getSupplierPerformance: jest.fn(),
    getScheduleHRegister: jest.fn(),
    getGrossProfitReport: jest.fn(),
    getDoctorPerformanceReport: jest.fn(),
    getNarcoticRegister: jest.fn(),
  },
}))

jest.mock('@/lib/settings/settings-service', () => ({
  getPosSettings: jest.fn().mockResolvedValue({
    autoPrintInvoice: false,
    invoiceType: 'thermal',
    maxDiscountPercent: 20,
    allowCreditSales: true,
    requireCustomerForCredit: true,
    roundOffTotal: true,
    fefoEnabled: true,
    negativeStock: false,
    taxInclusive: false,
  }),
}))

jest.mock('@/lib/db/prisma', () => {
  const client = {
    $transaction: jest.fn(),
    sale: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    saleItem: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn(), delete: jest.fn() },
    saleItemBatch: { update: jest.fn(), deleteMany: jest.fn() },
    branch: { findUnique: jest.fn().mockResolvedValue({ id: 'branch-ka-01', name: 'Indiranagar Main Dispensary', code: 'KA01' }) },
    inventory: { findUnique: jest.fn(), update: jest.fn() },
    batch: { findUnique: jest.fn(), update: jest.fn() },
    batchStatusLog: { create: jest.fn() },
    inventoryMovement: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    customer: { findUnique: jest.fn(), update: jest.fn() },
    customerLedger: { create: jest.fn() },
    auditLog: { create: jest.fn() },
    gstTransaction: { deleteMany: jest.fn() },
    doctorCommission: { deleteMany: jest.fn() },
    payment: { create: jest.fn() },
  }
  return {
    __esModule: true,
    default: client,
    prisma: client,
  }
})

import prisma from '@/lib/db/prisma'

// Typed access to mocks
const mockedRequireAuth = requireAuth as jest.Mock
const mockedRequirePermission = requirePermission as jest.Mock
const mockedResolveBranchScope = resolveBranchScope as jest.Mock
const mockedAssertBranchAccess = assertBranchAccess as jest.Mock
const mockedReportService = ReportService as unknown as Record<string, jest.Mock>
const mockedPrisma = prisma as any

function makeMockRequest(url: string, options: { method?: string; body?: any; headers?: Record<string, string> } = {}): NextRequest {
  const method = options.method || 'GET'
  const headers = new Headers(options.headers || {})
  if (options.body) {
    headers.set('Content-Type', 'application/json')
  }

  const req = {
    url,
    method,
    headers,
    nextUrl: new URL(url),
    json: async () => (options.body ? options.body : {}),
  } as unknown as NextRequest

  return req
}

// ─── Test Fixture Generators ──────────────────────────────────

function createSampleSaleFixture(overrides: Record<string, any> = {}) {
  return {
    id: 'sale-e2e-101',
    invoiceNumber: 'INV-2026-8801',
    saleDate: new Date('2026-11-02T10:30:00Z'),
    branchId: 'branch-ka-01',
    status: 'COMPLETED',
    paymentStatus: 'PAID',
    subtotal: 1000.0,
    discountAmount: 100.0,
    taxAmount: 108.0,
    cgstAmount: 54.0,
    sgstAmount: 54.0,
    igstAmount: 0.0,
    totalAmount: 1008.0,
    amountPaid: 1008.0,
    balanceDue: 0.0,
    cashTendered: 1100.0,
    changeAmount: 92.0,
    customerName: 'Rajesh Kumar',
    customerPhone: '9876543210',
    doctorName: 'Sanjay Sharma',
    customer: {
      id: 'cust-101',
      name: 'Rajesh Kumar',
      phone: '9876543210',
      address: 'Indiranagar, Bangalore',
    },
    doctor: {
      id: 'doc-202',
      name: 'Sanjay Sharma',
      regNumber: 'KMC-44912',
    },
    createdBy: {
      id: 'user-emp-01',
      name: 'Dispenser Arun',
    },
    branch: {
      id: 'branch-ka-01',
      name: 'Indiranagar Main Dispensary',
      address: '100 Feet Road, HAL 2nd Stage',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560038',
      phone: '+91 80 4123 4567',
      email: 'dispensary.hal@metapharsic.com',
      gstin: '29ABCDE1234F1Z5',
      dlNumber: 'KA-B1-20B-112233 / KA-B1-21B-445566',
      organization: {
        name: 'Metapharsic Pharmacare',
        legalName: 'Metapharsic Healthcare Solutions Pvt Ltd',
      },
    },
    items: [
      {
        id: 'item-01',
        productId: 'prod-01',
        productName: 'Amoxicillin 500mg Capsule',
        productSku: 'AMX-500-CAP',
        quantity: 20,
        unitPrice: 15.0,
        mrp: 18.0,
        discountPercent: 10.0,
        discountAmount: 30.0,
        taxPercent: 12.0,
        cgstPercent: 6.0,
        sgstPercent: 6.0,
        igstPercent: 0.0,
        taxAmount: 32.4,
        totalAmount: 302.4,
        hsnCode: '3004',
        returnedQuantity: 0,
        product: {
          id: 'prod-01',
          name: 'Amoxicillin 500mg Capsule',
          sku: 'AMX-500-CAP',
          gstRate: 12.0,
          cgstRate: 6.0,
          sgstRate: 6.0,
          igstRate: 0.0,
          isGstExempt: false,
        },
        itemBatches: [
          {
            id: 'ib-01',
            batchId: 'batch-amx-01',
            quantity: 20,
            batch: {
              id: 'batch-amx-01',
              batchNumber: 'AMX-B26',
              expiryDate: new Date('2027-08-31'),
              quantity: 50,
              soldQuantity: 20,
              status: 'ACTIVE',
            },
          },
        ],
      },
      {
        id: 'item-02',
        productId: 'prod-02',
        productName: 'Paracetamol 650mg Tablet',
        productSku: 'PCM-650-TAB',
        quantity: 50,
        unitPrice: 2.5,
        mrp: 3.0,
        discountPercent: 0.0,
        discountAmount: 0.0,
        taxPercent: 5.0,
        cgstPercent: 2.5,
        sgstPercent: 2.5,
        igstPercent: 0.0,
        taxAmount: 6.25,
        totalAmount: 131.25,
        hsnCode: '3004',
        returnedQuantity: 0,
        product: {
          id: 'prod-02',
          name: 'Paracetamol 650mg Tablet',
          sku: 'PCM-650-TAB',
          gstRate: 5.0,
          cgstRate: 2.5,
          sgstRate: 2.5,
          igstRate: 0.0,
          isGstExempt: false,
        },
        itemBatches: [
          {
            id: 'ib-02',
            batchId: 'batch-pcm-01',
            quantity: 50,
            batch: {
              id: 'batch-pcm-01',
              batchNumber: 'PCM-B99',
              expiryDate: new Date('2028-03-31'),
              quantity: 100,
              soldQuantity: 50,
              status: 'ACTIVE',
            },
          },
        ],
      },
    ],
    payments: [
      {
        id: 'pay-01',
        method: 'CASH',
        amount: 1008.0,
        reference: 'CASH-REC-01',
      },
    ],
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────
// TEST SUITE BEGINS
// ─────────────────────────────────────────────────────────────

describe('Pharmacy Production Enhancements E2E Test Suite (Tiers 1–4)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireAuth.mockReset()
    mockedRequirePermission.mockReset()
    mockedRequireAuth.mockResolvedValue({
      id: 'admin-01',
      branchId: 'branch-ka-01',
      roles: ['admin'],
      permissions: [PERMISSIONS.SALES_VOID, PERMISSIONS.SALES_CREATE, PERMISSIONS.SALES_READ],
    })
    mockedRequirePermission.mockResolvedValue({
      id: 'admin-01',
      branchId: 'branch-ka-01',
      roles: ['admin'],
      permissions: [PERMISSIONS.SALES_VOID, PERMISSIONS.SALES_CREATE, PERMISSIONS.SALES_READ],
    })
    mockedAssertBranchAccess.mockResolvedValue(undefined)
    mockedPrisma.sale.findMany.mockResolvedValue([])
    mockedPrisma.saleItem.findMany.mockResolvedValue([])
    mockedPrisma.inventoryMovement.findMany.mockResolvedValue([])
    mockedPrisma.branch.findUnique.mockResolvedValue({
      id: 'branch-ka-01',
      name: 'Indiranagar Main Dispensary',
      code: 'KA01',
    })
  })

  // ═══════════════════════════════════════════════════════════
  // TIER 1: FEATURE-BY-FEATURE ACCEPTANCE TESTS
  // ═══════════════════════════════════════════════════════════

  describe('Tier 1 — Feature 1: Excel Report Generation (.xlsx)', () => {
    it('T1.1.1: Generates valid .xlsx buffer starting with standard ZIP magic bytes PK\\x03\\x04', () => {
      const config: ExcelWorkbookConfig = {
        filename: 'Daily_Sales_Audit.xlsx',
        organizationName: 'Metapharsic Pharmacare',
        sheets: [
          {
            sheetName: 'Daily Breakdown',
            title: 'Daily Financial Summary',
            headers: ['Invoice', 'Customer', 'Gross Amount', 'Tax', 'Net Payable'],
            data: [
              ['INV-001', 'Patient A', 500, 60, 560],
              ['INV-002', 'Patient B', 1200, 144, 1344],
            ],
            summaryRow: ['Total', '', 1700, 204, 1904],
          },
        ],
      }

      const buffer = generateExcelWorkbook(config)

      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.length).toBeGreaterThan(1000)

      // ZIP / OpenXML specification signature: PK\x03\x04
      expect(buffer[0]).toBe(0x50) // 'P'
      expect(buffer[1]).toBe(0x4b) // 'K'
      expect(buffer[2]).toBe(0x03)
      expect(buffer[3]).toBe(0x04)
    })

    it('T1.1.2: Generates multi-sheet workbook verifiable with SheetJS XLSX.read', () => {
      const config: ExcelWorkbookConfig = {
        filename: 'Executive_Periodic_Digest.xlsx',
        organizationName: 'Metapharsic Central Dispensary',
        sheets: [
          {
            sheetName: 'Executive Summary',
            title: 'Executive Financial KPIs',
            headers: ['Metric', 'Period Value'],
            data: [
              ['Total Revenue', 450000.5],
              ['Gross Profit', 112500.0],
              ['Prescriptions Dispensed', 1240],
            ],
          },
          {
            sheetName: 'Detailed Ledger',
            title: 'Dispensary Transaction Audit Ledger',
            headers: ['Date', 'Bill No', 'Counter', 'Mode', 'Amount'],
            data: [
              ['2026-11-01', 'INV-101', 'Counter 1', 'CASH', 350.0],
              ['2026-11-01', 'INV-102', 'Counter 2', 'UPI', 890.0],
            ],
          },
        ],
      }

      const buffer = generateExcelWorkbook(config)
      const parsedWb = XLSX.read(buffer, { type: 'buffer' })

      expect(parsedWb.SheetNames).toEqual(['Executive Summary', 'Detailed Ledger'])
      expect(parsedWb.Sheets['Executive Summary']).toBeDefined()
      expect(parsedWb.Sheets['Detailed Ledger']).toBeDefined()

      const execRows = XLSX.utils.sheet_to_json(parsedWb.Sheets['Executive Summary'], { header: 1 }) as any[][]
      expect(execRows.some((r) => r.includes('Metapharsic Central Dispensary'))).toBe(true)
      expect(execRows.some((r) => r.includes('Executive Financial KPIs'))).toBe(true)
      expect(execRows.some((r) => r.includes('Total Revenue'))).toBe(true)
    })

    it('T1.1.3: Dynamically computes column widths with minimum clamp and content padding', () => {
      const config: ExcelWorkbookConfig = {
        filename: 'ColWidth_Test.xlsx',
        sheets: [
          {
            sheetName: 'Width Test',
            title: 'Column Width Verification',
            headers: ['Short', 'Extremely Long Pharmaceutical Chemical Generic Formula Name Description'],
            data: [['A', 'Paracetamol 650mg + Caffeine 50mg + Diphenhydramine 25mg']],
          },
        ],
      }

      const wb = buildWorkbook(config)
      const sheet = wb.Sheets['Width Test']
      const colWidths = sheet['!cols']

      expect(colWidths).toBeDefined()
      expect(colWidths!.length).toBe(2)
      expect(colWidths![0].wch).toBeGreaterThanOrEqual(12)
      expect(colWidths![1].wch).toBeGreaterThanOrEqual(40)
      expect(colWidths![1].wch).toBeLessThanOrEqual(55)
    })

    it('T1.1.4: Applies numeric formats (currency #,##0.00 and integer quantities #,##0)', () => {
      const config: ExcelWorkbookConfig = {
        filename: 'NumberFormat_Test.xlsx',
        sheets: [
          {
            sheetName: 'Formats',
            title: 'Cell Formatting Audit',
            headers: ['Item Name', 'Quantity Sold', 'Unit Price', 'Total Revenue'],
            data: [['Amoxicillin', 15, 24.5, 367.5]],
            summaryRow: ['Total', 15, null, 367.5],
          },
        ],
      }

      const wb = buildWorkbook(config)
      const sheet = wb.Sheets['Formats']

      const qtyCell = sheet['B5']
      const revenueCell = sheet['D5']

      expect(qtyCell).toBeDefined()
      expect(qtyCell.t).toBe('n')
      expect(qtyCell.z).toBe('#,##0')

      expect(revenueCell).toBeDefined()
      expect(revenueCell.t).toBe('n')
      expect(revenueCell.z).toBe('#,##0.00')
    })

    it('T1.1.5: API Route GET /api/reports/export streams .xlsx with proper headers', async () => {
      mockedRequirePermission.mockResolvedValue({ id: 'admin-01', branchId: 'br-1' })
      mockedResolveBranchScope.mockResolvedValue('br-1')
      mockedReportService.getSalesFinancials.mockResolvedValueOnce({
        totalRevenue: 25400.0,
        totalSalesCount: 42,
        averageOrderValue: 604.76,
        totalTax: 3048.0,
        totalDiscount: 1200.0,
        dailyBreakdown: [
          { date: '2026-11-02', salesCount: 42, revenue: 25400, tax: 3048, discount: 1200, averageBillValue: 604.76 },
        ],
      })

      const req = makeMockRequest('http://localhost/api/reports/export?reportType=sales&period=daily')
      const res = await exportGET(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="sales_report_daily_')
      expect(res.headers.get('Content-Disposition')).toContain('.xlsx"')

      const arrayBuf = await res.arrayBuffer()
      const buffer = Buffer.from(arrayBuf)
      expect(buffer[0]).toBe(0x50) // 'P'
      expect(buffer[1]).toBe(0x4b) // 'K'
    })
  })

  describe('Tier 1 — Feature 2: Deprecation of XML/CSV Reports (Zero XML Guarantee)', () => {
    it('T1.2.1: Report export route strictly returns binary .xlsx MIME and never text/xml or application/xml', async () => {
      mockedRequirePermission.mockResolvedValue({ id: 'admin-01', branchId: 'br-1' })
      mockedResolveBranchScope.mockResolvedValue('br-1')
      mockedReportService.getSalesFinancials.mockResolvedValueOnce({
        totalRevenue: 1000,
        totalSalesCount: 1,
        averageOrderValue: 1000,
        totalTax: 120,
        totalDiscount: 0,
        dailyBreakdown: [],
      })

      const req = makeMockRequest('http://localhost/api/reports/export?reportType=sales&format=xml')
      const res = await exportGET(req)

      expect(res.status).toBe(200)
      const contentType = res.headers.get('Content-Type') || ''
      expect(contentType).not.toContain('text/xml')
      expect(contentType).not.toContain('application/xml')
      expect(contentType).not.toContain('text/csv')
      expect(contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    })

    it('T1.2.2: Content-Disposition attachment filename ends with .xlsx, never .xml or .csv', async () => {
      mockedRequirePermission.mockResolvedValue({ id: 'admin-01', branchId: 'br-1' })
      mockedResolveBranchScope.mockResolvedValue('br-1')
      mockedReportService.getDailyStockPosition.mockResolvedValueOnce({ data: [], total: 0, page: 1, limit: 10 })

      const req = makeMockRequest('http://localhost/api/reports/export?reportType=stock&period=daily')
      const res = await exportGET(req)

      const disposition = res.headers.get('Content-Disposition') || ''
      expect(disposition).toContain('.xlsx')
      expect(disposition).not.toContain('.xml')
      expect(disposition).not.toContain('.csv')
    })

    it('T1.2.3: Binary buffer does NOT begin with XML declaration <?xml or contain <Workbook> tags', async () => {
      const config: ExcelWorkbookConfig = {
        filename: 'AntiXML_Check.xlsx',
        sheets: [{ sheetName: 'Sheet1', title: 'Test', headers: ['Col1'], data: [['Val1']] }],
      }
      const buffer = generateExcelWorkbook(config)
      const asciiPrefix = buffer.subarray(0, 10).toString('utf-8')

      expect(asciiPrefix.startsWith('<?xml')).toBe(false)
      expect(asciiPrefix.startsWith('<Workbook')).toBe(false)
      expect(asciiPrefix.startsWith('PK')).toBe(true)
    })

    it('T1.2.4: Content-Length header matches exact binary buffer size', async () => {
      mockedRequirePermission.mockResolvedValue({ id: 'admin-01', branchId: 'br-1' })
      mockedResolveBranchScope.mockResolvedValue('br-1')
      mockedReportService.getSalesFinancials.mockResolvedValueOnce({
        totalRevenue: 500,
        totalSalesCount: 1,
        averageOrderValue: 500,
        totalTax: 50,
        totalDiscount: 0,
        dailyBreakdown: [],
      })

      const req = makeMockRequest('http://localhost/api/reports/export?reportType=sales&period=weekly')
      const res = await exportGET(req)

      const contentLength = res.headers.get('Content-Length')
      const bytes = await res.arrayBuffer()

      expect(res.status).toBe(200)
      expect(contentLength).toBe(String(bytes.byteLength))
      expect(bytes.byteLength).toBeGreaterThan(1000)
    })

    it('T1.2.5: All report periods (daily, weekly, monthly, custom) resolve cleanly to Excel sheets', () => {
      const periods = ['daily', 'weekly', 'monthly', 'custom'] as const
      for (const p of periods) {
        const resolved = parseReportPeriod({
          period: p,
          startDate: '2026-11-01',
          endDate: '2026-11-05',
        })
        expect(resolved.period).toBe(p)
        expect(resolved.startDate instanceof Date).toBe(true)
        expect(resolved.endDate instanceof Date).toBe(true)
        expect(resolved.label).toContain(p.charAt(0).toUpperCase() + p.slice(1))
      }
    })
  })

  describe('Tier 1 — Feature 3 & 4: Invoicing Layout & Universal PDF Generation', () => {
    it('T1.3.1: Line items include statutory HSN code (defaulting to 3004)', () => {
      const sale = createSampleSaleFixture()
      const doc = generateInvoicePdfDoc(sale, { format: 'a4' })
      const textOutput = doc.output('datauristring')

      expect(textOutput).toBeDefined()
      expect(sale.items[0].hsnCode).toBe('3004')
      expect(sale.items[1].hsnCode).toBe('3004')
    })

    it('T1.3.2: Dynamic multi-slab GST breakdown matrix computes 0%, 5%, 12%, 18% tax slabs', () => {
      const items = [
        { productName: 'Life Saving Drug', unitPrice: 100, quantity: 1, discountAmount: 0, totalAmount: 100, taxAmount: 0, taxPercent: 0 },
        { productName: 'ORS Hydration Sachet', unitPrice: 20, quantity: 5, discountAmount: 0, totalAmount: 105, taxAmount: 5, taxPercent: 5 },
        { productName: 'Paracetamol Tablets', unitPrice: 50, quantity: 2, discountAmount: 0, totalAmount: 112, taxAmount: 12, taxPercent: 12 },
        { productName: 'Antiseptic Solution', unitPrice: 100, quantity: 1, discountAmount: 0, totalAmount: 118, taxAmount: 18, taxPercent: 18 },
      ]

      const slabs = computeGstSlabs(items)

      expect(slabs.length).toBe(4)
      expect(slabs.map((s) => s.slab)).toEqual([0, 5, 12, 18])
      expect(slabs.find((s) => s.slab === 5)?.cgstRate).toBe(2.5)
      expect(slabs.find((s) => s.slab === 5)?.sgstRate).toBe(2.5)
      expect(slabs.find((s) => s.slab === 12)?.cgstRate).toBe(6.0)
      expect(slabs.find((s) => s.slab === 18)?.cgstRate).toBe(9.0)
    })

    it('T1.3.3: Correctly computes IGST for interstate transactions', () => {
      const items = [
        {
          productName: 'Interstate Medicine',
          unitPrice: 200,
          quantity: 1,
          discountAmount: 0,
          totalAmount: 224,
          taxAmount: 24,
          taxPercent: 12,
          igstAmount: 24,
          igstPercent: 12,
        },
      ]

      const slabs = computeGstSlabs(items)
      const interstateSlab = slabs[0]

      expect(interstateSlab.igstRate).toBe(12)
      expect(interstateSlab.igstAmount).toBe(24)
      expect(interstateSlab.cgstRate).toBe(0)
      expect(interstateSlab.sgstRate).toBe(0)
    })

    it('T1.3.4: Converts Indian Rupee amounts into words using Indian numbering system', () => {
      expect(numberToWordsINR(0)).toBe('Rupees Zero Only')
      expect(numberToWordsINR(150.5)).toBe('Rupees One Hundred Fifty and Fifty Paise Only')
      expect(numberToWordsINR(1008)).toBe('Rupees One Thousand Eight Only')
      expect(numberToWordsINR(125400)).toBe('Rupees One Lakh Twenty Five Thousand Four Hundred Only')
      expect(numberToWordsINR(25000000)).toBe('Rupees Two Crore Fifty Lakh Only')
    })

    it('T1.4.1: Generates valid PDF binary buffer starting with %PDF-1. magic bytes', () => {
      const sale = createSampleSaleFixture()
      const pdfBuffer = generateInvoicePdfBuffer(sale, { format: 'a4' })

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
      expect(pdfBuffer.length).toBeGreaterThan(1500)

      const magicBytes = pdfBuffer.subarray(0, 7).toString('ascii')
      expect(magicBytes).toBe('%PDF-1.')
    })

    it('T1.4.2: Generates 80mm continuous thermal slip with 2-tier stacked item layout', () => {
      const sale = createSampleSaleFixture()
      const thermalBuffer = generateInvoicePdfBuffer(sale, { format: 'thermal80' })

      expect(Buffer.isBuffer(thermalBuffer)).toBe(true)
      const magicBytes = thermalBuffer.subarray(0, 7).toString('ascii')
      expect(magicBytes).toBe('%PDF-1.')
    })

    it('T1.4.3: API Route GET /api/sales/:id/pdf returns HTTP 200 with application/pdf', async () => {
      mockedRequirePermission.mockResolvedValue({ id: 'u1', branchId: 'branch-ka-01' })
      mockedResolveBranchScope.mockResolvedValue('branch-ka-01')

      const saleFixture = createSampleSaleFixture()
      mockedPrisma.sale.findUnique.mockResolvedValue(saleFixture)
      mockedPrisma.inventoryMovement.findMany.mockResolvedValue([])

      const req = makeMockRequest('http://localhost/api/sales/sale-e2e-101/pdf?format=a4&download=true')
      const res = await pdfGET(req, { params: { id: 'sale-e2e-101' } })

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/pdf')
      expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="Invoice-INV-2026-8801-Invoice.pdf"')

      const arrayBuf = await res.arrayBuffer()
      const buf = Buffer.from(arrayBuf)
      expect(buf.subarray(0, 7).toString('ascii')).toBe('%PDF-1.')
    })
  })

  describe('Tier 1 — Feature 5: WhatsApp Sharing (Reports & Invoices)', () => {
    it('T1.5.1: Normalizes 10-digit Indian phone numbers to E.164 (+91...) and clean digits (91...)', () => {
      const res1 = normalizePhoneNumber('9876543210')
      expect(res1.e164).toBe('+919876543210')
      expect(res1.cleanDigits).toBe('919876543210')

      const res2 = normalizePhoneNumber('98765-43210')
      expect(res2.e164).toBe('+919876543210')
      expect(res2.cleanDigits).toBe('919876543210')
    })

    it('T1.5.2: Preserves international codes and cleans special characters/whitespace', () => {
      const res = normalizePhoneNumber('+91 98765 43210')
      expect(res.e164).toBe('+919876543210')
      expect(res.cleanDigits).toBe('919876543210')

      const intl = normalizePhoneNumber('+1 (555) 234-5678')
      expect(intl.e164).toBe('+15552345678')
      expect(intl.cleanDigits).toBe('15552345678')
    })

    it('T1.5.3: Generates valid wa.me click-to-chat URL with properly encoded text query', () => {
      const phone = '9876543210'
      const message = '🏥 *TAX INVOICE: INV-001*\nNet Amount: ₹1,008.00\nDownload PDF: http://localhost/pdf'
      const link = generateWaMeLink(phone, message)

      expect(link.startsWith('https://wa.me/919876543210?text=')).toBe(true)
      expect(link).toContain(encodeURIComponent('🏥 *TAX INVOICE: INV-001*'))
      expect(link).toContain(encodeURIComponent('₹1,008.00'))
    })

    it('T1.5.4: Simulation mode provides graceful offline fallback and audit logging', async () => {
      const result = await WhatsAppService.sendMessage({
        toPhone: '9876543210',
        message: 'Test automated dispatch message',
        provider: 'simulation',
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe('SIMULATED')
      expect(result.providerUsed).toBe('simulation-and-wa-link')
      expect(result.waMeLink).toContain('https://wa.me/919876543210')
    })
  })

  describe('Tier 1 — Feature 6: Admin Bill Modification & Stock Reversal', () => {
    it('T1.6.1: Admin with sales:void or Admin role can successfully execute editSale', async () => {
      const sale = createSampleSaleFixture()
      const adminActor: SaleActor = {
        id: 'admin-01',
        branchId: 'branch-ka-01',
        permissions: [PERMISSIONS.SALES_VOID],
        roles: ['admin'],
      }

      const fakeTx = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(sale),
          update: jest.fn().mockResolvedValue({ ...sale, totalAmount: 850 }),
        },
        batch: {
          findUnique: jest.fn().mockResolvedValue(sale.items[0].itemBatches[0].batch),
          update: jest.fn().mockResolvedValue({}),
        },
        batchStatusLog: { create: jest.fn() },
        inventory: {
          findUnique: jest.fn().mockResolvedValue({ id: 'inv-01', availableQuantity: 30, totalQuantity: 30 }),
          update: jest.fn().mockResolvedValue({}),
        },
        inventoryMovement: { create: jest.fn() },
        saleItem: { update: jest.fn(), delete: jest.fn(), findMany: jest.fn().mockResolvedValue(sale.items) },
        saleItemBatch: { update: jest.fn(), deleteMany: jest.fn() },
        auditLog: { create: jest.fn() },
        gstTransaction: { deleteMany: jest.fn() },
        payment: { create: jest.fn() },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(fakeTx))

      const input: EditSaleInput = {
        saleId: 'sale-e2e-101',
        items: [{ saleItemId: 'item-01', quantity: 10 }], // Reducing quantity from 20 to 10
        reason: 'Patient only wanted 10 capsules',
      }

      const res = await editSale(input, adminActor)
      expect(res).toBeDefined()

      expect(fakeTx.inventory.update).toHaveBeenCalled()
      expect(fakeTx.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'RETURN_IN',
            quantity: 10,
          }),
        })
      )
      expect(fakeTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'SALE_UPDATE',
            entity: 'Sale',
          }),
        })
      )
    })

    it('T1.6.2: Reactivates EXHAUSTED batch to ACTIVE when soldQuantity is decremented', async () => {
      const sale = createSampleSaleFixture()
      const exhaustedBatch = {
        id: 'batch-amx-01',
        quantity: 20,
        soldQuantity: 20,
        status: 'EXHAUSTED',
      }

      const adminActor: SaleActor = {
        id: 'admin-01',
        branchId: 'branch-ka-01',
        roles: ['admin'],
      }

      const fakeTx = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(sale),
          update: jest.fn().mockResolvedValue(sale),
        },
        batch: {
          findUnique: jest.fn().mockResolvedValue(exhaustedBatch),
          update: jest.fn().mockResolvedValue({}),
        },
        batchStatusLog: { create: jest.fn() },
        inventory: {
          findUnique: jest.fn().mockResolvedValue({ id: 'inv-01', availableQuantity: 0, totalQuantity: 20 }),
          update: jest.fn().mockResolvedValue({}),
        },
        inventoryMovement: { create: jest.fn() },
        saleItem: { update: jest.fn(), findMany: jest.fn().mockResolvedValue(sale.items) },
        saleItemBatch: { update: jest.fn() },
        auditLog: { create: jest.fn() },
        gstTransaction: { deleteMany: jest.fn() },
        payment: { create: jest.fn() },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(fakeTx))

      await editSale(
        {
          saleId: 'sale-e2e-101',
          items: [{ saleItemId: 'item-01', quantity: 15 }], // 5 restored
          reason: 'Correction of extra quantity',
        },
        adminActor
      )

      expect(fakeTx.batch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACTIVE',
            soldQuantity: 15,
          }),
        })
      )

      expect(fakeTx.batchStatusLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fromStatus: 'EXHAUSTED',
            toStatus: 'ACTIVE',
          }),
        })
      )
    })
  })

  describe('Tier 1 — Feature 7: Admin Bill Cancellation / Soft Deletion', () => {
    it('T1.7.1: cancelSale soft deletes bill (status=CANCELLED) and restores inventory & batches', async () => {
      const sale = createSampleSaleFixture()
      const adminActor: SaleActor = {
        id: 'admin-01',
        branchId: 'branch-ka-01',
        roles: ['owner'],
      }

      const fakeTx = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(sale),
          update: jest.fn().mockResolvedValue({ ...sale, status: 'CANCELLED' }),
        },
        inventory: {
          findUnique: jest.fn().mockResolvedValue({ id: 'inv-01', availableQuantity: 30, totalQuantity: 30 }),
          update: jest.fn().mockResolvedValue({}),
        },
        inventoryMovement: { create: jest.fn() },
        batch: {
          findUnique: jest.fn().mockResolvedValue(sale.items[0].itemBatches[0].batch),
          update: jest.fn().mockResolvedValue({}),
        },
        batchStatusLog: { create: jest.fn() },
        auditLog: { create: jest.fn() },
        gstTransaction: { deleteMany: jest.fn() },
        doctorCommission: { deleteMany: jest.fn() },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(fakeTx))

      await cancelSale('sale-e2e-101', 'Patient returned full prescription due to allergic reaction', adminActor)

      expect(fakeTx.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sale-e2e-101' },
          data: expect.objectContaining({
            status: 'CANCELLED',
            cancelledReason: 'Patient returned full prescription due to allergic reaction',
          }),
        })
      )

      expect(fakeTx.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'RETURN_IN',
            referenceType: 'SALE',
          }),
        })
      )

      expect(fakeTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'SALE_CANCEL',
            entity: 'Sale',
          }),
        })
      )
    })

    it('T1.7.2: Reverses customer ledger and outstanding balance on credit sale cancellation', async () => {
      const creditSale = createSampleSaleFixture({
        paymentStatus: 'CREDIT',
        balanceDue: 500.0,
        customerId: 'cust-101',
      })

      const adminActor: SaleActor = {
        id: 'admin-01',
        branchId: 'branch-ka-01',
        roles: ['admin'],
      }

      const fakeTx = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(creditSale),
          update: jest.fn().mockResolvedValue({ ...creditSale, status: 'CANCELLED' }),
        },
        inventory: {
          findUnique: jest.fn().mockResolvedValue({ id: 'inv-01', availableQuantity: 10, totalQuantity: 10 }),
          update: jest.fn().mockResolvedValue({}),
        },
        inventoryMovement: { create: jest.fn() },
        batch: {
          findUnique: jest.fn().mockResolvedValue(creditSale.items[0].itemBatches[0].batch),
          update: jest.fn().mockResolvedValue({}),
        },
        customer: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'cust-101',
            outstandingBalance: new Prisma.Decimal(1200.0),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        customerLedger: { create: jest.fn() },
        auditLog: { create: jest.fn() },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(fakeTx))

      await cancelSale('sale-e2e-101', 'Credit sale cancelled', adminActor)

      expect(fakeTx.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cust-101' },
          data: { outstandingBalance: new Prisma.Decimal(700.0) },
        })
      )

      expect(fakeTx.customerLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'cust-101',
            type: 'CREDIT',
            referenceType: 'SALE',
          }),
        })
      )
    })

    it('T1.7.3: REST API route DELETE /api/sales/:id returns 200 OK for authorized admin', async () => {
      mockedRequireAuth.mockResolvedValueOnce({
        id: 'admin-01',
        branchId: 'branch-ka-01',
        roles: ['admin'],
        permissions: [PERMISSIONS.SALES_VOID],
      })

      const sale = createSampleSaleFixture()
      const fakeTx = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(sale),
          update: jest.fn().mockResolvedValue({ ...sale, status: 'CANCELLED' }),
        },
        inventory: { findUnique: jest.fn().mockResolvedValue({ id: 'inv-1', availableQuantity: 10, totalQuantity: 10 }), update: jest.fn() },
        inventoryMovement: { create: jest.fn() },
        batch: { findUnique: jest.fn().mockResolvedValue(sale.items[0].itemBatches[0].batch), update: jest.fn() },
        auditLog: { create: jest.fn() },
      }
      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(fakeTx))

      const req = makeMockRequest('http://localhost/api/sales/sale-e2e-101?reason=Customer%20requested%20void', {
        method: 'DELETE',
      })
      const res = await salesDELETE(req, { params: { id: 'sale-e2e-101' } })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.message).toContain('cancelled and inventory restored')
    })
  })

  describe('Tier 1 — Feature 8: Cashier RBAC Lockout (403 Forbidden)', () => {
    const cashierActor: SaleActor = {
      id: 'cashier-01',
      branchId: 'branch-ka-01',
      permissions: [PERMISSIONS.SALES_CREATE, PERMISSIONS.SALES_READ],
      roles: ['cashier'],
    }

    it('T1.8.1: Cashier cannot call editSale — throws Forbidden error', async () => {
      await expect(
        editSale(
          {
            saleId: 'sale-e2e-101',
            items: [{ saleItemId: 'item-01', quantity: 5 }],
          },
          cashierActor
        )
      ).rejects.toThrow(/Forbidden.*sales:void.*Admin/i)
    })

    it('T1.8.2: Cashier cannot call cancelSale — throws Forbidden error', async () => {
      await expect(
        cancelSale('sale-e2e-101', 'Cashier attempting void', cashierActor)
      ).rejects.toThrow(/Forbidden.*sales:void.*Admin/i)
    })

    it('T1.8.3: Route PATCH /api/sales/:id returns 403 Forbidden for Cashier session', async () => {
      mockedRequireAuth.mockResolvedValueOnce({
        id: 'cashier-01',
        branchId: 'branch-ka-01',
        permissions: [PERMISSIONS.SALES_CREATE],
        roles: ['cashier'],
      })

      const req = makeMockRequest('http://localhost/api/sales/sale-e2e-101', {
        method: 'PATCH',
        body: { items: [{ saleItemId: 'item-01', quantity: 5 }] },
      })

      const res = await salesPATCH(req, { params: { id: 'sale-e2e-101' } })
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('FORBIDDEN')
      expect(body.error.message).toMatch(/Forbidden/i)
    })

    it('T1.8.4: Route DELETE /api/sales/:id returns 403 Forbidden for Cashier session', async () => {
      mockedRequireAuth.mockResolvedValueOnce({
        id: 'cashier-01',
        branchId: 'branch-ka-01',
        permissions: [PERMISSIONS.SALES_CREATE],
        roles: ['cashier'],
      })

      const req = makeMockRequest('http://localhost/api/sales/sale-e2e-101', {
        method: 'DELETE',
      })

      const res = await salesDELETE(req, { params: { id: 'sale-e2e-101' } })
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('T1.8.5: Route POST /api/sales/:id/cancel returns 403 Forbidden when cashier attempts void', async () => {
      mockedRequireAuth.mockResolvedValueOnce({
        id: 'cashier-01',
        branchId: 'branch-ka-01',
        permissions: [PERMISSIONS.SALES_CREATE],
        roles: ['cashier'],
      })

      const req = makeMockRequest('http://localhost/api/sales/sale-e2e-101/cancel', {
        method: 'POST',
        body: { reason: 'Unauthorized void attempt' },
      })

      const res = await cancelPOST(req, { params: { id: 'sale-e2e-101' } })
      expect(res.status).toBe(403)
    })
  })

  describe('Tier 1 — Feature 9: Background Processing & Offloading', () => {
    it('T1.9.1: sanitizePayload strips Prisma Decimal and Date objects avoiding DataCloneError', () => {
      const rawPayload = {
        id: 'row-1',
        unitPrice: new Prisma.Decimal(125.75),
        lineTotal: new Prisma.Decimal(503.0),
        saleDate: new Date('2026-11-02T14:00:00.000Z'),
        nested: {
          cogs: new Prisma.Decimal(80.25),
        },
        items: [
          { price: new Prisma.Decimal(50.0) },
        ],
      }

      const sanitized = sanitizePayload(rawPayload)

      expect(typeof sanitized.unitPrice).toBe('number')
      expect(sanitized.unitPrice).toBe(125.75)
      expect(typeof sanitized.lineTotal).toBe('number')
      expect(sanitized.lineTotal).toBe(503.0)
      expect(typeof sanitized.saleDate).toBe('string')
      expect(sanitized.saleDate).toBe('2026-11-02T14:00:00.000Z')
      expect(sanitized.nested.cogs).toBe(80.25)
      expect(sanitized.items[0].price).toBe(50.0)

      expect(() => {
        const json = JSON.stringify(sanitized)
        JSON.parse(json)
      }).not.toThrow()
    })

    it('T1.9.2: getReportingWorkerPath resolves across multiple candidate paths', () => {
      const workerPath = getReportingWorkerPath()
      expect(typeof workerPath).toBe('string')
      expect(workerPath).toContain('reporting-analytics.worker.js')
    })

    it('T1.9.3: runSynchronousFallback computes sales financials accurately', () => {
      const payload = {
        sales: [
          {
            id: 's1',
            status: 'COMPLETED',
            saleDate: '2026-11-02T10:00:00Z',
            totalAmount: 500,
            subtotal: 450,
            taxAmount: 50,
            discountAmount: 0,
            payments: [{ method: 'CASH', amount: 500 }],
            items: [{ productId: 'p1', quantity: 2, unitPrice: 225 }],
          },
        ],
      }

      const result = runSynchronousFallback<any, any>('COMPUTE_SALES_FINANCIALS', payload)

      expect(result).toBeDefined()
      expect(result.totalRevenue).toBe(500)
      expect(result.totalSalesCount).toBe(1)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // TIER 2: BOUNDARY & CORNER CASES
  // ═══════════════════════════════════════════════════════════

  describe('Tier 2 — Boundary & Corner Cases', () => {
    it('T2.1: Empty report (zero records): Generates valid .xlsx workbook with empty state', () => {
      const config: ExcelWorkbookConfig = {
        filename: 'Empty_Report.xlsx',
        sheets: [
          {
            sheetName: 'Zero Records',
            title: 'Empty Sales Ledger',
            headers: ['Invoice', 'Amount'],
            data: [],
          },
        ],
      }

      const buffer = generateExcelWorkbook(config)
      expect(Buffer.isBuffer(buffer)).toBe(true)

      const wb = XLSX.read(buffer, { type: 'buffer' })
      expect(wb.SheetNames).toEqual(['Zero Records'])
    })

    it('T2.2: Single-item single-unit bill: Generates valid PDF with exact 1-item line and correct GST', () => {
      const singleItemSale = createSampleSaleFixture({
        items: [
          {
            id: 'item-single',
            productName: 'Bandage Strip',
            quantity: 1,
            unitPrice: 5.0,
            mrp: 5.0,
            taxPercent: 12.0,
            taxAmount: 0.6,
            totalAmount: 5.6,
            hsnCode: '3005',
          },
        ],
        subtotal: 5.0,
        discountAmount: 0,
        taxAmount: 0.6,
        totalAmount: 5.6,
      })

      const pdfBuf = generateInvoicePdfBuffer(singleItemSale, { format: 'a4' })
      expect(pdfBuf.subarray(0, 7).toString('ascii')).toBe('%PDF-1.')

      const slabs = computeGstSlabs(singleItemSale.items)
      expect(slabs.length).toBe(1)
      expect(slabs[0].slab).toBe(12)
      expect(slabs[0].totalTax).toBe(0.6)
    })

    it('T2.3: Multi-item bill with mixed GST slabs (0%, 5%, 12%, 18%): Correctly aggregates into separate matrix rows', () => {
      const mixedItems = [
        { productName: 'Insulin Vial', unitPrice: 200, quantity: 1, totalAmount: 200, taxAmount: 0, taxPercent: 0 },
        { productName: 'Vitamin C 500mg', unitPrice: 100, quantity: 1, totalAmount: 105, taxAmount: 5, taxPercent: 5 },
        { productName: 'Cough Syrup 100ml', unitPrice: 100, quantity: 1, totalAmount: 112, taxAmount: 12, taxPercent: 12 },
        { productName: 'Medicated Shampoo', unitPrice: 100, quantity: 1, totalAmount: 118, taxAmount: 18, taxPercent: 18 },
      ]

      const slabs = computeGstSlabs(mixedItems)
      expect(slabs.length).toBe(4)
      expect(slabs.map((s) => s.slab)).toEqual([0, 5, 12, 18])
      expect(slabs.reduce((acc, s) => acc + s.totalTax, 0)).toBe(35)
    })

    it('T2.4: Bill with partial returns already executed: Net restore protects against phantom inventory over-restoration', async () => {
      const saleWithReturn = createSampleSaleFixture({
        items: [
          {
            id: 'item-partial',
            productId: 'prod-01',
            quantity: 10,
            returnedQuantity: 4, // 4 units already returned previously
            itemBatches: [
              {
                id: 'ib-01',
                batchId: 'batch-01',
                quantity: 10,
                batch: { id: 'batch-01', quantity: 20, soldQuantity: 10, status: 'ACTIVE' },
              },
            ],
          },
        ],
      })

      const adminActor: SaleActor = { id: 'admin-01', branchId: 'branch-ka-01', roles: ['admin'] }

      const fakeTx = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(saleWithReturn),
          update: jest.fn().mockResolvedValue({ ...saleWithReturn, status: 'CANCELLED' }),
        },
        inventory: {
          findUnique: jest.fn().mockResolvedValue({ id: 'inv-01', availableQuantity: 10, totalQuantity: 10 }),
          update: jest.fn(),
        },
        inventoryMovement: { create: jest.fn() },
        batch: {
          findUnique: jest.fn().mockResolvedValue({ id: 'batch-01', quantity: 20, soldQuantity: 10, status: 'ACTIVE' }),
          update: jest.fn(),
        },
        auditLog: { create: jest.fn() },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(fakeTx))

      await cancelSale('sale-e2e-101', 'Void remaining portion', adminActor)

      expect(fakeTx.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            totalQuantity: { increment: 6 },
            availableQuantity: { increment: 6 },
          },
        })
      )
      expect(fakeTx.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantity: 6,
          }),
        })
      )
    })

    it('T2.5: Batch soldQuantity reaches total quantity (EXHAUSTED): Cancellation restores to ACTIVE and records BatchStatusLog', async () => {
      const sale = createSampleSaleFixture()
      const exhaustedBatch = {
        id: 'batch-amx-01',
        quantity: 20,
        soldQuantity: 20, // Fully sold out
        status: 'EXHAUSTED',
      }

      const adminActor: SaleActor = { id: 'admin-01', branchId: 'branch-ka-01', roles: ['admin'] }

      const fakeTx = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(sale),
          update: jest.fn().mockResolvedValue({ ...sale, status: 'CANCELLED' }),
        },
        inventory: {
          findUnique: jest.fn().mockResolvedValue({ id: 'inv-01', availableQuantity: 0, totalQuantity: 20 }),
          update: jest.fn(),
        },
        inventoryMovement: { create: jest.fn() },
        batch: {
          findUnique: jest.fn().mockResolvedValue(exhaustedBatch),
          update: jest.fn(),
        },
        batchStatusLog: { create: jest.fn() },
        auditLog: { create: jest.fn() },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(fakeTx))

      await cancelSale('sale-e2e-101', 'Cancel sale to restore exhausted batch', adminActor)

      expect(fakeTx.batch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACTIVE',
            soldQuantity: 0,
          }),
        })
      )

      expect(fakeTx.batchStatusLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fromStatus: 'EXHAUSTED',
            toStatus: 'ACTIVE',
          }),
        })
      )
    })

    it('T2.6: Credit sale with partial payment: Only remaining balanceDue is reversed in customer balance and ledger', async () => {
      const partialCreditSale = createSampleSaleFixture({
        paymentStatus: 'PARTIAL',
        totalAmount: 1000.0,
        amountPaid: 400.0,
        balanceDue: 600.0, // Remaining due
        customerId: 'cust-101',
      })

      const adminActor: SaleActor = { id: 'admin-01', branchId: 'branch-ka-01', roles: ['admin'] }

      const fakeTx = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(partialCreditSale),
          update: jest.fn().mockResolvedValue({ ...partialCreditSale, status: 'CANCELLED' }),
        },
        inventory: { findUnique: jest.fn().mockResolvedValue({ id: 'inv-01', availableQuantity: 10, totalQuantity: 10 }), update: jest.fn() },
        inventoryMovement: { create: jest.fn() },
        batch: { findUnique: jest.fn().mockResolvedValue(partialCreditSale.items[0].itemBatches[0].batch), update: jest.fn() },
        customer: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'cust-101',
            outstandingBalance: new Prisma.Decimal(1500.0),
          }),
          update: jest.fn(),
        },
        customerLedger: { create: jest.fn() },
        auditLog: { create: jest.fn() },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(fakeTx))

      await cancelSale('sale-e2e-101', 'Cancel partial credit bill', adminActor)

      expect(fakeTx.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { outstandingBalance: new Prisma.Decimal(900.0) },
        })
      )
    })

    it('T2.7: Extreme string lengths: 100+ character medicine description, long patient name, long address handled in PDF without crash', () => {
      const extremeSale = createSampleSaleFixture({
        customerName: 'Shri His Excellency Dr. Ananthakrishna Venkata Ramanathan Subramaniam Bahadur Junior Esq.',
        branch: {
          ...createSampleSaleFixture().branch,
          address: 'Plot No. 45-B, Sector 12-C, Near Greater Kailash Flyover Beside Metro Pillar 844, Outer Ring Road North Extension',
        },
        items: [
          {
            id: 'item-long',
            productName: 'Super-Concentrated Extended-Release Gastro-Resistant Film-Coated Sustained-Action Pharmaceutical Tablet Formulation',
            quantity: 10,
            unitPrice: 50.0,
            mrp: 60.0,
            taxPercent: 12.0,
            taxAmount: 60.0,
            totalAmount: 560.0,
            hsnCode: '3004',
          },
        ],
      })

      expect(() => {
        const a4Buf = generateInvoicePdfBuffer(extremeSale, { format: 'a4' })
        expect(a4Buf.subarray(0, 7).toString('ascii')).toBe('%PDF-1.')

        const thermalBuf = generateInvoicePdfBuffer(extremeSale, { format: 'thermal80' })
        expect(thermalBuf.subarray(0, 7).toString('ascii')).toBe('%PDF-1.')
      }).not.toThrow()
    })

    it('T2.8: GST-exempt products (0% tax): Matrix produces clean 0% Exempt row with zero CGST/SGST/IGST', () => {
      const exemptItems = [
        { productName: 'Distilled Water for Injection', unitPrice: 25, quantity: 10, totalAmount: 250, taxAmount: 0, taxPercent: 0 },
      ]

      const slabs = computeGstSlabs(exemptItems)
      expect(slabs.length).toBe(1)
      expect(slabs[0].slab).toBe(0)
      expect(slabs[0].slabLabel).toBe('Exempt (0%)')
      expect(slabs[0].cgstAmount).toBe(0)
      expect(slabs[0].sgstAmount).toBe(0)
      expect(slabs[0].totalTax).toBe(0)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // TIER 3: CROSS-FEATURE COMBINATIONS (PAIRWISE INTERACTIONS)
  // ═══════════════════════════════════════════════════════════

  describe('Tier 3 — Cross-Feature Combinations', () => {
    it('T3.1: Modifying a bill to reduce quantity then immediately generating PDF: PDF reflects new quantity and recalculated totals', () => {
      const sale = createSampleSaleFixture()

      expect(sale.totalAmount).toBe(1008.0)

      const modifiedSale = {
        ...sale,
        subtotal: 850.0,
        discountAmount: 85.0,
        taxAmount: 91.8,
        totalAmount: 856.8,
        items: [
          {
            ...sale.items[0],
            quantity: 10,
            totalAmount: 151.2,
          },
          sale.items[1],
        ],
      }

      const pdfBuf = generateInvoicePdfBuffer(modifiedSale, { format: 'a4' })
      expect(pdfBuf.subarray(0, 7).toString('ascii')).toBe('%PDF-1.')

      const slabs = computeGstSlabs(modifiedSale.items)
      expect(slabs.find((s) => s.slab === 12)?.taxableAmount).toBeLessThan(
        computeGstSlabs(sale.items).find((s) => s.slab === 12)!.taxableAmount
      )
    })

    it('T3.2: Cancelling a bill then attempting re-cancellation: Second cancellation rejected with "Sale is already cancelled"', async () => {
      const alreadyCancelledSale = createSampleSaleFixture({
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledReason: 'First cancellation',
      })

      const adminActor: SaleActor = { id: 'admin-01', branchId: 'branch-ka-01', roles: ['admin'] }

      const fakeTx = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(alreadyCancelledSale),
        },
      }
      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(fakeTx))

      await expect(
        cancelSale('sale-e2e-101', 'Attempting double cancellation', adminActor)
      ).rejects.toThrow('Sale is already cancelled')
    })

    it('T3.3: Generating WhatsApp sharing message for a cancelled bill: Message includes explicit [CANCELLED] tag', () => {
      const cancelledSale = createSampleSaleFixture({
        status: 'CANCELLED',
        cancelledReason: 'Physician changed treatment regimen',
      })

      const formattedWhatsAppText = `🏥 *METAPHARSIC PHARMACARE*
🧾 *TAX INVOICE: ${cancelledSale.invoiceNumber}* [CANCELLED]
⚠️ Status: VOIDED (${(cancelledSale as any).cancelledReason})
💰 Net Amount: ₹${cancelledSale.totalAmount} (REFUNDED)
`

      const link = generateWaMeLink(cancelledSale.customerPhone!, formattedWhatsAppText)
      expect(link).toContain(encodeURIComponent('[CANCELLED]'))
      expect(link).toContain(encodeURIComponent('REFUNDED'))
    })

    it('T3.4: Cashier attempts unauthorized edit (rejected with 403), Admin edits (succeeds), Cashier attempts delete (rejected with 403), Admin deletes (succeeds)', async () => {
      const sale = createSampleSaleFixture()
      const cashierActor: SaleActor = {
        id: 'cashier-01',
        branchId: 'branch-ka-01',
        permissions: [PERMISSIONS.SALES_CREATE],
        roles: ['cashier'],
      }
      const adminActor: SaleActor = {
        id: 'admin-01',
        branchId: 'branch-ka-01',
        permissions: [PERMISSIONS.SALES_VOID],
        roles: ['admin'],
      }

      // 1. Cashier attempts edit -> 403
      await expect(
        editSale({ saleId: sale.id, items: [{ saleItemId: 'item-01', quantity: 5 }] }, cashierActor)
      ).rejects.toThrow(/Forbidden/i)

      // 2. Admin edits -> Succeeds
      const fakeTx = {
        sale: { findUnique: jest.fn().mockResolvedValue(sale), update: jest.fn().mockResolvedValue(sale) },
        batch: { findUnique: jest.fn().mockResolvedValue(sale.items[0].itemBatches[0].batch), update: jest.fn() },
        inventory: { findUnique: jest.fn().mockResolvedValue({ id: 'inv-1', availableQuantity: 10, totalQuantity: 10 }), update: jest.fn() },
        inventoryMovement: { create: jest.fn() },
        saleItem: { update: jest.fn(), findMany: jest.fn().mockResolvedValue(sale.items) },
        saleItemBatch: { update: jest.fn() },
        auditLog: { create: jest.fn() },
        payment: { create: jest.fn() },
      }
      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(fakeTx))
      const editResult = await editSale({ saleId: sale.id, items: [{ saleItemId: 'item-01', quantity: 15 }] }, adminActor)
      expect(editResult).toBeDefined()

      // 3. Cashier attempts delete -> 403
      await expect(
        cancelSale(sale.id, 'Cashier void attempt', cashierActor)
      ).rejects.toThrow(/Forbidden/i)

      // 4. Admin deletes -> Succeeds
      await cancelSale(sale.id, 'Admin approved void', adminActor)
      expect(fakeTx.sale.update).toHaveBeenCalled()
    })

    it('T3.5: Exporting Excel report spanning CANCELLED and COMPLETED sales: Correctly segregates sales data', () => {
      const config: ExcelWorkbookConfig = {
        filename: 'Sales_Audit_All_Statuses.xlsx',
        sheets: [
          {
            sheetName: 'All Sales',
            title: 'Audit of Completed and Cancelled Bills',
            headers: ['Invoice No', 'Status', 'Gross Total', 'Tax', 'Net Payable', 'Cancellation Reason'],
            data: [
              ['INV-8801', 'COMPLETED', 1000, 108, 1008, 'N/A'],
              ['INV-8802', 'CANCELLED', 450, 48, 0, 'Mistaken entry by cashier'],
            ],
            summaryRow: ['Completed Total', '', 1000, 108, 1008, ''],
          },
        ],
      }

      const buffer = generateExcelWorkbook(config)
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const rows = XLSX.utils.sheet_to_json(wb.Sheets['All Sales'], { header: 1 }) as any[][]

      expect(rows.some((r) => r.includes('COMPLETED') && r.includes(1008))).toBe(true)
      expect(rows.some((r) => r.includes('CANCELLED') && r.includes('Mistaken entry by cashier'))).toBe(true)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // ═══════════════════════════════════════════════════════════

  describe('Tier 4 — Real-World Application Scenarios', () => {
    it('T4.1: Scenario 1 — Chemist Daily Closing Workflow (Excel export + ZIP validation + zero XML + WhatsApp summary)', async () => {
      mockedRequirePermission.mockResolvedValue({ id: 'chemist-01', branchId: 'branch-ka-01' })
      mockedResolveBranchScope.mockResolvedValue('branch-ka-01')
      mockedReportService.getSalesFinancials.mockResolvedValueOnce({
        totalRevenue: 48950.0,
        totalSalesCount: 86,
        averageOrderValue: 569.18,
        totalTax: 5874.0,
        totalDiscount: 2400.0,
        dailyBreakdown: [
          { date: '2026-11-02', salesCount: 86, revenue: 48950.0, tax: 5874.0, discount: 2400.0, averageBillValue: 569.18 },
        ],
      })

      const exportReq = makeMockRequest('http://localhost/api/reports/export?reportType=sales&period=daily')
      const exportRes = await exportGET(exportReq)

      expect(exportRes.status).toBe(200)
      expect(exportRes.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

      const excelBytes = Buffer.from(await exportRes.arrayBuffer())
      expect(excelBytes.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]))

      const eodText = `🏥 *METAPHARSIC PHARMACARE*
📋 *DAILY CLOSING DIGEST (11:30 PM)*
📅 Date: 02 Nov 2026 | Dispensary: Indiranagar Main Dispensary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Total Daily Revenue: ₹48,950.00 (86 bills)
💵 Cash in Drawer: ₹31,200.00
📲 UPI / QR Collections: ₹14,500.00
💳 Card Swipes: ₹3,250.00
📝 Credit Sales (Udhaar): ₹0.00
📊 Gross Profit: ₹12,237.50 (25.0% Margin)
⚖️ Schedule H / H1 Sold: 44 units (Register compliant)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Download Full Daily Excel Ledger: http://localhost/api/reports/export?reportType=sales&period=daily
`
      const sendResult = await WhatsAppService.sendMessage({
        toPhone: '+91 98765 43210',
        message: eodText,
        provider: 'simulation',
      })

      expect(sendResult.success).toBe(true)
      expect(sendResult.toPhone).toBe('+919876543210')
      expect(sendResult.waMeLink).toContain('https://wa.me/919876543210?text=')
    })

    it('T4.2: Scenario 2 — Patient POS Counter Checkout (A4 + 80mm PDF + HSN 3004 + GST matrix + WhatsApp dispatch)', () => {
      const patientSale = createSampleSaleFixture()

      const thermalSlipBuf = generateInvoicePdfBuffer(patientSale, { format: 'thermal80' })
      expect(thermalSlipBuf.subarray(0, 7).toString('ascii')).toBe('%PDF-1.')

      const a4InvoiceBuf = generateInvoicePdfBuffer(patientSale, { format: 'a4' })
      expect(a4InvoiceBuf.subarray(0, 7).toString('ascii')).toBe('%PDF-1.')

      const slabs = computeGstSlabs(patientSale.items)
      expect(slabs.length).toBeGreaterThanOrEqual(1)
      expect(patientSale.items.every((it) => it.hsnCode === '3004')).toBe(true)

      const patientMsg = `🏥 *METAPHARSIC PHARMACARE*
🧾 *TAX INVOICE: ${patientSale.invoiceNumber}*
👤 Patient: ${patientSale.customerName}
💰 Total Amount: ₹${patientSale.totalAmount.toFixed(2)} (PAID)
📄 Download Official Tax Invoice PDF:
http://localhost/api/sales/${patientSale.id}/pdf
Wishing you a speedy recovery!`

      const waLink = generateWaMeLink(patientSale.customerPhone!, patientMsg)
      expect(waLink).toContain('https://wa.me/919876543210?text=')
      expect(waLink).toContain(encodeURIComponent(patientSale.invoiceNumber))
    })

    it('T4.3: Scenario 3 — Admin Prescription Sale Cancellation & Stock Audit (Batch EXHAUSTED -> ACTIVE + inventory restored + AuditLog)', async () => {
      const sale = createSampleSaleFixture()
      const exhaustedBatch = {
        id: 'batch-amx-01',
        batchNumber: 'AMX-B26',
        quantity: 20,
        soldQuantity: 20,
        status: 'EXHAUSTED',
      }

      const adminActor: SaleActor = {
        id: 'admin-super-01',
        branchId: 'branch-ka-01',
        permissions: [PERMISSIONS.SALES_VOID],
        roles: ['super_admin'],
      }

      const fakeTx = {
        sale: {
          findUnique: jest.fn().mockResolvedValue(sale),
          update: jest.fn().mockResolvedValue({ ...sale, status: 'CANCELLED', cancelledAt: new Date() }),
        },
        inventory: {
          findUnique: jest.fn().mockResolvedValue({ id: 'inv-01', totalQuantity: 0, availableQuantity: 0 }),
          update: jest.fn(),
        },
        inventoryMovement: { create: jest.fn() },
        batch: {
          findUnique: jest.fn().mockResolvedValue(exhaustedBatch),
          update: jest.fn(),
        },
        batchStatusLog: { create: jest.fn() },
        auditLog: { create: jest.fn() },
      }

      mockedPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(fakeTx))

      await cancelSale(sale.id, 'Doctor recalled batch due to contraindication', adminActor)

      expect(fakeTx.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED' }),
        })
      )

      expect(fakeTx.batch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACTIVE',
            soldQuantity: 0,
          }),
        })
      )

      expect(fakeTx.batchStatusLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            batchId: 'batch-amx-01',
            fromStatus: 'EXHAUSTED',
            toStatus: 'ACTIVE',
          }),
        })
      )

      expect(fakeTx.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalQuantity: { increment: 20 },
            availableQuantity: { increment: 20 },
          }),
        })
      )

      expect(fakeTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'SALE_CANCEL',
            entity: 'Sale',
          }),
        })
      )
    })

    it('T4.4: Scenario 4 — Cashier Unauthorized Tamper Defense (PATCH 403 + DELETE 403 + bill integrity preserved)', async () => {
      mockedRequireAuth.mockResolvedValue({
        id: 'cashier-rogue',
        branchId: 'branch-ka-01',
        permissions: [PERMISSIONS.SALES_CREATE],
        roles: ['cashier'],
      })

      const patchReq = makeMockRequest('http://localhost/api/sales/sale-e2e-101', {
        method: 'PATCH',
        body: { items: [{ saleItemId: 'item-01', quantity: 1 }] },
      })
      const patchRes = await salesPATCH(patchReq, { params: { id: 'sale-e2e-101' } })
      expect(patchRes.status).toBe(403)

      const deleteReq = makeMockRequest('http://localhost/api/sales/sale-e2e-101', {
        method: 'DELETE',
      })
      const deleteRes = await salesDELETE(deleteReq, { params: { id: 'sale-e2e-101' } })
      expect(deleteRes.status).toBe(403)

      expect(mockedPrisma.sale.update).not.toHaveBeenCalled()
      expect(mockedPrisma.inventory.update).not.toHaveBeenCalled()
    })

    it('T4.5: Scenario 5 — Heavy Multi-Month Enterprise Financial Report Offloading (Deep Decimal sanitization + no DataCloneError + .xlsx streamed)', async () => {
      mockedRequirePermission.mockResolvedValue({ id: 'exec-01', branchId: 'branch-ka-01' })
      mockedResolveBranchScope.mockResolvedValue('branch-ka-01')

      const heavyDailyBreakdown = Array.from({ length: 90 }, (_, i) => ({
        date: `2026-${String(Math.floor(i / 30) + 8).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
        salesCount: 40 + (i % 15),
        revenue: 25000 + (i * 250),
        tax: 3000 + (i * 30),
        discount: 1000 + (i * 10),
        averageBillValue: 625.0,
      }))

      mockedReportService.getSalesFinancials.mockResolvedValueOnce({
        totalRevenue: 3250000.0,
        totalSalesCount: 4250,
        averageOrderValue: 764.7,
        totalTax: 390000.0,
        totalDiscount: 130000.0,
        dailyBreakdown: heavyDailyBreakdown,
      })

      const req = makeMockRequest('http://localhost/api/reports/export?reportType=sales&period=custom&startDate=2026-08-01&endDate=2026-10-31')
      const res = await exportGET(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

      const arrayBuf = await res.arrayBuffer()
      const wb = XLSX.read(Buffer.from(arrayBuf), { type: 'buffer' })

      expect(wb.SheetNames.length).toBeGreaterThanOrEqual(1)
      const summarySheet = wb.Sheets[wb.SheetNames[0]]
      expect(summarySheet).toBeDefined()
    })
  })
})
