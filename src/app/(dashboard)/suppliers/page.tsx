import type { Metadata } from 'next'

import { SuppliersView } from '@/components/suppliers/suppliers-view'
import { can, getSession } from '@/lib/auth/auth-helpers'
import { getTenantContext } from '@/lib/auth/tenant-context'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { getSupplierMasterList } from '@/lib/suppliers/supplier-management-service'

export const metadata: Metadata = { title: 'Supplier Master Management — PharmaCare' }

export default async function SuppliersPage() {
  const [canRead, session, tenant] = await Promise.all([
    can(PERMISSIONS.SUPPLIERS_READ),
    getSession(),
    getTenantContext(),
  ])

  if (!canRead || !session?.user) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground">Manage supplier database and payables</p>
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">You do not have permission to view suppliers.</p>
        </div>
      </div>
    )
  }

  const organizationId = tenant?.organizationId ?? session.user.organizationId ?? undefined
  const { suppliers, stats } = await getSupplierMasterList({
    organizationId,
  } as any)

  return <SuppliersView initialMasterList={suppliers} initialStats={stats} />
}
