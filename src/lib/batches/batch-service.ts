// ─────────────────────────────────────────────────────────────
// Batch Management Service
//
// Lifecycle: ACTIVE → BLOCKED (block action) | ACTIVE/BLOCKED/EXPIRED
// → DISPOSED (dispose action). Lazy sweep flips ACTIVE/BLOCKED batches
// whose expiry date has passed into EXPIRED on read. EXHAUSTED is
// reached programmatically by downstream consumption (future POS).
//
// Batch creation is owned by Purchases/GRN (out of scope); `createBatch`
// is exposed here for that future flow and for tests.
// ─────────────────────────────────────────────────────────────
import type {
  Batch,
  BatchDisposal,
  BatchStatus,
  BatchStatusLog,
  Prisma,
  Product,
  Purchase,
  Rack,
  Supplier,
} from '@prisma/client'

import prisma from '@/lib/db/prisma'
import {
  runMultiThreadedExpirySweep,
  spawnExpirySweepProcess,
  getSpawnedJobStatus,
  listSpawnedJobs,
  type BatchExpiryOptions,
  type BatchExpirySweepResult,
  type SpawnExecutionHandle,
  type SpawnedJobStatus,
} from '@/lib/batches/expiry'
import {
  analyzeBatchesInWorker,
  type BatchAnalyticsSummary,
} from '@/lib/inventory/inventory-analytics-service'
import { assertBranchAccess, type AuthUser } from '@/lib/inventory/branch-access'
import type {
  CreateBatchInput,
  DisposeBatchInput,
  RelocateBatchStorageInput,
  UpdateBatchInput,
  VendorReturnBatchInput,
} from '@/lib/validations/batch'

// ─── Types ────────────────────────────────────────────────────

export interface BatchWithProduct extends Batch {
  product: Product & { rack?: Rack | null }
  purchase?: (Purchase & { supplier?: Supplier | null }) | null
  supplier?: Supplier | null
}

export interface BatchDetail extends BatchWithProduct {
  statusLogs: BatchStatusLog[]
  disposals: BatchDisposal[]
}

export interface BatchListItem extends BatchWithProduct {
  availableQuantity: number
  rack?: string | null
  shelf?: string | null
  box?: string | null
  supplierName?: string
  supplierId?: string | null
  daysUntilExpiry?: number
  fefoTier?: 'CRITICAL' | 'WARNING' | 'INFO' | 'HEALTHY' | 'EXPIRED'
  isDeadStock?: boolean
  valuationAtCost?: number
  valuationAtMrp?: number
}

export interface BatchDetailItem extends BatchDetail {
  availableQuantity: number
}

