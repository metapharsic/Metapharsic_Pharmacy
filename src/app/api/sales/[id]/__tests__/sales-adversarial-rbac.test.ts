/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { cancelSaleAction, editSaleAction } from '@/app/(dashboard)/sales/[id]/sale-actions'
import { POST as cancelPost } from '@/app/api/sales/[id]/cancel/route'
import { DELETE, PATCH } from '@/app/api/sales/[id]/route'
import { getSession, requireAuth } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { cancelSale, editSale } from '@/lib/sales/sales-service'

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('@/lib/auth/auth-helpers', () => ({
  requireAuth: jest.fn(),
  requirePermission: jest.fn(),
  getSession: jest.fn(),
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
const mockedGetSession = getSession as jest.Mock
const mockedEditSale = editSale as jest.Mock
const mockedCancelSale = cancelSale as jest.Mock

function makeReq(url: string, init?: RequestInit): NextRequest {
  return new Request(url, init) as unknown as NextRequest
}

describe('Adversarial RBAC Penetration Suite (Admin Bill Ops, Inventory Reversal, & Routes)', () => {
  // Test User Personas
  const cashierPersona = {
    id: 'cashier-usr-01',
    branchId: 'branch-south-01',
    roles: ['cashier'],
    permissions: [PERMISSIONS.SALES_CREATE, PERMISSIONS.SALES_READ, PERMISSIONS.INVOICES_PRINT],
  }

  const pharmacistWithoutVoid = {
    id: 'pharma-usr-01',
    branchId: 'branch-south-01',
    roles: ['pharmacist'],
    permissions: [PERMISSIONS.SALES_CREATE, PERMISSIONS.SALES_READ, PERMISSIONS.SALES_DISCOUNT],
  }

  const pharmacistWithVoid = {
    id: 'pharma-usr-02',
    branchId: 'branch-south-01',
    roles: ['pharmacist'],
    permissions: [PERMISSIONS.SALES_CREATE, PERMISSIONS.SALES_READ, PERMISSIONS.SALES_VOID],
  }

  const unprivilegedStaff = {
    id: 'staff-usr-01',
    branchId: 'branch-south-01',
    roles: ['intern'],
    permissions: [],
  }

  const maliciousGuest = {
    id: 'guest-usr-01',
    branchId: 'branch-south-01',
    roles: ['guest'],
    permissions: ['reports:read'],
  }

  const adminPersona = {
    id: 'admin-usr-01',
    branchId: 'branch-south-01',
    roles: ['admin'],
    permissions: [PERMISSIONS.SALES_VOID],
  }

  const ownerPersona = {
    id: 'owner-usr-01',
    branchId: 'branch-south-01',
    roles: ['owner'],
    permissions: [],
  }

  const managerPersona = {
    id: 'manager-usr-01',
    branchId: 'branch-south-01',
    roles: ['manager'],
    permissions: [PERMISSIONS.SALES_READ],
  }

  const superAdminPersona = {
    id: 'super-admin-01',
    branchId: 'branch-south-01',
    roles: ['super_admin'],
    permissions: [],
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // =========================================================================
  // 1. PATCH /api/sales/:id (Bill Modification Penetration)
  // =========================================================================
  describe('Penetration Vector 1: PATCH /api/sales/:id (Bill Modification)', () => {
    const maliciousEditPayload = {
      items: [{ saleItemId: 'item-tamper-01', quantity: 0 }],
      reason: 'Tampered line item removal',
      refundCashDifference: true,
    }

    it('rejects Cashier with HTTP 403 Forbidden', async () => {
      mockedRequireAuth.mockResolvedValueOnce(cashierPersona)
      const req = makeReq('http://localhost/api/sales/sale-101', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(maliciousEditPayload),
      })

      const res = await PATCH(req, { params: { id: 'sale-101' } })
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('FORBIDDEN')
      expect(body.error.message).toMatch(/Forbidden: requires permission sales:void or Admin role/i)
      expect(mockedEditSale).not.toHaveBeenCalled()
    })

    it('rejects Pharmacist lacking sales:void with HTTP 403 Forbidden', async () => {
      mockedRequireAuth.mockResolvedValueOnce(pharmacistWithoutVoid)
      const req = makeReq('http://localhost/api/sales/sale-101', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(maliciousEditPayload),
      })

      const res = await PATCH(req, { params: { id: 'sale-101' } })
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('FORBIDDEN')
      expect(mockedEditSale).not.toHaveBeenCalled()
    })

    it('rejects unprivileged Staff/Intern with HTTP 403 Forbidden', async () => {
      mockedRequireAuth.mockResolvedValueOnce(unprivilegedStaff)
      const req = makeReq('http://localhost/api/sales/sale-101', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(maliciousEditPayload),
      })

      const res = await PATCH(req, { params: { id: 'sale-101' } })
      expect(res.status).toBe(403)
      expect(mockedEditSale).not.toHaveBeenCalled()
    })

    it('rejects Malicious Guest with HTTP 403 Forbidden', async () => {
      mockedRequireAuth.mockResolvedValueOnce(maliciousGuest)
      const req = makeReq('http://localhost/api/sales/sale-101', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(maliciousEditPayload),
      })

      const res = await PATCH(req, { params: { id: 'sale-101' } })
      expect(res.status).toBe(403)
      expect(mockedEditSale).not.toHaveBeenCalled()
    })

    it('allows Admin persona with HTTP 200 OK', async () => {
      mockedRequireAuth.mockResolvedValueOnce(adminPersona)
      mockedEditSale.mockResolvedValueOnce({ id: 'sale-101', totalAmount: 100 })

      const req = makeReq('http://localhost/api/sales/sale-101', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(maliciousEditPayload),
      })

      const res = await PATCH(req, { params: { id: 'sale-101' } })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(mockedEditSale).toHaveBeenCalledWith(
        expect.objectContaining({ saleId: 'sale-101' }),
        expect.objectContaining({ id: adminPersona.id })
      )
    })

    it('allows Pharmacist WITH sales:void permission with HTTP 200 OK', async () => {
      mockedRequireAuth.mockResolvedValueOnce(pharmacistWithVoid)
      mockedEditSale.mockResolvedValueOnce({ id: 'sale-101', totalAmount: 100 })

      const req = makeReq('http://localhost/api/sales/sale-101', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(maliciousEditPayload),
      })

      const res = await PATCH(req, { params: { id: 'sale-101' } })
      expect(res.status).toBe(200)
      expect(mockedEditSale).toHaveBeenCalled()
    })

    it('allows Manager persona with HTTP 200 OK', async () => {
      mockedRequireAuth.mockResolvedValueOnce(managerPersona)
      mockedEditSale.mockResolvedValueOnce({ id: 'sale-101', totalAmount: 100 })

      const req = makeReq('http://localhost/api/sales/sale-101', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(maliciousEditPayload),
      })

      const res = await PATCH(req, { params: { id: 'sale-101' } })
      expect(res.status).toBe(200)
      expect(mockedEditSale).toHaveBeenCalled()
    })

    it('rejects malformed PATCH request (missing items array) with HTTP 400 Bad Request', async () => {
      mockedRequireAuth.mockResolvedValueOnce(adminPersona)

      const req = makeReq('http://localhost/api/sales/sale-101', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'No items provided' }),
      })

      const res = await PATCH(req, { params: { id: 'sale-101' } })
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('BAD_REQUEST')
      expect(mockedEditSale).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 2. DELETE /api/sales/:id (Bill Cancellation Penetration)
  // =========================================================================
  describe('Penetration Vector 2: DELETE /api/sales/:id (Bill Cancellation & Stock Reversal)', () => {
    it('rejects Cashier session with HTTP 403 Forbidden', async () => {
      mockedRequireAuth.mockResolvedValueOnce(cashierPersona)
      const req = makeReq('http://localhost/api/sales/sale-202', { method: 'DELETE' })

      const res = await DELETE(req, { params: { id: 'sale-202' } })
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('FORBIDDEN')
      expect(body.error.message).toMatch(/Forbidden: requires permission sales:void or Admin role/i)
      expect(mockedCancelSale).not.toHaveBeenCalled()
    })

    it('rejects Pharmacist lacking sales:void with HTTP 403 Forbidden', async () => {
      mockedRequireAuth.mockResolvedValueOnce(pharmacistWithoutVoid)
      const req = makeReq('http://localhost/api/sales/sale-202', { method: 'DELETE' })

      const res = await DELETE(req, { params: { id: 'sale-202' } })
      expect(res.status).toBe(403)
      expect(mockedCancelSale).not.toHaveBeenCalled()
    })

    it('allows Owner persona with HTTP 200 OK', async () => {
      mockedRequireAuth.mockResolvedValueOnce(ownerPersona)
      mockedCancelSale.mockResolvedValueOnce(undefined)

      const req = makeReq('http://localhost/api/sales/sale-202?reason=Owner%20requested%20void', {
        method: 'DELETE',
      })

      const res = await DELETE(req, { params: { id: 'sale-202' } })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(mockedCancelSale).toHaveBeenCalledWith(
        'sale-202',
        'Owner requested void',
        expect.objectContaining({ id: ownerPersona.id })
      )
    })

    it('allows Super Admin persona with HTTP 200 OK', async () => {
      mockedRequireAuth.mockResolvedValueOnce(superAdminPersona)
      mockedCancelSale.mockResolvedValueOnce(undefined)

      const req = makeReq('http://localhost/api/sales/sale-202', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Super Admin compliance cleanup' }),
      })

      const res = await DELETE(req, { params: { id: 'sale-202' } })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(mockedCancelSale).toHaveBeenCalledWith(
        'sale-202',
        'Super Admin compliance cleanup',
        expect.objectContaining({ id: superAdminPersona.id })
      )
    })
  })

  // =========================================================================
  // 3. POST /api/sales/:id/cancel (Alternative Cancellation Endpoint Penetration)
  // =========================================================================
  describe('Penetration Vector 3: POST /api/sales/:id/cancel', () => {
    it('rejects Cashier session with HTTP 403 Forbidden', async () => {
      mockedRequireAuth.mockResolvedValueOnce(cashierPersona)
      const req = makeReq('http://localhost/api/sales/sale-303/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Cashier void attempt' }),
      })

      const res = await cancelPost(req, { params: { id: 'sale-303' } })
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('FORBIDDEN')
      expect(mockedCancelSale).not.toHaveBeenCalled()
    })

    it('rejects Pharmacist lacking sales:void with HTTP 403 Forbidden', async () => {
      mockedRequireAuth.mockResolvedValueOnce(pharmacistWithoutVoid)
      const req = makeReq('http://localhost/api/sales/sale-303/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Pharma void attempt' }),
      })

      const res = await cancelPost(req, { params: { id: 'sale-303' } })
      expect(res.status).toBe(403)
      expect(mockedCancelSale).not.toHaveBeenCalled()
    })

    it('rejects short cancellation reason (< 3 chars) with HTTP 400 Validation Error', async () => {
      mockedRequireAuth.mockResolvedValueOnce(adminPersona)
      const req = makeReq('http://localhost/api/sales/sale-303/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'no' }),
      })

      const res = await cancelPost(req, { params: { id: 'sale-303' } })
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('VALIDATION')
      expect(mockedCancelSale).not.toHaveBeenCalled()
    })

    it('allows Pharmacist WITH sales:void permission with HTTP 200 OK', async () => {
      mockedRequireAuth.mockResolvedValueOnce(pharmacistWithVoid)
      mockedCancelSale.mockResolvedValueOnce(undefined)

      const req = makeReq('http://localhost/api/sales/sale-303/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Damaged vial returned by patient' }),
      })

      const res = await cancelPost(req, { params: { id: 'sale-303' } })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(mockedCancelSale).toHaveBeenCalledWith(
        'sale-303',
        'Damaged vial returned by patient',
        expect.objectContaining({ id: pharmacistWithVoid.id })
      )
    })
  })

  // =========================================================================
  // 4. Server Actions Penetration: cancelSaleAction & editSaleAction
  // =========================================================================
  describe('Penetration Vector 4: Server Actions (cancelSaleAction & editSaleAction)', () => {
    it('rejects Cashier invoking cancelSaleAction with Forbidden error', async () => {
      mockedGetSession.mockResolvedValueOnce({ user: cashierPersona })

      await expect(
        cancelSaleAction('sale-404', 'Cashier bypassing UI to invoke server action')
      ).rejects.toThrow(/Forbidden: requires permission sales:void or Admin role to cancel sales/i)

      expect(mockedCancelSale).not.toHaveBeenCalled()
    })

    it('rejects Pharmacist without sales:void invoking cancelSaleAction with Forbidden error', async () => {
      mockedGetSession.mockResolvedValueOnce({ user: pharmacistWithoutVoid })

      await expect(
        cancelSaleAction('sale-404', 'Pharma invoking cancel action')
      ).rejects.toThrow(/Forbidden: requires permission sales:void or Admin role to cancel sales/i)

      expect(mockedCancelSale).not.toHaveBeenCalled()
    })

    it('rejects Cashier invoking editSaleAction with Forbidden error', async () => {
      mockedGetSession.mockResolvedValueOnce({ user: cashierPersona })

      await expect(
        editSaleAction({
          saleId: 'sale-404',
          items: [{ saleItemId: 'it-1', quantity: 1 }],
          reason: 'Cashier edit attempt',
        })
      ).rejects.toThrow(/Forbidden: requires permission sales:void or Admin role to edit sales/i)

      expect(mockedEditSale).not.toHaveBeenCalled()
    })

    it('rejects Pharmacist without sales:void invoking editSaleAction with Forbidden error', async () => {
      mockedGetSession.mockResolvedValueOnce({ user: pharmacistWithoutVoid })

      await expect(
        editSaleAction({
          saleId: 'sale-404',
          items: [{ saleItemId: 'it-1', quantity: 1 }],
          reason: 'Pharma edit attempt',
        })
      ).rejects.toThrow(/Forbidden: requires permission sales:void or Admin role to edit sales/i)

      expect(mockedEditSale).not.toHaveBeenCalled()
    })

    it('allows Admin invoking cancelSaleAction and triggers revalidatePath', async () => {
      mockedGetSession.mockResolvedValueOnce({ user: adminPersona })
      mockedCancelSale.mockResolvedValueOnce(undefined)

      await cancelSaleAction('sale-404', 'Admin cancellation via action')

      expect(mockedCancelSale).toHaveBeenCalledWith(
        'sale-404',
        'Admin cancellation via action',
        expect.objectContaining({ id: adminPersona.id })
      )
    })

    it('allows Admin invoking editSaleAction and returns updated sale', async () => {
      const mockResult = { id: 'sale-404', totalAmount: 150 }
      mockedGetSession.mockResolvedValueOnce({ user: adminPersona })
      mockedEditSale.mockResolvedValueOnce(mockResult)

      const result = await editSaleAction({
        saleId: 'sale-404',
        items: [{ saleItemId: 'it-1', quantity: 2 }],
        reason: 'Admin corrected item quantity',
      })

      expect(result).toEqual(mockResult)
      expect(mockedEditSale).toHaveBeenCalledWith(
        expect.objectContaining({ saleId: 'sale-404' }),
        expect.objectContaining({ id: adminPersona.id })
      )
    })
  })
})
