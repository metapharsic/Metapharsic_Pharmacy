import type { Metadata } from 'next'
import { UserManagementClient } from '@/components/users/user-management-client'

export const metadata: Metadata = { title: 'User Management | PharmaCare' }

export default function UserManagementPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 border-b border-border/60 pb-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">User Management</h1>
        <p className="text-xs text-muted-foreground">
          Manage system staff accounts, dispensary cashier profiles, and role assignments
        </p>
      </div>

      <UserManagementClient />
    </div>
  )
}
