import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { getPeriodLockSettings, setPeriodLockSettings } from '@/lib/finance/period-lock-service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const updatePeriodLockSchema = z.object({
  lockDate: z.string().nullable().optional(),
  allowAdminBypass: z.boolean().default(true),
})

// GET /api/finance/period-lock
export async function GET() {
  try {
    await requirePermission(PERMISSIONS.SETTINGS_READ)
    const settings = await getPeriodLockSettings()

    return NextResponse.json({
      success: true,
      data: settings,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      { status: message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 400 }
    )
  }
}

// PUT /api/finance/period-lock
export async function PUT(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
    const body: unknown = await req.json()
    const data = updatePeriodLockSchema.parse(body)

    const updated = await setPeriodLockSettings(
      {
        lockDate: data.lockDate || null,
        allowAdminBypass: data.allowAdminBypass,
      },
      user.id
    )

    return NextResponse.json({
      success: true,
      data: updated,
      message: updated.lockDate
        ? `Financial transactions locked prior to ${updated.lockDate}`
        : 'Financial period lock removed (all dates unlocked)',
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION',
            message: err.errors[0]?.message ?? 'Invalid input',
            issues: err.flatten(),
          },
        },
        { status: 400 }
      )
    }

    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      { status: message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 400 }
    )
  }
}
