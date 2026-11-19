'use client'

// ─────────────────────────────────────────────────────────────
// Component — AdjustmentsView
// High-standard enterprise Stock Adjustments container:
// - Physical Storage Location & Box discrepancy correlation
// - Multi-threaded Financial Impact KPIs (Cost & MRP delta)
// - Dead Stock & Near-Expiry vendor intervention tracking
// - Batch-aware CSV audit export
// - Responsive approval workflow (≤10 auto-approve / >10 supervisor)
// ─────────────────────────────────────────────────────────────
import {
  AlertTriangle,
  Boxes,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Layers,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { AdjustmentFormDialog } from '@/components/inventory/adjustment-form'
import { EditAdjustmentDialog } from '@/components/inventory/edit-adjustment-dialog'
import {
  AdjustmentsTable,
  type AdjustmentRow,
  type AdjustmentStatus,
  type AdjustmentType,
} from '@/components/inventory/adjustments-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import { useUiStore } from '@/lib/stores/ui-store'
import { formatDateTime } from '@/lib/utils/date'

export interface AdjustmentSummaryKPIs {
  totalCount: number
  netQuantity: number
  netCostImpact: number
  netMrpImpact: number
  nearExpiryCount: number
  deadStockCount: number
  boxDiscrepancyCount: number
}

interface SupplierOption {
  id: string
  name: string
  totalBatches?: number
}

interface AdjustmentsViewProps {
  initialRows: AdjustmentRow[]
  initialPagination: { page: number; limit: number; total: number; pages: number }
  initialBranchId: string | null
  initialSummary?: AdjustmentSummaryKPIs
  canAdjust: boolean
  canApprove: boolean
}

interface BranchOption {
  id: string
  name: string
  code: string | null
}

const STATUS_OPTIONS: { value: AdjustmentStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved & Applied' },
  { value: 'REJECTED', label: 'Rejected' },
]

const TYPE_OPTIONS: { value: AdjustmentType; label: string }[] = [
  { value: 'PHYSICAL_COUNT', label: 'Physical Count Discrepancy' },
  { value: 'EXPIRY', label: 'Near Expiry / Expired' },
  { value: 'DAMAGE', label: 'Damaged Goods' },
  { value: 'THEFT', label: 'Theft / Missing' },
  { value: 'CORRECTION', label: 'Inventory Correction' },
  { value: 'OPENING_STOCK', label: 'Opening Stock' },
]

export function AdjustmentsView({
  initialRows,
  initialPagination,
  initialBranchId,
  initialSummary,
  canAdjust,
  canApprove,
}: AdjustmentsViewProps) {
  const toast = useToast()
  const { openConfirmDialog } = useUiStore()

  const [rows, setRows] = useState<AdjustmentRow[]>(initialRows)
  const [totalPages, setTotalPages] = useState(initialPagination.pages)
  const [page, setPage] = useState(initialPagination.page)
  const [totalCount, setTotalCount] = useState(initialPagination.total)
  const [summary, setSummary] = useState<AdjustmentSummaryKPIs | undefined>(initialSummary)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [branchId, setBranchId] = useState<string>(initialBranchId ?? 'all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingAdjustment, setEditingAdjustment] = useState<AdjustmentRow | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [formDefaultSupplierId, setFormDefaultSupplierId] = useState<string | null>(null)
  const [formInitialItems, setFormInitialItems] = useState<any[]>([])

  // Status counts
  const pendingCount = rows.filter((r) => r.status === 'PENDING').length
  const approvedCount = rows.filter((r) => r.status === 'APPROVED').length

  // Fallback summary computation if API summary is null
  const computedSummary = useMemo(() => {
    if (summary) return summary

    let netQty = 0
    let costImp = 0
    let mrpImp = 0
    let nearExp = 0
    let deadCount = 0
    let boxDiscrepancies = 0

    for (const r of rows) {
      netQty += r.quantity
      if (r.costImpact != null) costImp += r.costImpact
      if (r.mrpImpact != null) mrpImp += r.mrpImpact
      if (r.isNearExpiry) nearExp++
      if (r.isDeadStock) deadCount++
      if (r.adjustmentType === 'PHYSICAL_COUNT' && (r.product?.rack || r.product?.box)) {
        boxDiscrepancies++
      }
    }

    return {
      totalCount: rows.length,
      netQuantity: netQty,
      netCostImpact: Math.round(costImp * 100) / 100,
      netMrpImpact: Math.round(mrpImp * 100) / 100,
      nearExpiryCount: nearExp,
      deadStockCount: deadCount,
      boxDiscrepancyCount: boxDiscrepancies,
    }
  }, [summary, rows])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    fetch('/api/inventory/branches')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setBranches(d.data as BranchOption[])
      })
      .catch(() => undefined)

    fetch('/api/inventory/vendor-stock')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) {
          setSuppliers(
            d.data.map((v: any) => ({
              id: v.supplierId,
              name: v.supplierName,
              totalBatches: v.batches?.length ?? 0,
            }))
          )
        }
      })
      .catch(() => undefined)
  }, [])

  const load = useCallback(
    async (opts?: { page?: number; reset?: boolean }) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(opts?.reset ? 1 : (opts?.page ?? page)))
        params.set('limit', '20')
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (branchId !== 'all') params.set('branchId', branchId)
        if (statusFilter !== 'all') params.set('status', statusFilter)
        if (typeFilter !== 'all') params.set('adjustmentType', typeFilter)
        if (supplierFilter !== 'all') params.set('supplierId', supplierFilter)

        const res = await fetch(`/api/inventory/adjustments?${params.toString()}`)
        const json = (await res.json()) as {
          success: boolean
          data?: AdjustmentRow[]
          summary?: AdjustmentSummaryKPIs
          pagination?: { page: number; total: number; pages: number }
        }
        if (json.success) {
          setRows(json.data ?? [])
          if (json.summary) setSummary(json.summary)
          setTotalPages(json.pagination?.pages ?? 1)
          setPage(json.pagination?.page ?? 1)
          setTotalCount(json.pagination?.total ?? 0)
        } else {
          toast.error('Failed to load adjustments')
        }
      } catch {
        toast.error('Failed to load adjustments')
      } finally {
        setLoading(false)
      }
    },
    [page, debouncedSearch, branchId, statusFilter, typeFilter, supplierFilter, toast]
  )

  useEffect(() => {
    void load({ reset: true })
  }, [debouncedSearch, branchId, statusFilter, typeFilter, supplierFilter])

  async function approve(row: AdjustmentRow) {
    openConfirmDialog({
      title: 'Approve Stock Adjustment',
      description: `Apply ${row.quantity > 0 ? '+' : ''}${row.quantity} units for "${row.product.name}" at ${row.branch.name}? This will immediately update the live inventory balance.`,
      variant: 'default',
      onConfirm: async () => {
        const res = await fetch(`/api/inventory/adjustments/${row.id}/approve`, { method: 'POST' })
        if (res.ok) {
          toast.success('Adjustment approved and inventory updated')
          void load()
        } else {
          const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
          toast.error(json.error?.message ?? 'Failed to approve adjustment')
        }
      },
    })
  }

  async function reject(row: AdjustmentRow) {
    openConfirmDialog({
      title: 'Reject Stock Adjustment',
      description: `Reject ${row.quantity > 0 ? '+' : ''}${row.quantity} units adjustment for "${row.product.name}"? Live stock will not be affected.`,
      variant: 'destructive',
      onConfirm: async () => {
        const res = await fetch(`/api/inventory/adjustments/${row.id}/reject`, { method: 'POST' })
        if (res.ok) {
          toast.success('Adjustment rejected')
          void load()
        } else {
          const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
          toast.error(json.error?.message ?? 'Failed to reject adjustment')
        }
      },
    })
  }

  function handleEdit(row: AdjustmentRow) {
    setEditingAdjustment(row)
    setEditOpen(true)
  }

  async function handleDelete(row: AdjustmentRow) {
    const isPending = row.status === 'PENDING'
    openConfirmDialog({
      title: isPending ? 'Delete Raised Adjustment' : 'Reverse & Delete Adjustment',
      description: isPending
        ? `Permanently delete the pending adjustment of ${row.quantity > 0 ? '+' : ''}${row.quantity} units for "${row.product.name}"?`
        : `Delete and reverse approved adjustment of ${row.quantity > 0 ? '+' : ''}${row.quantity} units for "${row.product.name}"? This will reverse the stock change and restore previous inventory levels.`,
      variant: 'destructive',
      onConfirm: async () => {
        const res = await fetch(`/api/inventory/adjustments/${row.id}`, { method: 'DELETE' })
        if (res.ok) {
          toast.success(isPending ? 'Adjustment deleted' : 'Adjustment reversed and deleted')
          void load()
        } else {
          const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
          toast.error(json.error?.message ?? 'Failed to delete adjustment')
        }
      },
    })
  }

  function handleAppendMore(row: AdjustmentRow) {
    const supplierId = row.batch?.supplier?.id ?? null
    setFormDefaultSupplierId(supplierId)
    if (row.product) {
      const cost =
        row.batch?.purchasePrice != null
          ? Number(row.batch.purchasePrice)
          : row.product.costPrice != null
            ? Number(row.product.costPrice)
            : Number(row.product.mrp || 0) * 0.7
      const mrp = row.batch?.mrp != null ? Number(row.batch.mrp) : Number(row.product.mrp || 0)

      setFormInitialItems([
        {
          id: `init_${row.id}`,
          productId: row.productId,
          productName: row.product.name,
          sku: row.product.sku,
          rack: row.product.rack,
          shelf: row.product.shelf,
          box: row.product.box,
          batchId: row.batchId || undefined,
          batchNumber: row.batch?.batchNumber,
          expiryDate: row.batch?.expiryDate ? new Date(row.batch.expiryDate).toISOString() : undefined,
          supplierName: row.batch?.supplier?.name,
          adjustmentType: row.adjustmentType,
          quantity: row.quantity,
          unitCost: cost,
          unitMrp: mrp,
          itemCostValue: Math.round(row.quantity * cost * 100) / 100,
          itemMrpValue: Math.round(row.quantity * mrp * 100) / 100,
          reason: row.reason,
          notes: row.notes || undefined,
        },
      ])
    }
    setFormOpen(true)
  }

  // Export CSV with full location, batch, vendor & financial valuation
  const handleExportCsv = () => {
    if (rows.length === 0) {
      toast.error('No adjustments to export')
      return
    }

    const headers = [
      'Date',
      'Product',
      'SKU',
      'Storage Location',
      'Batch Number',
      'Expiry Date',
      'Supplier / Vendor',
      'Branch',
      'Adjustment Type',
      'Delta Quantity',
      'Cost Impact (INR)',
      'MRP Impact (INR)',
      'Reason',
      'Status',
      'Auditor / Created By',
    ]

    const csvRows = rows.map((r) => {
      const p = r.product
      const locStr = [
        p.rack ? `Rack ${p.rack}` : null,
        p.shelf ? p.shelf : null,
        p.box ? `Box ${p.box}` : null,
      ]
        .filter(Boolean)
        .join(' > ') || 'Unassigned'

      const expDate = r.batch?.expiryDate
        ? new Date(r.batch.expiryDate).toLocaleDateString('en-IN')
        : 'N/A'

      return [
        `"${r.createdAt}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.sku}"`,
        `"${locStr}"`,
        `"${r.batch?.batchNumber || 'N/A'}"`,
        `"${expDate}"`,
        `"${(r.batch?.supplier?.name || 'N/A').replace(/"/g, '""')}"`,
        `"${r.branch.name.replace(/"/g, '""')}"`,
        `"${r.adjustmentType}"`,
        r.quantity,
        r.costImpact != null ? r.costImpact : 0,
        r.mrpImpact != null ? r.mrpImpact : 0,
        `"${r.reason.replace(/"/g, '""')}"`,
        `"${r.status}"`,
        `"${r.createdBy.name.replace(/"/g, '""')}"`,
      ]
    })

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `stock_adjustments_audit_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Adjustments audit log exported to CSV')
  }

  return (
    <div className="space-y-4">
      {/* Header & Quick Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-gradient-to-r from-card to-background p-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold tracking-tight text-foreground">
              Stock Variance &amp; Storage Audit Adjustments
            </h2>
            {pendingCount > 0 && (
              <Badge variant="warning" className="h-5 px-1.5 text-[10px] font-mono">
                {pendingCount} Pending Review
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Reconcile physical counts in storage racks and boxes, flag near-expiry returns, mitigate dead
            stock capital, and enforce dual-control governance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canAdjust && (
            <Button
              size="sm"
              onClick={() => setFormOpen(true)}
              className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground font-semibold shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Adjustment</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-8 gap-1.5 text-xs"
            title="Export Adjustments Audit to CSV"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="h-8 gap-1 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Multi-Threaded Analytics KPI Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Net Cost Impact */}
        <Card className="shadow-xs border-border/70">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Net Cost Impact</span>
              {computedSummary.netCostImpact >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
              )}
            </div>
            <div
              className={`text-lg font-bold font-mono ${
                computedSummary.netCostImpact >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {computedSummary.netCostImpact >= 0 ? '+' : ''}₹
              {computedSummary.netCostImpact.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">
              MRP Impact: {computedSummary.netMrpImpact >= 0 ? '+' : ''}₹
              {computedSummary.netMrpImpact.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        {/* Physical Box Discrepancies */}
        <Card className="shadow-xs border-border/70">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Box Discrepancies</span>
              <Layers className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-lg font-bold text-foreground">
              {computedSummary.boxDiscrepancyCount}{' '}
              <span className="text-xs font-normal text-muted-foreground">cycle counts</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Physical vs system shelf count variances
            </p>
          </CardContent>
        </Card>

        {/* Dead Stock Mitigations */}
        <Card className="shadow-xs border-border/70">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Dead Stock Actions</span>
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {computedSummary.deadStockCount}{' '}
              <span className="text-xs font-normal text-muted-foreground">skus audited</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Inactive medicines reconciled in storage
            </p>
          </CardContent>
        </Card>

        {/* Near Expiry / Vendor Returns */}
        <Card className="shadow-xs border-border/70">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Near-Expiry Batches</span>
              <Building2 className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {computedSummary.nearExpiryCount}{' '}
              <span className="text-xs font-normal text-muted-foreground">batches flagged</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Identified for vendor return or write-off
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product name, SKU, reason…"
            className="pl-8 h-8 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-44 h-8 text-xs font-medium">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id} className="text-xs">
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-xs font-medium">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-xs">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44 h-8 text-xs font-medium">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Adjustment Types</SelectItem>
              {TYPE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-48 h-8 text-xs font-medium">
              <SelectValue placeholder="All Vendors / Suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors / Suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.name} {s.totalBatches ? `(${s.totalBatches})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            Page {page} of {Math.max(totalPages, 1)} ({totalCount} total)
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => load({ page: page - 1 })}
            className="h-8 px-2 text-xs"
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => load({ page: page + 1 })}
            className="h-8 px-2 text-xs"
          >
            Next
          </Button>
        </div>
      </div>

      <AdjustmentsTable
        rows={rows}
        isLoading={loading}
        canApprove={canApprove}
        canAdjust={canAdjust}
        onApprove={approve}
        onReject={reject}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAppendMore={handleAppendMore}
      />

      <AdjustmentFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v)
          if (!v) {
            setFormDefaultSupplierId(null)
            setFormInitialItems([])
          }
        }}
        defaultBranchId={branchId !== 'all' ? branchId : initialBranchId}
        defaultSupplierId={formDefaultSupplierId}
        initialItems={formInitialItems}
        onCreated={() => void load({ reset: true })}
      />

      <EditAdjustmentDialog
        adjustment={editingAdjustment}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={() => void load()}
      />
    </div>
  )
}
