import { NextResponse, type NextRequest } from 'next/server'
import { z, ZodError } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { settleSalePayment } from '@/lib/sales/sales-service'
import { PaymentMethodEnum } from '@/lib/validations/sale'

const settlePaymentSchema = z.object({
  amount: z.coerce.number().positive('Payment amount must be greater than zero'),
  method: PaymentMethodEnum,
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission(PERMISSIONS.SALES_CREATE)
    const body: unknown = await req.json()
    const data = settlePaymentSchema.parse(body)

    const updatedSale = await settleSalePayment(
      {
        saleId: params.id,
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        notes: data.notes,
      },
      user
    )

    return NextResponse.json({ success: true, data: updatedSale }, { status: 201 })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION',
            message: err.errors[0]?.message ?? 'Invalid payment data',
            issues: err.flatten(),
          },
        },
        { status: 400 }
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status =
      message === 'Unauthorized'
        ? 401
        : message.startsWith('Forbidden')
          ? 403
          : message.startsWith('Not Found')
            ? 404
            : 400
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
