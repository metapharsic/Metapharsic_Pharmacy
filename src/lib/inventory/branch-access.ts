// ─────────────────────────────────────────────────────────────
// Inventory — Branch Access Control
// ─────────────────────────────────────────────────────────────
import type { Prisma } from '@prisma/client'

import prisma from '@/lib/db/prisma'

export interface AuthUser {
  id: string
  branchId: string | null
  organizationId?: string | null
  isSuperAdmin?: boolean
}

/**
 * Server-side branch authorization.
 *
 * A user is allowed to access branches that belong to the SAME organization
 * as their own branch/organization. Platform Super-Admins have cross-branch access.
 *
 * Throws `Error('Forbidden: ...')` → 403, `Error('Not Found: branch')` → 404.
 */
export async function assertBranchAccess(user: AuthUser, branchId: string): Promise<void> {
  if (user.isSuperAdmin) return

  const targetBranch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { organizationId: true },
  })

  if (!targetBranch) {
    throw new Error('Not Found: branch')
  }

  let userOrgId = user.organizationId
  if (!userOrgId && user.branchId) {
    const userBranch = await prisma.branch.findUnique({
      where: { id: user.branchId },
      select: { organizationId: true },
    })
    userOrgId = userBranch?.organizationId || null
  }

  if (!userOrgId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true, isSuperAdmin: true },
    })
    if (dbUser?.isSuperAdmin) return
    userOrgId = dbUser?.organizationId || null
  }

  if (!userOrgId || targetBranch.organizationId !== userOrgId) {
    throw new Error(`Forbidden: no access to branch '${branchId}'`)
  }
}

/**
 * Resolve the effective branch scope for a list request.
 *
 * - Explicit `requestedBranchId` → validated against the user, returned.
 * - No explicit branch and the user HAS a branch → defaults to the user's
 *   own branch (tightest secure default).
 * - No explicit branch and the user is branchless → null (requires org-scoped filtering downstream).
 */
export async function resolveBranchScope(
  user: AuthUser,
  requestedBranchId?: string
): Promise<string | null> {
  if (requestedBranchId) {
    await assertBranchAccess(user, requestedBranchId)
    return requestedBranchId
  }
  return user.branchId
}

/**
 * Branches the current user is allowed to see (for branch filters).
 * Users see all active branches belonging to their organization.
 */
export async function getAccessibleBranches(
  user: AuthUser
): Promise<{ id: string; name: string; code: string | null }[]> {
  const select = { id: true, name: true, code: true } as const
  const orderBy: Prisma.BranchOrderByWithRelationInput[] = [
    { isHeadOffice: 'desc' },
    { name: 'asc' },
  ]

  let userOrgId = user.organizationId
  if (!userOrgId && user.branchId) {
    const userBranch = await prisma.branch.findUnique({
      where: { id: user.branchId },
      select: { organizationId: true },
    })
    userOrgId = userBranch?.organizationId || null
  }

  if (!userOrgId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true, isSuperAdmin: true },
    })
    if (dbUser?.isSuperAdmin || user.isSuperAdmin) {
      return prisma.branch.findMany({
        where: { isActive: true },
        select,
        orderBy,
      })
    }
    userOrgId = dbUser?.organizationId || null
  }

  if (!userOrgId) {
    if (user.isSuperAdmin) {
      return prisma.branch.findMany({
        where: { isActive: true },
        select,
        orderBy,
      })
    }
    return []
  }

  return prisma.branch.findMany({
    where: { organizationId: userOrgId, isActive: true },
    select,
    orderBy,
  })
}
