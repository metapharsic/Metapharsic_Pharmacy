import { NextResponse, type NextRequest } from 'next/server'
import { z, ZodError } from 'zod'

import { requireAuth } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { cancelSale } from '@/lib/sales/sales-service'

const cancelSaleSchema = z.object({
  reason: z.string().min(3, 'A cancellation reason (at least 3 characters) is required'),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionUser = await requireAuth()
    const userRoles = (sessionUser as { roles?: string[] }).roles ?? []
    const userPermissions = sessionUser.permissions ?? []
    const isAuthorized =
      userPermissions.includes(PERMISSIONS.SALES_VOID) ||
      userRoles.some((r: string) => ['admin', 'owner', 'manager', 'super_admin'].includes(r.toLowerCase()))

    if (!isAuthorized) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Forbidden: requires permission sales:void or Admin role to cancel sales',
          },
        },
        { status: 403 }
      )
    }

    const body: unknown = await req.json()
    const { reason } = cancelSaleSchema.parse(body)

    await cancelSale(params.id, reason, {
      id: sessionUser.id,
      branchId: sessionUser.branchId,
      permissions: sessionUser.permissions,
      roles: sessionUser.roles,
    })

    return NextResponse.json({
      success: true,
      message: 'Sale successfully cancelled. Stock and batch quantities restored.',
    })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION',
            message: err.errors[0]?.message ?? 'Invalid cancellation data',
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
            : 400
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
