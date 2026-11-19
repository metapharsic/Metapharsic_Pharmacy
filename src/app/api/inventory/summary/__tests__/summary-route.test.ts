/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { GET } from '@/app/api/inventory/summary/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { getInventorySummary } from '@/lib/inventory/inventory-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/inventory/branch-access', () => ({
  resolveBranchScope: jest.fn(),
}))

jest.mock('@/lib/inventory/inventory-service', () => ({
  getInventorySummary: jest.fn(),
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedResolveBranchScope = resolveBranchScope as jest.Mock
const mockedGetInventorySummary = getInventorySummary as jest.Mock

function makeReq(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest
}

describe('GET /api/inventory/summary', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockedRequirePermission.mockRejectedValueOnce(new Error('Unauthorized'))
    const res = await GET(makeReq('http://localhost/api/inventory/summary'))
    expect(res.status).toBe(401)
  })

  it('returns 403 when user lacks branch access', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'u1', branchId: null })
    mockedResolveBranchScope.mockRejectedValueOnce(new Error('Forbidden: no access to branch'))
    const res = await GET(makeReq('http://localhost/api/inventory/summary?branchId=br-forbidden'))
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.error.code).toBe('ERROR')
  })

  it('returns inventory summary metrics', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'u1', branchId: 'br-1' })
    mockedResolveBranchScope.mockResolvedValueOnce('br-1')
    mockedGetInventorySummary.mockResolvedValueOnce({
      totalSkus: 42,
      totalUnits: 1200,
      reservedUnits: 25,
      availableUnits: 1175,
      lowStockCount: 4,
      outOfStockCount: 1,
      valuationAtCost: 45000,
      valuationAtMrp: 62000,
      potentialGrossProfit: 17000,
      marginPercent: 27.4,
      nearExpiryBatchesCount: 3,
      expiredBatchesCount: 0,
      pendingAdjustmentsCount: 2,
    })

    const res = await GET(makeReq('http://localhost/api/inventory/summary?branchId=br-1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.totalSkus).toBe(42)
    expect(body.data.valuationAtMrp).toBe(62000)
    expect(mockedGetInventorySummary).toHaveBeenCalledWith('br-1')
  })
})
