import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { getEligibleReceiptLedgers } from '@/lib/vouchers/voucher-service'

// GET /api/vouchers/receipt/ledgers
export async function GET(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.FINANCE_READ)
    const branchId = req.nextUrl.searchParams.get('branchId') || undefined
    const ledgers = await getEligibleReceiptLedgers(branchId)

    return NextResponse.json({
      success: true,
      data: ledgers,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: { code: 'ERROR', message },
      },
      { status: 500 }
    )
  }
}
