// ─────────────────────────────────────────────────────────────
// Inventory Service
// ─────────────────────────────────────────────────────────────
import type { InventoryMovement, Prisma, StockAdjustment } from '@prisma/client'

import { allocateFefo, filterEligibleBatches } from '@/lib/batches/fefo'
import type { FefoBatchCandidate } from '@/lib/batches/fefo'
import prisma from '@/lib/db/prisma'
import { getDescendantCategoryIds } from '@/lib/products/product-service'

import type { AuthUser } from './branch-access'
import { assertBranchAccess } from './branch-access'

// ─── Constants ────────────────────────────────────────────────

/**
 * Adjustments with |quantity| <= this value are auto-approved (self-approval).
 * Source: Stock_Management_Module.md §4 "≤ 10 units Pharmacist self-approval".
 */
export const AUTO_APPROVE_THRESHOLD = 10

// ─── Types ────────────────────────────────────────────────────

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstock'

export interface InventoryRow {
  id: string
  productId: string
  branchId: string
  totalQuantity: number
  reservedQuantity: number
  availableQuantity: number
  updatedAt: Date
  stockStatus: StockStatus
  product: {
    id: string
    name: string
    sku: string
    barcode?: string | null
    rack?: string | null
    shelf?: string | null
    box?: string | null
    unitOfMeasure: string
    reorderLevel: number
    maxStockLevel: number | null
  }
  branch: { id: string; name: string; code: string | null }
}

export interface InventoryListResult {
  data: InventoryRow[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

export interface InventorySummary {
  totalSkus: number
  totalUnits: number
  reservedUnits: number
  availableUnits: number
  lowStockCount: number
  outOfStockCount: number
  valuationAtCost: number
  valuationAtMrp: number
  potentialGrossProfit: number
  marginPercent: number
  nearExpiryBatchesCount: number
  expiredBatchesCount: number
  pendingAdjustmentsCount: number
  deadStockCount?: number
}

export interface MovementRow {
  id: string
  inventoryId: string
  type: InventoryMovement['type']
  quantity: number
  quantityBefore: number
  quantityAfter: number
  referenceType: string | null
  referenceId: string | null
  batchId: string | null
  notes: string | null
  createdAt: Date
  inventory: {
    productId: string
    product: {
      id: string
      name: string
      sku: string
      unitOfMeasure: string
      rack?: string | null
      shelf?: string | null
      box?: string | null
      costPrice?: any
      mrp?: any
    }
    branch: { id: string; name: string; code: string | null }
  }
  batch?: {
    id: string
    batchNumber: string
    expiryDate: Date
    mrp?: any
    purchasePrice?: any
    supplierId?: string | null
    supplier?: { id: string; name: string } | null
  } | null
  unitCost?: number
  unitMrp?: number
  costValuation?: number
  mrpValuation?: number
  isNearExpiry?: boolean
  isExpired?: boolean
  daysToExpiry?: number | null
  isDeadStock?: boolean
  supplierName?: string
  supplierId?: string | null
  rack?: string | null
  shelf?: string | null
  box?: string | null
}

import {
  analyzeAdjustmentsInWorker,
  analyzeMovementsInWorker,
  type AdjustmentAnalyticsSummary,
  type MovementAnalyticsSummary,
} from './inventory-analytics-service'
import type { RecordMovementInput } from '@/lib/validations/inventory'

export interface AdjustmentRow {
  id: string
  branchId: string
  productId: string
  batchId: string | null
  adjustmentType: StockAdjustment['adjustmentType']
  quantity: number
  reason: string
  notes: string | null
  status: StockAdjustment['status']
  approvedById: string | null
  approvedAt: Date | null
  createdById: string
  createdAt: Date
  product: {
    id: string
    name: string
    sku: string
    rack?: string | null
    shelf?: string | null
    box?: string | null
    mrp?: number | null
    costPrice?: number | null
  }
  branch: { id: string; name: string; code: string | null }
  createdBy: { id: string; name: string }
  batch?: {
    id: string
    batchNumber: string
    expiryDate: Date
    purchasePrice: number
    mrp: number
    quantity: number
    supplier?: { id: string; name: string } | null
  } | null
  costImpact?: number
  mrpImpact?: number
  isNearExpiry?: boolean
  isDeadStock?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────

function computeStockStatus(
  availableQuantity: number,
  reorderLevel: number,
  maxStockLevel: number | null
): StockStatus {
  if (availableQuantity <= 0) return 'out_of_stock'
  if (availableQuantity <= reorderLevel) return 'low_stock'
  if (maxStockLevel !== null && availableQuantity > maxStockLevel) return 'overstock'
  return 'in_stock'
}

function isUniqueConstraintError(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'P2002'
  )
}

// ─── Read: Inventory List ─────────────────────────────────────

export async function getInventory(
  params: {
    page?: number
    limit?: number
    search?: string
    branchId?: string
    productId?: string
    categoryId?: string
    status?: string
    sortBy?: 'product' | 'totalQuantity' | 'availableQuantity' | 'updatedAt'
    sortOrder?: 'asc' | 'desc'
  } = {}
): Promise<InventoryListResult> {
  const {
    page = 1,
    limit = 20,
    search,
    branchId,
    productId,
    categoryId,
    status,
    sortBy = 'product',
    sortOrder = 'asc',
  } = params

  const where: Prisma.InventoryWhereInput = {}
  if (branchId) where.branchId = branchId
  if (productId) where.productId = productId
  if (search || categoryId) {
    const productWhere: Prisma.ProductWhereInput = {}
    if (search) {
      productWhere.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { barcodes: { some: { barcode: { contains: search, mode: 'insensitive' } } } },
      ]
    }
    if (categoryId) {
      productWhere.categories = {
        some: { categoryId },
      }
    }
    where.product = productWhere
  }

  let orderBy: Prisma.InventoryOrderByWithRelationInput
  if (sortBy === 'product') orderBy = { product: { name: sortOrder } }
  else if (sortBy === 'totalQuantity') orderBy = { totalQuantity: sortOrder }
  else if (sortBy === 'availableQuantity') orderBy = { availableQuantity: sortOrder }
  else orderBy = { updatedAt: sortOrder }

  const include = {
    product: {
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        rack: true,
        unitOfMeasure: true,
        reorderLevel: true,
        maxStockLevel: true,
      },
    },
    branch: { select: { id: true, name: true, code: true } },
  }

