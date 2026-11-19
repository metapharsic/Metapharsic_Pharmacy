/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { GET } from '@/app/api/inventory/dead-stock/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { getDeadStockReport } from '@/lib/inventory/inventory-analytics-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/inventory/branch-access', () => ({
  resolveBranchScope: jest.fn(),
}))

jest.mock('@/lib/inventory/inventory-analytics-service', () => ({
  getDeadStockReport: jest.fn(),
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedResolveBranchScope = resolveBranchScope as jest.Mock
const mockedGetDeadStockReport = getDeadStockReport as jest.Mock

function makeReq(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest
}

describe('GET /api/inventory/dead-stock', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthorized', async () => {
    mockedRequirePermission.mockRejectedValueOnce(new Error('Unauthorized'))
    const res = await GET(makeReq('http://localhost/api/inventory/dead-stock'))
    expect(res.status).toBe(401)
  })

  it('returns dead stock results with summary metrics', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'u1', branchId: 'br-1' })
    mockedResolveBranchScope.mockResolvedValueOnce('br-1')
    mockedGetDeadStockReport.mockResolvedValueOnce({
      deadItems: [
        {
          productId: 'p-1',
          productName: 'Slow Syrup 100ml',
          capitalLockedAtCost: 4000,
          daysInactive: 95,
        },
      ],
      summary: {
        totalDeadItemsCount: 1,
        totalDeadCapitalAtCost: 4000,
        totalDeadCapitalAtMrp: 6000,
      },
    })

    const res = await GET(makeReq('http://localhost/api/inventory/dead-stock?branchId=br-1&thresholdDays=90'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.summary.totalDeadCapitalAtCost).toBe(4000)
    expect(mockedGetDeadStockReport).toHaveBeenCalledWith({
      branchId: 'br-1',
      thresholdDays: 90,
    })
  })
})
