/** @jest-environment node */

import { NextRequest } from 'next/server'

import { POST as scanPOST } from '@/app/api/purchases/scan/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { generateMockPdfBuffer } from '@/lib/scanner/mock-bill-fixtures'
import { provisionPurchaseBill } from '@/lib/purchases/purchase-provisioning-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/purchases/purchase-provisioning-service', () => ({
  provisionPurchaseBill: jest.fn(),
}))

const mockedPermission = requirePermission as jest.Mock
const mockedProvision = provisionPurchaseBill as jest.Mock

describe('POST /api/purchases/scan Route Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedPermission.mockResolvedValue({
      id: 'usr-admin-1',
      username: 'admin',
      roles: ['ADMIN'],
    })
  })

  it('rejects unauthenticated requests with 401', async () => {
    mockedPermission.mockRejectedValue(new Error('Unauthorized'))

    const formData = new FormData()
    formData.append('file', new Blob(['test'], { type: 'application/pdf' }), 'invoice.pdf')

    const req = new NextRequest('http://localhost:3000/api/purchases/scan', {
      method: 'POST',
      body: formData,
    })

    const res = await scanPOST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('rejects unauthorized requests lacking PURCHASES_CREATE permission with 403', async () => {
    mockedPermission.mockRejectedValue(new Error('Forbidden: Insufficient privileges'))

    const formData = new FormData()
    formData.append('file', new Blob(['test'], { type: 'application/pdf' }), 'invoice.pdf')

    const req = new NextRequest('http://localhost:3000/api/purchases/scan', {
      method: 'POST',
      body: formData,
    })

    const res = await scanPOST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('returns 400 when file is missing in multipart form data', async () => {
    const formData = new FormData()
    formData.append('branchId', 'branch-1')

    const req = new NextRequest('http://localhost:3000/api/purchases/scan', {
      method: 'POST',
      body: formData,
    })

    const res = await scanPOST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('FILE_MISSING')
  })

  it('returns 400 when an unsupported file type is uploaded', async () => {
    const formData = new FormData()
    formData.append(
      'file',
      new Blob(['malicious payload'], { type: 'application/x-msdownload' }),
      'invoice.exe'
    )

    const req = new NextRequest('http://localhost:3000/api/purchases/scan', {
      method: 'POST',
      body: formData,
    })

    const res = await scanPOST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('UNSUPPORTED_MIME_TYPE')
  })

  it('returns 400 when uploaded file exceeds 15MB limit', async () => {
    const formData = new FormData()
    // Provide a genuine oversized buffer (> 15MB)
    const oversizedBytes = new Uint8Array(15 * 1024 * 1024 + 1024)
    const oversizedBlob = new Blob([oversizedBytes], { type: 'application/pdf' })
    formData.append('file', oversizedBlob, 'large-scan.pdf')

    const req = new NextRequest('http://localhost:3000/api/purchases/scan', {
      method: 'POST',
      body: formData,
    })

    const res = await scanPOST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('FILE_TOO_LARGE')
  })

  it('successfully processes valid PDF purchase bill with x-mock-scan header', async () => {
    const formData = new FormData()
    formData.append(
      'file',
      new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' }),
      'wholesale-bill.pdf'
    )
    formData.append('branchId', 'branch-main')

    const req = new NextRequest('http://localhost:3000/api/purchases/scan', {
      method: 'POST',
      headers: {
        'x-mock-scan': 'true',
      },
      body: formData,
    })

    const res = await scanPOST(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.confidence).toBeGreaterThanOrEqual(0.9)
    expect(json.extractionMethod).toBe('DETERMINISTIC_MOCK')
    expect(json.document.filename).toBe('wholesale-bill.pdf')
    expect(json.document.mimeType).toBe('application/pdf')

    // Extracted Data Contracts
    expect(json.extractedData).toBeDefined()
    expect(json.extractedData.supplier.rawName).toContain('MAHAVEER PHARMA')
    expect(json.extractedData.supplier.gstin).toBe('29AABCM8921F1ZT')
    expect(json.extractedData.invoice.invoiceNumber).toBe('MP/24-25/08492')
    expect(json.extractedData.items.length).toBeGreaterThanOrEqual(2)

    const firstItem = json.extractedData.items[0]
    expect(firstItem.batchNumber).toBeDefined()
    expect(firstItem.expiryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(firstItem.billedQuantity).toBeGreaterThan(0)
    expect(firstItem.unitCost).toBeGreaterThan(0)

    expect(json.extractedData.financials.isReconciled).toBe(true)
    expect(json.extractedData.financials.totalAmount).toBe(26136.0)
  })

  it('successfully processes uploaded digital vector PDF and parses genuine content', async () => {
    const pdfBuffer = generateMockPdfBuffer('mahaveer')
    const formData = new FormData()
    formData.append(
      'file',
      new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }),
      'mahaveer-vector.pdf'
    )

    const req = new NextRequest('http://localhost:3000/api/purchases/scan', {
      method: 'POST',
      body: formData,
    })

    const res = await scanPOST(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.document.filename).toBe('mahaveer-vector.pdf')
    expect(json.extractedData.supplier.gstin).toBe('29AABCM8921F1ZT')
    expect(json.extractedData.items.length).toBe(3)
    expect(json.extractedData.financials.isReconciled).toBe(true)
  })

  it('successfully accepts image upload (PNG/JPEG) format', async () => {
    const formData = new FormData()
    formData.append(
      'file',
      new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
      'invoice-photo.png'
    )

    const req = new NextRequest('http://localhost:3000/api/purchases/scan?mock=true', {
      method: 'POST',
      body: formData,
    })

    const res = await scanPOST(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.document.mimeType).toBe('image/png')
    expect(json.extractedData.supplier.gstin).toBeDefined()
  })

  it('automatically provisions items into inventory when autoProvision=true is passed', async () => {
    mockedProvision.mockResolvedValueOnce({
      success: true,
      purchaseId: 'pur-auto-001',
      purchaseNumber: 'PB-AUTO-001',
      itemsProvisioned: 2,
      totalItemsProvisioned: 2,
      totalUsableQty: 60,
      totalUnitsAdded: 60,
      totalAmount: 26136,
      status: 'RECEIVED',
    })

    const formData = new FormData()
    formData.append(
      'file',
      new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' }),
      'wholesale-bill.pdf'
    )
    formData.append('branchId', 'branch-main')
    formData.append('autoProvision', 'true')

    const req = new NextRequest('http://localhost:3000/api/purchases/scan', {
      method: 'POST',
      headers: {
        'x-mock-scan': 'true',
      },
      body: formData,
    })

    const res = await scanPOST(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.autoProvisioned).toBe(true)
    expect(json.provisionResult).toBeDefined()
    expect(json.provisionResult.purchaseId).toBe('pur-auto-001')
    expect(mockedProvision).toHaveBeenCalledTimes(1)
    // Check that exact extracted item names were sent to provisioning
    const calledArgs = mockedProvision.mock.calls[0][0]
    expect(calledArgs.branchId).toBe('branch-main')
    expect(calledArgs.items.length).toBeGreaterThanOrEqual(2)
    expect(calledArgs.notes).toContain('Auto-provisioned on invoice scan using exact extracted names')
  })
})
