import prisma from '@/lib/db/prisma'
import { getCategoryAnalytics } from '@/lib/categories/category-analytics-service'

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  default: {
    category: {
      findMany: jest.fn(),
    },
    productCategory: {
      findMany: jest.fn(),
    },
  },
}))

const prismaMock = prisma as unknown as {
  category: { findMany: jest.Mock }
  productCategory: { findMany: jest.Mock }
}

describe('Category Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('computes accurate stock valuation at Cost and MRP and rollups', async () => {
    prismaMock.category.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Tablets', slug: 'tablets', parentId: null, isActive: true },
      { id: 'cat-2', name: 'Antibiotics', slug: 'antibiotics', parentId: 'cat-1', isActive: true },
    ])

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30) // Within 90 days -> near expiry

    const distantDate = new Date()
    distantDate.setFullYear(distantDate.getFullYear() + 2) // > 90 days

    prismaMock.productCategory.findMany.mockResolvedValue([
      {
        categoryId: 'cat-2',
        productId: 'prod-1',
        product: {
          id: 'prod-1',
          name: 'Amoxicillin 500mg',
          costPrice: 40,
          mrp: 60,
          minStockLevel: 20,
          drugSchedule: 'H',
          isPrescriptionRequired: true,
          batches: [
            {
              id: 'batch-1',
              batchNumber: 'AMX-001',
              expiryDate: futureDate,
              purchasePrice: 40,
              mrp: 60,
              quantity: 15,
              reservedQuantity: 0,
              soldQuantity: 5, // Available = 10 (which is <= minStockLevel 20 -> low stock)
            },
          ],
        },
      },
      {
        categoryId: 'cat-1',
        productId: 'prod-2',
        product: {
          id: 'prod-2',
          name: 'Paracetamol 650mg',
          costPrice: 15,
          mrp: 30,
          minStockLevel: 10,
          drugSchedule: 'NONE',
          isPrescriptionRequired: false,
          batches: [
            {
              id: 'batch-2',
              batchNumber: 'PCM-002',
              expiryDate: distantDate,
              purchasePrice: 15,
              mrp: 30,
              quantity: 50,
              reservedQuantity: 0,
              soldQuantity: 0, // Available = 50 (> minStockLevel 10)
            },
          ],
        },
      },
    ])

    const res = await getCategoryAnalytics()

    expect(res).toBeDefined()
    expect(res.grandTotals.totalCategories).toBe(2)
    expect(res.grandTotals.totalProductsMapped).toBe(2)
    expect(res.grandTotals.totalInventoryUnits).toBe(60) // 10 + 50
    // Valuation: (10 * 40) + (50 * 15) = 400 + 750 = 1150
    expect(res.grandTotals.totalValuationCost).toBe(1150)
    // MRP Valuation: (10 * 60) + (50 * 30) = 600 + 1500 = 2100
    expect(res.grandTotals.totalValuationMrp).toBe(2100)
    expect(res.grandTotals.totalPotentialGrossProfit).toBe(950) // 2100 - 1150
    expect(res.grandTotals.totalNearExpiryBatches).toBe(1)
    expect(res.grandTotals.totalLowStockProducts).toBe(1)

    // Check specific Antibiotics category
    const antibiotics = res.categoryMetrics['cat-2']
    expect(antibiotics.productCount).toBe(1)
    expect(antibiotics.availableStockUnits).toBe(10)
    expect(antibiotics.valuationCost).toBe(400)
    expect(antibiotics.valuationMrp).toBe(600)
    expect(antibiotics.potentialGrossProfit).toBe(200)
    expect(antibiotics.scheduleCount).toBe(1)
    expect(antibiotics.rxRequiredCount).toBe(1)
    expect(antibiotics.nearExpiryBatchesCount).toBe(1)
    expect(antibiotics.lowStockProductsCount).toBe(1)
  })

  it('handles empty categories gracefully with 0 totals', async () => {
    prismaMock.category.findMany.mockResolvedValue([
      { id: 'cat-empty', name: 'Ayurveda', slug: 'ayurveda', parentId: null, isActive: true },
    ])
    prismaMock.productCategory.findMany.mockResolvedValue([])

    const res = await getCategoryAnalytics()

    expect(res.grandTotals.totalCategories).toBe(1)
    expect(res.grandTotals.totalProductsMapped).toBe(0)
    expect(res.grandTotals.totalInventoryUnits).toBe(0)
    expect(res.grandTotals.totalValuationCost).toBe(0)
    expect(res.grandTotals.totalValuationMrp).toBe(0)

    const ayur = res.categoryMetrics['cat-empty']
    expect(ayur.availableStockUnits).toBe(0)
    expect(ayur.valuationCost).toBe(0)
    expect(ayur.marginPercent).toBe(0)
  })
})
