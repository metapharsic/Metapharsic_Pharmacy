/** @jest-environment node */
import { GET, POST } from '../route'
import { PUT, DELETE } from '../[id]/route'
import { NextRequest } from 'next/server'
import prisma from '@/lib/db/prisma'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn().mockResolvedValue({
    id: 'usr_admin123',
    name: 'Admin User',
    email: 'admin@pharmacare.local',
    roles: ['ADMIN'],
  }),
}))

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  default: {
    hsnCode: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

describe('HSN Codes API Routes (Marg ERP / Tally Parity)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/hsn-codes', () => {
    it('returns list of HSN codes with product counts', async () => {
      const mockHsnList = [
        {
          id: 'hsn_1',
          code: '3004',
          description: 'Medicaments',
          gstRate: 12,
          cgstRate: 6,
          sgstRate: 6,
          igstRate: 12,
          cessRate: 0,
          isActive: true,
          _count: { products: 25 },
        },
      ]
      ;(prisma.hsnCode.findMany as jest.Mock).mockResolvedValue(mockHsnList)

      const req = new NextRequest('http://localhost:5888/api/hsn-codes')
      const res = await GET(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data).toEqual(mockHsnList)
    })
  })

  describe('POST /api/hsn-codes', () => {
    it('creates HSN code and correctly computes tax splits', async () => {
      const createdHsn = {
        id: 'hsn_new',
        code: '3007',
        description: 'Dental cements',
        gstRate: 12,
        cgstRate: 6,
        sgstRate: 6,
        igstRate: 12,
        cessRate: 0,
        isActive: true,
      }
      ;(prisma.hsnCode.create as jest.Mock).mockResolvedValue(createdHsn)

      const req = new NextRequest('http://localhost:5888/api/hsn-codes', {
        method: 'POST',
        body: JSON.stringify({
          code: '3007',
          description: 'Dental cements',
          gstRate: 12,
          cessRate: 0,
        }),
      })

      const res = await POST(req)
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(json.success).toBe(true)
      expect(prisma.hsnCode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: '3007',
          gstRate: 12,
          cgstRate: 6,
          sgstRate: 6,
          igstRate: 12,
        }),
      })
    })

    it('rejects invalid rate input', async () => {
      const req = new NextRequest('http://localhost:5888/api/hsn-codes', {
        method: 'POST',
        body: JSON.stringify({
          code: '3007',
          description: 'Dental cements',
          gstRate: -5,
        }),
      })

      const res = await POST(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('VALIDATION')
    })
  })

  describe('PUT /api/hsn-codes/[id]', () => {
    it('updates HSN code and recalculates CGST/SGST', async () => {
      const updatedHsn = {
        id: 'hsn_1',
        code: '3004',
        description: 'Updated Medicaments',
        gstRate: 5,
        cgstRate: 2.5,
        sgstRate: 2.5,
        igstRate: 5,
        cessRate: 0,
        isActive: true,
      }
      ;(prisma.hsnCode.update as jest.Mock).mockResolvedValue(updatedHsn)

      const req = new NextRequest('http://localhost:5888/api/hsn-codes/hsn_1', {
        method: 'PUT',
        body: JSON.stringify({
          description: 'Updated Medicaments',
          gstRate: 5,
        }),
      })

      const res = await PUT(req, { params: { id: 'hsn_1' } })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(prisma.hsnCode.update).toHaveBeenCalledWith({
        where: { id: 'hsn_1' },
        data: expect.objectContaining({
          description: 'Updated Medicaments',
          gstRate: 5,
          cgstRate: 2.5,
          sgstRate: 2.5,
          igstRate: 5,
        }),
      })
    })
  })

  describe('DELETE /api/hsn-codes/[id]', () => {
    it('soft deactivates HSN code if active products are mapped', async () => {
      ;(prisma.hsnCode.findUnique as jest.Mock).mockResolvedValue({
        id: 'hsn_1',
        code: '3004',
        _count: { products: 10 },
      })
      ;(prisma.hsnCode.update as jest.Mock).mockResolvedValue({ id: 'hsn_1', isActive: false })

      const req = new NextRequest('http://localhost:5888/api/hsn-codes/hsn_1', { method: 'DELETE' })
      const res = await DELETE(req, { params: { id: 'hsn_1' } })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.deactivated).toBe(true)
      expect(prisma.hsnCode.update).toHaveBeenCalledWith({
        where: { id: 'hsn_1' },
        data: { isActive: false },
      })
    })

    it('hard deletes HSN code if no products are mapped', async () => {
      ;(prisma.hsnCode.findUnique as jest.Mock).mockResolvedValue({
        id: 'hsn_2',
        code: '9999',
        _count: { products: 0 },
      })
      ;(prisma.hsnCode.delete as jest.Mock).mockResolvedValue({ id: 'hsn_2' })

      const req = new NextRequest('http://localhost:5888/api/hsn-codes/hsn_2', { method: 'DELETE' })
      const res = await DELETE(req, { params: { id: 'hsn_2' } })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.deleted).toBe(true)
      expect(prisma.hsnCode.delete).toHaveBeenCalledWith({ where: { id: 'hsn_2' } })
    })
  })
})
