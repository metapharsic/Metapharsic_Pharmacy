import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db/prisma'
import { requireSuperAdmin } from '@/lib/auth/auth-helpers'

// System roles mapping for auto-provisioning
const SOVEREIGN_SYSTEM_ROLES = [
  { name: 'super_admin', displayName: 'Platform SuperAdmin', description: 'Global sovereign command & private cloud administration' },
  { name: 'territory_admin', displayName: 'Sovereign Territory Administrator', description: 'Dedicated in-country private cloud governor' },
  { name: 'compliance_officer', displayName: 'Regional Compliance Officer', description: 'NDMO, PDPL, ODP, NHRA & data residency compliance auditor' },
  { name: 'tax_auditor', displayName: 'Tax & Regulatory Auditor', description: 'ZATCA Phase 2 Fatoora clearance & cryptographic audit trails' },
  { name: 'chief_pharmacist', displayName: 'Chief Pharmacist', description: 'Controlled drug schedules, narcotics ledger & clinical oversight' },
  { name: 'owner', displayName: 'Pharmacy Owner / Director', description: 'Full commercial & organizational authority' },
  { name: 'manager', displayName: 'Store General Manager', description: 'Dispensary branch management & shift control' },
  { name: 'pharmacist', displayName: 'Pharmacist', description: 'Dispensing chemist & prescription validation' },
  { name: 'cashier', displayName: 'Cashier', description: 'Point of sale clearance & customer payments' },
]

