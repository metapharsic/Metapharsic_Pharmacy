import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

import { assertBranchBelongsToOrg, requireTenantContext } from '@/lib/auth/tenant-context'
import { fetchSidebarAggregates, getDbWorkerPool } from '@/lib/db/db-worker-pool'

export async function GET(req: Request) {
  try {
    const tenant = await requireTenantContext(req)
    const { searchParams } = new URL(req.url)
    const requestedBranchId = searchParams.get('branchId')

    let branchId: string | undefined = undefined

    if (requestedBranchId) {
      if (tenant.organizationId) {
        await assertBranchBelongsToOrg(requestedBranchId, tenant.organizationId)
      }
      branchId = requestedBranchId
    } else if (tenant.branchId) {
      branchId = tenant.branchId
    }

    const mode = searchParams.get('mode') ?? 'aggregates'

    if (mode === 'detailed') {
      const pool = getDbWorkerPool()
      const report = await pool.executeParallelFetch(tenant.organizationId, branchId)
      return NextResponse.json({
        success: true,
        report,
      })
    }

    const stats = await fetchSidebarAggregates(tenant.organizationId, branchId)
    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (message.startsWith('Forbidden')) {
      return NextResponse.json({ success: false, error: message }, { status: 403 })
    }

    console.error('Error in /api/db/parallel-fetch:', err)
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}
