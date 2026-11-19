import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requireAuth } from '@/lib/auth/auth-helpers'
import prisma from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

// GET /api/platform/global-medicines?search=&limit=
export async function GET(req: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || ''
    const rawLimit = searchParams.get('limit') || '30'
    const limit = Math.min(100, Math.max(1, parseInt(rawLimit, 10) || 30))

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { genericName: { contains: search, mode: 'insensitive' as const } },
            { composition: { contains: search, mode: 'insensitive' as const } },
            { manufacturer: { contains: search, mode: 'insensitive' as const } },
            { hsnCode: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    const medicines = await prisma.globalMedicine.findMany({
      where,
      take: limit,
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: medicines,
      count: medicines.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

