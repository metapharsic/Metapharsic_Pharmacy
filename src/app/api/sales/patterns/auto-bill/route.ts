import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { assertPeriodOpen } from '@/lib/finance/period-lock-service'
import { resolveBranchScope } from '@/lib/inventory/branch-access'
import { executeAutoBillFromPattern } from '@/lib/sales/sales-pattern-service'
import { syncSaleToTally } from '@/lib/tally/tally-sync-service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const autoBillSchema = z.object({
  branchId: z.string().optional(),
  patternId: z.string().min(1, 'Pattern ID is required'),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD']).default('CASH'),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).default(1),
        unit: z.enum(['STRIP', 'TABLET']).default('TABLET'),
        isTabletSale: z.boolean().default(true),
      })
    )
    .optional(),
})

// POST /api/sales/patterns/auto-bill
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.SALES_CREATE)
    const userRoles = (user as { roles?: string[] }).roles ?? []
    const isAdmin = userRoles.some((r: string) =>
      ['owner', 'admin', 'super_admin'].includes(r.toLowerCase())
    )

    const rawBody = await req.json()
    const parsed = autoBillSchema.parse(rawBody)

    const branchId = await resolveBranchScope(user, parsed.branchId)
    if (!branchId) {
      return NextResponse.json(
        { success: false, error: { message: 'Branch ID is required for billing' } },
        { status: 400 }
      )
    }

    // Period lock gate
    await assertPeriodOpen(new Date(), userRoles)

    const result = await executeAutoBillFromPattern(
      {
        branchId,
        patternId: parsed.patternId,
        paymentMethod: parsed.paymentMethod,
        customerName: parsed.customerName,
        customerPhone: parsed.customerPhone,
        notes: parsed.notes,
        items: parsed.items,
      },
      user
    )

    // Background accounting ledger sync
    let tallySyncResult: { status: string; message?: string } = { status: 'OFFLINE', message: 'Queued / Offline' }
    try {
      const syncRes = await syncSaleToTally(result.sale.id)
      tallySyncResult = {
        status: syncRes.status === 'SYNCED' ? 'SYNCED' : 'OFFLINE',
        message: syncRes.status === 'SYNCED' ? 'Synced to accounts' : 'Queued / Port 9000 offline',
      }
    } catch {
      tallySyncResult = { status: 'OFFLINE', message: 'Queued / Port 9000 offline' }
    }

    // Mask profit & cost data if actor is not an admin
    const salePayload = isAdmin
      ? result.sale
      : {
          ...result.sale,
          purchaseCost: undefined,
          profitAmount: undefined,
          profitPct: undefined,
          purchaseCostComplete: undefined,
          purchaseUnpricedUnits: undefined,
          items: result.sale.items?.map((it: any) => ({
            ...it,
            purchaseCost: undefined,
            profitAmount: undefined,
            profitPct: undefined,
            costBasis: undefined,
            itemBatches: it.itemBatches?.map((ib: any) => ({
              ...ib,
              batch: {
                ...ib.batch,
                purchasePrice: undefined,
              },
            })),
          })),
        }

    return NextResponse.json(
      {
        success: true,
        data: salePayload,
        tallySync: tallySyncResult,
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { message: err.errors[0]?.message || 'Validation error' } },
        { status: 400 }
      )
    }
    const message = err instanceof Error ? err.message : 'Auto-billing failed'
    const status = message.startsWith('Forbidden') ? 403 : message.startsWith('Not Found') ? 404 : 500
    return NextResponse.json({ success: false, error: { message } }, { status })
  }
}
