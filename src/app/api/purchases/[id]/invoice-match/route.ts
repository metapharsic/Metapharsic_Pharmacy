import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { processThreeWayMatchAndInvoice } from '@/lib/purchases/purchase-lifecycle-service'

type RouteParams = { params: { id: string } }

const threeWayMatchSchema = z.object({
  supplierInvoiceNumber: z.string().min(1, 'Supplier invoice number is required'),
  supplierInvoiceDate: z.string().min(1, 'Invoice date is required'),
  billedSubtotal: z.coerce.number().min(0, 'Subtotal cannot be negative'),
  billedTaxAmount: z.coerce.number().min(0, 'Tax amount cannot be negative'),
  freightAmount: z.coerce.number().min(0).optional().default(0),
  roundOff: z.coerce.number().optional().default(0),
  billedTotalAmount: z.coerce.number().positive('Total amount must be positive'),
  tolerancePercent: z.coerce.number().min(0).max(10).optional().default(1),
  items: z
    .array(
      z.object({
        purchaseItemId: z.string().min(1),
        billedQuantity: z.coerce.number().int().min(0),
        billedRate: z.coerce.number().min(0),
        billedAmount: z.coerce.number().min(0),
      })
    )
    .min(1, 'At least one billed item is required'),
})

function errStatus(msg: string) {
  if (msg === 'Unauthorized') return 401
  if (msg.startsWith('Forbidden')) return 403
  if (msg.startsWith('Not Found')) return 404
  if (msg.startsWith('Duplicate Invoice')) return 409
  return 400
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission(PERMISSIONS.PURCHASES_UPDATE)
    const body: unknown = await req.json()
    const data = threeWayMatchSchema.parse(body)

    const result = await processThreeWayMatchAndInvoice(
      {
        purchaseId: params.id,
        supplierInvoiceNumber: data.supplierInvoiceNumber,
        supplierInvoiceDate: data.supplierInvoiceDate,
        billedSubtotal: data.billedSubtotal,
        billedTaxAmount: data.billedTaxAmount,
        freightAmount: data.freightAmount,
        roundOff: data.roundOff,
        billedTotalAmount: data.billedTotalAmount,
        tolerancePercent: data.tolerancePercent,
        items: data.items,
      },
      user
    )

    return NextResponse.json({ success: true, data: result }, { status: 200 })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION',
            message: err.errors[0]?.message ?? 'Invalid input',
            issues: err.flatten(),
          },
        },
        { status: 400 }
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      { status: errStatus(message) }
    )
  }
}