export interface BatchListParams {
  page?: number
  limit?: number
  search?: string
  productId?: string
  branchId?: string
  supplierId?: string
  rack?: string
  box?: string
  status?: BatchStatus
  fefoTier?: 'all' | 'critical' | 'warning' | 'info' | 'healthy' | 'expired'
  deadStockOnly?: boolean
  sortBy?: 'expiryDate' | 'batchNumber' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface BatchListResult {
  data: BatchListItem[]
  summary?: BatchAnalyticsSummary
  pagination: { page: number; limit: number; total: number; pages: number }
}

const productInclude = {
  product: {
    include: {
      rack: true,
    },
  },
  purchase: {
    include: {
      supplier: true,
    },
  },
} as const


const detailInclude = {
  product: {
    include: {
      rack: true,
    },
  },
  purchase: {
    include: {
      supplier: true,
    },
  },
  statusLogs: { orderBy: { createdAt: 'desc' } },
  disposals: { orderBy: { createdAt: 'desc' } },
} as const

function toListItem(batch: BatchWithProduct, deadProductIds: Set<string> = new Set()): BatchListItem {
  const availableQuantity = batch.quantity - batch.reservedQuantity - batch.soldQuantity
  const rack = batch.product?.rack?.code || null
  const shelf = batch.product?.rack?.shelfNumber || null
  const box = null
  const supplierName = (batch.purchase?.supplier?.name || batch.supplier?.name) || (batch.supplierRef ? `Ref: ${batch.supplierRef}` : 'Direct Wholesaler')
  const supplierId = batch.purchase?.supplier?.id || batch.supplier?.id || null

  const now = new Date()
  let daysUntilExpiry = 9999
  let fefoTier: 'CRITICAL' | 'WARNING' | 'INFO' | 'HEALTHY' | 'EXPIRED' = 'HEALTHY'
  if (batch.expiryDate) {
    daysUntilExpiry = Math.floor((new Date(batch.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntilExpiry < 0 || batch.status === 'EXPIRED') {
      fefoTier = 'EXPIRED'
    } else if (daysUntilExpiry <= 30) {
      fefoTier = 'CRITICAL'
    } else if (daysUntilExpiry <= 60) {
      fefoTier = 'WARNING'
    } else if (daysUntilExpiry <= 90) {
      fefoTier = 'INFO'
    } else {
      fefoTier = 'HEALTHY'
    }
  }

  const cost = Number(batch.purchasePrice) || Number(batch.product?.costPrice) || (Number(batch.mrp) * 0.7) || 0
  const mrp = Number(batch.mrp) || Number(batch.product?.mrp) || 0
  const isDeadStock = deadProductIds.has(batch.productId || batch.product?.id)

  return {
    ...batch,
    availableQuantity,
    rack,
    shelf,
    box,
    supplierName,
    supplierId,
    daysUntilExpiry,
    fefoTier,
    isDeadStock,
    valuationAtCost: Math.round(cost * availableQuantity * 100) / 100,
    valuationAtMrp: Math.round(mrp * availableQuantity * 100) / 100,
  }
}

function toDetailItem(batch: BatchDetail): BatchDetailItem {
  return {
    ...batch,
    availableQuantity: batch.quantity - batch.reservedQuantity - batch.soldQuantity,
  }
}

function isUniqueConstraintError(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'P2002'
  )
}

function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>
}

// ─── Lazy Expiry Sweep ────────────────────────────────────────

/**
 * Flip every ACTIVE/BLOCKED batch whose expiry date has passed into
 * EXPIRED. Called lazily from list/detail reads — no cron/worker.
 */
export async function expireDueBatches(): Promise<number> {
  const due = await prisma.batch.findMany({
    where: { expiryDate: { lt: new Date() }, status: { in: ['ACTIVE', 'BLOCKED'] } },
    select: { id: true, status: true },
  })

  if (due.length === 0) return 0

  await prisma.$transaction(
    due.flatMap((b) => [
      prisma.batch.updateMany({
        where: { id: b.id, status: b.status },
        data: { status: 'EXPIRED' },
      }),
      prisma.batchStatusLog.create({
        data: {
          batchId: b.id,
          fromStatus: b.status,
          toStatus: 'EXPIRED',
          reason: 'Batch expired',
          changedById: null,
        },
      }),
    ])
  )

  return due.length
}

// ─── Read ─────────────────────────────────────────────────────

export async function getBatches(params: BatchListParams = {}): Promise<BatchListResult> {
  await expireDueBatches()

  const {
    page = 1,
    limit = 20,
    search,
    productId,
    branchId,
    supplierId,
    rack,
    box,
    status,
    fefoTier,
    deadStockOnly,
    sortBy = 'expiryDate',
    sortOrder = 'asc',
  } = params

  const skip = (page - 1) * limit

  const where: Prisma.BatchWhereInput = {}

  if (search) {
    where.OR = [
      { batchNumber: { contains: search, mode: 'insensitive' } },
      { product: { name: { contains: search, mode: 'insensitive' } } },
      { product: { sku: { contains: search, mode: 'insensitive' } } },
    ]
  }

  if (productId) where.productId = productId
  if (branchId) where.branchId = branchId
  if (supplierId) where.purchase = { supplierId }
  if (status) where.status = status

  if (rack) {
    where.product = {
      rack: { code: { equals: rack, mode: 'insensitive' } },
    }
  }

  const now = new Date()
  if (fefoTier && fefoTier !== 'all') {
    if (fefoTier === 'expired') {
      where.OR = [
        { status: 'EXPIRED' },
        { expiryDate: { lt: now } },
      ]
    } else if (fefoTier === 'critical') {
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      where.expiryDate = { gte: now, lte: thirtyDays }
      where.status = { not: 'EXPIRED' }
    } else if (fefoTier === 'warning') {
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
      where.expiryDate = { gt: thirtyDays, lte: sixtyDays }
      where.status = { not: 'EXPIRED' }
    } else if (fefoTier === 'info') {
      const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
      const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
      where.expiryDate = { gt: sixtyDays, lte: ninetyDays }
      where.status = { not: 'EXPIRED' }
    } else if (fefoTier === 'healthy') {
      const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
      where.expiryDate = { gt: ninetyDays }
      where.status = { not: 'EXPIRED' }
    }
  }

  let deadProductIds: string[] = []
  try {
    if (prisma.inventory?.findMany) {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      const inventories = await prisma.inventory.findMany({
        where: {
          ...(branchId ? { branchId } : {}),
          updatedAt: { lt: ninetyDaysAgo },
          availableQuantity: { gt: 0 },
        },
        select: { productId: true },
      })
      deadProductIds = inventories.map((i) => i.productId)
    }
  } catch {
    deadProductIds = []
  }

  if (deadStockOnly && deadProductIds.length > 0) {
    where.productId = { in: deadProductIds }
  }

  const [data, total] = await Promise.all([
    prisma.batch.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder } as Prisma.BatchOrderByWithRelationInput,
      include: productInclude,
    }),
    prisma.batch.count({ where }),
  ])

  const deadSet = new Set(deadProductIds)
  const listItems = (data as BatchWithProduct[]).map((b) => toListItem(b, deadSet))

  let summary: BatchAnalyticsSummary | undefined
  try {
    const workerResult = await analyzeBatchesInWorker<BatchListItem>(
      data as BatchWithProduct[],
      deadProductIds
    )
    summary = workerResult.summary
  } catch {
    // Fallback if worker cannot execute
  }

  return {
    data: listItems,
    summary,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

export async function getBatchById(
  id: string,
  user?: AuthUser
): Promise<BatchDetailItem | null> {
  await expireDueBatches()

  const batch = await prisma.batch.findUnique({ where: { id }, include: detailInclude })
  if (!batch) return null

  if (batch.branchId && user) {
    await assertBranchAccess(user, batch.branchId)
  }

  return toDetailItem(batch as BatchDetail)
}

// ─── Create (used by future GRN/Purchases + tests) ────────────

export async function createBatch(
  input: CreateBatchInput,
  user: AuthUser
): Promise<BatchDetailItem> {
  try {
    const batch = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: input.productId },
        select: { id: true, isActive: true },
      })
      if (!product) throw new Error('Not Found: product')
      if (!product.isActive) throw new Error('Product is inactive')

      if (input.branchId) await assertBranchAccess(user, input.branchId)

      const existing = await tx.batch.findFirst({
        where: { productId: input.productId, batchNumber: input.batchNumber },
        select: { id: true },
      })
      if (existing) {
        throw new Error('Conflict: a batch with this batch number already exists for the product')
      }

      const created = await tx.batch.create({
        data: {
          product: { connect: { id: input.productId } },
          batchNumber: input.batchNumber,
          manufacturingDate: input.manufacturingDate ?? null,
          expiryDate: input.expiryDate,
          purchasePrice: input.purchasePrice ?? 0,
          mrp: input.mrp ?? 0,
          quantity: input.quantity ?? 0,
          supplierRef: input.supplierRef ?? null,
          purchase: input.purchaseId ? { connect: { id: input.purchaseId } } : undefined,
          branchId: input.branchId ?? null,
        },
        include: detailInclude,
      })

      await tx.batchStatusLog.create({
        data: {
          batchId: created.id,
          fromStatus: 'ACTIVE',
          toStatus: 'ACTIVE',
          reason: 'Batch created',
          changedById: user.id,
        },
      })

      return created
    })

    return toDetailItem(batch as BatchDetail)
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      throw new Error('Conflict: a batch with this batch number already exists for the product')
    }
    throw e
  }
}

