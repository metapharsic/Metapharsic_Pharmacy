import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requireAuth, requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { cancelSale, editSale, getSaleById } from '@/lib/sales/sales-service'

type RouteParams = { params: { id: string } }

// GET /api/sales/:id
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission(PERMISSIONS.SALES_READ)
    const userRoles = (user as { roles?: string[] }).roles ?? []
    const isAdmin = userRoles.some((r: string) =>
      ['owner', 'admin', 'super_admin'].includes(r.toLowerCase())
    )

    const scope = await resolveBranchScope(user)

    const rawSale = await getSaleById(params.id, scope)

    const sale = !isAdmin && rawSale
      ? {
          ...(rawSale as any),
          purchaseCost: undefined,
          profitAmount: undefined,
          profitPct: undefined,
          purchaseCostComplete: undefined,
          purchaseUnpricedUnits: undefined,
          items: rawSale.items?.map((it: any) => ({
            ...it,
            purchaseCost: undefined,
            profitAmount: undefined,
            profitPct: undefined,
            costBasis: undefined,
            itemBatches: it.itemBatches?.map((ib: any) => ({
              ...ib,
              batch: {
                ...ib.batch,
                purchasePrice: undefined,
              },
            })),
          })),
        }
      : rawSale

    return NextResponse.json({ success: true, data: sale })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      {
        status:
          message === 'Unauthorized'
            ? 401
            : message.startsWith('Forbidden')
              ? 403
              : message.startsWith('Not Found')
                ? 404
                : 400,
      }
    )
  }
}

// PATCH /api/sales/:id — Admin correction of sale line items & quantities
export async function PATCH(req: NextRequest, { params }: RouteParams) {
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
            message: 'Forbidden: requires permission sales:void or Admin role to edit sales',
          },
        },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))

    const { items, reason, refundCashDifference } = body
    if (!Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Items array is required' } },
        { status: 400 }
      )
    }

    const updatedSale = await editSale(
      {
        saleId: params.id,
        items,
        reason,
        refundCashDifference,
      },
      {
        id: sessionUser.id,
        branchId: sessionUser.branchId,
        permissions: sessionUser.permissions,
        roles: sessionUser.roles,
      }
    )

    return NextResponse.json({ success: true, data: updatedSale })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      {
        status:
          message === 'Unauthorized'
            ? 401
            : message.startsWith('Forbidden')
              ? 403
              : message.startsWith('Not Found')
                ? 404
                : 400,
      }
    )
  }
}

// DELETE /api/sales/:id — Admin cancellation & inventory reversal
export async function DELETE(req: NextRequest, { params }: RouteParams) {
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

    let reason = 'Sale cancelled and inventory restored by Admin'
    try {
      const url = new URL(req.url)
      const queryReason = url.searchParams.get('reason')
      if (queryReason?.trim()) {
        reason = queryReason.trim()
      } else if (req.headers.get('content-type')?.includes('application/json')) {
        const body = (await req.json().catch(() => ({}))) as { reason?: string }
        if (typeof body.reason === 'string' && body.reason.trim()) {
          reason = body.reason.trim()
        }
      }
    } catch {
      // Fallback to default reason
    }

    await cancelSale(params.id, reason, {
      id: sessionUser.id,
      branchId: sessionUser.branchId,
      permissions: sessionUser.permissions,
      roles: sessionUser.roles,
    })

    return NextResponse.json({
      success: true,
      message: 'Sale cancelled and inventory restored',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      {
        status:
          message === 'Unauthorized'
            ? 401
            : message.startsWith('Forbidden')
              ? 403
              : message.startsWith('Not Found')
                ? 404
                : 400,
      }
    )
  }
}


