import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/auth-helpers'
import prisma from '@/lib/db/prisma'
import { runInventoryAdminWorker } from '@/lib/inventory/inventory-admin-worker-client'

type RouteParams = { params: { id: string } }

// Zod schema for editing/modifying item inventory
const modifyItemSchema = z.object({
  name: z.string().min(1).optional(),
  packSize: z.string().optional(),
  tabsPerStrip: z.number().int().min(1).optional(),
  mrp: z.number().min(0).optional(),
  ptr: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  availableQuantity: z.number().int().min(0).optional(),
  minStockLevel: z.number().int().min(0).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  rackId: z.string().nullable().optional(),
  shelf: z.string().nullable().optional(),
  box: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
})

// ─── GET /api/inventory/:id ──────────────────────────────────
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth()

    const inventory = await prisma.inventory.findFirst({
      where: {
        OR: [{ id: params.id }, { productId: params.id }],
      },
      include: {
        product: {
          include: {
            rack: true,
            batches: { where: { status: 'ACTIVE' }, orderBy: { expiryDate: 'asc' } },
          },
        },
        branch: true,
      },
    })

    if (!inventory) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Item inventory record not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: inventory })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

// ─── PUT /api/inventory/:id (EDIT / MODIFY — STRICTLY ADMIN) ─
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth()

    // 1. Strict RBAC Enforcement: Only Admin can modify
    const roles = Array.isArray(user.roles)
      ? user.roles.map((r) => String(r).toUpperCase())
      : [String((user as any).role || '').toUpperCase()]

    const isAdmin = roles.some((r) => ['ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(r))
    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Forbidden: Modifying item inventory is strictly restricted to Admin users.',
          },
        },
        { status: 403 }
      )
    }

    // 2. Locate target inventory row and product
    const existing = await prisma.inventory.findFirst({
      where: {
        OR: [{ id: params.id }, { productId: params.id }],
      },
      include: {
        product: true,
        branch: true,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Item inventory record not found' } },
        { status: 404 }
      )
    }

    const body = (await req.json()) as unknown
    const parsed = modifyItemSchema.parse(body)

    // 3. Multi-Threaded Worker Execution
    const workerResult = await runInventoryAdminWorker({
      operation: 'MODIFY_ITEM',
      operatorUser: {
        id: user.id,
        name: user.name ?? undefined,
        roles,
      },
      itemData: {
        id: existing.id,
        productId: existing.productId,
        name: parsed.name,
        packSize: parsed.packSize,
        tabsPerStrip: parsed.tabsPerStrip,
        mrp: parsed.mrp,
        ptr: parsed.ptr,
        costPrice: parsed.costPrice,
        availableQuantity: parsed.availableQuantity,
        minStockLevel: parsed.minStockLevel,
        reorderLevel: parsed.reorderLevel,
        isActive: parsed.isActive,
      },
      currentStock: existing.availableQuantity,
      rackDetails: {
        rackId: parsed.rackId,
        shelf: parsed.shelf,
        box: parsed.box,
      },
    })

    // 4. Atomic PostgreSQL Transaction
    const updated = await prisma.$transaction(async (tx) => {
      // a. Update Product
      const productUpdate: Record<string, unknown> = {}
      if (parsed.name !== undefined) productUpdate.name = parsed.name
      if (parsed.packSize !== undefined) productUpdate.packSize = parsed.packSize
      if (parsed.tabsPerStrip !== undefined) productUpdate.tabsPerStrip = parsed.tabsPerStrip
      if (parsed.mrp !== undefined) productUpdate.mrp = parsed.mrp
      if (parsed.ptr !== undefined) productUpdate.ptr = parsed.ptr
      if (parsed.costPrice !== undefined) productUpdate.costPrice = parsed.costPrice
      if (parsed.minStockLevel !== undefined) productUpdate.minStockLevel = parsed.minStockLevel
      if (parsed.reorderLevel !== undefined) productUpdate.reorderLevel = parsed.reorderLevel
      if (parsed.rackId !== undefined) productUpdate.rackId = parsed.rackId
      if (parsed.isActive !== undefined) productUpdate.isActive = parsed.isActive

      if (Object.keys(productUpdate).length > 0) {
        await tx.product.update({
          where: { id: existing.productId },
          data: productUpdate,
        })
      }

      // b. Adjust Inventory Quantity if modified
      let updatedInv = existing
      if (parsed.availableQuantity !== undefined && parsed.availableQuantity !== existing.availableQuantity) {
        const delta = parsed.availableQuantity - existing.availableQuantity
        updatedInv = await tx.inventory.update({
          where: { id: existing.id },
          data: {
            availableQuantity: parsed.availableQuantity,
            totalQuantity: { increment: delta },
          },
          include: { product: true, branch: true },
        })

        // Also update latest active batch quantity
        const activeBatch = await tx.batch.findFirst({
          where: { productId: existing.productId, branchId: existing.branchId, status: 'ACTIVE' },
          orderBy: { expiryDate: 'desc' },
        })

        if (activeBatch) {
          await tx.batch.update({
            where: { id: activeBatch.id },
            data: {
              quantity: { increment: delta },
              ...(parsed.mrp ? { mrp: parsed.mrp } : {}),
              ...(parsed.costPrice ? { purchasePrice: parsed.costPrice } : {}),
            },
          })
        }

        // Record InventoryMovement audit log
        await tx.inventoryMovement.create({
          data: {
            inventoryId: existing.id,
            type: delta >= 0 ? 'IN' : 'OUT',
            quantity: Math.abs(delta),
            quantityBefore: existing.availableQuantity,
            quantityAfter: parsed.availableQuantity,
            referenceType: 'ADJUSTMENT',
            referenceId: `adm-${Date.now()}`,
            batchId: activeBatch?.id,
            notes: parsed.notes || `Admin Stock Override by ${user.name || user.id}`,
            createdById: user.id,
          },
        })
      }

      // c. Record AuditLog
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entity: 'Inventory',
          entityId: existing.id,
          metadata: {
            operation: 'MODIFY_ITEM',
            changes: parsed,
            merkleRoot: workerResult.merkleRoot,
          },
        },
      })

      return updatedInv
    })

    return NextResponse.json({
      success: true,
      message: 'Item inventory modified successfully by Admin',
      data: updated,
      threads: workerResult.threads,
      merkleRoot: workerResult.merkleRoot,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: err.errors[0]?.message || 'Invalid input' } },
        { status: 400 }
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message.includes('Forbidden') ? 403 : message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

