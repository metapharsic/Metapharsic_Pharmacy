/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { GET } from '@/app/api/inventory/vendor-stock/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { getVendorInventoryReport } from '@/lib/inventory/inventory-analytics-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/inventory/branch-access', () => ({
  resolveBranchScope: jest.fn(),
}))

jest.mock('@/lib/inventory/inventory-analytics-service', () => ({
  getVendorInventoryReport: jest.fn(),
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedResolveBranchScope = resolveBranchScope as jest.Mock
const mockedGetVendorInventoryReport = getVendorInventoryReport as jest.Mock

function makeReq(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest
}

describe('GET /api/inventory/vendor-stock', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockedRequirePermission.mockRejectedValueOnce(new Error('Unauthorized'))
    const res = await GET(makeReq('http://localhost/api/inventory/vendor-stock'))
    expect(res.status).toBe(401)
  })

  it('returns vendor inventory rollups', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'u1', branchId: 'br-1' })
    mockedResolveBranchScope.mockResolvedValueOnce('br-1')
    mockedGetVendorInventoryReport.mockResolvedValueOnce([
      {
        supplierId: 's-1',
        supplierName: 'Cipla Healthcare',
        totalSkus: 5,
        totalAvailableUnits: 250,
        totalValuationAtCost: 15000,
        nearExpiryUnitsCount: 20,
      },
    ])

    const res = await GET(makeReq('http://localhost/api/inventory/vendor-stock?branchId=br-1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data[0].supplierName).toBe('Cipla Healthcare')
    expect(mockedGetVendorInventoryReport).toHaveBeenCalledWith({
      branchId: 'br-1',
      supplierId: undefined,
    })
  })
})
