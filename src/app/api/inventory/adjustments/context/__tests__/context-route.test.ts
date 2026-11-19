/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { GET } from '@/app/api/inventory/adjustments/context/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { prisma } from '@/lib/db/prisma'
import { resolveBranchScope } from '@/lib/inventory/branch-access'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/inventory/branch-access', () => ({
  resolveBranchScope: jest.fn(),
}))

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    product: { findUnique: jest.fn() },
    inventory: { findUnique: jest.fn() },
    batch: { findMany: jest.fn() },
    saleItem: { findFirst: jest.fn() },
    inventoryMovement: { findFirst: jest.fn() },
  },
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedResolveBranchScope = resolveBranchScope as jest.Mock
const prismaMock = prisma as unknown as {
  product: { findUnique: jest.Mock }
  inventory: { findUnique: jest.Mock }
  batch: { findMany: jest.Mock }
  saleItem: { findFirst: jest.Mock }
  inventoryMovement: { findFirst: jest.Mock }
}

function makeReq(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest
}

describe('GET /api/inventory/adjustments/context', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequirePermission.mockResolvedValue({ id: 'u1' })
    mockedResolveBranchScope.mockImplementation((_, b) => Promise.resolve(b ?? 'br-1'))
  })

  it('returns 400 when productId is missing', async () => {
    const res = await GET(makeReq('http://localhost/api/inventory/adjustments/context'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  it('returns 404 when product is not found', async () => {
    prismaMock.product.findUnique.mockResolvedValue(null)
    const res = await GET(
      makeReq('http://localhost/api/inventory/adjustments/context?productId=prod-99')
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  it('returns enriched product context with storage location, batches, vendor and dead stock analysis', async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      name: 'Amoxicillin 500mg',
      sku: 'AMX-500',
      barcode: '8901234567890',
      rack: 'RACK-A',
      shelf: 'Shelf 1',
      box: 'Box 02',
      unitOfMeasure: 'Strip',
      mrp: '120.00',
      costPrice: '84.00',
      ptr: '95.00',
      reorderLevel: 20,
      isActive: true,
    })

    prismaMock.inventory.findUnique.mockResolvedValue({
      availableQuantity: 45,
      totalQuantity: 50,
      reservedQuantity: 5,
      updatedAt: new Date(),
    })

    const expDate = new Date()
    expDate.setDate(expDate.getDate() + 30) // Near expiry (<90 days)

    prismaMock.batch.findMany.mockResolvedValue([
      {
        id: 'batch-1',
        batchNumber: 'BAT-2026-01',
        expiryDate: expDate,
        quantity: 25,
        reservedQuantity: 0,
        purchasePrice: '80.00',
        mrp: '120.00',
        supplier: {
          id: 'supp-1',
          name: 'MedSource Healthcare Pvt Ltd',
          phone: '+91 98765 43210',
          email: 'sales@medsource.com',
        },
      },
    ])

    prismaMock.saleItem.findFirst.mockResolvedValue(null)
    prismaMock.inventoryMovement.findFirst.mockResolvedValue(null)

    const res = await GET(
      makeReq('http://localhost/api/inventory/adjustments/context?productId=prod-1&branchId=br-1')
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.product.name).toBe('Amoxicillin 500mg')
    expect(body.data.product.rack).toBe('RACK-A')
    expect(body.data.product.box).toBe('Box 02')
    expect(body.data.batches).toHaveLength(1)
    expect(body.data.batches[0].isNearExpiry).toBe(true)
    expect(body.data.batches[0].supplier.name).toBe('MedSource Healthcare Pvt Ltd')
    expect(body.data.recommendations.length).toBeGreaterThan(0)
  })
})
