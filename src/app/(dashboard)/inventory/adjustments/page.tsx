import type { Metadata } from 'next'

import type { AdjustmentRow } from '@/components/inventory/adjustments-table'
import { AdjustmentsView } from '@/components/inventory/adjustments-view'
import { can, getSession } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { getAdjustments } from '@/lib/inventory/inventory-service'

export const metadata: Metadata = { title: 'Stock Adjustments' }

export default async function StockAdjustmentsPage() {
  const [canRead, canAdjust, canApprove, session] = await Promise.all([
    can(PERMISSIONS.INVENTORY_READ),
    can(PERMISSIONS.INVENTORY_ADJUST),
    can(PERMISSIONS.INVENTORY_APPROVE_ADJUSTMENT),
    getSession(),
  ])
  const defaultBranchId = session?.user?.branchId ?? null

  if (!canRead) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Adjustments</h1>
          <p className="text-muted-foreground">Adjust stock levels with reason tracking</p>
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">
            You do not have permission to view stock adjustments.
          </p>
        </div>
      </div>
    )
  }

  const firstPage = await getAdjustments({
    page: 1,
    limit: 20,
    branchId: defaultBranchId ?? undefined,
  })

  const safeIso = (d: unknown): string | null => {
    if (!d) return null
    if (d instanceof Date) return d.toISOString()
    if (typeof d === 'string') return d
    try {
      const parsed = new Date(d as string | number)
      return isNaN(parsed.getTime()) ? String(d) : parsed.toISOString()
    } catch {
      return String(d)
    }
  }

  const initialRows: AdjustmentRow[] = firstPage.data.map((a) => ({
    id: a.id,
    branchId: a.branchId,
    productId: a.productId,
    batchId: a.batchId,
    adjustmentType: a.adjustmentType,
    quantity: a.quantity,
    reason: a.reason,
    notes: a.notes,
    status: a.status,
    approvedAt: safeIso(a.approvedAt),
    createdAt: safeIso(a.createdAt) || new Date().toISOString(),
    product: {
      id: a.product.id,
      name: a.product.name,
      sku: a.product.sku,
      rack: a.product.rack || null,
      shelf: a.product.shelf || null,
      box: null,
      mrp: a.product.mrp,
      costPrice: a.product.costPrice,
    },
    branch: { id: a.branch.id, name: a.branch.name, code: a.branch.code },
    createdBy: a.createdBy,
    batch: a.batch
      ? {
          id: a.batch.id,
          batchNumber: a.batch.batchNumber,
          expiryDate: safeIso(a.batch.expiryDate) || new Date().toISOString(),
          purchasePrice: a.batch.purchasePrice,
          mrp: a.batch.mrp,
          quantity: a.batch.quantity,
          supplier: a.batch.supplier,
        }
      : null,
    costImpact: a.costImpact,
    mrpImpact: a.mrpImpact,
    isNearExpiry: a.isNearExpiry,
    isDeadStock: a.isDeadStock,
  }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stock Adjustments</h1>
        <p className="text-muted-foreground">Adjust stock levels with reason tracking</p>
      </div>
      <AdjustmentsView
        initialRows={initialRows}
        initialPagination={firstPage.pagination}
        initialBranchId={defaultBranchId}
        initialSummary={firstPage.summary}
        canAdjust={canAdjust}
        canApprove={canApprove}
      />
    </div>
  )
}
