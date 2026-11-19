/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */

import { NextRequest } from 'next/server'

import { POST as commitPOST } from '@/app/api/purchases/scan/commit/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { assertBranchAccess } from '@/lib/inventory/branch-access'
import {
  provisionPurchaseBill,
  UnreconciledTotalError,
} from '@/lib/purchases/purchase-provisioning-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/inventory/branch-access', () => ({
  assertBranchAccess: jest.fn(),
}))

jest.mock('@/lib/purchases/purchase-provisioning-service', () => {
  const actual = jest.requireActual<Record<string, unknown>>(
    '@/lib/purchases/purchase-provisioning-service'
  )
  return {
    ...actual,
    provisionPurchaseBill: jest.fn(),
  }
})

const mockedPermission = requirePermission as jest.Mock
const mockedProvisionService = provisionPurchaseBill as jest.Mock
const mockedBranchAccess = assertBranchAccess as jest.Mock

describe('POST /api/purchases/scan/commit Route Tests', () => {
  const validPayload = {
    branchId: 'branch-blr-01',
    supplierId: 'sup-mahaveer-01',
    invoiceNumber: 'INV/2026/08912',
    invoiceDate: '2026-11-03',
    subtotal: 5000.0,
    discountAmount: 100.0,
    taxAmount: 600.0,
    totalAmount: 5500.0,
    items: [
      {
        productId: 'prod-augmentin-625',
        batchNumber: '26D044',
        expiryDate: '2028-08-31',
        billedQuantity: 50,
        freeQuantity: 5,
        unitCost: 100.0,
        mrp: 140.0,
        discountPercent: 2.0,
        taxPercent: 12.0,
        taxAmount: 600.0,
        totalAmount: 5500.0,
      },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockedPermission.mockResolvedValue({
      id: 'usr-pharmacist-1',
      name: 'Senior Pharmacist',
      roles: ['PHARMACIST'],
      permissions: ['purchases:create', 'purchases:read'],
    })
    mockedBranchAccess.mockResolvedValue(undefined)
  })

  it('rejects unauthenticated requests with 401 Unauthorized', async () => {
    mockedPermission.mockRejectedValue(new Error('Unauthorized'))

    const req = new NextRequest('http://localhost:3000/api/purchases/scan/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    })

    const res = await commitPOST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('rejects unauthorized requests lacking purchases:create permission with 403 Forbidden', async () => {
    mockedPermission.mockRejectedValue(
      new Error("Forbidden: requires permission 'purchases:create'")
    )

    const req = new NextRequest('http://localhost:3000/api/purchases/scan/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    })

    const res = await commitPOST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('rejects requests when target branch does not belong to organization with 403 Forbidden', async () => {
    mockedBranchAccess.mockRejectedValueOnce(
      new Error("Forbidden: no access to branch 'branch-foreign'")
    )

    const req = new NextRequest('http://localhost:3000/api/purchases/scan/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validPayload, branchId: 'branch-foreign' }),
    })

    const res = await commitPOST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('FORBIDDEN')
    expect(json.error.message).toContain('Forbidden')
  })

  it('returns 400 Bad Request when JSON body is malformed', async () => {
    const req = new NextRequest('http://localhost:3000/api/purchases/scan/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json-string{',
    })

    const res = await commitPOST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('INVALID_JSON')
  })

  it('returns 400 Validation Error when mandatory fields are missing', async () => {
    const invalidPayload = {
      // missing branchId, invoiceNumber, items
      subtotal: 100,
      totalAmount: 100,
    }

    const req = new NextRequest('http://localhost:3000/api/purchases/scan/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload),
    })

    const res = await commitPOST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 Validation Error when line items contain negative quantity', async () => {
    const invalidItemPayload = {
      ...validPayload,
      items: [
        {
          ...validPayload.items[0],
          billedQuantity: -10, // Invalid negative quantity
        },
      ],
    }

    const req = new NextRequest('http://localhost:3000/api/purchases/scan/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidItemPayload),
    })

    const res = await commitPOST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 422 Unreconciled Total when service rejects due to line item sum divergence', async () => {
    mockedProvisionService.mockRejectedValueOnce(
      new UnreconciledTotalError('Unreconciled Total: Sum of line items differs from total amount')
    )

    const req = new NextRequest('http://localhost:3000/api/purchases/scan/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    })

    const res = await commitPOST(req)
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('UNRECONCILED_TOTAL')
  })

  it('returns 201 Created with full provisioning details on successful commit', async () => {
    mockedProvisionService.mockResolvedValueOnce({
      success: true,
      purchaseId: 'purch-test-12345',
      purchaseNumber: 'PB-1730635400000',
      totalItemsProvisioned: 1,
      totalUnitsAdded: 55,
      totalAmount: 5500.0,
      status: 'RECEIVED',
    })

    const req = new NextRequest('http://localhost:3000/api/purchases/scan/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    })

    const res = await commitPOST(req)
    expect(res.status).toBe(201)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.purchaseId).toBe('purch-test-12345')
    expect(json.purchaseNumber).toBe('PB-1730635400000')
    expect(json.totalItemsProvisioned).toBe(1)
    expect(json.totalUnitsAdded).toBe(55)
    expect(json.totalAmount).toBe(5500.0)
    expect(json.status).toBe('RECEIVED')

    expect(mockedProvisionService).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceNumber: 'INV/2026/08912',
        branchId: 'branch-blr-01',
      }),
      expect.objectContaining({
        id: 'usr-pharmacist-1',
      })
    )
  })

  it('returns 500 when provisioning service throws an unexpected internal error', async () => {
    mockedProvisionService.mockRejectedValueOnce(
      new Error('Unexpected database connection timeout')
    )

    const req = new NextRequest('http://localhost:3000/api/purchases/scan/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    })

    const res = await commitPOST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('PROVISIONING_FAILED')
    expect(json.error.message).toContain('Unexpected database connection timeout')
  })
})
