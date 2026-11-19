import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/auth-helpers'
import { getUserSidebarModules } from '@/lib/platform/sidebar-assignment-service'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roleNames = session.user.roles || []
    const assignment = await getUserSidebarModules(session.user.id, roleNames)

    return NextResponse.json({
      success: true,
      modules: assignment.modules,
      isCustomAssigned: assignment.isCustomAssigned,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Error fetching user sidebar' }, { status: 500 })
  }
}
