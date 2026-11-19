import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { assertBranchAccess } from '@/lib/inventory/branch-access'
import {
  getLowStockCandidates,
  generateLowStockPurchaseOrders,
} from '@/lib/purchases/auto-po-service'

const generateAutoPoSchema = z.object({
  branchId: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        branchId: z.string().min(1),
        supplierId: z.string().min(1),
        orderedQuantity: z.coerce.number().int().positive(),
        unitCost: z.coerce.number().min(0).optional(),
      })
    )
    .optional(),
})

function errStatus(msg: string) {
  if (msg === 'Unauthorized') return 401
  if (msg.startsWith('Forbidden')) return 403
  if (msg.startsWith('Not Found')) return 404
  if (msg.startsWith('Conflict')) return 409
  return 400
}

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PURCHASES_READ)
    const branchId = req.nextUrl.searchParams.get('branchId') ?? undefined
    if (branchId && branchId !== 'all') {
      await assertBranchAccess(user, branchId)
    }
    const candidates = await getLowStockCandidates(
      branchId,
      user.isSuperAdmin ? undefined : user.organizationId || '__NO_ACCESS__'
    )

    return NextResponse.json({
      success: true,
      data: {
        candidates,
        summary: {
          totalCandidates: candidates.length,
          requiringPo: candidates.filter((c) => !c.hasPendingPo).length,
          alreadyPending: candidates.filter((c) => c.hasPendingPo).length,
          uniqueSuppliers: new Set(
            candidates.map((c) => c.suggestedSupplierId).filter(Boolean)
          ).size,
        },
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      { status: errStatus(message) }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PURCHASES_CREATE)
    const body: unknown = await req.json().catch(() => ({}))
    const parsed = generateAutoPoSchema.parse(body)
    if (parsed.branchId && parsed.branchId !== 'all') {
      await assertBranchAccess(user, parsed.branchId)
    }

    const result = await generateLowStockPurchaseOrders(
      {
        branchId: parsed.branchId,
        items: parsed.items,
      },
      user
    )

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        data: result.purchases,
      },
      { status: 201 }
    )
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
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      { status: errStatus(message) }
    )
  }
}
