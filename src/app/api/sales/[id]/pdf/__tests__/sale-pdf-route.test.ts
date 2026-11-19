/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { GET } from '@/app/api/sales/[id]/pdf/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { getSaleById } from '@/lib/sales/sales-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/inventory/branch-access', () => ({
  resolveBranchScope: jest.fn(),
}))

jest.mock('@/lib/sales/sales-service', () => ({
  getSaleById: jest.fn(),
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedResolveBranchScope = resolveBranchScope as jest.Mock
const mockedGetSaleById = getSaleById as jest.Mock

function makeReq(url: string, init?: RequestInit): NextRequest {
  const req = new Request(url, init) as unknown as NextRequest
  return req
}

describe('GET /api/sales/[id]/pdf', () => {
  const sampleSale = {
    id: 'sale-001',
    invoiceNumber: 'INV-2026-001',
    saleDate: new Date('2026-11-02T10:00:00Z'),
    subtotal: 500,
    discountAmount: 0,
    taxAmount: 60,
    totalAmount: 560,
    amountPaid: 560,
    paymentStatus: 'PAID',
    customer: { name: 'Vikram Seth', phone: '9876543210' },
    branch: { name: 'Central Branch', gstin: '29ABCDE1234F1Z5' },
    items: [
      {
        productName: 'Metformin 500mg',
        quantity: 2,
        unitPrice: 250,
        totalAmount: 560,
        taxPercent: 12,
        hsnCode: '3004',
        batchNumber: 'MET-10',
        expiryDate: '2027-01-01',
      },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when user is unauthenticated', async () => {
    mockedRequirePermission.mockRejectedValueOnce(new Error('Unauthorized'))

    const req = makeReq('http://localhost/api/sales/sale-001/pdf')
    const res = await GET(req, { params: { id: 'sale-001' } })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  it('returns 403 when user lacks sales:read permission', async () => {
    mockedRequirePermission.mockRejectedValueOnce(
      new Error("Forbidden: requires permission 'sales:read'")
    )

    const req = makeReq('http://localhost/api/sales/sale-001/pdf')
    const res = await GET(req, { params: { id: 'sale-001' } })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  it('returns 404 when sale does not exist', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'user-1', roles: ['cashier'] })
    mockedResolveBranchScope.mockResolvedValueOnce('branch-1')
    mockedGetSaleById.mockRejectedValueOnce(new Error('Not Found: sale'))

    const req = makeReq('http://localhost/api/sales/non-existent/pdf')
    const res = await GET(req, { params: { id: 'non-existent' } })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  it('returns 200 with application/pdf and binary PDF buffer for A4 format', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'user-1', roles: ['pharmacist'] })
    mockedResolveBranchScope.mockResolvedValueOnce('branch-1')
    mockedGetSaleById.mockResolvedValueOnce(sampleSale)

    const req = makeReq('http://localhost/api/sales/sale-001/pdf')
    const res = await GET(req, { params: { id: 'sale-001' } })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('inline')
    expect(res.headers.get('Content-Disposition')).toContain('Invoice-INV-2026-001-Invoice.pdf')

    const arrayBuf = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuf)
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })

  it('handles ?format=thermal80 and ?download=true query parameters', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'user-1', roles: ['pharmacist'] })
    mockedResolveBranchScope.mockResolvedValueOnce('branch-1')
    mockedGetSaleById.mockResolvedValueOnce(sampleSale)

    const req = makeReq('http://localhost/api/sales/sale-001/pdf?format=thermal80&download=true')
    const res = await GET(req, { params: { id: 'sale-001' } })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('attachment')
    expect(res.headers.get('Content-Disposition')).toContain('Invoice-INV-2026-001-Slip.pdf')

    const arrayBuf = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuf)
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })
})
