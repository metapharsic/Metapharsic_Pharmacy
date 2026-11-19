import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { assertBranchAccess } from '@/lib/inventory/branch-access'
import {
  createPurchaseRequisition,
  listPurchaseRequisitions,
} from '@/lib/purchases/purchase-lifecycle-service'

const createRequisitionSchema = z.object({
  branchId: z.string().min(1, 'Branch is required'),
  productId: z.string().min(1, 'Product is required'),
  requiredQuantity: z.coerce.number().int().positive('Quantity must be positive'),
  requiredByDate: z.string().min(1, 'Required-by date is required'),
  reason: z.string().optional().default('LOW_STOCK'),
  priority: z.enum(['NORMAL', 'URGENT', 'EMERGENCY']).optional().default('NORMAL'),
  notes: z.string().max(1000).optional(),
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
    const status = req.nextUrl.searchParams.get('status') ?? undefined
    const priority = req.nextUrl.searchParams.get('priority') ?? undefined
    const search = req.nextUrl.searchParams.get('search') ?? undefined

    const requisitions = await listPurchaseRequisitions({
      branchId,
      status,
      priority,
      search,
      organizationId: user.isSuperAdmin ? undefined : user.organizationId || '__NO_ACCESS__',
    })

    return NextResponse.json({ success: true, data: requisitions })
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
    const body: unknown = await req.json()
    const data = createRequisitionSchema.parse(body)

    const requisition = await createPurchaseRequisition(data, user)
    return NextResponse.json({ success: true, data: requisition }, { status: 201 })
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
