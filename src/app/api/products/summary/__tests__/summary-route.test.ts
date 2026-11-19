/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { GET } from '@/app/api/products/summary/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { getCatalogSummaryMetrics } from '@/lib/products/product-analytics-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/products/product-analytics-service', () => ({
  getCatalogSummaryMetrics: jest.fn(),
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedGetCatalogSummaryMetrics = getCatalogSummaryMetrics as jest.Mock

function makeReq(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest
}

describe('GET /api/products/summary', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockedRequirePermission.mockRejectedValueOnce(new Error('Unauthorized'))
    const res = await GET(makeReq('http://localhost/api/products/summary'))
    expect(res.status).toBe(401)
  })

  it('returns 403 when forbidden', async () => {
    mockedRequirePermission.mockRejectedValueOnce(
      new Error("Forbidden: requires permission 'products:read'")
    )
    const res = await GET(makeReq('http://localhost/api/products/summary'))
    expect(res.status).toBe(403)
  })

  it('returns catalog summary metrics successfully', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
    mockedGetCatalogSummaryMetrics.mockResolvedValueOnce({
      totalProducts: 45,
      totalInStockUnits: 6920,
      totalValuationCost: 376000,
      totalValuationMrp: 592500,
      overallMarginPercent: 36.5,
      lowStockCount: 9,
      outOfStockCount: 2,
      nearExpiryCount: 2,
      scheduleHCount: 18,
      manufacturerCount: 12,
    })

    const res = await GET(makeReq('http://localhost/api/products/summary'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.totalProducts).toBe(45)
    expect(body.data.totalInStockUnits).toBe(6920)
  })
})
