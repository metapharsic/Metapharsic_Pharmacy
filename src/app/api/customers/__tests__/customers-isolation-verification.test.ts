/** @jest-environment node */
/* eslint-disable @typescript-eslint/unbound-method */
import { NextRequest } from 'next/server'

import { GET as customersGET } from '@/app/api/customers/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import prisma from '@/lib/db/prisma'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/db/prisma', () => {
  const customer = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  }
  return {
    __esModule: true,
    default: { customer },
    prisma: { customer },
  }
})

describe('Verification Check: GET /api/customers with user.organizationId: undefined', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 0 customers (total: 0) and zero records when user.organizationId is undefined', async () => {
    // Simulate user with valid permission but unassigned organizationId (falsy bypass attempt)
    ;(requirePermission as jest.Mock).mockResolvedValue({
      id: 'unassigned-user-1',
      isSuperAdmin: false,
      organizationId: undefined,
      permissions: ['customers:read'],
    })

    // Mock prisma to return records only if organizationId is NOT __NO_ACCESS__
    ;(prisma.customer.count as jest.Mock).mockImplementation(async ({ where }) => {
      if (where?.organizationId === '__NO_ACCESS__') return 0
      return 42 // mock leak count if not properly scoped
    })

    ;(prisma.customer.findMany as jest.Mock).mockImplementation(async ({ where }) => {
      if (where?.organizationId === '__NO_ACCESS__') return []
      return [{ id: 'leaked-cust-1', name: 'Leaked Customer' }]
    })

    const req = new NextRequest('http://localhost/api/customers')
    const res = await customersGET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual([])
    expect(body.pagination.total).toBe(0)

    // Verify DB was queried with organizationId: '__NO_ACCESS__'
    expect(prisma.customer.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ organizationId: '__NO_ACCESS__' }),
    })
    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: '__NO_ACCESS__' }),
      })
    )
  })
})
