'use client'

// ─────────────────────────────────────────────────────────────
// Tally Export & Auto-Sync Hub Component
// Full Tally ERP 9 / TallyPrime Integration Dashboard:
// 1. 1-Click Voucher & Master XML/CSV Exports
// 2. Real-Time Auto-Sync on POS Charge & Sync Queue/Logs
// 3. GSTR-1 Ready Reports (B2B, B2C, Table 12 HSN Summary)
// 4. Master Ledger Sync (Credit Customers & Stock Items)
// 5. Server Connection Diagnostics & Ledger Mapping Settings
// ─────────────────────────────────────────────────────────────
import { format, startOfMonth, subDays } from 'date-fns'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Eye,
  FileCode,
  FileSpreadsheet,
  Layers,
  Loader2,
  Package,
  Receipt,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  Truck,
  Users,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  BatchSummaryItem,
  Gstr1ReportSummary,
  TallyConfig,
  TallyExportFormat,
  TallyExportType,
  TallyPreviewResponse,
  TallyServerStatus,
  TallySyncLogEntry,
} from '@/lib/tally/tally-types'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/currency'

interface TallyExportHubProps {
  initialConfig: TallyConfig
  branches: { id: string; name: string; code: string | null }[]
}

export function TallyExportHub({ initialConfig, branches }: TallyExportHubProps) {
  const [activeTab, setActiveTab] = useState('export')
  const [selectedType, setSelectedType] = useState<TallyExportType>('sales')
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')

  // Config state
  const [config, setConfig] = useState<TallyConfig>(initialConfig)
  const [savingConfig, setSavingConfig] = useState(false)

  // Server health state
  const [serverStatus, setServerStatus] = useState<TallyServerStatus | null>(null)
  const [pinging, setPinging] = useState(false)

  // Sync log state
  const [syncLogs, setSyncLogs] = useState<TallySyncLogEntry[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null)
  const [bulkSyncing, setBulkSyncing] = useState<string | null>(null)

  // Preview state
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewData, setPreviewData] = useState<TallyPreviewResponse | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // GSTR-1 state
  const [gstr1Loading, setGstr1Loading] = useState(false)
  const [gstr1Summary, setGstr1Summary] = useState<Gstr1ReportSummary | null>(null)

  // Batch Stock Summary state
  const [batchSummaryLoading, setBatchSummaryLoading] = useState(false)
  const [batchSummaryData, setBatchSummaryData] = useState<BatchSummaryItem[]>([])
  const [batchSearch, setBatchSearch] = useState('')
  const [batchFilterStatus, setBatchFilterStatus] = useState<'ALL' | 'ACTIVE' | 'NEAR_EXPIRY' | 'EXPIRED'>('ALL')

  // Quick date presets
  const applyPreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
    const today = new Date()
    switch (preset) {
      case 'today': {
        const d = format(today, 'yyyy-MM-dd')
        setStartDate(d)
        setEndDate(d)
        break
      }
      case 'yesterday': {
        const d = format(subDays(today, 1), 'yyyy-MM-dd')
        setStartDate(d)
        setEndDate(d)
        break
      }
      case 'week': {
        setStartDate(format(subDays(today, 7), 'yyyy-MM-dd'))
        setEndDate(format(today, 'yyyy-MM-dd'))
        break
      }
      case 'month': {
        setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'))
        setEndDate(format(today, 'yyyy-MM-dd'))
        break
      }
      case 'all': {
        setStartDate('')
        setEndDate('')
        break
      }
    }
  }

  // Check Tally server status
  const checkServerStatus = useCallback(
    async (url?: string) => {
      setPinging(true)
      try {
        const res = await fetch('/api/tally/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ping', serverUrl: url || config.serverUrl }),
        })
        const json = await res.json()
        if (json.success && json.data) {
          const statusData = json.data as TallyServerStatus
          setServerStatus(statusData)
          if (statusData.online) {
            toast.success('Accounting Server Connected', {
              description: `Responding in ${statusData.latencyMs}ms on port 9000`,
            })
          } else {
            toast.info('Accounting Server Offline', { description: statusData.message })
          }
        }
      } catch {
        setServerStatus({
          online: false,
          url: url || config.serverUrl,
          message: 'Could not connect to local accounting server',
          checkedAt: new Date().toISOString(),
        })
      } finally {
        setPinging(false)
      }
    },
    [config.serverUrl]
  )

  // Fetch sync logs
  const fetchSyncLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const res = await fetch('/api/tally/sync')
      const json = await res.json()
      if (json.success) {
        if (json.serverStatus) setServerStatus(json.serverStatus as TallyServerStatus)
        if (json.syncLogs) setSyncLogs(json.syncLogs as TallySyncLogEntry[])
      }
    } catch {
      // Ignored
    } finally {
      setLoadingLogs(false)
    }
  }, [])

  // Fetch GSTR-1 summary
  const fetchGstr1Summary = useCallback(async () => {
    setGstr1Loading(true)
    try {
      const params = new URLSearchParams({
        type: 'gstr1',
        preview: 'true',
      })
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (selectedBranchId) params.set('branchId', selectedBranchId)

      const res = await fetch(`/api/tally/export?${params.toString()}`)
      const json = await res.json()
      if (json.success && json.gstr1Summary) {
        setGstr1Summary(json.gstr1Summary as Gstr1ReportSummary)
      }
    } catch {
      toast.error('Failed to load GSTR-1 metrics')
    } finally {
      setGstr1Loading(false)
    }
  }, [startDate, endDate, selectedBranchId])

  useEffect(() => {
    void fetchSyncLogs()
  }, [fetchSyncLogs])

  // Batch stock summary fetch
  const fetchBatchSummary = useCallback(async () => {
    setBatchSummaryLoading(true)
    try {
      const params = new URLSearchParams({
        type: 'batch_summary',
        preview: 'true',
      })
      if (selectedBranchId) params.set('branchId', selectedBranchId)
      const res = await fetch(`/api/tally/export?${params.toString()}`)
      const json = (await res.json()) as TallyPreviewResponse
      if (json.success && json.batchSummaryItems) {
        setBatchSummaryData(json.batchSummaryItems)
      }
    } catch {
      toast.error('Failed to load batch stock summary')
    } finally {
      setBatchSummaryLoading(false)
    }
  }, [selectedBranchId])

  useEffect(() => {
    if (activeTab === 'batch-summary') {
      void fetchBatchSummary()
    }
  }, [activeTab, fetchBatchSummary])

  const getBatchExpiryStatus = (b: BatchSummaryItem): 'ACTIVE' | 'NEAR_EXPIRY' | 'EXPIRED' => {
    if (b.expiryStatus) return b.expiryStatus
    if (b.isExpired || b.status === 'EXPIRED') return 'EXPIRED'
    if (b.isNearExpiry) return 'NEAR_EXPIRY'
    return 'ACTIVE'
  }

  // Handle preview fetch
  const handlePreview = async (formatType: TallyExportFormat = 'csv') => {
    setPreviewLoading(true)
    try {
      const params = new URLSearchParams({
        type: selectedType,
        format: formatType,
        preview: 'true',
      })
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (selectedBranchId) params.set('branchId', selectedBranchId)

      const res = await fetch(`/api/tally/export?${params.toString()}`)
      const json = (await res.json()) as TallyPreviewResponse
      if (json.success) {
        setPreviewData(json)
        setPreviewOpen(true)
      } else {
        toast.error('Failed to generate preview')
      }
    } catch {
      toast.error('Failed to generate preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  // Handle direct download
  const handleDownload = (
    formatType: TallyExportFormat = 'csv',
    overrideType?: TallyExportType
  ) => {
    const type = overrideType || selectedType
    const params = new URLSearchParams({ type, format: formatType })
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (selectedBranchId) params.set('branchId', selectedBranchId)

    const downloadUrl = `/api/tally/export?${params.toString()}`
    const link = document.createElement('a')
    link.href = downloadUrl
    link.setAttribute('download', `ledger_${type}.${formatType}`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(
      `Downloading ${type.toUpperCase()} package (${formatType.toUpperCase()})...`
    )
  }

  // Handle retry
  const handleRetrySync = async (logId: string) => {
    setRetryingLogId(logId)
    try {
      const res = await fetch('/api/tally/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry', logId }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Sync Successful', { description: 'Voucher synchronized to ledger' })
        await fetchSyncLogs()
      } else {
        toast.error('Sync Notice', {
          description: json.data?.errorMessage || 'Could not push to accounting server',
        })
        await fetchSyncLogs()
      }
    } catch {
      toast.error('Sync Failed', { description: 'Could not reach local server' })
    } finally {
      setRetryingLogId(null)
    }
  }

  // Handle master bulk sync
  const handleBulkMasterSync = async (
    actionType: 'sync_all_credit_customers' | 'sync_all_products'
  ) => {
    setBulkSyncing(actionType)
    try {
      const res = await fetch('/api/tally/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionType }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Master Synced', {
          description: `Synchronized successfully (${json.data?.total || 0} records)`,
        })
        await fetchSyncLogs()
      } else {
        toast.error('Master Sync Failed', { description: json.error || 'Check accounting server connection' })
      }
    } catch {
      toast.error('Sync Failed', { description: 'Could not reach server' })
    } finally {
      setBulkSyncing(null)
    }
  }

  // Handle saving config
  const handleSaveConfig = async () => {
    setSavingConfig(true)
    try {
      const res = await fetch('/api/tally/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const json = (await res.json()) as { success: boolean; data?: TallyConfig }
      if (json.success && json.data) {
        setConfig(json.data)
        toast.success('Sync settings saved successfully!')
      } else {
        toast.error('Failed to save sync settings')
      }
    } catch {
      toast.error('Failed to save sync settings')
    } finally {
      setSavingConfig(false)
    }
  }

  const handleCopy = async () => {
    if (!previewData?.xmlPreview) return
    await navigator.clipboard.writeText(previewData.xmlPreview)
    setCopied(true)
    toast.success('Content copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* ─── Header & Diagnostics Bar ──────────────────────── */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Ledger & Accounts Sync Hub</h1>
            <Badge
              variant="outline"
              className={cn(
                'gap-2 px-2.5 py-0.5 text-xs font-semibold',
                serverStatus?.online
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
              )}
            >
              {serverStatus?.online ? (
                <>
                  <span className="beacon-emerald"><span className="core-dot" /></span>
                  Port 9000 Online ({serverStatus.latencyMs}ms)
                </>
              ) : (
                <>
                  <span className="beacon-amber"><span className="core-dot" /></span>
                  Port 9000 Offline / Standby
                </>
              )}
            </Badge>

            {config.autoSyncSales && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Zap className="h-3 w-3 text-amber-500" /> Auto-Push on Charge
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time voucher synchronization, GSTR-1 ready compliance exports, and master ledger
            matching.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={pinging}
            onClick={() => checkServerStatus()}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', pinging && 'animate-spin')} />
            {pinging ? 'Pinging...' : 'Check Connection'}
          </Button>

          <Button
            variant={serverStatus?.online ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
            onClick={() => setActiveTab('sync')}
          >
            <Activity className="h-3.5 w-3.5" />
            Sync Logs ({syncLogs.length})
          </Button>
        </div>
      </div>

      {/* ─── Main Tabs ─────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
          <TabsTrigger value="export" className="gap-1.5 text-xs md:text-sm">
            <Download className="h-4 w-4" />
            Vouchers
          </TabsTrigger>
          <TabsTrigger value="batch-summary" className="gap-1.5 text-xs md:text-sm">
            <Package className="h-4 w-4" />
            Batch Summary
          </TabsTrigger>
          <TabsTrigger value="gstr1" className="gap-1.5 text-xs md:text-sm">
            <FileSpreadsheet className="h-4 w-4" />
            GSTR-1 Reports
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-1.5 text-xs md:text-sm">
            <Activity className="h-4 w-4" />
            Real-Time Sync
          </TabsTrigger>
          <TabsTrigger value="masters" className="gap-1.5 text-xs md:text-sm">
            <Users className="h-4 w-4" />
            Master Sync
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5 text-xs md:text-sm">
            <Settings2 className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: EXPORT ───────────────────────────────── */}
        <TabsContent value="export" className="space-y-6">
          {/* Controls Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Scope & Period Filters</CardTitle>
              <CardDescription>
                Select date ranges and optional branch filters to generate XML and CSV exports.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => applyPreset('today')}>
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyPreset('yesterday')}>
                  Yesterday
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyPreset('week')}>
                  Last 7 Days
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyPreset('month')}>
                  This Month
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyPreset('all')}>
                  All Time
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="start-date" className="text-xs">
                    Start Date
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end-date" className="text-xs">
                    End Date
                  </Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                {branches.length > 1 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="branch-select" className="text-xs">
                      Store Branch
                    </Label>
                    <select
                      id="branch-select"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                    >
                      <option value="">All Authorized Branches</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Export Packages Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                id: 'sales' as TallyExportType,
                title: 'Sales Invoices',
                desc: 'POS & Counter bills with batch allocations, expiry, rates, & GST breakup.',
                icon: Receipt,
                badge: 'Sales Voucher',
                hasCsv: true,
              },
              {
                id: 'purchases' as TallyExportType,
                title: 'Purchase Bills',
                desc: 'Supplier GRNs with batch allocations, cost price, and input tax breakdown.',
                icon: Truck,
                badge: 'Purchase Voucher',
                hasCsv: true,
              },
              {
                id: 'daybook' as TallyExportType,
                title: 'Full Day Book',
                desc: 'Combined chronological package of both sales and purchases for the period.',
                icon: CalendarDays,
                badge: 'Combined Feed',
                hasCsv: true,
              },
              {
                id: 'customers' as TallyExportType,
                title: 'Customer Master',
                desc: 'Registered customers and credit accounts grouped under Sundry Debtors.',
                icon: Users,
                badge: 'Sundry Debtors',
                hasCsv: true,
              },
              {
                id: 'suppliers' as TallyExportType,
                title: 'Supplier Master',
                desc: 'Vendor accounts, drug license, and contact details under Sundry Creditors.',
                icon: Building2,
                badge: 'Sundry Creditors',
                hasCsv: true,
              },
              {
                id: 'stock_items' as TallyExportType,
                title: 'Stock Items Master',
                desc: 'Product catalog with HSN codes, GST rates, UQC units, and batch tracking enabled.',
                icon: Package,
                badge: 'Inventory Valuation',
                hasCsv: true,
              },
              {
                id: 'debit_notes' as TallyExportType,
                title: 'Debit Notes (Returns)',
                desc: 'Return expired or damaged stock to suppliers (Ctrl+F9) with input GST reversal.',
                icon: FileCode,
                badge: 'Debit Note Voucher',
                hasCsv: true,
              },
              {
                id: 'units' as TallyExportType,
                title: 'Units of Measurement',
                desc: 'Simple & compound units (Box, Strip, Nos, Kg, Grams) with conversion ratios.',
                icon: Layers,
                badge: 'Unit of Measure',
                hasCsv: true,
              },
              {
                id: 'price_lists' as TallyExportType,
                title: 'Multi-Tier Price Lists',
                desc: 'Price rules for Retailer, Stockist, & Wholesaler tiers with standard margins.',
                icon: Receipt,
                badge: 'Price Levels',
                hasCsv: true,
              },
              {
                id: 'company_setup' as TallyExportType,
                title: 'Company Setup & Statutory',
                desc: 'Statutory accounting features: GST activation, batch-wise details, mfg & exp date controls.',
                icon: Building2,
                badge: 'Statutory Features',
                hasCsv: true,
              },
            ].map((pkg) => {
              const isSelected = selectedType === pkg.id
              const Icon = pkg.icon

              return (
                <Card
                  key={pkg.id}
                  className={cn(
                    'relative flex cursor-pointer flex-col justify-between border card-elevate transition-all',
                    isSelected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary shadow-md'
                      : 'hover:border-primary/50'
                  )}
                  onClick={() => setSelectedType(pkg.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg',
                          isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {pkg.badge}
                      </Badge>
                    </div>
                    <CardTitle className="mt-3 text-base font-semibold">{pkg.title}</CardTitle>
                    <CardDescription className="text-xs">{pkg.desc}</CardDescription>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant={isSelected ? 'default' : 'outline'}
                        className="flex-1 gap-1.5 text-xs font-semibold"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedType(pkg.id)
                          handleDownload('csv', pkg.id)
                        }}
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                        Download CSV
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                        title="Download XML format for Tally Prime / ERP 9"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedType(pkg.id)
                          handleDownload('xml', pkg.id)
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        XML
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-xs"
                        disabled={previewLoading}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedType(pkg.id)
                          void handlePreview('csv')
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* ─── TAB: BATCH STOCK SUMMARY ───────────────────── */}
        <TabsContent value="batch-summary" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Pharma Batch-Wise Stock Summary
                  </CardTitle>
                  <CardDescription>
                    Real-time visibility into all medicine batches, manufacturing & expiry dates, MRP, and statutory compliance status.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => handleDownload('csv', 'batch_summary')}
                  >
                    <FileSpreadsheet className="h-4 w-4" /> Download CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => handleDownload('xml', 'batch_summary')}
                  >
                    <Download className="h-4 w-4" /> Export Tally XML
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5"
                    disabled={batchSummaryLoading}
                    onClick={() => void fetchBatchSummary()}
                  >
                    <RefreshCw className={cn('h-4 w-4', batchSummaryLoading && 'animate-spin')} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Metric Cards */}
              <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="text-xs font-medium text-muted-foreground">Total Batches</div>
                  <div className="mt-1 text-2xl font-bold">{batchSummaryData.length}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Across pharmacy inventory</div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="text-xs font-medium text-green-600 dark:text-green-400">Active (Saleable)</div>
                  <div className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
                    {batchSummaryData.filter((b) => getBatchExpiryStatus(b) === 'ACTIVE').length}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Valid expiry, active on POS</div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="text-xs font-medium text-amber-600 dark:text-amber-400">Near Expiry (&lt;90 Days)</div>
                  <div className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {batchSummaryData.filter((b) => getBatchExpiryStatus(b) === 'NEAR_EXPIRY').length}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Prioritize dispensing / FIFO</div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="text-xs font-medium text-destructive">Expired (Sales Blocked)</div>
                  <div className="mt-1 text-2xl font-bold text-destructive">
                    {batchSummaryData.filter((b) => getBatchExpiryStatus(b) === 'EXPIRED').length}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Auto-blocked; return via Debit Note</div>
                </div>
              </div>

              {/* Filters */}
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search medicine name, batch #, or SKU..."
                    value={batchSearch}
                    onChange={(e) => setBatchSearch(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    variant={batchFilterStatus === 'ALL' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBatchFilterStatus('ALL')}
                  >
                    All ({batchSummaryData.length})
                  </Button>
                  <Button
                    variant={batchFilterStatus === 'ACTIVE' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBatchFilterStatus('ACTIVE')}
                  >
                    Active
                  </Button>
                  <Button
                    variant={batchFilterStatus === 'NEAR_EXPIRY' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBatchFilterStatus('NEAR_EXPIRY')}
                  >
                    Near Expiry
                  </Button>
                  <Button
                    variant={batchFilterStatus === 'EXPIRED' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBatchFilterStatus('EXPIRED')}
                  >
                    Expired (Blocked)
                  </Button>
                </div>
              </div>

              {/* Data Table */}
              {batchSummaryLoading ? (
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : batchSummaryData.filter((b) => {
                  const q = batchSearch.toLowerCase()
                  const matches =
                    b.productName.toLowerCase().includes(q) ||
                    b.batchNumber.toLowerCase().includes(q) ||
                    (b.sku && b.sku.toLowerCase().includes(q))
                  if (!matches) return false
                  if (batchFilterStatus === 'ALL') return true
                  return getBatchExpiryStatus(b) === batchFilterStatus
                }).length === 0 ? (
                <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-dashed text-center text-muted-foreground">
                  <Package className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm font-medium">No batch stock records found</p>
                  <p className="text-xs">Adjust search query or filter to see batches.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5">Medicine / Item</th>
                        <th className="px-3 py-2.5">Batch No</th>
                        <th className="px-3 py-2.5">Mfg Date</th>
                        <th className="px-3 py-2.5">Expiry Date</th>
                        <th className="px-3 py-2.5 text-right">Stock Qty</th>
                        <th className="px-3 py-2.5 text-right">Cost Rate</th>
                        <th className="px-3 py-2.5 text-right">MRP</th>
                        <th className="px-3 py-2.5 text-center">Days Left</th>
                        <th className="px-3 py-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {batchSummaryData
                        .filter((b) => {
                          const q = batchSearch.toLowerCase()
                          const matches =
                            b.productName.toLowerCase().includes(q) ||
                            b.batchNumber.toLowerCase().includes(q) ||
                            (b.sku && b.sku.toLowerCase().includes(q))
                          if (!matches) return false
                          if (batchFilterStatus === 'ALL') return true
                          return getBatchExpiryStatus(b) === batchFilterStatus
                        })
                        .map((b) => {
                          const status = getBatchExpiryStatus(b)
                          return (
                            <tr key={b.id} className="hover:bg-muted/30">
                              <td className="px-3 py-2">
                                <div className="font-medium text-foreground">{b.productName}</div>
                                {b.sku && <div className="text-xs text-muted-foreground">SKU: {b.sku}</div>}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs font-medium">{b.batchNumber}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">
                                {b.manufacturingDate ? format(new Date(b.manufacturingDate), 'dd-MMM-yyyy') : '—'}
                              </td>
                              <td className="px-3 py-2 text-xs font-medium">
                                {format(new Date(b.expiryDate), 'dd-MMM-yyyy')}
                              </td>
                              <td className="px-3 py-2 text-right font-medium">
                                {b.quantity} {b.unitOfMeasure || 'Strip'}
                              </td>
                              <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                                {formatCurrency(b.purchasePrice)}
                              </td>
                              <td className="px-3 py-2 text-right font-medium">
                                {formatCurrency(b.mrp)}
                              </td>
                              <td className="px-3 py-2 text-center text-xs">
                                {b.daysToExpiry < 0 ? (
                                  <span className="font-semibold text-destructive">
                                    {Math.abs(b.daysToExpiry)}d ago
                                  </span>
                                ) : (
                                  <span>{b.daysToExpiry}d</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {status === 'EXPIRED' ? (
                                  <Badge variant="destructive" className="gap-1 text-[10px]">
                                    <ShieldAlert className="h-3 w-3" /> EXPIRED (BLOCKED)
                                  </Badge>
                                ) : status === 'NEAR_EXPIRY' ? (
                                  <Badge variant="outline" className="gap-1 border-amber-500 text-[10px] text-amber-600 dark:text-amber-400">
                                    <AlertTriangle className="h-3 w-3" /> &lt;90d Expiry
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="gap-1 border-green-600 text-[10px] text-green-600 dark:text-green-400">
                                    <CheckCircle2 className="h-3 w-3" /> Saleable
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 2: GSTR-1 REPORTS ──────────────────────── */}
        <TabsContent value="gstr1" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    GSTR-1 GST Portal & TallyPrime Ready
                  </CardTitle>
                  <CardDescription>
                    Outward supplies categorized by Table 4 (B2B registered), Table 7 (B2C
                    consumers), and Table 12 (HSN summary).
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => handleDownload('csv', 'gstr1')}
                  >
                    <Download className="h-4 w-4" /> Download GSTR-1 CSV
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => handleDownload('json', 'gstr1')}
                  >
                    <FileCode className="h-4 w-4" /> Export Offline JSON
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {gstr1Loading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : gstr1Summary ? (
                <div className="space-y-6">
                  {/* KPI Metrics */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <div className="text-xs font-medium text-muted-foreground">
                        Total Invoices
                      </div>
                      <div className="mt-1 text-2xl font-bold">{gstr1Summary.totalInvoices}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Gross: {formatCurrency(gstr1Summary.totalInvoiceValue)}
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-4">
                      <div className="text-xs font-medium text-muted-foreground">
                        Table 4: B2B Invoices
                      </div>
                      <div className="mt-1 text-2xl font-bold text-primary">
                        {gstr1Summary.b2bInvoicesCount}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Taxable: {formatCurrency(gstr1Summary.b2bTaxableValue)}
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-4">
                      <div className="text-xs font-medium text-muted-foreground">
                        Table 7: B2C Invoices
                      </div>
                      <div className="mt-1 text-2xl font-bold">{gstr1Summary.b2cInvoicesCount}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Taxable: {formatCurrency(gstr1Summary.b2cTaxableValue)}
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-4">
                      <div className="text-xs font-medium text-muted-foreground">
                        Total Tax Liability
                      </div>
                      <div className="mt-1 text-2xl font-bold text-emerald-600">
                        {formatCurrency(gstr1Summary.totalTax)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        CGST: {formatCurrency(gstr1Summary.totalCgst)} | SGST:{' '}
                        {formatCurrency(gstr1Summary.totalSgst)}
                      </div>
                    </div>
                  </div>

                  {/* Summary Breakdown table */}
                  <div className="overflow-hidden rounded-lg border text-sm">
                    <table className="w-full text-left">
                      <thead className="border-b bg-muted/50 text-xs font-semibold text-muted-foreground">
                        <tr>
                          <th className="p-3">Section / Table</th>
                          <th className="p-3">Description</th>
                          <th className="p-3 text-right">Count</th>
                          <th className="p-3 text-right">Taxable Value</th>
                          <th className="p-3 text-right">Tax Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        <tr>
                          <td className="p-3 font-medium">Table 4</td>
                          <td className="p-3 text-muted-foreground">
                            B2B Invoices (Registered buyers with GSTIN)
                          </td>
                          <td className="p-3 text-right">{gstr1Summary.b2bInvoicesCount}</td>
                          <td className="p-3 text-right">
                            {formatCurrency(gstr1Summary.b2bTaxableValue)}
                          </td>
                          <td className="p-3 text-right font-medium text-emerald-600">
                            {formatCurrency(
                              gstr1Summary.b2bInvoicesCount > 0 ? gstr1Summary.totalTax : 0
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-3 font-medium">Table 7</td>
                          <td className="p-3 text-muted-foreground">
                            B2C (Small) Invoices (Consumers & Unregistered)
                          </td>
                          <td className="p-3 text-right">{gstr1Summary.b2cInvoicesCount}</td>
                          <td className="p-3 text-right">
                            {formatCurrency(gstr1Summary.b2cTaxableValue)}
                          </td>
                          <td className="p-3 text-right font-medium text-emerald-600">
                            {formatCurrency(
                              gstr1Summary.b2cInvoicesCount > 0 ? gstr1Summary.totalTax : 0
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-3 font-medium">Table 12</td>
                          <td className="p-3 text-muted-foreground">
                            HSN-wise Summary of Outward Supplies
                          </td>
                          <td className="p-3 text-right">{gstr1Summary.hsnCount} HSNs</td>
                          <td className="p-3 text-right">
                            {formatCurrency(gstr1Summary.totalTaxableValue)}
                          </td>
                          <td className="p-3 text-right font-medium text-emerald-600">
                            {formatCurrency(gstr1Summary.totalTax)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Click &apos;Refresh&apos; to compute GSTR-1 metrics for the selected period.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 3: REAL-TIME SYNC & LOGS ──────────────── */}
        <TabsContent value="sync" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Live Push Queue & Sync History
                  </CardTitle>
                  <CardDescription>
                    Real-time status of sales pushed to accounting ledger on POS &apos;Charge&apos; and
                    purchase receipt sync events.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={loadingLogs}
                  onClick={() => fetchSyncLogs()}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', loadingLogs && 'animate-spin')} />
                  Refresh Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {syncLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Activity className="mb-2 h-10 w-10 opacity-40" />
                  <p className="font-medium">No synchronization events recorded yet</p>
                  <p className="mt-1 text-xs">
                    Every time a bill is charged at POS, the transaction will automatically appear
                    here.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b bg-muted/50 text-xs font-semibold text-muted-foreground">
                        <tr>
                          <th className="p-3">Status</th>
                          <th className="p-3">Entity</th>
                          <th className="p-3">Reference / Invoice</th>
                          <th className="p-3">Party / Item</th>
                          <th className="p-3 text-right">Amount</th>
                          <th className="p-3">Result / Error Message</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {syncLogs.map((log) => {
                          const isSynced = log.status === 'SYNCED'
                          const isOffline = log.status === 'OFFLINE'
                          const isRetrying = retryingLogId === log.id

                          return (
                            <tr key={log.id} className="transition-colors hover:bg-muted/30">
                              <td className="p-3">
                                {isSynced ? (
                                  <Badge className="gap-1 border-green-200 bg-green-100 text-xs text-green-800 dark:bg-green-950/50 dark:text-green-400">
                                    <CheckCircle2 className="h-3 w-3" /> Synced
                                  </Badge>
                                ) : isOffline ? (
                                  <Badge
                                    variant="outline"
                                    className="gap-1 border-amber-300 bg-amber-50 text-xs text-amber-700"
                                  >
                                    <Clock className="h-3 w-3" /> Offline
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="gap-1 text-xs">
                                    <AlertCircle className="h-3 w-3" /> Failed
                                  </Badge>
                                )}
                              </td>
                              <td className="p-3 text-xs font-medium">
                                <Badge variant="secondary" className="font-mono text-[10px]">
                                  {log.entityType}
                                </Badge>
                              </td>
                              <td className="p-3 font-mono text-xs">{log.referenceNumber}</td>
                              <td className="p-3 text-xs">{log.entityName || '—'}</td>
                              <td className="p-3 text-right font-mono text-xs">
                                {log.amount ? formatCurrency(log.amount) : '—'}
                              </td>
                              <td
                                className="max-w-xs truncate p-3 text-xs text-muted-foreground"
                                title={log.message}
                              >
                                {log.message}
                              </td>
                              <td className="p-3 text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1 text-xs"
                                  disabled={isRetrying}
                                  onClick={() => handleRetrySync(log.id)}
                                >
                                  <RefreshCw
                                    className={cn('h-3 w-3', isRetrying && 'animate-spin')}
                                  />
                                  {isSynced ? 'Re-push' : 'Retry'}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 4: MASTER SYNC ─────────────────────────── */}
        <TabsContent value="masters" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Credit Customers (Sundry Debtors)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Synchronize all customers with active credit limits, outstanding balances, or
                      GSTIN directly into accounting accounts.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  <p>
                    • Grouped automatically under{' '}
                    <code className="font-semibold text-primary">Sundry Debtors</code>
                  </p>
                  <p>• Carries customer GSTIN, address, credit limit, and current receivables</p>
                  <p>• Ensures credit sales on POS match customer ledger accounts</p>
                </div>
                <Button
                  className="w-full gap-2"
                  disabled={bulkSyncing === 'sync_all_credit_customers'}
                  onClick={() => handleBulkMasterSync('sync_all_credit_customers')}
                >
                  <Send
                    className={cn(
                      'h-4 w-4',
                      bulkSyncing === 'sync_all_credit_customers' && 'animate-spin'
                    )}
                  />
                  {bulkSyncing === 'sync_all_credit_customers'
                    ? 'Syncing to Accounts...'
                    : 'Push All Credit Customers to Accounts'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Stock Items & Inventory Valuation
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Synchronize your product catalog with HSN codes, GST tax rates, units of
                      measure, and batch tracking.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  <p>
                    • Enables <code className="font-semibold text-primary">Batch-wise Details</code>{' '}
                    in accounts ledger
                  </p>
                  <p>• Standardizes HSN codes (e.g. 3004) and GST slabs (5%, 12%, 18%)</p>
                  <p>• Aligns accounting stock valuation with your pharmacy inventory balance</p>
                </div>
                <Button
                  className="w-full gap-2"
                  disabled={bulkSyncing === 'sync_all_products'}
                  onClick={() => handleBulkMasterSync('sync_all_products')}
                >
                  <Send
                    className={cn('h-4 w-4', bulkSyncing === 'sync_all_products' && 'animate-spin')}
                  />
                  {bulkSyncing === 'sync_all_products'
                    ? 'Syncing to Accounts...'
                    : 'Push All Stock Items to Accounts'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── TAB 5: CONFIGURATION ───────────────────────── */}
        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Accounting Server & Real-Time Sync Settings
              </CardTitle>
              <CardDescription>
                Configure the HTTP endpoint of the accounting bridge server (default port 9000) and
                automated push rules.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="server-url">Accounting Server URL</Label>
                  <Input
                    id="server-url"
                    value={config.serverUrl}
                    placeholder="http://localhost:9000"
                    onChange={(e) => setConfig({ ...config, serverUrl: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use <code>http://localhost:9000</code> or the LAN IP of your accountant&apos;s
                    computer.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="company-name">Target Company / Books Name</Label>
                  <Input
                    id="company-name"
                    value={config.companyName}
                    placeholder="PharmaCare Pharmacy"
                    onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Must match the active company name in your accounting software.
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="text-xs font-medium">Automated Real-Time Push Triggers</div>
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={config.autoSyncSales}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                      onChange={(e) => setConfig({ ...config, autoSyncSales: e.target.checked })}
                    />
                    <span>
                      Auto-push Sales on POS <strong>&quot;Charge&quot;</strong> button
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={config.autoSyncPurchases}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                      onChange={(e) =>
                        setConfig({ ...config, autoSyncPurchases: e.target.checked })
                      }
                    />
                    <span>Auto-push Purchases when GRN is received</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ledger Mapping Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Ledger & Chart of Accounts Mapping
              </CardTitle>
              <CardDescription>
                Customize ledger names to match your exact chart of accounts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sales-ledger">Sales Account</Label>
                  <Input
                    id="sales-ledger"
                    value={config.salesLedger}
                    onChange={(e) => setConfig({ ...config, salesLedger: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="purchase-ledger">Purchase Account</Label>
                  <Input
                    id="purchase-ledger"
                    value={config.purchaseLedger}
                    onChange={(e) => setConfig({ ...config, purchaseLedger: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cash-ledger">Cash Ledger</Label>
                  <Input
                    id="cash-ledger"
                    value={config.cashLedger}
                    onChange={(e) => setConfig({ ...config, cashLedger: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bank-ledger">Bank Ledger</Label>
                  <Input
                    id="bank-ledger"
                    value={config.bankLedger}
                    onChange={(e) => setConfig({ ...config, bankLedger: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cgst-output">Output CGST</Label>
                  <Input
                    id="cgst-output"
                    value={config.cgstOutputLedger}
                    onChange={(e) => setConfig({ ...config, cgstOutputLedger: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sgst-output">Output SGST</Label>
                  <Input
                    id="sgst-output"
                    value={config.sgstOutputLedger}
                    onChange={(e) => setConfig({ ...config, sgstOutputLedger: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="igst-output">Output IGST</Label>
                  <Input
                    id="igst-output"
                    value={config.igstOutputLedger}
                    onChange={(e) => setConfig({ ...config, igstOutputLedger: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="round-off">Round Off Ledger</Label>
                  <Input
                    id="round-off"
                    value={config.roundOffLedger}
                    onChange={(e) => setConfig({ ...config, roundOffLedger: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="default-godown">Default Godown / Warehouse</Label>
                  <Input
                    id="default-godown"
                    value={config.defaultGodown}
                    onChange={(e) => setConfig({ ...config, defaultGodown: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button className="gap-2" disabled={savingConfig} onClick={handleSaveConfig}>
                  <Save className="h-4 w-4" />
                  {savingConfig ? 'Saving Settings...' : 'Save Configuration'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 6: IMPORT GUIDE ─────────────────────────── */}
        <TabsContent value="guide" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                How to Import XML into Accounting Software
              </CardTitle>
              <CardDescription>
                Follow these simple steps to import your downloaded vouchers and masters into your accounting system.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <div className="space-y-3">
                <h3 className="font-semibold text-primary">In TallyPrime:</h3>
                <ol className="ml-2 list-inside list-decimal space-y-2 text-muted-foreground">
                  <li>Open TallyPrime and load your Pharmacy company.</li>
                  <li>
                    Click on <strong className="text-foreground">Import</strong> at the top bar (or
                    press <kbd className="rounded border bg-muted px-1.5 py-0.5">Alt + O</kbd>).
                  </li>
                  <li>
                    Select <strong className="text-foreground">Transactions</strong> (for
                    Sales/Purchases/Daybook) or <strong className="text-foreground">Masters</strong>{' '}
                    (for Customers/Stock items).
                  </li>
                  <li>
                    Choose file format as{' '}
                    <strong className="text-foreground">XML (Data Interchange)</strong>.
                  </li>
                  <li>
                    Paste the file path of the downloaded file (e.g.{' '}
                    <code>C:\Downloads\tally_sales.xml</code>) and hit Enter.
                  </li>
                  <li>
                    Check the <strong className="text-foreground">Day Book</strong> or{' '}
                    <strong className="text-foreground">Tally.imp</strong> log file to confirm
                    voucher entries!
                  </li>
                </ol>
              </div>

              <div className="space-y-3 border-t pt-4">
                <h3 className="font-semibold text-primary">In Tally ERP 9:</h3>
                <ol className="ml-2 list-inside list-decimal space-y-2 text-muted-foreground">
                  <li>
                    From Gateway of Tally, go to{' '}
                    <strong className="text-foreground">Import of Data</strong> (press{' '}
                    <kbd className="rounded border bg-muted px-1.5 py-0.5">O</kbd>).
                  </li>
                  <li>
                    Select <strong className="text-foreground">Vouchers</strong> or{' '}
                    <strong className="text-foreground">Masters</strong>.
                  </li>
                  <li>Enter the full path of the exported XML file and press Enter.</li>
                </ol>
              </div>

              <div className="space-y-3 border-t pt-4">
                <h3 className="font-semibold text-primary">
                  Enabling Real-Time Port 9000 in Tally:
                </h3>
                <ol className="ml-2 list-inside list-decimal space-y-2 text-muted-foreground">
                  <li>
                    In TallyPrime, press{' '}
                    <kbd className="rounded border bg-muted px-1.5 py-0.5">F1</kbd> (Help) &gt;{' '}
                    <strong className="text-foreground">Settings</strong> &gt;{' '}
                    <strong className="text-foreground">Connectivity</strong>.
                  </li>
                  <li>
                    Set <strong className="text-foreground">Client/Server configuration</strong> to{' '}
                    <strong className="text-foreground">Both</strong>.
                  </li>
                  <li>
                    Set Port to <strong className="text-foreground">9000</strong> and save.
                  </li>
                  <li>Restart Tally once to listen for real-time POS pushes.</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── XML Preview Modal ─────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-primary" />
                Preview: {previewData?.filename}
              </DialogTitle>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <DialogDescription>
              {previewData?.summary.voucherCount || 0} record(s) found | Total:{' '}
              {formatCurrency(previewData?.summary.totalAmount || 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto rounded-lg border bg-muted/30 p-4 font-mono text-xs">
            <pre className="whitespace-pre-wrap break-all text-muted-foreground">
              {previewData?.xmlPreview}
            </pre>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              Showing preview of first 4,000 characters (Total length:{' '}
              {previewData?.fullXmlLength.toLocaleString()} bytes)
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  setPreviewOpen(false)
                  handleDownload('csv')
                }}
                className="gap-1.5 font-semibold"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" /> Download CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPreviewOpen(false)
                  handleDownload('xml')
                }}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" /> Export XML
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