// ─── Update (non-lifecycle fields, ACTIVE only) ──────────────

export async function updateBatch(
  id: string,
  input: UpdateBatchInput,
  user: AuthUser
): Promise<BatchDetailItem> {
  const batch = await prisma.$transaction(async (tx) => {
    const existing = await tx.batch.findUnique({
      where: { id },
      select: { id: true, status: true, branchId: true },
    })
    if (!existing) throw new Error('Not Found: batch')
    if (existing.branchId) await assertBranchAccess(user, existing.branchId)
    if (existing.status !== 'ACTIVE') {
      throw new Error(
        `Conflict: batch is ${existing.status.toLowerCase()}, only ACTIVE batches can be edited`
      )
    }

    const updates = omitUndefined({
      batchNumber: input.batchNumber,
      manufacturingDate: input.manufacturingDate,
      expiryDate: input.expiryDate,
      purchasePrice: input.purchasePrice,
      mrp: input.mrp,
      supplierRef: input.supplierRef,
    }) as Prisma.BatchUpdateManyMutationInput
    if (Object.keys(updates).length === 0) throw new Error('No updates provided')

    const result = await tx.batch.updateMany({
      where: { id, status: 'ACTIVE' },
      data: updates,
    })
    if (result.count === 0) throw new Error('Conflict: batch state changed, please retry')

    return tx.batch.findUniqueOrThrow({ where: { id }, include: detailInclude })
  })

  return toDetailItem(batch as BatchDetail)
}

