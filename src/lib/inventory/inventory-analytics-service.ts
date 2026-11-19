// ─────────────────────────────────────────────────────────────
// Inventory Analytics Service (Multi-Threaded Worker Bridge)
// ─────────────────────────────────────────────────────────────
import { existsSync } from 'fs'
import path from 'path'
import { Worker } from 'worker_threads'

import prisma from '@/lib/db/prisma'

const {
  computeDeadStock,
  computeVendorStock,
  computeRackBoxMatrix,
  computeAdjustmentAnalytics,
  computeMovementAnalytics,
  computeBatchAnalytics,
} = require('./workers/inventory-analytics.worker.js')

export interface BatchAnalyticsSummary {
  totalBatchesCount: number
  totalUnits: number
  totalAvailableUnits: number
  totalValuationAtCost: number
  totalValuationAtMrp: number
  criticalCount: number
  warningCount: number
  infoCount: number
  healthyCount: number
  expiredCount: number
  quarantinedCount: number
  exhaustedCount: number
  nearExpiryValuationAtCost: number
  expiredValuationAtCost: number
  deadStockBatchesCount: number
  deadStockValuationAtCost: number
  rackBoxAssignedCount: number
  unassignedStorageCount: number
  topVendors: Array<{
    supplierId: string | null
    supplierName: string
    batchCount: number
    units: number
    valuation: number
    nearExpiryCount: number
  }>
  topStorageLocations: Array<{
    location: string
    count: number
    units: number
    valuation: number
  }>
}

export interface DeadStockItem {
  inventoryId: string
  productId: string
  productName: string
  sku: string
  barcode?: string | null
  rack?: string | null
  shelf?: string | null
  box?: string | null
  unitOfMeasure: string
  branchId: string
  branchName?: string
  availableQuantity: number
  daysInactive: number
  status: 'SLOW_MOVING' | 'DEAD_STOCK' | 'OBSOLETE'
  costPrice: number
  mrp: number
  capitalLockedAtCost: number
  capitalLockedAtMrp: number
  lastActivityDate: string
  supplierName: string
  supplierId?: string | null
  batchNumber?: string | null
  expiryDate?: string | null
}

export interface DeadStockSummary {
  totalDeadItemsCount: number
  totalDeadCapitalAtCost: number
  totalDeadCapitalAtMrp: number
  slowMovingCount: number
  deadStockCount: number
  obsoleteCount: number
}

export interface DeadStockResult {
  deadItems: DeadStockItem[]
  summary: DeadStockSummary
}

export interface VendorBatchItem {
  id: string
  batchNumber: string
  productId: string
  productName: string
  sku: string
  rack?: string | null
  shelf?: string | null
  box?: string | null
  expiryDate: Date | string
  isNearExpiry: boolean
  costPrice: number
  mrp: number
  availableQuantity: number
  supplierRef?: string | null
}

export interface VendorInventorySummary {
  supplierId: string
  supplierName: string
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  dlNumber?: string | null
  creditDays: number
  outstandingBalance: number
  totalSkus: number
  totalAvailableUnits: number
  totalValuationAtCost: number
  totalValuationAtMrp: number
  nearExpiryUnitsCount: number
  nearExpiryValuationAtCost: number
  batches: VendorBatchItem[]
}

export interface BoxProductItem {
  id: string
  name: string
  sku: string
  barcode?: string | null
  rack?: string | null
  shelf?: string | null
  box?: string | null
  mrp: number
  costPrice: number
  availableStock: number
  reorderLevel: number
  totalMrpValue: number
  totalCostValue: number
}

export interface BoxItem {
  boxName: string
  productCount: number
  totalUnits: number
  totalValuationAtMrp: number
  totalValuationAtCost: number
  products: BoxProductItem[]
}

export interface ShelfItem {
  shelfName: string
  totalUnits: number
  totalValuationAtMrp: number
  totalValuationAtCost: number
  boxes: BoxItem[]
}

export interface RackItem {
  rackName: string
  totalProducts: number
  totalUnits: number
  totalValuationAtMrp: number
  totalValuationAtCost: number
  shelves: ShelfItem[]
}

export interface UnassignedProductItem {
  id: string
  name: string
  sku: string
  barcode?: string | null
  unitOfMeasure: string
  mrp: number
  costPrice: number
  totalStock: number
  totalMrpValue: number
  totalCostValue: number
}

export interface RackBoxMatrixResult {
  racks: RackItem[]
  unassignedCount: number
  unassignedProducts: UnassignedProductItem[]
}

/**
 * Resolves worker script path across development, Next.js build runtime, and test environments
 */