  function mapInventoryRow(r: any): InventoryRow {
    const rackObj = r.product.rack
    const rackCode = (rackObj && typeof rackObj === 'object') ? rackObj.code : (rackObj || null)
    const shelfNum = (rackObj && typeof rackObj === 'object') ? rackObj.shelfNumber : (r.product.shelf || null)
    const categories = (r.product.categories || []).map((c: any) => ({
      id: c.category.id,
      name: c.category.name,
      slug: c.category.slug,
      parentId: c.category.parentId,
      parentName: c.category.parent?.name ?? null,
    }))

    return {
      ...r,
      stockStatus: computeStockStatus(
        r.availableQuantity,
        r.product.reorderLevel,
        r.product.maxStockLevel
      ),
      product: {
        id: r.product.id,
        name: r.product.name,
        sku: r.product.sku,
        barcode: r.product.barcode,
        rack: rackCode,
        shelf: shelfNum,
        box: null,
        unitOfMeasure: r.product.unitOfMeasure,
        reorderLevel: r.product.reorderLevel,
        maxStockLevel: r.product.maxStockLevel,
        categories,
      },
    }
  }

  if (status && status !== 'all') {
    // In-memory status filter (filters all matches, then paginates).
    const all = await prisma.inventory.findMany({ where, orderBy, include })
    const withStatus: InventoryRow[] = all.map(mapInventoryRow)
    const filtered = withStatus.filter((r) => r.stockStatus === status)
    const start = (page - 1) * limit
    return {
      data: filtered.slice(start, start + limit),
      pagination: {
        page,
        limit,
        total: filtered.length,
        pages: Math.ceil(filtered.length / limit),
      },
    }
  }

  const skip = (page - 1) * limit
  const [found, total] = await Promise.all([
    prisma.inventory.findMany({ where, skip, take: limit, orderBy, include }),
    prisma.inventory.count({ where }),
  ])

  const data: InventoryRow[] = found.map(mapInventoryRow)

  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }
}

// ─── Read: Summary & Valuation ────────────────────────────────

