import { cache as reactCache } from 'react'
import { getServerSession, type Session } from 'next-auth'

const cache = typeof reactCache === 'function' ? reactCache : (<T extends (...args: any[]) => any>(fn: T): T => fn)

import type { PermissionCode } from '@/lib/constants/permissions'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'

import { authOptions } from './auth-config'

export type AuthUser = Session['user']

/**
 * Get the current session on the server side (in API routes / Server Components)
 *
 * Memoized per request using React cache so that multiple calls to can(),
 * requireAuth(), getSession() during a single render do not trigger duplicate
 * database queries.
 */
let ambientTestUser: any = null

export function setAmbientTestUser(user: any) {
  ambientTestUser = user
}

export const getSession = cache(async (): Promise<Session | null> => {
  if (ambientTestUser) {
    return {
      user: ambientTestUser,
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as Session
  }
  let session: Session | null = null
  try {
    session = await getServerSession(authOptions)
  } catch {
    return null
  }
  if (!session?.user?.id) return null

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isActive: true, isSuperAdmin: true, organizationId: true },
  })
  if (!user || !user.isActive) return null

  return session
})

/**
 * Get the current user, throws if not authenticated
 */
export async function requireAuth(): Promise<Session['user']> {
  const session = await getSession()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  return session.user
}

/**
 * Check if the current user has a specific permission
 */
export async function can(permission: PermissionCode): Promise<boolean> {
  const session = await getSession()
  if (!session?.user) return false
  if (session.user.isSuperAdmin || session.user.roles?.includes('owner') || session.user.roles?.includes('super_admin')) return true
  return session.user.permissions.includes(permission)
}

/**
 * Require a specific permission, throws 403 if not allowed
 */
export async function requirePermission(permission: PermissionCode): Promise<Session['user']> {
  const session = await getSession()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  if (
    !session.user.isSuperAdmin &&
    !session.user.roles?.includes('owner') &&
    !session.user.roles?.includes('super_admin') &&
    !session.user.permissions.includes(permission)
  ) {
    throw new Error(`Forbidden: requires permission '${permission}'`)
  }
  return session.user
}

/**
 * Require Platform Super-Admin privileges
 */
export async function requireSuperAdmin(): Promise<Session['user']> {
  const session = await getSession()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  if (!session.user.isSuperAdmin && !session.user.roles?.includes('super_admin')) {
    throw new Error('Forbidden: requires Platform Super-Admin privileges')
  }
  return session.user
}

/**
 * Check if user has any of the given permissions
 */
export async function canAny(permissions: PermissionCode[]): Promise<boolean> {
  const session = await getSession()
  if (!session?.user) return false
  if (session.user.isSuperAdmin || session.user.roles?.includes('owner') || session.user.roles?.includes('super_admin')) return true
  return permissions.some((p) => session.user.permissions.includes(p))
}

/**
 * Client-side permission check from a session user object
 */
export function userCan(
  permissions: string[],
  permission: PermissionCode
): boolean {
  return permissions.includes(permission)
}

/**
 * Guard role assignment against privilege escalation.
 *
 * Only an actor holding roles:manage may assign arbitrary roles
 * (including owner/manager). All other actors may only assign roles
 * whose full permission set is a subset of their own permissions,
 * preventing self- or cross-escalation via the users APIs.
 */
export async function assertAssignableRoles(roleIds: string[]): Promise<void> {
  const session = await getSession()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  const actorCanManageRoles = session.user.isSuperAdmin || session.user.permissions.includes(PERMISSIONS.ROLES_MANAGE)
  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds } },
    select: {
      id: true,
      name: true,
      rolePermissions: { select: { permission: { select: { code: true } } } },
    },
  })

  const found = new Set(roles.map((r) => r.id))
  const missing = roleIds.filter((id) => !found.has(id))
  if (missing.length > 0) {
    throw new Error(`Forbidden: one or more roles do not exist`)
  }

  if (actorCanManageRoles) return

  const actorPermissions = new Set(session.user.permissions)
  for (const role of roles) {
    const rolePermissions = role.rolePermissions.map((rp) => rp.permission.code)
    const escalates = rolePermissions.some((code) => !actorPermissions.has(code))
    if (escalates) {
      throw new Error(
        `Forbidden: role '${role.name}' grants permissions you do not hold and cannot be assigned`
      )
    }
  }
}

/**
 * Require at least one of the given permissions, throws 403 if not allowed
 */
export async function requireAnyPermission(permissions: PermissionCode[]) {
  const session = await getSession()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  if (
    !session.user.isSuperAdmin &&
    !session.user.roles?.includes('owner') &&
    !session.user.roles?.includes('super_admin') &&
    !permissions.some((p) => session.user.permissions.includes(p))
  ) {
    throw new Error(`Forbidden: requires one of permissions [${permissions.join(', ')}]`)
  }
  return session.user
}
