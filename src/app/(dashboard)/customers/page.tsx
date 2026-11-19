import type { Metadata } from 'next'

import { CustomersView } from '@/components/customers/customers-view'
import { can, getSession } from '@/lib/auth/auth-helpers'
import { getTenantContext } from '@/lib/auth/tenant-context'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { listCustomers } from '@/lib/customers/customer-service'

export const metadata: Metadata = {
  title: 'Customer & Patient Register — PharmaCare',
  description: 'Manage patient profiles, clinical discount tiers, and credit ledgers',
}

export default async function CustomersPage() {
  const [canRead, session, tenant] = await Promise.all([
    can(PERMISSIONS.CUSTOMERS_READ),
    getSession(),
    getTenantContext(),
  ])

  if (!canRead || !session?.user) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customer & Patient Register</h1>
          <p className="text-muted-foreground">Manage patient profiles, clinical discount tiers, and credit ledgers</p>
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">You do not have permission to view customer records.</p>
        </div>
      </div>
    )
  }

  const organizationId = tenant?.organizationId ?? session.user.organizationId ?? undefined
  const initialData = await listCustomers({
    page: 1,
    limit: 20,
    ...(organizationId ? { organizationId } : {}),
  } as any)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customer & Patient Register</h1>
        <p className="text-muted-foreground">
          Track patient clinical categories, senior/chronic discount tiers, and credit accounts.
        </p>
      </div>

      <CustomersView
        initialRows={initialData.data}
        initialPagination={initialData.pagination}
      />
    </div>
  )
}
