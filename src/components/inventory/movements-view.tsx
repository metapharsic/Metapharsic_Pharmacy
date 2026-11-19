'use client'

// ─────────────────────────────────────────────────────────────
// Component — MovementsView
// Complete Enterprise Stock Movements & Audit Ledger Container:
// - Physical Storage (Rack > Shelf > Box) location mapping
// - Chemist Assistance (Dead Stock & FEFO Near Expiry radar)
// - Vendor-specific movement tracking & Supplier Returns (RTV)
// - Multi-threaded Worker Analytics KPI cards
// - Provisioned DB movements via PostgreSQL transactions
// ─────────────────────────────────────────────────────────────
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Layers,
  MapPin,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Truck,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import {
  DeadStockClearanceDialog,
  RelocateBoxDialog,
  VendorReturnDialog,
} from '@/components/inventory/movement-action-dialogs'
import {
  MovementsTable,
  type MovementRow,
  type MovementType,
} from '@/components/inventory/movements-table'
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
import type { MovementAnalyticsSummary } from '@/lib/inventory/inventory-analytics-service'
import { useToast } from '@/lib/hooks/use-toast'

interface MovementsViewProps {
  initialRows: MovementRow[]
  initialPagination: { page: number; limit: number; total: number; pages: number }
  initialBranchId: string | null
}

interface BranchOption {
  id: string
  name: string
  code: string | null
}

interface SupplierOption {
  supplierId: string
  supplierName: string
  totalAvailableUnits?: number
}

const TYPE_OPTIONS: { value: MovementType; label: string }[] = [
  { value: 'IN', label: 'Stock In (Purchase/GRN)' },
  { value: 'OUT', label: 'Stock Out (Sale Dispense)' },
  { value: 'TRANSFER', label: 'Transfer / Box Relocate' },
  { value: 'ADJUSTMENT', label: 'Adjustment (Discrepancy)' },
  { value: 'RETURN_IN', label: 'Customer Return' },
  { value: 'RETURN_OUT', label: 'Supplier Return' },
  { value: 'WRITE_OFF', label: 'Damaged / Write-off' },
]

