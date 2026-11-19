import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { executeBulkProductAction } from '@/lib/products/product-service'

// POST /api/products/bulk
export async function POST(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTS_UPDATE)

    const body = (await req.json()) as {
      action: string
      productIds: string[]
      metadata?: { rack?: string }
    }

    const action = body.action?.toUpperCase() as 'ACTIVATE' | 'DEACTIVATE' | 'SET_RACK'

    if (!['ACTIVATE', 'DEACTIVATE', 'SET_RACK'].includes(action) || !Array.isArray(body.productIds) || body.productIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Invalid action or empty productIds' } },
        { status: 400 }
      )
    }

    const result = await executeBulkProductAction(action, body.productIds, body.metadata)

    return NextResponse.json({
      success: true,
      data: result,
      message: `Successfully executed ${body.action} on ${result.count} products`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
