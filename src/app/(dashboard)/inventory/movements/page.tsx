import type { Metadata } from 'next'

import type { MovementRow } from '@/components/inventory/movements-table'
import { MovementsView } from '@/components/inventory/movements-view'
import { can, getSession } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { getMovements } from '@/lib/inventory/inventory-service'

export const metadata: Metadata = { title: 'Inventory Movements' }

export default async function InventoryMovementsPage({
  searchParams,
}: {
  searchParams?: { branchId?: string; categoryId?: string }
}) {
  const [canRead, session] = await Promise.all([can(PERMISSIONS.INVENTORY_READ), getSession()])
  const defaultBranchId = session?.user?.branchId ?? null

  if (!canRead) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Movements</h1>
          <p className="text-muted-foreground">View all stock movement history</p>
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">
            You do not have permission to view inventory movements.
          </p>
        </div>
      </div>
    )
  }

  const firstPage = await getMovements({
    page: 1,
    limit: 20,
    branchId: defaultBranchId ?? undefined,
  })

  const initialRows: MovementRow[] = firstPage.data.map((m) => ({
    id: m.id,
    inventoryId: m.inventoryId,
    type: m.type,
    quantity: m.quantity,
    quantityBefore: m.quantityBefore,
    quantityAfter: m.quantityAfter,
    referenceType: m.referenceType,
    referenceId: m.referenceId,
    batchId: m.batchId,
    notes: m.notes,
    createdAt: typeof m.createdAt === 'string' ? m.createdAt : m.createdAt.toISOString(),
    inventory: {
      productId: m.inventory.productId,
      product: {
        id: m.inventory.product.id,
        name: m.inventory.product.name,
        sku: m.inventory.product.sku,
        unitOfMeasure: m.inventory.product.unitOfMeasure,
        rack: m.inventory.product.rack || null,
        shelf: m.inventory.product.shelf || null,
        box: null,
        costPrice: m.inventory.product.costPrice ? Number(m.inventory.product.costPrice) : undefined,
        mrp: m.inventory.product.mrp ? Number(m.inventory.product.mrp) : undefined,
      },
      branch: {
        id: m.inventory.branch.id,
        name: m.inventory.branch.name,
        code: m.inventory.branch.code,
      },
    },
    batch: m.batch
      ? {
          id: m.batch.id,
          batchNumber: m.batch.batchNumber,
          expiryDate: typeof m.batch.expiryDate === 'string' ? m.batch.expiryDate : m.batch.expiryDate.toISOString(),
          mrp: m.batch.mrp ? Number(m.batch.mrp) : undefined,
          purchasePrice: m.batch.purchasePrice ? Number(m.batch.purchasePrice) : undefined,
          supplierId: (m.batch.supplierId || null),
          supplier: m.batch.supplier ? { id: m.batch.supplier.id, name: m.batch.supplier.name } : null,
        }
      : null,
    unitCost: m.unitCost,
    unitMrp: m.unitMrp,
    costValuation: m.costValuation,
    mrpValuation: m.mrpValuation,
    isNearExpiry: m.isNearExpiry,
    isExpired: m.isExpired,
    daysToExpiry: m.daysToExpiry,
    isDeadStock: m.isDeadStock,
    supplierName: m.supplierName,
    supplierId: (m.supplierId || null),
    rack: m.rack || m.inventory?.product?.rack || null,
    shelf: m.shelf || m.inventory?.product?.shelf || null,
    box: m.box || m.inventory.product.box || null,
  }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventory Movements</h1>
        <p className="text-muted-foreground">View all stock movement history</p>
      </div>
      <MovementsView
        initialRows={initialRows}
        initialPagination={firstPage.pagination}
        initialBranchId={defaultBranchId}
      />
    </div>
  )
}
