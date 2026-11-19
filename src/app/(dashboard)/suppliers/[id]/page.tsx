import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SupplierProfileView } from '@/components/suppliers/supplier-profile-view'
import { can, getSession } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { getSupplierProfile } from '@/lib/suppliers/supplier-management-service'

export const metadata: Metadata = { title: 'Supplier Profile & Governance' }

interface SupplierProfilePageProps {
  params: { id: string }
}

export default async function SupplierProfilePage({ params }: SupplierProfilePageProps) {
  const [canRead, session] = await Promise.all([
    can(PERMISSIONS.SUPPLIERS_READ),
    getSession(),
  ])

  if (!canRead || !session?.user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Supplier Profile</h1>
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted">
          <p className="text-muted-foreground">You do not have permission to view suppliers.</p>
        </div>
      </div>
    )
  }

  const profile = await getSupplierProfile(params.id)

  if (!profile) {
    notFound()
  }

  return <SupplierProfileView initialProfile={profile} />
}
