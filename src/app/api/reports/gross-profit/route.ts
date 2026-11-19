import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { ReportService } from '@/lib/reports/report-service'

// GET /api/reports/gross-profit?branchId=&startDate=&endDate=
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.REPORTS_SALES)
    let orgId = user.organizationId || undefined

    try {
      const { getTenantContext } = await import('@/lib/auth/tenant-context')
      const tenant = await getTenantContext(req)
      if (tenant?.organizationId) orgId = tenant.organizationId
    } catch {
      // In mocked test environment fallback
    }
    const { searchParams } = req.nextUrl

    const requestedBranchId = searchParams.get('branchId') || undefined
    let branchId = await resolveBranchScope(user, requestedBranchId)

    if (!branchId && orgId) {
      const defaultBranch = await prisma.branch.findFirst({
        where: { organizationId: orgId, isActive: true },
        select: { id: true },
      })
      branchId = defaultBranch?.id || null
    }

    if (!branchId) {
      return NextResponse.json({
        success: true,
        data: {
          totalRevenue: 0,
          totalCost: 0,
          grossProfit: 0,
          marginPercentage: 0,
          items: [],
        },
      })
    }

    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date()

    const result = await ReportService.getGrossProfitReport(branchId, { startDate, endDate })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    const message = err?.message || 'Failed to generate gross profit report'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      { status }
    )
  }
}