export function MovementsView({
  initialRows,
  initialPagination,
  initialBranchId,
}: MovementsViewProps) {
  const toast = useToast()

  const [rows, setRows] = useState<MovementRow[]>(initialRows)
  const [totalPages, setTotalPages] = useState(initialPagination.pages)
  const [page, setPage] = useState(initialPagination.page)
  const [totalCount, setTotalCount] = useState(initialPagination.total)
  const [summary, setSummary] = useState<MovementAnalyticsSummary | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [branchId, setBranchId] = useState<string>(initialBranchId ?? 'all')
  const [type, setType] = useState<string>('all')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [rackFilter, setRackFilter] = useState<string>('all')
  const [chemistScope, setChemistScope] = useState<string>('all')

  // Options
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [availableRacks, setAvailableRacks] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // Modals
  const [relocateOpen, setRelocateOpen] = useState(false)
  const [relocateProduct, setRelocateProduct] = useState<any>(null)
  const [vendorReturnOpen, setVendorReturnOpen] = useState(false)
  const [vendorReturnRow, setVendorReturnRow] = useState<any>(null)
  const [deadStockOpen, setDeadStockOpen] = useState(false)
  const [deadStockRow, setDeadStockRow] = useState<any>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  // Load branches
  useEffect(() => {
    fetch('/api/inventory/branches')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setBranches(d.data as BranchOption[])
      })
      .catch(() => undefined)
  }, [])

  // Load vendors for filter
  useEffect(() => {
    fetch('/api/inventory/vendor-stock')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setSuppliers(
            d.data.map((v: any) => ({
              supplierId: v.supplierId,
              supplierName: v.supplierName,
              totalAvailableUnits: v.totalAvailableUnits,
            }))
          )
        }
      })
      .catch(() => undefined)
  }, [])

  // Load racks for filter
  useEffect(() => {
    fetch('/api/inventory/racks')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.racks) {
          const rackNames = d.data.racks.map((r: any) => r.rackName)
          setAvailableRacks(rackNames)
        }
      })
      .catch(() => undefined)
  }, [])

  // Main load function
  const load = useCallback(
    async (opts?: { page?: number; reset?: boolean }) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(opts?.reset ? 1 : (opts?.page ?? page)))
        params.set('limit', '20')
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (branchId !== 'all') params.set('branchId', branchId)
        if (type !== 'all') params.set('type', type)
        if (supplierFilter !== 'all') params.set('supplierId', supplierFilter)
        if (rackFilter !== 'all') params.set('rack', rackFilter)

        if (chemistScope === 'near_expiry') {
          params.set('fefoStatus', 'near_expiry')
        } else if (chemistScope === 'expired') {
          params.set('fefoStatus', 'expired')
        } else if (chemistScope === 'dead_stock') {
          params.set('deadStockOnly', 'true')
        }

        const res = await fetch(`/api/inventory/movements?${params.toString()}`)
        const json = (await res.json()) as {
          success: boolean
          data?: MovementRow[]
          summary?: MovementAnalyticsSummary
          pagination?: { page: number; total: number; pages: number }
        }

        if (json.success) {
          setRows(json.data ?? [])
          if (json.summary) setSummary(json.summary)
          setTotalPages(json.pagination?.pages ?? 1)
          setPage(json.pagination?.page ?? 1)
          setTotalCount(json.pagination?.total ?? 0)
        } else {
          toast.error('Failed to load movements')
        }
      } catch {
        toast.error('Failed to load movements')
      } finally {
        setLoading(false)
      }
    },
    [page, debouncedSearch, branchId, type, supplierFilter, rackFilter, chemistScope, toast]
  )

  useEffect(() => {
    void load({ reset: true })
  }, [debouncedSearch, branchId, type, supplierFilter, rackFilter, chemistScope])

  // Row action handlers
  const handleRelocateClick = (row: MovementRow) => {
    setRelocateProduct({
      id: row.inventory.productId,
      name: row.inventory.product.name,
      sku: row.inventory.product.sku,
      rack: row.rack || row.inventory.product.rack,
      shelf: row.shelf || row.inventory.product.shelf,
      box: row.box || row.inventory.product.box,
    })
    setRelocateOpen(true)
  }

  const handleVendorReturnClick = (row: MovementRow) => {
    setVendorReturnRow(row)
    setVendorReturnOpen(true)
  }

  // Export CSV
  const handleExportCsv = () => {
    if (rows.length === 0) {
      toast.error('No stock movements to export')
      return
    }

    const headers = [
      'Date',
      'Product',
      'SKU',
      'Storage Rack',
      'Storage Shelf',
      'Storage Box',
      'Vendor / Supplier',
      'Batch Number',
      'Branch',
      'Movement Type',
      'Quantity Delta',
      'Quantity Before',
      'Quantity After',
      'Cost Valuation (INR)',
      'Reference Type',
      'Reference ID',
      'Notes',
    ]

    const csvRows = rows.map((r) => [
      `"${r.createdAt}"`,
      `"${(r.inventory.product.name || '').replace(/"/g, '""')}"`,
      `"${r.inventory.product.sku}"`,
      `"${r.rack || r.inventory.product.rack || 'Unassigned'}"`,
      `"${r.shelf || r.inventory.product.shelf || ''}"`,
      `"${r.box || r.inventory.product.box || ''}"`,
      `"${(r.supplierName || r.batch?.supplier?.name || 'Direct').replace(/"/g, '""')}"`,
      `"${r.batch?.batchNumber || ''}"`,
      `"${(r.inventory.branch.name || '').replace(/"/g, '""')}"`,
      `"${r.type}"`,
      r.quantity,
      r.quantityBefore,
      r.quantityAfter,
      r.costValuation ?? 0,
      `"${r.referenceType ?? ''}"`,
      `"${r.referenceId ?? ''}"`,
      `"${(r.notes ?? '').replace(/"/g, '""')}"`,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `mpharm_stock_movements_ledger_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Stock movements exported to CSV')
  }

  return (
    <div className="space-y-4">
      {/* ─── MULTI-THREADED WORKER ANALYTICS KPI CARDS ───────────── */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-300">
          {/* Card 1: Velocity & Inflow/Outflow */}
          <Card className="border border-border/70 bg-gradient-to-br from-card to-background shadow-xs">
            <CardContent className="p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  Stock Movement Velocity
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {summary.totalCount} events
                </Badge>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <span className="text-xs text-muted-foreground">Inflow: </span>
                  <span className="text-sm font-bold text-emerald-600 font-mono">
                    +{summary.inflowUnits} units
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Outflow: </span>
                  <span className="text-sm font-bold text-rose-600 font-mono">
                    -{summary.outflowUnits} units
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                Net Cost: ₹{(summary.inflowValuationAtCost - summary.outflowValuationAtCost).toFixed(2)}
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Physical Storage & Box Relocations */}
          <Card className="border border-border/70 bg-gradient-to-br from-card to-background shadow-xs">
            <CardContent className="p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Boxes className="h-3.5 w-3.5 text-sky-500" />
                  Physical Rack &amp; Box Activity
                </span>
                <Badge variant="outline" className="text-[10px] font-mono bg-sky-500/10 text-sky-600 border-sky-500/20">
                  {summary.rackBoxActivityCount} mapped
                </Badge>
              </div>
              <div className="pt-1 flex items-baseline justify-between">
                <span className="text-lg font-bold font-mono text-foreground">
                  {summary.transferCount}
                </span>
                <span className="text-xs text-muted-foreground">Box Relocations</span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                Top Active: {summary.topStorageLocations[0]?.location || 'All Storage Zones'}
              </p>
            </CardContent>
          </Card>

          {/* Card 3: FEFO & Expiry Radar */}
          <Card className="border border-border/70 bg-gradient-to-br from-card to-background shadow-xs">
            <CardContent className="p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  FEFO Expiry Radar
                </span>
                <Badge
                  variant={summary.expiredCount > 0 ? 'destructive' : 'warning'}
                  className="text-[10px] font-mono"
                >
                  {summary.fefoComplianceScore}% Compliant
                </Badge>
              </div>
              <div className="pt-1 flex items-baseline justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-amber-600 font-mono">
                    {summary.nearExpiryCount}
                  </span>
                  <span className="text-[11px] text-muted-foreground">&lt;90d Expiry</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-rose-600 font-mono">
                    {summary.expiredCount}
                  </span>
                  <span className="text-[11px] text-muted-foreground">Expired</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                First-Expiry-First-Out audit verified
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Dead Stock & Vendor Movements */}
          <Card className="border border-border/70 bg-gradient-to-br from-card to-background shadow-xs">
            <CardContent className="p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-indigo-500" />
                  Vendor Share &amp; Dead Stock
                </span>
                <Badge variant="outline" className="text-[10px] font-mono text-indigo-600 bg-indigo-500/10 border-indigo-500/20">
                  {summary.vendorCount} Vendors
                </Badge>
              </div>
              <div className="pt-1 flex items-baseline justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-rose-600 font-mono">
                    {summary.deadStockCount}
                  </span>
                  <span className="text-[11px] text-muted-foreground">Dead Stock Moved</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                Top Vendor: {summary.topVendors[0]?.supplierName || 'Primary Distributors'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── ACTION TOOLBAR ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-gradient-to-r from-card to-background p-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold tracking-tight text-foreground">
              Inventory Movement Audit Ledger
            </h2>
            <Badge variant="outline" className="text-[10px] font-mono">
              {totalCount} total entries
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Complete immutable transaction history with Rack &gt; Shelf &gt; Box storage tracking, vendor rollups, and FEFO compliance.
          </p>
        </div>

        {/* Quick Action Buttons for Chemist */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRelocateProduct(null)
              setRelocateOpen(true)
            }}
            className="h-8 gap-1.5 text-xs border-sky-500/30 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10"
            title="Relocate medicine or batch across physical storage boxes"
          >
            <Layers className="h-3.5 w-3.5 text-sky-500" />
            <span>Relocate Box</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDeadStockRow(null)
              setDeadStockOpen(true)
            }}
            className="h-8 gap-1.5 text-xs border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"
            title="Clear or write-off dead stock inventory"
          >
            <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
            <span>Dead Stock Clearance</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-8 gap-1.5 text-xs"
            title="Export Ledger to CSV"
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

      {/* ─── FILTERS TOOLBAR ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search medicine, SKU, Lot, or Reference…"
            className="pl-8 h-8 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Branch Filter */}
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-36 h-8 text-xs font-medium">
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

          {/* Movement Type Filter */}
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-44 h-8 text-xs font-medium">
              <SelectValue placeholder="All Movement Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Movement Types</SelectItem>
              {TYPE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Vendor / Supplier Filter */}
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-48 h-8 text-xs font-medium">
              <SelectValue placeholder="All Vendors / Suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors / Suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.supplierId} value={s.supplierId} className="text-xs">
                  {s.supplierName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Storage Rack Filter */}
          {availableRacks.length > 0 && (
            <Select value={rackFilter} onValueChange={setRackFilter}>
              <SelectTrigger className="w-36 h-8 text-xs font-medium">
                <SelectValue placeholder="All Storage Racks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Storage Racks</SelectItem>
                {availableRacks.map((r) => (
                  <SelectItem key={r} value={r} className="text-xs font-mono">
                    Rack: {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Chemist Scope Filter (FEFO / Dead Stock) */}
          <Select value={chemistScope} onValueChange={setChemistScope}>
            <SelectTrigger className="w-40 h-8 text-xs font-medium">
              <SelectValue placeholder="All Chemist Scopes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock Status</SelectItem>
              <SelectItem value="near_expiry" className="text-xs text-amber-600 font-medium">
                Near Expiry (&lt;90d)
              </SelectItem>
              <SelectItem value="expired" className="text-xs text-rose-600 font-medium">
                Expired Stock
              </SelectItem>
              <SelectItem value="dead_stock" className="text-xs text-rose-600 font-medium">
                Dead Stock Movement
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            Page {page} of {Math.max(totalPages, 1)}
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

      {/* Movements Table */}
      <MovementsTable
        rows={rows}
        isLoading={loading}
        onRelocate={handleRelocateClick}
        onVendorReturn={handleVendorReturnClick}
      />

      {/* Modals */}
      <RelocateBoxDialog
        open={relocateOpen}
        onOpenChange={setRelocateOpen}
        branchId={branchId}
        initialProduct={relocateProduct}
        onSuccess={() => void load({ reset: true })}
      />

      <VendorReturnDialog
        open={vendorReturnOpen}
        onOpenChange={setVendorReturnOpen}
        branchId={branchId}
        initialRow={vendorReturnRow}
        onSuccess={() => void load({ reset: true })}
      />

      <DeadStockClearanceDialog
        open={deadStockOpen}
        onOpenChange={setDeadStockOpen}
        branchId={branchId}
        initialRow={deadStockRow}
        onSuccess={() => void load({ reset: true })}
      />
    </div>
  )
}
