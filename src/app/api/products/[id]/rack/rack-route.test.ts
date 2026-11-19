/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { PATCH } from '@/app/api/products/[id]/rack/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { updateProductRack } from '@/lib/products/product-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/products/product-service', () => ({
  updateProductRack: jest.fn(),
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedUpdateProductRack = updateProductRack as jest.Mock

function makeReq(body: any): NextRequest {
  return new Request('http://localhost/api/products/p1/rack', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe('PATCH /api/products/[id]/rack', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockedRequirePermission.mockRejectedValueOnce(new Error('Unauthorized'))

    const res = await PATCH(makeReq({ rack: 'RACK-B1' }), { params: { id: 'p1' } })
    expect(res.status).toBe(401)
  })

  it('updates rack location successfully', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
    mockedUpdateProductRack.mockResolvedValueOnce({
      id: 'p1',
      name: 'Amoxicillin 500mg',
      rack: 'RACK-B1',
    })

    const res = await PATCH(makeReq({ rack: 'RACK-B1' }), { params: { id: 'p1' } })
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.rack).toBe('RACK-B1')
    expect(mockedUpdateProductRack).toHaveBeenCalledWith('p1', 'RACK-B1')
  })
})
