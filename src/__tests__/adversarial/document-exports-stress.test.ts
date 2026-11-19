/** @jest-environment node */

// ─────────────────────────────────────────────────────────────
// Challenger 1: Empirical Adversarial Stress Test Suite
// Focus: Excel Report Exports & PDF Invoice Generation
// Target: Stress-testing edge cases, security, binary validation,
//         and statutory compliance
// ─────────────────────────────────────────────────────────────

import type { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'

import {
  generateExcelWorkbook,
  buildWorkbook,
  sanitizeSheetName,
  type ExcelWorkbookConfig,
  type ExcelSheetConfig,
} from '@/lib/reports/excel-export-service'
import {
  generateInvoicePdfBuffer,
  generateInvoicePdfDoc,
  computeGstSlabs,
  numberToWordsINR,
  parseNum,
  round2,
  type InvoiceSaleData,
} from '@/lib/pdf/invoice-pdf-generator'
import { GET as exportGET } from '@/app/api/reports/export/route'
import { GET as pdfGET } from '@/app/api/sales/[id]/pdf/route'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { ReportService } from '@/lib/reports/report-service'
import { getSaleById } from '@/lib/sales/sales-service'

// ─── Mocks ───────────────────────────────────────────────────

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
  requireAuth: jest.fn(),
}))

