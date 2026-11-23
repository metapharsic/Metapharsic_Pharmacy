import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/auth-helpers'
import { getTenantContext } from '@/lib/auth/tenant-context'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authUser = await requirePermission(PERMISSIONS.AUDIT_READ)
    const tenant = await getTenantContext(req)

    const isSuperAdmin = Boolean(
      authUser.isSuperAdmin ||
      authUser.roles?.includes('super_admin') ||
      tenant?.isSuperAdmin
    )

    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || ''
    const entity = searchParams.get('entity') || ''
    const search = searchParams.get('search') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const isExport = searchParams.get('export') === 'csv'

    const where: any = {}
    const andConditions: any[] = []

    if (!isSuperAdmin) {
      if (!tenant || (!tenant.organizationId && !tenant.branchId)) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, limit, total: 0, pages: 0 },
        })
      }

      const tenantOrgId = tenant.organizationId
      const branchIds = tenant.orgBranchIds || []
      const tenantConditions: any[] = []

      if (tenantOrgId) {
        tenantConditions.push({ user: { organizationId: tenantOrgId } })
        tenantConditions.push({ entity: 'Organization', entityId: tenantOrgId })
      }
      if (branchIds.length > 0) {
        tenantConditions.push({ entity: 'Branch', entityId: { in: branchIds } })
      }

      if (tenantConditions.length > 0) {
        andConditions.push({ OR: tenantConditions })
      }
    } else {
      const orgFilter = searchParams.get('organizationId') || searchParams.get('orgId')
      if (orgFilter && orgFilter !== 'ALL') {
        andConditions.push({
          OR: [
            { user: { organizationId: orgFilter } },
            { entity: 'Organization', entityId: orgFilter },
          ],
        })
      }
    }

    if (action && action !== 'ALL') {
      where.action = action
    }

    if (entity && entity !== 'ALL') {
      where.entity = entity
    }

    if (search) {
      andConditions.push({
        OR: [
          { entityId: { contains: search, mode: 'insensitive' } },
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
        ],
      })
    }

    if (andConditions.length > 0) {
      where.AND = andConditions
    }

    if (isExport) {
      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 1000,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      })
      return NextResponse.json({ success: true, data: logs })
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
