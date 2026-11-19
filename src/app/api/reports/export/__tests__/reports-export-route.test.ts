/** @jest-environment node */
import type { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'

import { GET } from '@/app/api/reports/export/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { ReportService } from '@/lib/reports/report-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
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
  },
}))

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    sale: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'sale-1',
          invoiceNumber: 'INV-2026-001',
          createdAt: new Date('2026-11-02T10:00:00.000Z'),
          customer: { name: 'Ravi Kumar', phone: '9876543210' },
          doctorName: 'Dr. Sharma',
          paymentMethod: 'UPI',
          subtotal: 1000,
          discountAmount: 50,
          taxAmount: 120,
          totalAmount: 1070,
          status: 'COMPLETED',
          items: [{ quantity: 2, unitPrice: 500, totalAmount: 1000 }],
        },
      ]),
    },
  },
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedResolveBranchScope = resolveBranchScope as jest.Mock
const mockedReportService = ReportService as unknown as Record<string, jest.Mock>

function makeReq(url: string): NextRequest {
  return { url } as unknown as NextRequest
}

function authUser(branchId = 'br-1') {
  mockedRequirePermission.mockResolvedValue({ id: 'u1', branchId })
  mockedResolveBranchScope.mockResolvedValue(branchId)
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/reports/export', () => {
  it('rejects unauthenticated callers with 401', async () => {
    mockedRequirePermission.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET(makeReq('http://localhost/api/reports/export?reportType=sales'))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('rejects callers without permission with 403', async () => {
    mockedRequirePermission.mockRejectedValue(new Error('Forbidden: lacks permission'))
    const res = await GET(makeReq('http://localhost/api/reports/export?reportType=sales'))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('rejects callers when branch scope cannot be resolved with 403', async () => {
    mockedRequirePermission.mockResolvedValue({ id: 'u1', branchId: null })
    mockedResolveBranchScope.mockResolvedValue(null)
    const res = await GET(makeReq('http://localhost/api/reports/export?reportType=sales'))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.message).toContain('Must specify a branch')
  })

  it('rejects invalid period with 400 validation error', async () => {
    authUser()
    const res = await GET(makeReq('http://localhost/api/reports/export?reportType=sales&period=invalid_period'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('VALIDATION')
    expect(json.error.message).toContain('Validation: invalid report period')
  })

  it('exports daily sales report as a multi-sheet binary .xlsx file', async () => {
    authUser('br-1')
    mockedReportService.getSalesFinancials.mockResolvedValueOnce({
      totalSalesCount: 15,
      totalRevenue: 18500.0,
      totalTax: 2220.0,
      totalDiscount: 450.0,
      averageOrderValue: 1233.33,
      dailyBreakdown: [
        {
          date: '2026-11-02',
          salesCount: 15,
          revenue: 18500.0,
          tax: 2220.0,
          discount: 450.0,
          averageBillValue: 1233.33,
        },
      ],
    })

    const res = await GET(
      makeReq('http://localhost/api/reports/export?reportType=sales&period=daily&date=2026-11-02')
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="sales_report_daily_')
    expect(res.headers.get('Content-Disposition')).toContain('.xlsx"')

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Verify ZIP magic bytes
    expect(buffer[0]).toBe(0x50)
    expect(buffer[1]).toBe(0x4b)
    expect(buffer[2]).toBe(0x03)
    expect(buffer[3]).toBe(0x04)

    // Verify parsed workbook sheets
    const wb = XLSX.read(buffer, { type: 'buffer' })
    expect(wb.SheetNames).toContain('Executive Summary')
    expect(wb.SheetNames).toContain('Detailed Ledger')

    expect(mockedReportService.getSalesFinancials).toHaveBeenCalledWith(
      'br-1',
      expect.any(Date),
      expect.any(Date)
    )
  })

  it('exports stock position report as binary .xlsx file', async () => {
    authUser('br-1')
    mockedReportService.getDailyStockPosition.mockResolvedValueOnce({
      total: 2,
      data: [
        {
          productName: 'Paracetamol 500mg',
          sku: 'MED-001',
          category: 'Analgesics',
          availableQuantity: 250,
          mrp: 35.0,
          purchasePrice: 20.0,
          stockValueAtCost: 5000.0,
          reorderLevel: 50,
          isLowStock: false,
        },
      ],
    })

    const res = await GET(makeReq('http://localhost/api/reports/export?reportType=stock'))
    expect(res.status).toBe(200)

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const wb = XLSX.read(buffer, { type: 'buffer' })
    expect(wb.SheetNames).toContain('Stock Position')
    expect(mockedReportService.getDailyStockPosition).toHaveBeenCalledWith('br-1')
  })

  it('exports near-expiry report as binary .xlsx file with daysThreshold', async () => {
    authUser('br-1')
    mockedReportService.getNearExpiry.mockResolvedValueOnce({
      total: 1,
      data: [
        {
          productName: 'Amoxicillin 250mg',
          sku: 'MED-002',
          batchNumber: 'BATCH-2024A',
          expiryDate: new Date('2026-11-20'),
          daysUntilExpiry: 18,
          availableQuantity: 40,
          mrp: 85.0,
          stockValue: 3400.0,
        },
      ],
    })

    const res = await GET(
      makeReq('http://localhost/api/reports/export?reportType=expiry&daysThreshold=30')
    )
    expect(res.status).toBe(200)

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const wb = XLSX.read(buffer, { type: 'buffer' })
    expect(wb.SheetNames).toContain('Near-Expiry Batches')
    expect(mockedReportService.getNearExpiry).toHaveBeenCalledWith('br-1', 30)
  })

  it('exports consumption report as binary .xlsx file', async () => {
    authUser('br-1')
    mockedReportService.getConsumptionReport.mockResolvedValueOnce({
      total: 1,
      data: [
        {
          productName: 'Metformin 500mg',
          sku: 'MED-003',
          salesConsumed: 120,
          otherConsumed: 5,
          totalConsumed: 125,
        },
      ],
    })

    const res = await GET(
      makeReq('http://localhost/api/reports/export?reportType=consumption&period=monthly')
    )
    expect(res.status).toBe(200)

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const wb = XLSX.read(buffer, { type: 'buffer' })
    expect(wb.SheetNames).toContain('Consumption Register')
    expect(mockedReportService.getConsumptionReport).toHaveBeenCalledWith(
      'br-1',
      expect.any(Date),
      expect.any(Date)
    )
  })

  it('exports statutory Schedule H register as binary .xlsx file', async () => {
    authUser('br-1')
    mockedReportService.getScheduleHRegister.mockResolvedValueOnce({
      total: 1,
      data: [
        {
          date: new Date('2026-11-02'),
          invoiceNumber: 'INV-1099',
          patientName: 'Sunita Devi',
          patientPhone: '9811223344',
          doctorName: 'Dr. Verma',
          doctorRegNumber: 'MCI-5544',
          productName: 'Alprazolam 0.5mg',
          composition: 'Alprazolam',
          schedule: 'H1',
          batchNumber: 'ALP-901',
          expiryDate: new Date('2027-05-31'),
          quantity: 10,
          totalAmount: 145.0,
        },
      ],
    })

    const res = await GET(
      makeReq('http://localhost/api/reports/export?reportType=schedule-h&schedule=H1')
    )
    expect(res.status).toBe(200)

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const wb = XLSX.read(buffer, { type: 'buffer' })
    expect(wb.SheetNames).toContain('Schedule H Register')
    expect(mockedReportService.getScheduleHRegister).toHaveBeenCalledWith(
      'br-1',
      expect.objectContaining({ schedule: 'H1' })
    )
  })

  it('exports gross profit report as binary .xlsx file', async () => {
    authUser('br-1')
    mockedReportService.getGrossProfitReport.mockResolvedValueOnce({
      summary: {
        totalRevenue: 250000,
        totalCogs: 180000,
        grossProfit: 70000,
        profitMarginPercent: 28.0,
      },
      items: [
        {
          productName: 'Atorvastatin 10mg',
          category: 'Cardio',
          quantity: 150,
          saleRevenue: 15000,
          purchaseCost: 9000,
          grossProfit: 6000,
          profitMargin: 40.0,
        },
      ],
    })

    const res = await GET(makeReq('http://localhost/api/reports/export?reportType=gross-profit'))
    expect(res.status).toBe(200)

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const wb = XLSX.read(buffer, { type: 'buffer' })
    expect(wb.SheetNames).toContain('Gross Profit Breakdown')
    expect(mockedReportService.getGrossProfitReport).toHaveBeenCalledWith('br-1', expect.any(Object))
  })

  it('exports doctor referrals performance report as binary .xlsx file', async () => {
    authUser('br-1')
    mockedReportService.getDoctorPerformanceReport.mockResolvedValueOnce([
      {
        name: 'Dr. Rajesh Khanna',
        regNumber: 'DOC-8899',
        qualification: 'MBBS, MD',
        clinicName: 'City Clinic',
        phone: '9822334455',
        prescriptionsCount: 45,
        salesCount: 42,
        totalSalesRevenue: 65400.0,
        totalCommission: 3270.0,
        paidCommission: 3000.0,
        pendingCommission: 270.0,
      },
    ])

    const res = await GET(makeReq('http://localhost/api/reports/export?reportType=doctors'))
    expect(res.status).toBe(200)

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const wb = XLSX.read(buffer, { type: 'buffer' })
    expect(wb.SheetNames).toContain('Doctor Referrals')
    expect(mockedReportService.getDoctorPerformanceReport).toHaveBeenCalled()
  })
})
