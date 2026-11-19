/** @jest-environment node */
import { NextRequest } from 'next/server'

import { GET as customerGET, PATCH as customerPATCH, DELETE as customerDELETE } from '@/app/api/customers/[id]/route'
import { GET as customersGET, POST as customersPOST } from '@/app/api/customers/route'
import { requirePermission } from '@/lib/auth/auth-helpers'
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from '@/lib/customers/customer-service'

jest.mock('@/lib/auth/auth-helpers', () => ({
  requirePermission: jest.fn(),
}))

jest.mock('@/lib/customers/customer-service', () => ({
  createCustomer: jest.fn(),
  listCustomers: jest.fn(),
  getCustomer: jest.fn(),
  updateCustomer: jest.fn(),
  deleteCustomer: jest.fn(),
}))

const mockedPermission = requirePermission as jest.Mock
const mockedCustomer = {
  createCustomer: createCustomer as jest.Mock,
  listCustomers: listCustomers as jest.Mock,
  getCustomer: getCustomer as jest.Mock,
  updateCustomer: updateCustomer as jest.Mock,
  deleteCustomer: deleteCustomer as jest.Mock,
}

describe('Customer API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedPermission.mockResolvedValue({ id: 'user-1', permissions: ['customers:read', 'customers:create', 'customers:update'] })
  })

  describe('GET /api/customers', () => {
    it('requires customers:read permission', async () => {
      mockedPermission.mockRejectedValue(new Error('Forbidden: requires permission \'customers:read\''))
      const req = new NextRequest('http://localhost/api/customers')
      const res = await customersGET(req)
      expect(res.status).toBe(403)
    })

    it('returns paginated customer list', async () => {
      mockedCustomer.listCustomers.mockResolvedValue({
        data: [{ id: 'cust-1', name: 'Ramesh Kumar', phone: '9845012345' }],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      })
      const req = new NextRequest('http://localhost/api/customers?search=Ramesh')
      const res = await customersGET(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data[0].name).toBe('Ramesh Kumar')
    })

    it('enforces __NO_ACCESS__ when user has no organizationId and is not superAdmin', async () => {
      mockedPermission.mockResolvedValue({ id: 'user-unassigned', permissions: ['customers:read'], isSuperAdmin: false, organizationId: undefined })
      mockedCustomer.listCustomers.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 1 },
      })
      const req = new NextRequest('http://localhost/api/customers')
      const res = await customersGET(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data).toHaveLength(0)
      expect(mockedCustomer.listCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: '__NO_ACCESS__' })
      )
    })

    it('scopes by organizationId when user has organizationId', async () => {
      mockedPermission.mockResolvedValue({ id: 'user-org1', permissions: ['customers:read'], isSuperAdmin: false, organizationId: 'org-apollo' })
      mockedCustomer.listCustomers.mockResolvedValue({
        data: [{ id: 'cust-1', name: 'Apollo Patient' }],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      })
      const req = new NextRequest('http://localhost/api/customers')
      const res = await customersGET(req)
      expect(res.status).toBe(200)
      expect(mockedCustomer.listCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-apollo' })
      )
    })

    it('leaves organizationId undefined when user is superAdmin', async () => {
      mockedPermission.mockResolvedValue({ id: 'user-super', permissions: ['customers:read'], isSuperAdmin: true, organizationId: undefined })
      mockedCustomer.listCustomers.mockResolvedValue({
        data: [{ id: 'cust-1' }, { id: 'cust-2' }],
        pagination: { page: 1, limit: 20, total: 2, pages: 1 },
      })
      const req = new NextRequest('http://localhost/api/customers')
      const res = await customersGET(req)
      expect(res.status).toBe(200)
      expect(mockedCustomer.listCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: undefined })
      )
    })
  })

  describe('POST /api/customers', () => {
    it('validates customer payload', async () => {
      const req = new NextRequest('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      })
      const res = await customersPOST(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('VALIDATION')
    })

    it('creates customer with 201', async () => {
      mockedCustomer.createCustomer.mockResolvedValue({
        id: 'cust-new',
        name: 'New Patient',
        phone: '9876543210',
      })
      const req = new NextRequest('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Patient',
          phone: '9876543210',
          discountTier: 'CHRONIC_PATIENT',
          patientDiscountPercent: 5,
        }),
      })
      const res = await customersPOST(req)
      expect(res.status).toBe(201)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.id).toBe('cust-new')
    })
  })

  describe('GET /api/customers/:id', () => {
    it('returns 404 for missing customer', async () => {
      mockedCustomer.getCustomer.mockResolvedValue(null)
      const req = new NextRequest('http://localhost/api/customers/missing')
      const res = await customerGET(req, { params: { id: 'missing' } })
      expect(res.status).toBe(404)
    })

    it('returns customer details', async () => {
      mockedCustomer.getCustomer.mockResolvedValue({
        id: 'cust-1',
        name: 'Ramesh Kumar',
        phone: '9845012345',
        sales: [],
        creditNotes: [],
      })
      const req = new NextRequest('http://localhost/api/customers/cust-1')
      const res = await customerGET(req, { params: { id: 'cust-1' } })
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.id).toBe('cust-1')
    })
  })

  describe('PATCH /api/customers/:id', () => {
    it('updates customer record', async () => {
      mockedCustomer.updateCustomer.mockResolvedValue({
        id: 'cust-1',
        name: 'Ramesh Kumar Updated',
      })
      const req = new NextRequest('http://localhost/api/customers/cust-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ramesh Kumar Updated' }),
      })
      const res = await customerPATCH(req, { params: { id: 'cust-1' } })
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.name).toBe('Ramesh Kumar Updated')
    })
  })

  describe('DELETE /api/customers/:id', () => {
    it('deletes customer record', async () => {
      mockedCustomer.deleteCustomer.mockResolvedValue({
        id: 'cust-1',
        name: 'Ramesh Kumar',
      })
      const req = new NextRequest('http://localhost/api/customers/cust-1', {
        method: 'DELETE',
      })
      const res = await customerDELETE(req, { params: { id: 'cust-1' } })
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.id).toBe('cust-1')
    })
  })
})
