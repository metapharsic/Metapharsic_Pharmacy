import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requireAuth } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { assertBranchAccess } from '@/lib/inventory/branch-access'
import { getAgencyPurchases, lookupBatchPurchaseHistory } from '@/lib/purchases/agency-purchase-service'

function errStatus(msg: string) {
  if (msg === 'Unauthorized') return 401
  if (msg.startsWith('Forbidden')) return 403
  if (msg.startsWith('Not Found')) return 404
  return 500
}

// GET /api/purchases/agency?search=&supplierId=&branchId=&batchNumber=
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const canAccess =
      user.permissions.includes(PERMISSIONS.PURCHASES_READ) ||
      user.permissions.includes(PERMISSIONS.FINANCE_READ)

    if (!canAccess) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    const { searchParams } = req.nextUrl
    const branchId = searchParams.get('branchId') || undefined
    if (branchId && branchId !== 'all') {
      await assertBranchAccess(user, branchId)
    }

    const organizationId = user.isSuperAdmin ? undefined : user.organizationId || '__NO_ACCESS__'
    const batchNumber = searchParams.get('batchNumber')?.trim()

    if (batchNumber) {
      const history = await lookupBatchPurchaseHistory(batchNumber, organizationId)
      return NextResponse.json({ success: true, data: history })
    }

    const search = searchParams.get('search') || undefined
    const supplierId = searchParams.get('supplierId') || undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    const agencies = await getAgencyPurchases(
      {
        search,
        supplierId,
        branchId,
        startDate,
        endDate,
        organizationId,
      },
      organizationId
    )

    return NextResponse.json({ success: true, data: agencies })
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Failed to fetch agency purchases'
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      { status: errStatus(message) }
    )
  }
}
