import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { getSupplierProductSourcingMatrix } from '@/lib/suppliers/supplier-management-service'

// GET /api/suppliers/sourcing-matrix?productId=...
export async function GET(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SUPPLIERS_READ)
    const { searchParams } = req.nextUrl
    const productId = searchParams.get('productId') || undefined

    const matrix = await getSupplierProductSourcingMatrix(productId)
    return NextResponse.json({ success: true, data: matrix })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { message: err.message || 'Failed to fetch sourcing matrix' } },
      { status: 500 }
    )
  }
}
