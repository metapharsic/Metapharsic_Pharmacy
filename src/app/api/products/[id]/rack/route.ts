import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { updateProductRack } from '@/lib/products/product-service'

type RouteParams = { params: { id: string } }

// PATCH /api/products/:id/rack
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTS_UPDATE)

    const body = (await req.json()) as { rack?: string | null }
    const updated = await updateProductRack(params.id, body.rack ?? null)

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Rack location updated to "${updated.rack ?? 'Unassigned'}"`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
