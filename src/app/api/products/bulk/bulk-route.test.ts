/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { POST } from '@/app/api/products/bulk/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { executeBulkProductAction } from '@/lib/products/product-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/products/product-service', () => ({
  executeBulkProductAction: jest.fn(),
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedExecuteBulk = executeBulkProductAction as jest.Mock

function makeReq(body: any): NextRequest {
  return new Request('http://localhost/api/products/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe('POST /api/products/bulk', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockedRequirePermission.mockRejectedValueOnce(new Error('Unauthorized'))

    const res = await POST(makeReq({ action: 'activate', productIds: ['p1'] }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when invalid parameters provided', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })

    const res = await POST(makeReq({ action: 'INVALID_ACTION', productIds: [] }))
    expect(res.status).toBe(400)
  })

  it('executes bulk activation successfully', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
    mockedExecuteBulk.mockResolvedValueOnce({ count: 2 })

    const res = await POST(makeReq({ action: 'ACTIVATE', productIds: ['p1', 'p2'] }))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(2)
  })
})