export async function getInventorySummary(branchId?: string, categoryId?: string): Promise<InventorySummary> {
  let targetCategoryIds: string[] | undefined
  if (categoryId && categoryId !== 'all') {
    targetCategoryIds = await getDescendantCategoryIds(categoryId)
  }

  const where: Prisma.InventoryWhereInput = branchId ? { branchId } : {}
  const batchWhere: Prisma.BatchWhereInput = branchId ? { branchId } : {}

  if (targetCategoryIds && targetCategoryIds.length > 0) {
    where.product = {
      categories: {
        some: { categoryId: { in: targetCategoryIds } },
      },
    }
    batchWhere.product = {
      categories: {
        some: { categoryId: { in: targetCategoryIds } },
      },
    }
  }

  let adjustmentProductIds: string[] | undefined
  if (targetCategoryIds && targetCategoryIds.length > 0) {
    const prods = await prisma.productCategory.findMany({
      where: { categoryId: { in: targetCategoryIds } },
      select: { productId: true },
    })
    adjustmentProductIds = prods.map((p) => p.productId)
  }

  const now = new Date()
  const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

  const [
    invAgg,
    inventoriesForLowStock,
    outOfStockCount,
    activeBatches,
    nearExpiryBatchesCount,
    expiredBatchesCount,
    pendingAdjustmentsCount,
    deadStockCount,
  ] = await Promise.all([
    prisma.inventory.aggregate({
      where,
      _sum: {
        totalQuantity: true,
        reservedQuantity: true,
        availableQuantity: true,
      },
      _count: {
        id: true,
      },
    }),
    prisma.inventory.findMany({
      where: {
        ...where,
        availableQuantity: { gt: 0 },
      },
      select: {
        availableQuantity: true,
        product: {
          select: { reorderLevel: true },
        },
      },
    }),
    prisma.inventory.count({
      where: {
        ...where,
        availableQuantity: { lte: 0 },
      },
    }),
    prisma.batch.findMany({
      where: {
        ...batchWhere,
        status: 'ACTIVE',
        quantity: { gt: 0 },
      },
      select: {
        quantity: true,
        purchasePrice: true,
        mrp: true,
      },
    }),
    prisma.batch.count({
      where: {
        ...batchWhere,
        status: 'ACTIVE',
        quantity: { gt: 0 },
        expiryDate: {
          gte: now,
          lte: in90Days,
        },
      },
    }),
    prisma.batch.count({
      where: {
        ...batchWhere,
        quantity: { gt: 0 },
        expiryDate: {
          lt: now,
        },
      },
    }),
    prisma.stockAdjustment.count({
      where: {
        status: 'PENDING',
        ...(branchId ? { branchId } : {}),
      },
    }),
    prisma.inventory.count({
      where: {
        ...where,
        availableQuantity: { gt: 0 },
        updatedAt: { lte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      },
    }),
  ])

  const lowStockCount = inventoriesForLowStock.filter(
    (i) => i.availableQuantity <= i.product.reorderLevel
  ).length

  let valuationAtCost = 0
  let valuationAtMrp = 0
  for (const b of activeBatches) {
    const cost = Number(b.purchasePrice) || 0
    const mrp = Number(b.mrp) || 0
    valuationAtCost += cost * b.quantity
    valuationAtMrp += mrp * b.quantity
  }

  const potentialGrossProfit = Math.max(0, valuationAtMrp - valuationAtCost)
  const marginPercent =
    valuationAtMrp > 0 ? (potentialGrossProfit / valuationAtMrp) * 100 : 0

  return {
    totalSkus: invAgg._count.id || 0,
    totalUnits: invAgg._sum.totalQuantity || 0,
    reservedUnits: invAgg._sum.reservedQuantity || 0,
    availableUnits: invAgg._sum.availableQuantity || 0,
    lowStockCount,
    outOfStockCount,
    valuationAtCost: Math.round(valuationAtCost * 100) / 100,
    valuationAtMrp: Math.round(valuationAtMrp * 100) / 100,
    potentialGrossProfit: Math.round(potentialGrossProfit * 100) / 100,
    marginPercent: Math.round(marginPercent * 10) / 10,
    nearExpiryBatchesCount,
    expiredBatchesCount,
    pendingAdjustmentsCount,
    deadStockCount,
  }
}

// ─── Read: Movements ──────────────────────────────────────────

export async function getMovements(
  params: {
    page?: number
    limit?: number
    search?: string
    branchId?: string
    productId?: string
    categoryId?: string
    supplierId?: string
    rack?: string
    box?: string
    type?: InventoryMovement['type']
    fefoStatus?: 'all' | 'near_expiry' | 'expired'
    deadStockOnly?: boolean
  } = {}
): Promise<{
  data: MovementRow[]
  summary?: MovementAnalyticsSummary
  pagination: { page: number; limit: number; total: number; pages: number }
}> {
  const {
    page = 1,
    limit = 20,
    search,
    branchId,
    productId,
    categoryId,
    supplierId,
    rack,
    box,
    type,
    fefoStatus,
    deadStockOnly,
  } = params

  const where: Prisma.InventoryMovementWhereInput = {}
  if (type) where.type = type

  if (supplierId) {
    const supplierBatches = await prisma.batch.findMany({
      where: { purchase: { supplierId } },
      select: { id: true },
    })
    where.batchId = { in: supplierBatches.map((b) => b.id) }
  }

  if (branchId || productId || search || rack || categoryId) {
    const productFilter: Prisma.ProductWhereInput = {}
    if (search) {
      productFilter.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (categoryId) {
      productFilter.categories = {
        some: { categoryId },
      }
    }
    if (rack) {
      productFilter.rack = {
        code: { equals: rack, mode: 'insensitive' },
      }
    }

    where.inventory = {
      branchId: branchId ?? undefined,
      productId: productId ?? undefined,
      product: Object.keys(productFilter).length > 0 ? productFilter : undefined,
    }
  }

  const include = {
    inventory: {
      select: {
        productId: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            unitOfMeasure: true,
            rack: true,
            costPrice: true,
            mrp: true,
          },
        },
        branch: { select: { id: true, name: true, code: true } },
      },
    },
    batch: {
      select: {
        id: true,
        batchNumber: true,
        expiryDate: true,
        mrp: true,
        purchasePrice: true,
        supplierRef: true, purchase: { select: { supplier: { select: { id: true, name: true } } } },
      },
    },
  }

  const skip = (page - 1) * limit
  const [rows, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include,
    }),
    prisma.inventoryMovement.count({ where }),
  ])

  // Resolve dead product candidates (inactive products > 60 days)
  const deadProductIds: string[] = []
  try {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    const productIdsInRows = rows.map((r) => r.inventory?.productId).filter(Boolean)
    if (productIdsInRows.length > 0) {
      const recentActivity = await (prisma as any).saleItem?.groupBy?.({
        by: ['productId'],
        where: {
          productId: { in: productIdsInRows },
          sale: { createdAt: { gte: sixtyDaysAgo } },
        },
      })
      const activeProductSet = new Set(((recentActivity as any[]) || []).map((a: any) => a.productId))
      for (const pId of productIdsInRows) {
        if (!activeProductSet.has(pId)) {
          deadProductIds.push(pId)
        }
      }
    }
  } catch {
    // Graceful fallback
  }

  // Multi-threaded worker analytics calculation
  let summary: MovementAnalyticsSummary | undefined
  let enrichedRows: MovementRow[] = rows as unknown as MovementRow[]

  try {
    const workerResult = await analyzeMovementsInWorker<MovementRow>(rows, deadProductIds)
    enrichedRows = workerResult.items
    summary = workerResult.summary
  } catch {
    // Fallback if worker fails
  }

  // Filter in-memory if fefoStatus or deadStockOnly requested
  let finalRows = enrichedRows
  if (fefoStatus === 'near_expiry') {
    finalRows = finalRows.filter((r) => r.isNearExpiry)
  } else if (fefoStatus === 'expired') {
    finalRows = finalRows.filter((r) => r.isExpired)
  }
  if (deadStockOnly) {
    finalRows = finalRows.filter((r) => r.isDeadStock)
  }

  const normalizedRows = finalRows.map((r: any) => {
    const rackObj = r.inventory?.product?.rack
    const rackCode = (rackObj && typeof rackObj === 'object') ? rackObj.code : (rackObj || null)
    const shelfNum = (rackObj && typeof rackObj === 'object') ? rackObj.shelfNumber : (r.inventory?.product?.shelf || null)
    return {
      ...r,
      rack: (r.rack && typeof r.rack === 'object' ? r.rack.code : r.rack) || rackCode,
      shelf: (r.shelf && typeof r.shelf === 'object' ? r.shelf.shelfNumber : r.shelf) || shelfNum,
      inventory: {
        ...r.inventory,
        product: {
          ...r.inventory?.product,
          rack: rackCode,
          shelf: shelfNum,
        },
      },
    }
  })

  return {
    data: normalizedRows,
    summary,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

/**
 * Record a high-standard stock movement provisioned directly in the database:
 * - Supports Box Relocations (updating Product.rack/shelf/box)
 * - Supports Supplier Returns (RETURN_OUT)
 * - Supports Dead Stock Clearances / Write-offs (WRITE_OFF)
 * - Supports Branch & Storage Transfers (TRANSFER)
 */
export async function recordStockMovement(
  input: RecordMovementInput,
  actorId: string
): Promise<MovementRow> {
  const {
    branchId,
    productId,
    batchId,
    type,
    quantity,
    referenceType,
    referenceId,
    fromRack,
    fromShelf,
    fromBox,
    toRack,
    toShelf,
    toBox,
    reason,
    notes,
  } = input

  return prisma.$transaction(async (tx) => {
    // 1. Get or create inventory record
    let inventory = await tx.inventory.findUnique({
      where: { productId_branchId: { productId, branchId } },
    })

    const beforeTotal = inventory?.totalQuantity ?? 0
    const beforeAvailable = inventory?.availableQuantity ?? 0

    let afterTotal = beforeTotal
    let afterAvailable = beforeAvailable

    if (['IN', 'RETURN_IN'].includes(type)) {
      afterTotal = beforeTotal + Math.abs(quantity)
      afterAvailable = beforeAvailable + Math.abs(quantity)
    } else if (['OUT', 'RETURN_OUT', 'WRITE_OFF'].includes(type)) {
      if (beforeAvailable < Math.abs(quantity)) {
        throw new Error(`Insufficient stock. Available: ${beforeAvailable}, Requested: ${Math.abs(quantity)}`)
      }
      afterTotal = beforeTotal - Math.abs(quantity)
      afterAvailable = beforeAvailable - Math.abs(quantity)
    } else if (type === 'ADJUSTMENT') {
      afterTotal = beforeTotal + quantity
      afterAvailable = beforeAvailable + quantity
      if (afterAvailable < 0) {
        throw new Error(`Cannot adjust below zero. Current: ${beforeAvailable}, Delta: ${quantity}`)
      }
    }

    if (inventory) {
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          totalQuantity: afterTotal,
          availableQuantity: afterAvailable,
        },
      })
    } else {
      inventory = await tx.inventory.create({
        data: {
          productId,
          branchId,
          totalQuantity: afterTotal,
          availableQuantity: afterAvailable,
          reservedQuantity: 0,
        },
      })
    }

    // 2. If batch specified and quantity changes, update batch
    if (batchId) {
      const batch = await tx.batch.findUnique({ where: { id: batchId } })
      if (batch) {
        if (['OUT', 'RETURN_OUT', 'WRITE_OFF'].includes(type)) {
          const delta = Math.abs(quantity)
          await tx.batch.update({
            where: { id: batchId },
            data: {
              soldQuantity: batch.soldQuantity + delta,
            },
          })
        } else if (['IN', 'RETURN_IN'].includes(type)) {
          const delta = Math.abs(quantity)
          await tx.batch.update({
            where: { id: batchId },
            data: {
              quantity: batch.quantity + delta,
            },
          })
        }
      }
    }

    // 3. If target rack/shelf provided, update product storage coordinates
    if (toRack !== undefined) {
      let resolvedRackId: string | null = null
      if (toRack && toRack.trim().length > 0) {
        const rackCode = toRack.trim().toUpperCase()
        const existingRack = await tx.rack.findFirst({
          where: { branchId, code: rackCode },
        })
        if (existingRack) {
          resolvedRackId = existingRack.id
        } else {
          const createdRack = await tx.rack.create({
            data: {
              branchId,
              code: rackCode,
              shelfNumber: toShelf?.trim() || '1',
              description: `Rack ${rackCode}`,
            },
          })
          resolvedRackId = createdRack.id
        }
      }
      await tx.product.update({
        where: { id: productId },
        data: { rackId: resolvedRackId },
      })
    }

    // 4. Construct formatted audit notes with location transition details
    const locNote = (fromBox || toBox || fromRack || toRack)
      ? `Relocated: [${[fromRack, fromShelf, fromBox].filter(Boolean).join(' > ') || 'Unassigned'}] ➔ [${[toRack, toShelf, toBox].filter(Boolean).join(' > ')}]`
      : null

    const formattedNotes = [reason, locNote, notes].filter(Boolean).join(' — ')

    // 5. Create immutable InventoryMovement record in PostgreSQL
    const movement = await tx.inventoryMovement.create({
      data: {
        inventoryId: inventory.id,
        type,
        quantity,
        quantityBefore: beforeTotal,
        quantityAfter: afterTotal,
        referenceType: referenceType || (toBox ? 'BOX_RELOCATION' : type),
        referenceId: referenceId || null,
        batchId: batchId || null,
        notes: formattedNotes || null,
        createdById: actorId,
      },
      include: {
        inventory: {
          select: {
            productId: true,
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                unitOfMeasure: true,
                rack: true,
                costPrice: true,
                mrp: true,
              },
            },
            branch: { select: { id: true, name: true, code: true } },
          },
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            expiryDate: true,
            mrp: true,
            purchasePrice: true,
            supplierRef: true, purchase: { select: { supplier: { select: { id: true, name: true } } } },
          },
        },
      },
    })

    return movement as unknown as MovementRow
  })
}

