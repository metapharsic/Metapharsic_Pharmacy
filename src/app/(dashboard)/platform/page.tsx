'use client'

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Layers,
  Lock,
  PauseCircle,
  PieChart,
  PlayCircle,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Store,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  Cpu,
  Globe,
  KeyRound,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import React, { useEffect, useMemo, useState } from 'react'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import type { ChemistFinancialStats, PlatformAnalyticsData } from '@/lib/platform/platform-analytics-service'
import { ChemistExcelExportDialog } from '@/components/platform/chemist-excel-export-dialog'
import { SystemMonitoringPanel } from '@/components/platform/system-monitoring-panel'
import { UserGovernancePanel } from '@/components/platform/user-governance-panel'
import { SubscriptionLicensingPanel } from '@/components/platform/subscription-licensing-panel'
import { SidebarAssignmentPanel } from '@/components/platform/sidebar-assignment-panel'
import { GeoPoliticalZonePanel } from '@/components/platform/geo-political-zone-panel'
import { IAMPolicyPanel } from '@/components/platform/iam-policy-panel'
import { cn } from '@/lib/utils/cn'
import { maskEmail, maskPhone } from '@/lib/utils/masking'

interface OrganizationItem {
  id: string
  code: string
  slug: string
  name: string
  legalName?: string | null
  email?: string | null
  phone?: string | null
  gstin?: string | null
  dlNumber?: string | null
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED'
  subscriptionPlan: 'TRIAL' | 'STARTER' | 'GROWTH' | 'ENTERPRISE'
  subscriptionExpiresAt?: string | null
  maxBranches: number
  maxUsers: number
  createdAt: string
  branches: { id: string; name: string; code?: string | null; isHeadOffice: boolean }[]
  ownerUser?: { id: string; name: string; email: string; phone?: string | null } | null
  users?: {
    id: string
    name: string
    email: string
    phone?: string | null
    isActive: boolean
    userRoles: { role: { name: string; displayName: string } }[]
  }[]
  _count: {
    users: number
    products: number
    branches: number
  }
}

interface GlobalMedicineItem {
  id: string
  name: string
  genericName?: string | null
  manufacturer?: string | null
  composition?: string | null
  hsnCode?: string | null
  drugSchedule?: string | null
  dpcoPriceCap?: number | null
}

