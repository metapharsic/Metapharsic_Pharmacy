/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { POST as cancelPost } from '@/app/api/sales/[id]/cancel/route'
import { DELETE, PATCH } from '@/app/api/sales/[id]/route'
import { requireAuth } from '@/lib/auth/auth-helpers'
import { cancelSale, editSale } from '@/lib/sales/sales-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requireAuth: jest.fn(),
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/inventory/branch-access', () => ({
  resolveBranchScope: jest.fn().mockResolvedValue({ allBranches: true }),
}))

jest.mock('@/lib/sales/sales-service', () => ({
  editSale: jest.fn(),
  cancelSale: jest.fn(),
  getSaleById: jest.fn(),
}))

const mockedRequireAuth = requireAuth as jest.Mock
const mockedEditSale = editSale as jest.Mock
const mockedCancelSale = cancelSale as jest.Mock

function makeReq(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest
}

describe('Sales RBAC Routes Lockdown (Requirement R4)', () => {
  const cashierUser = {
    id: 'cashier-1',
    branchId: 'branch-1',
    permissions: ['sales:create', 'sales:read', 'invoices:print'],
    roles: ['cashier'],
  }

  const pharmacistUser = {
    id: 'pharma-1',
    branchId: 'branch-1',
    permissions: ['sales:create', 'sales:read', 'sales:discount'],
    roles: ['pharmacist'],
  }

  const adminUser = {
    id: 'admin-1',
    branchId: 'branch-1',
    permissions: ['sales:void'],
    roles: ['admin'],
  }

  const managerUser = {
    id: 'mgr-1',
    branchId: 'branch-1',
    permissions: ['sales:read'],
    roles: ['manager'],
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('PATCH /api/sales/:id (Bill Modification)', () => {
    it('returns 403 Forbidden when called by a Cashier', async () => {
      mockedRequireAuth.mockResolvedValue(cashierUser)

      const req = makeReq('http://localhost:5888/api/sales/sale-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [{ saleItemId: 'item-1', quantity: 1 }],
          reason: 'Cashier attempt',
        }),
      })

      const res = await PATCH(req, { params: { id: 'sale-1' } })
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('FORBIDDEN')
      expect(mockedEditSale).not.toHaveBeenCalled()
    })

    it('returns 403 Forbidden when called by a Pharmacist without sales:void', async () => {
      mockedRequireAuth.mockResolvedValue(pharmacistUser)

      const req = makeReq('http://localhost:5888/api/sales/sale-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [{ saleItemId: 'item-1', quantity: 1 }],
          reason: 'Pharmacist attempt',
        }),
      })

      const res = await PATCH(req, { params: { id: 'sale-1' } })
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('FORBIDDEN')
      expect(mockedEditSale).not.toHaveBeenCalled()
    })

    it('returns 200 OK and edits sale when called by an Admin', async () => {
      mockedRequireAuth.mockResolvedValue(adminUser)
      const updatedSale = { id: 'sale-1', invoiceNumber: 'INV-001', totalAmount: 150 }
      mockedEditSale.mockResolvedValue(updatedSale)

      const req = makeReq('http://localhost:5888/api/sales/sale-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [{ saleItemId: 'item-1', quantity: 1 }],
          reason: 'Admin correction',
          refundCashDifference: true,
        }),
      })

      const res = await PATCH(req, { params: { id: 'sale-1' } })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data).toEqual(updatedSale)
      expect(mockedEditSale).toHaveBeenCalledWith(
        {
          saleId: 'sale-1',
          items: [{ saleItemId: 'item-1', quantity: 1 }],
          reason: 'Admin correction',
          refundCashDifference: true,
        },
        expect.objectContaining({ id: adminUser.id })
      )
    })
  })

  describe('DELETE /api/sales/:id (Bill Cancellation & Stock Reversal)', () => {
    it('returns 403 Forbidden when called by a Cashier', async () => {
      mockedRequireAuth.mockResolvedValue(cashierUser)

      const req = makeReq('http://localhost:5888/api/sales/sale-1', {
        method: 'DELETE',
      })

      const res = await DELETE(req, { params: { id: 'sale-1' } })
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('FORBIDDEN')
      expect(mockedCancelSale).not.toHaveBeenCalled()
    })

    it('returns 200 OK and cancels sale when called by an Admin with JSON body reason', async () => {
      mockedRequireAuth.mockResolvedValue(adminUser)
      mockedCancelSale.mockResolvedValue(undefined)

      const req = makeReq('http://localhost:5888/api/sales/sale-1', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Customer returned all items' }),
      })

      const res = await DELETE(req, { params: { id: 'sale-1' } })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.message).toBe('Sale cancelled and inventory restored')
      expect(mockedCancelSale).toHaveBeenCalledWith(
        'sale-1',
        'Customer returned all items',
        expect.objectContaining({ id: adminUser.id })
      )
    })

    it('returns 200 OK and cancels sale when called by a Manager with query parameter reason', async () => {
      mockedRequireAuth.mockResolvedValue(managerUser)
      mockedCancelSale.mockResolvedValue(undefined)

      const req = makeReq('http://localhost:5888/api/sales/sale-2?reason=Mistake%20by%20staff', {
        method: 'DELETE',
      })

      const res = await DELETE(req, { params: { id: 'sale-2' } })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.message).toBe('Sale cancelled and inventory restored')
      expect(mockedCancelSale).toHaveBeenCalledWith(
        'sale-2',
        'Mistake by staff',
        expect.objectContaining({ id: managerUser.id })
      )
    })
  })

  describe('POST /api/sales/:id/cancel', () => {
    it('returns 403 Forbidden for Cashiers', async () => {
      mockedRequireAuth.mockResolvedValue(cashierUser)

      const req = makeReq('http://localhost:5888/api/sales/sale-1/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancel attempt' }),
      })

      const res = await cancelPost(req, { params: { id: 'sale-1' } })
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('FORBIDDEN')
      expect(mockedCancelSale).not.toHaveBeenCalled()
    })

    it('returns 200 OK for Admin', async () => {
      mockedRequireAuth.mockResolvedValue(adminUser)
      mockedCancelSale.mockResolvedValue(undefined)

      const req = makeReq('http://localhost:5888/api/sales/sale-1/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin cancel request' }),
      })

      const res = await cancelPost(req, { params: { id: 'sale-1' } })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(mockedCancelSale).toHaveBeenCalledWith(
        'sale-1',
        'Admin cancel request',
        expect.objectContaining({ id: adminUser.id })
      )
    })
  })
})
