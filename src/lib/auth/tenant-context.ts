import { getServerSession } from 'next-auth'

import prisma from '@/lib/db/prisma'
import { authOptions } from './auth-config'
import { getSession } from './auth-helpers'

export interface TenantContext {
  userId: string
  organizationId: string
  branchId: string | null
  isSuperAdmin: boolean
  orgBranchIds: string[]
}

/**
 * Extract and validate the tenant context for the current request / session.
 *
 * If the user's session lacks an organizationId, queries the database for the user's
 * assigned organizationId. Then resolves all active branches belonging to that organization.
 */
export async function getTenantContext(req?: Request): Promise<TenantContext | null> {
  let session = null
  try {
    session = await getSession()
  } catch {
    // In non-request or standalone execution contexts
  }
  if (!session?.user?.id) {
    try {
      session = await getServerSession(authOptions)
    } catch {
      // In non-standard environments, ignore and proceed
    }
  }

  if (!session?.user?.id) {
    return null
  }

  let organizationId = session.user.organizationId || null
  let branchId = session.user.branchId || null
  const isSuperAdmin = Boolean(
    session.user.isSuperAdmin || session.user.roles?.includes('super_admin')
  )

  if (!organizationId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true, branchId: true },
    })
    if (dbUser?.organizationId) {
      organizationId = dbUser.organizationId
    }
    if (!branchId && dbUser?.branchId) {
      branchId = dbUser.branchId
    }
  }

  // If no organizationId found
  if (!organizationId) {
    if (isSuperAdmin) {
      return {
        userId: session.user.id,
        organizationId: '',
        branchId: null,
        isSuperAdmin: true,
        orgBranchIds: [],
      }
    }
    return null
  }

  const branches = await prisma.branch.findMany({
    where: { organizationId, isActive: true },
    select: { id: true },
  })
  const orgBranchIds = branches.map((b) => b.id)

  if (branchId && !orgBranchIds.includes(branchId)) {
    branchId = null
  }

  return {
    userId: session.user.id,
    organizationId,
    branchId,
    isSuperAdmin,
    orgBranchIds,
  }
}

/**
 * Require a valid TenantContext, throwing a 401 Unauthorized Error if missing or unassociated.
 */
export async function requireTenantContext(req?: Request): Promise<TenantContext> {
  const context = await getTenantContext(req)
  if (!context || (!context.organizationId && !context.isSuperAdmin)) {
    throw new Error('Unauthorized')
  }
  return context
}

/**
 * Assert that a branch exists and strictly belongs to the specified organization.
 * Throws 403 Forbidden otherwise.
 */
export async function assertBranchBelongsToOrg(
  branchId: string,
  organizationId: string
): Promise<void> {
  if (!branchId || !organizationId) {
    throw new Error(`Forbidden: Branch '${branchId}' does not belong to organization '${organizationId}'`)
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { organizationId: true },
  })

  if (!branch || branch.organizationId !== organizationId) {
    throw new Error(`Forbidden: Branch '${branchId}' does not belong to organization '${organizationId}'`)
  }
}

/**
 * Resolve the branch scope for list and query operations.
 * If requestedBranchId is passed, asserts it belongs to tenant.organizationId and returns it.
 * If not passed, returns tenant.branchId (if set) or all tenant.orgBranchIds.
 */
export async function resolveBranchScopeForOrg(
  tenant: TenantContext,
  requestedBranchId?: string | null
): Promise<string | string[]> {
  if (requestedBranchId) {
    await assertBranchBelongsToOrg(requestedBranchId, tenant.organizationId)
    return requestedBranchId
  }
  if (tenant.branchId) {
    return tenant.branchId
  }
  return tenant.orgBranchIds
}
