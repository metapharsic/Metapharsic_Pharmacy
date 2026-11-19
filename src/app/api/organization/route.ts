import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import {
  getOrganizationWithBranches,
  updateOrganization,
  getSettings,
  upsertSettings,
} from '@/lib/organization/org-service'
import { ensureProvisionedDbSettings } from '@/lib/settings/settings-provisioning-service'
import { invalidateSettingsCache, updateSystemSettings } from '@/lib/settings/settings-service'

const updateOrgSchema = z.object({
  name: z.string().min(2).optional(),
  legalName: z.string().optional(),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  dlNumber: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  logoUrl: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  financialYearStart: z.number().min(1).max(12).optional(),
  settings: z.record(z.string()).optional(),
})

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/organization
export async function GET() {
  try {
    const user = await requirePermission(PERMISSIONS.ORGANIZATION_READ)

    // Ensure database has all required settings provisioned
    await ensureProvisionedDbSettings()

    const org = await getOrganizationWithBranches(user.organizationId || undefined)
    if (!org) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } },
        { status: 404 }
      )
    }

    const settingsMap = await getSettings(org.id)

    return NextResponse.json({ success: true, data: { ...org, settingsMap } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

// PUT /api/organization
export async function PUT(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.ORGANIZATION_UPDATE)

    const body: unknown = await req.json()
    const data = updateOrgSchema.parse(body)
    const { settings, ...orgData } = data

    const org = await getOrganizationWithBranches(user.organizationId || undefined)
    if (!org) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } },
        { status: 404 }
      )
    }

    // Auto-derive PAN from GSTIN if PAN was not explicitly provided
    if (!orgData.pan && orgData.gstin && orgData.gstin.length >= 12) {
      orgData.pan = orgData.gstin.substring(2, 12).toUpperCase()
    }

    const updated = await updateOrganization(org.id, orgData)

    if (settings && Object.keys(settings).length > 0) {
      await upsertSettings(org.id, settings)

      // Sync relevant inventory settings to system_settings
      const systemUpdates = []
      if (settings.lowStockThreshold) {
        systemUpdates.push({
          category: 'inventory',
          key: 'low_stock_threshold',
          value: settings.lowStockThreshold,
        })
      }
      if (settings.expiryAlertDays) {
        systemUpdates.push({
          category: 'inventory',
          key: 'expiry_alert_days',
          value: settings.expiryAlertDays,
        })
      }
      if (systemUpdates.length > 0) {
        await updateSystemSettings(systemUpdates, user.id)
      }
    }

    invalidateSettingsCache()

    return NextResponse.json({ success: true, data: updated, message: 'Organization updated successfully' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 400
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
