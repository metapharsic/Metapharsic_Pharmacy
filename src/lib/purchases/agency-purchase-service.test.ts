import { prisma } from '@/lib/db/prisma'
import {
  getAgencyPurchases,
  lookupBatchPurchaseHistory,
} from './agency-purchase-service'

jest.mock('@/lib/db/prisma', () => {
  const supplier = {
    findMany: jest.fn(),
  }
  const purchaseItem = {
    findMany: jest.fn(),
  }
  const client = { supplier, purchaseItem }
  return {
    __esModule: true,
    default: client,
    prisma: client,
  }
})

describe('Agency Purchase Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('groups purchases by agency/supplier and computes statistics', async () => {
    const mockSuppliers = [
      {
        id: 'sup-1',
        name: 'MedLife Agency',
        contactPerson: 'Arun',
        phone: '9988776655',
        email: 'medlife@dist.com',
        gstin: '29ABCDE1234F1Z5',
        dlNumber: '20B-1234',
        creditDays: 30,
        outstandingBalance: 5000,
        purchases: [
          {
            id: 'pur-1',
            purchaseNumber: 'PO-001',
            invoiceNumber: 'INV-MED-01',
            invoiceDate: new Date('2026-01-01'),
            purchaseDate: new Date('2026-01-01'),
            status: 'RECEIVED',
            totalAmount: 10000,
            amountPaid: 5000,
            balanceDue: 5000,
            items: [
              {
                id: 'it-1',
                product: { name: 'Paracetamol', sku: 'PCM-500', drugSchedule: 'SCHEDULE_H' },
                receivedQuantity: 100,
                unitCost: 10,
                totalAmount: 1000,
                batchNumber: 'B101',
                expiryDate: new Date('2027-01-01'),
                batch: { status: 'ACTIVE' },
              },
            ],
            returns: [],
          },
        ],
      },
    ]

    ;(prisma.supplier.findMany as jest.Mock).mockResolvedValue(mockSuppliers)

    const result = await getAgencyPurchases({ branchId: 'branch-1' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('MedLife Agency')
    expect(result[0].totalPurchased).toBe(10000)
    expect(result[0].totalBalanceDue).toBe(5000)
    expect(result[0].invoices[0].itemsCount).toBe(1)
    expect(result[0].invoices[0].items[0].batchNumber).toBe('B101')
  })

  it('looks up batch purchase history for cost verification', async () => {
    const mockItems = [
      {
        id: 'it-1',
        batchNumber: 'BATCH-XYZ',
        expiryDate: new Date('2027-05-01'),
        manufacturingDate: new Date('2025-05-01'),
        receivedQuantity: 50,
        unitCost: 45,
        mrp: 80,
        totalAmount: 2250,
        createdAt: new Date(),
        product: { name: 'Cetirizine 10mg', sku: 'CTZ-10', unitOfMeasure: 'STRIP' },
        batch: { id: 'b-1', batchNumber: 'BATCH-XYZ', expiryDate: new Date('2027-05-01'), status: 'ACTIVE' },
        purchase: {
          purchaseNumber: 'PO-99',
          invoiceNumber: 'INV-99',
          purchaseDate: new Date(),
          supplier: { id: 'sup-1', name: 'Apex Pharma Distributors', gstin: '29AA', phone: '98765' },
        },
      },
    ]

    ;(prisma.purchaseItem.findMany as jest.Mock).mockResolvedValue(mockItems)

    const result = await lookupBatchPurchaseHistory('BATCH-XYZ')
    expect(result).toHaveLength(1)
    expect(result[0].batchNumber).toBe('BATCH-XYZ')
    expect(result[0].supplierName).toBe('Apex Pharma Distributors')
    expect(result[0].unitCost).toBe(45)
    expect(result[0].mrp).toBe(80)
  })
})
