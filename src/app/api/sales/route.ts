import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { assertPeriodOpen } from '@/lib/finance/period-lock-service'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { createSale, listSales } from '@/lib/sales/sales-service'
import { syncSaleToTally } from '@/lib/tally/tally-sync-service'
import { createSaleSchema, saleListQuerySchema } from '@/lib/validations/sale'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/sales?page=&limit=&search=&branchId=&status=&paymentStatus=
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.SALES_READ)
    const userRoles = (user as { roles?: string[] }).roles ?? []
    const isAdmin = userRoles.some((r: string) =>
      ['owner', 'admin', 'super_admin'].includes(r.toLowerCase())
    )

    const query = saleListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))

    const scope = await resolveBranchScope(user, query.branchId)
    const result = await listSales(query, scope)

    const data = !isAdmin
      ? (result.data as any[]).map((s) => ({
          ...s,
          purchaseCost: undefined,
          profitAmount: undefined,
          profitPct: undefined,
          purchaseCostComplete: undefined,
          purchaseUnpricedUnits: undefined,
          items: s.items?.map((it: any) => ({
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
        }))
      : result.data

    const summary = !isAdmin
      ? {
          billsCount: result.summary.billsCount,
          salesValue: result.summary.salesValue,
          amountReceived: result.summary.amountReceived,
          outstanding: result.summary.outstanding,
        }
      : result.summary

    return NextResponse.json({
      success: true,
      data,
      pagination: result.pagination,
      summary,
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
    return NextResponse.json(
      {
        success: false,
        error: { code: 'ERROR', message },
      },
      {
        status:
          message === 'Unauthorized'
            ? 401
            : message.startsWith('Forbidden')
              ? 403
              : message.startsWith('Not Found')
                ? 404
                : message.startsWith('Conflict')
                  ? 409
                  : 400,
      }
    )
  }
}

// POST /api/sales
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.SALES_CREATE)

    const body: unknown = await req.json()
    const data = createSaleSchema.parse(body)

    // Enforce Tally/Marg period locking
    await assertPeriodOpen(new Date(), user.roles || [])

    const sale = await createSale(data, user)

    // Non-blocking real-time auto-sync to Tally ERP 9 / TallyPrime
    let tallySync: { status: string; message?: string } = { status: 'OFFLINE' }
    try {
      const syncResult = await syncSaleToTally(sale.id)
      tallySync = {
        status: syncResult.status,
        message: syncResult.errorMessage || `Synced to Tally (${syncResult.createdCount} voucher)`,
      }
    } catch (tallyErr) {
      console.warn('Tally auto-sync exception:', tallyErr)
    }

    return NextResponse.json({ success: true, data: sale, tallySync }, { status: 201 })
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
      { success: false, error: { code: message.startsWith('PERIOD_LOCKED') ? 'PERIOD_LOCKED' : 'ERROR', message } },
      {
        status:
          message === 'Unauthorized'
            ? 401
            : message.startsWith('Forbidden') || message.startsWith('PERIOD_LOCKED')
              ? 403
              : message.startsWith('Not Found')
                ? 404
                : message.startsWith('Insufficient')
                  ? 400
                  : message.startsWith('Conflict')
                    ? 409
                    : 400,
      }
    )
  }
}
