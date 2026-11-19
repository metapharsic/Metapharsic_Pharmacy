import { NextRequest, NextResponse } from 'next/server'
import { executeTerritoryMultiThreadEngine } from '@/lib/territory/multi-thread-territory-engine'
import { getAllTerritories, getTerritory, TerritoryCode } from '@/lib/territory/territory-config'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const country = searchParams.get('country')
    const timezone = searchParams.get('timezone')
    const lang = searchParams.get('lang') as 'en' | 'ar' | null
    const listAll = searchParams.get('all') === 'true'

    if (listAll) {
      return NextResponse.json({
        success: true,
        territories: getAllTerritories(),
      })
    }

    // Resolve client IP from headers
    const forwarded = request.headers.get('x-forwarded-for')
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'

    const result = await executeTerritoryMultiThreadEngine({
      country,
      timezone,
      requestedLanguage: lang,
      clientIp,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error in /api/territory GET:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to resolve territory engine',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { territoryCode, requestedLanguage, timezone } = body

    const forwarded = request.headers.get('x-forwarded-for')
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'

    const result = await executeTerritoryMultiThreadEngine({
      country: territoryCode,
      timezone,
      requestedLanguage,
      clientIp,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error in /api/territory POST:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to execute territory engine preflight',
      },
      { status: 500 }
    )
  }
}