// ─── Read: Adjustments ────────────────────────────────────────

export async function getAdjustments(
  params: {
    page?: number
    limit?: number
    search?: string
    branchId?: string
    productId?: string
    supplierId?: string
    status?: StockAdjustment['status']
    adjustmentType?: StockAdjustment['adjustmentType']
  } = {}
): Promise<{
  data: AdjustmentRow[]
  summary?: AdjustmentAnalyticsSummary
  pagination: { page: number; limit: number; total: number; pages: number }
}> {
  const { page = 1, limit = 20, search, branchId, productId, supplierId, status, adjustmentType } = params

  const where: Prisma.StockAdjustmentWhereInput = {}
  if (branchId) where.branchId = branchId
  if (productId) where.productId = productId
  if (status) where.status = status
  if (adjustmentType) where.adjustmentType = adjustmentType
  if (supplierId) {
    const supplierBatches = await prisma.batch.findMany({
      where: { purchase: { supplierId } },
      select: { id: true },
    })
    where.batchId = { in: supplierBatches.map((b) => b.id) }
  }
  if (search) {
    // StockAdjustment has no product relation; resolve matching product ids first.
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    })
    where.productId = { in: products.map((p) => p.id) }
  }

  const skip = (page - 1) * limit
  const [rows, total] = await Promise.all([
    prisma.stockAdjustment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    }),
    prisma.stockAdjustment.count({ where }),
  ])

  const batchIds = rows.map((r) => r.batchId).filter((id): id is string => Boolean(id))

  const [products, branches, batches] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: rows.map((r) => r.productId) } },
      select: {
        id: true,
        name: true,
        sku: true,
        rack: true,
        mrp: true,
        costPrice: true,
      },
    }),
    prisma.branch.findMany({
      where: { id: { in: rows.map((r) => r.branchId) } },
      select: { id: true, name: true, code: true },
    }),
    batchIds.length > 0 && (prisma as any).batch?.findMany
      ? (prisma as any).batch.findMany({
          where: { id: { in: batchIds } },
          select: {
            id: true,
            batchNumber: true,
            expiryDate: true,
            purchasePrice: true,
            mrp: true,
            quantity: true,
            supplierRef: true, purchase: { select: { supplier: { select: { id: true, name: true } } } },
          },
        })
      : Promise.resolve([]),
  ])
  const productMap = new Map(products.map((p) => [p.id, p]))
  const branchMap = new Map(branches.map((b) => [b.id, b]))
  const batchMap = new Map(((batches as any[]) || []).map((b) => [b.id, b]))

  // Resolve dead product candidates (inactive products > 60 days)
  const deadProductIds: string[] = []
  try {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    const recentActivity = await (prisma as any).saleItem?.groupBy?.({
      by: ['productId'],
      where: {
        productId: { in: rows.map((r) => r.productId) },
        sale: { createdAt: { gte: sixtyDaysAgo } },
      },
    })
    const activeProductSet = new Set(((recentActivity as any[]) || []).map((a: any) => a.productId))
    for (const r of rows) {
      if (!activeProductSet.has(r.productId)) {
        deadProductIds.push(r.productId)
      }
    }
  } catch {
    // Graceful fallback if saleItem is not mocked
  }

  const rawData = rows.map((r) => {
    const rawProd = productMap.get(r.productId) ?? { id: r.productId, name: 'Unknown product', sku: '' }
    const rackObj = (rawProd as any).rack
    const rackCode = (rackObj && typeof rackObj === 'object') ? rackObj.code : (rackObj || null)
    const shelfNum = (rackObj && typeof rackObj === 'object') ? rackObj.shelfNumber : null
    return {
      ...r,
      product: {
        ...rawProd,
        rack: rackCode,
        shelf: shelfNum,
      },
    branch: branchMap.get(r.branchId) ?? { id: r.branchId, name: 'Unknown branch', code: null },
    batch: r.batchId ? batchMap.get(r.batchId) ?? null : null,
    }
  })

  let data: AdjustmentRow[] = rawData as AdjustmentRow[]
  let summary: AdjustmentAnalyticsSummary = {
    totalCount: data.length,
    netQuantity: data.reduce((s, d) => s + d.quantity, 0),
    netCostImpact: 0,
    netMrpImpact: 0,
    nearExpiryCount: 0,
    deadStockCount: 0,
    boxDiscrepancyCount: 0,
  }

  try {
    const workerResult = await analyzeAdjustmentsInWorker<AdjustmentRow>(rawData, deadProductIds)
    data = workerResult.items
    summary = workerResult.summary
  } catch {
    // Graceful fallback if worker is unavailable in lightweight unit tests
    data = rawData.map((d: any) => {
      const cost = d.batch?.purchasePrice != null
        ? Number(d.batch.purchasePrice)
        : (d.product?.costPrice != null ? Number(d.product.costPrice) : (Number(d.product?.mrp || 0) * 0.7))
      const mrp = d.batch?.mrp != null ? Number(d.batch.mrp) : Number(d.product?.mrp || 0)
      return {
        ...d,
        costImpact: Math.round(d.quantity * cost * 100) / 100,
        mrpImpact: Math.round(d.quantity * mrp * 100) / 100,
        isNearExpiry: Boolean(d.batch?.expiryDate && new Date(d.batch.expiryDate).getTime() - Date.now() < 90 * 86400000),
        isDeadStock: deadProductIds.includes(d.productId),
      }
    })
  }

  const normalizedAdjustments = data.map((d: any) => {
    const rackObj = d.product?.rack
    const rackCode = (rackObj && typeof rackObj === 'object') ? rackObj.code : (rackObj || null)
    const shelfNum = (rackObj && typeof rackObj === 'object') ? rackObj.shelfNumber : (d.product?.shelf || null)
    return {
      ...d,
      product: {
        ...d.product,
        rack: rackCode,
        shelf: shelfNum,
      },
    }
  })

  return {
    data: normalizedAdjustments,
    summary,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

// ─── Batch Reconciliation (internal, transactional) ───────────

/**
 * Reconcile batch quantities for a negative stock adjustment using FEFO.
 * Called within an existing transaction. Reduces batch.quantity for the
 * adjusted product+branch, picking the earliest-expiring batches first.
 *
 * If no eligible batches exist (aggregate-only stock from a prior positive
 * adjustment or direct inventory creation), the function returns silently —
 * the inventory-level movement is still valid.
 *
 * CAS: each batch update uses `where { id, quantity }` to detect concurrent
 * modification, consistent with disposeBatch and POS sale patterns.
 */
async function reconcileBatchesForNegativeAdjustment(
  tx: Prisma.TransactionClient,
  adjustment: StockAdjustment,
  actorId: string
): Promise<void> {
  if (adjustment.quantity >= 0) return

  const targetQty = Math.abs(adjustment.quantity)

  // Fetch eligible batches (ACTIVE, not expired, with availability) in FEFO order
  const batchRows = await tx.batch.findMany({
    where: {
      productId: adjustment.productId,
      branchId: adjustment.branchId,
      status: 'ACTIVE',
      expiryDate: { gte: new Date() },
    },
    select: {
      id: true,
      batchNumber: true,
      productId: true,
      quantity: true,
      reservedQuantity: true,
      soldQuantity: true,
      status: true,
      expiryDate: true,
      branchId: true,
    },
    orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
  })

  const eligible = filterEligibleBatches(batchRows as FefoBatchCandidate[])
  const totalAvailable = eligible.reduce((sum, b) => sum + b.availableQuantity, 0)

  // No eligible batches — aggregate-only stock, nothing to reconcile
  if (eligible.length === 0 || totalAvailable === 0) return

  if (targetQty > totalAvailable) {
    throw new Error(
      `Conflict: requested adjustment of ${targetQty} exceeds batch availability of ${totalAvailable} — possible diverged inventory`
    )
  }

  const allocation = allocateFefo(eligible, targetQty)
  if (allocation.status !== 'success') {
    throw new Error('Conflict: FEFO allocation failed during batch reconciliation')
  }

  for (const a of allocation.allocations) {
    const batchRow = batchRows.find((b) => b.id === a.batchId)
    if (!batchRow) {
      throw new Error('Conflict: batch changed concurrently during allocation')
    }

    const nextQuantity = batchRow.quantity - a.allocatedQuantity

    // CAS: update batch quantity
    const result = await tx.batch.updateMany({
      where: {
        id: batchRow.id,
        quantity: batchRow.quantity,
      },
      data: { quantity: nextQuantity },
    })
    if (result.count !== 1) {
      throw new Error('Conflict: batch changed concurrently, please retry')
    }

    // If batch is now fully depleted, mark DISPOSED with status log
    if (nextQuantity === 0) {
      const disposeResult = await tx.batch.updateMany({
        where: { id: batchRow.id, quantity: 0, status: 'ACTIVE' },
        data: { status: 'DISPOSED' },
      })
      if (disposeResult.count !== 1) {
        throw new Error('Conflict: batch state changed concurrently during disposal')
      }

      await tx.batchStatusLog.create({
        data: {
          batchId: batchRow.id,
          fromStatus: 'ACTIVE',
          toStatus: 'DISPOSED',
          reason: `Stock adjustment (${adjustment.adjustmentType}): ${adjustment.reason}`,
          changedById: actorId,
        },
      })
    }
  }
}

// ─── Stock Apply (internal, transactional) ────────────────────

/**
 * Applies a stock adjustment to the inventory record and records the movement.
 *
 * Concurrency: runs inside an interactive transaction. Inventory updates use an
 * optimistic compare-and-set guarded by `updatedAt` (`updateMany ... where id
 * AND updatedAt`). Under Postgres this serializes concurrent writers (the row
 * lock + re-evaluated predicate makes the loser match 0 rows). A lost race is
 * surfaced as a 409 so the user can review and retry. The adjustment row is
 * guarded by `status = PENDING` so double-approval cannot double-apply.
 *
 * Quantity invariant: `availableQuantity = totalQuantity - reservedQuantity`.
 * A stock adjustment changes total and available by the SAME signed delta and
 * never touches `reservedQuantity`, so the invariant holds after every write.
 */
async function applyStockAdjustment(
  tx: Prisma.TransactionClient,
  adjustment: StockAdjustment,
  actorId: string
): Promise<void> {
  const qty = adjustment.quantity
  const invWhere: Prisma.InventoryWhereUniqueInput = {
    productId_branchId: { productId: adjustment.productId, branchId: adjustment.branchId },
  }

  const inventory = await tx.inventory.findUnique({ where: invWhere })
  const beforeTotal = inventory?.totalQuantity ?? 0
  const beforeAvailable = inventory?.availableQuantity ?? 0

  if (qty < 0 && beforeAvailable < Math.abs(qty)) {
    throw new Error(`Insufficient available stock: available ${beforeAvailable}`)
  }

  const afterTotal = beforeTotal + qty
  const afterAvailable = beforeAvailable + qty

  let inventoryId: string
  if (inventory) {
    const res = await tx.inventory.updateMany({
      where: { id: inventory.id, updatedAt: inventory.updatedAt },
      data: { totalQuantity: afterTotal, availableQuantity: afterAvailable },
    })
    if (res.count !== 1) {
      throw new Error('Conflict: inventory changed concurrently, please retry')
    }
    inventoryId = inventory.id
  } else {
    const created = await tx.inventory.create({
      data: {
        productId: adjustment.productId,
        branchId: adjustment.branchId,
        totalQuantity: afterTotal,
        availableQuantity: afterAvailable,
        reservedQuantity: 0,
      },
    })
    inventoryId = created.id
  }

  await tx.inventoryMovement.create({
    data: {
      inventoryId,
      type: 'ADJUSTMENT',
      quantity: qty,
      quantityBefore: beforeTotal,
      quantityAfter: afterTotal,
      referenceType: 'ADJUSTMENT',
      referenceId: adjustment.id,
      batchId: adjustment.batchId ?? null,
      notes: [adjustment.reason, adjustment.notes].filter(Boolean).join(' — ') || null,
      createdById: actorId,
    },
  })

  // Reconcile batch quantities for negative adjustments (FEFO)
  await reconcileBatchesForNegativeAdjustment(tx, adjustment, actorId)

  const adjRes = await tx.stockAdjustment.updateMany({
    where: { id: adjustment.id, status: 'PENDING' },
    data: { status: 'APPROVED', approvedById: actorId, approvedAt: new Date() },
  })
  if (adjRes.count !== 1) {
    throw new Error('Conflict: adjustment already processed')
  }
}

// ─── Create Adjustment ────────────────────────────────────────

const adjustmentSelect = {
  id: true,
  branchId: true,
  productId: true,
  batchId: true,
  adjustmentType: true,
  quantity: true,
  reason: true,
  notes: true,
  status: true,
  approvedById: true,
  approvedAt: true,
  createdById: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
} as const

export interface AdjustmentSummary {
  id: string
  branchId: string
  productId: string
  batchId: string | null
  adjustmentType: StockAdjustment['adjustmentType']
  quantity: number
  reason: string
  notes: string | null
  status: StockAdjustment['status']
  approvedById: string | null
  approvedAt: Date | null
  createdById: string
  createdAt: Date
  createdBy: { id: string; name: string } | null
}

export type CreateAdjustmentInput = {
  branchId: string
  productId: string
  batchId?: string
  adjustmentType: StockAdjustment['adjustmentType']
  quantity: number
  reason: string
  notes?: string
}

export async function createAdjustment(
  data: CreateAdjustmentInput,
  user: AuthUser
): Promise<AdjustmentSummary> {
  const product = await prisma.product.findUnique({
    where: { id: data.productId },
    select: { id: true, isActive: true },
  })
  if (!product) throw new Error('Not Found: product')
  if (!product.isActive) throw new Error('Product is inactive')

  // Pre-check availability for reductions
  if (data.quantity < 0) {
    const inv = await prisma.inventory.findUnique({
      where: {
        productId_branchId: { productId: data.productId, branchId: data.branchId },
      },
      select: { availableQuantity: true },
    })
    const available = inv?.availableQuantity ?? 0
    if (available < Math.abs(data.quantity)) {
      throw new Error(`Insufficient available stock: available ${available}`)
    }
  }

  const autoApprove = Math.abs(data.quantity) <= AUTO_APPROVE_THRESHOLD

  if (autoApprove) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const adjustment = await tx.stockAdjustment.create({
          data: {
            branchId: data.branchId,
            productId: data.productId,
            batchId: data.batchId ?? null,
            adjustmentType: data.adjustmentType,
            quantity: data.quantity,
            reason: data.reason,
            notes: data.notes ?? null,
            status: 'PENDING',
            createdById: user.id,
          },
        })
        await applyStockAdjustment(tx, adjustment, user.id)
        return tx.stockAdjustment.findUniqueOrThrow({
          where: { id: adjustment.id },
          select: adjustmentSelect,
        })
      })
      return result
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        throw new Error('Conflict: inventory record already exists for this product/branch')
      }
      throw e
    }
  }

  // Pending adjustment (requires supervisor approval)
  const adjustment = await prisma.stockAdjustment.create({
    data: {
      branchId: data.branchId,
      productId: data.productId,
      batchId: data.batchId ?? null,
      adjustmentType: data.adjustmentType,
      quantity: data.quantity,
      reason: data.reason,
      notes: data.notes ?? null,
      status: 'PENDING',
      createdById: user.id,
    },
    select: adjustmentSelect,
  })

  return adjustment
}