// ─── Block ────────────────────────────────────────────────────

export async function blockBatch(
  id: string,
  reason: string,
  user: AuthUser
): Promise<BatchDetailItem> {
  const batch = await prisma.$transaction(async (tx) => {
    const existing = await tx.batch.findUnique({
      where: { id },
      select: { status: true, branchId: true },
    })
    if (!existing) throw new Error('Not Found: batch')
    if (existing.branchId) await assertBranchAccess(user, existing.branchId)
    if (existing.status !== 'ACTIVE') {
      throw new Error(
        `Conflict: batch is ${existing.status.toLowerCase()}, only ACTIVE batches can be blocked`
      )
    }

    const result = await tx.batch.updateMany({
      where: { id, status: 'ACTIVE' },
      data: { status: 'BLOCKED', blockedReason: reason },
    })
    if (result.count === 0) throw new Error('Conflict: batch state changed, please retry')

    await tx.batchStatusLog.create({
      data: {
        batchId: id,
        fromStatus: 'ACTIVE',
        toStatus: 'BLOCKED',
        reason,
        changedById: user.id,
      },
    })

    return tx.batch.findUniqueOrThrow({ where: { id }, include: detailInclude })
  })

  return toDetailItem(batch as BatchDetail)
}

// ─── Dispose ──────────────────────────────────────────────────

export async function disposeBatch(
  id: string,
  input: DisposeBatchInput,
  user: AuthUser
): Promise<BatchDetailItem> {
  const batch = await prisma.$transaction(async (tx) => {
    const existing = await tx.batch.findUnique({
      where: { id },
      select: {
        status: true,
        branchId: true,
        productId: true,
        quantity: true,
        reservedQuantity: true,
        soldQuantity: true,
      },
    })
    if (!existing) throw new Error('Not Found: batch')
    if (existing.branchId) await assertBranchAccess(user, existing.branchId)
    if (existing.status === 'DISPOSED' || existing.status === 'EXHAUSTED') {
      throw new Error(`Conflict: batch is ${existing.status.toLowerCase()}, cannot dispose`)
    }

    const available = existing.quantity - existing.reservedQuantity - existing.soldQuantity
    if (input.quantity > available) {
      throw new Error(`Insufficient available quantity: available ${available}`)
    }

    const disposal = await tx.batchDisposal.create({
      data: {
        batchId: id,
        quantity: input.quantity,
        reason: input.reason,
        notes: input.notes ?? null,
        disposedById: user.id,
      },
    })

    // Reconcile product-branch inventory aggregate (CAS via updatedAt),
    // mirroring the GRN/purchase and POS/sale patterns.
    if (existing.branchId) {
      const inventory = await tx.inventory.findUnique({
        where: {
          productId_branchId: { productId: existing.productId, branchId: existing.branchId },
        },
      })
      if (inventory) {
        const beforeTotal = inventory.totalQuantity
        const afterTotal = inventory.totalQuantity - input.quantity
        const afterAvailable = inventory.availableQuantity - input.quantity
        if (afterAvailable < 0) {
          throw new Error('Conflict: inventory changed concurrently, please retry')
        }

        const inventoryRes = await tx.inventory.updateMany({
          where: { id: inventory.id, updatedAt: inventory.updatedAt },
          data: { totalQuantity: afterTotal, availableQuantity: afterAvailable },
        })
        if (inventoryRes.count !== 1) {
          throw new Error('Conflict: inventory changed concurrently, please retry')
        }

        await tx.inventoryMovement.create({
          data: {
            inventoryId: inventory.id,
            type: 'WRITE_OFF',
            quantity: -input.quantity,
            quantityBefore: beforeTotal,
            quantityAfter: afterTotal,
            referenceType: 'WRITE_OFF',
            referenceId: disposal.id,
            batchId: id,
            notes: `Batch disposal: ${input.reason}${
              input.notes ? ` — ${input.notes}` : ''
            }`,
            createdById: user.id,
          },
        })
      }
    }

    const nextQuantity = existing.quantity - input.quantity

    if (nextQuantity === 0) {
      const result = await tx.batch.updateMany({
        where: { id, status: existing.status, quantity: existing.quantity },
        data: { status: 'DISPOSED', quantity: 0 },
      })
      if (result.count === 0) throw new Error('Conflict: batch state changed, please retry')

      await tx.batchStatusLog.create({
        data: {
          batchId: id,
          fromStatus: existing.status,
          toStatus: 'DISPOSED',
          reason: `Disposed (${existing.status.toLowerCase()}): ${input.notes ?? 'batch fully disposed'}`,
          changedById: user.id,
        },
      })
    } else {
      const result = await tx.batch.updateMany({
        where: { id, status: existing.status, quantity: existing.quantity },
        data: { quantity: nextQuantity },
      })
      if (result.count === 0) throw new Error('Conflict: batch state changed, please retry')
    }

    return tx.batch.findUniqueOrThrow({ where: { id }, include: detailInclude })
  })

  return toDetailItem(batch as BatchDetail)
}