jest.mock('@/lib/inventory/branch-access', () => ({
  resolveBranchScope: jest.fn(),
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

jest.mock('@/lib/sales/sales-service', () => ({
  getSaleById: jest.fn(),
}))

jest.mock('@/lib/db/prisma', () => {
  const client = {
    sale: { findMany: jest.fn().mockResolvedValue([]) },
    branch: { findUnique: jest.fn().mockResolvedValue({ id: 'branch-1', name: 'Dispensary' }) },
  }
  return {
    __esModule: true,
    default: client,
    prisma: client,
  }
})

const mockedRequirePermission = requirePermission as jest.Mock
const mockedResolveBranchScope = resolveBranchScope as jest.Mock
const mockedReportService = ReportService as unknown as Record<string, jest.Mock>
const mockedGetSaleById = getSaleById as jest.Mock

function makeMockRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  const reqHeaders = new Headers(headers)
  return {
    url,
    method: 'GET',
    headers: reqHeaders,
    nextUrl: new URL(url),
  } as unknown as NextRequest
}

describe('Challenger 1: Empirical Adversarial Document & Export Stress Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ═════════════════════════════════════════════════════════════
  // SECTION 1: EXCEL REPORT EXPORTS ADVERSARIAL STRESS
  // ═════════════════════════════════════════════════════════════

  describe('Excel Stress Testing', () => {
    it('E-STRESS-1: Empty data & null/undefined edge cases produce valid .xlsx with PK\\x03\\x04', () => {
      // 1. Sheet with completely empty data array
      const emptyConfig: ExcelWorkbookConfig = {
        filename: 'Empty_Report.xlsx',
        organizationName: 'Metapharsic Zero Records Test',
        sheets: [
          {
            sheetName: 'Zero Records',
            title: 'Empty Dispensary Ledger',
            headers: ['Invoice #', 'Customer Name', 'Total Amount', 'Tax (₹)'],
            data: [],
            summaryRow: ['Total', '0 Records', 0, 0],
          },
        ],
      }

      const emptyBuffer = generateExcelWorkbook(emptyConfig)
      expect(Buffer.isBuffer(emptyBuffer)).toBe(true)
      expect(emptyBuffer.length).toBeGreaterThan(500)

      // Assert standard ZIP magic bytes: PK\x03\x04
      expect(emptyBuffer[0]).toBe(0x50) // 'P'
      expect(emptyBuffer[1]).toBe(0x4b) // 'K'
      expect(emptyBuffer[2]).toBe(0x03)
      expect(emptyBuffer[3]).toBe(0x04)

      // Roundtrip parse check
      const parsed = XLSX.read(emptyBuffer, { type: 'buffer' })
      expect(parsed.SheetNames).toContain('Zero Records')
      const ws = parsed.Sheets['Zero Records']
      expect(ws).toBeDefined()

      // 2. Sheet with null, undefined, empty string cells
      const nullsConfig: ExcelWorkbookConfig = {
        filename: 'Corrupted_Nulls.xlsx',
        sheets: [
          {
            sheetName: 'Null Handling',
            title: 'Null Values Stress',
            headers: ['Col A', 'Col B', 'Col C'],
            data: [
              [null, undefined, ''],
              ['Normal', null, 42],
            ],
            summaryRow: [null, null, null],
          },
        ],
      }

      const nullsBuffer = generateExcelWorkbook(nullsConfig)
      expect(nullsBuffer[0]).toBe(0x50)
      expect(nullsBuffer[1]).toBe(0x4b)
      const parsedNulls = XLSX.read(nullsBuffer, { type: 'buffer' })
      expect(parsedNulls.SheetNames).toContain('Null Handling')
    })

    it('E-STRESS-2: Massive dataset stress (10,000 rows x 10 cols) executes within budget and generates valid ZIP', () => {
      const rowCount = 10000
      const headers = [
        'Row ID',
        'Medicine Name',
        'Batch Number',
        'Expiry Date',
        'Quantity Sold',
        'Unit Rate (₹)',
        'Gross Amount (₹)',
        'Tax Amount (₹)',
        'Net Total (₹)',
        'Profit Margin (%)',
      ]

      const data: (string | number)[][] = []
      for (let i = 1; i <= rowCount; i++) {
        const qty = (i % 20) + 1
        const rate = 45.5 + (i % 100)
        const gross = qty * rate
        const tax = gross * 0.12
        const total = gross + tax
        const margin = 0.22

        data.push([
          `ROW-${String(i).padStart(6, '0')}`,
          `Pharmaceutical Compound Formula ${i}`,
          `LOT-${202600 + (i % 500)}`,
          '2028-06-30',
          qty,
          round2(rate),
          round2(gross),
          round2(tax),
          round2(total),
          margin,
        ])
      }

      const massiveConfig: ExcelWorkbookConfig = {
        filename: 'Massive_10000_Rows_Report.xlsx',
        organizationName: 'Metapharsic High-Volume Performance Benchmark',
        sheets: [
          {
            sheetName: 'Massive Dataset',
            title: '10,000 Rows Transaction Audit Ledger',
            subtitle: 'Empirical High Volume Stress Test',
            metadata: {
              'Total Rows': rowCount,
              'Columns per Row': headers.length,
              'Total Cells': rowCount * headers.length,
            },
            headers,
            data,
            summaryRow: ['TOTAL', 'Aggregated Metrics', '', '', 105000, null, 7250000, 870000, 8120000, null],
          },
        ],
      }

      const startTime = Date.now()
      const buffer = generateExcelWorkbook(massiveConfig)
      const durationMs = Date.now() - startTime

      // Performance check: 10,000 rows should complete in under 5000ms
      expect(durationMs).toBeLessThan(5000)

      // Buffer size sanity: 10,000 rows with styling should be > 300KB
      expect(buffer.length).toBeGreaterThan(300000)

      // Assert standard ZIP magic bytes: PK\x03\x04
      expect(buffer[0]).toBe(0x50) // 'P'
      expect(buffer[1]).toBe(0x4b) // 'K'
      expect(buffer[2]).toBe(0x03)
      expect(buffer[3]).toBe(0x04)

      // Roundtrip read verification with SheetJS
      const parsedWb = XLSX.read(buffer, { type: 'buffer' })
      expect(parsedWb.SheetNames).toEqual(['Massive Dataset'])
      const sheet = parsedWb.Sheets['Massive Dataset']
      expect(sheet['!ref']).toBeDefined()

      // Verify row count spans through header, metadata, table headers, 10,000 data rows and summary
      const range = XLSX.utils.decode_range(sheet['!ref']!)
      expect(range.e.r).toBeGreaterThanOrEqual(rowCount)
    })

    it('E-STRESS-3: Formula injection payloads (=, +, -, @) are stored as text (type s) and safely read back', () => {
      // In spreadsheet applications, strings starting with =, +, -, @ can trigger DDE/formula execution if parsed as formulas.
      // SheetJS aoa_to_sheet treats JavaScript string primitives as cell.t = 's' (shared string), NOT formula 'f'.
      const injectionPayloads = [
        '=cmd|\' /C calc\'!A0',
        '=SUM(1,2)',
        '=10+20',
        '+cmd|\' /C notepad\'!A0',
        '+1+1',
        '-5-5',
        '-1337+2',
        '@SUM(1,2)',
        '@alert(1)',
        '=HYPERLINK("http://evil-attacker.example.com", "Click for Refund")',
      ]

      const config: ExcelWorkbookConfig = {
        filename: 'Formula_Injection_Stress.xlsx',
        sheets: [
          {
            sheetName: 'Injection Test',
            title: 'Formula Injection Verification',
            headers: ['Payload ID', 'Raw Payload String', 'Clean Field'],
            data: injectionPayloads.map((payload, idx) => [`PAYLOAD-${idx + 1}`, payload, `Safe Text ${idx}`]),
            summaryRow: ['=SUM(A1:A10)', '+Total', '@End'],
          },
        ],
      }

      const wb = buildWorkbook(config)
      const ws = wb.Sheets['Injection Test']

      // Inspect every data row cell in Column B (the raw payload)
      // Row 1: Org, Row 2: Title, Row 3: Blank, Row 4: Headers, Row 5+: Data
      const dataStartRow = 5
      for (let i = 0; i < injectionPayloads.length; i++) {
        const cellAddress = `B${dataStartRow + i}`
        const cell = ws[cellAddress]
        expect(cell).toBeDefined()
        // Must be string type 's', NOT formula type 'f'
        expect(cell.t).toBe('s')
        expect(cell.v).toBe(injectionPayloads[i])
        expect(cell.f).toBeUndefined() // Formula property MUST be undefined
      }

      // Also verify summary row cells with injection prefixes are stored as string type
      const summaryRowIndex = dataStartRow + injectionPayloads.length
      const summaryCellA = ws[`A${summaryRowIndex}`]
      const summaryCellB = ws[`B${summaryRowIndex}`]
      const summaryCellC = ws[`C${summaryRowIndex}`]

      expect(summaryCellA.t).toBe('s')
      expect(summaryCellA.f).toBeUndefined()
      expect(summaryCellB.t).toBe('s')
      expect(summaryCellB.f).toBeUndefined()
      expect(summaryCellC.t).toBe('s')
      expect(summaryCellC.f).toBeUndefined()

      // Generate binary buffer and read back to ensure ZIP & OpenXML validity
      const buffer = generateExcelWorkbook(config)
      expect(buffer[0]).toBe(0x50)
      expect(buffer[1]).toBe(0x4b)

      const roundtripWb = XLSX.read(buffer, { type: 'buffer' })
      const roundtripWs = roundtripWb.Sheets['Injection Test']
      for (let i = 0; i < injectionPayloads.length; i++) {
        const cell = roundtripWs[`B${dataStartRow + i}`]
        expect(cell.t).toBe('s')
        expect(cell.v).toBe(injectionPayloads[i])
      }
    })

    it('E-STRESS-4: Column auto-fit clamping strictly enforces [12, 55] range for extreme string lengths', () => {
      const extremeLongHeader = 'A'.repeat(250) // 250 characters
      const extremeLongData = 'B'.repeat(300)   // 300 characters
      const tinyHeader = 'X'                   // 1 character
      const tinyData = '1'                     // 1 character

      const config: ExcelWorkbookConfig = {
        filename: 'Col_Clamping_Stress.xlsx',
        sheets: [
          {
            sheetName: 'Clamping',
            title: 'Auto-Fit Clamp Verification',
            headers: [tinyHeader, extremeLongHeader, 'Normal Header'],
            data: [
              [tinyData, extremeLongData, 'Normal length value'],
            ],
          },
        ],
      }

      const wb = buildWorkbook(config)
      const ws = wb.Sheets['Clamping']
      const colWidths = ws['!cols']

      expect(colWidths).toBeDefined()
      expect(colWidths!.length).toBe(3)

      // Column 0: 1 char length -> min clamp 12
      expect(colWidths![0].wch).toBe(12)

      // Column 1: 300 chars length -> max clamp 55
      expect(colWidths![1].wch).toBe(55)

      // Column 2: 'Normal length value' length is 19 -> 19 + 3 = 22
      expect(colWidths![2].wch).toBe(22)
    })

    it('E-STRESS-5: Sheet name sanitization handles illegal characters and 31-char Excel limits', () => {
      // Excel forbids: \ / ? * [ ] : and limits sheet names to 31 chars
      expect(sanitizeSheetName('Sales/Dept:Report*2026?[Test]')).toBe('Sales Dept Report 2026 Test')
      expect(sanitizeSheetName('////????****[[[[]]]]:')).toBe('Sheet1')
      expect(sanitizeSheetName('')).toBe('Sheet1')
      expect(sanitizeSheetName('   ', 4)).toBe('Sheet4')

      const veryLong = 'Departmental_Quarterly_Financial_Statement_Audit_Ledger_2026'
      const sanitizedLong = sanitizeSheetName(veryLong)
      expect(sanitizedLong.length).toBeLessThanOrEqual(31)
      expect(sanitizedLong).toBe('Departmental_Quarterly_Financia')

      // Deduplication of identical or case-insensitive names in multi-sheet workbook
      const config: ExcelWorkbookConfig = {
        filename: 'Deduplication_Test.xlsx',
        sheets: [
          { sheetName: 'Accounts', title: 'T1', headers: ['H1'], data: [['D1']] },
          { sheetName: 'accounts', title: 'T2', headers: ['H2'], data: [['D2']] },
          { sheetName: 'ACCOUNTS', title: 'T3', headers: ['H3'], data: [['D3']] },
        ],
      }

      const wb = buildWorkbook(config)
      expect(wb.SheetNames).toEqual(['Accounts', 'accounts_2', 'ACCOUNTS_3'])
    })

    it('E-STRESS-6: Zero XML Guarantee — export route strictly rejects XML/CSV and delivers valid .xlsx with PK\\x03\\x04', async () => {
      mockedRequirePermission.mockResolvedValue({ id: 'admin-1', roles: ['admin'] })
      mockedResolveBranchScope.mockResolvedValue('branch-1')
      mockedReportService.getSalesFinancials.mockResolvedValue({
        totalRevenue: 50000,
        totalSalesCount: 25,
        averageOrderValue: 2000,
        totalTax: 6000,
        totalDiscount: 1500,
        dailyBreakdown: [
          { date: '2026-11-02', salesCount: 25, revenue: 50000, tax: 6000, discount: 1500, averageBillValue: 2000 },
        ],
      })

      // Test multiple legacy format query attempts
      const legacyFormats = ['xml', 'XML', 'csv', 'CSV', 'text/xml', 'application/xml']

      for (const fmt of legacyFormats) {
        const req = makeMockRequest(`http://localhost/api/reports/export?reportType=sales&period=daily&format=${encodeURIComponent(fmt)}`)
        const res = await exportGET(req)

        expect(res.status).toBe(200)

        // Strict assertion: MIME type is strictly OpenXML Spreadsheet, never text/xml or application/xml
        const contentType = res.headers.get('Content-Type')
        expect(contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        expect(contentType).not.toBe('text/xml')
        expect(contentType).not.toBe('application/xml')
        expect(contentType).not.toBe('text/csv')
        expect(contentType).not.toBe('application/csv')

        // Content-Disposition strictly specifies .xlsx
        const contentDisposition = res.headers.get('Content-Disposition')
        expect(contentDisposition).toContain('.xlsx"')
        expect(contentDisposition).not.toContain('.xml')
        expect(contentDisposition).not.toContain('.csv')

        // Body is binary buffer with standard ZIP magic bytes
        const arrayBuf = await res.arrayBuffer()
        const buffer = Buffer.from(arrayBuf)
        expect(buffer[0]).toBe(0x50) // 'P'
        expect(buffer[1]).toBe(0x4b) // 'K'
        expect(buffer[2]).toBe(0x03)
        expect(buffer[3]).toBe(0x04)

        // Ensure buffer does NOT start with XML header
        const textStart = buffer.subarray(0, 10).toString('utf-8')
        expect(textStart).not.toContain('<?xml')
        expect(textStart).not.toContain('<report')
      }
    })
  })

  // ═════════════════════════════════════════════════════════════
  // SECTION 2: PDF INVOICE GENERATION ADVERSARIAL STRESS
  // ═════════════════════════════════════════════════════════════

  describe('PDF Invoice Generator Stress Testing', () => {
    const baseSale: InvoiceSaleData = {
      id: 'stress-sale-001',
      invoiceNumber: 'INV-STRESS-01',
      saleDate: new Date('2026-11-02T14:30:00Z'),
      subtotal: 1000,
      discountAmount: 0,
      taxAmount: 120,
      cgstAmount: 60,
      sgstAmount: 60,
      igstAmount: 0,
      totalAmount: 1120,
      amountPaid: 1120,
      paymentStatus: 'PAID',
      items: [
        {
          productName: 'Paracetamol 500mg',
          hsnCode: '3004',
          batchNumber: 'PCM-101',
          expiryDate: '2027-12-31',
          quantity: 2,
          unitPrice: 500,
          totalAmount: 1120,
          taxPercent: 12,
        },
      ],
    }

    it('P-STRESS-1: PDF Binary Magic Bytes (%PDF-1.) and EOF marker verification for A4 and Thermal 80mm', () => {
      // 1. A4 Format
      const a4Buffer = generateInvoicePdfBuffer(baseSale, { format: 'a4' })
      expect(Buffer.isBuffer(a4Buffer)).toBe(true)
      expect(a4Buffer.length).toBeGreaterThan(1000)

      // Magic bytes: %PDF-1. (ASCII: 0x25 0x50 0x44 0x46 0x2D 0x31 0x2E)
      const a4Header = a4Buffer.subarray(0, 7).toString('ascii')
      expect(a4Header).toBe('%PDF-1.')

      // PDF must contain standard EOF marker
      const a4Tail = a4Buffer.subarray(a4Buffer.length - 128).toString('ascii')
      expect(a4Tail).toContain('%%EOF')

      // 2. Thermal 80mm Format
      const thermalBuffer = generateInvoicePdfBuffer(baseSale, { format: 'thermal80' })
      expect(Buffer.isBuffer(thermalBuffer)).toBe(true)
      expect(thermalBuffer.length).toBeGreaterThan(1000)

      const thermalHeader = thermalBuffer.subarray(0, 7).toString('ascii')
      expect(thermalHeader).toBe('%PDF-1.')

      const thermalTail = thermalBuffer.subarray(thermalBuffer.length - 128).toString('ascii')
      expect(thermalTail).toContain('%%EOF')
    })

    it('P-STRESS-2: Extreme item counts: 1-item bill and massive 100-items bill', () => {
      // 1. Single Item Bill
      const singleItemDoc = generateInvoicePdfDoc(baseSale, { format: 'a4' })
      expect(singleItemDoc.getNumberOfPages()).toBeGreaterThanOrEqual(1)

      // 2. 100 Items Bill
      const massiveItems = []
      for (let i = 1; i <= 100; i++) {
        massiveItems.push({
          productName: `Generic Drug Item #${i} Formulated Capsule 250mg`,
          genericName: `Active Chemical Ingredient ${i}`,
          hsnCode: '3004',
          batchNumber: `BAT-${2600 + i}`,
          expiryDate: '2027-10-31',
          quantity: (i % 5) + 1,
          unitPrice: 20 + (i % 50),
          mrp: 25 + (i % 50),
          discountAmount: 0,
          discountPercent: 0,
          taxPercent: 12,
          cgstPercent: 6,
          sgstPercent: 6,
          igstPercent: 0,
          cgstAmount: 2.4,
          sgstAmount: 2.4,
          taxAmount: 4.8,
          totalAmount: 44.8,
        })
      }

      const massiveSale: InvoiceSaleData = {
        ...baseSale,
        invoiceNumber: 'INV-100-ITEMS',
        items: massiveItems,
        subtotal: 4000,
        taxAmount: 480,
        totalAmount: 4480,
      }

      const massiveBuffer = generateInvoicePdfBuffer(massiveSale, { format: 'a4' })
      expect(massiveBuffer.subarray(0, 7).toString('ascii')).toBe('%PDF-1.')
      expect(massiveBuffer.length).toBeGreaterThan(10000)

      const massiveDoc = generateInvoicePdfDoc(massiveSale, { format: 'a4' })
      // Multi-page A4 document generated safely
      expect(massiveDoc.getNumberOfPages()).toBeGreaterThan(1)
    })

    it('P-STRESS-3: Continuous 80mm thermal slip dynamic height calculations without premature page breaks', () => {
      // The 80mm thermal slip should calculate its page height dynamically so that the receipt
      // is printed on a single continuous thermal paper roll page without awkward breaks.
      const testItemCounts = [1, 5, 10, 20]

      for (const count of testItemCounts) {
        const testItems = []
        for (let i = 1; i <= count; i++) {
          testItems.push({
            productName: `Thermal Medicine Item ${i}`,
            hsnCode: '3004',
            batchNumber: `TH-${i}`,
            expiryDate: '2027-05-31',
            quantity: 1,
            unitPrice: 100,
            totalAmount: 112,
            taxAmount: 12,
            taxPercent: 12,
          })
        }

        const thermalSale: InvoiceSaleData = {
          ...baseSale,
          invoiceNumber: `INV-THERMAL-${count}`,
          items: testItems,
          subtotal: count * 100,
          taxAmount: count * 12,
          totalAmount: count * 112,
        }

        const doc = generateInvoicePdfDoc(thermalSale, { format: 'thermal80' })

        // Check page dimensions: width must be exactly 80mm
        const pageWidth = Math.round(doc.internal.pageSize.getWidth())
        expect(pageWidth).toBe(80)

        // Page height must scale dynamically with item count
        const pageHeight = Math.round(doc.internal.pageSize.getHeight())
        expect(pageHeight).toBeGreaterThanOrEqual(160)

        // CRITICAL CHECK: Continuous thermal slip must render on exactly 1 continuous page
        // without premature autotable page cutting for realistic POS receipts up to 20 items.
        expect(doc.getNumberOfPages()).toBe(1)
      }
    })

    it('P-STRESS-4: Extreme string lengths and multi-line generic composition handling', () => {
      const extremeSale: InvoiceSaleData = {
        ...baseSale,
        customerName: 'A'.repeat(120), // 120 chars patient name
        customerPhone: '+91 99999 88888 / 080-23456789 ext 402',
        doctorName: 'Dr. Professor Emeritus With An Extremely Long Royal Name and Qualifications MBBS MD DM DNB FACC',
        branch: {
          name: 'Super High-Tech Central Dispensary and Multi-Speciality Tertiary Care Pharmacy',
          address: 'Building 4B, Sector 12, Tech-Corridor Medical Super-Structure Campus, Opposite Mega Hospital Interchange',
          city: 'Greater Metropolitan Health City',
          state: 'Karnataka',
          pincode: '560099',
          phone: '+91 80 9999 0000',
          gstin: '29ABCDE1234F1Z5',
          dlNumber: 'KA-20B-99999 / KA-21B-88888',
        },
        items: [
          {
            productName: 'Super-Concentrated Sustained-Release Gastro-Resistant Extended-Action Pharmaceutical Tablet Formulation 1000mg',
            genericName: 'Paracetamol IP 650mg + Caffeine Anhydrous 50mg + Diphenhydramine Hydrochloride 25mg + Phenylephrine Hydrochloride 10mg',
            composition: 'Detailed pharmaceutical multi-ingredient salt formulation with micro-encapsulated slow release polymers',
            hsnCode: '30049099',
            batchNumber: 'LOT-SPECIAL-BATCH-2026-X99',
            expiryDate: '2028-11-30',
            quantity: 10,
            unitPrice: 245.75,
            mrp: 299.0,
            discountPercent: 10,
            discountAmount: 245.75,
            taxPercent: 12,
            taxAmount: 265.41,
            totalAmount: 2477.16,
          },
        ],
      }

      // Must generate A4 without throwing or crashing
      const a4Buffer = generateInvoicePdfBuffer(extremeSale, { format: 'a4' })
      expect(a4Buffer.subarray(0, 7).toString('ascii')).toBe('%PDF-1.')

      // Must generate Thermal 80mm without throwing or crashing
      const thermalBuffer = generateInvoicePdfBuffer(extremeSale, { format: 'thermal80' })
      expect(thermalBuffer.subarray(0, 7).toString('ascii')).toBe('%PDF-1.')
    })

    it('P-STRESS-5: Discount boundaries: 0% discount vs 100% full waiver / free sample', () => {
      // 1. 0% Discount
      const zeroDiscSale: InvoiceSaleData = {
        ...baseSale,
        subtotal: 500,
        discountAmount: 0,
        discountPercent: 0,
        taxAmount: 60,
        totalAmount: 560,
      }
      const zeroDiscBuffer = generateInvoicePdfBuffer(zeroDiscSale, { format: 'a4' })
      expect(zeroDiscBuffer.subarray(0, 7).toString('ascii')).toBe('%PDF-1.')

      // 2. 100% Full Waiver (Free sample or charitable dispensary waiver: totalAmount = 0)
      const freeSale: InvoiceSaleData = {
        id: 'free-sale-001',
        invoiceNumber: 'INV-FREE-001',
        saleDate: new Date('2026-11-02T15:00:00Z'),
        subtotal: 500,
        discountAmount: 500,
        discountPercent: 100,
        taxAmount: 0,
        totalAmount: 0,
        amountPaid: 0,
        paymentStatus: 'WAIVED',
        items: [
          {
            productName: 'Emergency Life-Saving Rehydration Solution IP',
            hsnCode: '3004',
            batchNumber: 'FREE-01',
            quantity: 5,
            unitPrice: 100,
            mrp: 100,
            discountAmount: 500,
            discountPercent: 100,
            taxPercent: 0,
            taxAmount: 0,
            totalAmount: 0,
          },
        ],
      }

      const freeBuffer = generateInvoicePdfBuffer(freeSale, { format: 'a4' })
      expect(freeBuffer.subarray(0, 7).toString('ascii')).toBe('%PDF-1.')

      // Verify number to words handles 0 gracefully
      expect(numberToWordsINR(0)).toBe('Rupees Zero Only')
    })

    it('P-STRESS-6: Mixed GST Slabs Matrix (0%, 5%, 12%, 18%, 28%) accurately computed', () => {
      const mixedItems = [
        // 0% Exempt item
        {
          productName: 'Exempt Saline Solution 500ml',
          quantity: 2,
          unitPrice: 50,
          totalAmount: 100,
          taxPercent: 0,
          taxAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
        },
        // 5% Life-Saving Drug
        {
          productName: 'Insulin Glargine 100IU/ml',
          quantity: 1,
          unitPrice: 600,
          totalAmount: 630,
          taxPercent: 5,
          cgstPercent: 2.5,
          sgstPercent: 2.5,
          taxAmount: 30,
          cgstAmount: 15,
          sgstAmount: 15,
        },
        // 12% Standard Antibiotic
        {
          productName: 'Azithromycin 500mg',
          quantity: 1,
          unitPrice: 100,
          totalAmount: 112,
          taxPercent: 12,
          cgstPercent: 6,
          sgstPercent: 6,
          taxAmount: 12,
          cgstAmount: 6,
          sgstAmount: 6,
        },
        // 18% Antiseptic Disinfectant
        {
          productName: 'Chlorhexidine Solution 500ml',
          quantity: 1,
          unitPrice: 200,
          totalAmount: 236,
          taxPercent: 18,
          cgstPercent: 9,
          sgstPercent: 9,
          taxAmount: 36,
          cgstAmount: 18,
          sgstAmount: 18,
        },
        // 28% Luxury / Medicated Cosmetic
        {
          productName: 'Premium Derma Cosmetic Lotion',
          quantity: 1,
          unitPrice: 1000,
          totalAmount: 1280,
          taxPercent: 28,
          cgstPercent: 14,
          sgstPercent: 14,
          taxAmount: 280,
          cgstAmount: 140,
          sgstAmount: 140,
        },
      ]

      const slabs = computeGstSlabs(mixedItems)

      // Must produce exactly 5 distinct slabs
      expect(slabs.length).toBe(5)

      const slabRates = slabs.map((s) => s.slab)
      expect(slabRates).toEqual([0, 5, 12, 18, 28])

      // 0% Exempt Slab
      const s0 = slabs.find((s) => s.slab === 0)!
      expect(s0.slabLabel).toBe('Exempt (0%)')
      expect(s0.taxableAmount).toBe(100)
      expect(s0.cgstRate).toBe(0)
      expect(s0.sgstRate).toBe(0)
      expect(s0.totalTax).toBe(0)

      // 5% Slab
      const s5 = slabs.find((s) => s.slab === 5)!
      expect(s5.slabLabel).toBe('GST 5%')
      expect(s5.taxableAmount).toBe(600)
      expect(s5.cgstRate).toBe(2.5)
      expect(s5.sgstRate).toBe(2.5)
      expect(s5.cgstAmount).toBe(15)
      expect(s5.sgstAmount).toBe(15)
      expect(s5.totalTax).toBe(30)

      // 12% Slab
      const s12 = slabs.find((s) => s.slab === 12)!
      expect(s12.slabLabel).toBe('GST 12%')
      expect(s12.taxableAmount).toBe(100)
      expect(s12.cgstRate).toBe(6)
      expect(s12.sgstRate).toBe(6)
      expect(s12.totalTax).toBe(12)

      // 18% Slab
      const s18 = slabs.find((s) => s.slab === 18)!
      expect(s18.slabLabel).toBe('GST 18%')
      expect(s18.taxableAmount).toBe(200)
      expect(s18.cgstRate).toBe(9)
      expect(s18.sgstRate).toBe(9)
      expect(s18.totalTax).toBe(36)

      // 28% Slab
      const s28 = slabs.find((s) => s.slab === 28)!
      expect(s28.slabLabel).toBe('GST 28%')
      expect(s28.taxableAmount).toBe(1000)
      expect(s28.cgstRate).toBe(14)
      expect(s28.sgstRate).toBe(14)
      expect(s28.totalTax).toBe(280)

      // Generate PDF with mixed slabs
      const mixedSale: InvoiceSaleData = {
        ...baseSale,
        invoiceNumber: 'INV-MIXED-GST',
        items: mixedItems,
        subtotal: 2000,
        taxAmount: 358,
        totalAmount: 2358,
      }

      const mixedBuffer = generateInvoicePdfBuffer(mixedSale, { format: 'a4' })
      expect(mixedBuffer.subarray(0, 7).toString('ascii')).toBe('%PDF-1.')
    })

    it('P-STRESS-7: Interstate IGST Transaction assigns full tax to IGST with zero CGST/SGST', () => {
      const interstateItems = [
        {
          productName: 'Interstate Orthopedic Implant Support',
          quantity: 1,
          unitPrice: 5000,
          totalAmount: 5600,
          taxPercent: 12,
          cgstPercent: 0,
          sgstPercent: 0,
          igstPercent: 12,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 600,
          taxAmount: 600,
        },
      ]

      const slabs = computeGstSlabs(interstateItems)
      expect(slabs.length).toBe(1)

      const slab12 = slabs[0]
      expect(slab12.slab).toBe(12)
      expect(slab12.cgstRate).toBe(0)
      expect(slab12.cgstAmount).toBe(0)
      expect(slab12.sgstRate).toBe(0)
      expect(slab12.sgstAmount).toBe(0)
      expect(slab12.igstRate).toBe(12)
      expect(slab12.igstAmount).toBe(600)
      expect(slab12.totalTax).toBe(600)

      // Generate interstate PDF
      const interstateSale: InvoiceSaleData = {
        ...baseSale,
        invoiceNumber: 'INV-INTERSTATE-001',
        items: interstateItems,
        subtotal: 5000,
        taxAmount: 600,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 600,
        totalAmount: 5600,
      }

      const igstDoc = generateInvoicePdfDoc(interstateSale, { format: 'a4' })
      expect(igstDoc.getNumberOfPages()).toBeGreaterThanOrEqual(1)

      const igstBuffer = generateInvoicePdfBuffer(interstateSale, { format: 'a4' })
      expect(igstBuffer.subarray(0, 7).toString('ascii')).toBe('%PDF-1.')
    })

    it('P-STRESS-8: Indian Rupee Words Converter (numberToWordsINR) handles standard and extreme numbers', () => {
      // 0
      expect(numberToWordsINR(0)).toBe('Rupees Zero Only')

      // Small numbers
      expect(numberToWordsINR(7)).toBe('Rupees Seven Only')
      expect(numberToWordsINR(19)).toBe('Rupees Nineteen Only')
      expect(numberToWordsINR(45)).toBe('Rupees Forty Five Only')

      // Hundreds and Thousands
      expect(numberToWordsINR(850)).toBe('Rupees Eight Hundred Fifty Only')
      expect(numberToWordsINR(1500)).toBe('Rupees One Thousand Five Hundred Only')
      expect(numberToWordsINR(15420)).toBe('Rupees Fifteen Thousand Four Hundred Twenty Only')

      // Lakhs and Crores
      expect(numberToWordsINR(100000)).toBe('Rupees One Lakh Only')
      expect(numberToWordsINR(2550000)).toBe('Rupees Twenty Five Lakh Fifty Thousand Only')
      expect(numberToWordsINR(10000000)).toBe('Rupees One Crore Only')
      expect(numberToWordsINR(12345678)).toBe('Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only')

      // Paise handling
      expect(numberToWordsINR(500.5)).toBe('Rupees Five Hundred and Fifty Paise Only')
      expect(numberToWordsINR(120.75)).toBe('Rupees One Hundred Twenty and Seventy Five Paise Only')
      expect(numberToWordsINR(0.25)).toBe('Twenty Five Paise Only')
    })

    it('P-STRESS-9: Server-side route GET /api/sales/:id/pdf delivers binary application/pdf with %PDF-1.', async () => {
      mockedRequirePermission.mockResolvedValue({ id: 'user-01', roles: ['pharmacist'] })
      mockedResolveBranchScope.mockResolvedValue('branch-1')
      mockedGetSaleById.mockResolvedValue({
        id: 'sale-stress-api',
        invoiceNumber: 'INV-API-2026',
        saleDate: new Date('2026-11-02T10:00:00Z'),
        subtotal: 750,
        taxAmount: 90,
        totalAmount: 840,
        items: [
          {
            productName: 'Cefixime 200mg',
            quantity: 1,
            unitPrice: 750,
            totalAmount: 840,
            taxPercent: 12,
            hsnCode: '3004',
          },
        ],
      })

      // Test A4 inline
      const reqA4 = makeMockRequest('http://localhost/api/sales/sale-stress-api/pdf?format=a4')
      const resA4 = await pdfGET(reqA4, { params: { id: 'sale-stress-api' } })

      expect(resA4.status).toBe(200)
      expect(resA4.headers.get('Content-Type')).toBe('application/pdf')
      expect(resA4.headers.get('Content-Disposition')).toContain('inline')
      expect(resA4.headers.get('Content-Disposition')).toContain('Invoice-INV-API-2026-Invoice.pdf')

      const bufA4 = Buffer.from(await resA4.arrayBuffer())
      expect(bufA4.subarray(0, 7).toString('ascii')).toBe('%PDF-1.')

      // Test 80mm thermal attachment download
      const reqThermal = makeMockRequest('http://localhost/api/sales/sale-stress-api/pdf?format=thermal80&download=true')
      const resThermal = await pdfGET(reqThermal, { params: { id: 'sale-stress-api' } })

      expect(resThermal.status).toBe(200)
      expect(resThermal.headers.get('Content-Type')).toBe('application/pdf')
      expect(resThermal.headers.get('Content-Disposition')).toContain('attachment')
      expect(resThermal.headers.get('Content-Disposition')).toContain('Invoice-INV-API-2026-Slip.pdf')

      const bufThermal = Buffer.from(await resThermal.arrayBuffer())
      expect(bufThermal.subarray(0, 7).toString('ascii')).toBe('%PDF-1.')
    })
  })
})
