/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { DELETE, GET, PATCH, POST } from '@/app/api/inventory/racks/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import {
  createRack,
  deleteRack,
  getStorageLocations,
  modifyRack,
} from '@/lib/inventory/rack-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/inventory/branch-access', () => ({
  resolveBranchScope: jest.fn(),
}))

jest.mock('@/lib/inventory/rack-service', () => ({
  createRack: jest.fn(),
  modifyRack: jest.fn(),
  deleteRack: jest.fn(),
  getStorageLocations: jest.fn(),
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedResolveBranchScope = resolveBranchScope as jest.Mock
const mockedCreateRack = createRack as jest.Mock
const mockedModifyRack = modifyRack as jest.Mock
const mockedDeleteRack = deleteRack as jest.Mock
const mockedGetStorageLocations = getStorageLocations as jest.Mock

function makeReq(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest
}

describe('Racks API Routes (/api/inventory/racks)', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('GET /api/inventory/racks', () => {
    it('returns 401 when unauthorized', async () => {
      mockedRequirePermission.mockRejectedValueOnce(new Error('Unauthorized'))
      const res = await GET(makeReq('http://localhost/api/inventory/racks'))
      expect(res.status).toBe(401)
    })

    it('returns storage locations list', async () => {
      mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
      mockedResolveBranchScope.mockResolvedValueOnce('br-1')
      mockedGetStorageLocations.mockResolvedValueOnce([
        { id: 'loc-1', rack: 'RACK-A', shelf: 'Shelf 1', box: 'Box 01', type: 'GENERAL' },
      ])

      const res = await GET(makeReq('http://localhost/api/inventory/racks?branchId=br-1'))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].rack).toBe('RACK-A')
    })
  })

  describe('POST /api/inventory/racks', () => {
    it('creates a new storage rack successfully', async () => {
      mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
      mockedResolveBranchScope.mockResolvedValueOnce('br-1')
      mockedCreateRack.mockResolvedValueOnce({
        id: 'loc-1',
        rack: 'RACK-E',
        shelf: 'Shelf 1',
        box: 'Box 01',
        type: 'REFRIGERATED',
      })

      const res = await POST(
        makeReq('http://localhost/api/inventory/racks', {
          method: 'POST',
          body: JSON.stringify({
            rack: 'RACK-E',
            shelf: 'Shelf 1',
            box: 'Box 01',
            type: 'REFRIGERATED',
          }),
        })
      )

      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.rack).toBe('RACK-E')
    })

    it('validates rack name presence', async () => {
      mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
      const res = await POST(
        makeReq('http://localhost/api/inventory/racks', {
          method: 'POST',
          body: JSON.stringify({ rack: '' }),
        })
      )
      expect(res.status).toBe(400)
    })
  })

  describe('PATCH /api/inventory/racks', () => {
    it('renames a rack and returns cascade updates count', async () => {
      mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
      mockedResolveBranchScope.mockResolvedValueOnce('br-1')
      mockedModifyRack.mockResolvedValueOnce({
        success: true,
        oldRack: 'RACK-A',
        newRack: 'RACK-A1',
        productsUpdated: 14,
      })

      const res = await PATCH(
        makeReq('http://localhost/api/inventory/racks', {
          method: 'PATCH',
          body: JSON.stringify({
            oldRackName: 'RACK-A',
            newRackName: 'RACK-A1',
          }),
        })
      )

      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.productsUpdated).toBe(14)
    })
  })

  describe('DELETE /api/inventory/racks', () => {
    it('deletes a rack successfully', async () => {
      mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
      mockedResolveBranchScope.mockResolvedValueOnce('br-1')
      mockedDeleteRack.mockResolvedValueOnce({
        success: true,
        deletedRack: 'RACK-X',
        locationsRemoved: 1,
        productsReassigned: 5,
      })

      const res = await DELETE(
        makeReq('http://localhost/api/inventory/racks', {
          method: 'DELETE',
          body: JSON.stringify({
            rackName: 'RACK-X',
          }),
        })
      )

      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.deletedRack).toBe('RACK-X')
    })
  })
})