// ─── Approve Adjustment ───────────────────────────────────────

export async function approveAdjustment(
  adjustmentId: string,
  user: AuthUser
): Promise<AdjustmentSummary> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const adjustment = await tx.stockAdjustment.findUnique({ where: { id: adjustmentId } })
      if (!adjustment) throw new Error('Not Found: adjustment')
      await assertBranchAccess(user, adjustment.branchId)
      if (adjustment.status !== 'PENDING') {
        throw new Error(`Conflict: adjustment is ${adjustment.status.toLowerCase()}, not pending`)
      }
      await applyStockAdjustment(tx, adjustment, user.id)
      return tx.stockAdjustment.findUniqueOrThrow({
        where: { id: adjustmentId },
        select: adjustmentSelect,
      })
    })
    return result
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      throw new Error('Conflict: inventory record already exists for this product/branch')
    }
    throw e
  }
}

// ─── Reject Adjustment ────────────────────────────────────────

export async function rejectAdjustment(
  adjustmentId: string,
  user: AuthUser
): Promise<AdjustmentSummary> {
  const result = await prisma.$transaction(async (tx) => {
    const adjustment = await tx.stockAdjustment.findUnique({ where: { id: adjustmentId } })
    if (!adjustment) throw new Error('Not Found: adjustment')
    await assertBranchAccess(user, adjustment.branchId)
    if (adjustment.status !== 'PENDING') {
      throw new Error(`Conflict: adjustment is ${adjustment.status.toLowerCase()}, not pending`)
    }
    await tx.stockAdjustment.updateMany({
      where: { id: adjustmentId, status: 'PENDING' },
      data: { status: 'REJECTED' },
    })
    return tx.stockAdjustment.findUniqueOrThrow({
      where: { id: adjustmentId },
      select: adjustmentSelect,
    })
  })
  return result
}

