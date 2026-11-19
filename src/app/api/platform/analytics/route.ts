import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/auth-helpers'
import { getPlatformChemistAnalytics } from '@/lib/platform/platform-analytics-service'

export async function GET() {
  try {
    // Strict Platform Super-Admin privilege enforcement
    await requireSuperAdmin()

    const data = await getPlatformChemistAnalytics()

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch platform analytics'
    const isAuth = message === 'Unauthorized'
    const isForbidden = message.includes('Forbidden') || message.includes('privilege')

    return NextResponse.json(
      {
        success: false,
        error: {
          code: isAuth ? 'UNAUTHORIZED' : isForbidden ? 'FORBIDDEN' : 'SERVER_ERROR',
          message,
        },
      },
      { status: isAuth ? 401 : isForbidden ? 403 : 500 }
    )
  }
}

