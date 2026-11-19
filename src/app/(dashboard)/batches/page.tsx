import type { Metadata } from 'next'

import type { BatchRow } from '@/components/batches/batches-table'
import { BatchesView } from '@/components/batches/batches-view'
import { can, getSession } from '@/lib/auth/auth-helpers'
import { getTenantContext } from '@/lib/auth/tenant-context'
import { getBatches } from '@/lib/batches/batch-service'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Batch Management' }

export default async function BatchManagementPage({
  searchParams,
}: {
  searchParams?: { branchId?: string }
}) {
  const [canRead, session, tenant] = await Promise.all([
    can(PERMISSIONS.BATCHES_READ),
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
    defaultBranchId = session?.user?.branchId ?? undefined
  }

  if (!canRead) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Batch Management</h1>
          <p className="text-muted-foreground">Track product batches with expiry and FEFO logic</p>
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">You do not have permission to view batches.</p>
        </div>
      </div>
    )
  }

  const firstPage = await getBatches({
    page: 1,
    limit: 20,
    branchId: defaultBranchId,
  })

  const initialRows: BatchRow[] = firstPage.data.map((b) => ({
    id: b.id,
    batchNumber: b.batchNumber,
    expiryDate: (b.expiryDate instanceof Date ? b.expiryDate.toISOString() : String(b.expiryDate)),
    manufacturingDate: b.manufacturingDate ? (b.manufacturingDate instanceof Date ? b.manufacturingDate.toISOString() : String(b.manufacturingDate)) : null,
    status: b.status,
    quantity: b.quantity,
    availableQuantity: b.availableQuantity,
    purchasePrice: b.purchasePrice.toString(),
    mrp: b.mrp.toString(),
    product: {
      id: b.product.id,
      name: b.product.name,
      sku: b.product.sku,
      rack: b.product.rack?.code || null,
      shelf: b.product.rack?.shelfNumber || null,
      box: null,
      unitOfMeasure: b.product.unitOfMeasure,
    },
    supplierName: b.supplierName,
    supplierId: (b.supplierId || null),
    rack: b.rack || null,
    shelf: b.shelf || null,
    box: null,
    daysUntilExpiry: b.daysUntilExpiry,
    fefoTier: b.fefoTier,
    isDeadStock: b.isDeadStock,
    valuationAtCost: b.valuationAtCost,
    valuationAtMrp: b.valuationAtMrp,
  }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Batch Management</h1>
        <p className="text-muted-foreground">
          High-standard pharmaceutical batch tracking with FEFO expiry radar, physical Rack & Box storage, dead stock alerts, and vendor exposure.
        </p>
      </div>
      <BatchesView
        initialRows={initialRows}
        initialPagination={firstPage.pagination}
        initialSummary={firstPage.summary}
      />
    </div>
  )
}
