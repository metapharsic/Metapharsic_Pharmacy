import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requireAnyPermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { reconcileInventoryAuditDiscrepancies } from '@/lib/inventory/inventory-audit-service'

// POST /api/inventory/audit/reconcile
// Body: { auditId: string, notes?: string }
export async function POST(req: NextRequest) {
  try {
    const user = await requireAnyPermission([
      PERMISSIONS.INVENTORY_ADJUST,
      PERMISSIONS.INVENTORY_APPROVE_ADJUSTMENT,
    ])

    const body = await req.json().catch(() => ({}))
    if (!body.auditId) {
      return NextResponse.json(
        { success: false, error: { message: 'Audit ID is required' } },
        { status: 400 }
      )
    }

    const result = await reconcileInventoryAuditDiscrepancies({
      auditId: body.auditId,
      approvedById: user.id,
      notes: body.notes,
      signatureData: body.signatureData,
    })

    return NextResponse.json({
      success: true,
      message: `Successfully reconciled ${result.reconciledLinesCount} inventory discrepancies`,
      data: result,
    })
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { message } }, { status })
  }
}