export function getAnalyticsWorkerPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'src/lib/inventory/workers/inventory-analytics.worker.js'),
    path.resolve(__dirname, 'workers/inventory-analytics.worker.js'),
    path.resolve(__dirname, 'inventory-analytics.worker.js'),
    path.resolve(process.cwd(), '.next/server/inventory-analytics.worker.js'),
    path.resolve(process.cwd(), '.next/server/chunks/inventory-analytics.worker.js'),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return candidates[0]
}

function isDecimalLike(val: any): boolean {
  return (
    val !== null &&
    typeof val === 'object' &&
    (typeof val.toNumber === 'function' ||
      (typeof val.d !== 'undefined' && typeof val.s !== 'undefined' && typeof val.e !== 'undefined'))
  )
}

function toDecimalNumber(val: any, fallback = 0): number {
  if (val == null) return fallback
  if (typeof val === 'number') return isNaN(val) ? fallback : val
  if (typeof val === 'object' && typeof val.toNumber === 'function') {
    const num = val.toNumber()
    return isNaN(num) ? fallback : num
  }
  const parsed = Number(val)
  return isNaN(parsed) ? fallback : parsed
}

/**
 * Deep sanitization converting Prisma Decimals and Dates to numbers and primitive strings/timestamps
 */
export function sanitizePayload<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (isDecimalLike(value)) return toDecimalNumber(value) as unknown as T
  if (value instanceof Date) return value.toISOString() as unknown as T
  if (typeof value === 'bigint') return Number(value) as unknown as T
  if (Array.isArray(value)) return value.map((item) => sanitizePayload(item)) as unknown as T
  if (typeof value === 'object') {
    const copy: Record<string, any> = {}
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      copy[k] = sanitizePayload(v)
    }
    return copy as T
  }
  return value
}

/**
 * Specifically sanitizes raw Prisma inventory models for safe worker payload transfer
 */
export function sanitizeDeadStockInventories(inventories: any[]): any[] {
  return inventories.map((inv) => {
    const p = inv.product || {}
    const rawBatches = Array.isArray(p.batches) ? p.batches : []
    const batches = rawBatches.map((b: any) => {
      const supplierName =
        b.purchase?.supplier?.name ||
        b.supplier?.name ||
        b.supplierName ||
        b.supplierRef ||
        'Direct / Primary'
      const supplierId = b.purchase?.supplier?.id || b.supplier?.id || b.supplierId || null

      let purchasePrice: number | null = null
      if (b.purchasePrice != null) {
        purchasePrice = toDecimalNumber(b.purchasePrice)
      } else if (b.costPrice != null) {
        purchasePrice = toDecimalNumber(b.costPrice)
      }

      return {
        id: b.id,
        batchNumber: b.batchNumber || null,
        expiryDate: b.expiryDate ? (b.expiryDate instanceof Date ? b.expiryDate.toISOString() : String(b.expiryDate)) : null,
        createdAt: b.createdAt ? (b.createdAt instanceof Date ? b.createdAt.getTime() : Number(new Date(b.createdAt).getTime())) : null,
        purchasePrice,
        supplierName,
        supplierId,
        supplierRef: b.supplierRef || null,
        purchase: b.purchase ? {
          supplier: b.purchase.supplier ? {
            id: b.purchase.supplier.id,
            name: b.purchase.supplier.name,
          } : undefined,
        } : undefined,
      }
    })

    const costPrice = p.costPrice != null ? toDecimalNumber(p.costPrice) : null
    const mrp = p.mrp != null ? toDecimalNumber(p.mrp) : 0

    return {
      id: inv.id,
      productId: inv.productId,
      branchId: inv.branchId,
      branch: inv.branch ? { id: inv.branch.id, name: inv.branch.name } : null,
      availableQuantity: Number(inv.availableQuantity) || 0,
      createdAt: inv.createdAt ? (inv.createdAt instanceof Date ? inv.createdAt.getTime() : Number(new Date(inv.createdAt).getTime())) : null,
      updatedAt: inv.updatedAt ? (inv.updatedAt instanceof Date ? inv.updatedAt.getTime() : Number(new Date(inv.updatedAt).getTime())) : Date.now(),
      product: {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode ?? null,
        rack: p.rack ?? null,
        shelf: p.shelf ?? null,
        box: p.box ?? null,
        unitOfMeasure: p.unitOfMeasure || 'Unit',
        costPrice,
        mrp,
        batches,
      },
    }
  })
}

