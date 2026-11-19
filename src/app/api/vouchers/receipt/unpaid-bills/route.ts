import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { getCustomerBalanceSummary, getUnpaidInvoicesForCustomer } from '@/lib/vouchers/voucher-service'

// GET /api/vouchers/receipt/unpaid-bills?customerId=...
export async function GET(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.FINANCE_READ)
    const customerId = req.nextUrl.searchParams.get('customerId')

    if (!customerId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION', message: 'customerId query parameter is required' },
        },
        { status: 400 }
      )
    }

    const [unpaidBills, customerSummary] = await Promise.all([
      getUnpaidInvoicesForCustomer(customerId),
      getCustomerBalanceSummary(customerId),
    ])

    return NextResponse.json({
      success: true,
      data: {
        unpaidBills,
        customerSummary,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: { code: 'ERROR', message },
      },
      { status: message === 'Customer not found' ? 404 : 400 }
    )
  }
}