// ─── Update / Edit Adjustment ─────────────────────────────────

export type UpdateAdjustmentServiceInput = {
  quantity?: number
  batchId?: string | null
  adjustmentType?: StockAdjustment['adjustmentType']
  reason?: string
  notes?: string | null
}

export async function updateAdjustment(
  adjustmentId: string,
  data: UpdateAdjustmentServiceInput,
  user: AuthUser
): Promise<AdjustmentSummary> {
  const adjustment = await prisma.stockAdjustment.findUnique({ where: { id: adjustmentId } })
  if (!adjustment) throw new Error('Not Found: adjustment')
  await assertBranchAccess(user, adjustment.branchId)

  // 1. If PENDING: allow full editing of quantity, type, batch, reason, notes
  if (adjustment.status === 'PENDING') {
    if (data.quantity !== undefined && data.quantity < 0) {
      const inv = await prisma.inventory.findUnique({
        where: {
          productId_branchId: { productId: adjustment.productId, branchId: adjustment.branchId },
        },
        select: { availableQuantity: true },
      })
      const available = inv?.availableQuantity ?? 0
      if (available < Math.abs(data.quantity)) {
        throw new Error(`Insufficient available stock: available ${available}`)
      }
    }

    const updated = await prisma.stockAdjustment.update({
      where: { id: adjustmentId },
      data: {
        quantity: data.quantity !== undefined ? data.quantity : adjustment.quantity,
        batchId: data.batchId !== undefined ? data.batchId : adjustment.batchId,
        adjustmentType: data.adjustmentType ?? adjustment.adjustmentType,
        reason: data.reason ?? adjustment.reason,
        notes: data.notes !== undefined ? data.notes : adjustment.notes,
      },
      select: adjustmentSelect,
    })
    return updated
  }

  // 2. If APPROVED: allow appending/editing reason and notes; if quantity changes, adjust delta
  if (adjustment.status === 'APPROVED') {
    if (data.quantity !== undefined && data.quantity !== adjustment.quantity) {
      const diff = data.quantity - adjustment.quantity
      const result = await prisma.$transaction(async (tx) => {
        // Apply differential stock change
        const syntheticAdj = {
          ...adjustment,
          quantity: diff,
        }
        await applyStockAdjustment(tx, syntheticAdj, user.id)

        return tx.stockAdjustment.update({
          where: { id: adjustmentId },
          data: {
            quantity: data.quantity,
            reason: data.reason ?? adjustment.reason,
            notes: data.notes !== undefined ? data.notes : adjustment.notes,
          },
          select: adjustmentSelect,
        })
      })
      return result
    }

    // Only notes or reason changed
    return prisma.stockAdjustment.update({
      where: { id: adjustmentId },
      data: {
        reason: data.reason ?? adjustment.reason,
        notes: data.notes !== undefined ? data.notes : adjustment.notes,
      },
      select: adjustmentSelect,
    })
  }

  throw new Error(`Conflict: adjustment is ${adjustment.status.toLowerCase()} and cannot be modified`)
}

