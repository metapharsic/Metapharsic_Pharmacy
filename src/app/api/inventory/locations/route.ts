import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { getRackBoxMatrix, updateProductLocation } from '@/lib/inventory/inventory-analytics-service'

// GET /api/inventory/locations?branchId=
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_READ)
    const { searchParams } = new URL(req.url)
    const rawBranchId = searchParams.get('branchId') || undefined
    const branchId = await resolveBranchScope(user, rawBranchId)

    const result = await getRackBoxMatrix({ branchId: branchId ?? undefined })
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

// PATCH /api/inventory/locations
// Body: { productId: string, rack?: string | null, shelf?: string | null, box?: string | null }
export async function PATCH(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTS_UPDATE)
    const body = (await req.json()) as {
      productId: string
      rack?: string | null
      shelf?: string | null
      box?: string | null
    }

    if (!body.productId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'productId is required' } },
        { status: 400 }
      )
    }

    const updated = await updateProductLocation(body.productId, {
      rack: body.rack,
      shelf: body.shelf,
      box: body.box,
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Location updated: ${updated.rack || 'No Rack'} > ${updated.shelf || 'No Shelf'} > ${updated.box || 'No Box'}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
