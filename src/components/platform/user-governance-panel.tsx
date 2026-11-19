'use client'

import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Filter,
  KeyRound,
  Lock,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface UserItem {
  id: string
  name: string
  email: string
  phone: string | null
  isActive: boolean
  isSuperAdmin: boolean
  accountStatus: 'ACTIVE' | 'LOCKED' | 'DEACTIVATED'
  failedLoginCount: number
  lockedUntil: string | null
  lastLoginAt: string | null
  createdAt: string
  organization: { id: string; name: string; code: string; status: string } | null
  branch: { id: string; name: string; city: string | null; state: string | null } | null
  roles: { name: string; displayName: string }[]
}

export function UserGovernancePanel() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  // Password reset dialog state
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/platform/users')
      const json = await res.json()
      if (json.success) {
        setUsers(json.users || [])
      } else {
        toast.error(json.error || 'Failed to fetch users')
      }
    } catch {
      toast.error('Network error loading users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleUnlockUser = async (user: UserItem) => {
    try {
      setActionInProgress(user.id)
      const res = await fetch('/api/platform/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlock', userId: user.id }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message)
        fetchUsers()
      } else {
        toast.error(data.error || 'Failed to unlock user')
      }
    } catch {
      toast.error('Error unlocking account')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleLockUser = async (user: UserItem) => {
    try {
      setActionInProgress(user.id)
      const res = await fetch('/api/platform/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock', userId: user.id }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message)
        fetchUsers()
      } else {
        toast.error(data.error || 'Failed to lock user')
      }
    } catch {
      toast.error('Error locking account')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleToggleActive = async (user: UserItem) => {
    try {
      setActionInProgress(user.id)
      const res = await fetch('/api/platform/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-active', userId: user.id }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message)
        fetchUsers()
      } else {
        toast.error(data.error || 'Failed to update account status')
      }
    } catch {
      toast.error('Error updating status')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleOpenResetDialog = (user: UserItem) => {
    setSelectedUser(user)
    // Default auto-generated secure password
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase()
    setNewPassword(`Pharma@${randomHex}#2026`)
    setResetDialogOpen(true)
  }

  const handleConfirmResetPassword = async () => {
    if (!selectedUser || !newPassword) return
    try {
      setActionInProgress(selectedUser.id)
      const res = await fetch('/api/platform/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset-password',
          userId: selectedUser.id,
          newPassword,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message)
        setResetDialogOpen(false)
        fetchUsers()
      } else {
        toast.error(data.error || 'Password reset failed')
      }
    } catch {
      toast.error('Error resetting password')
    } finally {
      setActionInProgress(null)
    }
  }

  const filteredUsers = React.useMemo(() => {
    return users.filter((u) => {
      const matchStatus = filterStatus === 'ALL' || u.accountStatus === filterStatus
      const q = searchQuery.toLowerCase().trim()
      const matchQuery =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.organization?.name || '').toLowerCase().includes(q) ||
        (u.phone || '').includes(q)
      return matchStatus && matchQuery
    })
  }, [users, filterStatus, searchQuery])

  return (
    <div className="space-y-6">
      {/* Top Header & Search Bar */}
      <Card className="border-border/80 shadow-card">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-600" />
                <span>Superadmin Personnel & Account Governance</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Inspect complete account health, lockouts, failed logins, and directly reset passwords or unlock accounts across all pharmacy tenant nodes.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-52 sm:w-64">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search staff, email, shop..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              <div className="flex rounded-md border border-border p-0.5 text-xs bg-muted/40">
                {['ALL', 'ACTIVE', 'LOCKED', 'DEACTIVATED'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFilterStatus(st)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                      filterStatus === st
                        ? 'bg-background shadow-xs text-foreground font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {st === 'ALL' ? 'All Accounts' : st}
                  </button>
                ))}
              </div>

              <Button onClick={fetchUsers} variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-teal-600' : ''}`} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="py-2.5 px-3 text-left">Account Status</th>
                  <th className="py-2.5 px-3 text-left">Staff Name & Contact</th>
                  <th className="py-2.5 px-3 text-left">Chemist Organization & Branch</th>
                  <th className="py-2.5 px-3 text-left">Role Permissions</th>
                  <th className="py-2.5 px-3 text-left">Failed Logins</th>
                  <th className="py-2.5 px-3 text-left">Last Login Time</th>
                  <th className="py-2.5 px-3 text-right">Superadmin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No user accounts found matching your query.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isBusy = actionInProgress === u.id
                    return (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        {/* Account Status Badge */}
                        <td className="py-3 px-3">
                          {u.accountStatus === 'ACTIVE' && (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold gap-1 text-[10px]">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>ACTIVE</span>
                            </Badge>
                          )}
                          {u.accountStatus === 'LOCKED' && (
                            <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-bold gap-1 text-[10px]">
                              <ShieldAlert className="h-3 w-3" />
                              <span>LOCKED OUT</span>
                            </Badge>
                          )}
                          {u.accountStatus === 'DEACTIVATED' && (
                            <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30 font-medium gap-1 text-[10px]">
                              <UserX className="h-3 w-3" />
                              <span>DEACTIVATED</span>
                            </Badge>
                          )}
                          {u.isSuperAdmin && (
                            <div className="mt-1">
                              <Badge variant="outline" className="text-[9px] uppercase font-bold text-amber-600 border-amber-500/40">
                                Super-Admin
                              </Badge>
                            </div>
                          )}
                        </td>

                        {/* Staff Name & Contact */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-foreground">{u.name}</div>
                          <div className="text-[11px] text-muted-foreground">{u.email}</div>
                          {u.phone && <div className="text-[10px] text-slate-400 font-mono">{u.phone}</div>}
                        </td>

                        {/* Organization & Branch */}
                        <td className="py-3 px-3">
                          <div className="font-medium text-foreground">{u.organization?.name || 'Metapharsic Core System'}</div>
                          <div className="text-[11px] text-muted-foreground">{u.branch?.name || 'Main Dispensary'}</div>
                        </td>

                        {/* Roles */}
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1">
                            {u.roles.map((r) => (
                              <Badge key={r.name} variant="outline" className="text-[10px] font-medium bg-muted/40">
                                {r.displayName}
                              </Badge>
                            ))}
                          </div>
                        </td>

                        {/* Failed Logins */}
                        <td className="py-3 px-3">
                          {u.failedLoginCount > 0 ? (
                            <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                              {u.failedLoginCount} failed attempts
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-mono">0</span>
                          )}
                        </td>

                        {/* Last Login Time */}
                        <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {u.lastLoginAt ? (
                            new Date(u.lastLoginAt).toLocaleString('en-IN', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          ) : (
                            <span className="text-slate-400 italic">Never logged in</span>
                          )}
                        </td>

                        {/* Superadmin Actions */}
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Unlock / Lock Toggle */}
                            {u.accountStatus === 'LOCKED' ? (
                              <Button
                                onClick={() => handleUnlockUser(u)}
                                disabled={isBusy}
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1 font-semibold"
                              >
                                <Unlock className="h-3 w-3" />
                                <span>Unlock</span>
                              </Button>
                            ) : (
                              <Button
                                onClick={() => handleLockUser(u)}
                                disabled={isBusy || u.isSuperAdmin}
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] border-rose-500/40 text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1"
                              >
                                <Lock className="h-3 w-3" />
                                <span>Lock</span>
                              </Button>
                            )}

                            {/* Reset Password */}
                            <Button
                              onClick={() => handleOpenResetDialog(u)}
                              disabled={isBusy}
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] border-teal-500/40 text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40 gap-1 font-semibold"
                            >
                              <KeyRound className="h-3 w-3" />
                              <span>Reset Pass</span>
                            </Button>

                            {/* Activate / Deactivate Toggle */}
                            <Button
                              onClick={() => handleToggleActive(u)}
                              disabled={isBusy || u.isSuperAdmin}
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                              title={u.isActive ? 'Deactivate Account' : 'Activate Account'}
                            >
                              {u.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5 text-emerald-600" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* PASSWORD RESET MODAL */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-teal-600" />
              <span>Reset Staff Password</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Override and immediately set a verified password for{' '}
              <strong className="text-foreground">{selectedUser?.name}</strong> ({selectedUser?.email}). This unlocks the account and clears all lockout counters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="superadmin-pass" className="text-xs font-semibold">
                New Authorized Password
              </Label>
              <div className="flex gap-2">
                <Input
                  id="superadmin-pass"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="font-mono text-sm tracking-wide"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const rnd = Math.random().toString(36).substring(2, 6).toUpperCase()
                    setNewPassword(`Pharma@${rnd}#2026`)
                  }}
                  className="text-xs whitespace-nowrap"
                >
                  Regenerate
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-teal-500/30 bg-teal-50/50 p-2.5 text-xs text-teal-800 dark:bg-teal-950/20 dark:text-teal-300">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                <p>
                  The user can immediately sign in with this new password on any dispensary counter or POS terminal.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmResetPassword}
              disabled={!newPassword || newPassword.length < 6}
              className="bg-teal-600 hover:bg-teal-700 text-white font-medium"
            >
              Apply New Password & Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
