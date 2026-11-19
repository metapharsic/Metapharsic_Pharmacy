import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { createHsnCode, listHsnCodesDetailed } from '@/lib/products/product-service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const createHsnSchema = z.object({
  code: z.string().min(2, 'HSN code must be at least 2 characters').max(16),
  description: z.string().min(2, 'Description is required').max(255),
  gstRate: z.coerce.number().min(0, 'GST rate cannot be negative').max(100, 'GST rate cannot exceed 100%'),
  cessRate: z.coerce.number().min(0).max(100).default(0),
})

// GET /api/hsn-codes?search=&isActive=
export async function GET(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTS_READ)

    const searchParams = req.nextUrl.searchParams
    const search = searchParams.get('search') || undefined
    const isActiveParam = searchParams.get('isActive')
    const isActive = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined

    const data = await listHsnCodesDetailed({ search, isActive })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

// POST /api/hsn-codes
export async function POST(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SETTINGS_MANAGE)

    const body: unknown = await req.json()
    const data = createHsnSchema.parse(body)

    const hsn = await createHsnCode(data)
    return NextResponse.json({ success: true, data: hsn }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
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
    const status =
      message === 'Unauthorized'
        ? 401
        : message.startsWith('Forbidden')
          ? 403
          : message.includes('Unique constraint')
            ? 409
            : 400

    return NextResponse.json(
      {
        success: false,
        error: {
          code: message.includes('Unique constraint') ? 'CONFLICT' : 'ERROR',
          message: message.includes('Unique constraint')
            ? 'An HSN code with this code already exists'
            : message,
        },
      },
      { status }
    )
  }
}
