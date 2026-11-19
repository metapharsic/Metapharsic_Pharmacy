import type { Metadata } from 'next'

import { AgencyPurchasesView } from '@/components/purchases/agency-purchases-view'
import { can, getSession } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { getAgencyPurchases } from '@/lib/purchases/agency-purchase-service'

export const metadata: Metadata = {
  title: 'Agency & Distributor Bills — PharmaCare',
  description: 'Organize purchase bills by distributor agency, audit batch costs, and process returns',
}

export default async function AgencyPurchasesPage() {
  const [canRead, session] = await Promise.all([
    can(PERMISSIONS.PURCHASES_READ),
    getSession(),
  ])

  if (!canRead || !session?.user) {
    return (
      <div className="space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agency Purchase Management</h1>
          <p className="text-muted-foreground">Distributor-wise purchase bills and batch verification</p>
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">You do not have permission to view purchase bills.</p>
        </div>
      </div>
    )
  }

  const initialAgencies = await getAgencyPurchases({
    branchId: session.user.branchId ?? undefined,
  })

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <AgencyPurchasesView initialAgencies={initialAgencies} />
    </div>
  )
}
