/** @jest-environment node */

import {
  runInWorker,
  sanitizeDeadStockInventories,
  sanitizePayload,
} from '../inventory-analytics-service'
import { computeDeadStock } from '../workers/inventory-analytics.worker.js'

describe('Adversarial Stress Test Suite: Capital Lockup & Aging Calculations', () => {
  const dayMs = 24 * 60 * 60 * 1000
  const now = new Date('2026-11-01T12:00:00.000Z').getTime()

  describe('1. Inactivity Boundary Conditions (59d, 60d, 89d, 90d, 179d, 180d)', () => {
    it('boundary 59d: classifies as HEALTHY, excluded from aging KPI summary and deadItems table', () => {
      // 59 days ago exactly
      const lastActivityTime = now - 59 * dayMs
      const inventories = [
        {
          id: 'inv-59',
          productId: 'prod-59',
          availableQuantity: 10,
          product: {
            name: 'Boundary Drug 59d',
            sku: 'SKU-59',
            costPrice: 50,
            mrp: 100,
            unitOfMeasure: 'Box',
          },
        },
      ]

      const result = computeDeadStock({
        inventories,
        saleItemsMap: { 'prod-59': lastActivityTime },
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 60,
      })

      // Must be excluded from summary and deadItems
      expect(result.summary.totalDeadItemsCount).toBe(0)
      expect(result.summary.slowMovingCount).toBe(0)
      expect(result.summary.deadStockCount).toBe(0)
      expect(result.summary.obsoleteCount).toBe(0)
      expect(result.summary.totalDeadCapitalAtCost).toBe(0)
      expect(result.summary.totalDeadCapitalAtMrp).toBe(0)
      expect(result.deadItems).toHaveLength(0)
    })

    it('boundary 60d: classifies as SLOW_MOVING, included in aging KPI summary and deadItems (when threshold=60)', () => {
      // Exactly 60 days
      const lastActivityTime = now - 60 * dayMs
      const inventories = [
        {
          id: 'inv-60',
          productId: 'prod-60',
          availableQuantity: 20,
          product: {
            name: 'Boundary Drug 60d',
            sku: 'SKU-60',
            costPrice: 25,
            mrp: 40,
            unitOfMeasure: 'Strip',
          },
        },
      ]

      const result = computeDeadStock({
        inventories,
        saleItemsMap: { 'prod-60': lastActivityTime },
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 60,
      })

      expect(result.summary.totalDeadItemsCount).toBe(1)
      expect(result.summary.slowMovingCount).toBe(1)
      expect(result.summary.deadStockCount).toBe(0)
      expect(result.summary.obsoleteCount).toBe(0)
      expect(result.summary.totalDeadCapitalAtCost).toBe(500) // 20 * 25
      expect(result.summary.totalDeadCapitalAtMrp).toBe(800) // 20 * 40
      expect(result.deadItems).toHaveLength(1)
      expect(result.deadItems[0].daysInactive).toBe(60)
      expect(result.deadItems[0].status).toBe('SLOW_MOVING')
    })

    it('boundary 89d: classifies as SLOW_MOVING, included in summary, excluded from threshold=90 table', () => {
      // 89 days and 23 hours
      const lastActivityTime = now - (89 * dayMs + 23 * 60 * 60 * 1000)
      const inventories = [
        {
          id: 'inv-89',
          productId: 'prod-89',
          availableQuantity: 15,
          product: {
            name: 'Boundary Drug 89d',
            sku: 'SKU-89',
            costPrice: 30,
            mrp: 50,
            unitOfMeasure: 'Strip',
          },
        },
      ]

      const result = computeDeadStock({
        inventories,
        saleItemsMap: { 'prod-89': lastActivityTime },
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 90,
      })

      // Summary must count as SLOW_MOVING
      expect(result.summary.totalDeadItemsCount).toBe(1)
      expect(result.summary.slowMovingCount).toBe(1)
      expect(result.summary.deadStockCount).toBe(0)
      expect(result.summary.obsoleteCount).toBe(0)
      // Table with threshold 90d must filter it out
      expect(result.deadItems).toHaveLength(0)
    })

    it('boundary 90d: classifies as DEAD_STOCK, counted in deadStockCount and included in threshold=90 table', () => {
      // Exactly 90 days
      const lastActivityTime = now - 90 * dayMs
      const inventories = [
        {
          id: 'inv-90',
          productId: 'prod-90',
          availableQuantity: 10,
          product: {
            name: 'Boundary Drug 90d',
            sku: 'SKU-90',
            costPrice: 100,
            mrp: 150,
            unitOfMeasure: 'Vial',
          },
        },
      ]

      const result = computeDeadStock({
        inventories,
        saleItemsMap: { 'prod-90': lastActivityTime },
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 90,
      })

      expect(result.summary.totalDeadItemsCount).toBe(1)
      expect(result.summary.slowMovingCount).toBe(0)
      expect(result.summary.deadStockCount).toBe(1)
      expect(result.summary.obsoleteCount).toBe(0)
      expect(result.summary.totalDeadCapitalAtCost).toBe(1000)
      expect(result.summary.totalDeadCapitalAtMrp).toBe(1500)
      expect(result.deadItems).toHaveLength(1)
      expect(result.deadItems[0].daysInactive).toBe(90)
      expect(result.deadItems[0].status).toBe('DEAD_STOCK')
    })

    it('boundary 179d: classifies as DEAD_STOCK, excluded from threshold=180 table', () => {
      const lastActivityTime = now - 179 * dayMs
      const inventories = [
        {
          id: 'inv-179',
          productId: 'prod-179',
          availableQuantity: 8,
          product: {
            name: 'Boundary Drug 179d',
            sku: 'SKU-179',
            costPrice: 80,
            mrp: 120,
            unitOfMeasure: 'Bottle',
          },
        },
      ]

      const result = computeDeadStock({
        inventories,
        saleItemsMap: { 'prod-179': lastActivityTime },
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 180,
      })

      expect(result.summary.totalDeadItemsCount).toBe(1)
      expect(result.summary.slowMovingCount).toBe(0)
      expect(result.summary.deadStockCount).toBe(1)
      expect(result.summary.obsoleteCount).toBe(0)
      // Excluded from threshold=180 table
      expect(result.deadItems).toHaveLength(0)
    })

    it('boundary 180d: classifies as OBSOLETE, counted in obsoleteCount and included in threshold=180 table', () => {
      const lastActivityTime = now - 180 * dayMs
      const inventories = [
        {
          id: 'inv-180',
          productId: 'prod-180',
          availableQuantity: 5,
          product: {
            name: 'Boundary Drug 180d',
            sku: 'SKU-180',
            costPrice: 200,
            mrp: 300,
            unitOfMeasure: 'Pack',
          },
        },
      ]

      const result = computeDeadStock({
        inventories,
        saleItemsMap: { 'prod-180': lastActivityTime },
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 180,
      })

      expect(result.summary.totalDeadItemsCount).toBe(1)
      expect(result.summary.slowMovingCount).toBe(0)
      expect(result.summary.deadStockCount).toBe(0)
      expect(result.summary.obsoleteCount).toBe(1)
      expect(result.summary.totalDeadCapitalAtCost).toBe(1000)
      expect(result.summary.totalDeadCapitalAtMrp).toBe(1500)
      expect(result.deadItems).toHaveLength(1)
      expect(result.deadItems[0].daysInactive).toBe(180)
      expect(result.deadItems[0].status).toBe('OBSOLETE')
    })
  })

  describe('2. Threshold Filtering Decoupling from Summary KPI Cards', () => {
    it('preserves complete summary KPI counts across all threshold filters (60d, 90d, 180d)', () => {
      const inventories = [
        // 1 Healthy item (20d inactive)
        {
          id: 'inv-h1',
          productId: 'prod-h1',
          availableQuantity: 50,
          updatedAt: new Date(now - 20 * dayMs).toISOString(),
          product: { name: 'Healthy Item', sku: 'H-1', costPrice: 10, mrp: 20 },
        },
        // 2 Slow Moving items (65d and 80d)
        {
          id: 'inv-s1',
          productId: 'prod-s1',
          availableQuantity: 10,
          updatedAt: new Date(now - 65 * dayMs).toISOString(),
          product: { name: 'Slow Item 1', sku: 'S-1', costPrice: 20, mrp: 30 },
        },
        {
          id: 'inv-s2',
          productId: 'prod-s2',
          availableQuantity: 15,
          updatedAt: new Date(now - 80 * dayMs).toISOString(),
          product: { name: 'Slow Item 2', sku: 'S-2', costPrice: 40, mrp: 60 },
        },
        // 3 Dead Stock items (95d, 110d, 150d)
        {
          id: 'inv-d1',
          productId: 'prod-d1',
          availableQuantity: 20,
          updatedAt: new Date(now - 95 * dayMs).toISOString(),
          product: { name: 'Dead Item 1', sku: 'D-1', costPrice: 30, mrp: 50 },
        },
        {
          id: 'inv-d2',
          productId: 'prod-d2',
          availableQuantity: 25,
          updatedAt: new Date(now - 110 * dayMs).toISOString(),
          product: { name: 'Dead Item 2', sku: 'D-2', costPrice: 50, mrp: 80 },
        },
        {
          id: 'inv-d3',
          productId: 'prod-d3',
          availableQuantity: 5,
          updatedAt: new Date(now - 150 * dayMs).toISOString(),
          product: { name: 'Dead Item 3', sku: 'D-3', costPrice: 100, mrp: 150 },
        },
        // 4 Obsolete items (190d, 220d, 300d, 365d)
        {
          id: 'inv-o1',
          productId: 'prod-o1',
          availableQuantity: 10,
          updatedAt: new Date(now - 190 * dayMs).toISOString(),
          product: { name: 'Obsolete 1', sku: 'O-1', costPrice: 60, mrp: 90 },
        },
        {
          id: 'inv-o2',
          productId: 'prod-o2',
          availableQuantity: 12,
          updatedAt: new Date(now - 220 * dayMs).toISOString(),
          product: { name: 'Obsolete 2', sku: 'O-2', costPrice: 70, mrp: 100 },
        },
        {
          id: 'inv-o3',
          productId: 'prod-o3',
          availableQuantity: 8,
          updatedAt: new Date(now - 300 * dayMs).toISOString(),
          product: { name: 'Obsolete 3', sku: 'O-3', costPrice: 80, mrp: 110 },
        },
        {
          id: 'inv-o4',
          productId: 'prod-o4',
          availableQuantity: 4,
          updatedAt: new Date(now - 365 * dayMs).toISOString(),
          product: { name: 'Obsolete 4', sku: 'O-4', costPrice: 90, mrp: 130 },
        },
      ]

      // Expected aging items: 2 slow + 3 dead + 4 obsolete = 9
      // Expected total cost:
      // s1: 10*20 = 200
      // s2: 15*40 = 600
      // d1: 20*30 = 600
      // d2: 25*50 = 1250
      // d3: 5*100 = 500
      // o1: 10*60 = 600
      // o2: 12*70 = 840
      // o3: 8*80 = 640
      // o4: 4*90 = 360
      // Total = 200+600+600+1250+500+600+840+640+360 = 5590

      // Case A: thresholdDays = 60
      const res60 = computeDeadStock({
        inventories,
        saleItemsMap: {},
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 60,
      })
      expect(res60.summary.totalDeadItemsCount).toBe(9)
      expect(res60.summary.slowMovingCount).toBe(2)
      expect(res60.summary.deadStockCount).toBe(3)
      expect(res60.summary.obsoleteCount).toBe(4)
      expect(res60.summary.totalDeadCapitalAtCost).toBe(5590)
      expect(res60.deadItems).toHaveLength(9)

      // Case B: thresholdDays = 90
      const res90 = computeDeadStock({
        inventories,
        saleItemsMap: {},
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 90,
      })
      // Summary MUST remain identical to res60!
      expect(res90.summary.totalDeadItemsCount).toBe(9)
      expect(res90.summary.slowMovingCount).toBe(2)
      expect(res90.summary.deadStockCount).toBe(3)
      expect(res90.summary.obsoleteCount).toBe(4)
      expect(res90.summary.totalDeadCapitalAtCost).toBe(5590)
      // Only 3 dead + 4 obsolete = 7 in table
      expect(res90.deadItems).toHaveLength(7)
      expect(res90.deadItems.every((item) => item.daysInactive >= 90)).toBe(true)

      // Case C: thresholdDays = 180
      const res180 = computeDeadStock({
        inventories,
        saleItemsMap: {},
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 180,
      })
      // Summary MUST remain identical!
      expect(res180.summary.totalDeadItemsCount).toBe(9)
      expect(res180.summary.slowMovingCount).toBe(2)
      expect(res180.summary.deadStockCount).toBe(3)
      expect(res180.summary.obsoleteCount).toBe(4)
      expect(res180.summary.totalDeadCapitalAtCost).toBe(5590)
      // Only 4 obsolete items in table
      expect(res180.deadItems).toHaveLength(4)
      expect(res180.deadItems.every((item) => item.daysInactive >= 180)).toBe(true)
    })
  })

  describe('3. Working Capital Math, Rounding & Fallbacks', () => {
    it('accurately computes locked capital with 70% MRP fallback when costPrice is null/undefined', () => {
      const inventories = [
        {
          id: 'inv-no-cost',
          productId: 'prod-no-cost',
          availableQuantity: 10,
          updatedAt: new Date(now - 100 * dayMs).toISOString(),
          product: {
            name: 'Item With Missing Cost',
            sku: 'SKU-NOCP',
            costPrice: null, // missing cost
            mrp: 120,
          },
        },
      ]

      const result = computeDeadStock({
        inventories,
        saleItemsMap: {},
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 60,
      })

      // 70% of 120 = 84
      // 10 units * 84 = 840 at cost
      // 10 units * 120 = 1200 at mrp
      expect(result.summary.totalDeadCapitalAtCost).toBe(840)
      expect(result.summary.totalDeadCapitalAtMrp).toBe(1200)
      expect(result.deadItems[0].costPrice).toBe(84)
      expect(result.deadItems[0].capitalLockedAtCost).toBe(840)
      expect(result.deadItems[0].capitalLockedAtMrp).toBe(1200)
    })

    it('accurately rounds fractional cents/paise without floating-point inaccuracies', () => {
      const inventories = [
        {
          id: 'inv-float',
          productId: 'prod-float',
          availableQuantity: 7,
          updatedAt: new Date(now - 100 * dayMs).toISOString(),
          product: {
            name: 'Floating Price Syrup',
            sku: 'SKU-FLOAT',
            costPrice: 33.33,
            mrp: 49.99,
          },
        },
      ]

      const result = computeDeadStock({
        inventories,
        saleItemsMap: {},
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 60,
      })

      // 7 * 33.33 = 233.31
      // 7 * 49.99 = 349.93
      expect(result.deadItems[0].capitalLockedAtCost).toBe(233.31)
      expect(result.deadItems[0].capitalLockedAtMrp).toBe(349.93)
      expect(result.summary.totalDeadCapitalAtCost).toBe(233.31)
      expect(result.summary.totalDeadCapitalAtMrp).toBe(349.93)
    })

    it('sorts dead items in descending order of capitalLockedAtCost', () => {
      const inventories = [
        {
          id: 'inv-low',
          productId: 'prod-low',
          availableQuantity: 2,
          updatedAt: new Date(now - 100 * dayMs).toISOString(),
          product: { name: 'Low Value', sku: 'L-1', costPrice: 10, mrp: 20 }, // 20
        },
        {
          id: 'inv-high',
          productId: 'prod-high',
          availableQuantity: 10,
          updatedAt: new Date(now - 100 * dayMs).toISOString(),
          product: { name: 'High Value', sku: 'H-1', costPrice: 500, mrp: 800 }, // 5000
        },
        {
          id: 'inv-mid',
          productId: 'prod-mid',
          availableQuantity: 5,
          updatedAt: new Date(now - 100 * dayMs).toISOString(),
          product: { name: 'Mid Value', sku: 'M-1', costPrice: 100, mrp: 150 }, // 500
        },
      ]

      const result = computeDeadStock({
        inventories,
        saleItemsMap: {},
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 60,
      })

      expect(result.deadItems[0].productId).toBe('prod-high')
      expect(result.deadItems[0].capitalLockedAtCost).toBe(5000)
      expect(result.deadItems[1].productId).toBe('prod-mid')
      expect(result.deadItems[1].capitalLockedAtCost).toBe(500)
      expect(result.deadItems[2].productId).toBe('prod-low')
      expect(result.deadItems[2].capitalLockedAtCost).toBe(20)
    })
  })

  describe('4. Supplier Attribution Edge Cases', () => {
    it('resolves supplier from batch.purchase.supplier', () => {
      const inventories = [
        {
          id: 'inv-sup-purchase',
          productId: 'prod-sup-purchase',
          availableQuantity: 10,
          updatedAt: new Date(now - 100 * dayMs).toISOString(),
          product: {
            name: 'Medicine A',
            sku: 'MED-A',
            costPrice: 50,
            mrp: 80,
            batches: [
              {
                id: 'b-1',
                batchNumber: 'BAT-01',
                purchase: {
                  supplier: { id: 'sup-abbott', name: 'Abbott Healthcare' },
                },
              },
            ],
          },
        },
      ]

      const result = computeDeadStock({
        inventories,
        saleItemsMap: {},
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 60,
      })

      expect(result.deadItems[0].supplierName).toBe('Abbott Healthcare')
      expect(result.deadItems[0].supplierId).toBe('sup-abbott')
    })

    it('resolves supplier from direct batch.supplier', () => {
      const inventories = [
        {
          id: 'inv-sup-direct',
          productId: 'prod-sup-direct',
          availableQuantity: 10,
          updatedAt: new Date(now - 100 * dayMs).toISOString(),
          product: {
            name: 'Medicine B',
            sku: 'MED-B',
            costPrice: 50,
            mrp: 80,
            batches: [
              {
                id: 'b-2',
                batchNumber: 'BAT-02',
                supplier: { id: 'sup-sun', name: 'Sun Pharma' },
              },
            ],
          },
        },
      ]

      const result = computeDeadStock({
        inventories,
        saleItemsMap: {},
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 60,
      })

      expect(result.deadItems[0].supplierName).toBe('Sun Pharma')
      expect(result.deadItems[0].supplierId).toBe('sup-sun')
    })

    it('resolves supplier from batch.supplierRef when no supplier object exists', () => {
      const inventories = [
        {
          id: 'inv-sup-ref',
          productId: 'prod-sup-ref',
          availableQuantity: 10,
          updatedAt: new Date(now - 100 * dayMs).toISOString(),
          product: {
            name: 'Medicine C',
            sku: 'MED-C',
            costPrice: 50,
            mrp: 80,
            batches: [
              {
                id: 'b-3',
                batchNumber: 'BAT-03',
                supplierRef: 'CHALLAN-2026-X88',
              },
            ],
          },
        },
      ]

      const result = computeDeadStock({
        inventories,
        saleItemsMap: {},
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 60,
      })

      expect(result.deadItems[0].supplierName).toBe('CHALLAN-2026-X88')
      expect(result.deadItems[0].supplierId).toBeNull()
    })

    it('falls back to "Direct / Primary" when batch has no supplier info', () => {
      const inventories = [
        {
          id: 'inv-sup-none',
          productId: 'prod-sup-none',
          availableQuantity: 10,
          updatedAt: new Date(now - 100 * dayMs).toISOString(),
          product: {
            name: 'Medicine D',
            sku: 'MED-D',
            costPrice: 50,
            mrp: 80,
            batches: [
              {
                id: 'b-4',
                batchNumber: 'BAT-04',
              },
            ],
          },
        },
      ]

      const result = computeDeadStock({
        inventories,
        saleItemsMap: {},
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 60,
      })

      expect(result.deadItems[0].supplierName).toBe('Direct / Primary')
      expect(result.deadItems[0].supplierId).toBeNull()
    })

    it('falls back to "Direct / Primary" when product has no batches at all', () => {
      const inventories = [
        {
          id: 'inv-no-batch',
          productId: 'prod-no-batch',
          availableQuantity: 10,
          updatedAt: new Date(now - 100 * dayMs).toISOString(),
          product: {
            name: 'Medicine E',
            sku: 'MED-E',
            costPrice: 50,
            mrp: 80,
            batches: [],
          },
        },
      ]

      const result = computeDeadStock({
        inventories,
        saleItemsMap: {},
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 60,
      })

      expect(result.deadItems[0].supplierName).toBe('Direct / Primary')
      expect(result.deadItems[0].supplierId).toBeNull()
      expect(result.deadItems[0].batchNumber).toBeNull()
      expect(result.deadItems[0].expiryDate).toBeNull()
    })
  })

  describe('5. Real Worker Thread Boundary Verification (forceWorker: true)', () => {
    it('executes dead stock analysis across worker thread without serialization failure and matches sync output', async () => {
      const mockDecimalCost = { toNumber: () => 75.5, d: [75.5], s: 1, e: 1 }
      const mockDecimalMrp = { toNumber: () => 120.0, d: [120.0], s: 1, e: 1 }

      const rawInventories = [
        {
          id: 'inv-wt-1',
          productId: 'prod-wt-1',
          branchId: 'br-main',
          availableQuantity: 40,
          createdAt: new Date(now - 100 * dayMs),
          updatedAt: new Date(now - 5 * dayMs),
          product: {
            id: 'prod-wt-1',
            name: 'Worker Thread Tested Syrup',
            sku: 'WTT-01',
            costPrice: mockDecimalCost,
            mrp: mockDecimalMrp,
            batches: [
              {
                id: 'b-wt-1',
                batchNumber: 'BAT-WT-01',
                createdAt: new Date(now - 100 * dayMs),
                expiryDate: new Date('2027-12-31T00:00:00Z'),
                purchasePrice: mockDecimalCost,
                purchase: {
                  supplier: { id: 'sup-dr-reddy', name: 'Dr. Reddy Labs' },
                },
              },
            ],
          },
        },
      ]

      const sanitized = sanitizeDeadStockInventories(rawInventories)

      const workerResult = await runInWorker<any, any>(
        'ANALYZE_DEAD_STOCK',
        {
          inventories: sanitized,
          saleItemsMap: {},
          movementsMap: {},
          nowTimestamp: now,
          thresholdDays: 90,
        },
        { forceWorker: true }
      )

      expect(workerResult).toBeDefined()
      expect(workerResult.summary.totalDeadItemsCount).toBe(1)
      expect(workerResult.summary.deadStockCount).toBe(1)
      expect(workerResult.summary.totalDeadCapitalAtCost).toBe(3020) // 40 * 75.5
      expect(workerResult.summary.totalDeadCapitalAtMrp).toBe(4800) // 40 * 120
      expect(workerResult.deadItems).toHaveLength(1)
      expect(workerResult.deadItems[0].daysInactive).toBe(100)
      expect(workerResult.deadItems[0].supplierName).toBe('Dr. Reddy Labs')
      expect(workerResult.deadItems[0].supplierId).toBe('sup-dr-reddy')
    })
  })
})
