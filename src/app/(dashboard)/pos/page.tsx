import type { Metadata } from 'next'
import { ShieldAlert } from 'lucide-react'

import { PosContainer } from '@/components/pos/pos-container'
import { getSession } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'POS — Billing' }

export default async function PosPage() {
  const session = await getSession()

  const hasAccess =
    session?.user &&
    (session.user.roles?.includes('owner') ||
      session.user.permissions?.includes(PERMISSIONS.SALES_CREATE))

  if (!hasAccess) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <div className="max-w-md text-center p-8 rounded-xl border border-border/80 bg-card shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="mb-2 text-xl font-bold tracking-tight">Point of Sale Access Restricted</h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your current account role does not hold the active dispensing privilege. Please consult your administrator to assign the{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-teal-700 dark:text-teal-300">sales:create</code> permission.
          </p>
        </div>
      </div>
    )
  }

  return <PosContainer />
}
