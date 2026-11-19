import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { requireTenantContext } from '@/lib/auth/tenant-context'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'
import { ensureProvisionedDbSettings } from '@/lib/settings/settings-provisioning-service'
import { getAllSystemSettingsGrouped, updateSystemSettings } from '@/lib/settings/settings-service'
import { runSettingsUsersWorker } from '@/lib/settings/settings-users-bridge'

export const dynamic = 'force-dynamic'

const updateSettingsSchema = z.object({
  settings: z.array(
    z.object({
      category: z.string().min(1),
      key: z.string().min(1),
      value: z.string(),
    })
  ),
})

// GET /api/settings
export async function GET() {
  try {
    await requirePermission(PERMISSIONS.ORGANIZATION_READ)
    const tenant = await requireTenantContext()

    // Ensure database is provisioned with all settings
    const provisioning = await ensureProvisionedDbSettings()
    const { settings, grouped } = await getAllSystemSettingsGrouped()

    const [organization, orgSettings] = await Promise.all([
      tenant.organizationId
        ? prisma.organization.findUnique({ where: { id: tenant.organizationId } })
        : null,
      tenant.organizationId
        ? prisma.organizationSetting.findMany({ where: { organizationId: tenant.organizationId } })
        : [],
    ])

    // Multi-threaded audit worker check on settings integrity
    const audit = await runSettingsUsersWorker<
      {
        systemSettings: typeof settings
        orgSettings: typeof orgSettings
        organization: typeof organization
      },
      {
        totalSettingsChecked: number
        validSettingsCount: number
        issues: Array<{ category: string; key: string; type: string; message: string }>
        gstComplianceValid: boolean
        status: string
      }
    >('AUDIT_SETTINGS_INTEGRITY', {
      systemSettings: settings,
      orgSettings,
      organization,
    })

    return NextResponse.json({
      success: true,
      data: {
        settings,
        grouped,
        organization,
        provisioning,
        audit,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

// PUT /api/settings
export async function PUT(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.ORGANIZATION_UPDATE)
    await requireTenantContext()

    const body: unknown = await req.json()
    const { settings } = updateSettingsSchema.parse(body)

    const updated = await updateSystemSettings(settings, user.id)

    return NextResponse.json({
      success: true,
      data: updated,
      message: `${updated.length} setting(s) updated successfully`,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: err.errors[0]?.message } },
        { status: 400 }
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