function executeSynchronousFallback<TOutput>(command: string, payload: any): TOutput {
  if (command === 'ANALYZE_DEAD_STOCK') return computeDeadStock(payload) as TOutput
  if (command === 'ANALYZE_VENDOR_STOCK') return computeVendorStock(payload) as TOutput
  if (command === 'ANALYZE_LOCATION_MATRIX') return computeRackBoxMatrix(payload) as TOutput
  if (command === 'ANALYZE_ADJUSTMENTS') return computeAdjustmentAnalytics(payload) as TOutput
  if (command === 'ANALYZE_MOVEMENTS') return computeMovementAnalytics(payload) as TOutput
  if (command === 'ANALYZE_BATCHES') return computeBatchAnalytics(payload) as TOutput
  throw new Error(`Unknown worker command: ${command}`)
}

export interface RunInWorkerOptions {
  forceWorker?: boolean
  timeoutMs?: number
}

/**
 * Execute worker command in background thread with fallback
 */
export async function runInWorker<TInput, TOutput>(
  command: string,
  rawPayload: TInput,
  options: RunInWorkerOptions = {}
): Promise<TOutput> {
  const isTest = process.env.NODE_ENV === 'test' && !options.forceWorker && process.env.FORCE_WORKER !== 'true'

  // If in test or restricted environment without explicit forceWorker, execute synchronously
  if (isTest) {
    return executeSynchronousFallback<TOutput>(command, rawPayload)
  }

  const payload = sanitizePayload(rawPayload)
  const timeoutMs = options.timeoutMs ?? 5000

  let worker: Worker | null = null
  let timeout: NodeJS.Timeout | null = null

  try {
    const workerPath = getAnalyticsWorkerPath()
    worker = new Worker(workerPath)
  } catch (err) {
    console.warn('[inventory-analytics-service] Worker initialization failed, using in-process fallback:', err)
    return executeSynchronousFallback<TOutput>(command, payload)
  }

  return new Promise<TOutput>((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      if (worker) {
        try {
          void worker.terminate()
        } catch {
          // ignore termination errors
        }
        worker = null
      }
    }

    const safeResolve = (res: TOutput) => {
      if (!settled) {
        settled = true
        cleanup()
        resolve(res)
      }
    }

    const safeFallback = (reason?: unknown) => {
      if (!settled) {
        settled = true
        cleanup()
        try {
          const fallbackData = executeSynchronousFallback<TOutput>(command, payload)
          resolve(fallbackData)
        } catch (fallbackErr) {
          reject(fallbackErr || reason)
        }
      }
    }

    const activeWorker = worker
    if (!activeWorker) {
      safeFallback(new Error('Worker is not initialized'))
      return
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(7)}`

    timeout = setTimeout(() => {
      console.warn(`[inventory-analytics-service] Worker timed out for command ${command}, falling back`)
      safeFallback(new Error(`Worker timed out for command ${command}`))
    }, timeoutMs)

    activeWorker.on('message', (msg: { id: string; success: boolean; data?: TOutput; error?: string }) => {
      if (msg && msg.id === taskId) {
        if (msg.success && msg.data) {
          safeResolve(msg.data)
        } else {
          console.warn('[inventory-analytics-service] Worker reported error, falling back:', msg.error)
          safeFallback(new Error(msg.error || 'Worker execution error'))
        }
      }
    })

    activeWorker.on('error', (err) => {
      console.warn('[inventory-analytics-service] Worker emitted error event, falling back:', err)
      safeFallback(err)
    })

    activeWorker.on('exit', (code) => {
      if (code !== 0 && !settled) {
        console.warn(`[inventory-analytics-service] Worker stopped with exit code ${code}, falling back`)
        safeFallback(new Error(`Worker stopped with exit code ${code}`))
      }
    })

    try {
      activeWorker.postMessage({ id: taskId, command, payload })
    } catch (postErr) {
      console.warn('[inventory-analytics-service] worker.postMessage failed, falling back:', postErr)
      safeFallback(postErr)
    }
  })
}

// ─── 1. Dead Stock Report ─────────────────────────────────────

export async function getDeadStockReport(params: {
  branchId?: string
  thresholdDays?: number
} = {}): Promise<DeadStockResult> {
  const { branchId, thresholdDays = 60 } = params

  const where: any = {}
  if (branchId) where.branchId = branchId

  // Fetch current inventories with product and supplying batch details
  const [inventories, sales, movements] = await Promise.all([
    prisma.inventory.findMany({
      where: {
        ...where,
        availableQuantity: { gt: 0 },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            barcode: true,
            rack: true,
            unitOfMeasure: true,
            costPrice: true,
            mrp: true,
            batches: {
              where: { status: 'ACTIVE', quantity: { gt: 0 } },
              take: 1,
              orderBy: { createdAt: 'desc' },
              include: {
                purchase: { select: { supplier: { select: { id: true, name: true } } } },
              },
            },
          },
        },
        branch: { select: { id: true, name: true } },
      },
    }),
    prisma.saleItem.groupBy({
      by: ['productId'],
      _max: { createdAt: true },
    }),
    prisma.inventoryMovement.groupBy({
      by: ['inventoryId'],
      where: { type: 'OUT' },
      _max: { createdAt: true },
    }),
  ])

  const saleItemsMap: Record<string, number> = {}
  for (const s of sales) {
    if (s.productId && s._max.createdAt) {
      saleItemsMap[s.productId] = new Date(s._max.createdAt).getTime()
    }
  }

  const movementsMap: Record<string, number> = {}
  for (const m of movements) {
    if (m.inventoryId && m._max.createdAt) {
      movementsMap[m.inventoryId] = new Date(m._max.createdAt).getTime()
    }
  }

  const sanitizedInventories = sanitizeDeadStockInventories(inventories)

  return runInWorker<any, DeadStockResult>('ANALYZE_DEAD_STOCK', {
    inventories: sanitizedInventories,
    saleItemsMap,
    movementsMap,
    nowTimestamp: Date.now(),
    thresholdDays,
  })
}

// ─── 2. Vendor Specific Inventory ─────────────────────────────

export async function getVendorInventoryReport(params: {
  branchId?: string
  supplierId?: string
} = {}): Promise<VendorInventorySummary[]> {
  const { branchId, supplierId } = params

  const batchWhere: any = {
    status: 'ACTIVE',
  }
  if (branchId) batchWhere.branchId = branchId
  if (supplierId) batchWhere.purchase = { supplierId }

  const [suppliers, batches] = await Promise.all([
    prisma.supplier.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        contactPerson: true,
        phone: true,
        email: true,
        dlNumber: true,
        creditDays: true,
        outstandingBalance: true,
      },
    }),
    prisma.batch.findMany({
      where: batchWhere,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            rack: true,
          },
        },
        purchase: {
          select: {
            supplierId: true,
            supplier: {
              select: { id: true, name: true },
            },
          },
        },
      },
    }),
  ])

  return runInWorker<any, VendorInventorySummary[]>('ANALYZE_VENDOR_STOCK', {
    suppliers,
    batches,
    nowTimestamp: Date.now(),
  })
}

// ─── 3. Rack & Box Location Matrix ────────────────────────────

export async function getRackBoxMatrix(params: {
  branchId?: string
} = {}): Promise<RackBoxMatrixResult> {
  const { branchId } = params

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      rack: true,
      mrp: true,
      costPrice: true,
      ptr: true,
      reorderLevel: true,
      unitOfMeasure: true,
      inventory: {
        where: branchId ? { branchId } : undefined,
        select: { availableQuantity: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  return runInWorker<any, RackBoxMatrixResult>('ANALYZE_LOCATION_MATRIX', { products })
}

// ─── 4. Update Product Location (Rack, Shelf, Box) ────────────

export async function updateProductLocation(
  productId: string,
  location: { rack?: string | null; shelf?: string | null; box?: string | null },
  actorId?: string
) {
  const cleanRack = location.rack && location.rack.trim().length > 0 ? location.rack.trim().toUpperCase() : null
  const cleanShelf = location.shelf && location.shelf.trim().length > 0 ? location.shelf.trim() : null
  const cleanBox = location.box && location.box.trim().length > 0 ? location.box.trim() : null

  const prev = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      rack: true,
      inventory: { select: { id: true, totalQuantity: true } },
    },
  })

  if (!prev) {
    throw new Error(`Product with ID ${productId} not found`)
  }

  let resolvedRackId: string | null = null
  if (cleanRack) {
    const defaultBranch = await prisma.branch.findFirst({ select: { id: true } })
    const branchId = defaultBranch?.id ?? 'default-branch'
    const parts = cleanRack.split('-')
    const code = parts[0] || cleanRack
    const shelfNumber = cleanShelf || parts[1] || 'S1'

    const rackRec = await prisma.rack.upsert({
      where: {
        branchId_code_shelfNumber: {
          branchId,
          code,
          shelfNumber,
        },
      },
      create: {
        branchId,
        code,
        shelfNumber,
        description: cleanBox ? `${code} › ${shelfNumber} › ${cleanBox}` : cleanRack,
      },
      update: {
        description: cleanBox ? `${code} › ${shelfNumber} › ${cleanBox}` : cleanRack,
      },
    })
    resolvedRackId = rackRec.id

    try {
      await prisma.storageLocation.upsert({
        where: {
          branchId_rack_shelf_box: {
            branchId,
            rack: code,
            shelf: shelfNumber,
            box: cleanBox || 'Box 01',
          },
        },
        create: {
          branchId,
          rack: code,
          shelf: shelfNumber,
          box: cleanBox || 'Box 01',
          description: `${code} shelf ${shelfNumber}`,
        },
        update: {},
      })
    } catch {
      // Non-fatal
    }
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      rackId: resolvedRackId,
    },
    include: {
      rack: true,
    },
  })

  // If previous location changed and inventory exists, log an audit movement
  const prevRackStr = prev.rack ? `${prev.rack.code}${prev.rack.shelfNumber ? '-' + prev.rack.shelfNumber : ''}` : null
  const newRackStr = updated.rack ? `${updated.rack.code}${updated.rack.shelfNumber ? '-' + updated.rack.shelfNumber : ''}` : null

  if (prevRackStr !== newRackStr && prev.inventory?.[0]) {
    try {
      const inv = prev.inventory[0]
      const fromLoc = prevRackStr || 'Unassigned'
      const toLoc = newRackStr || 'Unassigned'

      await prisma.inventoryMovement.create({
        data: {
          inventoryId: inv.id,
          type: 'TRANSFER',
          quantity: 0,
          quantityBefore: inv.totalQuantity,
          quantityAfter: inv.totalQuantity,
          referenceType: 'BOX_RELOCATION',
          notes: `Relocated: [${fromLoc}] ➔ [${toLoc}] — Storage coordinates updated`,
          createdById: actorId || null,
        },
      })
    } catch {
      // Graceful fallback
    }
  }

  return {
    id: updated.id,
    name: updated.name,
    sku: updated.sku,
    rack: newRackStr,
    shelf: updated.rack?.shelfNumber || null,
    box: cleanBox || null,
  }
}


// ─── 5. Stock Adjustments Analytics ───────────────────────────

export interface AdjustmentAnalyticsSummary {
  totalCount: number
  netQuantity: number
  netCostImpact: number
  netMrpImpact: number
  nearExpiryCount: number
  deadStockCount: number
  boxDiscrepancyCount: number
}

export interface AdjustmentAnalyticsResult<T> {
  items: T[]
  summary: AdjustmentAnalyticsSummary
}

export async function analyzeAdjustmentsInWorker<T>(
  adjustments: any[],
  deadProductIds: string[] = []
): Promise<AdjustmentAnalyticsResult<T>> {
  return runInWorker<any, AdjustmentAnalyticsResult<T>>('ANALYZE_ADJUSTMENTS', {
    adjustments,
    deadProductIds,
    nowTimestamp: Date.now(),
  })
}

// ─── 6. Inventory Movements Multi-Threaded Analytics ──────────

export interface MovementAnalyticsSummary {
  totalCount: number
  inflowCount: number
  inflowUnits: number
  inflowValuationAtCost: number
  outflowCount: number
  outflowUnits: number
  outflowValuationAtCost: number
  outflowValuationAtMrp: number
  transferCount: number
  transferUnits: number
  adjustmentCount: number
  adjustmentUnits: number
  rackBoxActivityCount: number
  nearExpiryCount: number
  expiredCount: number
  deadStockCount: number
  vendorCount: number
  fefoComplianceScore: number
  topVendors: {
    supplierId: string
    supplierName: string
    movementCount: number
    units: number
    valuation: number
  }[]
  topStorageLocations: {
    location: string
    count: number
  }[]
}

export interface MovementAnalyticsResult<T> {
  items: T[]
  summary: MovementAnalyticsSummary
}

export async function analyzeMovementsInWorker<T>(
  movements: any[],
  deadProductIds: string[] = []
): Promise<MovementAnalyticsResult<T>> {
  return runInWorker<any, MovementAnalyticsResult<T>>('ANALYZE_MOVEMENTS', {
    movements,
    deadProductIds,
    nowTimestamp: Date.now(),
  })
}

export interface BatchAnalyticsResult<T> {
  items: T[]
  summary: BatchAnalyticsSummary
}

export async function analyzeBatchesInWorker<T>(
  batches: any[],
  deadProductIds: string[] = []
): Promise<BatchAnalyticsResult<T>> {
  return runInWorker<any, BatchAnalyticsResult<T>>('ANALYZE_BATCHES', {
    batches,
    deadProductIds,
    nowTimestamp: Date.now(),
  })
}




