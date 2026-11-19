import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/auth-helpers'
import { getGeoPoliticalZoneMetrics } from '@/lib/platform/geo-zones'

export async function GET() {
  try {
    await requireSuperAdmin()
    const metrics = await getGeoPoliticalZoneMetrics()
    return NextResponse.json({
      success: true,
      ...metrics,
    })
  } catch (error: any) {
    const isAuth = error?.message === 'Unauthorized'
    const isForbidden = error?.message?.includes('Forbidden') || error?.message?.includes('privilege')

    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch geo zone telemetry' },
      { status: isAuth ? 401 : isForbidden ? 403 : 500 }
    )
  }
}
