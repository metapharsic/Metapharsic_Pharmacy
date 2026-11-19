/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { GET } from '@/app/api/products/[id]/substitutes/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { getProductSubstitutes } from '@/lib/products/product-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/products/product-service', () => ({
  getProductSubstitutes: jest.fn(),
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedGetProductSubstitutes = getProductSubstitutes as jest.Mock

function makeReq(): NextRequest {
  return new Request('http://localhost/api/products/p1/substitutes') as unknown as NextRequest
}

describe('GET /api/products/[id]/substitutes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockedRequirePermission.mockRejectedValueOnce(new Error('Unauthorized'))

    const res = await GET(makeReq(), { params: { id: 'p1' } })
    expect(res.status).toBe(401)
  })

  it('returns generic substitutes list', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
    mockedGetProductSubstitutes.mockResolvedValueOnce([
      {
        id: 'sub-1',
        name: 'Moxclav 625',
        genericName: 'Amoxicillin + Clavulanic Acid',
        sku: 'MED-002',
        mrp: '180.00',
        unitOfMeasure: 'Strip',
        totalStock: 50,
        batchCount: 2,
        earliestExpiry: '2027-01-01T00:00:00.000Z',
      },
    ])

    const res = await GET(makeReq(), { params: { id: 'p1' } })
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(1)
    expect(json.data[0].name).toBe('Moxclav 625')
  })
})
