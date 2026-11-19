import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { assertBranchAccess } from '@/lib/inventory/branch-access'
import { getAutoReorderSuggestions } from '@/lib/purchases/purchase-lifecycle-service'

function errStatus(msg: string) {
  if (msg === 'Unauthorized') return 401
  if (msg.startsWith('Forbidden')) return 403
  if (msg.startsWith('Not Found')) return 404
  return 400
}

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PURCHASES_READ)
    const branchId = req.nextUrl.searchParams.get('branchId') ?? undefined
    if (branchId && branchId !== 'all') {
      await assertBranchAccess(user, branchId)
    }
    const targetDaysStr = req.nextUrl.searchParams.get('targetDays')
    const targetDays = targetDaysStr ? parseInt(targetDaysStr, 10) : 15

    const suggestions = await getAutoReorderSuggestions({
      branchId,
      targetDays,
      organizationId: user.isSuperAdmin ? undefined : user.organizationId || '__NO_ACCESS__',
    })
    return NextResponse.json({ success: true, data: suggestions })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      { status: errStatus(message) }
    )
  }
}