// ─── DELETE /api/inventory/:id (DELETE / DEACTIVATE — STRICTLY ADMIN) ─
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth()

    // 1. Strict RBAC Enforcement: Only Admin can delete
    const roles = Array.isArray(user.roles)
      ? user.roles.map((r) => String(r).toUpperCase())
      : [String((user as any).role || '').toUpperCase()]

    const isAdmin = roles.some((r) => ['ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(r))
    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Forbidden: Deleting or removing item inventory is strictly restricted to Admin users.',
          },
        },
        { status: 403 }
      )
    }

    // 2. Locate target inventory row and product
    const existing = await prisma.inventory.findFirst({
      where: {
        OR: [{ id: params.id }, { productId: params.id }],
      },
      include: {
        product: true,
        branch: true,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Item inventory record not found' } },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(req.url)
    const reason = searchParams.get('reason') || 'Admin Inventory Removal'

    // 3. Multi-Threaded Worker Execution
    const workerResult = await runInventoryAdminWorker({
      operation: 'DELETE_ITEM',
      operatorUser: {
        id: user.id,
        name: user.name ?? undefined,
        roles,
      },
      itemData: {
        id: existing.id,
        productId: existing.productId,
        name: existing.product.name,
        availableQuantity: 0,
        isActive: false,
      },
      currentStock: existing.availableQuantity,
    })

    // 4. Atomic PostgreSQL Transaction: Safe deactivation & stock zeroing
    await prisma.$transaction(async (tx) => {
      // Deactivate product
      await tx.product.update({
        where: { id: existing.productId },
        data: { isActive: false, rackId: null },
      })

      // Zero inventory available stock
      await tx.inventory.update({
        where: { id: existing.id },
        data: { availableQuantity: 0, totalQuantity: 0 },
      })

      // Mark all batches EXHAUSTED
      await tx.batch.updateMany({
        where: { productId: existing.productId, branchId: existing.branchId },
        data: { status: 'EXHAUSTED', quantity: 0 },
      })

      // Log movement
      if (existing.availableQuantity > 0) {
        await tx.inventoryMovement.create({
          data: {
            inventoryId: existing.id,
            type: 'OUT',
            quantity: existing.availableQuantity,
            quantityBefore: existing.availableQuantity,
            quantityAfter: 0,
            referenceType: 'ADJUSTMENT',
            referenceId: `del-${Date.now()}`,
            notes: `Deleted by Admin: ${reason}`,
            createdById: user.id,
          },
        })
      }

      // Record AuditLog
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'DELETE',
          entity: 'Inventory',
          entityId: existing.id,
          metadata: {
            operation: 'DELETE_ITEM',
            reason,
            merkleRoot: workerResult.merkleRoot,
          },
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Item inventory safely deleted/deactivated by Admin',
      threads: workerResult.threads,
      merkleRoot: workerResult.merkleRoot,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message.includes('Forbidden') ? 403 : message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

