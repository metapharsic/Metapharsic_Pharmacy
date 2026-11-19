/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { GET, POST } from '@/app/api/products/[id]/reorder/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { calculateProductIndent } from '@/lib/products/product-analytics-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/products/product-analytics-service', () => ({
  calculateProductIndent: jest.fn(),
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedCalculateIndent = calculateProductIndent as jest.Mock

function makeReq(method = 'GET', body?: any): NextRequest {
  return new Request('http://localhost/api/products/p1/reorder', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest
}

describe('/api/products/[id]/reorder', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET returns 401 when unauthenticated', async () => {
    mockedRequirePermission.mockRejectedValueOnce(new Error('Unauthorized'))

    const res = await GET(makeReq('GET'), { params: { id: 'p1' } })
    expect(res.status).toBe(401)
  })

  it('GET returns indent recommendation', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
    mockedCalculateIndent.mockResolvedValueOnce({
      productId: 'p1',
      productName: 'Paracetamol 500mg',
      sku: 'MED-001',
      currentStock: 5,
      minStockLevel: 20,
      suggestedReorderQuantity: 35,
      estimatedCostPrice: 20.0,
      estimatedOrderValue: 700.0,
      unitOfMeasure: 'Strip',
      preferredSupplierId: null,
    })

    const res = await GET(makeReq('GET'), { params: { id: 'p1' } })
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.suggestedReorderQuantity).toBe(35)
  })

  it('POST creates quick purchase indent', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
    mockedCalculateIndent.mockResolvedValueOnce({
      productId: 'p1',
      productName: 'Paracetamol 500mg',
      sku: 'MED-001',
      currentStock: 5,
      minStockLevel: 20,
      suggestedReorderQuantity: 35,
      estimatedCostPrice: 20.0,
      estimatedOrderValue: 700.0,
      unitOfMeasure: 'Strip',
      preferredSupplierId: null,
    })

    const res = await POST(makeReq('POST', { quantity: 50 }), { params: { id: 'p1' } })
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.quantity).toBe(50)
    expect(json.data.status).toBe('SUBMITTED')
  })
})
