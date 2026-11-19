import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { assertBranchAccess } from '@/lib/inventory/branch-access'
import {
  listSupplierQuotations,
  recordSupplierQuotation,
} from '@/lib/purchases/purchase-lifecycle-service'

const quotationSchema = z.object({
  rfqNumber: z.string().optional(),
  supplierId: z.string().min(1, 'Supplier is required'),
  productId: z.string().min(1, 'Product is required'),
  paidQuantity: z.coerce.number().int().positive('Paid quantity must be positive'),
  freeQuantity: z.coerce.number().int().min(0).optional().default(0),
  basicRate: z.coerce.number().positive('Basic rate must be positive'),
  discountPercent: z.coerce.number().min(0).max(100).optional().default(0),
  taxPercent: z.coerce.number().min(0).max(100).optional().default(12),
  freightCharges: z.coerce.number().min(0).optional().default(0),
  remainingShelfLifeMonths: z.coerce.number().int().min(1).optional().default(24),
  leadTimeDays: z.coerce.number().int().min(0).optional().default(2),
  creditDays: z.coerce.number().int().min(0).optional().default(30),
  paymentTerms: z.string().max(100).optional().default('30 Days Net'),
  returnPolicy: z.string().max(255).optional(),
})

function errStatus(msg: string) {
  if (msg === 'Unauthorized') return 401
  if (msg.startsWith('Forbidden')) return 403
  if (msg.startsWith('Not Found')) return 404
  if (msg.startsWith('Conflict')) return 409
  return 400
}

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PURCHASES_READ)
    const branchId = req.nextUrl.searchParams.get('branchId') ?? undefined
    if (branchId && branchId !== 'all') {
      await assertBranchAccess(user, branchId)
    }
    const rfqNumber = req.nextUrl.searchParams.get('rfqNumber') ?? undefined

    const quotations = await listSupplierQuotations(
      rfqNumber,
      user.isSuperAdmin ? undefined : user.organizationId || '__NO_ACCESS__'
    )
    return NextResponse.json({ success: true, data: quotations })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: { code: 'ERROR', message } },
      { status: errStatus(message) }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PURCHASES_CREATE)
    const body: unknown = await req.json()
    const data = quotationSchema.parse(body)

    const quotation = await recordSupplierQuotation(data, user)
    return NextResponse.json({ success: true, data: quotation }, { status: 201 })
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
