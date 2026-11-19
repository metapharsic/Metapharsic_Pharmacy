import type { Metadata } from 'next'
import { RoleManagementClient } from '@/components/roles/role-management-client'

export const metadata: Metadata = { title: 'Roles & Permissions | PharmaCare' }

export default function RolesPermissionsPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 border-b border-border/60 pb-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Roles & Permissions</h1>
        <p className="text-xs text-muted-foreground">
          Define access control roles, manage system privileges, and inspect security assignments
        </p>
      </div>

      <RoleManagementClient />
    </div>
  )
}
