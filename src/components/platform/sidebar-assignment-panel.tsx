'use client'

import React, { useEffect, useState } from 'react'
import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileCode,
  FileText,
  Layers,
  LayoutDashboard,
  Lock,
  Package,
  Pill,
  Receipt,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ALL_SIDEBAR_MODULES, ROLE_PRESETS } from '@/lib/platform/sidebar-assignment-service'

interface UserItem {
  id: string
  name: string
  email: string
  roles: { name: string; displayName: string }[]
  organization: { name: string; code: string } | null
}

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  ShoppingCart,
  Pill,
  BarChart3,
  Truck,
  Receipt,
  RotateCcw,
  AlertTriangle,
  BadgeDollarSign,
  ShieldAlert,
  Settings,
  Shield,
}

export function SidebarAssignmentPanel() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [isCustomAssigned, setIsCustomAssigned] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchUserQuery, setSearchUserQuery] = useState('')

  // 1. Fetch all users
  const loadUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/platform/users')
      const json = await res.json()
      if (json.success && Array.isArray(json.users)) {
        setUsers(json.users)
        if (json.users.length > 0 && !selectedUserId) {
          selectUser(json.users[0])
        }
      }
    } catch {
      toast.error('Failed to load users for sidebar delegation')
    } finally {
      setLoading(false)
    }
  }

  // 2. Fetch specific user's assigned modules
  const selectUser = async (user: UserItem) => {
    setSelectedUserId(user.id)
    setSelectedUser(user)
    try {
      const res = await fetch(`/api/platform/sidebar-assignments?userId=${user.id}`)
      const json = await res.json()
      if (json.success) {
        setSelectedModules(json.modules || [])
        setIsCustomAssigned(Boolean(json.isCustomAssigned))
      }
    } catch {
      toast.error('Failed to load user module assignment')
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  // Toggle single module
  const toggleModule = (key: string) => {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
    )
    setIsCustomAssigned(true)
  }

  // Apply Role Preset
  const applyPreset = (presetName: string) => {
    const preset = ROLE_PRESETS[presetName]
    if (preset) {
      setSelectedModules([...preset])
      setIsCustomAssigned(true)
      toast.info(`Applied ${presetName.toUpperCase()} preset (${preset.length} modules)`)
    }
  }

  const selectAll = () => {
    setSelectedModules(ALL_SIDEBAR_MODULES.map((m) => m.key))
    setIsCustomAssigned(true)
  }

  const clearAll = () => {
    setSelectedModules(['pos']) // Keep POS as bare minimum
    setIsCustomAssigned(true)
  }

  // Save changes
  const handleSave = async () => {
    if (!selectedUserId) return
    try {
      setSaving(true)
      const res = await fetch('/api/platform/sidebar-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          userId: selectedUserId,
          modules: selectedModules,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message)
        setIsCustomAssigned(true)
      } else {
        toast.error(data.error || 'Failed to save sidebar modules')
      }
    } catch {
      toast.error('Network error saving sidebar assignment')
    } finally {
      setSaving(false)
    }
  }

  // Reset to default
  const handleResetToDefault = async () => {
    if (!selectedUserId) return
    try {
      setSaving(true)
      const res = await fetch('/api/platform/sidebar-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset',
          userId: selectedUserId,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message)
        if (selectedUser) {
          selectUser(selectedUser)
        }
      } else {
        toast.error(data.error || 'Reset failed')
      }
    } catch {
      toast.error('Error resetting sidebar')
    } finally {
      setSaving(false)
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = searchUserQuery.toLowerCase().trim()
    return (
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.organization?.name || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card className="border-border/80 shadow-card">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="h-4 w-4 text-teal-600" />
                <span>Superadmin Sidebar & Module Access Delegation</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Dynamically assign, curate, or restrict navigation sidebar modules for individual dispensary staff and roles across any chemist shop.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleResetToDefault}
                disabled={saving || !isCustomAssigned}
                variant="outline"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                Reset to Role Preset
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !selectedUserId}
                size="sm"
                className="h-8 text-xs gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-medium"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saving ? 'Applying...' : 'Apply & Save Sidebar'}</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT COLUMN: User Selector List (4 cols) */}
            <div className="lg:col-span-4 space-y-3 border rounded-lg p-3 bg-muted/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Target Staff</span>
                <span className="text-[11px] text-muted-foreground font-mono">{filteredUsers.length} Users</span>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter by name, email, shop..."
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-input bg-background shadow-xs focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-1">
                {filteredUsers.map((u) => {
                  const isSelected = u.id === selectedUserId
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => selectUser(u)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-950/40 text-foreground shadow-xs'
                          : 'border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-foreground truncate">{u.name}</span>
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 shrink-0" />}
                      </div>
                      <div className="text-[11px] truncate opacity-85">{u.email}</div>
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-border/40 text-[10px]">
                        <span className="truncate max-w-[130px] font-medium">{u.organization?.name || 'Metapharsic Core'}</span>
                        <span className="font-mono text-teal-600 dark:text-teal-400">
                          {u.roles[0]?.displayName || u.roles[0]?.name || 'Staff'}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* RIGHT COLUMN: Modules Selector & Live Mockup (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {/* Selected User Header & Presets Bar */}
              {selectedUser && (
                <div className="p-3.5 rounded-lg border border-teal-500/30 bg-teal-50/30 dark:bg-teal-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{selectedUser.name}</span>
                      <Badge variant="outline" className="text-[10px] bg-background">
                        {selectedUser.organization?.name}
                      </Badge>
                      {isCustomAssigned ? (
                        <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 text-[9px] font-bold">
                          Custom Assigned
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 text-[9px] font-bold">
                          Role Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Configuring {selectedModules.length} of {ALL_SIDEBAR_MODULES.length} accessible sidebar navigation modules.
                    </p>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground mr-1">Presets:</span>
                    <button
                      type="button"
                      onClick={() => applyPreset('cashier')}
                      className="px-2 py-0.5 rounded text-[10px] font-bold border border-border hover:bg-background transition-colors"
                    >
                      Cashier (3)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('pharmacist')}
                      className="px-2 py-0.5 rounded text-[10px] font-bold border border-border hover:bg-background transition-colors"
                    >
                      Pharmacist (6)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('manager')}
                      className="px-2 py-0.5 rounded text-[10px] font-bold border border-border hover:bg-background transition-colors"
                    >
                      Manager (10)
                    </button>
                    <button
                      type="button"
                      onClick={selectAll}
                      className="px-2 py-0.5 rounded text-[10px] font-bold border border-teal-500/40 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors"
                    >
                      Select All
                    </button>
                  </div>
                </div>
              )}

              {/* 12 Module Checkbox Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ALL_SIDEBAR_MODULES.map((mod) => {
                  const isChecked = selectedModules.includes(mod.key)
                  const Icon = ICON_MAP[mod.iconName] || Layers

                  return (
                    <div
                      key={mod.key}
                      onClick={() => toggleModule(mod.key)}
                      className={`p-3 rounded-lg border cursor-pointer select-none transition-all ${
                        isChecked
                          ? 'border-teal-500/80 bg-teal-50/20 dark:bg-teal-950/20 shadow-xs'
                          : 'border-border/60 hover:border-border opacity-65 bg-background'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`p-1.5 rounded-md ${
                              isChecked ? 'bg-teal-500/20 text-teal-700 dark:text-teal-300' : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-foreground">{mod.label}</div>
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                              {mod.category}
                            </span>
                          </div>
                        </div>

                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Handled by parent div
                          className="h-4 w-4 rounded border-border text-teal-600 focus:ring-teal-500 cursor-pointer mt-0.5"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                        {mod.description}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
