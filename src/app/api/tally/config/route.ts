import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth/auth-helpers'
import { getTallyConfig, saveTallyConfig } from '@/lib/tally/tally-service'
import type { TallyConfig } from '@/lib/tally/tally-types'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const config = await getTallyConfig()
    return NextResponse.json({ success: true, data: config })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve Tally configuration'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as Partial<TallyConfig>
    const updated = await saveTallyConfig(body)

    return NextResponse.json({ success: true, data: updated })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update Tally configuration'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
