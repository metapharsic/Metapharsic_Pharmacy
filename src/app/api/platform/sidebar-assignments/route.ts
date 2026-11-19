import { NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { requireSuperAdmin } from '@/lib/auth/auth-helpers'
import {
  ALL_SIDEBAR_MODULES,
  ROLE_PRESETS,
  getUserSidebarModules,
  saveUserSidebarModules,
  resetUserSidebarModules,
} from '@/lib/platform/sidebar-assignment-service'

export async function GET(req: Request) {
  try {
    await requireSuperAdmin()
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { userRoles: { include: { role: true } } },
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const roleNames = user.userRoles.map((r) => r.role.name)
      const assignment = await getUserSidebarModules(user.id, roleNames)

      return NextResponse.json({
        success: true,
        userId: user.id,
        userEmail: user.email,
        roles: roleNames,
        allModules: ALL_SIDEBAR_MODULES,
        presets: ROLE_PRESETS,
        ...assignment,
      })
    }

    return NextResponse.json({
      success: true,
      allModules: ALL_SIDEBAR_MODULES,
      presets: ROLE_PRESETS,
    })
  } catch (error: any) {
    const isAuth = error?.message === 'Unauthorized'
    const isForbidden = error?.message?.includes('Forbidden') || error?.message?.includes('privilege')

    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch sidebar assignments' },
      { status: isAuth ? 401 : isForbidden ? 403 : 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const adminUser = await requireSuperAdmin()
    const body = await req.json()
    const { action = 'save', userId, modules } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    if (action === 'reset') {
      await resetUserSidebarModules(userId)
      return NextResponse.json({
        success: true,
        message: 'User sidebar reset to their default role preset successfully.',
      })
    }

    if (!Array.isArray(modules)) {
      return NextResponse.json({ error: 'Modules must be an array of module keys' }, { status: 400 })
    }

    const res = await saveUserSidebarModules(userId, modules, adminUser.id)
    return NextResponse.json({
      ...res,
      message: 'Sidebar navigation modules successfully assigned to user.',
    })
  } catch (error: any) {
    const isAuth = error?.message === 'Unauthorized'
    const isForbidden = error?.message?.includes('Forbidden') || error?.message?.includes('privilege')

    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to save sidebar assignments' },
      { status: isAuth ? 401 : isForbidden ? 403 : 500 }
    )
  }
}
