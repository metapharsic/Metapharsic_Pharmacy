/** @jest-environment node */

import * as workerThreads from 'worker_threads'
import {
  runInWorker,
  sanitizeDeadStockInventories,
  sanitizePayload,
  getAnalyticsWorkerPath,
} from '../inventory-analytics-service'
import { computeDeadStock } from '../workers/inventory-analytics.worker.js'

describe('Empirical Verification: Multi-Threaded Dead Stock Engine, Concurrency & Serialization', () => {
  const dayMs = 24 * 60 * 60 * 1000
  const now = new Date('2026-11-01T12:00:00.000Z').getTime()

  // Fake Prisma Decimal class mimicking @prisma/client/runtime Decimal
  class MockPrismaDecimal {
    private val: number
    public d: number[]
    public s: number
    public e: number

    constructor(val: number) {
      this.val = val
      this.d = [val]
      this.s = 1
      this.e = 1
    }

    toNumber() {
      return this.val
    }
    toString() {
      return String(this.val)
    }
    toFixed(digits: number) {
      return this.val.toFixed(digits)
    }
    valueOf() {
      return this.val
    }
  }

  describe('1. Worker Thread Execution with Complex Decimal/Date Payloads (forceWorker: true)', () => {
    it('executes in actual background worker thread with complex Prisma Decimals and Dates without DataCloneError', async () => {
      const rawInventories = [
        {
          id: 'inv-complex-1',
          productId: 'prod-complex-1',
          branchId: 'br-central',
          branch: { id: 'br-central', name: 'Central Branch' },
          availableQuantity: 25,
          createdAt: new Date(now - 140 * dayMs),
          updatedAt: new Date(now - 2 * dayMs), // Recently modified, but acquired 140 days ago
          product: {
            id: 'prod-complex-1',
            name: 'Complex Decimal Formulation 500mg',
            sku: 'CDF-500',
            barcode: '8901234567890',
            rack: 'RACK-A',
            shelf: 'S2',
            box: 'BOX-05',
            unitOfMeasure: 'Strip',
            costPrice: new MockPrismaDecimal(145.75),
            mrp: new MockPrismaDecimal(210.5),
            batches: [
              {
                id: 'batch-c-1',
                batchNumber: 'BC-2026-001',
                createdAt: new Date(now - 140 * dayMs),
                expiryDate: new Date('2028-06-30T00:00:00.000Z'),
                purchasePrice: new MockPrismaDecimal(145.75),
                purchase: {
                  supplier: {
                    id: 'sup-cipla',
                    name: 'Cipla Therapeutics Ltd',
                  },
                },
              },
            ],
          },
        },
        {
          id: 'inv-complex-2',
          productId: 'prod-complex-2',
          branchId: 'br-central',
          branch: { id: 'br-central', name: 'Central Branch' },
          availableQuantity: 50,
          createdAt: new Date(now - 70 * dayMs),
          updatedAt: new Date(now - 70 * dayMs),
          product: {
            id: 'prod-complex-2',
            name: 'Slow Moving Syrup 100ml',
            sku: 'SMS-100',
            barcode: null,
            rack: 'RACK-B',
            shelf: null,
            box: null,
            unitOfMeasure: 'Bottle',
            costPrice: new MockPrismaDecimal(42.2),
            mrp: new MockPrismaDecimal(65.0),
            batches: [
              {
                id: 'batch-c-2',
                batchNumber: 'BC-2026-002',
                createdAt: new Date(now - 70 * dayMs),
                expiryDate: new Date('2027-11-15T00:00:00.000Z'),
                costPrice: new MockPrismaDecimal(42.2),
                supplierRef: 'CHALLAN-CIPLA-992',
              },
            ],
          },
        },
      ]

      const sanitized = sanitizeDeadStockInventories(rawInventories)

      // Verify that sanitization stripped Decimal objects and converted them to pure numbers
      expect(typeof sanitized[0].product.costPrice).toBe('number')
      expect(sanitized[0].product.costPrice).toBe(145.75)
      expect(typeof sanitized[0].product.mrp).toBe('number')
      expect(sanitized[0].product.mrp).toBe(210.5)
      expect(typeof sanitized[0].createdAt).toBe('number')

      // Run across real Worker Thread boundary
      const result = await runInWorker<any, any>(
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

      expect(result).toBeDefined()
      // Executive summary metrics (all items >= 60d)
      expect(result.summary.totalDeadItemsCount).toBe(2)
      expect(result.summary.deadStockCount).toBe(1) // 140d
      expect(result.summary.slowMovingCount).toBe(1) // 70d
      expect(result.summary.obsoleteCount).toBe(0)

      // Expected cost: 25 * 145.75 = 3643.75 + 50 * 42.2 = 2110.0 => 5753.75
      expect(result.summary.totalDeadCapitalAtCost).toBe(5753.75)
      // Expected MRP: 25 * 210.5 = 5262.5 + 50 * 65.0 = 3250.0 => 8512.5
      expect(result.summary.totalDeadCapitalAtMrp).toBe(8512.5)

      // Itemized table filter (thresholdDays = 90): only 140d item
      expect(result.deadItems).toHaveLength(1)
      expect(result.deadItems[0].productId).toBe('prod-complex-1')
      expect(result.deadItems[0].productName).toBe('Complex Decimal Formulation 500mg')
      expect(result.deadItems[0].status).toBe('DEAD_STOCK')
      expect(result.deadItems[0].daysInactive).toBe(140)
      expect(result.deadItems[0].capitalLockedAtCost).toBe(3643.75)
      expect(result.deadItems[0].capitalLockedAtMrp).toBe(5262.5)
      expect(result.deadItems[0].supplierName).toBe('Cipla Therapeutics Ltd')
      expect(result.deadItems[0].supplierId).toBe('sup-cipla')
    })
  })

  describe('2. Timeout Handling and Automatic Worker Termination (worker.terminate())', () => {
    it('actively invokes worker.terminate() and returns fallback data when worker exceeds timeoutMs', async () => {
      const terminateSpy = jest.spyOn(workerThreads.Worker.prototype, 'terminate')

      const rawInventories = [
        {
          id: 'inv-timeout-test',
          productId: 'prod-timeout-test',
          availableQuantity: 12,
          createdAt: new Date(now - 100 * dayMs).toISOString(),
          updatedAt: new Date(now - 100 * dayMs).toISOString(),
          product: {
            name: 'Timeout Target Injection',
            sku: 'TTI-01',
            costPrice: 500,
            mrp: 750,
            batches: [],
          },
        },
      ]

      const sanitized = sanitizeDeadStockInventories(rawInventories)

      // Trigger timeout with 1ms limit
      const result = await runInWorker<any, any>(
        'ANALYZE_DEAD_STOCK',
        {
          inventories: sanitized,
          saleItemsMap: {},
          movementsMap: {},
          nowTimestamp: now,
          thresholdDays: 60,
        },
        { forceWorker: true, timeoutMs: 1 }
      )

      // Assert that terminate() was called on the worker instance
      expect(terminateSpy).toHaveBeenCalled()
      // Assert that fallback execution yielded the accurate data
      expect(result).toBeDefined()
      expect(result.deadItems).toHaveLength(1)
      expect(result.deadItems[0].productName).toBe('Timeout Target Injection')
      expect(result.deadItems[0].capitalLockedAtCost).toBe(6000)

      terminateSpy.mockRestore()
    })
  })

  describe('3. Synchronous Fallback Execution When Worker Script Is Disabled or Fails', () => {
    it('transparently executes synchronous fallback in test environment without forceWorker', async () => {
      const payload = {
        inventories: [
          {
            id: 'inv-sync-1',
            productId: 'prod-sync-1',
            availableQuantity: 10,
            createdAt: now - 95 * dayMs,
            updatedAt: now - 95 * dayMs,
            product: { name: 'Sync Drug', sku: 'SD-1', costPrice: 100, mrp: 150, batches: [] },
          },
        ],
        saleItemsMap: {},
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 90,
      }

      // Default runInWorker in test env without forceWorker
      const result = await runInWorker<any, any>('ANALYZE_DEAD_STOCK', payload)
      expect(result).toBeDefined()
      expect(result.deadItems).toHaveLength(1)
      expect(result.deadItems[0].productId).toBe('prod-sync-1')
      expect(result.deadItems[0].status).toBe('DEAD_STOCK')
      expect(result.summary.deadStockCount).toBe(1)
    })

    it('falls back to synchronous execution when Worker instantiation throws an exception', async () => {
      const originalWorker = workerThreads.Worker
      // Mock Worker constructor to simulate initialization error (e.g. out of memory, thread limit reached)
      const mockWorkerConstructor = jest.fn().mockImplementation(() => {
        throw new Error('EMFILE: too many open files / thread limit reached')
      })
      ;(workerThreads as any).Worker = mockWorkerConstructor

      const payload = {
        inventories: [
          {
            id: 'inv-fallback-1',
            productId: 'prod-fallback-1',
            availableQuantity: 8,
            createdAt: now - 110 * dayMs,
            updatedAt: now - 110 * dayMs,
            product: { name: 'Fallback Pill', sku: 'FP-1', costPrice: 40, mrp: 60, batches: [] },
          },
        ],
        saleItemsMap: {},
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 90,
      }

      const result = await runInWorker<any, any>(
        'ANALYZE_DEAD_STOCK',
        payload,
        { forceWorker: true }
      )

      expect(result).toBeDefined()
      expect(result.deadItems).toHaveLength(1)
      expect(result.deadItems[0].productName).toBe('Fallback Pill')
      expect(result.deadItems[0].capitalLockedAtCost).toBe(320)

      // Restore Worker constructor
      ;(workerThreads as any).Worker = originalWorker
    })
  })

  describe('4. High Volume and Empty Inventory Handling', () => {
    it('cleanly handles empty inventory arrays without division by zero, null pointers, or crashes', async () => {
      const result = await runInWorker<any, any>(
        'ANALYZE_DEAD_STOCK',
        {
          inventories: [],
          saleItemsMap: {},
          movementsMap: {},
          nowTimestamp: now,
          thresholdDays: 90,
        },
        { forceWorker: true }
      )

      expect(result).toBeDefined()
      expect(result.deadItems).toEqual([])
      expect(result.summary).toEqual({
        totalDeadItemsCount: 0,
        totalDeadCapitalAtCost: 0,
        totalDeadCapitalAtMrp: 0,
        slowMovingCount: 0,
        deadStockCount: 0,
        obsoleteCount: 0,
      })
    })

    it('filters out zero and negative available quantities', async () => {
      const rawInventories = [
        {
          id: 'inv-zero',
          productId: 'prod-zero',
          availableQuantity: 0,
          createdAt: now - 100 * dayMs,
          updatedAt: now - 100 * dayMs,
          product: { name: 'Zero Stock Item', sku: 'Z-0', costPrice: 100, mrp: 150, batches: [] },
        },
        {
          id: 'inv-negative',
          productId: 'prod-negative',
          availableQuantity: -15,
          createdAt: now - 100 * dayMs,
          updatedAt: now - 100 * dayMs,
          product: { name: 'Negative Stock Item', sku: 'N-15', costPrice: 100, mrp: 150, batches: [] },
        },
      ]

      const result = await runInWorker<any, any>(
        'ANALYZE_DEAD_STOCK',
        {
          inventories: rawInventories,
          saleItemsMap: {},
          movementsMap: {},
          nowTimestamp: now,
          thresholdDays: 60,
        },
        { forceWorker: true }
      )

      expect(result.deadItems).toHaveLength(0)
      expect(result.summary.totalDeadItemsCount).toBe(0)
      expect(result.summary.totalDeadCapitalAtCost).toBe(0)
    })

    it('processes a large volume batch of 5,000 inventory items in worker thread with high throughput', async () => {
      const highVolume: any[] = []
      const saleMap: Record<string, number> = {}
      const moveMap: Record<string, number> = {}

      for (let i = 0; i < 5000; i++) {
        const id = `inv-scale-${i}`
        const pId = `prod-scale-${i}`
        const days = 10 + (i % 250) // ages from 10 days to 260 days
        const qty = 5 + (i % 50)
        const cost = 10 + (i % 90)
        const mrp = cost * 1.5

        highVolume.push({
          id,
          productId: pId,
          availableQuantity: qty,
          createdAt: now - days * dayMs,
          updatedAt: now - days * dayMs,
          product: {
            name: `Scaled Medicine #${i}`,
            sku: `SKU-SCALED-${i}`,
            costPrice: cost,
            mrp,
            batches: [
              {
                id: `b-${i}`,
                batchNumber: `BATCH-${i}`,
                createdAt: now - days * dayMs,
                supplierName: `Vendor #${i % 20}`,
              },
            ],
          },
        })

        // Simulate sales for half the items
        if (i % 2 === 0) {
          saleMap[pId] = now - (days - 5) * dayMs
        }
      }

      const startTime = Date.now()
      const result = await runInWorker<any, any>(
        'ANALYZE_DEAD_STOCK',
        {
          inventories: highVolume,
          saleItemsMap: saleMap,
          movementsMap: moveMap,
          nowTimestamp: now,
          thresholdDays: 90,
        },
        { forceWorker: true, timeoutMs: 15000 }
      )
      const durationMs = Date.now() - startTime

      expect(result).toBeDefined()
      expect(result.deadItems.length).toBeGreaterThan(500)
      expect(result.summary.totalDeadItemsCount).toBeGreaterThan(1000)
      expect(result.summary.totalDeadCapitalAtCost).toBeGreaterThan(0)
      expect(result.summary.totalDeadCapitalAtMrp).toBeGreaterThan(0)
      // Aging items must sum up to total count
      expect(
        result.summary.slowMovingCount +
        result.summary.deadStockCount +
        result.summary.obsoleteCount
      ).toBe(result.summary.totalDeadItemsCount)

      // Verified to complete well within 5 seconds for 5,000 items
      expect(durationMs).toBeLessThan(5000)
    })
  })
})
