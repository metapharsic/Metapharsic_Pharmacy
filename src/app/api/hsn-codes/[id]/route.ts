import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { deleteHsnCode, updateHsnCode } from '@/lib/products/product-service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const updateHsnSchema = z.object({
  description: z.string().min(2).max(255).optional(),
  gstRate: z.coerce.number().min(0).max(100).optional(),
  cessRate: z.coerce.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
})

// PUT /api/hsn-codes/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(PERMISSIONS.SETTINGS_MANAGE)

    const body: unknown = await req.json()
    const data = updateHsnSchema.parse(body)

    const updated = await updateHsnCode(params.id, data)
    return NextResponse.json({ success: true, data: updated })
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
          : message.startsWith('Not Found')
            ? 404
            : 400

    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}

// DELETE /api/hsn-codes/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission(PERMISSIONS.SETTINGS_MANAGE)

    const result = await deleteHsnCode(params.id)
    return NextResponse.json({
      success: true,
      message: result.deleted
        ? 'HSN code deleted successfully'
        : 'HSN code is in use by products and has been deactivated',
      data: result,
    })
  } catch (err) {
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
