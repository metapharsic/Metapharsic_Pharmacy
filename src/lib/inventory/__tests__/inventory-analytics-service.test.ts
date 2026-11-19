/** @jest-environment node */

import { existsSync } from 'fs'

import prisma from '@/lib/db/prisma'
import {
  getAnalyticsWorkerPath,
  getDeadStockReport,
  runInWorker,
  sanitizeDeadStockInventories,
  sanitizePayload,
} from '../inventory-analytics-service'
import {
  computeDeadStock,
  computeVendorStock,
  computeRackBoxMatrix,
} from '../workers/inventory-analytics.worker.js'

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  default: {
    inventory: { findMany: jest.fn() },
    saleItem: { groupBy: jest.fn() },
    inventoryMovement: { groupBy: jest.fn() },
    supplier: { findMany: jest.fn() },
    batch: { findMany: jest.fn() },
    product: { findMany: jest.fn() },
  },
}))

describe('Inventory Analytics Multi-Threaded Worker Algorithms & Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Worker Script Path Resolution', () => {
    it('resolves an existing worker script candidate path', () => {
      const workerPath = getAnalyticsWorkerPath()
      expect(typeof workerPath).toBe('string')
      expect(workerPath).toMatch(/inventory-analytics\.worker\.js$/)
      expect(existsSync(workerPath)).toBe(true)
    })
  })

  describe('Payload Serialization & Sanitization', () => {
    it('converts Prisma Decimal-like objects and Dates to numbers and ISO strings', () => {
      const mockDecimal = {
        toNumber: () => 45.75,
        d: [45.75],
        s: 1,
        e: 1,
        toString: () => '45.75',
      }

      const raw = {
        id: 'inv-1',
        costPrice: mockDecimal,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        nested: {
          mrp: mockDecimal,
          updatedAt: new Date('2026-06-01T00:00:00Z'),
        },
      }

      const sanitized = sanitizePayload(raw)
      expect(sanitized.costPrice).toBe(45.75)
      expect(typeof sanitized.costPrice).toBe('number')
      expect(sanitized.createdAt).toBe('2026-01-01T00:00:00.000Z')
      expect(sanitized.nested.mrp).toBe(45.75)
    })

    it('sanitizes inventory records and maps batch purchase suppliers', () => {
      const mockDecimalCost = { toNumber: () => 50, d: [50], s: 1, e: 1 }
      const mockDecimalMrp = { toNumber: () => 85, d: [85], s: 1, e: 1 }

      const rawInventories = [
        {
          id: 'inv-10',
          productId: 'prod-10',
          branchId: 'br-1',
          branch: { id: 'br-1', name: 'Downtown Branch' },
          availableQuantity: 25,
          createdAt: new Date('2026-01-15T00:00:00Z'),
          updatedAt: new Date('2026-10-20T00:00:00Z'),
          product: {
            id: 'prod-10',
            name: 'Metformin 500mg',
            sku: 'MET-500',
            costPrice: mockDecimalCost,
            mrp: mockDecimalMrp,
            batches: [
              {
                id: 'b-10',
                batchNumber: 'BAT-MET-1',
                createdAt: new Date('2026-01-15T00:00:00Z'),
                expiryDate: new Date('2027-06-30T00:00:00Z'),
                purchasePrice: mockDecimalCost,
                purchase: {
                  supplier: {
                    id: 'sup-10',
                    name: 'Torrent Pharmaceuticals',
                  },
                },
              },
            ],
          },
        },
      ]

      const sanitized = sanitizeDeadStockInventories(rawInventories)
      expect(sanitized).toHaveLength(1)
      expect(sanitized[0].product.costPrice).toBe(50)
      expect(sanitized[0].product.mrp).toBe(85)
      expect(sanitized[0].product.batches[0].supplierName).toBe('Torrent Pharmaceuticals')
      expect(sanitized[0].product.batches[0].purchasePrice).toBe(50)
    })
  })

  describe('computeDeadStock', () => {
    it('classifies items into slow moving, dead stock, and obsolete based on inactivity', () => {
      const now = new Date('2026-10-26T12:00:00Z').getTime()
      const dayMs = 24 * 60 * 60 * 1000

      const inventories = [
        {
          id: 'inv-1',
          productId: 'prod-1',
          availableQuantity: 50,
          updatedAt: new Date(now - 70 * dayMs).toISOString(),
          product: {
            name: 'Slow Syrup 100ml',
            sku: 'SKU-SLOW-1',
            costPrice: 40,
            mrp: 60,
            unitOfMeasure: 'Bottle',
            rack: 'RACK-A',
            shelf: 'Shelf 1',
            box: 'Box 01',
          },
        },
        {
          id: 'inv-2',
          productId: 'prod-2',
          availableQuantity: 100,
          updatedAt: new Date(now - 120 * dayMs).toISOString(),
          product: {
            name: 'Dead Tablets 500mg',
            sku: 'SKU-DEAD-2',
            costPrice: 10,
            mrp: 20,
            unitOfMeasure: 'Strip',
            rack: 'RACK-B',
            shelf: 'Shelf 2',
            box: 'Box 04',
          },
        },
        {
          id: 'inv-3',
          productId: 'prod-3',
          availableQuantity: 20,
          updatedAt: new Date(now - 200 * dayMs).toISOString(),
          product: {
            name: 'Obsolete Ointment 20g',
            sku: 'SKU-OBS-3',
            costPrice: 50,
            mrp: 80,
            unitOfMeasure: 'Tube',
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

      expect(result.summary.totalDeadItemsCount).toBe(3)
      expect(result.summary.slowMovingCount).toBe(1)
      expect(result.summary.deadStockCount).toBe(1)
      expect(result.summary.obsoleteCount).toBe(1)

      // Locked capital calculations:
      // prod-1: 50 * 40 = 2000
      // prod-2: 100 * 10 = 1000
      // prod-3: 20 * 50 = 1000
      // Total = 4000
      expect(result.summary.totalDeadCapitalAtCost).toBe(4000)
      expect(result.deadItems[0].productId).toBe('prod-1') // highest locked capital first
    })

    it('accurately anchors inactivity to batch.createdAt when items were never sold or moved, ignoring recent inv.updatedAt', () => {
      const now = new Date('2026-10-26T12:00:00Z').getTime()
      const dayMs = 24 * 60 * 60 * 1000

      // Item received 120 days ago, never sold (no entry in saleItemsMap) or moved (no entry in movementsMap)
      // inv.updatedAt was touched yesterday (1 day ago) due to an inventory sync or seed
      const inventories = [
        {
          id: 'inv-unsold',
          productId: 'prod-unsold',
          availableQuantity: 30,
          createdAt: new Date(now - 120 * dayMs).toISOString(),
          updatedAt: new Date(now - 1 * dayMs).toISOString(), // touched yesterday!
          product: {
            name: 'Unsold Anti-fungal Cream',
            sku: 'SKU-UNSOLD-1',
            costPrice: 60,
            mrp: 100,
            unitOfMeasure: 'Tube',
            batches: [
              {
                batchNumber: 'B-OLD-1',
                createdAt: new Date(now - 120 * dayMs).toISOString(), // arrived 120 days ago
                purchase: {
                  supplier: { id: 'sup-cipla', name: 'Cipla Limited' },
                },
              },
            ],
          },
        },
      ]

      const result = computeDeadStock({
        inventories,
        saleItemsMap: {}, // zero sales
        movementsMap: {}, // zero movements
        nowTimestamp: now,
        thresholdDays: 90,
      })

      // Inactivity should be anchored to 120 days, NOT 1 day!
      expect(result.deadItems).toHaveLength(1)
      const item = result.deadItems[0]
      expect(item.daysInactive).toBe(120)
      expect(item.status).toBe('DEAD_STOCK')
      expect(item.supplierName).toBe('Cipla Limited')
      expect(item.capitalLockedAtCost).toBe(1800) // 30 * 60
    })

    it('falls back to inv.createdAt when no batch exists and item was never sold', () => {
      const now = new Date('2026-10-26T12:00:00Z').getTime()
      const dayMs = 24 * 60 * 60 * 1000

      const inventories = [
        {
          id: 'inv-no-batch',
          productId: 'prod-no-batch',
          availableQuantity: 15,
          createdAt: new Date(now - 75 * dayMs).toISOString(),
          updatedAt: new Date(now - 2 * dayMs).toISOString(),
          product: {
            name: 'Generic Bandages',
            sku: 'SKU-BAND',
            costPrice: 10,
            mrp: 20,
            unitOfMeasure: 'Box',
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

      expect(result.deadItems).toHaveLength(1)
      expect(result.deadItems[0].daysInactive).toBe(75)
      expect(result.deadItems[0].status).toBe('SLOW_MOVING')
      expect(result.deadItems[0].supplierName).toBe('Direct / Primary')
    })

    it('decouples summary metrics: preserves slowMovingCount in summary when thresholdDays = 90', () => {
      const now = new Date('2026-10-26T12:00:00Z').getTime()
      const dayMs = 24 * 60 * 60 * 1000

      const inventories = [
        {
          id: 'inv-slow',
          productId: 'prod-slow',
          availableQuantity: 40,
          updatedAt: new Date(now - 75 * dayMs).toISOString(), // 75 days -> SLOW_MOVING
          product: {
            name: 'Slow Antibiotic Drops',
            sku: 'SKU-SLOW-DROP',
            costPrice: 30,
            mrp: 50,
          },
        },
        {
          id: 'inv-dead',
          productId: 'prod-dead',
          availableQuantity: 60,
          updatedAt: new Date(now - 110 * dayMs).toISOString(), // 110 days -> DEAD_STOCK
          product: {
            name: 'Dead Cold Tablets',
            sku: 'SKU-DEAD-TAB',
            costPrice: 20,
            mrp: 35,
          },
        },
        {
          id: 'inv-obs',
          productId: 'prod-obs',
          availableQuantity: 10,
          updatedAt: new Date(now - 210 * dayMs).toISOString(), // 210 days -> OBSOLETE
          product: {
            name: 'Obsolete Injection',
            sku: 'SKU-OBS-INJ',
            costPrice: 100,
            mrp: 150,
          },
        },
      ]

      // Filter table by thresholdDays = 90
      const result = computeDeadStock({
        inventories,
        saleItemsMap: {},
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 90,
      })

      // The returned deadItems table ONLY includes items inactive >= 90 days (dead + obsolete = 2 items)
      expect(result.deadItems).toHaveLength(2)
      expect(result.deadItems.some((i) => i.productId === 'prod-slow')).toBe(false)
      expect(result.deadItems.some((i) => i.productId === 'prod-dead')).toBe(true)
      expect(result.deadItems.some((i) => i.productId === 'prod-obs')).toBe(true)

      // BUT the summary card breakdown MUST decouple and retain all brackets (>= 60 days):
      expect(result.summary.slowMovingCount).toBe(1)
      expect(result.summary.deadStockCount).toBe(1)
      expect(result.summary.obsoleteCount).toBe(1)
      expect(result.summary.totalDeadItemsCount).toBe(3)
      // Total dead capital at cost includes all 3 items: (40*30) + (60*20) + (10*100) = 1200 + 1200 + 1000 = 3400
      expect(result.summary.totalDeadCapitalAtCost).toBe(3400)
    })
  })

  describe('runInWorker Multi-Threading & Fallback', () => {
    it('executes in actual worker thread when forceWorker is true and serializes payloads safely', async () => {
      const now = new Date('2026-10-26T12:00:00Z').getTime()
      const dayMs = 24 * 60 * 60 * 1000

      const mockDecimalCost = { toNumber: () => 45, d: [45], s: 1, e: 1 }
      const mockDecimalMrp = { toNumber: () => 70, d: [70], s: 1, e: 1 }

      const payload = {
        inventories: [
          {
            id: 'inv-thread-1',
            productId: 'prod-thread-1',
            availableQuantity: 20,
            createdAt: new Date(now - 100 * dayMs),
            updatedAt: new Date(now - 100 * dayMs),
            product: {
              name: 'Worker Thread Test Drug',
              sku: 'WTT-01',
              costPrice: mockDecimalCost,
              mrp: mockDecimalMrp,
              unitOfMeasure: 'Strip',
              batches: [
                {
                  batchNumber: 'WB-001',
                  createdAt: new Date(now - 100 * dayMs),
                  purchase: {
                    supplier: { id: 'sup-alkem', name: 'Alkem Laboratories' },
                  },
                },
              ],
            },
          },
        ],
        saleItemsMap: {},
        movementsMap: {},
        nowTimestamp: now,
        thresholdDays: 60,
      }

      // Spawns worker thread directly using forceWorker: true
      const result = await runInWorker<any, any>('ANALYZE_DEAD_STOCK', payload, { forceWorker: true })

      expect(result).toBeDefined()
      expect(result.deadItems).toHaveLength(1)
      expect(result.deadItems[0].productName).toBe('Worker Thread Test Drug')
      expect(result.deadItems[0].supplierName).toBe('Alkem Laboratories')
      expect(result.deadItems[0].capitalLockedAtCost).toBe(900) // 20 * 45
      expect(result.summary.deadStockCount).toBe(1)
    })
  })

  describe('getDeadStockReport Service Integration', () => {
    it('fetches inventory and batches from Prisma with Decimal fields and returns dead stock analysis', async () => {
      const mockDecimalCost = { toNumber: () => 25, d: [25], s: 1, e: 1, toString: () => '25' }
      const mockDecimalMrp = { toNumber: () => 40, d: [40], s: 1, e: 1, toString: () => '40' }

      const mockInventories = [
        {
          id: 'inv-srv-1',
          productId: 'p-srv-1',
          branchId: 'br-main',
          availableQuantity: 50,
          createdAt: new Date('2026-06-01T00:00:00Z'),
          updatedAt: new Date('2026-06-01T00:00:00Z'),
          product: {
            id: 'p-srv-1',
            name: 'Azithromycin 250mg',
            sku: 'AZI-250',
            barcode: '8901234567890',
            costPrice: mockDecimalCost,
            mrp: mockDecimalMrp,
            unitOfMeasure: 'Strip',
            rack: { code: 'RACK-C', shelfNumber: 'S2', description: 'RACK-C › S2 › Box 05' },
            batches: [
              {
                batchNumber: 'AZI-B1',
                createdAt: new Date('2026-06-01T00:00:00Z'),
                expiryDate: new Date('2028-01-01T00:00:00Z'),
                purchase: {
                  supplier: { id: 'sup-lupin', name: 'Lupin Pharma' },
                },
              },
            ],
          },
          branch: { id: 'br-main', name: 'Main Hospital Pharmacy' },
        },
      ]

      ;(prisma.inventory.findMany as jest.Mock).mockResolvedValueOnce(mockInventories)
      ;(prisma.saleItem.groupBy as jest.Mock).mockResolvedValueOnce([])
      ;(prisma.inventoryMovement.groupBy as jest.Mock).mockResolvedValueOnce([])

      const result = await getDeadStockReport({ branchId: 'br-main', thresholdDays: 60 })

      expect(prisma.inventory.findMany).toHaveBeenCalledTimes(1)
      expect(result.deadItems).toHaveLength(1)
      const item = result.deadItems[0]
      expect(item.productName).toBe('Azithromycin 250mg')
      expect(item.supplierName).toBe('Lupin Pharma')
      expect(item.costPrice).toBe(25)
      expect(item.mrp).toBe(40)
      expect(item.capitalLockedAtCost).toBe(1250) // 50 * 25
      expect(item.capitalLockedAtMrp).toBe(2000)  // 50 * 40
      expect(result.summary.totalDeadCapitalAtCost).toBe(1250)
    })
  })

  describe('computeVendorStock', () => {
    it('aggregates inventory value, SKUs, and return-eligible units by vendor', () => {
      const now = new Date('2026-10-26T12:00:00Z').getTime()
      const dayMs = 24 * 60 * 60 * 1000

      const suppliers = [
        {
          id: 'supp-1',
          name: 'Cipla Healthcare Distribution',
          contactPerson: 'Rajesh Kumar',
          phone: '9876543210',
          creditDays: 30,
          outstandingBalance: 15000,
        },
      ]

      const batches = [
        {
          id: 'b-1',
          supplierId: 'supp-1',
          productId: 'p-1',
          batchNumber: 'BAT-01',
          quantity: 100,
          reservedQuantity: 10,
          soldQuantity: 10,
          purchasePrice: 50,
          mrp: 80,
          expiryDate: new Date(now + 20 * dayMs).toISOString(), // near expiry (<60d)
          product: { name: 'Amoxicillin 500mg', sku: 'SKU-AMX' },
        },
        {
          id: 'b-2',
          supplierId: 'supp-1',
          productId: 'p-2',
          batchNumber: 'BAT-02',
          quantity: 50,
          purchasePrice: 20,
          mrp: 35,
          expiryDate: new Date(now + 180 * dayMs).toISOString(), // healthy
          product: { name: 'Cetirizine 10mg', sku: 'SKU-CET' },
        },
      ]

      const result = computeVendorStock({
        suppliers,
        batches,
        nowTimestamp: now,
      })

      expect(result.length).toBe(1)
      const cipla = result[0]
      expect(cipla.supplierName).toBe('Cipla Healthcare Distribution')
      expect(cipla.totalSkus).toBe(2)
      // available: b1: 100 - 10 - 10 = 80; b2: 50. Total = 130
      expect(cipla.totalAvailableUnits).toBe(130)
      // valuation at cost: 80 * 50 + 50 * 20 = 4000 + 1000 = 5000
      expect(cipla.totalValuationAtCost).toBe(5000)
      // near expiry: b1 has 80 units
      expect(cipla.nearExpiryUnitsCount).toBe(80)
      expect(cipla.nearExpiryValuationAtCost).toBe(4000)
    })
  })

  describe('computeRackBoxMatrix', () => {
    it('structures products hierarchically into Rack > Shelf > Box layout', () => {
      const products = [
        {
          id: 'p-1',
          name: 'Paracetamol 500mg',
          sku: 'SKU-PCM',
          rack: 'RACK-A',
          shelf: 'Shelf 1',
          box: 'Box 01',
          mrp: 20,
          reorderLevel: 10,
          inventory: [{ availableQuantity: 100 }],
        },
        {
          id: 'p-2',
          name: 'Azithromycin 500mg',
          sku: 'SKU-AZI',
          rack: 'RACK-A',
          shelf: 'Shelf 1',
          box: 'Box 01',
          mrp: 120,
          reorderLevel: 5,
          inventory: [{ availableQuantity: 40 }],
        },
        {
          id: 'p-3',
          name: 'Unplaced Cream',
          sku: 'SKU-UNP',
          rack: null,
          shelf: null,
          box: null,
          inventory: [{ availableQuantity: 15 }],
        },
      ]

      const result = computeRackBoxMatrix({ products })
      expect(result.racks.length).toBe(1)
      expect(result.racks[0].rackName).toBe('RACK-A')
      expect(result.racks[0].totalProducts).toBe(2)
      expect(result.racks[0].totalUnits).toBe(140)

      expect(result.racks[0].shelves[0].shelfName).toBe('Shelf 1')
      expect(result.racks[0].shelves[0].boxes[0].boxName).toBe('Box 01')
      expect(result.racks[0].shelves[0].boxes[0].productCount).toBe(2)

      expect(result.unassignedCount).toBe(1)
      expect(result.unassignedProducts[0].name).toBe('Unplaced Cream')
    })
  })
})