// ─── Physical Storage Relocation ──────────────────────────────

export async function relocateBatchProductStorage(
  input: RelocateBatchStorageInput,
  user: AuthUser
): Promise<{ success: boolean; message: string; batch: BatchDetailItem }> {
  const { batchId, rack, shelf, box, reason } = input
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: { product: { include: { rack: true } } },
  })
  if (!batch) throw new Error('Not Found: batch')
  if (batch.branchId) await assertBranchAccess(user, batch.branchId)

  const fromRack = batch.product.rack?.code || null
  const fromShelf = batch.product.rack?.shelfNumber || null
  const fromBox = null

  const toRack = rack !== undefined ? (rack && rack.trim().length > 0 ? rack.trim().toUpperCase() : null) : fromRack
  const toShelf = shelf !== undefined ? (shelf && shelf.trim().length > 0 ? shelf.trim() : null) : fromShelf
  const toBox = box !== undefined ? (box && box.trim().length > 0 ? box.trim() : null) : fromBox

  await prisma.$transaction(async (tx) => {
    // 1. Update product storage location
    if (toRack) {
      const branchId = batch.branchId || 'default-branch'
      const existingRack = await tx.rack.findFirst({
        where: { branchId, code: toRack },
      })
      const rackId = existingRack?.id || (await tx.rack.create({
        data: {
          branchId,
          code: toRack,
          shelfNumber: toShelf || '1',
          description: `Rack ${toRack}`,
        },
      })).id

      await tx.product.update({
        where: { id: batch.productId },
        data: { rackId },
      })
    }

    // 2. Provision StorageLocation record if both rack and box exist
    if (batch.branchId && toRack && toBox) {
      await tx.storageLocation.upsert({
        where: {
          branchId_rack_shelf_box: {
            branchId: batch.branchId,
            rack: toRack,
            shelf: toShelf || 'Shelf 1',
            box: toBox,
          },
        },
        create: {
          branchId: batch.branchId,
          rack: toRack,
          shelf: toShelf || 'Shelf 1',
          box: toBox,
          type: 'GENERAL',
        },
        update: {},
      }).catch(() => {
        // Ignore if storage location unique constraint or table omitted
      })
    }

    // 3. Find or create inventory movement record for audit trail
    if (batch.branchId) {
      const inventory = await tx.inventory.findUnique({
        where: { productId_branchId: { productId: batch.productId, branchId: batch.branchId } },
      })
      if (inventory) {
        const transitionNote = `Relocated: [${[fromRack, fromShelf, fromBox].filter(Boolean).join(' > ') || 'Unassigned'}] ➔ [${[toRack, toShelf, toBox].filter(Boolean).join(' > ')}]`
        await tx.inventoryMovement.create({
          data: {
            inventoryId: inventory.id,
            type: 'TRANSFER',
            quantity: 0,
            quantityBefore: inventory.totalQuantity,
            quantityAfter: inventory.totalQuantity,
            referenceType: 'BOX_RELOCATION',
            referenceId: batch.id,
            batchId: batch.id,
            notes: [reason, transitionNote].filter(Boolean).join(' — '),
            createdById: user.id,
          },
        }).catch(() => {
          // Ignore if movement creation fails in mock
        })
      }
    }
  })

  const updated = await getBatchById(batchId, user)
  if (!updated) throw new Error('Failed to retrieve updated batch')

  return {
    success: true,
    message: `Storage updated to ${[toRack, toShelf, toBox].filter(Boolean).join(' > ')}`,
    batch: updated,
  }
}

