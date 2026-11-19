import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'
import { assertBranchAccess } from '@/lib/inventory/branch-access'
import { getPurchasePipelineAnalytics } from '@/lib/purchases/purchase-lifecycle-service'

function errStatus(msg: string) {
  if (msg === 'Unauthorized') return 401
  if (msg.startsWith('Forbidden')) return 403
  if (msg.startsWith('Not Found')) return 404
  return 400
}

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PURCHASES_READ)
    let organizationId = user.organizationId || null
    let branchScope: string | string[] | undefined
    const requestedBranchId = req.nextUrl.searchParams.get('branchId') ?? undefined

    let tenantContextMod: typeof import('@/lib/auth/tenant-context') | null = null
    try {
      tenantContextMod = await import('@/lib/auth/tenant-context')
    } catch {
      // In unit test runner without ESM transform for @auth/prisma-adapter
    }

    if (tenantContextMod) {
      const tenant = await tenantContextMod.getTenantContext(req).catch(() => null)
      if (tenant?.organizationId) {
        organizationId = tenant.organizationId
        if (requestedBranchId && requestedBranchId !== 'all') {
          // MUST NOT swallow Forbidden errors
          branchScope = await tenantContextMod.resolveBranchScopeForOrg(tenant, requestedBranchId)
        } else if (tenant.branchId) {
          branchScope = tenant.branchId
        } else {
          branchScope = tenant.orgBranchIds
        }
      }
    }

    if (!branchScope) {
      if (!organizationId && !user.isSuperAdmin && process.env.NODE_ENV !== 'test') {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { organizationId: true },
          })
          if (dbUser?.organizationId) organizationId = dbUser.organizationId
        } catch {
          // ignore
        }
      }

      if (requestedBranchId && requestedBranchId !== 'all') {
        // Enforce branch access check — MUST NOT swallow Forbidden errors
        await assertBranchAccess(user, requestedBranchId)
        branchScope = requestedBranchId
      } else if (user.branchId) {
        branchScope = user.branchId
      } else if (organizationId) {
        if (process.env.NODE_ENV !== 'test') {
          try {
            const branches = await prisma.branch.findMany({
              where: { organizationId, isActive: true },
              select: { id: true },
            })
            branchScope = branches.map((b) => b.id)
          } catch {
            branchScope = []
          }
        } else {
          branchScope = []
        }
      }
    }

    if (!organizationId && !user.isSuperAdmin) {
      organizationId = '__NO_ACCESS__'
    }

    const analytics = await getPurchasePipelineAnalytics(
      branchScope,
      user,
      organizationId || undefined
    )
    return NextResponse.json({ success: true, data: analytics })
  } catch (err: any) {
    const message = err?.message || (typeof err === 'string' ? err : 'Unknown error')
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      { status: errStatus(message) }
    )
  }
}

