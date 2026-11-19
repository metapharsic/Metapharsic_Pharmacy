import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { getMovements } from '@/lib/inventory/inventory-service'
import { movementListQuerySchema } from '@/lib/validations/inventory'

// GET /api/inventory/movements?page=&limit=&search=&branchId=&productId=&type=&supplierId=&rack=&box=&fefoStatus=&deadStockOnly=
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_READ)

    const { searchParams } = new URL(req.url)
    const query = movementListQuerySchema.parse(Object.fromEntries(searchParams))
    const branchId = await resolveBranchScope(user, query.branchId)

    const result = await getMovements({
      page: query.page,
      limit: query.limit,
      search: query.search,
      branchId: branchId ?? undefined,
      productId: query.productId,
      categoryId: query.categoryId,
      supplierId: query.supplierId,
      rack: query.rack,
      box: query.box,
      type: query.type,
      fefoStatus: query.fefoStatus,
      deadStockOnly: query.deadStockOnly,
    })
    return NextResponse.json({ success: true, ...result })
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
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

// POST /api/inventory/movements — Record stock movement / box relocation / vendor return / write-off
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_ADJUST)
    const body = await req.json()
    const { recordMovementSchema } = await import('@/lib/validations/inventory')
    const { recordStockMovement } = await import('@/lib/inventory/inventory-service')

    const input = recordMovementSchema.parse(body)
    await resolveBranchScope(user, input.branchId)

    const movement = await recordStockMovement(input, user.id)

    return NextResponse.json({ success: true, data: movement }, { status: 201 })
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
            : message.startsWith('Insufficient stock')
              ? 400
              : message.startsWith('Cannot adjust below zero')
                ? 400
                : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

