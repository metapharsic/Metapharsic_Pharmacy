import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { analyzeScannedStrip } from '@/lib/scanner/auto-inventory-service'
import type { PackagingSurfaceType } from '@/lib/scanner/strip-scanner-types'

// POST /api/inventory/scan/analyze
export async function POST(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.INVENTORY_READ)

    const body = (await req.json()) as {
      rawText: string
      surfaceType?: PackagingSurfaceType
    }

    if (!body.rawText || typeof body.rawText !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'rawText string is required' } },
        { status: 400 }
      )
    }

    const surfaceType = body.surfaceType || 'ALU_ALU'
    const analysis = await analyzeScannedStrip(body.rawText, surfaceType)

    return NextResponse.json({
      success: true,
      data: analysis,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
