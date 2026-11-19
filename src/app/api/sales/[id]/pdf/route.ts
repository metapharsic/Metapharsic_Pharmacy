import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { generateInvoicePdfBuffer } from '@/lib/pdf/invoice-pdf-generator'
import { getSaleById } from '@/lib/sales/sales-service'

type RouteParams = { params: { id: string } }

// GET /api/sales/:id/pdf?format=a4|thermal80&download=true|false
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission(PERMISSIONS.SALES_READ)
    const scope = await resolveBranchScope(user)

    const sale = await getSaleById(params.id, scope)
    if (!sale) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Sale not found' } },
        { status: 404 }
      )
    }

    const searchParams = req.nextUrl ? req.nextUrl.searchParams : new URL(req.url).searchParams
    const formatParam = searchParams.get('format')
    const format = formatParam === 'thermal80' ? 'thermal80' : 'a4'
    const download = searchParams.get('download') === 'true'

    const pdfBuffer = generateInvoicePdfBuffer(sale as any, { format })

    const filename = `Invoice-${sale.invoiceNumber || params.id}-${format === 'thermal80' ? 'Slip' : 'Invoice'}.pdf`
    const dispositionType = download ? 'attachment' : 'inline'

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${dispositionType}; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      {
        status:
          message === 'Unauthorized'
            ? 401
            : message.startsWith('Forbidden')
              ? 403
              : message.startsWith('Not Found')
                ? 404
                : 400,
      }
    )
  }
}
