/* eslint-disable @typescript-eslint/unbound-method */
import prisma from '@/lib/db/prisma'

import {
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from './customer-service'

jest.mock('@/lib/db/prisma', () => {
  const customer = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  }
  return {
    __esModule: true,
    default: { customer },
    prisma: { customer },
  }
})

describe('Customer Service Multi-Tenant Isolation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('listCustomers', () => {
    it('scopes query by organizationId when specified', async () => {
      ;(prisma.customer.count as jest.Mock).mockResolvedValue(1)
      ;(prisma.customer.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'cust-1',
          name: 'Apollo Patient',
          phone: '9845012345',
          email: null,
          gstin: null,
          address: null,
          city: null,
          state: null,
          pincode: null,
          creditLimit: 0,
          outstandingBalance: 0,
          creditDays: 0,
          isActive: true,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const result = await listCustomers({ organizationId: 'org-apollo' })
      expect(result.pagination.total).toBe(1)
      expect(result.data).toHaveLength(1)
      expect(prisma.customer.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ organizationId: 'org-apollo' }),
      })
      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-apollo' }),
        })
      )
    })

    it('enforces __NO_ACCESS__ when organizationId is "__NO_ACCESS__"', async () => {
      ;(prisma.customer.count as jest.Mock).mockResolvedValue(0)
      ;(prisma.customer.findMany as jest.Mock).mockResolvedValue([])

      const result = await listCustomers({ organizationId: '__NO_ACCESS__' })
      expect(result.pagination.total).toBe(0)
      expect(result.data).toHaveLength(0)
      expect(prisma.customer.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ organizationId: '__NO_ACCESS__' }),
      })
      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: '__NO_ACCESS__' }),
        })
      )
    })

    it('defaults to __NO_ACCESS__ when organizationId is missing and caller is not superAdmin', async () => {
      ;(prisma.customer.count as jest.Mock).mockResolvedValue(0)
      ;(prisma.customer.findMany as jest.Mock).mockResolvedValue([])

      const result = await listCustomers({ page: 1, limit: 20 })
      expect(result.pagination.total).toBe(0)
      expect(result.data).toHaveLength(0)
      expect(prisma.customer.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ organizationId: '__NO_ACCESS__' }),
      })
      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: '__NO_ACCESS__' }),
        })
      )
    })

    it('allows cross-tenant retrieval when isSuperAdmin is true and organizationId is undefined', async () => {
      ;(prisma.customer.count as jest.Mock).mockResolvedValue(2)
      ;(prisma.customer.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'cust-1',
          name: 'Apollo Patient',
          phone: null,
          email: null,
          gstin: null,
          address: null,
          city: null,
          state: null,
          pincode: null,
          creditLimit: 0,
          outstandingBalance: 0,
          creditDays: 0,
          isActive: true,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'cust-2',
          name: 'Krishna Patient',
          phone: null,
          email: null,
          gstin: null,
          address: null,
          city: null,
          state: null,
          pincode: null,
          creditLimit: 0,
          outstandingBalance: 0,
          creditDays: 0,
          isActive: true,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const result = await listCustomers({ isSuperAdmin: true })
      expect(result.pagination.total).toBe(2)
      expect(result.data).toHaveLength(2)
      expect(prisma.customer.count).toHaveBeenCalledWith({
        where: expect.not.objectContaining({ organizationId: expect.anything() }),
      })
      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ organizationId: expect.anything() }),
        })
      )
    })
  })

  describe('getCustomer', () => {
    it('scopes lookup by organizationId when provided', async () => {
      ;(prisma.customer.findFirst as jest.Mock).mockResolvedValue({
        id: 'cust-1',
        organizationId: 'org-apollo',
        name: 'Apollo Patient',
        phone: null,
        email: null,
        gstin: null,
        address: null,
        city: null,
        state: null,
        pincode: null,
        creditLimit: 0,
        outstandingBalance: 0,
        creditDays: 0,
        isActive: true,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        sales: [],
        creditNotes: [],
      })

      const customer = await getCustomer('cust-1', 'org-apollo')
      expect(customer).not.toBeNull()
      expect(customer?.id).toBe('cust-1')
      expect(prisma.customer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cust-1', organizationId: 'org-apollo' },
        })
      )
    })

    it('defaults to __NO_ACCESS__ when organizationId is missing and caller is not superAdmin', async () => {
      ;(prisma.customer.findFirst as jest.Mock).mockResolvedValue(null)

      const customer = await getCustomer('cust-1')
      expect(customer).toBeNull()
      expect(prisma.customer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cust-1', organizationId: '__NO_ACCESS__' },
        })
      )
    })

    it('allows unscoped lookup when isSuperAdmin is true', async () => {
      ;(prisma.customer.findFirst as jest.Mock).mockResolvedValue({
        id: 'cust-1',
        organizationId: 'org-any',
        name: 'Any Org Patient',
        phone: null,
        email: null,
        gstin: null,
        address: null,
        city: null,
        state: null,
        pincode: null,
        creditLimit: 0,
        outstandingBalance: 0,
        creditDays: 0,
        isActive: true,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        sales: [],
        creditNotes: [],
      })

      const customer = await getCustomer('cust-1', undefined, true)
      expect(customer).not.toBeNull()
      expect(prisma.customer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cust-1' },
        })
      )
    })
  })

  describe('updateCustomer', () => {
    it('throws Not Found if customer does not exist in user organization', async () => {
      ;(prisma.customer.findFirst as jest.Mock).mockResolvedValue(null)

      await expect(
        updateCustomer('cust-1', { name: 'Updated' }, 'org-apollo')
      ).rejects.toThrow('Not Found: customer')

      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: 'cust-1', organizationId: 'org-apollo' },
        select: { id: true },
      })
      expect(prisma.customer.update).not.toHaveBeenCalled()
    })

    it('throws Not Found if organizationId is missing and user is not superAdmin', async () => {
      ;(prisma.customer.findFirst as jest.Mock).mockResolvedValue(null)

      await expect(
        updateCustomer('cust-1', { name: 'Updated' })
      ).rejects.toThrow('Not Found: customer')

      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: 'cust-1', organizationId: '__NO_ACCESS__' },
        select: { id: true },
      })
    })

    it('updates customer when organizationId matches', async () => {
      ;(prisma.customer.findFirst as jest.Mock).mockResolvedValue({ id: 'cust-1' })
      ;(prisma.customer.update as jest.Mock).mockResolvedValue({
        id: 'cust-1',
        organizationId: 'org-apollo',
        name: 'Updated Name',
        phone: null,
        email: null,
        outstandingBalance: 0,
      })

      const result = await updateCustomer('cust-1', { name: 'Updated Name' }, 'org-apollo')
      expect(result.name).toBe('Updated Name')
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        data: { name: 'Updated Name' },
      })
    })
  })

  describe('deleteCustomer', () => {
    it('throws Not Found if customer belongs to another tenant', async () => {
      ;(prisma.customer.findFirst as jest.Mock).mockResolvedValue(null)

      await expect(
        deleteCustomer('cust-1', 'org-apollo')
      ).rejects.toThrow('Not Found: customer')

      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: 'cust-1', organizationId: 'org-apollo' },
        select: { id: true },
      })
      expect(prisma.customer.delete).not.toHaveBeenCalled()
    })

    it('throws Not Found if unassociated user tries to delete', async () => {
      ;(prisma.customer.findFirst as jest.Mock).mockResolvedValue(null)

      await expect(
        deleteCustomer('cust-1')
      ).rejects.toThrow('Not Found: customer')

      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: 'cust-1', organizationId: '__NO_ACCESS__' },
        select: { id: true },
      })
    })

    it('deletes customer when organizationId matches', async () => {
      ;(prisma.customer.findFirst as jest.Mock).mockResolvedValue({ id: 'cust-1' })
      ;(prisma.customer.delete as jest.Mock).mockResolvedValue({
        id: 'cust-1',
        organizationId: 'org-apollo',
        name: 'Apollo Patient',
      })

      const result = await deleteCustomer('cust-1', 'org-apollo')
      expect(result.id).toBe('cust-1')
      expect(prisma.customer.delete).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
      })
    })
  })
})
