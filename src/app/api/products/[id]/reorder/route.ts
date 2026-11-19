import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { calculateProductIndent } from '@/lib/products/product-analytics-service'

type RouteParams = { params: { id: string } }

// GET /api/products/:id/reorder - Get indent recommendation
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission(PERMISSIONS.PURCHASES_READ)

    const data = await calculateProductIndent(params.id)
    if (!data) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

// POST /api/products/:id/reorder - Confirm quick indent request
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission(PERMISSIONS.PURCHASES_CREATE)

    const indent = await calculateProductIndent(params.id)
    if (!indent) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } },
        { status: 404 }
      )
    }

    const body = (await req.json().catch(() => ({}))) as { quantity?: number }
    const orderQty = body.quantity && body.quantity > 0 ? body.quantity : indent.suggestedReorderQuantity

    return NextResponse.json({
      success: true,
      data: {
        indentNumber: `IND-${Date.now().toString().slice(-6)}`,
        productId: indent.productId,
        productName: indent.productName,
        quantity: orderQty,
        estimatedOrderValue: Math.round(orderQty * indent.estimatedCostPrice * 100) / 100,
        createdAt: new Date().toISOString(),
        status: 'SUBMITTED',
      },
      message: `Reorder indent submitted for ${orderQty} ${indent.unitOfMeasure} of ${indent.productName}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
