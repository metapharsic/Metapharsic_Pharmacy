'use client'

import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  CheckSquare,
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
  UserPlus,
  UserX,
  Users,
  Globe,
  Server,
  Cloud,
  Layers,
  Settings2,
  Sparkles,
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
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TerritoryCode } from '@/lib/territory/territory-config'

interface UserItem {
  id: string
  name: string
  email: string
  phone: string | null
  isActive: boolean
  isSuperAdmin: boolean
  mfaEnabled: boolean
  mustChangePassword: boolean
  accountStatus: 'ACTIVE' | 'LOCKED' | 'DEACTIVATED'
  failedLoginCount: number
  lockedUntil: string | null
  lastLoginAt: string | null
  createdAt: string
  organization: { id: string; name: string; code: string; status: string; country?: string; currency?: string } | null
  branch: { id: string; name: string; city: string | null; state: string | null } | null
  roles: { name: string; displayName: string }[]
  territories: string[]
  assignedPrivateNode: string
  ipRestrictionEnabled: boolean
}

// Sovereign system roles available for assignment
const AVAILABLE_ROLES = [
  { name: 'super_admin', label: 'Platform SuperAdmin', badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30', desc: 'Global sovereign command & private cloud administration' },
  { name: 'territory_admin', label: 'Territory Admin', badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30', desc: 'Dedicated in-country private cloud governor' },
  { name: 'compliance_officer', label: 'Compliance Officer', badge: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30', desc: 'NDMO / PDPL / ODP statutory residency auditor' },
  { name: 'tax_auditor', label: 'Tax & ZATCA Auditor', badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', desc: 'ZATCA Phase 2 clearance & hash chain auditor' },
  { name: 'chief_pharmacist', label: 'Chief Pharmacist', badge: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30', desc: 'Narcotics ledger & clinical schedule controller' },
  { name: 'owner', label: 'Pharmacy Owner', badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30', desc: 'Commercial owner & organizational administrator' },
  { name: 'manager', label: 'Store Manager', badge: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30', desc: 'Dispensary operations & shift supervisor' },
  { name: 'pharmacist', label: 'Pharmacist', badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', desc: 'Prescription validation & dispensary chemist' },
  { name: 'cashier', label: 'Cashier', badge: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30', desc: 'Point of sale clearance & customer checkouts' },
]

// 6 Sovereign nations
const SOVEREIGN_NATIONS: Array<{ code: TerritoryCode; name: string; flag: string; regulator: string }> = [
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', regulator: 'ZATCA / SFDA / NDMO' },
  { code: 'OM', name: 'Sultanate of Oman', flag: '🇴🇲', regulator: 'Oman Data Park / RD 6/2022' },
  { code: 'BH', name: 'Kingdom of Bahrain', flag: '🇧🇭', regulator: 'NHRA / Law No. 30' },
  { code: 'QA', name: 'State of Qatar', flag: '🇶🇦', regulator: 'MoPH / Law No. 13' },
  { code: 'MV', name: 'Republic of Maldives', flag: '🇲🇻', regulator: 'MIRA / Aasandha' },
  { code: 'IN', name: 'Republic of India', flag: '🇮🇳', regulator: 'DPDPA 2023 / CDSCO' },
]

export function UserGovernancePanel() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  // Organizations list for personnel assignment
  const [orgList, setOrgList] = useState<Array<{ id: string; name: string; code: string; country?: string }>>([])

  // Create Sovereign Staff Dialog State
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [creatingUser, setCreatingUser] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: 'Sovereign@2026',
    organizationId: '',
    territoryCode: 'SA' as TerritoryCode,
    assignedPrivateNode: 'SA',
    roleNames: ['pharmacist'],
    isSuperAdmin: false,
    mfaEnabled: false,
    ipRestrictionEnabled: false,
    autoProvision5Phases: true,
    privateCloudVpcId: 'vpc-sa-sovereign-pod-999-prod',
  })

  // Provision Main Dispensary Dialog State
  const [provisionMainOpen, setProvisionMainOpen] = useState(false)
  const [provisionMainTerritory, setProvisionMainTerritory] = useState<TerritoryCode>('SA')
  const [provisionMainVpc, setProvisionMainVpc] = useState('vpc-sa-sovereign-pod-999-prod')
  const [provisioningMain, setProvisioningMain] = useState(false)

  // Password reset dialog state
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)
  const [newPassword, setNewPassword] = useState('')

  // Role & Sovereign Matrix Governance Dialog State
  const [governanceDialogOpen, setGovernanceDialogOpen] = useState(false)
  const [targetGovUser, setTargetGovUser] = useState<UserItem | null>(null)
  const [govRoles, setGovRoles] = useState<string[]>([])
  const [govTerritories, setGovTerritories] = useState<string[]>([])
  const [govPrivateNode, setGovPrivateNode] = useState<string>('SA')
  const [govIsSuperAdmin, setGovIsSuperAdmin] = useState(false)
  const [govMfaEnabled, setGovMfaEnabled] = useState(false)
  const [govMustChangePassword, setGovMustChangePassword] = useState(false)
  const [govIpRestriction, setGovIpRestriction] = useState(false)
  const [savingGovernance, setSavingGovernance] = useState(false)

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

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/platform/organizations')
      const json = await res.json()
      if (json.organizations && Array.isArray(json.organizations)) {
        setOrgList(json.organizations)
        // Auto-select main organization if none selected
        const main = json.organizations.find((o: any) => o.code === 'DEFAULT' || o.id === 'default-org') || json.organizations[0]
        if (main) {
          setCreateForm((prev) => ({ ...prev, organizationId: prev.organizationId || main.id }))
        }
      }
    } catch {
      // Non-blocking fallback
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchOrganizations()
  }, [])

  const handleCreateTerritoryChange = (terr: TerritoryCode) => {
    const vpcMap: Record<TerritoryCode, string> = {
      SA: 'vpc-sa-sovereign-pod-999-prod',
      OM: 'vpc-om-muscat-odp-412',
      BH: 'vpc-bh-manama-pri-303',
      QA: 'vpc-qa-doha-pri-882',
      MV: 'vpc-mv-male-dhiraagu-554',
      IN: 'vpc-in-mumbai-pri-108',
    }
    setCreateForm((prev) => ({
      ...prev,
      territoryCode: terr,
      assignedPrivateNode: terr,
      privateCloudVpcId: vpcMap[terr] || 'vpc-sa-sovereign-pod-999-prod',
    }))
  }

  const handleProvisionMainTerritoryChange = (terr: TerritoryCode) => {
    setProvisionMainTerritory(terr)
    const vpcMap: Record<TerritoryCode, string> = {
      SA: 'vpc-sa-sovereign-pod-999-prod',
      OM: 'vpc-om-muscat-odp-412',
      BH: 'vpc-bh-manama-pri-303',
      QA: 'vpc-qa-doha-pri-882',
      MV: 'vpc-mv-male-dhiraagu-554',
      IN: 'vpc-in-mumbai-pri-108',
    }
    setProvisionMainVpc(vpcMap[terr] || 'vpc-sa-sovereign-pod-999-prod')
  }

  const handleCreateSovereignUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.name || !createForm.email) {
      toast.error('Name and Email are required')
      return
    }

    try {
      setCreatingUser(true)
      const res = await fetch('/api/platform/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-and-provision',
          ...createForm,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('🛡️ Sovereign Personnel Created & Provisioned', {
          description: data.message,
        })
        setCreateUserOpen(false)
        fetchUsers()
      } else {
        toast.error('Creation Failed', {
          description: data.error || 'Server rejected creation request',
        })
      }
    } catch (err: any) {
      toast.error('Network Error', { description: err.message })
    } finally {
      setCreatingUser(false)
    }
  }

  const handleProvisionMainDispensary = async () => {
    try {
      setProvisioningMain(true)
      const res = await fetch('/api/platform/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'provision-main-organization',
          territoryCode: provisionMainTerritory,
          privateCloudVpcId: provisionMainVpc,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('🏛️ Main Dispensary 5-Phases Provisioned!', {
          description: `${data.report.phase1ProductsCreated} medicines, ${data.report.phase2BatchesCreated} batches, ${data.report.phase3TaxRegime} tax rules deployed to ${data.report.phase5VpcPod}.`,
        })
        setProvisionMainOpen(false)
        fetchUsers()
      } else {
        toast.error('Provisioning Failed', {
          description: data.error || 'Server error provisioning main dispensary',
        })
      }
    } catch (err: any) {
      toast.error('Network Error', { description: err.message })
    } finally {
      setProvisioningMain(false)
    }
  }

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
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase()
    setNewPassword(`Sovereign@${randomHex}#2026`)
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

  // Open the Role & Sovereign Matrix Governance Dialog
  const handleOpenGovernanceDialog = (user: UserItem) => {
    setTargetGovUser(user)
    setGovRoles(user.roles.map((r) => r.name))
    setGovTerritories(user.territories && user.territories.length > 0 ? user.territories : ['SA'])
    setGovPrivateNode(user.assignedPrivateNode || 'SA')
    setGovIsSuperAdmin(user.isSuperAdmin)
    setGovMfaEnabled(user.mfaEnabled)
    setGovMustChangePassword(user.mustChangePassword)
    setGovIpRestriction(user.ipRestrictionEnabled)
    setGovernanceDialogOpen(true)
  }

  // Toggle role in selection
  const handleToggleRole = (roleName: string) => {
    setGovRoles((prev) => {
      const exists = prev.includes(roleName)
      let next: string[]
      if (exists) {
        next = prev.filter((r) => r !== roleName)
      } else {
        next = [...prev, roleName]
      }
      if (roleName === 'super_admin') {
        setGovIsSuperAdmin(!exists)
      }
      return next
    })
  }

  // Toggle territory in matrix
  const handleToggleTerritory = (code: string) => {
    setGovTerritories((prev) => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev // Keep at least one
        return prev.filter((t) => t !== code)
      } else {
        return [...prev, code]
      }
    })
  }

  const handleSelectAllTerritories = () => {
    setGovTerritories(['SA', 'OM', 'BH', 'QA', 'MV', 'IN'])
  }

  const handleSelectGccTerritories = () => {
    setGovTerritories(['SA', 'OM', 'BH', 'QA'])
  }

  // Save Governance Assignment
  const handleSaveGovernance = async () => {
    if (!targetGovUser) return
    try {
      setSavingGovernance(true)
      const res = await fetch('/api/platform/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign-governance',
          userId: targetGovUser.id,
          roleNames: govRoles,
          territories: govTerritories,
          assignedPrivateNode: govPrivateNode,
          isSuperAdmin: govIsSuperAdmin,
          mfaEnabled: govMfaEnabled,
          mustChangePassword: govMustChangePassword,
          ipRestrictionEnabled: govIpRestriction,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('🛡️ Sovereign Governance Deployed', {
          description: data.message,
        })
        setGovernanceDialogOpen(false)
        fetchUsers()
      } else {
        toast.error('Governance Assignment Failed', {
          description: data.error || 'Server rejected governance update',
        })
      }
    } catch (err: any) {
      toast.error('Error saving governance', { description: err.message })
    } finally {
      setSavingGovernance(false)
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

  // Aggregate metrics
  const superAdminCount = users.filter((u) => u.isSuperAdmin).length
  const activeCount = users.filter((u) => u.accountStatus === 'ACTIVE').length
  const lockedCount = users.filter((u) => u.accountStatus === 'LOCKED').length
  const federatedUserCount = users.filter((u) => u.territories?.length === 6).length

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-border/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total Personnel</span>
            <Users className="h-4 w-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-foreground">{users.length}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Across all sovereign pharmacy nodes</div>
        </Card>

        <Card className="p-4 border-border/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Active &amp; Compliant</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{activeCount}</div>
          <div className="text-[10px] text-emerald-600/80 mt-0.5">Live authenticated staff</div>
        </Card>

        <Card className="p-4 border-border/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-rose-700 dark:text-rose-400 font-medium">SuperAdmins &amp; Governors</span>
            <ShieldCheck className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-rose-600 dark:text-rose-400">{superAdminCount}</div>
          <div className="text-[10px] text-rose-600/80 mt-0.5">Private cloud sovereign authority</div>
        </Card>

        <Card className="p-4 border-border/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-purple-700 dark:text-purple-400 font-medium">Federated Access</span>
            <Globe className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">{federatedUserCount}</div>
          <div className="text-[10px] text-purple-600/80 mt-0.5">Cross-sovereign 6-nation clearance</div>
        </Card>
      </div>

      {/* Main Governance Table Card */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Shield className="h-4 w-4 text-sky-600" />
                <span>Superadmin Personnel, Sovereign Roles &amp; Territory Matrix</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Directly provision roles &amp; responsibilities, bind personnel to Private Cloud VPC nodes, configure sovereign territory access matrices, and enforce hardware MFA.
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
                    {st === 'ALL' ? 'All Staff' : st}
                  </button>
                ))}
              </div>

              <Button onClick={() => setProvisionMainOpen(true)} variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-50/20 hover:bg-amber-50/50">
                <Building2 className="h-3.5 w-3.5 text-amber-600" />
                <span>🏛️ Provision Main Store</span>
              </Button>

              <Button onClick={() => setCreateUserOpen(true)} size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs font-semibold">
                <UserPlus className="h-3.5 w-3.5" />
                <span>➕ Create Sovereign Staff</span>
              </Button>

              <Button onClick={fetchUsers} variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-sky-600' : ''}`} />
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
                  <th className="py-2.5 px-3 text-left">Status</th>
                  <th className="py-2.5 px-3 text-left">Staff Name &amp; Contact</th>
                  <th className="py-2.5 px-3 text-left">Pharmacy Organization &amp; Branch</th>
                  <th className="py-2.5 px-3 text-left">Assigned Roles &amp; Responsibilities</th>
                  <th className="py-2.5 px-3 text-left">Sovereign Territory Matrix</th>
                  <th className="py-2.5 px-3 text-left">Private Cloud Node</th>
                  <th className="py-2.5 px-right text-right">Superadmin Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No staff accounts found matching your query.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isBusy = actionInProgress === u.id
                    const isFederated = u.territories && u.territories.length === 6

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
                              <span>LOCKED</span>
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
                              <Badge variant="outline" className="text-[9px] uppercase font-bold text-rose-600 border-rose-500/40 bg-rose-50 dark:bg-rose-950/30">
                                Super-Admin
                              </Badge>
                            </div>
                          )}
                          {u.mfaEnabled && (
                            <div className="mt-0.5">
                              <span className="text-[9px] font-mono text-purple-600 dark:text-purple-400 flex items-center gap-0.5">
                                <Lock className="h-2.5 w-2.5" /> MFA
                              </span>
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
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <span>{u.organization?.name || 'Metapharsic Core System'}</span>
                            {(u.organization?.code === 'DEFAULT' || u.organization?.id === 'default-org') && (
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[9px] font-bold">
                                MAIN
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{u.branch?.name || 'Main Sovereign Dispensary'}</div>
                        </td>

                        {/* Roles & Responsibilities */}
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {u.roles.map((r) => {
                              const roleDef = AVAILABLE_ROLES.find((ar) => ar.name === r.name)
                              return (
                                <Badge
                                  key={r.name}
                                  variant="outline"
                                  className={`text-[10px] font-semibold ${roleDef?.badge || 'bg-muted/40 text-foreground'}`}
                                >
                                  {r.displayName || r.name}
                                </Badge>
                              )
                            })}
                          </div>
                        </td>

                        {/* Sovereign Territory Matrix */}
                        <td className="py-3 px-3">
                          {isFederated ? (
                            <div className="flex items-center gap-1.5">
                              <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 text-[10px] font-bold">
                                🌐 All 6 Nations
                              </Badge>
                              <div className="text-[11px] flex gap-0.5">
                                <span>🇸🇦</span>
                                <span>🇴🇲</span>
                                <span>🇧🇭</span>
                                <span>🇶🇦</span>
                                <span>🇲🇻</span>
                                <span>🇮🇳</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1">
                              {u.territories?.map((code) => {
                                const nation = SOVEREIGN_NATIONS.find((n) => n.code === code)
                                return (
                                  <Badge
                                    key={code}
                                    variant="outline"
                                    className="text-[10px] font-medium bg-muted/30 border-border/80 flex items-center gap-1"
                                    title={nation?.name || code}
                                  >
                                    <span>{nation?.flag || '🏳️'}</span>
                                    <span>{code}</span>
                                  </Badge>
                                )
                              })}
                            </div>
                          )}
                        </td>

                        {/* Private Cloud Node */}
                        <td className="py-3 px-3">
                          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                            <Cloud className="h-3 w-3 text-sky-500" />
                            <span>{u.assignedPrivateNode || 'SA'} Pod</span>
                          </div>
                        </td>

                        {/* Superadmin Actions */}
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Assign Roles & Sovereign Governance Button */}
                            <Button
                              onClick={() => handleOpenGovernanceDialog(u)}
                              disabled={isBusy}
                              size="sm"
                              className="h-7 text-[11px] bg-sky-600 hover:bg-sky-500 text-white font-semibold gap-1 shadow-xs"
                            >
                              <ShieldCheck className="h-3 w-3" />
                              <span>Assign Matrix</span>
                            </Button>

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
                              className="h-7 text-[11px] border-slate-300 dark:border-slate-700 text-muted-foreground hover:text-foreground gap-1"
                            >
                              <KeyRound className="h-3 w-3" />
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

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 1: SUPERADMIN ROLES, SOVEREIGN MATRIX & NODE ASSIGNMENT  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Dialog open={governanceDialogOpen} onOpenChange={setGovernanceDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <ShieldCheck className="h-5 w-5 text-sky-600" />
              <span>Assign Sovereign Roles &amp; Geopolitical Territory Matrix</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assign authoritative roles, sovereign territory permissions, and dedicated Private Cloud VPC node bindings for{' '}
              <strong className="text-foreground">{targetGovUser?.name}</strong> ({targetGovUser?.email}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2 text-xs">
            {/* SECTION 1: SYSTEM ROLES & RESPONSIBILITIES */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b pb-1">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-sky-500" />
                  Roles &amp; Authority Level
                </Label>
                <span className="text-[10px] text-muted-foreground">{govRoles.length} selected</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AVAILABLE_ROLES.map((role) => {
                  const isChecked = govRoles.includes(role.name)
                  return (
                    <div
                      key={role.name}
                      onClick={() => handleToggleRole(role.name)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/30 shadow-xs'
                          : 'border-border/60 hover:border-border bg-card'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">{role.label}</span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="h-3.5 w-3.5 text-sky-600 rounded border-border"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{role.desc}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* SECTION 2: SOVEREIGN GEOPOLITICAL TERRITORY ACCESS MATRIX */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b pb-1">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-purple-500" />
                  Sovereign Territory Access Matrix
                </Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllTerritories}
                    className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    Federate All (6)
                  </button>
                  <span className="text-muted-foreground">•</span>
                  <button
                    type="button"
                    onClick={handleSelectGccTerritories}
                    className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    GCC Only (4)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SOVEREIGN_NATIONS.map((nation) => {
                  const isAuthorized = govTerritories.includes(nation.code)
                  return (
                    <div
                      key={nation.code}
                      onClick={() => handleToggleTerritory(nation.code)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isAuthorized
                          ? 'border-purple-500 bg-purple-50/40 dark:bg-purple-950/30'
                          : 'border-border/60 hover:border-border bg-card opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg">{nation.flag}</span>
                          <span className="font-bold text-xs">{nation.code}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isAuthorized}
                          onChange={() => {}}
                          className="h-3.5 w-3.5 text-purple-600 rounded"
                        />
                      </div>
                      <div className="text-[10px] font-medium text-foreground truncate mt-0.5">{nation.name}</div>
                      <div className="text-[9px] text-muted-foreground truncate">{nation.regulator}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* SECTION 3: DEDICATED PRIVATE CLOUD NODE BINDING */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Cloud className="h-3.5 w-3.5 text-emerald-500" />
                Dedicated Private Cloud Node Gateway
              </Label>
              <Select value={govPrivateNode} onValueChange={setGovPrivateNode}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SA">🇸🇦 Saudi Arabia — Oracle Cloud Dedicated VPC (Riyadh / Jeddah)</SelectItem>
                  <SelectItem value="OM">🇴🇲 Sultanate of Oman — Oman Data Park Pod (Muscat / Dhofar)</SelectItem>
                  <SelectItem value="BH">🇧🇭 Kingdom of Bahrain — AWS Middle East Private VPC (Manama)</SelectItem>
                  <SelectItem value="QA">🇶🇦 State of Qatar — AWS Middle East Private VPC (Doha)</SelectItem>
                  <SelectItem value="MV">🇲🇻 Republic of Maldives — Dhiraagu Sovereign Edge (Malé)</SelectItem>
                  <SelectItem value="IN">🇮🇳 Republic of India — AWS India Private VPC (Mumbai / Hyderabad)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* SECTION 4: SECURITY & COMPLIANCE MANDATES */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Security Governance Enforcements
              </Label>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <div>
                    <div className="font-semibold text-xs">Enforce Multi-Factor Authentication (MFA)</div>
                    <div className="text-[10px] text-muted-foreground">Require hardware TOTP/Authenticator at every sovereign login</div>
                  </div>
                  <Switch checked={govMfaEnabled} onCheckedChange={setGovMfaEnabled} />
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <div>
                    <div className="font-semibold text-xs">Force Password Reset on Next Login</div>
                    <div className="text-[10px] text-muted-foreground">User will be prompted to set a new password upon authentication</div>
                  </div>
                  <Switch checked={govMustChangePassword} onCheckedChange={setGovMustChangePassword} />
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <div>
                    <div className="font-semibold text-xs">In-Country IP Whitelist Restriction</div>
                    <div className="text-[10px] text-muted-foreground">Strictly block sessions originating outside the designated sovereign territory</div>
                  </div>
                  <Switch checked={govIpRestriction} onCheckedChange={setGovIpRestriction} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setGovernanceDialogOpen(false)}
              disabled={savingGovernance}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveGovernance}
              disabled={savingGovernance}
              className="bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-xs"
            >
              {savingGovernance ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Deploying Sovereign Governance...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                  Save &amp; Deploy Governance
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 2: PASSWORD RESET DIALOG                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-sky-600" />
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
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResetDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmResetPassword}
              disabled={actionInProgress === selectedUser?.id || !newPassword}
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
            >
              Confirm &amp; Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── CREATE SOVEREIGN STAFF & 5-PHASE PROVISIONING DIALOG ─── */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-600" />
              <span>Create Sovereign Personnel &amp; Deploy 5 Phases</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Creates a dispensary staff account in a designated sovereign territory, assigns authoritative roles, and auto-provisions the 5-phase sovereign clinical pipeline.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSovereignUser} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="create-name" className="text-xs font-semibold">
                  Personnel Full Name *
                </Label>
                <Input
                  id="create-name"
                  placeholder="e.g. د. فيصل الشمري (Dr. Faisal Al-Shammari)"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="create-email" className="text-xs font-semibold">
                  Login Email *
                </Label>
                <Input
                  id="create-email"
                  type="email"
                  placeholder="e.g. faisal.pharmacist@alhikma.sa"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  required
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="create-phone" className="text-xs font-semibold">
                  Phone Number
                </Label>
                <Input
                  id="create-phone"
                  placeholder="e.g. +966 50 123 4567"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="create-password" className="text-xs font-semibold">
                  Initial Password *
                </Label>
                <Input
                  id="create-password"
                  type="text"
                  placeholder="Sovereign@2026"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  required
                  className="text-xs font-mono"
                />
              </div>
            </div>

            {/* Target Pharmacy Organization */}
            <div className="space-y-1">
              <Label htmlFor="create-org" className="text-xs font-semibold">
                Assigned Pharmacy Organization &amp; Dispensary Branch
              </Label>
              <Select
                value={createForm.organizationId}
                onValueChange={(val) => setCreateForm({ ...createForm, organizationId: val })}
              >
                <SelectTrigger id="create-org" className="text-xs h-9">
                  <SelectValue placeholder="Select pharmacy organization..." />
                </SelectTrigger>
                <SelectContent>
                  {orgList.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name} ({org.code}) {org.code === 'DEFAULT' || org.id === 'default-org' ? '⭐ [MAIN DISPENSARY]' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sovereign Territory & VPC Node */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="create-terr" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Designated Sovereign Territory *
                </Label>
                <Select
                  value={createForm.territoryCode}
                  onValueChange={(val) => handleCreateTerritoryChange(val as TerritoryCode)}
                >
                  <SelectTrigger id="create-terr" className="text-xs h-9 border-emerald-500/40 bg-emerald-50/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOVEREIGN_NATIONS.map((nat) => (
                      <SelectItem key={nat.code} value={nat.code}>
                        {nat.flag} {nat.name} ({nat.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="create-vpc" className="text-xs font-semibold text-sky-700 dark:text-sky-400">
                  Private Cloud VPC Pod Binding *
                </Label>
                <Select
                  value={createForm.privateCloudVpcId}
                  onValueChange={(val) => setCreateForm({ ...createForm, privateCloudVpcId: val })}
                >
                  <SelectTrigger id="create-vpc" className="text-xs h-9 border-sky-500/40 bg-sky-50/10 font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vpc-sa-sovereign-pod-999-prod">🇸🇦 SA: Oracle Dedicated Pod (vpc-sa-sovereign-pod-999-prod)</SelectItem>
                    <SelectItem value="vpc-om-muscat-odp-412">🇴🇲 OM: Oman Data Park Pod (vpc-om-muscat-odp-412)</SelectItem>
                    <SelectItem value="vpc-bh-manama-pri-303">🇧🇭 BH: AWS Middle East Pod (vpc-bh-manama-pri-303)</SelectItem>
                    <SelectItem value="vpc-qa-doha-pri-882">🇶🇦 QA: AWS Qatar Pod (vpc-qa-doha-pri-882)</SelectItem>
                    <SelectItem value="vpc-mv-male-dhiraagu-554">🇲🇻 MV: Dhiraagu Edge Pod (vpc-mv-male-dhiraagu-554)</SelectItem>
                    <SelectItem value="vpc-in-mumbai-pri-108">🇮🇳 IN: AWS India Pod (vpc-in-mumbai-pri-108)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sovereign IAM Role Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Authoritative Roles &amp; Responsibilities</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {AVAILABLE_ROLES.map((r) => {
                  const isChecked = createForm.roleNames.includes(r.name)
                  return (
                    <button
                      key={r.name}
                      type="button"
                      onClick={() => {
                        const exists = createForm.roleNames.includes(r.name)
                        const next = exists
                          ? createForm.roleNames.filter((rn) => rn !== r.name)
                          : [...createForm.roleNames, r.name]
                        setCreateForm({
                          ...createForm,
                          roleNames: next.length > 0 ? next : ['pharmacist'],
                          isSuperAdmin: r.name === 'super_admin' ? !exists : createForm.isSuperAdmin,
                        })
                      }}
                      className={`p-2 rounded border text-left transition-all ${
                        isChecked
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
                      }`}
                    >
                      <div className="text-[11px] font-bold">{r.label}</div>
                      <div className="text-[9px] line-clamp-1 opacity-80">{r.name}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 5-Phase Auto-Provisioning Callout */}
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  Auto-Provision Sovereign 5 Phases for Organization &amp; User
                </span>
                <Switch
                  checked={createForm.autoProvision5Phases}
                  onCheckedChange={(val) => setCreateForm({ ...createForm, autoProvision5Phases: val })}
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Atomically provisions: <strong>[1]</strong> 14+ Bilingual Arabic/English Formularies, <strong>[2]</strong> Active In-Country Batches &amp; Racks, <strong>[3]</strong> ZATCA Phase 2 / ODP Tax Regime &amp; Local Currency, <strong>[4]</strong> IAM &amp; Sovereign Matrix, and <strong>[5]</strong> Private Cloud VPC Pod residency lock.
              </p>
            </div>

            {/* Security Toggles */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs border rounded p-2.5 cursor-pointer hover:bg-muted/30">
                <Switch
                  checked={createForm.mfaEnabled}
                  onCheckedChange={(val) => setCreateForm({ ...createForm, mfaEnabled: val })}
                />
                <span className="font-medium text-foreground">Enforce Hardware MFA</span>
              </label>

              <label className="flex items-center gap-2 text-xs border rounded p-2.5 cursor-pointer hover:bg-muted/30">
                <Switch
                  checked={createForm.ipRestrictionEnabled}
                  onCheckedChange={(val) => setCreateForm({ ...createForm, ipRestrictionEnabled: val })}
                />
                <span className="font-medium text-foreground">In-Country IP Whitelist</span>
              </label>
            </div>

            <DialogFooter className="flex justify-end gap-2 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateUserOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={creatingUser}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold gap-1.5"
              >
                {creatingUser ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Provisioning Sovereign Personnel...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Create &amp; Auto-Provision Sovereign User</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── PROVISION MAIN DISPENSARY DIALOG ─── */}
      <Dialog open={provisionMainOpen} onOpenChange={setProvisionMainOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Building2 className="h-5 w-5" />
              <span>Provision Main Dispensary (الفرع الرئيسي)</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Directly binds the platform's primary organization (PharmaCare Medical Store / Main Branch) to a dedicated sovereign geopolitical private cloud topology across all 5 phases.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Target Sovereign Jurisdiction</Label>
              <Select
                value={provisionMainTerritory}
                onValueChange={(val) => handleProvisionMainTerritoryChange(val as TerritoryCode)}
              >
                <SelectTrigger className="text-xs h-9 border-amber-500/40 bg-amber-50/15">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOVEREIGN_NATIONS.map((nat) => (
                    <SelectItem key={nat.code} value={nat.code}>
                      {nat.flag} {nat.name} ({nat.code}) &bull; {nat.regulator}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Private Cloud VPC Pod Binding</Label>
              <Input
                value={provisionMainVpc}
                onChange={(e) => setProvisionMainVpc(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            {/* Visual 5-Phase Checklist */}
            <div className="rounded-lg border border-border/80 bg-muted/40 p-3 space-y-2 text-xs">
              <div className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                <Layers className="h-4 w-4 text-sky-600" />
                <span>5-Phase Sovereign Pipeline Deployment Manifest:</span>
              </div>
              <ul className="space-y-1 text-[11px] text-muted-foreground list-disc list-inside">
                <li><strong className="text-foreground">Phase 1:</strong> 14+ Bilingual Arabic/English clinical formulations &amp; GTIN barcodes</li>
                <li><strong className="text-foreground">Phase 2:</strong> In-country active batches (150-250 units), expiry ledger &amp; racks</li>
                <li><strong className="text-foreground">Phase 3:</strong> Sovereign tax regime, local currency &amp; bilingual invoice headers</li>
                <li><strong className="text-foreground">Phase 4:</strong> Roles &amp; sovereign territory access matrix for all store staff</li>
                <li><strong className="text-foreground">Phase 5:</strong> Private Cloud VPC Pod binding &amp; 100% in-country data residency</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setProvisionMainOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={provisioningMain}
              onClick={handleProvisionMainDispensary}
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold gap-1.5"
            >
              {provisioningMain ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Deploying 5 Phases to Main...</span>
                </>
              ) : (
                <>
                  <Building2 className="h-3.5 w-3.5" />
                  <span>1-Click Provision Main Dispensary</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
