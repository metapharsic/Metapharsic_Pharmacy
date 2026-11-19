import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { processAdvancedGoodsReceipt } from '@/lib/purchases/purchase-lifecycle-service'

type RouteParams = { params: { id: string } }

const advancedGrnSchema = z.object({
  branchId: z.string().min(1, 'Branch is required'),
  grnNumber: z.string().min(1, 'GRN number is required'),
  deliveryNoteNumber: z.string().optional(),
  deliveryNoteDate: z.string().optional(),
  grnDate: z.string().optional(),
  coldChainChecked: z.boolean().optional().default(false),
  receivedTemperature: z.coerce.number().optional(),
  temperatureExcursion: z.boolean().optional().default(false),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        purchaseItemId: z.string().min(1),
        batchNumber: z.string().min(1, 'Batch number is required'),
        manufacturingDate: z.string().optional(),
        expiryDate: z.string().min(1, 'Expiry date is required'),
        deliveredQuantity: z.coerce.number().int().min(0),
        acceptedQuantity: z.coerce.number().int().min(0),
        rejectedQuantity: z.coerce.number().int().min(0),
        freeQuantity: z.coerce.number().int().min(0).optional().default(0),
        purchasePrice: z.coerce.number().min(0),
        mrp: z.coerce.number().min(0),
        qualityCheckPassed: z.boolean().default(true),
        rejectionReason: z.string().optional(),
        storageRack: z.string().optional(),
        storageBox: z.string().optional(),
      })
    )
    .min(1, 'At least one item is required'),
})

function errStatus(msg: string) {
  if (msg === 'Unauthorized') return 401
  if (msg.startsWith('Forbidden')) return 403
  if (msg.startsWith('Not Found')) return 404
  return 400
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission(PERMISSIONS.PURCHASES_RECEIVE)
    const body: unknown = await req.json()
    const data = advancedGrnSchema.parse(body)

    const result = await processAdvancedGoodsReceipt(
      {
        purchaseId: params.id,
        branchId: data.branchId,
        grnNumber: data.grnNumber,
        deliveryNoteNumber: data.deliveryNoteNumber,
        deliveryNoteDate: data.deliveryNoteDate,
        grnDate: data.grnDate,
        coldChainChecked: data.coldChainChecked,
        receivedTemperature: data.receivedTemperature,
        temperatureExcursion: data.temperatureExcursion,
        notes: data.notes,
        items: data.items,
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
