import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { assertPeriodOpen } from '@/lib/finance/period-lock-service'
import { createReceiptVoucher, getReceiptVouchers } from '@/lib/vouchers/voucher-service'
import { createReceiptVoucherSchema, receiptVoucherQuerySchema } from '@/lib/vouchers/voucher-validations'

function errStatus(msg: string) {
  if (msg === 'Unauthorized') return 401
  if (msg.startsWith('Forbidden') || msg.startsWith('PERIOD_LOCKED')) return 403
  if (msg.startsWith('Not Found')) return 404
  return 400
}

// GET /api/vouchers/receipt
export async function GET(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.FINANCE_READ)
    const searchParams = Object.fromEntries(req.nextUrl.searchParams)
    const query = receiptVoucherQuerySchema.parse(searchParams)

    const result = await getReceiptVouchers(query)

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION',
            message: err.errors[0]?.message ?? 'Invalid query parameters',
            issues: err.flatten(),
          },
        },
        { status: 400 }
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: { code: 'ERROR', message },
      },
      { status: errStatus(message) }
    )
  }
}

// POST /api/vouchers/receipt
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.FINANCE_MANAGE)
    const body: unknown = await req.json()
    const data = createReceiptVoucherSchema.parse(body)

    // Enforce Tally/Marg period locking on voucher date
    await assertPeriodOpen(data.date, user.roles || [])

    const voucher = await createReceiptVoucher(data, {
      id: user.id,
      name: user.name ?? undefined,
    })

    return NextResponse.json(
      {
        success: true,
        data: voucher,
        message: `Receipt Voucher ${voucher?.voucherNumber} created successfully`,
      },
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION',
            message: err.errors[0]?.message ?? 'Invalid voucher data',
            issues: err.flatten(),
          },
        },
        { status: 400 }
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: { code: 'ERROR', message },
      },
      { status: errStatus(message) }
    )
  }
}
