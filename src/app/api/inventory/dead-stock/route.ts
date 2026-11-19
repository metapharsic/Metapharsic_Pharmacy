import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { getDeadStockReport } from '@/lib/inventory/inventory-analytics-service'

// GET /api/inventory/dead-stock?branchId=&thresholdDays=
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_READ)
    const { searchParams } = new URL(req.url)
    const rawBranchId = searchParams.get('branchId') || undefined
    const branchId = await resolveBranchScope(user, rawBranchId)

    const thresholdDays = parseInt(searchParams.get('thresholdDays') || '60', 10)

    const result = await getDeadStockReport({
      branchId: branchId ?? undefined,
      thresholdDays: isNaN(thresholdDays) ? 60 : thresholdDays,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status =
      message === 'Unauthorized'
        ? 401
        : message.startsWith('Forbidden')
          ? 403
          : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