// ─── Delete Adjustment ────────────────────────────────────────

export async function deleteAdjustment(
  adjustmentId: string,
  user: AuthUser
): Promise<{ id: string; success: boolean; message: string }> {
  const adjustment = await prisma.stockAdjustment.findUnique({ where: { id: adjustmentId } })
  if (!adjustment) throw new Error('Not Found: adjustment')
  await assertBranchAccess(user, adjustment.branchId)

  // If PENDING or REJECTED: cleanly delete the record
  if (adjustment.status === 'PENDING' || adjustment.status === 'REJECTED') {
    await prisma.stockAdjustment.delete({ where: { id: adjustmentId } })
    return { id: adjustmentId, success: true, message: 'Adjustment deleted' }
  }

  // If APPROVED: reverse inventory effect in transaction before removing
  if (adjustment.status === 'APPROVED') {
    await prisma.$transaction(async (tx) => {
      // Reversal: negate the original adjustment quantity
      const reversalAdj = {
        ...adjustment,
        quantity: -adjustment.quantity,
      }
      await applyStockAdjustment(tx, reversalAdj, user.id)
      await tx.stockAdjustment.delete({ where: { id: adjustmentId } })
    })

    return { id: adjustmentId, success: true, message: 'Approved adjustment reversed and deleted' }
  }

  throw new Error('Unable to delete adjustment')
}

// ─── Cumulative / Multi-Item Adjustments ───────────────────────

export async function createCumulativeAdjustments(
  data: {
    branchId: string
    items: Array<{
      productId: string
      batchId?: string
      adjustmentType: StockAdjustment['adjustmentType']
      quantity: number
      reason: string
      notes?: string
    }>
  },
  user: AuthUser
): Promise<AdjustmentSummary[]> {
  await assertBranchAccess(user, data.branchId)

  const createdSummaries: AdjustmentSummary[] = []
  for (const item of data.items) {
    const summary = await createAdjustment(
      {
        branchId: data.branchId,
        productId: item.productId,
        batchId: item.batchId,
        adjustmentType: item.adjustmentType,
        quantity: item.quantity,
        reason: item.reason,
        notes: item.notes,
      },
      user
    )
    createdSummaries.push(summary)
  }

  return createdSummaries
}
