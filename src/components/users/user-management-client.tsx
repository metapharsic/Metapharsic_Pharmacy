'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { UserTable, type UserRow } from '@/components/users/user-table'
import { UserForm } from '@/components/users/user-form'
import { useToast } from '@/lib/hooks/use-toast'

export function UserManagementClient() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const toast = useToast()

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users?limit=100')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setUsers(json.data)
      } else {
        toast.error('Failed to load user accounts')
      }
    } catch {
      toast.error('Network error loading users')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleOpenAdd = () => {
    setEditingUser(null)
    setFormOpen(true)
  }

  const handleOpenEdit = (user: UserRow) => {
    setEditingUser(user)
    setFormOpen(true)
  }

  const handleFormSuccess = () => {
    setFormOpen(false)
    setEditingUser(null)
    fetchUsers()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 pt-4">
          <UserTable
            users={users}
            isLoading={loading}
            onAddUser={handleOpenAdd}
            onEditUser={handleOpenEdit}
            onRefresh={fetchUsers}
          />
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Edit User Account' : 'Create New User Account'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Update credentials, roles, and branch assignment for this user.'
                : 'Configure user credentials, contact details, and assigned roles.'}
            </DialogDescription>
          </DialogHeader>

          <UserForm
            initialData={
              editingUser
                ? {
                    id: editingUser.id,
                    name: editingUser.name,
                    email: editingUser.email,
                    phone: editingUser.phone,
                    branchId: editingUser.branchId,
                    isActive: editingUser.isActive,
                    userRoles: editingUser.userRoles,
                  }
                : undefined
            }
            onSuccess={handleFormSuccess}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
