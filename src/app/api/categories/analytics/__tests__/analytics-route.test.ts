/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { GET } from '@/app/api/categories/analytics/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { getCategoryAnalytics } from '@/lib/categories/category-analytics-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/categories/category-analytics-service', () => ({
  getCategoryAnalytics: jest.fn(),
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedGetCategoryAnalytics = getCategoryAnalytics as jest.Mock

function makeReq(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest
}

describe('GET /api/categories/analytics', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockedRequirePermission.mockRejectedValueOnce(new Error('Unauthorized'))
    const res = await GET(makeReq('http://localhost/api/categories/analytics'))
    expect(res.status).toBe(401)
  })

  it('returns 403 when forbidden', async () => {
    mockedRequirePermission.mockRejectedValueOnce(
      new Error("Forbidden: requires permission 'products:read'")
    )
    const res = await GET(makeReq('http://localhost/api/categories/analytics'))
    expect(res.status).toBe(403)
  })

  it('returns analytics rollup data successfully', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
    mockedGetCategoryAnalytics.mockResolvedValueOnce({
      grandTotals: {
        totalCategories: 10,
        totalProductsMapped: 36,
        totalInventoryUnits: 1250,
        totalValuationCost: 45000,
        totalValuationMrp: 68000,
        totalPotentialGrossProfit: 23000,
        overallMarginPercent: 33.8,
        totalNearExpiryBatches: 2,
        totalLowStockProducts: 1,
      },
      categoryMetrics: {},
    })

    const res = await GET(makeReq('http://localhost/api/categories/analytics'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.grandTotals.totalValuationMrp).toBe(68000)
  })
})
