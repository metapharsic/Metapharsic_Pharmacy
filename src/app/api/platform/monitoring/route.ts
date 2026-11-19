import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/auth-helpers'
import {
  getSystemTelemetry,
  getEntityActivityLogs,
  getActiveOnlineUsersSummary,
} from '@/lib/platform/platform-monitoring-service'

export async function GET() {
  try {
    await requireSuperAdmin()

    const [telemetry, activityLogs, summary] = await Promise.all([
      getSystemTelemetry(),
      getEntityActivityLogs(50),
      getActiveOnlineUsersSummary(),
    ])

    return NextResponse.json({
      success: true,
      telemetry,
      activityLogs,
      summary,
    })
  } catch (error: any) {
    const isAuth = error?.message === 'Unauthorized'
    const isForbidden = error?.message?.includes('Forbidden') || error?.message?.includes('privilege')

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch monitoring telemetry',
      },
      { status: isAuth ? 401 : isForbidden ? 403 : 500 }
    )
  }
}
