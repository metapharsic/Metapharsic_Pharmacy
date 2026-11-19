import type { Metadata } from 'next'

import { InventoryOverview } from '@/components/inventory/inventory-overview'
import { InventoryPageHeader } from '@/components/inventory/inventory-page-header'
import type { InventoryRow } from '@/components/inventory/inventory-table'
import { can, getSession } from '@/lib/auth/auth-helpers'
import { getTenantContext } from '@/lib/auth/tenant-context'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { getInventory, getInventorySummary } from '@/lib/inventory/inventory-service'

export const metadata: Metadata = { title: 'Inventory Management · MPharm PharmaCare' }

export default async function InventoryManagementPage({
  searchParams,
}: {
  searchParams?: { branchId?: string; categoryId?: string; status?: string }
}) {
  const [canRead, canAdjust, canApprove, session, tenant] = await Promise.all([
    can(PERMISSIONS.INVENTORY_READ),
    can(PERMISSIONS.INVENTORY_ADJUST),
    can(PERMISSIONS.INVENTORY_APPROVE_ADJUSTMENT),
    getSession(),
    getTenantContext(),
  ])

  let defaultBranchId: string | undefined = undefined
  if (tenant?.organizationId) {
    if (searchParams?.branchId) {
      if (tenant.orgBranchIds.includes(searchParams.branchId)) {
        defaultBranchId = searchParams.branchId
      } else {
        defaultBranchId = tenant.branchId ?? (tenant.orgBranchIds[0] ?? '__no_such_branch__')
      }
    } else {
      defaultBranchId = tenant.branchId ?? (tenant.orgBranchIds[0] ?? '__no_such_branch__')
    }
  } else {
    defaultBranchId = searchParams?.branchId || session?.user?.branchId || undefined
  }

  const categoryId = searchParams?.categoryId || undefined
  const status = searchParams?.status || undefined

  if (!canRead) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Management</h1>
          <p className="text-muted-foreground">Real-time stock tracking across all products</p>
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">You do not have permission to view inventory.</p>
        </div>
      </div>
    )
  }

  const orgFilter = session?.user?.isSuperAdmin
    ? undefined
    : (tenant?.organizationId || session?.user?.organizationId || '__NO_ACCESS__')

  const [firstPage, initialSummary] = await Promise.all([
    getInventory({
      page: 1,
      limit: 20,
      branchId: defaultBranchId,
      categoryId,
      status,
      organizationId: orgFilter,
    }),
    getInventorySummary(defaultBranchId, categoryId, orgFilter).catch(() => null),
  ])

  const initialRows: InventoryRow[] = firstPage.data.map((p) => ({
    id: p.id,
    productId: p.productId,
    branchId: p.branchId,
    totalQuantity: p.totalQuantity,
    reservedQuantity: p.reservedQuantity,
    availableQuantity: p.availableQuantity,
    updatedAt: p.updatedAt.toISOString(),
    stockStatus: p.stockStatus,
    product: {
      id: p.product.id,
      name: p.product.name,
      nameAr: (p.product as any).nameAr || null,
      genericName: (p.product as any).genericName || null,
      genericNameAr: (p.product as any).genericNameAr || null,
      sku: p.product.sku,
      barcode: p.product.barcode,
      rack: p.product.rack || null,
      shelf: p.product.shelf || null,
      box: null,
      unitOfMeasure: p.product.unitOfMeasure,
      reorderLevel: p.product.reorderLevel,
      maxStockLevel: p.product.maxStockLevel,
    },
    branch: { id: p.branch.id, name: p.branch.name, code: p.branch.code },
  }))

  return (
    <div className="space-y-4">
      <InventoryPageHeader />
      <InventoryOverview
        initialRows={initialRows}
        initialPagination={firstPage.pagination}
        initialBranchId={defaultBranchId ?? null}
        initialCategoryId={categoryId ?? "all"}
        initialSummary={initialSummary}
        canAdjust={canAdjust}
        canApprove={canApprove}
      />
    </div>
  )
}
