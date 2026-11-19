import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/auth-helpers'
import { provisionAllAdmins } from '@/lib/provisioning/bulk-admin-provisioner'

export async function POST() {
  try {
    const user = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 })
    }

    const isSuperAdmin = Boolean(user.isSuperAdmin)
    const roles: string[] = user.roles || []

    if (!isSuperAdmin && !roles.includes('super_admin') && !roles.includes('owner')) {
      return NextResponse.json(
        { error: 'Forbidden: SuperAdmin or Owner credentials required to provision all entities' },
        { status: 403 }
      )
    }

    const report = await provisionAllAdmins()

    return NextResponse.json({
      success: true,
      message: `Successfully provisioned ${report.totalOrgs} organizations and ${report.totalAdmins} admin accounts.`,
      report,
    })
  } catch (error: any) {
    console.error('Bulk provisioning error:', error)
    return NextResponse.json(
      { error: error?.message || 'Bulk provisioning failed' },
      { status: 500 }
    )
  }
}
