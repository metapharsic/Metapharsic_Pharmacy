/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { GET } from '@/app/api/products/[id]/rate-history/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { getProductRateHistory } from '@/lib/products/product-analytics-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/products/product-analytics-service', () => ({
  getProductRateHistory: jest.fn(),
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedGetProductRateHistory = getProductRateHistory as jest.Mock

function makeReq(): NextRequest {
  return new Request('http://localhost/api/products/p1/rate-history') as unknown as NextRequest
}

describe('GET /api/products/[id]/rate-history', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockedRequirePermission.mockRejectedValueOnce(new Error('Unauthorized'))

    const res = await GET(makeReq(), { params: { id: 'p1' } })
    expect(res.status).toBe(401)
  })

  it('returns 404 when product is not found', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
    mockedGetProductRateHistory.mockResolvedValueOnce(null)

    const res = await GET(makeReq(), { params: { id: 'p1' } })
    expect(res.status).toBe(404)
  })

  it('returns batch rate history report', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
    mockedGetProductRateHistory.mockResolvedValueOnce({
      productId: 'p1',
      productName: 'Paracetamol 500mg',
      sku: 'MED-001',
      genericName: 'Paracetamol',
      manufacturer: 'Apex Pharma',
      currentMrp: 30.0,
      currentCostPrice: 20.0,
      gstRate: 12,
      batches: [
        {
          id: 'b1',
          batchNumber: 'LOT-2026-A',
          purchasePrice: 20.0,
          mrp: 30.0,
          marginPercent: 33.3,
          quantity: 100,
          availableQuantity: 80,
          expiryDate: '2027-01-01T00:00:00.000Z',
          manufacturingDate: '2025-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
          status: 'ACTIVE',
        },
      ],
      averageCostPrice: 20.0,
      averageMarginPercent: 33.3,
      priceVariationPercent: 0,
    })

    const res = await GET(makeReq(), { params: { id: 'p1' } })
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.productName).toBe('Paracetamol 500mg')
    expect(json.data.batches).toHaveLength(1)
    expect(json.data.averageMarginPercent).toBe(33.3)
  })
})
