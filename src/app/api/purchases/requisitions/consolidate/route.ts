import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { consolidateAndConvertPrsToPo } from '@/lib/purchases/purchase-lifecycle-service'

const consolidateSchema = z.object({
  prIds: z.array(z.string().min(1)).min(1, 'At least one PR must be selected'),
  supplierId: z.string().min(1, 'Supplier is required'),
  branchId: z.string().min(1, 'Branch is required'),
  expectedDate: z.string().optional(),
  notes: z.string().max(500).optional(),
})

function errStatus(msg: string) {
  if (msg === 'Unauthorized') return 401
  if (msg.startsWith('Forbidden')) return 403
  if (msg.startsWith('Not Found')) return 404
  return 400
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.PURCHASES_CREATE)
    const body: unknown = await req.json()
    const data = consolidateSchema.parse(body)

    const result = await consolidateAndConvertPrsToPo(
      {
        ...data,
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : undefined,
      },
      user
    )

    return NextResponse.json({ success: true, data: result }, { status: 201 })
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
