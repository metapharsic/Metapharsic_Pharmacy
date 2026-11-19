import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db/prisma'
import { requireSuperAdmin } from '@/lib/auth/auth-helpers'

export async function GET() {
  try {
    await requireSuperAdmin()

    const users = await prisma.user.findMany({
      include: {
        organization: {
          select: { id: true, name: true, code: true, status: true },
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

    const now = new Date()

    const mappedUsers = users.map((u) => {
      const isLocked = Boolean(u.lockedUntil && u.lockedUntil > now) || u.failedLoginCount >= 5
      let accountStatus: 'ACTIVE' | 'LOCKED' | 'DEACTIVATED' = 'ACTIVE'
      if (!u.isActive) {
        accountStatus = 'DEACTIVATED'
      } else if (isLocked) {
        accountStatus = 'LOCKED'
      }

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        isActive: u.isActive,
        isSuperAdmin: u.isSuperAdmin,
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

    const targetUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 1: UNLOCK ACCOUNT
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
    // ACTION 2: LOCK ACCOUNT
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
    // ACTION 3: RESET PASSWORD
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
    // ACTION 4: TOGGLE ACTIVE STATUS
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
