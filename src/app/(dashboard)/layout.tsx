import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar'
import { PosFloatingRestore } from '@/components/pos/pos-floating-restore'
import { getSession } from '@/lib/auth/auth-helpers'
import { ROUTES } from '@/lib/constants/routes'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (!session) {
    redirect(ROUTES.LOGIN)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background relative">
      <div className="app-watermark-overlay" aria-hidden="true" />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden relative z-10">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 relative">
          {children}
        </main>
        <PosFloatingRestore />
      </div>
    </div>
  )
}
