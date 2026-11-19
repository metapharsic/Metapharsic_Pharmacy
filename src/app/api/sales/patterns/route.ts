import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { getAvailableSalesPatterns } from '@/lib/sales/sales-pattern-service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/sales/patterns?branchId=
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.SALES_READ)
    const userRoles = (user as { roles?: string[] }).roles ?? []
    const isAdmin = userRoles.some((r: string) =>
      ['owner', 'admin', 'super_admin'].includes(r.toLowerCase())
    )

    const branchParam = req.nextUrl.searchParams.get('branchId') || undefined
    const branchId = await resolveBranchScope(user, branchParam)

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: { message: 'Branch ID is required to load sales patterns' } },
        { status: 400 }
      )
    }

    const patterns = await getAvailableSalesPatterns(branchId)

    // Mask profit & cost fields for non-admin users
    const sanitized = isAdmin
      ? patterns
      : patterns.map((p) => ({
          ...p,
          totalPurchaseCost: undefined,
          totalProfit: undefined,
          profitPct: undefined,
          items: p.items.map((i) => ({
            ...i,
            stripCostPrice: undefined,
            tabletCostBasis: undefined,
            lineCost: undefined,
            profitEarned: undefined,
            profitPct: undefined,
          })),
        }))

    return NextResponse.json({ success: true, data: sanitized })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load sales patterns'
    const status = message.startsWith('Forbidden') ? 403 : message.startsWith('Not Found') ? 404 : 500
    return NextResponse.json({ success: false, error: { message } }, { status })
  }
}

