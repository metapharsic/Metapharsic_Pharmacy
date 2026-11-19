import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { getInventorySummary } from '@/lib/inventory/inventory-service'

// GET /api/inventory/summary?branchId=
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_READ)
    const { searchParams } = new URL(req.url)
    const rawBranchId = searchParams.get('branchId') || undefined
    const branchId = await resolveBranchScope(user, rawBranchId)

    const categoryId = searchParams.get("categoryId") || undefined
    const orgFilter = user.isSuperAdmin ? undefined : (user.organizationId || '__NO_ACCESS__')
    const summary = await getInventorySummary(branchId ?? undefined, categoryId, orgFilter)
    return NextResponse.json({ success: true, data: summary })
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
