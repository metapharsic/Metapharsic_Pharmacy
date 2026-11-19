/** @jest-environment node */
import * as XLSX from 'xlsx'

import {
  generateExcelWorkbook,
  sanitizeSheetName,
  buildWorkbook,
  type ExcelWorkbookConfig,
} from '../excel-export-service'
import { parseReportPeriod } from '../report-params'
import {
  sanitizePayload,
  getReportingWorkerPath,
  runSynchronousFallback,
} from '../reporting-worker-bridge'

describe('excel-export-service', () => {
  describe('sanitizeSheetName', () => {
    it('sanitizes forbidden characters: \\ / ? * [ ] :', () => {
      expect(sanitizeSheetName('Sales/Report:2026?*[Test]')).toBe('Sales Report 2026 Test')
    })

    it('clamps length to 31 characters', () => {
      const longName = 'This is an exceedingly long worksheet title exceeding limits'
      const sanitized = sanitizeSheetName(longName)
      expect(sanitized.length).toBeLessThanOrEqual(31)
      expect(sanitized).toBe('This is an exceedingly long wor')
    })

    it('falls back to default Sheet name when empty', () => {
      expect(sanitizeSheetName('', 3)).toBe('Sheet3')
      expect(sanitizeSheetName('   ', 1)).toBe('Sheet1')
    })
  })

  describe('generateExcelWorkbook', () => {
    it('generates a valid binary Excel (.xlsx) buffer with ZIP magic bytes', () => {
      const config: ExcelWorkbookConfig = {
        filename: 'Daily_Sales.xlsx',
        organizationName: 'Metapharsic Pharmacy',
        sheets: [
          {
            sheetName: 'Executive Summary',
            title: 'Daily Sales Performance',
            subtitle: 'Scope: 2026-11-02',
            metadata: {
              Period: 'DAILY',
              'Total Revenue': '₹45,200.00',
              'Total Orders': 64,
            },
            headers: ['Business Date', 'Orders Count', 'Gross Revenue (₹)', 'Tax (₹)'],
            data: [
              ['2026-11-02', 64, 45200.0, 5424.0],
            ],
            summaryRow: ['Total', 64, 45200.0, 5424.0],
          },
          {
            sheetName: 'Detailed Ledger',
            title: 'Sales Transactions',
            headers: ['Invoice #', 'Customer', 'Amount (₹)', 'Tax (₹)'],
            data: [
              ['INV-1001', 'John Doe', 1200.5, 144.06],
              ['INV-1002', 'Jane Smith', 850.0, 102.0],
            ],
            summaryRow: ['Total', '', 2050.5, 246.06],
          },
        ],
      }

      const buffer = generateExcelWorkbook(config)
      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.length).toBeGreaterThan(1000)

      // Verify ZIP magic bytes for standard .xlsx file (PK\x03\x04 = 0x50 0x4B 0x03 0x04)
      expect(buffer[0]).toBe(0x50)
      expect(buffer[1]).toBe(0x4b)
      expect(buffer[2]).toBe(0x03)
      expect(buffer[3]).toBe(0x04)

      // Verify workbook can be read back and verified by SheetJS
      const wb = XLSX.read(buffer, { type: 'buffer', cellStyles: true })
      expect(wb.SheetNames).toHaveLength(2)
      expect(wb.SheetNames).toContain('Executive Summary')
      expect(wb.SheetNames).toContain('Detailed Ledger')

      // Inspect Executive Summary Sheet contents
      const execSheet = wb.Sheets['Executive Summary']
      expect(execSheet).toBeDefined()
      expect(execSheet['!cols']).toBeDefined()
      expect(execSheet['!cols']!.length).toBeGreaterThanOrEqual(4)

      // Column widths must be clamped properly (>= 12)
      for (const col of execSheet['!cols']!) {
        expect(col.wch).toBeGreaterThanOrEqual(12)
        expect(col.wch).toBeLessThanOrEqual(55)
      }
    })

    it('formats numeric currency and quantity cells with proper cell.z masks', () => {
      const config: ExcelWorkbookConfig = {
        filename: 'Financial_Ledger.xlsx',
        sheets: [
          {
            sheetName: 'Ledger',
            title: 'Audit Register',
            headers: ['Product Name', 'Available Qty', 'Total Revenue (₹)', 'Profit Margin (%)'],
            data: [
              ['Paracetamol 500mg', 150, 4500.75, 0.25],
              ['Amoxicillin 250mg', 40, 1280.0, 0.35],
            ],
            summaryRow: ['Total', 190, 5780.75, 0.27],
          },
        ],
      }

      const wb = buildWorkbook(config)
      const ws = wb.Sheets['Ledger']

      // Find the headers row and data rows
      // Row 1: Org, Row 2: Title, Row 3: Blank, Row 4: Headers, Row 5: Data 1, Row 6: Data 2, Row 7: Summary
      const cellRevenueData = ws['C5'] // Total Revenue data cell
      expect(cellRevenueData).toBeDefined()
      expect(cellRevenueData.v).toBe(4500.75)
      expect(cellRevenueData.z).toBe('#,##0.00')

      const cellQtyData = ws['B5'] // Available Qty data cell
      expect(cellQtyData).toBeDefined()
      expect(cellQtyData.v).toBe(150)
      expect(cellQtyData.z).toBe('#,##0')

      const cellMarginData = ws['D5'] // Margin data cell
      expect(cellMarginData).toBeDefined()
      expect(cellMarginData.z).toBe('0.0%')
    })

    it('deduplicates duplicate worksheet names cleanly', () => {
      const config: ExcelWorkbookConfig = {
        filename: 'Duplicates.xlsx',
        sheets: [
          {
            sheetName: 'Report Sheet',
            title: 'Report 1',
            headers: ['Col A'],
            data: [['Val 1']],
          },
          {
            sheetName: 'Report Sheet',
            title: 'Report 2',
            headers: ['Col B'],
            data: [['Val 2']],
          },
        ],
      }

      const wb = buildWorkbook(config)
      expect(wb.SheetNames).toHaveLength(2)
      expect(wb.SheetNames[0]).toBe('Report Sheet')
      expect(wb.SheetNames[1]).toBe('Report Sheet_2')
    })
  })

  describe('parseReportPeriod', () => {
    it('resolves daily period accurately', () => {
      const result = parseReportPeriod({ period: 'daily', date: '2026-11-02' })
      expect(result.period).toBe('daily')
      expect(result.label).toContain('2026-11-02')
      expect(result.startDate.getFullYear()).toBe(2026)
      expect(result.startDate.getMonth()).toBe(10) // 0-indexed November
      expect(result.startDate.getDate()).toBe(2)
      expect(result.startDate.getHours()).toBe(0)
      expect(result.endDate.getHours()).toBe(23)
      expect(result.endDate.getMinutes()).toBe(59)
    })

    it('resolves weekly period accurately spanning 7 days', () => {
      const result = parseReportPeriod({ period: 'weekly', date: '2026-11-08' })
      expect(result.period).toBe('weekly')
      expect(result.label).toContain('Weekly Report')
      const diffMs = result.endDate.getTime() - result.startDate.getTime()
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
      expect(diffDays).toBe(7)
    })

    it('resolves monthly period covering the full month', () => {
      const result = parseReportPeriod({ period: 'monthly', date: '2026-11-15' })
      expect(result.period).toBe('monthly')
      expect(result.label).toBe('Monthly Report (November 2026)')
      expect(result.startDate.getDate()).toBe(1)
      expect(result.endDate.getDate()).toBe(30) // November has 30 days
    })

    it('resolves custom period when startDate and endDate are provided', () => {
      const result = parseReportPeriod({
        period: 'custom',
        startDate: '2026-10-01',
        endDate: '2026-10-15',
      })
      expect(result.period).toBe('custom')
      expect(result.startDate.toISOString()).toContain('2026-10-01')
      expect(result.endDate.toISOString()).toContain('2026-10-15')
    })

    it('throws validation error when invalid period is supplied', () => {
      expect(() => parseReportPeriod({ period: 'quarterly' })).toThrow('Validation: invalid report period')
    })
  })

  describe('worker-bridge resilience & sanitization', () => {
    it('recursively sanitizes Prisma Decimal-like objects and Dates into primitives', () => {
      const prismaDecimalMock = {
        d: [4500],
        e: 2,
        s: 1,
        toNumber: () => 4500.5,
      }

      const input = {
        id: 'sale-1',
        saleDate: new Date('2026-11-02T10:00:00.000Z'),
        amount: prismaDecimalMock,
        items: [
          {
            name: 'Medicine A',
            rate: prismaDecimalMock,
            count: BigInt(5),
          },
        ],
      }

      const sanitized = sanitizePayload(input)

      expect(typeof sanitized.saleDate).toBe('string')
      expect(sanitized.saleDate).toBe('2026-11-02T10:00:00.000Z')
      expect(sanitized.amount).toBe(4500.5)
      expect(sanitized.items[0].rate).toBe(4500.5)
      expect(sanitized.items[0].count).toBe(5)
    })

    it('resolves reporting worker path to an existing or valid candidate', () => {
      const p = getReportingWorkerPath()
      expect(typeof p).toBe('string')
      expect(p).toContain('reporting-analytics.worker.js')
    })

    it('synchronous fallback executes sales financials calculation correctly', () => {
      const payload = {
        sales: [
          {
            status: 'COMPLETED',
            totalAmount: 1200,
            taxAmount: 144,
            discountAmount: 50,
            saleDate: '2026-11-02T10:00:00.000Z',
          },
          {
            status: 'COMPLETED',
            totalAmount: 800,
            taxAmount: 96,
            discountAmount: 20,
            saleDate: '2026-11-02T11:00:00.000Z',
          },
          {
            status: 'CANCELLED',
            totalAmount: 500,
            taxAmount: 60,
            discountAmount: 0,
            saleDate: '2026-11-02T12:00:00.000Z',
          },
        ],
        timeZone: 'Asia/Kolkata',
      }

      const res = runSynchronousFallback<any, any>('COMPUTE_SALES_FINANCIALS', payload)
      expect(res.totalSalesCount).toBe(2)
      expect(res.totalRevenue).toBe(2000)
      expect(res.totalTax).toBe(240)
      expect(res.totalDiscount).toBe(70)
      expect(res.averageOrderValue).toBe(1000)
      expect(res.dailyBreakdown).toHaveLength(1)
    })
  })
})
