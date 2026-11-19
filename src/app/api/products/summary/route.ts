import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { getCatalogSummaryMetrics } from '@/lib/products/product-analytics-service'

// GET /api/products/summary?branchId=
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PRODUCTS_READ)

    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get('branchId') ?? undefined
    const orgId = user.isSuperAdmin ? undefined : user.organizationId || '__NO_ACCESS__'

    const data = await getCatalogSummaryMetrics(branchId, orgId)

    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
