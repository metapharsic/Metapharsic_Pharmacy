'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Shield, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { RoleList, type RoleRow } from '@/components/roles/role-list'
import { PermissionMatrix } from '@/components/roles/permission-matrix'
import { useToast } from '@/lib/hooks/use-toast'

export function RoleManagementClient() {
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null)
  const [roleName, setRoleName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/roles')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setRoles(json.data)
      } else {
        toast.error('Failed to load system roles')
      }
    } catch {
      toast.error('Network error loading roles')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  const handleOpenAdd = () => {
    setEditingRole(null)
    setRoleName('')
    setDisplayName('')
    setDescription('')
    setSelectedPermissionIds([])
    setDialogOpen(true)
  }

  const handleOpenEdit = (role: RoleRow) => {
    setEditingRole(role)
    setRoleName(role.name)
    setDisplayName(role.displayName)
    setDescription(role.description || '')
    setSelectedPermissionIds(role.rolePermissions.map((rp) => rp.permission.id))
    setDialogOpen(true)
  }

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      toast.error('Display name is required')
      return
    }

    setSaving(true)
    try {
      if (editingRole) {
        // Update existing role
        const res = await fetch(`/api/roles/${editingRole.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName,
            description,
            permissionIds: selectedPermissionIds,
          }),
        })
        const data = await res.json()
        if (data.success) {
          toast.success('Role updated successfully')
          setDialogOpen(false)
          fetchRoles()
        } else {
          toast.error(data.error?.message || 'Failed to update role')
        }
      } else {
        // Create new role
        const generatedName = roleName.trim()
          ? roleName.trim().toLowerCase().replace(/\s+/g, '_')
          : displayName.trim().toLowerCase().replace(/\s+/g, '_')

        const res = await fetch('/api/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: generatedName,
            displayName,
            description,
            permissionIds: selectedPermissionIds,
          }),
        })
        const data = await res.json()
        if (data.success) {
          toast.success('Role created successfully')
          setDialogOpen(false)
          fetchRoles()
        } else {
          toast.error(data.error?.message || 'Failed to create role')
        }
      }
    } catch {
      toast.error('Network error saving role')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 pt-4">
          <RoleList
            roles={roles}
            isLoading={loading}
            onAddRole={handleOpenAdd}
            onEditRole={handleOpenEdit}
            onRefresh={fetchRoles}
          />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? `Edit Role: ${editingRole.displayName}` : 'Create Custom Role'}
            </DialogTitle>
            <DialogDescription>
              {editingRole?.isSystem
                ? 'System roles have locked core permissions for security compliance.'
                : 'Define role details and select granular system permissions.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRole} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Chief Pharmacist"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="roleName">Identifier Key</Label>
                <Input
                  id="roleName"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g. chief_pharmacist"
                  disabled={Boolean(editingRole)}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Responsibilities and access scope..."
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-sm">Granted Permissions ({selectedPermissionIds.length})</Label>
                <span className="text-[11px] text-muted-foreground">
                  Click badges to toggle privileges
                </span>
              </div>
              <div className="rounded-lg border border-border/70 p-3 max-h-72 overflow-y-auto bg-muted/20">
                <PermissionMatrix
                  grantedIds={selectedPermissionIds}
                  onChange={setSelectedPermissionIds}
                  readOnly={editingRole?.isSystem}
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || editingRole?.isSystem}>
                {saving ? 'Saving...' : editingRole ? 'Save Changes' : 'Create Role'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
