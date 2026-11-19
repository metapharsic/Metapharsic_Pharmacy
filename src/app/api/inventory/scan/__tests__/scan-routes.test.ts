/** @jest-environment node */
import type { NextRequest } from 'next/server'

import { POST as analyzePOST } from '@/app/api/inventory/scan/analyze/route'
import { POST as commitPOST } from '@/app/api/inventory/scan/commit/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { analyzeScannedStrip, commitScannedInventory } from '@/lib/scanner/auto-inventory-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/scanner/auto-inventory-service', () => ({
  analyzeScannedStrip: jest.fn(),
  commitScannedInventory: jest.fn(),
}))

const mockedRequirePermission = requirePermission as jest.Mock
const mockedAnalyze = analyzeScannedStrip as jest.Mock
const mockedCommit = commitScannedInventory as jest.Mock

function makeReq(url: string, body: any): NextRequest {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe('AI Strip Scanner Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/inventory/scan/analyze', () => {
    it('returns 401 when unauthenticated', async () => {
      mockedRequirePermission.mockRejectedValueOnce(new Error('Unauthorized'))

      const res = await analyzePOST(
        makeReq('http://localhost/api/inventory/scan/analyze', { rawText: 'AUGMENTIN' })
      )
      expect(res.status).toBe(401)
    })

    it('returns 400 when rawText is missing', async () => {
      mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })

      const res = await analyzePOST(
        makeReq('http://localhost/api/inventory/scan/analyze', {})
      )
      expect(res.status).toBe(400)
    })

    it('returns analysis result successfully', async () => {
      mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
      mockedAnalyze.mockResolvedValueOnce({
        scanId: 'SCAN-1234',
        surfaceType: 'ALU_ALU',
        entity: { brandName: 'Augmentin 625 Duo', batchNumber: 'LOT-1' },
        confidence: { overall: 92 },
        matchedProduct: null,
      })

      const res = await analyzePOST(
        makeReq('http://localhost/api/inventory/scan/analyze', {
          rawText: 'AUGMENTIN 625 DUO\nB.No. LOT-1',
          surfaceType: 'ALU_ALU',
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.entity.brandName).toBe('Augmentin 625 Duo')
    })
  })

  describe('POST /api/inventory/scan/commit', () => {
    it('returns 400 on incomplete input', async () => {
      mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })

      const res = await commitPOST(
        makeReq('http://localhost/api/inventory/scan/commit', { productName: 'Augmentin' })
      )
      expect(res.status).toBe(400)
    })

    it('commits scanned strip to inventory', async () => {
      mockedRequirePermission.mockResolvedValueOnce({ id: 'u1' })
      mockedCommit.mockResolvedValueOnce({
        productId: 'p1',
        productName: 'Augmentin 625 Duo',
        sku: 'MED-123',
        batchId: 'b1',
        batchNumber: 'LOT-1',
        previousStock: 0,
        addedQuantity: 10,
        newTotalStock: 10,
        inventoryMovementId: 'm1',
        createdAt: '2026-10-25T00:00:00.000Z',
        message: 'Successfully ingested 10 Strips into inventory',
      })

      const res = await commitPOST(
        makeReq('http://localhost/api/inventory/scan/commit', {
          productName: 'Augmentin 625 Duo',
          batchNumber: 'LOT-1',
          expiryDate: '2028-08-31',
          mrp: 204.5,
          quantityToAdd: 10,
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.newTotalStock).toBe(10)
    })
  })
})
