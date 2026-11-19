import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { ReportService } from '@/lib/reports/report-service'

// GET /api/reports/schedule-h?branchId=&scheduleType=H|H1|ALL&startDate=&endDate=&page=&limit=
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
        data: [],
        metrics: { totalDispensed: 0, distinctDoctors: 0, distinctPatients: 0 },
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          pages: 1,
        },
      })
    }

    const scheduleType = (searchParams.get('scheduleType') || 'ALL') as 'H' | 'H1' | 'ALL'
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const startDate = startDateParam ? new Date(startDateParam) : undefined
    const endDate = endDateParam ? new Date(endDateParam) : undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const result = await ReportService.getScheduleHRegister(
      branchId,
      { startDate, endDate, scheduleType },
      { page, limit }
    )

    return NextResponse.json({
      success: true,
      data: result.data,
      metrics: (result as any).metrics,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pages: Math.ceil(result.total / result.limit),
      },
    })
  } catch (err: any) {
    const message = err?.message || 'Failed to generate register'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      { status }
    )
  }
}
