import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { commitScannedInventory } from '@/lib/scanner/auto-inventory-service'
import type { CommitInventoryScanInput } from '@/lib/scanner/strip-scanner-types'

// POST /api/inventory/scan/commit
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_ADJUST)

    const body = (await req.json()) as CommitInventoryScanInput

    if (!body.productName || !body.batchNumber || !body.mrp || !body.quantityToAdd || body.quantityToAdd <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION',
            message: 'productName, batchNumber, mrp, and quantityToAdd (> 0) are required',
          },
        },
        { status: 400 }
      )
    }

    const result = await commitScannedInventory(body, user.id)

    return NextResponse.json({
      success: true,
      data: result,
      message: result.message,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
