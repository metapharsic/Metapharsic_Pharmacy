import type { Metadata } from 'next'

import { TallyExportHub } from '@/components/tally/tally-export-hub'
import { getSession } from '@/lib/auth/auth-helpers'
import { getAccessibleBranches } from '@/lib/inventory/branch-access'
import { getTallyConfig } from '@/lib/tally/tally-service'

export const metadata: Metadata = {
  title: 'Ledger & Accounts Sync',
}

export default async function TallyPage() {
  const session = await getSession()

  if (!session?.user) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ledger & Accounts Sync</h1>
          <p className="text-muted-foreground">
            Export vouchers and masters for ledger & accounting synchronization
          </p>
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">Please sign in to access ledger export tools.</p>
        </div>
      </div>
    )
  }

  const [config, branches] = await Promise.all([
    getTallyConfig(),
    getAccessibleBranches({ id: session.user.id, branchId: session.user.branchId }),
  ])

  return (
    <TallyExportHub
      initialConfig={config}
      branches={branches.map((b) => ({ id: b.id, name: b.name, code: b.code }))}
    />
  )
}