// ─── Process Vendor Return (RTV) ──────────────────────────────

export async function processBatchVendorReturn(
  input: VendorReturnBatchInput,
  user: AuthUser
): Promise<{ success: boolean; message: string; batch: BatchDetailItem }> {
  const { batchId, quantity, reason, debitNoteNumber, notes } = input

  const batch = await prisma.$transaction(async (tx) => {
    const existing = await tx.batch.findUnique({
      where: { id: batchId },
      include: { product: true, purchase: { include: { supplier: true } } },
    })
    if (!existing) throw new Error('Not Found: batch')
    if (existing.branchId) await assertBranchAccess(user, existing.branchId)

    const available = existing.quantity - existing.reservedQuantity - existing.soldQuantity
    if (quantity > available) {
      throw new Error(`Insufficient available quantity: available ${available}, requested ${quantity}`)
    }

    const supplierName = existing.purchase?.supplier?.name || (existing.supplierRef ? `Ref: ${existing.supplierRef}` : 'Wholesaler')

    // 1. Update batch quantity or mark exhausted if 0
    const nextQty = existing.quantity - quantity
    if (nextQty === 0) {
      await tx.batch.updateMany({
        where: { id: batchId, status: existing.status, quantity: existing.quantity },
        data: { quantity: 0, status: 'EXHAUSTED' },
      })
      await tx.batchStatusLog.create({
        data: {
          batchId,
          fromStatus: existing.status,
          toStatus: 'EXHAUSTED',
          reason: `Returned to Vendor (${supplierName}): ${reason}`,
          changedById: user.id,
        },
      })
    } else {
      await tx.batch.updateMany({
        where: { id: batchId, status: existing.status, quantity: existing.quantity },
        data: { quantity: nextQty },
      })
      await tx.batchStatusLog.create({
        data: {
          batchId,
          fromStatus: existing.status,
          toStatus: existing.status,
          reason: `Returned ${quantity} units to Vendor (${supplierName}): ${reason}`,
          changedById: user.id,
        },
      })
    }

    // 2. Reconcile branch inventory & provision RETURN_OUT movement
    if (existing.branchId) {
      const inventory = await tx.inventory.findUnique({
        where: { productId_branchId: { productId: existing.productId, branchId: existing.branchId } },
      })
      if (inventory) {
        const beforeTotal = inventory.totalQuantity
        const afterTotal = inventory.totalQuantity - quantity
        const afterAvailable = inventory.availableQuantity - quantity

        await tx.inventory.update({
          where: { id: inventory.id },
          data: { totalQuantity: afterTotal, availableQuantity: afterAvailable },
        })

        const noteParts = [
          `Supplier Return (RTV) to ${supplierName}`,
          `Reason: ${reason}`,
          debitNoteNumber ? `Debit Note #${debitNoteNumber}` : null,
          notes || null,
        ].filter(Boolean).join(' — ')

        await tx.inventoryMovement.create({
          data: {
            inventoryId: inventory.id,
            type: 'RETURN_OUT',
            quantity: -quantity,
            quantityBefore: beforeTotal,
            quantityAfter: afterTotal,
            referenceType: 'RETURN_OUT',
            referenceId: debitNoteNumber || null,
            batchId,
            notes: noteParts,
            createdById: user.id,
          },
        }).catch(() => {
          // Ignore if movement creation fails in mock
        })
      }
    }

    return tx.batch.findUniqueOrThrow({ where: { id: batchId }, include: detailInclude })
  })

  return {
    success: true,
    message: `Successfully returned ${quantity} units to vendor (${batch.purchase?.supplier?.name || 'Wholesaler'})`,
    batch: toDetailItem(batch as BatchDetail),
  }
}


export {
  runMultiThreadedExpirySweep,
  spawnExpirySweepProcess,
  getSpawnedJobStatus,
  listSpawnedJobs,
  type BatchExpiryOptions,
  type BatchExpirySweepResult,
  type SpawnExecutionHandle,
  type SpawnedJobStatus,
}
