/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { POST as scanDispensePOST } from '@/app/api/pos/scan-dispense/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import prisma from '@/lib/db/prisma'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  default: {
    branch: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedPrisma = prisma as unknown as {
  branch: { findFirst: jest.Mock }
  $transaction: jest.Mock
}

function makeReq(body: any): NextRequest {
  return new Request('http://localhost/api/pos/scan-dispense', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe('POST /api/pos/scan-dispense', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects unauthenticated requests with 400 or 401', async () => {
    mockedRequirePermission.mockRejectedValueOnce(new Error('Unauthorized'))

    const res = await scanDispensePOST(makeReq({ productName: 'Test' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('validates required fields such as tabsCut and batchNumber', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })

    const res = await scanDispensePOST(
      makeReq({
        productName: 'Augmentin 625',
        // missing batchNumber and mrp
      })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('executes atomic cut-strip dispense and generates bill', async () => {
    mockedRequirePermission.mockResolvedValueOnce({ id: 'user-123' })
    mockedPrisma.branch.findFirst.mockResolvedValueOnce({
      id: 'br-1',
      invoicePrefix: 'INV',
      invoiceCounter: 1005,
    })

    mockedPrisma.$transaction.mockImplementation(async (callback: any) => {
      const mockTx = {
        product: {
          findFirst: jest.fn().mockResolvedValue({ id: 'prod-1' }),
        },
        category: {
          findFirst: jest.fn().mockResolvedValue({ id: 'cat-1' }),
        },
        batch: {
          upsert: jest.fn().mockResolvedValue({
            id: 'batch-1',
            batchNumber: '26D044',
            quantity: 50,
          }),
        },
        inventory: {
          upsert: jest.fn().mockResolvedValue({
            id: 'inv-1',
            totalQuantity: 49,
            availableQuantity: 49,
          }),
        },
        branch: {
          update: jest.fn().mockResolvedValue({}),
        },
        customer: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'cust-1' }),
        },
        sale: {
          create: jest.fn().mockResolvedValue({
            id: 'sale-1',
            invoiceNumber: 'INV-2026-01006',
            saleDate: new Date('2026-10-26T10:00:00Z'),
          }),
        },
        saleItem: {
          create: jest.fn().mockResolvedValue({ id: 'item-1' }),
        },
        payment: {
          create: jest.fn().mockResolvedValue({ id: 'pay-1', reference: 'UPI-REF-999' }),
        },
        inventoryMovement: {
          create: jest.fn().mockResolvedValue({ id: 'mov-1' }),
        },
      }
      return callback(mockTx)
    })

    const payload = {
      productName: 'Augmentin 625 Duo',
      genericName: 'Amoxicillin and Potassium Clavulanate',
      strength: '625 mg',
      batchNumber: '26D044',
      expiryDate: '2028-08-31',
      mrp: 204.5,
      tabsPerStrip: 10,
      tabsCut: 3, // Pharmacist cuts 3 tablets
      paymentMethod: 'UPI',
      customerName: 'Rahul Sharma',
    }

    const res = await scanDispensePOST(makeReq(payload))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.invoiceNumber).toBe('INV-2026-01006')
    expect(json.data.tabsCut).toBe(3)
    expect(json.data.pricePerTab).toBe(20.45)
    expect(json.data.lineTotal).toBe(61.35)
    expect(json.data.paymentMethod).toBe('UPI')
  })
})
