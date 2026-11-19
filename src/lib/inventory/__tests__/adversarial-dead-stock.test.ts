/** @jest-environment node */

import {
  runInWorker,
  sanitizeDeadStockInventories,
  sanitizePayload,
} from '../inventory-analytics-service'
import { computeDeadStock } from '../workers/inventory-analytics.worker.js'

describe('Adversarial & Concurrency Stress Verification', () => {
  const dayMs = 24 * 60 * 60 * 1000

  describe('High-Volume Record Scaling', () => {
    it('processes 1,000 inventory items in a dedicated worker thread within latency bounds', async () => {
      const now = Date.now()
      const rawRecords = []
      for (let i = 0; i < 1000; i++) {
        const daysAgo = 30 + (i % 210)
        rawRecords.push({
          id: `inv-vol-${i}`,
          productId: `prod-vol-${i}`,
          availableQuantity: 10 + (i % 50),
          createdAt: new Date(now - daysAgo * dayMs).toISOString(),
          updatedAt: new Date(now - daysAgo * dayMs).toISOString(),
          product: {
            id: `prod-vol-${i}`,
            name: `Stress Medicine ${i}`,
            sku: `SKU-STRESS-${i}`,
            barcode: `BAR-${i}`,
            costPrice: 20 + (i % 80),
            mrp: 35 + (i % 120),
            batches: [
              {
                id: `b-${i}`,
                batchNumber: `BATCH-${i}`,
                createdAt: new Date(now - daysAgo * dayMs).toISOString(),
                purchase: { supplier: { id: `sup-${i % 10}`, name: `Supplier ${i % 10}` } },
              },
            ],
          },
        })
      }

      const sanitized = sanitizeDeadStockInventories(rawRecords)
      const start = Date.now()
      const result = await runInWorker<any, any>(
        'ANALYZE_DEAD_STOCK',
        {
          inventories: sanitized,
          saleItemsMap: {},
          movementsMap: {},
          nowTimestamp: now,
          thresholdDays: 90,
        },
        { forceWorker: true, timeoutMs: 10000 }
      )
      const duration = Date.now() - start

      expect(result).toBeDefined()
      expect(result.deadItems.length).toBeGreaterThan(0)
      expect(result.summary.totalDeadItemsCount).toBeGreaterThan(0)
      expect(duration).toBeLessThan(5000) // Must process under 5s
    })
  })

  describe('Decimal & Numerical Boundary Extremes', () => {
    it('handles extreme magnitude Decimals, zero, and negative quantities safely', async () => {
      const now = Date.now()
      const rawRecords = [
        {
          id: 'inv-huge',
          productId: 'prod-huge',
          availableQuantity: 5,
          createdAt: new Date(now - 100 * dayMs).toISOString(),
          updatedAt: new Date(now - 100 * dayMs).toISOString(),
          product: {
            name: 'Expensive Chemotherapy',
            sku: 'SKU-HUGE',
            costPrice: { toNumber: () => 999999999.99, d: [999999999.99], s: 1, e: 8 },
            mrp: { toNumber: () => 1200000000.0, d: [1200000000.0], s: 1, e: 9 },
            batches: [],
          },
        },
        {
          id: 'inv-tiny',
          productId: 'prod-tiny',
          availableQuantity: 500,
          createdAt: new Date(now - 100 * dayMs).toISOString(),
          updatedAt: new Date(now - 100 * dayMs).toISOString(),
          product: {
            name: 'Micro Suture',
            sku: 'SKU-TINY',
            costPrice: { toNumber: () => 0.0005, d: [0.0005], s: 1, e: -4 },
            mrp: { toNumber: () => 0.001, d: [0.001], s: 1, e: -3 },
            batches: [],
          },
        },
        {
          id: 'inv-neg-stock',
          productId: 'prod-neg-stock',
          availableQuantity: -20, // Negative stock from adjustment/reversal
          createdAt: new Date(now - 100 * dayMs).toISOString(),
          updatedAt: new Date(now - 100 * dayMs).toISOString(),
          product: {
            name: 'Negative Stock Drug',
            sku: 'SKU-NEG',
            costPrice: 50,
            mrp: 100,
            batches: [],
          },
        },
      ]

      const sanitized = sanitizeDeadStockInventories(rawRecords)
      const result = await runInWorker<any, any>(
        'ANALYZE_DEAD_STOCK',
        {
          inventories: sanitized,
          saleItemsMap: {},
          movementsMap: {},
          nowTimestamp: now,
          thresholdDays: 60,
        },
        { forceWorker: true }
      )

      expect(result).toBeDefined()
      // Negative inventory item must be omitted
      expect(result.deadItems.some((i: any) => i.productId === 'prod-neg-stock')).toBe(false)
      // Huge value must be calculated without NaN or overflow
      const hugeItem = result.deadItems.find((i: any) => i.productId === 'prod-huge')
      expect(hugeItem.capitalLockedAtCost).toBe(4999999999.95)
      // Tiny value must not be NaN
      const tinyItem = result.deadItems.find((i: any) => i.productId === 'prod-tiny')
      expect(tinyItem.capitalLockedAtCost).toBe(0.25)
    })
  })

  describe('Parallel Concurrent Executions', () => {
    it('executes 10 simultaneous worker threads without cross-talk or race conditions', async () => {
      const now = Date.now()
      const rawRecords = [
        {
          id: 'inv-c-1',
          productId: 'prod-c-1',
          availableQuantity: 10,
          createdAt: new Date(now - 120 * dayMs).toISOString(),
          updatedAt: new Date(now - 120 * dayMs).toISOString(),
          product: { name: 'Concurrent Drug 1', sku: 'CD-1', costPrice: 50, mrp: 80, batches: [] },
        },
        {
          id: 'inv-c-2',
          productId: 'prod-c-2',
          availableQuantity: 15,
          createdAt: new Date(now - 75 * dayMs).toISOString(),
          updatedAt: new Date(now - 75 * dayMs).toISOString(),
          product: { name: 'Concurrent Drug 2', sku: 'CD-2', costPrice: 30, mrp: 50, batches: [] },
        },
      ]

      const sanitized = sanitizeDeadStockInventories(rawRecords)
      const tasks = Array.from({ length: 10 }, (_, idx) => {
        const threshold = idx % 2 === 0 ? 90 : 60
        return runInWorker<any, any>(
          'ANALYZE_DEAD_STOCK',
          {
            inventories: sanitized,
            saleItemsMap: {},
            movementsMap: {},
            nowTimestamp: now,
            thresholdDays: threshold,
          },
          { forceWorker: true, timeoutMs: 8000 }
        ).then((res) => ({ threshold, res }))
      })

      const completed = await Promise.all(tasks)
      expect(completed).toHaveLength(10)

      for (const { threshold, res } of completed) {
        if (threshold === 90) {
          expect(res.deadItems).toHaveLength(1)
          expect(res.deadItems[0].productId).toBe('prod-c-1')
        } else {
          expect(res.deadItems).toHaveLength(2)
        }
      }
    })
  })

  describe('Worker Watchdog Timeout & Fallback', () => {
    it('falls back to synchronous execution when worker times out', async () => {
      const now = Date.now()
      const rawRecords = [
        {
          id: 'inv-timeout',
          productId: 'prod-timeout',
          availableQuantity: 10,
          createdAt: new Date(now - 100 * dayMs).toISOString(),
          updatedAt: new Date(now - 100 * dayMs).toISOString(),
          product: { name: 'Watchdog Item', sku: 'WD-01', costPrice: 20, mrp: 40, batches: [] },
        },
      ]

      const sanitized = sanitizeDeadStockInventories(rawRecords)
      // Set an extreme timeoutMs of 1ms to trigger timeout watchdog
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

      expect(result).toBeDefined()
      expect(result.deadItems).toHaveLength(1)
      expect(result.deadItems[0].productName).toBe('Watchdog Item')
      expect(result.summary.deadStockCount).toBe(1)
    })
  })
})
