import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { prisma } from '@/lib/db/prisma'
import { assertBranchAccess } from '@/lib/inventory/branch-access'
import { deleteAdjustment, updateAdjustment } from '@/lib/inventory/inventory-service'
import { updateAdjustmentSchema } from '@/lib/validations/inventory'

type RouteParams = { params: { id: string } }

// GET /api/inventory/adjustments/:id
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_READ)

    const adjustment = await prisma.stockAdjustment.findUnique({
      where: { id: params.id },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    })

    if (!adjustment) {
      return NextResponse.json(
        { success: false, error: { message: 'Adjustment not found' } },
        { status: 404 }
      )
    }

    await assertBranchAccess(user, adjustment.branchId)

    const [product, branch, batch] = await Promise.all([
      prisma.product.findUnique({
        where: { id: adjustment.productId },
        select: {
          id: true,
          name: true,
          sku: true,
          rack: true,
          mrp: true,
          costPrice: true,
        },
      }),
      prisma.branch.findUnique({
        where: { id: adjustment.branchId },
        select: { id: true, name: true, code: true },
      }),
      adjustment.batchId
        ? prisma.batch.findUnique({
            where: { id: adjustment.batchId },
            select: {
              id: true,
              batchNumber: true,
              expiryDate: true,
              purchasePrice: true,
              mrp: true,
              quantity: true,
              supplierRef: true, purchase: { select: { supplier: { select: { id: true, name: true, phone: true } } } },
            },
          })
        : null,
    ])

    const unitCost = batch?.purchasePrice != null
      ? Number(batch.purchasePrice)
      : (product?.costPrice != null ? Number(product.costPrice) : Number(product?.mrp || 0) * 0.7)
    const unitMrp = batch?.mrp != null ? Number(batch.mrp) : Number(product?.mrp || 0)

    const costImpact = Math.round(adjustment.quantity * unitCost * 100) / 100
    const mrpImpact = Math.round(adjustment.quantity * unitMrp * 100) / 100

    return NextResponse.json({
      success: true,
      data: {
        ...adjustment,
        product,
        branch,
        batch,
        costImpact,
        mrpImpact,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { message } }, { status })
  }
}

// PATCH / PUT /api/inventory/adjustments/:id
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_ADJUST)

    const body: unknown = await req.json()
    const data = updateAdjustmentSchema.parse(body)

    const adjustment = await updateAdjustment(params.id, data, user)

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entity: 'StockAdjustment',
        entityId: adjustment.id,
        newData: {
          quantity: adjustment.quantity,
          adjustmentType: adjustment.adjustmentType,
          reason: adjustment.reason,
          notes: adjustment.notes,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: adjustment,
      message: 'Stock adjustment updated successfully',
    })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION',
            message: err.errors[0]?.message ?? 'Invalid input',
            issues: err.flatten(),
          },
        },
        { status: 400 }
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status =
      message === 'Unauthorized'
        ? 401
        : message.startsWith('Forbidden')
          ? 403
          : message.startsWith('Not Found')
            ? 404
            : message.startsWith('Conflict')
              ? 409
              : 500
    return NextResponse.json({ success: false, error: { message } }, { status })
  }
}

// DELETE /api/inventory/adjustments/:id
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_ADJUST)

    const result = await deleteAdjustment(params.id, user)

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entity: 'StockAdjustment',
        entityId: params.id,
        oldData: { id: params.id },
      },
    })

    return NextResponse.json({
      success: result.success,
      id: result.id,
      message: result.message,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status =
      message === 'Unauthorized'
        ? 401
        : message.startsWith('Forbidden')
          ? 403
          : message.startsWith('Not Found')
            ? 404
            : 500
    return NextResponse.json({ success: false, error: { message } }, { status })
  }
}
