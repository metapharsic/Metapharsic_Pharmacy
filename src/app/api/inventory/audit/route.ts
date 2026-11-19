import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requireAnyPermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import {
  runMultiThreadedInventoryAudit,
  getLatestInventoryAudit,
} from '@/lib/inventory/inventory-audit-service'

// GET /api/inventory/audit?branchId=
export async function GET(req: NextRequest) {
  try {
    const user = await requireAnyPermission([
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_ADJUST,
      PERMISSIONS.AUDIT_READ,
    ])

    const { searchParams } = new URL(req.url)
    const branchQuery = searchParams.get('branchId') || undefined
    const branchId = await resolveBranchScope(user, branchQuery)

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: { message: 'Branch ID is required for inventory audit' } },
        { status: 400 }
      )
    }

    let audit = await getLatestInventoryAudit(branchId)

    // If no audit has been run yet for this branch, execute the initial baseline audit strictly scoped to this tenant
    if (!audit) {
      audit = await runMultiThreadedInventoryAudit({
        branchId,
        organizationId: user.organizationId || undefined,
        conductedById: user.id,
        title: 'Initial Baseline Inventory & Compliance Audit',
      })
    }

    return NextResponse.json({ success: true, data: audit })
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { message } }, { status })
  }
}

// POST /api/inventory/audit
// Body: { branchId?: string, title?: string, auditType?: string, physicalCounts?: Record<string, number> }
export async function POST(req: NextRequest) {
  try {
    const user = await requireAnyPermission([
      PERMISSIONS.INVENTORY_ADJUST,
      PERMISSIONS.AUDIT_READ,
    ])

    const body = await req.json().catch(() => ({}))
    const branchId = await resolveBranchScope(user, body.branchId)

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: { message: 'Branch ID is required for inventory audit' } },
        { status: 400 }
      )
    }

    const auditResult = await runMultiThreadedInventoryAudit({
      branchId,
      organizationId: user.organizationId || undefined,
      conductedById: user.id,
      title: body.title,
      auditType: body.auditType,
      auditScope: body.auditScope,
      physicalCounts: body.physicalCounts,
      discrepancyReasons: body.discrepancyReasons,
    })

    return NextResponse.json({
      success: true,
      message: 'Multi-threaded inventory audit completed successfully',
      data: auditResult,
    })
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { message } }, { status })
  }
}

