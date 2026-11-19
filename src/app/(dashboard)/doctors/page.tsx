import type { Metadata } from 'next'

import { DoctorManagementView } from '@/components/doctors/doctor-management-view'
import { can, getSession } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = {
  title: 'Doctor Masters & Prescribers — PharmaCare',
  description: 'Manage prescribing doctor profiles, clinic associations, and commission rates.',
}

export default async function DoctorsPage() {
  const [canReadSales, session] = await Promise.all([
    can(PERMISSIONS.SALES_READ),
    getSession(),
  ])

  if (!canReadSales || !session?.user) {
    return (
      <div className="space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prescribing Doctor Masters</h1>
          <p className="text-muted-foreground">Manage practitioners, registrations, and referral commissions</p>
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">You do not have permission to view doctors.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <DoctorManagementView />
    </div>
  )
}
