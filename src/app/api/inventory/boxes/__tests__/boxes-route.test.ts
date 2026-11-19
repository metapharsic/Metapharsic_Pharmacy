/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { DELETE, PATCH, POST } from '@/app/api/inventory/boxes/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import {
  createBox,
  deleteBox,
  modifyBox,
} from '@/lib/inventory/rack-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/inventory/branch-access', () => ({
  resolveBranchScope: jest.fn(),
}))

jest.mock('@/lib/inventory/rack-service', () => ({
  createBox: jest.fn(),
  modifyBox: jest.fn(),
  deleteBox: jest.fn(),
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedResolveBranchScope = resolveBranchScope as jest.Mock
const mockedCreateBox = createBox as jest.Mock
const mockedModifyBox = modifyBox as jest.Mock
const mockedDeleteBox = deleteBox as jest.Mock

function makeReq(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest
}

describe('Boxes API Routes (/api/inventory/boxes)', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('POST /api/inventory/boxes', () => {
    it('creates a new box in a shelf', async () => {
      mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
      mockedResolveBranchScope.mockResolvedValueOnce('br-1')
      mockedCreateBox.mockResolvedValueOnce({
        id: 'box-1',
        rack: 'RACK-A',
        shelf: 'Shelf 1',
        box: 'Box 03',
        capacity: 50,
      })

      const res = await POST(
        makeReq('http://localhost/api/inventory/boxes', {
          method: 'POST',
          body: JSON.stringify({
            rack: 'RACK-A',
            shelf: 'Shelf 1',
            box: 'Box 03',
            capacity: 50,
          }),
        })
      )

      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.box).toBe('Box 03')
    })

    it('validates required fields', async () => {
      mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
      const res = await POST(
        makeReq('http://localhost/api/inventory/boxes', {
          method: 'POST',
          body: JSON.stringify({ rack: 'RACK-A', shelf: '' }),
        })
      )
      expect(res.status).toBe(400)
    })
  })

  describe('PATCH /api/inventory/boxes', () => {
    it('renames a box and cascades update count', async () => {
      mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
      mockedResolveBranchScope.mockResolvedValueOnce('br-1')
      mockedModifyBox.mockResolvedValueOnce({
        success: true,
        rack: 'RACK-A',
        shelf: 'Shelf 1',
        oldBox: 'Box 01',
        newBox: 'Box 01-Antibiotics',
        productsUpdated: 8,
      })

      const res = await PATCH(
        makeReq('http://localhost/api/inventory/boxes', {
          method: 'PATCH',
          body: JSON.stringify({
            rack: 'RACK-A',
            shelf: 'Shelf 1',
            oldBoxName: 'Box 01',
            newBoxName: 'Box 01-Antibiotics',
          }),
        })
      )

      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.productsUpdated).toBe(8)
    })
  })

  describe('DELETE /api/inventory/boxes', () => {
    it('deletes a box and reports reassigned count', async () => {
      mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
      mockedResolveBranchScope.mockResolvedValueOnce('br-1')
      mockedDeleteBox.mockResolvedValueOnce({
        success: true,
        deletedBox: 'Box 02',
        locationsRemoved: 1,
        productsReassigned: 4,
      })

      const res = await DELETE(
        makeReq('http://localhost/api/inventory/boxes', {
          method: 'DELETE',
          body: JSON.stringify({
            rack: 'RACK-A',
            shelf: 'Shelf 1',
            boxName: 'Box 02',
          }),
        })
      )

      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.deletedBox).toBe('Box 02')
    })
  })
})
