import prisma from '@/lib/db/prisma'
import { getCatalogSummaryMetrics } from '@/lib/products/product-analytics-service'

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  default: {
    product: {
      findMany: jest.fn(),
    },
  },
}))

const prismaMock = prisma as unknown as {
  product: { findMany: jest.Mock }
}

describe('Product Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('computes accurate catalog-wide stock, valuation, and alerts', async () => {
    const nearDate = new Date()
    nearDate.setDate(nearDate.getDate() + 45) // < 90 days

    const farDate = new Date()
    farDate.setFullYear(farDate.getFullYear() + 2)

    prismaMock.product.findMany.mockResolvedValue([
      {
        id: 'prod-1',
        costPrice: 50,
        mrp: 100,
        minStockLevel: 10,
        drugSchedule: 'H',
        manufacturer: 'Sun Pharma',
        batches: [
          {
            quantity: 30,
            reservedQuantity: 5,
            soldQuantity: 5, // Available = 20
            purchasePrice: 50,
            mrp: 100,
            expiryDate: nearDate,
          },
        ],
      },
      {
        id: 'prod-2',
        costPrice: 20,
        mrp: 40,
        minStockLevel: 15,
        drugSchedule: 'NONE',
        manufacturer: 'Cipla Ltd',
        batches: [
          {
            quantity: 5,
            reservedQuantity: 0,
            soldQuantity: 0, // Available = 5 (<= minStockLevel 15 -> low stock)
            purchasePrice: 20,
            mrp: 40,
            expiryDate: farDate,
          },
        ],
      },
      {
        id: 'prod-3',
        costPrice: 10,
        mrp: 25,
        minStockLevel: 5,
        drugSchedule: 'NONE',
        manufacturer: 'Cipla Ltd',
        batches: [], // Out of stock
      },
    ])

    const res = await getCatalogSummaryMetrics()

    expect(res.totalProducts).toBe(3)
    expect(res.totalInStockUnits).toBe(25) // 20 + 5
    // Valuation: (20 * 50) + (5 * 20) = 1000 + 100 = 1100
    expect(res.totalValuationCost).toBe(1100)
    // MRP: (20 * 100) + (5 * 40) = 2000 + 200 = 2200
    expect(res.totalValuationMrp).toBe(2200)
    expect(res.overallMarginPercent).toBe(50) // (1100 / 2200) * 100 = 50%
    expect(res.lowStockCount).toBe(1)
    expect(res.outOfStockCount).toBe(1)
    expect(res.nearExpiryCount).toBe(1)
    expect(res.scheduleHCount).toBe(1)
    expect(res.manufacturerCount).toBe(2) // Sun Pharma, Cipla Ltd
  })

  it('handles empty database gracefully with 0 totals', async () => {
    prismaMock.product.findMany.mockResolvedValue([])

    const res = await getCatalogSummaryMetrics()

    expect(res.totalProducts).toBe(0)
    expect(res.totalInStockUnits).toBe(0)
    expect(res.totalValuationCost).toBe(0)
    expect(res.totalValuationMrp).toBe(0)
    expect(res.lowStockCount).toBe(0)
    expect(res.outOfStockCount).toBe(0)
    expect(res.manufacturerCount).toBe(0)
  })
})