export async function GET() {
  try {
    await requireSuperAdmin()

    // 1. Fetch all users with relations
    const users = await prisma.user.findMany({
      include: {
        organization: {
          select: { id: true, name: true, code: true, status: true, country: true, currency: true },
        },
        branch: {
          select: { id: true, name: true, city: true, state: true },
        },
        userRoles: {
          include: {
            role: { select: { id: true, name: true, displayName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // 2. Fetch all governance settings for users
    const governanceSettings = await prisma.systemSetting.findMany({
      where: { category: 'USER_GOVERNANCE' },
    })

    const governanceMap = new Map<string, any>()
    for (const setting of governanceSettings) {
      try {
        governanceMap.set(setting.key, JSON.parse(setting.value))
      } catch {
        // ignore parse error
      }
    }

    const now = new Date()

    const mappedUsers = users.map((u) => {
      const isLocked = Boolean(u.lockedUntil && u.lockedUntil > now) || u.failedLoginCount >= 5
      let accountStatus: 'ACTIVE' | 'LOCKED' | 'DEACTIVATED' = 'ACTIVE'
      if (!u.isActive) {
        accountStatus = 'DEACTIVATED'
      } else if (isLocked) {
        accountStatus = 'LOCKED'
      }

      const gov = governanceMap.get(u.id)

      // Fallback default territories based on user status
      const defaultTerritories = u.isSuperAdmin
        ? ['SA', 'OM', 'BH', 'QA', 'MV', 'IN']
        : [u.organization?.currency === 'SAR' ? 'SA' : u.organization?.country === 'Saudi Arabia' ? 'SA' : 'IN']

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        isActive: u.isActive,
        isSuperAdmin: u.isSuperAdmin,
        mfaEnabled: Boolean(u.mfaEnabled),
        mustChangePassword: Boolean(u.mustChangePassword),
        accountStatus,
        failedLoginCount: u.failedLoginCount,
        lockedUntil: u.lockedUntil ? u.lockedUntil.toISOString() : null,
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        createdAt: u.createdAt.toISOString(),
        organization: u.organization,
        branch: u.branch,
        roles: u.userRoles.map((ur) => ({
          name: ur.role.name,
          displayName: ur.role.displayName || ur.role.name,
        })),
        territories: gov?.territories || defaultTerritories,
        assignedPrivateNode: gov?.assignedPrivateNode || 'SA',
        ipRestrictionEnabled: Boolean(gov?.ipRestrictionEnabled),
      }
    })

    return NextResponse.json({
      success: true,
      users: mappedUsers,
    })
  } catch (error: any) {
    const isAuth = error?.message === 'Unauthorized'
    const isForbidden = error?.message?.includes('Forbidden') || error?.message?.includes('privilege')

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch users',
      },
      { status: isAuth ? 401 : isForbidden ? 403 : 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const adminUser = await requireSuperAdmin()
    const body = await req.json()
    const { action, userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
      },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 1: ASSIGN ROLES, SOVEREIGN MATRIX & PRIVATE CLOUD NODE
    // ─────────────────────────────────────────────────────────────
    if (action === 'assign-governance') {
      const {
        roleNames,
        territories,
        assignedPrivateNode,
        isSuperAdmin,
        mfaEnabled,
        mustChangePassword,
        ipRestrictionEnabled,
      } = body

      const targetRoleNames: string[] = Array.isArray(roleNames) && roleNames.length > 0 ? roleNames : ['pharmacist']

      // Ensure system roles exist in DB
      for (const roleDef of SOVEREIGN_SYSTEM_ROLES) {
        if (targetRoleNames.includes(roleDef.name)) {
          await prisma.role.upsert({
            where: { name: roleDef.name },
            create: {
              name: roleDef.name,
              displayName: roleDef.displayName,
              description: roleDef.description,
              isSystem: true,
            },
            update: {
              displayName: roleDef.displayName,
              description: roleDef.description,
            },
          })
        }
      }

      // Fetch existing role records to get their IDs
      const dbRoles = await prisma.role.findMany({
        where: { name: { in: targetRoleNames } },
      })

      // Update User roles in junction table
      await prisma.userRole.deleteMany({ where: { userId } })
      if (dbRoles.length > 0) {
        await prisma.userRole.createMany({
          data: dbRoles.map((r) => ({
            userId,
            roleId: r.id,
          })),
        })
      }

      // Update User table attributes
      const newIsSuperAdmin = Boolean(isSuperAdmin || targetRoleNames.includes('super_admin'))
      await prisma.user.update({
        where: { id: userId },
        data: {
          isSuperAdmin: newIsSuperAdmin,
          mfaEnabled: mfaEnabled !== undefined ? Boolean(mfaEnabled) : undefined,
          mustChangePassword: mustChangePassword !== undefined ? Boolean(mustChangePassword) : undefined,
        },
      })

      // Store sovereign territory matrix and assigned node in SystemSetting
      const govPayload = {
        territories: Array.isArray(territories) && territories.length > 0 ? territories : ['SA'],
        assignedPrivateNode: assignedPrivateNode || 'SA',
        ipRestrictionEnabled: Boolean(ipRestrictionEnabled),
        assignedBy: adminUser.email,
        assignedAt: new Date().toISOString(),
      }

      await prisma.systemSetting.upsert({
        where: {
          category_key: {
            category: 'USER_GOVERNANCE',
            key: userId,
          },
        },
        create: {
          category: 'USER_GOVERNANCE',
          key: userId,
          value: JSON.stringify(govPayload),
          dataType: 'json',
          label: `Governance Policy for User ${targetUser.email}`,
        },
        update: {
          value: JSON.stringify(govPayload),
          updatedAt: new Date(),
        },
      })

      // Audit Log entry
      await prisma.auditLog.create({
        data: {
          userId: adminUser.id,
          action: 'USER_GOVERNANCE_ASSIGNED',
          entity: 'User',
          entityId: userId,
          newData: {
            targetUser: targetUser.email,
            roles: targetRoleNames,
            territories: govPayload.territories,
            assignedPrivateNode: govPayload.assignedPrivateNode,
            isSuperAdmin: newIsSuperAdmin,
            mfaEnabled,
            ipRestrictionEnabled,
            adminEmail: adminUser.email,
            timestamp: new Date().toISOString(),
          },
        },
      })

      return NextResponse.json({
        success: true,
        message: `Roles & sovereign territory matrix successfully deployed for ${targetUser.name} (${targetUser.email}).`,
        roles: dbRoles.map((r) => ({ name: r.name, displayName: r.displayName })),
        territories: govPayload.territories,
        assignedPrivateNode: govPayload.assignedPrivateNode,
      })
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 2: UNLOCK ACCOUNT
    // ─────────────────────────────────────────────────────────────
    if (action === 'unlock') {
      await prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
          isActive: true,
        },
      })

      await prisma.auditLog.create({
        data: {
          userId: adminUser.id,
          action: 'ACCOUNT_UNLOCKED',
          entity: 'User',
          entityId: userId,
          newData: { unlockedUser: targetUser.email },
        },
      })

      return NextResponse.json({
        success: true,
        message: `Account for ${targetUser.email} has been unlocked successfully.`,
      })
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 3: LOCK ACCOUNT
    // ─────────────────────────────────────────────────────────────
    if (action === 'lock') {
      const lockDuration = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours lock
      await prisma.user.update({
        where: { id: userId },
        data: {
          lockedUntil: lockDuration,
          failedLoginCount: 5,
        },
      })

      await prisma.auditLog.create({
        data: {
          userId: adminUser.id,
          action: 'ACCOUNT_LOCKED',
          entity: 'User',
          entityId: userId,
          newData: { lockedUser: targetUser.email, lockedUntil: lockDuration.toISOString() },
        },
      })

      return NextResponse.json({
        success: true,
        message: `Account for ${targetUser.email} has been locked for 24 hours.`,
      })
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 4: RESET PASSWORD
    // ─────────────────────────────────────────────────────────────
    if (action === 'reset-password') {
      const { newPassword } = body
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12)
      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          failedLoginCount: 0,
          lockedUntil: null,
          isActive: true,
        },
      })

      await prisma.auditLog.create({
        data: {
          userId: adminUser.id,
          action: 'PASSWORD_RESET',
          entity: 'User',
          entityId: userId,
          newData: { resetUser: targetUser.email },
        },
      })

      return NextResponse.json({
        success: true,
        message: `Password for ${targetUser.email} reset successfully to: ${newPassword}`,
      })
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 5: TOGGLE ACTIVE STATUS
    // ─────────────────────────────────────────────────────────────
    if (action === 'toggle-active') {
      const newActive = !targetUser.isActive
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: newActive },
      })

      await prisma.auditLog.create({
        data: {
          userId: adminUser.id,
          action: newActive ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED',
          entity: 'User',
          entityId: userId,
        },
      })

      return NextResponse.json({
        success: true,
        message: `Account for ${targetUser.email} marked as ${newActive ? 'Active' : 'Deactivated'}.`,
        isActive: newActive,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    const isAuth = error?.message === 'Unauthorized'
    const isForbidden = error?.message?.includes('Forbidden') || error?.message?.includes('privilege')

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Operation failed',
      },
      { status: isAuth ? 401 : isForbidden ? 403 : 500 }
    )
  }
}