export default function PlatformSuperAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const toast = useToast()

  const isSuperAdmin = Boolean(
    session?.user?.isSuperAdmin || session?.user?.roles?.includes('super_admin')
  )

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user || !isSuperAdmin) {
      router.replace('/')
    }
  }, [session, status, isSuperAdmin, router])

  // Tab State: Monitoring, IAM, GeoZones, Sidebar Delegation, Users, Subscriptions, Financials, Shops, Catalog
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams?.get('tab') as any
  const [activeTab, setActiveTab] = useState<'monitoring' | 'iam' | 'geozones' | 'sidebar' | 'users' | 'subscriptions' | 'financials' | 'shops' | 'catalog'>('monitoring')

  useEffect(() => {
    if (
      tabFromUrl &&
      ['monitoring', 'iam', 'geozones', 'sidebar', 'users', 'subscriptions', 'financials', 'shops', 'catalog'].includes(
        tabFromUrl
      )
    ) {
      setActiveTab(tabFromUrl)
    }
  }, [tabFromUrl])

  // Organizations list state
  const [orgs, setOrgs] = useState<OrganizationItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Financial Analytics state
  const [analytics, setAnalytics] = useState<PlatformAnalyticsData | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(true)
  const [financialSearch, setFinancialSearch] = useState<string>('')
  const [healthFilter, setHealthFilter] = useState<string>('ALL')
  const [selectedChemist, setSelectedChemist] = useState<ChemistFinancialStats | null>(null)
  const [drilldownOpen, setDrilldownOpen] = useState<boolean>(false)
  const [itemSearchTerm, setItemSearchTerm] = useState<string>('')
  const [exportDialogOpen, setExportDialogOpen] = useState<boolean>(false)
  const [exportSingleShopId, setExportSingleShopId] = useState<string | null>(null)

  // Onboard modal state
  const [onboardOpen, setOnboardOpen] = useState<boolean>(false)
  const [onboarding, setOnboarding] = useState<boolean>(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminPhone: '',
    gstin: '',
    dlNumber: '',
    city: '',
    state: '',
    zone: 'South Zone',
    subscriptionPlan: 'GROWTH',
    subscriptionDurationDays: 365,
  })

  // Global medicine lookup tab state
  const [catalogSearch, setCatalogSearch] = useState<string>('Paracetamol')
  const [catalogItems, setCatalogItems] = useState<GlobalMedicineItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState<boolean>(false)

  const loadOrganizations = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/platform/organizations')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setOrgs(json.data)
      } else {
        toast.error(json.error?.message || 'Failed to load chemist shops')
      }
    } catch {
      toast.error('Network error loading platform organizations')
    } finally {
      setLoading(false)
    }
  }

  const loadFinancialAnalytics = async () => {
    setAnalyticsLoading(true)
    try {
      const res = await fetch('/api/platform/analytics')
      const json = await res.json()
      if (json.success && json.data) {
        setAnalytics(json.data)
      } else {
        toast.error(json.error?.message || 'Failed to load platform financial intelligence')
      }
    } catch {
      toast.error('Network error loading financial analytics')
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const loadGlobalCatalog = async (query: string) => {
    setCatalogLoading(true)
    try {
      const res = await fetch(`/api/platform/global-medicines?search=${encodeURIComponent(query)}&limit=25`)
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setCatalogItems(json.data)
      }
    } catch {
      // Non-blocking
    } finally {
      setCatalogLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user && isSuperAdmin) {
      void loadOrganizations()
      void loadFinancialAnalytics()
      void loadGlobalCatalog('Paracetamol')
    }
  }, [session, isSuperAdmin])

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setOnboarding(true)
    try {
      const res = await fetch('/api/platform/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Chemist Shop "${formData.name}" onboarded successfully! Admin: ${formData.adminEmail}`)
        setOnboardOpen(false)
        setFormData({
          code: '',
          name: '',
          adminName: '',
          adminEmail: '',
          adminPassword: '',
          adminPhone: '',
          gstin: '',
          dlNumber: '',
          city: '',
          state: '',
          zone: 'South Zone',
          subscriptionPlan: 'GROWTH',
          subscriptionDurationDays: 365,
        })
        void loadOrganizations()
        void loadFinancialAnalytics()
      } else {
        toast.error(json.error?.message || 'Failed to onboard chemist shop')
      }
    } catch {
      toast.error('Network error while onboarding chemist shop')
    } finally {
      setOnboarding(false)
    }
  }

  const handleUpdateStatus = async (orgId: string, newStatus: 'ACTIVE' | 'SUSPENDED') => {
    try {
      const res = await fetch(`/api/platform/organizations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Organization status changed to ${newStatus}`)
        void loadOrganizations()
        void loadFinancialAnalytics()
      } else {
        toast.error(json.error?.message || 'Failed to update status')
      }
    } catch {
      toast.error('Network error updating organization status')
    }
  }

  const handleExtendSubscription = async (orgId: string, days: number) => {
    try {
      const res = await fetch(`/api/platform/organizations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extendDays: days }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Subscription extended by ${days} days!`)
        void loadOrganizations()
      } else {
        toast.error(json.error?.message || 'Failed to extend subscription')
      }
    } catch {
      toast.error('Network error extending subscription')
    }
  }

  const filteredOrgs = useMemo(() => {
    return orgs.filter((org) => {
      const matchesSearch =
        !searchTerm ||
        org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (org.ownerUser?.email || '').toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'ALL' || org.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [orgs, searchTerm, statusFilter])

  const filteredChemists = useMemo(() => {
    if (!analytics?.chemists) return []
    return analytics.chemists.filter((chem) => {
      const matchesSearch =
        !financialSearch ||
        chem.organizationName.toLowerCase().includes(financialSearch.toLowerCase()) ||
        chem.organizationCode.toLowerCase().includes(financialSearch.toLowerCase()) ||
        (chem.city || '').toLowerCase().includes(financialSearch.toLowerCase())
      const matchesHealth =
        healthFilter === 'ALL' || chem.profitability.healthTier === healthFilter
      return matchesSearch && matchesHealth
    })
  }, [analytics?.chemists, financialSearch, healthFilter])

  const filteredItemLedger = useMemo(() => {
    if (!selectedChemist?.itemizedLedger) return []
    if (!itemSearchTerm) return selectedChemist.itemizedLedger
    const term = itemSearchTerm.toLowerCase()
    return selectedChemist.itemizedLedger.filter(
      (it) =>
        it.productName.toLowerCase().includes(term) ||
        (it.genericName || '').toLowerCase().includes(term) ||
        it.sku.toLowerCase().includes(term)
    )
  }, [selectedChemist?.itemizedLedger, itemSearchTerm])

  const exportFinancialReport = () => {
    if (!analytics) return
    const headers = [
      'Shop Code',
      'Shop Name',
      'Status',
      'Inward Purchases (₹)',
      'Purchase Bills',
      'Gross Sales Revenue (₹)',
      'Invoices Count',
      'Units Sold',
      'COGS (₹)',
      'Gross Profit (₹)',
      'Profit Margin (%)',
      'Health Status',
      'Inventory Cost (₹)',
      'Inventory MRP (₹)',
      'Accounts Payable (₹)',
      'Accounts Receivable (₹)',
    ]

    const rows = analytics.chemists.map((c) => [
      c.organizationCode,
      `"${c.organizationName}"`,
      c.status,
      c.purchases.totalAmount,
      c.purchases.billsCount,
      c.sales.grossRevenue,
      c.sales.invoicesCount,
      c.sales.unitsSold,
      c.profitability.cogs,
      c.profitability.grossProfit,
      `${c.profitability.profitMarginPercent}%`,
      c.profitability.healthTier,
      c.inventory.valuationAtCost,
      c.inventory.valuationAtMrp,
      c.ledger.accountsPayable,
      c.ledger.accountsReceivable,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `platform-chemist-financial-report-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Financial Intelligence Report exported to CSV')
  }

  const totalShops = orgs.length
  const activeShops = orgs.filter((o) => o.status === 'ACTIVE').length
  const totalUsers = orgs.reduce((acc, o) => acc + (o._count?.users || 0), 0)
  const totalProducts = orgs.reduce((acc, o) => acc + (o._count?.products || 0), 0)

  if (status === 'loading') {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session?.user || !isSuperAdmin) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <h2 className="text-lg font-bold">Access Denied</h2>
        <p className="text-sm text-muted-foreground">Redirecting to dispensary dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Platform Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-primary text-primary-foreground font-mono text-[10px] uppercase">
              Main Schema &bull; Control Plane
            </Badge>
            <span className="text-xs text-muted-foreground">Software Vendor Portal</span>
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
              Super-Admin Confidential
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Platform Super-Admin Multi-Tenant Control
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete financial visibility, purchases, sales, and profit margin analytics across all onboarded chemist shops.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void loadOrganizations()
              void loadFinancialAnalytics()
            }}
            disabled={loading || analyticsLoading}
            className="gap-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', (loading || analyticsLoading) && 'animate-spin')} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setExportSingleShopId(null)
              setExportDialogOpen(true)
            }}
            disabled={!analytics}
            className="gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold shadow-xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export Formatted Excel (.xlsx)</span>
          </Button>

          <Button
            onClick={() => setOnboardOpen(true)}
            size="sm"
            className="gap-1.5 shadow-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            <Plus className="h-4 w-4" />
            Onboard Chemist Shop
          </Button>
        </div>
      </div>

      {/* Platform Executive KPI Summary Banner */}
      {analytics?.platformSummary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="p-3.5 pb-1">
              <CardDescription className="text-[11px] flex items-center justify-between font-medium">
                <span>Platform Gross Revenue</span>
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              </CardDescription>
              <CardTitle className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{analytics.platformSummary.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
              <span className="text-[10px] text-muted-foreground">
                Across {analytics.platformSummary.totalShopsCount} shops ({analytics.platformSummary.totalBranchesCount} branches)
              </span>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="p-3.5 pb-1">
              <CardDescription className="text-[11px] flex items-center justify-between font-medium">
                <span>Inward Purchases</span>
                <Receipt className="h-3.5 w-3.5 text-blue-600" />
              </CardDescription>
              <CardTitle className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                ₹{analytics.platformSummary.totalPurchases.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
              <span className="text-[10px] text-muted-foreground">
                COGS: ₹{analytics.platformSummary.totalCogs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="p-3.5 pb-1">
              <CardDescription className="text-[11px] flex items-center justify-between font-medium">
                <span>Net Gross Profit</span>
                <PieChart className="h-3.5 w-3.5 text-primary" />
              </CardDescription>
              <CardTitle className="text-xl font-bold font-mono text-primary mt-0.5 flex items-baseline gap-1.5">
                <span>₹{analytics.platformSummary.netGrossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                <Badge className="bg-emerald-600 text-white font-mono text-[10px] py-0 px-1.5">
                  {analytics.platformSummary.weightedMarginPercent}%
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
              <span className="text-[10px] text-muted-foreground">
                Weighted Platform Margin
              </span>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="p-3.5 pb-1">
              <CardDescription className="text-[11px] flex items-center justify-between font-medium">
                <span>Live Stock Valuation</span>
                <Boxes className="h-3.5 w-3.5 text-amber-600" />
              </CardDescription>
              <CardTitle className="text-xl font-bold font-mono text-foreground mt-0.5">
                ₹{analytics.platformSummary.totalInventoryAtCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
              <span className="text-[10px] text-emerald-600 font-medium">
                MRP: ₹{analytics.platformSummary.totalInventoryAtMrp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/60 backdrop-blur-sm col-span-2 md:col-span-4 lg:col-span-1">
            <CardHeader className="p-3.5 pb-1">
              <CardDescription className="text-[11px] flex items-center justify-between font-medium">
                <span>Payables vs Receivables</span>
                <Wallet className="h-3.5 w-3.5 text-purple-600" />
              </CardDescription>
              <CardTitle className="text-sm font-mono mt-0.5 space-y-0.5">
                <div className="text-rose-600 dark:text-rose-400 font-bold">
                  AP: ₹{analytics.platformSummary.totalPayables.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                  AR: ₹{analytics.platformSummary.totalReceivables.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
              <span className="text-[10px] text-muted-foreground">
                Market Ledger Exposure
              </span>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Navigation Tabs */}
      <div className="flex border-b border-border/60 gap-5 text-sm font-semibold overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('monitoring')}
          className={cn(
            'pb-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap',
            activeTab === 'monitoring'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Cpu className="h-4 w-4" />
          <span>Live Telemetry &amp; Log Stream</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('iam')}
          className={cn(
            'pb-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap',
            activeTab === 'iam'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <ShieldCheck className="h-4 w-4 text-teal-600" />
          <span>IAM Security Rules</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('geozones')}
          className={cn(
            'pb-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap',
            activeTab === 'geozones'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Globe className="h-4 w-4 text-emerald-600" />
          <span>Sovereign Geopolitical Zones &amp; Cross-Border Radar</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sidebar')}
          className={cn(
            'pb-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap',
            activeTab === 'sidebar'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Layers className="h-4 w-4" />
          <span>Sidebar &amp; Module Delegation</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={cn(
            'pb-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap',
            activeTab === 'users'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Users className="h-4 w-4" />
          <span>Staff Accounts &amp; Security</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('subscriptions')}
          className={cn(
            'pb-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap',
            activeTab === 'subscriptions'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <KeyRound className="h-4 w-4" />
          <span>30-Day Subscriptions &amp; Licenses</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('financials')}
          className={cn(
            'pb-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap',
            activeTab === 'financials'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <PieChart className="h-4 w-4" />
          <span>Financials &amp; Profit ({analytics?.chemists?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('shops')}
          className={cn(
            'pb-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap',
            activeTab === 'shops'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Store className="h-4 w-4" />
          <span>Tenant Chemist Shops ({filteredOrgs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={cn(
            'pb-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap',
            activeTab === 'catalog'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Database className="h-4 w-4" />
          <span>Global Drug Directory</span>
        </button>
      </div>

      {/* ─── TAB: SYSTEM & ACTIVITY MONITORING ─── */}
      {activeTab === 'monitoring' && <SystemMonitoringPanel />}

      {/* ─── TAB: IAM SECURITY POLICY RULES ─── */}
      {activeTab === 'iam' && <IAMPolicyPanel />}

      {/* ─── TAB: GEO-POLITICAL ZONES & AREA LOGINS ─── */}
      {activeTab === 'geozones' && <GeoPoliticalZonePanel />}

      {/* ─── TAB: SIDEBAR & MODULE ACCESS DELEGATION ─── */}
      {activeTab === 'sidebar' && <SidebarAssignmentPanel />}

      {/* ─── TAB: USER GOVERNANCE & ACCOUNT HEALTH ─── */}
      {activeTab === 'users' && <UserGovernancePanel />}

      {/* ─── TAB: 30-DAY SUBSCRIPTIONS & LICENSES ─── */}
      {activeTab === 'subscriptions' && <SubscriptionLicensingPanel />}

      {/* ─── TAB: FINANCIAL INTELLIGENCE & PROFIT ─── */}
      {activeTab === 'financials' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search by shop name, store code, city..."
                value={financialSearch}
                onChange={(e) => setFinancialSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-muted-foreground">Health Tier:</span>
              <Select value={healthFilter} onValueChange={setHealthFilter}>
                <SelectTrigger className="h-9 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Health Tiers</SelectItem>
                  <SelectItem value="EXCEPTIONAL">Exceptional (&ge; 25%)</SelectItem>
                  <SelectItem value="HEALTHY">Healthy (18-25%)</SelectItem>
                  <SelectItem value="MODERATE">Moderate (10-18%)</SelectItem>
                  <SelectItem value="LOW">Low (&lt; 10%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Keen Financial Table */}
          {analyticsLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-7 w-7 animate-spin text-primary" />
              <span className="font-medium">Aggregating Keen Financial Intelligence across all chemist shops...</span>
            </div>
          ) : filteredChemists.length === 0 ? (
            <div className="py-12 text-center rounded-lg border border-dashed p-6">
              <Store className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="font-semibold text-sm">No chemist financial records matched</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try clearing your search query or health tier filter.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border/80 overflow-hidden shadow-sm bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 text-muted-foreground border-b border-border/80 uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-3">Chemist Shop / Tenant</th>
                      <th className="py-3 px-3 text-right">Inward Purchases</th>
                      <th className="py-3 px-3 text-right">Gross Sales Revenue</th>
                      <th className="py-3 px-3 text-right">COGS</th>
                      <th className="py-3 px-3 text-right">Gross Profit &amp; Margin</th>
                      <th className="py-3 px-3 text-right">Stock Valuation</th>
                      <th className="py-3 px-3 text-right">Ledger (AP / AR)</th>
                      <th className="py-3 px-3 text-center">Keen Drilldown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredChemists.map((chem) => {
                      const healthColor =
                        chem.profitability.healthTier === 'EXCEPTIONAL'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                          : chem.profitability.healthTier === 'HEALTHY'
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30'
                            : chem.profitability.healthTier === 'MODERATE'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'

                      return (
                        <tr
                          key={chem.organizationId}
                          className="hover:bg-muted/40 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedChemist(chem)
                            setDrilldownOpen(true)
                          }}
                        >
                          {/* Chemist Master Details */}
                          <td className="py-3 px-3">
                            <div className="flex items-start gap-2">
                              <Store className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <div>
                                <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                                  <span>{chem.organizationName}</span>
                                  <Badge variant="outline" className="font-mono text-[9px] py-0 px-1 uppercase">
                                    {chem.organizationCode}
                                  </Badge>
                                </div>
                                <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                  <span>{chem.city || 'India'}</span>
                                  {chem.dlNumber && <span>&bull; DL: {chem.dlNumber}</span>}
                                  <span>&bull; {chem.branchesCount} Branch(es)</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Inward Purchases */}
                          <td className="py-3 px-3 text-right">
                            <div className="font-mono font-bold text-foreground">
                              ₹{chem.purchases.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {chem.purchases.billsCount} bill(s) inwarded
                            </div>
                          </td>

                          {/* Gross Sales */}
                          <td className="py-3 px-3 text-right">
                            <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{chem.sales.grossRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {chem.sales.invoicesCount} invoices &bull; {chem.sales.unitsSold} units
                            </div>
                          </td>

                          {/* Cost of Goods Sold */}
                          <td className="py-3 px-3 text-right">
                            <div className="font-mono font-semibold text-muted-foreground">
                              ₹{chem.profitability.cogs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              At Purchase Rates
                            </div>
                          </td>

                          {/* Gross Profit & Margin % */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                                ₹{chem.profitability.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                              <Badge variant="outline" className={cn('font-mono text-[10px] py-0 px-1 font-bold', healthColor)}>
                                {chem.profitability.profitMarginPercent}%
                              </Badge>
                            </div>
                            <div className="text-[10px] text-muted-foreground uppercase font-medium mt-0.5">
                              {chem.profitability.healthTier} Health
                            </div>
                          </td>

                          {/* Stock Valuation */}
                          <td className="py-3 px-3 text-right">
                            <div className="font-mono font-medium text-foreground">
                              Cost: ₹{chem.inventory.valuationAtCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-emerald-600 font-mono">
                              MRP: ₹{chem.inventory.valuationAtMrp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                          </td>

                          {/* Ledger (AP / AR) */}
                          <td className="py-3 px-3 text-right font-mono text-[11px]">
                            <div className="text-rose-600 dark:text-rose-400">
                              AP: ₹{chem.ledger.accountsPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-emerald-600 dark:text-emerald-400">
                              AR: ₹{chem.ledger.accountsReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                          </td>

                          {/* Drilldown Trigger */}
                          <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedChemist(chem)
                                setDrilldownOpen(true)
                              }}
                              className="h-7 text-[11px] gap-1 px-2.5 hover:bg-primary hover:text-white"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Keen Drilldown</span>
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: TENANT CHEMIST SHOPS (MASTER DIRECTORY) ─── */}
      {activeTab === 'shops' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search shop name, store code, admin email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-muted-foreground">Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <span>Loading tenant chemist shops...</span>
            </div>
          ) : filteredOrgs.length === 0 ? (
            <div className="py-12 text-center rounded-lg border border-dashed p-6">
              <Store className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="font-semibold text-sm">No chemist shops found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click &quot;Onboard Chemist Shop&quot; to provision a new chemist shop with its own shop admin.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOrgs.map((org) => {
                const isExpired =
                  org.subscriptionExpiresAt && new Date(org.subscriptionExpiresAt) < new Date()
                const daysLeft = org.subscriptionExpiresAt
                  ? Math.ceil(
                      (new Date(org.subscriptionExpiresAt).getTime() - Date.now()) / (24 * 3600 * 1000)
                    )
                  : null

                return (
                  <Card
                    key={org.id}
                    className="border-border/70 hover:border-primary/50 transition-all flex flex-col justify-between"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px] tracking-wider uppercase mb-1"
                          >
                            CODE: {org.code}
                          </Badge>
                          <CardTitle className="text-base font-bold leading-tight">
                            {org.name}
                          </CardTitle>
                          {org.dlNumber && (
                            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                              DL: {org.dlNumber}
                            </p>
                          )}
                        </div>

                        <Badge
                          className={cn(
                            'text-[10px] uppercase font-mono font-semibold',
                            org.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                          )}
                        >
                          {org.status}
                        </Badge>
                      </div>

                      <CardDescription className="text-xs mt-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-foreground">
                          <UserCheck className="h-3.5 w-3.5 text-primary" />
                          <span className="font-medium">
                            Admin: {org.ownerUser?.name || 'Administrator'}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          {maskEmail(org.ownerUser?.email || '')}
                        </div>
                        {org.ownerUser?.phone && (
                          <div className="text-[11px] font-mono text-muted-foreground">
                            Ph: {maskPhone(org.ownerUser?.phone)}
                          </div>
                        )}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3 pb-3 text-xs">
                      {/* Subscription & License */}
                      <div className="rounded-md bg-muted/40 p-2.5 border border-border/50 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-[11px]">License Plan:</span>
                          <Badge variant="outline" className="font-mono text-[10px] uppercase font-bold">
                            {org.subscriptionPlan}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Validity:</span>
                          {daysLeft !== null ? (
                            <span
                              className={cn(
                                'font-mono font-medium',
                                isExpired
                                  ? 'text-rose-600'
                                  : daysLeft <= 15
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                              )}
                            >
                              {isExpired ? 'EXPIRED' : `${daysLeft} days remaining`}
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-mono">Perpetual</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40">
                          <span className="text-muted-foreground">Branches &bull; Staff:</span>
                          <span className="font-mono font-semibold">
                            {org.branches.length} Branch(es) &bull; {org._count?.users || 0} Staff
                          </span>
                        </div>
                      </div>

                      {/* Staff Roster Preview */}
                      {org.users && org.users.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                            Child Staff Roster ({org.users.length}):
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {org.users.slice(0, 5).map((u) => {
                              const roleName = u.userRoles[0]?.role?.displayName || 'Staff'
                              return (
                                <Badge
                                  key={u.id}
                                  variant="secondary"
                                  className="text-[9px] px-1.5 py-0 font-normal"
                                >
                                  {roleName}: {u.name.split(' ')[0]}
                                </Badge>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Control Actions */}
                      <div className="pt-2 border-t flex items-center justify-between gap-1.5">
                        {org.status === 'ACTIVE' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateStatus(org.id, 'SUSPENDED')}
                            className="h-7 text-[11px] gap-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                          >
                            <PauseCircle className="h-3 w-3" />
                            Suspend
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateStatus(org.id, 'ACTIVE')}
                            className="h-7 text-[11px] gap-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                          >
                            <PlayCircle className="h-3 w-3" />
                            Activate
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExtendSubscription(org.id, 365)}
                          className="h-7 text-[11px] gap-1 text-primary"
                        >
                          <Calendar className="h-3 w-3" />
                          +1 Year License
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: GLOBAL DRUG MASTER ─── */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              National 30,000+ Medicine Master Database
            </h3>
            <p className="text-xs text-muted-foreground">
              Pre-seeded national pharmaceutical catalog. Every chemist shop automatically searches and adopts medicines from this master directory with standardized DPCO price caps and drug schedules.
            </p>
          </div>

          <div className="flex items-center gap-2 max-w-md">
            <Input
              placeholder="Search by generic molecule, brand, or manufacturer..."
              value={catalogSearch}
              onChange={(e) => {
                setCatalogSearch(e.target.value)
                if (e.target.value.length >= 2) {
                  void loadGlobalCatalog(e.target.value)
                }
              }}
              className="h-9 text-xs"
            />
            <Button
              size="sm"
              onClick={() => void loadGlobalCatalog(catalogSearch)}
              disabled={catalogLoading}
              className="text-xs gap-1"
            >
              <Search className="h-3.5 w-3.5" />
              Search
            </Button>
          </div>

          {catalogLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Searching national master medicines...
            </div>
          ) : catalogItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground border rounded-lg p-4">
              No matching molecules found in global directory.
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground border-b text-[10px] uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Brand Name</th>
                    <th className="py-2.5 px-3">Generic Salt / Composition</th>
                    <th className="py-2.5 px-3">Manufacturer</th>
                    <th className="py-2.5 px-3">Schedule</th>
                    <th className="py-2.5 px-3 text-right">DPCO Price Cap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {catalogItems.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="py-2 px-3 font-semibold">{item.name}</td>
                      <td className="py-2 px-3 text-muted-foreground">{item.genericName || '-'}</td>
                      <td className="py-2 px-3 text-muted-foreground">{item.manufacturer || '-'}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-[10px]">
                          {item.drugSchedule || 'SCHEDULE_H'}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium">
                        {item.dpcoPriceCap ? `₹${item.dpcoPriceCap.toFixed(2)}` : 'Market'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── KEEN FINANCIAL DRILLDOWN DIALOG (SUPER-ADMIN ONLY) ─── */}
      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-6">
          {selectedChemist && (
            <>
              <DialogHeader className="border-b pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="h-5 w-5 text-primary" />
                    <div>
                      <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        <span>{selectedChemist.organizationName}</span>
                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                          {selectedChemist.organizationCode}
                        </Badge>
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                        {selectedChemist.city}, {selectedChemist.state || 'India'} &bull; DL: {selectedChemist.dlNumber || 'N/A'} &bull; GST: {selectedChemist.gstin || 'N/A'}
                      </DialogDescription>
                    </div>
                  </div>

                  <Badge
                    className={cn(
                      'text-xs uppercase font-mono font-bold px-2 py-0.5',
                      selectedChemist.profitability.healthTier === 'EXCEPTIONAL'
                        ? 'bg-emerald-600 text-white'
                        : selectedChemist.profitability.healthTier === 'HEALTHY'
                          ? 'bg-blue-600 text-white'
                          : selectedChemist.profitability.healthTier === 'MODERATE'
                            ? 'bg-amber-600 text-white'
                            : 'bg-rose-600 text-white'
                    )}
                  >
                    {selectedChemist.profitability.healthTier} PERFORMANCE
                  </Badge>
                </div>
              </DialogHeader>

              {/* Keen Scorecard Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                  <span className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-400 block">
                    Gross Sales Revenue
                  </span>
                  <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                    ₹{selectedChemist.sales.grossRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    {selectedChemist.sales.invoicesCount} Bills &bull; {selectedChemist.sales.unitsSold} Units
                  </span>
                </div>

                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-center">
                  <span className="text-[10px] uppercase font-semibold text-blue-700 dark:text-blue-400 block">
                    Inward Purchases
                  </span>
                  <span className="font-mono text-base font-bold text-blue-600 dark:text-blue-400 block mt-0.5">
                    ₹{selectedChemist.purchases.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    {selectedChemist.purchases.billsCount} Purchases Inwarded
                  </span>
                </div>

                <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-center">
                  <span className="text-[10px] uppercase font-semibold text-primary block">
                    Gross Profit
                  </span>
                  <span className="font-mono text-base font-bold text-primary block mt-0.5">
                    ₹{selectedChemist.profitability.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 block mt-0.5">
                    Margin: {selectedChemist.profitability.profitMarginPercent}%
                  </span>
                </div>

                <div className="rounded-lg bg-muted/60 border border-border/80 p-3 text-center">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Cost of Goods (COGS)
                  </span>
                  <span className="font-mono text-base font-bold text-foreground block mt-0.5">
                    ₹{selectedChemist.profitability.cogs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    Batch Purchase Valuation
                  </span>
                </div>
              </div>

              {/* Secondary Details: Live Stock & Ledger */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-xs space-y-2">
                  <div className="font-bold text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Boxes className="h-4 w-4 text-primary" />
                      Live Inventory Asset Valuation
                    </span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {selectedChemist.inventory.totalUnits} Units
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div>
                      <span className="text-muted-foreground block">Valuation at Cost:</span>
                      <span className="font-mono font-bold text-foreground">
                        ₹{selectedChemist.inventory.valuationAtCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Valuation at MRP:</span>
                      <span className="font-mono font-bold text-emerald-600">
                        ₹{selectedChemist.inventory.valuationAtMrp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/60">
                    Potential Retail Profit in Stock: <strong className="text-emerald-600 font-mono">₹{selectedChemist.inventory.potentialProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>

                <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-xs space-y-2">
                  <div className="font-bold text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Wallet className="h-4 w-4 text-purple-600" />
                      Market Credit &amp; Ledger Exposure
                    </span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      Net: ₹{(selectedChemist.ledger.accountsReceivable - selectedChemist.ledger.accountsPayable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div>
                      <span className="text-muted-foreground block">Payable to Suppliers:</span>
                      <span className="font-mono font-bold text-rose-600">
                        ₹{selectedChemist.ledger.accountsPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Receivable from Patients:</span>
                      <span className="font-mono font-bold text-emerald-600">
                        ₹{selectedChemist.ledger.accountsReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/60">
                    Paid to Distributors: <strong className="text-foreground font-mono">₹{selectedChemist.purchases.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              </div>

              {/* Top 5 Profit Driving Medicines */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    Top Profit-Driving Medicines
                  </span>
                  <span className="text-[10px] text-muted-foreground">Ranked by Net Margin Generation</span>
                </div>

                {selectedChemist.topMedicines.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No medicine sales recorded yet.</p>
                ) : (
                  <div className="rounded-lg border border-border/70 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground text-[10px] uppercase font-semibold border-b">
                        <tr>
                          <th className="py-2 px-2.5">Medicine Name</th>
                          <th className="py-2 px-2 text-right">Units Sold</th>
                          <th className="py-2 px-2 text-right">Revenue</th>
                          <th className="py-2 px-2 text-right">Cost</th>
                          <th className="py-2 px-2 text-right">Gross Profit</th>
                          <th className="py-2 px-2.5 text-right">Margin %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {selectedChemist.topMedicines.map((m, idx) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="py-1.5 px-2.5 font-medium text-foreground">{m.name}</td>
                            <td className="py-1.5 px-2 text-right font-mono">{m.unitsSold}</td>
                            <td className="py-1.5 px-2 text-right font-mono">₹{m.revenue.toFixed(2)}</td>
                            <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">₹{m.cost.toFixed(2)}</td>
                            <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-600">₹{m.profit.toFixed(2)}</td>
                            <td className="py-1.5 px-2.5 text-right font-mono font-bold">
                              <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono text-emerald-600 border-emerald-500/30">
                                {m.marginPercent}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Individual Item Purchase & Sales Ledger (All Medicines) */}
              <div className="space-y-2 mb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                      Individual Item Purchase &amp; Sales Ledger
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Full medicine-by-medicine breakdown of inward purchases, outward sales, COGS, gross profit, and stock positions.
                    </span>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-2 text-muted-foreground" />
                    <Input
                      placeholder="Filter medicine, formula, SKU..."
                      value={itemSearchTerm}
                      onChange={(e) => setItemSearchTerm(e.target.value)}
                      className="pl-8 h-7 text-xs"
                    />
                  </div>
                </div>

                {filteredItemLedger.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 border rounded-lg p-3 text-center">
                    No matching medicines found in this chemist&apos;s catalog.
                  </p>
                ) : (
                  <div className="rounded-lg border border-border/70 overflow-hidden shadow-xs">
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/70 text-muted-foreground text-[10px] uppercase font-semibold border-b sticky top-0 z-10 backdrop-blur-xs">
                          <tr>
                            <th className="py-2 px-2.5">Medicine &amp; SKU</th>
                            <th className="py-2 px-2 text-right">Inward Purchases</th>
                            <th className="py-2 px-2 text-right">Sales Outward</th>
                            <th className="py-2 px-2 text-right">COGS</th>
                            <th className="py-2 px-2 text-right">Gross Profit &amp; Margin</th>
                            <th className="py-2 px-2.5 text-right">Live Stock &amp; Valuation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {filteredItemLedger.map((it) => (
                            <tr key={it.productId} className="hover:bg-muted/30">
                              <td className="py-2 px-2.5">
                                <div className="font-semibold text-foreground">{it.productName}</div>
                                <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                                  <span>{it.sku}</span>
                                  {it.hsnCode && <span>&bull; HSN: {it.hsnCode}</span>}
                                  {it.genericName && <span>&bull; {it.genericName}</span>}
                                </div>
                              </td>

                              <td className="py-2 px-2 text-right">
                                <div className="font-mono font-bold text-foreground">
                                  ₹{it.totalPurchaseSpend.toFixed(2)}
                                </div>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {it.totalInwardUnits} units @ ₹{it.avgPurchaseRate.toFixed(2)}
                                </div>
                                {it.primarySupplier && (
                                  <div className="text-[9px] text-muted-foreground truncate max-w-[140px] ml-auto">
                                    {it.primarySupplier}
                                  </div>
                                )}
                              </td>

                              <td className="py-2 px-2 text-right">
                                <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  ₹{it.grossSalesRevenue.toFixed(2)}
                                </div>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {it.soldQuantity} sold @ ₹{it.avgSellingPrice.toFixed(2)}
                                </div>
                              </td>

                              <td className="py-2 px-2 text-right">
                                <div className="font-mono font-semibold text-muted-foreground">
                                  ₹{it.cogs.toFixed(2)}
                                </div>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  At Cost
                                </div>
                              </td>

                              <td className="py-2 px-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <span className="font-mono font-bold text-emerald-600 text-xs">
                                    ₹{it.grossProfit.toFixed(2)}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-[9px] py-0 px-1 font-bold text-emerald-600 border-emerald-500/30"
                                  >
                                    {it.profitMarginPercent}%
                                  </Badge>
                                </div>
                                <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
                                  +₹{it.profitPerUnit.toFixed(2)}/unit
                                </div>
                              </td>

                              <td className="py-2 px-2.5 text-right font-mono">
                                <div className="font-bold text-foreground">
                                  {it.availableStock} Units
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  Cost: ₹{it.stockValuationAtCost.toFixed(2)}
                                </div>
                                <div className="text-[9px] text-emerald-600">
                                  MRP: ₹{it.stockValuationAtMrp.toFixed(2)}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Invoices Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Receipt className="h-3.5 w-3.5 text-primary" />
                    Recent Completed Invoices
                  </span>
                  <span className="text-[10px] text-muted-foreground">Last 5 Transactions</span>
                </div>

                {selectedChemist.recentInvoices.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No invoices recorded yet.</p>
                ) : (
                  <div className="rounded-lg border border-border/70 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground text-[10px] uppercase font-semibold border-b">
                        <tr>
                          <th className="py-2 px-2.5">Invoice #</th>
                          <th className="py-2 px-2">Date</th>
                          <th className="py-2 px-2">Customer</th>
                          <th className="py-2 px-2">Mode</th>
                          <th className="py-2 px-2.5 text-right">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {selectedChemist.recentInvoices.map((inv, idx) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="py-1.5 px-2.5 font-mono font-bold text-primary">{inv.invoiceNumber}</td>
                            <td className="py-1.5 px-2 text-muted-foreground font-mono">{inv.date}</td>
                            <td className="py-1.5 px-2 text-foreground">{inv.customerName}</td>
                            <td className="py-1.5 px-2">
                              <Badge variant="secondary" className="text-[9px] py-0 px-1 font-mono uppercase">
                                {inv.paymentMethod}
                              </Badge>
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-mono font-bold text-emerald-600">
                              ₹{inv.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-4 border-t pt-3 flex flex-row items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExportSingleShopId(selectedChemist.organizationId)
                    setExportDialogOpen(true)
                  }}
                  className="text-xs gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold shadow-xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Download Formatted Excel (.xlsx)</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDrilldownOpen(false)}
                  className="text-xs"
                >
                  Close Drilldown
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── ONBOARD CHEMIST SHOP DIALOG ─── */}
      <Dialog open={onboardOpen} onOpenChange={setOnboardOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              Onboard New Tenant Chemist Shop
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provisions an isolated child tenant schema with its own Shop Administrator, drug catalog, inventory, and POS counters.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleOnboardSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="shop-code" className="text-xs font-semibold">
                  Store Code (Unique Identifier) *
                </Label>
                <Input
                  id="shop-code"
                  placeholder="e.g. MEDPLUS, APOLLO"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                  required
                  className="font-mono uppercase text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="shop-name" className="text-xs font-semibold">
                  Chemist Shop / Pharmacy Name *
                </Label>
                <Input
                  id="shop-name"
                  placeholder="e.g. Apollo Pharmacy & Healthcare"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="shop-city" className="text-xs">City</Label>
                <Input
                  id="shop-city"
                  placeholder="e.g. Hyderabad"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="shop-state" className="text-xs">State</Label>
                <Input
                  id="shop-state"
                  placeholder="e.g. Telangana"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="shop-zone" className="text-xs font-semibold text-primary">
                  Geo-Political Zone *
                </Label>
                <Select
                  value={formData.zone}
                  onValueChange={(val) => setFormData({ ...formData, zone: val })}
                >
                  <SelectTrigger id="shop-zone" className="text-xs h-9 border-primary/40 bg-primary/5">
                    <SelectValue placeholder="Select Geo-Political Zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="South Zone">South Zone (TS, KA, AP, TN, KL)</SelectItem>
                    <SelectItem value="North Zone">North Zone (DL, HR, PB, RJ, UP)</SelectItem>
                    <SelectItem value="West Zone">West Zone (MH, GJ, GA)</SelectItem>
                    <SelectItem value="East Zone">East Zone (WB, BR, OD, AS)</SelectItem>
                    <SelectItem value="Central Zone">Central Zone (MP, CG)</SelectItem>
                    <SelectItem value="On-Premises / LAN">On-Premises / Dispensary LAN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Shop Admin Credentials */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Chemist Shop Administrator Account
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="admin-name" className="text-xs">
                    Admin Full Name *
                  </Label>
                  <Input
                    id="admin-name"
                    placeholder="e.g. Ramesh Kumar"
                    value={formData.adminName}
                    onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                    required
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="admin-email" className="text-xs">
                    Admin Login Email *
                  </Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="e.g. admin@apollopharmacy.local"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                    required
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="admin-password" className="text-xs">
                    Initial Password *
                  </Label>
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={formData.adminPassword}
                    onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                    required
                    minLength={8}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="admin-phone" className="text-xs">
                    Phone Number
                  </Label>
                  <Input
                    id="admin-phone"
                    placeholder="e.g. 9876543210"
                    value={formData.adminPhone}
                    onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="shop-dl" className="text-xs">
                  Drug License (DL No.)
                </Label>
                <Input
                  id="shop-dl"
                  placeholder="e.g. 20B/21B-TS-55421"
                  value={formData.dlNumber}
                  onChange={(e) => setFormData({ ...formData, dlNumber: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="shop-gstin" className="text-xs">
                  GSTIN
                </Label>
                <Input
                  id="shop-gstin"
                  placeholder="e.g. 36AABCU9603R1ZM"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                  className="text-xs font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Subscription Plan</Label>
                <Select
                  value={formData.subscriptionPlan}
                  onValueChange={(val) => setFormData({ ...formData, subscriptionPlan: val })}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRIAL">Trial (14 Days)</SelectItem>
                    <SelectItem value="STARTER">Starter Plan (Single Counter)</SelectItem>
                    <SelectItem value="GROWTH">Growth Plan (Multi-Counter POS)</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise (Unlimited Counters)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="license-days" className="text-xs">
                  License Validity (Days)
                </Label>
                <Input
                  id="license-days"
                  type="number"
                  value={formData.subscriptionDurationDays}
                  onChange={(e) =>
                    setFormData({ ...formData, subscriptionDurationDays: parseInt(e.target.value, 10) || 365 })
                  }
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOnboardOpen(false)}
                disabled={onboarding}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={onboarding}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {onboarding ? 'Provisioning Tenant Workspace...' : '1-Click Onboard & Provision'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── CUSTOM EXCEL FINANCIAL EXPORT DIALOG ─── */}
      <ChemistExcelExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        analyticsData={analytics}
        initialSelectedChemistId={exportSingleShopId}
      />
    </div>
  )
}
