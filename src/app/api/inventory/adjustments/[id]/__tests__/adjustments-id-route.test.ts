/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { DELETE, GET, PATCH } from '@/app/api/inventory/adjustments/[id]/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { prisma } from '@/lib/db/prisma'
import { assertBranchAccess } from '@/lib/inventory/branch-access'
import { deleteAdjustment, updateAdjustment } from '@/lib/inventory/inventory-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/inventory/branch-access', () => ({
  assertBranchAccess: jest.fn(),
}))

jest.mock('@/lib/inventory/inventory-service', () => ({
  updateAdjustment: jest.fn(),
  deleteAdjustment: jest.fn(),
}))

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    stockAdjustment: { findUnique: jest.fn() },
    product: { findUnique: jest.fn() },
    branch: { findUnique: jest.fn() },
    batch: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedAssertBranchAccess = assertBranchAccess as jest.Mock
const mockedUpdateAdjustment = updateAdjustment as jest.Mock
const mockedDeleteAdjustment = deleteAdjustment as jest.Mock
const prismaMock = prisma as unknown as {
  stockAdjustment: { findUnique: jest.Mock }
  product: { findUnique: jest.Mock }
  branch: { findUnique: jest.Mock }
  batch: { findUnique: jest.Mock }
  auditLog: { create: jest.Mock }
}

function makeReq(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest
}

describe('Adjustments [id] routes', () => {
  const user = { id: 'u1', branchId: 'br-1' }

  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequirePermission.mockResolvedValue(user)
    mockedAssertBranchAccess.mockResolvedValue(undefined)
  })

  describe('GET /api/inventory/adjustments/:id', () => {
    it('returns 404 when adjustment does not exist', async () => {
      prismaMock.stockAdjustment.findUnique.mockResolvedValue(null)
      const res = await GET(makeReq('http://localhost/api/inventory/adjustments/adj-99'), {
        params: { id: 'adj-99' },
      })
      expect(res.status).toBe(404)
    })

    it('returns full adjustment detail with valuation impact', async () => {
      prismaMock.stockAdjustment.findUnique.mockResolvedValue({
        id: 'adj-1',
        branchId: 'br-1',
        productId: 'prod-1',
        quantity: -5,
        status: 'PENDING',
        adjustmentType: 'PHYSICAL_COUNT',
      })

      prismaMock.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Paracetamol 500mg',
        costPrice: '10.00',
        mrp: '15.00',
      })

      prismaMock.branch.findUnique.mockResolvedValue({ id: 'br-1', name: 'Branch A' })

      const res = await GET(makeReq('http://localhost/api/inventory/adjustments/adj-1'), {
        params: { id: 'adj-1' },
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.costImpact).toBe(-50)
      expect(body.data.mrpImpact).toBe(-75)
    })
  })

  describe('PATCH /api/inventory/adjustments/:id', () => {
    it('updates adjustment quantity and audit log', async () => {
      mockedUpdateAdjustment.mockResolvedValue({
        id: 'adj-1',
        quantity: -8,
        reason: 'Updated count',
        status: 'PENDING',
      })

      const res = await PATCH(
        makeReq('http://localhost/api/inventory/adjustments/adj-1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantity: -8,
            reason: 'Updated count',
          }),
        }),
        { params: { id: 'adj-1' } }
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.quantity).toBe(-8)
      expect(prismaMock.auditLog.create).toHaveBeenCalled()
    })
  })

  describe('DELETE /api/inventory/adjustments/:id', () => {
    it('deletes or reverses adjustment and logs audit', async () => {
      mockedDeleteAdjustment.mockResolvedValue({
        id: 'adj-1',
        success: true,
        message: 'Adjustment deleted',
      })

      const res = await DELETE(makeReq('http://localhost/api/inventory/adjustments/adj-1'), {
        params: { id: 'adj-1' },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(prismaMock.auditLog.create).toHaveBeenCalled()
    })
  })
})
