/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { GET, PATCH } from '@/app/api/inventory/locations/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { getRackBoxMatrix, updateProductLocation } from '@/lib/inventory/inventory-analytics-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/inventory/branch-access', () => ({
  resolveBranchScope: jest.fn(),
}))

jest.mock('@/lib/inventory/inventory-analytics-service', () => ({
  getRackBoxMatrix: jest.fn(),
  updateProductLocation: jest.fn(),
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedResolveBranchScope = resolveBranchScope as jest.Mock
const mockedGetRackBoxMatrix = getRackBoxMatrix as jest.Mock
const mockedUpdateProductLocation = updateProductLocation as jest.Mock

function makeReq(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest
}

describe('Locations API (/api/inventory/locations)', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('GET /api/inventory/locations', () => {
    it('returns physical racks and boxes tree', async () => {
      mockedRequirePermission.mockResolvedValueOnce({ id: 'u1', branchId: 'br-1' })
      mockedResolveBranchScope.mockResolvedValueOnce('br-1')
      mockedGetRackBoxMatrix.mockResolvedValueOnce({
        racks: [
          {
            rackName: 'RACK-A',
            totalProducts: 4,
            totalUnits: 120,
            shelves: [],
          },
        ],
        unassignedCount: 0,
        unassignedProducts: [],
      })

      const res = await GET(makeReq('http://localhost/api/inventory/locations?branchId=br-1'))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.racks[0].rackName).toBe('RACK-A')
    })
  })

  describe('PATCH /api/inventory/locations', () => {
    it('updates rack, shelf, and box storage location for a product', async () => {
      mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
      mockedUpdateProductLocation.mockResolvedValueOnce({
        id: 'p-1',
        name: 'Paracetamol 500mg',
        sku: 'SKU-PCM',
        rack: 'RACK-A',
        shelf: 'Shelf 1',
        box: 'Box 02',
      })

      const res = await PATCH(
        makeReq('http://localhost/api/inventory/locations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: 'p-1',
            rack: 'RACK-A',
            shelf: 'Shelf 1',
            box: 'Box 02',
          }),
        })
      )

      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.rack).toBe('RACK-A')
      expect(body.data.box).toBe('Box 02')
      expect(mockedUpdateProductLocation).toHaveBeenCalledWith('p-1', {
        rack: 'RACK-A',
        shelf: 'Shelf 1',
        box: 'Box 02',
      })
    })

    it('returns 400 when productId is missing', async () => {
      mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
      const res = await PATCH(
        makeReq('http://localhost/api/inventory/locations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rack: 'RACK-A' }),
        })
      )
      expect(res.status).toBe(400)
    })
  })
})
