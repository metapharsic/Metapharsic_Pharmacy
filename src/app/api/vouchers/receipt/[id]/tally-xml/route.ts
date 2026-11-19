import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { buildReceiptVoucherTallyXml, getReceiptVoucherById } from '@/lib/vouchers/voucher-service'

type RouteParams = { params: { id: string } }

// GET /api/vouchers/receipt/:id/tally-xml
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission(PERMISSIONS.FINANCE_READ)
    const voucher = await getReceiptVoucherById(params.id)

    if (!voucher) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Voucher not found' },
        },
        { status: 404 }
      )
    }

    const xml = await buildReceiptVoucherTallyXml(params.id)

    const isDownload = req.nextUrl.searchParams.get('download') === 'true'
    const headers: Record<string, string> = {
      'Content-Type': 'application/xml; charset=utf-8',
    }

    if (isDownload) {
      headers['Content-Disposition'] = `attachment; filename="Receipt-${voucher.voucherNumber}.xml"`
    }

    return new NextResponse(xml, {
      status: 200,
      headers,
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
