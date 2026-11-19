'use client'

import { formatRack, formatShelf } from '@/lib/utils/rack'

import {
  AlertTriangle,
  ArrowDownRight,
  Boxes,
  Clock,
  DollarSign,
  Download,
  ExternalLink,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingDown,
  Undo2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/lib/hooks/use-toast'
import type { DeadStockItem, DeadStockResult } from '@/lib/inventory/inventory-analytics-service'
import { playBarcodeBeep } from '@/lib/scanner/barcode-sound'
import { addPosCartItem, type PosCartLine } from '@/lib/stores/pos-cart-store'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'

interface DeadStockViewProps {
  branchId: string
}

export function DeadStockView({ branchId }: DeadStockViewProps) {
  const router = useRouter()
  const toast = useToast()

  const [data, setData] = useState<DeadStockResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [thresholdDays, setThresholdDays] = useState('60')
  const [search, setSearch] = useState('')

  const loadDeadStock = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (branchId && branchId !== 'all') params.set('branchId', branchId)
      params.set('thresholdDays', thresholdDays)

      const res = await fetch(`/api/inventory/dead-stock?${params.toString()}`)
      if (!res.ok) {
        let errorMsg = `Server error (${res.status})`
        try {
          const errJson = await res.json()
          if (errJson?.error?.message) {
            errorMsg = errJson.error.message
          }
        } catch {
          // ignore non-json error responses
        }
        throw new Error(errorMsg)
      }

      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data as DeadStockResult)
        setError(null)
      } else {
        const errorMsg = json?.error?.message || 'Failed to load dead stock report'
        setError(errorMsg)
        toast.error(errorMsg)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error loading dead stock'
      setError(errorMsg)
      toast.error('Failed to load dead stock', errorMsg)
    } finally {
      setLoading(false)
    }
  }, [branchId, thresholdDays, toast])

  useEffect(() => {
    void loadDeadStock()
  }, [loadDeadStock])

  // Filter items in client by search query
  const filteredItems = (data?.deadItems || []).filter((item) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      item.productName.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.supplierName.toLowerCase().includes(q) ||
      (item.rack && item.rack.toLowerCase().includes(q)) ||
      (item.box && item.box.toLowerCase().includes(q))
    )
  })

  // 1-Click Quick Dispense to POS
  const handleDispenseToPos = (item: DeadStockItem) => {
    const cartItem: PosCartLine = {
      productId: item.productId,
      sku: item.sku,
      barcode: item.barcode ?? null,
      name: item.productName,
      genericName: null,
      unitOfMeasure: item.unitOfMeasure || 'Strip',
      mrp: item.mrp,
      gstRate: 12,
      cgstRate: 6,
      sgstRate: 6,
      igstRate: 0,
      hsnCode: '3004',
      drugSchedule: 'SCHEDULE_H',
      isPrescriptionRequired: false,
      isGstExempt: false,
      quantity: 1,
      discountPercent: 10, // Default 10% clearance incentive for dead stock
      availableQuantity: item.availableQuantity,
      batchId: undefined,
      batchNumber: item.batchNumber || undefined,
      expiryDate: item.expiryDate || undefined,
    }

    addPosCartItem(cartItem)
    playBarcodeBeep()
    toast.success(
      `Staged for Clearance: ${item.productName}`,
      `10% promo applied · ₹${cartItem.mrp} MRP`
    )
  }

  // Export CSV
  const handleExportCsv = () => {
    if (filteredItems.length === 0) {
      toast.error('No dead stock items to export')
      return
    }

    const headers = [
      'Medicine Name',
      'SKU',
      'Location (Rack > Shelf > Box)',
      'Available Units',
      'Days Inactive',
      'Status',
      'Cost Price',
      'MRP',
      'Capital Locked (Cost)',
      'Capital Locked (MRP)',
      'Supplying Vendor',
    ]

    const csvRows = [headers.join(',')]
    for (const i of filteredItems) {
      const loc = `${i.rack || ''} ${i.shelf || ''} ${i.box || ''}`.trim()
      const row = [
        `"${i.productName.replace(/"/g, '""')}"`,
        `"${i.sku}"`,
        `"${loc}"`,
        i.availableQuantity,
        i.daysInactive,
        i.status,
        i.costPrice,
        i.mrp,
        i.capitalLockedAtCost,
        i.capitalLockedAtMrp,
        `"${i.supplierName.replace(/"/g, '""')}"`,
      ]
      csvRows.push(row.join(','))
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mpharm-dead-stock-${thresholdDays}days-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Report Exported', `${filteredItems.length} dead stock rows exported`)
  }

  const s = data?.summary || {
    totalDeadItemsCount: 0,
    totalDeadCapitalAtCost: 0,
    totalDeadCapitalAtMrp: 0,
    slowMovingCount: 0,
    deadStockCount: 0,
    obsoleteCount: 0,
  }

  return (
    <div className="space-y-4">
      {/* Executive Dead Stock KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Locked Capital */}
        <div className="rounded-xl border border-destructive/30 bg-gradient-to-br from-destructive/10 via-card to-background p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-destructive">
            <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5" />
              Locked Working Capital
            </span>
            <Badge variant="destructive" className="text-[10px] font-mono">
              {s.totalDeadItemsCount} SKUs
            </Badge>
          </div>
          <div className="text-2xl font-bold font-mono text-destructive">
            {formatCurrency(s.totalDeadCapitalAtCost)}
          </div>
          <p className="text-[11px] text-muted-foreground border-t border-border/40 pt-1">
            Retail MRP value: {formatCurrency(s.totalDeadCapitalAtMrp)}
          </p>
        </div>

        {/* Slow Moving vs Obsolete */}
        <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-background p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Aging Breakdown
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-foreground">{s.deadStockCount}</span>
            <span className="text-xs text-muted-foreground">in 90-180d bracket</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-1">
            <span>{s.slowMovingCount} slow (60-90d)</span>
            <span className="text-destructive font-medium">{s.obsoleteCount} dormant (&gt;180d)</span>
          </div>
        </div>

        {/* Chemist Action Guide */}
        <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-background p-4 shadow-xs space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Undo2 className="h-3.5 w-3.5" />
            Chemist Recommendation
          </span>
          <p className="text-xs text-foreground font-medium">
            Initiate supplier return for items inactive &gt;90 days to recover working capital before expiry.
          </p>
          <div className="pt-0.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Download className="h-3 w-3" />
              <span>Export Return Statement</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-gradient-to-r from-card to-background p-4 shadow-xs">
        <div className="space-y-0.5">
          <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>Dead Stock &amp; Capital Lockup Radar</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Medicines sitting on shelves without movement. Relocate, return to vendor, or discount.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter medicine, vendor, rack, box…"
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Select value={thresholdDays} onValueChange={setThresholdDays}>
            <SelectTrigger className="w-40 h-8 text-xs font-medium">
              <SelectValue placeholder="Inactivity Window" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="60" className="text-xs">Inactive &ge; 60 Days</SelectItem>
              <SelectItem value="90" className="text-xs font-semibold text-amber-600">Inactive &ge; 90 Days (Dead)</SelectItem>
              <SelectItem value="180" className="text-xs font-semibold text-destructive">Inactive &ge; 180 Days (Obsolete)</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadDeadStock()}
            disabled={loading}
            className="h-8 gap-1 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Dead Stock Table */}
      <div className="rounded-xl border border-border/70 bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 text-xs">
              <TableHead className="font-semibold">Medicine &amp; SKU</TableHead>
              <TableHead className="font-semibold">Shelf Location</TableHead>
              <TableHead className="font-semibold">Supplying Vendor</TableHead>
              <TableHead className="font-semibold text-center">Days Inactive</TableHead>
              <TableHead className="font-semibold text-center">Status</TableHead>
              <TableHead className="font-semibold text-right">Units on Hand</TableHead>
              <TableHead className="font-semibold text-right">Capital Locked</TableHead>
              <TableHead className="font-semibold text-right pr-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-7 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-xs">
                  <div className="flex flex-col items-center justify-center space-y-2 text-destructive">
                    <AlertTriangle className="h-7 w-7 text-destructive" />
                    <span className="font-semibold text-foreground">{error}</span>
                    <span className="text-muted-foreground">
                      Failed to load the dead stock. Check your connection or try refreshing.
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void loadDeadStock()}
                      className="h-8 gap-1 text-xs mt-1 border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Retry</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-xs text-muted-foreground">
                  <div className="flex flex-col items-center justify-center space-y-1.5">
                    <Boxes className="h-7 w-7 text-emerald-500" />
                    <span className="font-semibold text-foreground">Zero Dead Stock</span>
                    <span className="text-muted-foreground">
                      No medicines have been inactive for &ge; {thresholdDays} days. High inventory turnover!
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item.inventoryId} className="hover:bg-muted/30 transition-colors text-xs">
                  <TableCell>
                    <div className="space-y-0.5">
                      <span className="font-semibold text-foreground block">
                        {item.productName}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                        <span>{item.sku}</span>
                        <span>· MRP {formatCurrency(item.mrp)}</span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Physical Location */}
                  <TableCell>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <MapPin className="h-3 w-3 text-amber-500 shrink-0" />
                      <span className="font-bold text-foreground">
                        {formatRack(item.rack) || 'Unassigned'}
                      </span>
                      {formatShelf(item.shelf) && <span className="text-muted-foreground">&gt; {formatShelf(item.shelf)}</span>}
                      {item.box && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-mono">
                          {item.box}
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Supplying Vendor */}
                  <TableCell>
                    <span className="text-xs text-muted-foreground block truncate max-w-[180px]">
                      {item.supplierName}
                    </span>
                  </TableCell>

                  {/* Days Inactive */}
                  <TableCell className="text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                    {item.daysInactive}d
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell className="text-center">
                    {item.status === 'OBSOLETE' ? (
                      <Badge variant="destructive" className="text-[10px] font-mono">
                        Obsolete (&gt;180d)
                      </Badge>
                    ) : item.status === 'DEAD_STOCK' ? (
                      <Badge variant="destructive" className="text-[10px] font-mono bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                        Dead Stock (&gt;90d)
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="text-[10px] font-mono">
                        Slow Moving
                      </Badge>
                    )}
                  </TableCell>

                  {/* Available Units */}
                  <TableCell className="text-right font-mono font-semibold">
                    {item.availableQuantity} {item.unitOfMeasure}
                  </TableCell>

                  {/* Capital Locked */}
                  <TableCell className="text-right font-mono">
                    <span className="font-bold text-destructive block">
                      {formatCurrency(item.capitalLockedAtCost)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      @{formatCurrency(item.costPrice)}/unit
                    </span>
                  </TableCell>

                  {/* Action Column */}
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDispenseToPos(item)}
                        className="h-7 gap-1 px-2 text-xs border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground font-medium transition-all shadow-xs"
                        title="Stage for clearance sale on POS counter"
                      >
                        <ShoppingCart className="h-3 w-3" />
                        <span className="hidden sm:inline">Clearance</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/purchases/returns/new')}
                        className="h-7 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                        title="Return to supplying vendor"
                      >
                        <Undo2 className="h-3 w-3" />
                        <span className="hidden lg:inline">Return</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
