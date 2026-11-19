'use client'

// ─────────────────────────────────────────────────────────────
// Component — BatchesView
// Enhanced Batch Management: Multi-threaded worker analytics KPI
// cards, Chemist Decision Shortcuts, Rack/Box storage, and dialogs.
// ─────────────────────────────────────────────────────────────
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  Filter,
  Layers,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Truck,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import {
  BatchBlockDialog,
  BatchRelocateDialog,
  BatchVendorReturnDialog,
} from '@/components/batches/batch-action-dialogs'
import {
  BatchesTable,
  type BatchRow,
  type BatchStatusRow,
  STATUS_META,
} from '@/components/batches/batches-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import type { BatchAnalyticsSummary } from '@/lib/inventory/inventory-analytics-service'

interface BatchesViewProps {
  initialRows: BatchRow[]
  initialPagination: { page: number; limit: number; total: number; pages: number }
  initialSummary?: BatchAnalyticsSummary
}

const STATUS_OPTIONS = Object.entries(STATUS_META) as [
  BatchStatusRow,
  (typeof STATUS_META)[BatchStatusRow],
][]

export function BatchesView({
  initialRows,
  initialPagination,
  initialSummary,
}: BatchesViewProps) {
  const toast = useToast()

  const [rows, setRows] = useState<BatchRow[]>(initialRows)
  const [summary, setSummary] = useState<BatchAnalyticsSummary | undefined>(initialSummary)
  const [totalPages, setTotalPages] = useState(initialPagination.pages)
  const [page, setPage] = useState(initialPagination.page)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [fefoFilter, setFefoFilter] = useState<string>('all')
  const [rackFilter, setRackFilter] = useState<string>('')
  const [deadStockOnly, setDeadStockOnly] = useState<boolean>(false)
  const [loading, setLoading] = useState(false)

  // Dialog states
  const [relocateBatch, setRelocateBatch] = useState<BatchRow | null>(null)
  const [vendorReturnBatch, setVendorReturnBatch] = useState<BatchRow | null>(null)
  const [blockBatch, setBlockBatch] = useState<BatchRow | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(
    async (opts?: { page?: number; reset?: boolean }) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(opts?.reset ? 1 : (opts?.page ?? page)))
        params.set('limit', '20')
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (statusFilter !== 'all') params.set('status', statusFilter)
        if (fefoFilter !== 'all') params.set('fefoTier', fefoFilter)
        if (rackFilter) params.set('rack', rackFilter)
        if (deadStockOnly) params.set('deadStockOnly', 'true')

        const res = await fetch(`/api/batches?${params.toString()}`)
        const json = (await res.json()) as {
          success: boolean
          data?: BatchRow[]
          summary?: BatchAnalyticsSummary
          pagination?: { page: number; total: number; pages: number }
        }
        if (json.success) {
          setRows(json.data ?? [])
          if (json.summary) setSummary(json.summary)
          setTotalPages(json.pagination?.pages ?? 1)
          setPage(json.pagination?.page ?? 1)
        } else {
          toast.error('Failed to load batches')
        }
      } catch {
        toast.error('Failed to load batches')
      } finally {
        setLoading(false)
      }
    },
    [page, debouncedSearch, statusFilter, fefoFilter, rackFilter, deadStockOnly, toast]
  )

  useEffect(() => {
    void load({ reset: true })
  }, [debouncedSearch, statusFilter, fefoFilter, rackFilter, deadStockOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleQuickScope = (scope: 'all' | 'critical' | 'warning' | 'expired' | 'dead' | 'unassigned' | 'blocked') => {
    if (scope === 'all') {
      setStatusFilter('all')
      setFefoFilter('all')
      setDeadStockOnly(false)
      setRackFilter('')
    } else if (scope === 'critical') {
      setFefoFilter('critical')
      setStatusFilter('all')
      setDeadStockOnly(false)
    } else if (scope === 'warning') {
      setFefoFilter('warning')
      setStatusFilter('all')
      setDeadStockOnly(false)
    } else if (scope === 'expired') {
      setFefoFilter('expired')
      setStatusFilter('all')
      setDeadStockOnly(false)
    } else if (scope === 'dead') {
      setDeadStockOnly(true)
      setFefoFilter('all')
      setStatusFilter('all')
    } else if (scope === 'blocked') {
      setStatusFilter('BLOCKED')
      setFefoFilter('all')
      setDeadStockOnly(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* ─── Chemist Decision Strip ────────────────────────────── */}
      <div className="rounded-lg border bg-card/60 backdrop-blur-sm p-3 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Chemist FEFO & Storage Decision Shortcuts</span>
          </div>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Auto-synchronized with PostgreSQL
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <Button
            variant={fefoFilter === 'all' && !deadStockOnly && statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs font-medium"
            onClick={() => handleQuickScope('all')}
          >
            All Batches
          </Button>

          <Button
            variant={fefoFilter === 'critical' ? 'destructive' : 'outline'}
            size="sm"
            className={`h-7 text-xs font-medium gap-1.5 ${fefoFilter !== 'critical' ? 'border-rose-500/30 text-rose-600 hover:bg-rose-500/10' : ''}`}
            onClick={() => handleQuickScope('critical')}
          >
            <AlertTriangle className="h-3 w-3" />
            Critical FEFO (≤30d)
            {summary?.criticalCount ? (
              <Badge variant="destructive" className="ml-0.5 px-1 py-0 h-4 text-[9px] bg-rose-600">
                {summary.criticalCount}
              </Badge>
            ) : null}
          </Button>

          <Button
            variant={fefoFilter === 'warning' ? 'default' : 'outline'}
            size="sm"
            className={`h-7 text-xs font-medium gap-1.5 ${fefoFilter !== 'warning' ? 'border-amber-500/30 text-amber-600 hover:bg-amber-500/10' : 'bg-amber-600 hover:bg-amber-700'}`}
            onClick={() => handleQuickScope('warning')}
          >
            <Clock className="h-3 w-3" />
            Near Expiry (≤60d)
            {summary?.warningCount ? (
              <Badge variant="secondary" className="ml-0.5 px-1 py-0 h-4 text-[9px]">
                {summary.warningCount}
              </Badge>
            ) : null}
          </Button>

          <Button
            variant={fefoFilter === 'expired' ? 'destructive' : 'outline'}
            size="sm"
            className={`h-7 text-xs font-medium gap-1.5 ${fefoFilter !== 'expired' ? 'border-destructive/30 text-destructive hover:bg-destructive/10' : ''}`}
            onClick={() => handleQuickScope('expired')}
          >
            <AlertCircle className="h-3 w-3" />
            Expired ({summary?.expiredCount ?? 0})
          </Button>

          <Button
            variant={deadStockOnly ? 'default' : 'outline'}
            size="sm"
            className={`h-7 text-xs font-medium gap-1.5 ${!deadStockOnly ? 'border-purple-500/30 text-purple-600 hover:bg-purple-500/10' : 'bg-purple-600 hover:bg-purple-700'}`}
            onClick={() => handleQuickScope('dead')}
          >
            Dead Stock Batches ({summary?.deadStockBatchesCount ?? 0})
          </Button>

          <Button
            variant={statusFilter === 'BLOCKED' ? 'default' : 'outline'}
            size="sm"
            className={`h-7 text-xs font-medium gap-1.5 ${statusFilter !== 'BLOCKED' ? 'border-muted text-muted-foreground' : ''}`}
            onClick={() => handleQuickScope('blocked')}
          >
            <ShieldAlert className="h-3 w-3" />
            Quarantined ({summary?.quarantinedCount ?? 0})
          </Button>
        </div>
      </div>

      {/* ─── Multi-Threaded Worker Analytics Cards ─────────────── */}
      {summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                FEFO Urgency Radar
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
                  {summary.criticalCount}
                </span>
                <span className="text-xs text-muted-foreground">critical (≤30d)</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground border-t pt-1">
                <span>≤60d warning: {summary.warningCount}</span>
                <span className="font-mono text-rose-600">₹{summary.nearExpiryValuationAtCost.toFixed(0)} at risk</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Physical Storage (Rack/Box)
              </CardTitle>
              <Layers className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {summary.rackBoxAssignedCount}
                </span>
                <span className="text-xs text-muted-foreground">assigned</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground border-t pt-1">
                <span className="text-amber-600 font-medium">
                  {summary.unassignedStorageCount} unassigned boxes
                </span>
                <span className="font-mono">{summary.totalAvailableUnits} units total</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Dead Stock in Batches
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
                  {summary.deadStockBatchesCount}
                </span>
                <span className="text-xs text-muted-foreground">batches idle</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground border-t pt-1">
                <span>Locked Capital:</span>
                <span className="font-mono font-bold text-foreground">₹{summary.deadStockValuationAtCost.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total Batch Valuation
              </CardTitle>
              <Truck className="h-4 w-4 text-sky-500" />
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  ₹{summary.totalValuationAtCost.toFixed(2)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground border-t pt-1">
                <span>Vendors Active: {summary.topVendors?.length ?? 0}</span>
                <span className="font-mono">MRP: ₹{summary.totalValuationAtMrp.toFixed(0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Filter & Search Bar ──────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search batch number, medicine name, SKU, or supplier..."
            className="pl-8 text-xs"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map(([value, meta]) => (
              <SelectItem key={value} value={value}>
                {meta.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={fefoFilter} onValueChange={setFefoFilter}>
          <SelectTrigger className="w-36 text-xs">
            <SelectValue placeholder="FEFO Scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Expiry Dates</SelectItem>
            <SelectItem value="critical">Critical (≤30 Days)</SelectItem>
            <SelectItem value="warning">Warning (31-60 Days)</SelectItem>
            <SelectItem value="info">Info (61-90 Days)</SelectItem>
            <SelectItem value="healthy">Healthy (&gt;90 Days)</SelectItem>
            <SelectItem value="expired">Expired Batches</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative w-28">
          <Input
            value={rackFilter}
            onChange={(e) => setRackFilter(e.target.value)}
            placeholder="Filter Rack..."
            className="text-xs uppercase font-mono"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1 text-xs"
          onClick={() => void load({ reset: false })}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            Page {page} of {Math.max(totalPages, 1)}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => load({ page: page - 1 })}
            className="h-8 text-xs"
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => load({ page: page + 1 })}
            className="h-8 text-xs"
          >
            Next
          </Button>
        </div>
      </div>

      {/* ─── Batches Table ─────────────────────────────────────── */}
      <BatchesTable
        rows={rows}
        isLoading={loading}
        onRelocate={(b) => setRelocateBatch(b)}
        onVendorReturn={(b) => setVendorReturnBatch(b)}
        onBlock={(b) => setBlockBatch(b)}
      />

      {/* ─── Interactive Dialogs ───────────────────────────────── */}
      <BatchRelocateDialog
        batch={relocateBatch}
        open={Boolean(relocateBatch)}
        onOpenChange={(open) => !open && setRelocateBatch(null)}
        onSuccess={() => void load({ reset: false })}
      />

      <BatchVendorReturnDialog
        batch={vendorReturnBatch}
        open={Boolean(vendorReturnBatch)}
        onOpenChange={(open) => !open && setVendorReturnBatch(null)}
        onSuccess={() => void load({ reset: false })}
      />

      <BatchBlockDialog
        batch={blockBatch}
        open={Boolean(blockBatch)}
        onOpenChange={(open) => !open && setBlockBatch(null)}
        onSuccess={() => void load({ reset: false })}
      />
    </div>
  )
}
