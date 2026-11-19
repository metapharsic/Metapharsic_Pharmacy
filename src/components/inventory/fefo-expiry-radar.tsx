'use client'

import { formatRack } from '@/lib/utils/rack'

import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { playBarcodeBeep } from '@/lib/scanner/barcode-sound'
import { addPosCartItem, type PosCartLine } from '@/lib/stores/pos-cart-store'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'

export interface FefoBatchRow {
  id: string
  batchNumber: string
  expiryDate: string
  manufacturingDate?: string | null
  purchasePrice: number | string
  mrp: number | string
  quantity: number
  reservedQuantity: number
  soldQuantity: number
  availableQuantity: number
  status: 'ACTIVE' | 'BLOCKED' | 'EXPIRED' | 'DISPOSED' | 'EXHAUSTED'
  product: {
    id: string
    name: string
    sku: string
    unitOfMeasure: string
    rack?: string | null
    barcode?: string | null
  }
}

interface FefoExpiryRadarProps {
  branchId: string
  onAdjustProduct?: (productId: string, productName: string) => void
}

export function FefoExpiryRadar({ branchId, onAdjustProduct }: FefoExpiryRadarProps) {
  const toast = useToast()
  const router = useRouter()

  const [batches, setBatches] = useState<FefoBatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [windowFilter, setWindowFilter] = useState<'all' | 'expired' | 'critical' | 'near_90' | 'healthy'>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const loadBatches = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
        sortBy: 'expiryDate',
        sortOrder: 'asc',
      })
      if (branchId && branchId !== 'all') {
        params.set('branchId', branchId)
      }
      if (debouncedSearch) {
        params.set('search', debouncedSearch)
      }

      const res = await fetch(`/api/batches?${params.toString()}`)
      const json = await res.json()

      if (json.success && Array.isArray(json.data)) {
        setBatches(json.data)
        setTotalPages(json.pagination?.pages || 1)
        setTotalCount(json.pagination?.total || 0)
      } else {
        toast.error('Failed to load FEFO batches')
      }
    } catch {
      toast.error('Network error loading batches')
    } finally {
      setLoading(false)
    }
  }, [branchId, debouncedSearch, page, toast])

  useEffect(() => {
    void loadBatches()
  }, [loadBatches])

  // Filter batches in client by expiry urgency window
  const filteredBatches = batches.filter((b) => {
    const expDate = new Date(b.expiryDate)
    const now = new Date()
    const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (windowFilter === 'expired') return diffDays < 0
    if (windowFilter === 'critical') return diffDays >= 0 && diffDays <= 30
    if (windowFilter === 'near_90') return diffDays >= 0 && diffDays <= 90
    if (windowFilter === 'healthy') return diffDays > 90
    return true
  })

  // 1-Click Dispense to POS
  const handleDispenseToPos = (b: FefoBatchRow) => {
    const mrp = Number(b.mrp) || 0
    const cartItem: PosCartLine = {
      productId: b.product.id,
      sku: b.product.sku,
      barcode: b.product.barcode ?? null,
      name: b.product.name,
      genericName: null,
      unitOfMeasure: b.product.unitOfMeasure || 'Strip',
      mrp,
      gstRate: 12,
      cgstRate: 6,
      sgstRate: 6,
      igstRate: 0,
      hsnCode: '3004',
      drugSchedule: 'SCHEDULE_H',
      isPrescriptionRequired: false,
      isGstExempt: false,
      quantity: 1,
      discountPercent: 0,
      availableQuantity: b.availableQuantity,
      batchId: b.id,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
    }

    addPosCartItem(cartItem)
    playBarcodeBeep()
    toast.success(`Dispensed to POS: ${b.product.name}`, `Batch #${b.batchNumber} (MRP ₹${mrp})`)
  }

  const getExpiryDisplay = (expiryStr: string) => {
    const expDate = new Date(expiryStr)
    const now = new Date()
    const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return (
        <div className="space-y-0.5">
          <Badge variant="destructive" className="gap-1 font-mono text-[10px] bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30">
            <XCircle className="h-3 w-3" />
            <span>EXPIRED ({Math.abs(diffDays)}d ago)</span>
          </Badge>
          <p className="text-[10px] text-muted-foreground">{formatDate(expDate)}</p>
        </div>
      )
    }
    if (diffDays <= 30) {
      return (
        <div className="space-y-0.5">
          <Badge variant="destructive" className="gap-1 font-mono text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse">
            <AlertTriangle className="h-3 w-3" />
            <span>CRITICAL ({diffDays}d left)</span>
          </Badge>
          <p className="text-[10px] text-muted-foreground">{formatDate(expDate)}</p>
        </div>
      )
    }
    if (diffDays <= 90) {
      return (
        <div className="space-y-0.5">
          <Badge variant="warning" className="gap-1 font-mono text-[10px] bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
            <Clock className="h-3 w-3" />
            <span>NEAR EXPIRY ({diffDays}d left)</span>
          </Badge>
          <p className="text-[10px] text-muted-foreground">{formatDate(expDate)}</p>
        </div>
      )
    }
    return (
      <div className="space-y-0.5">
        <Badge variant="success" className="gap-1 font-mono text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
          <CheckCircle2 className="h-3 w-3" />
          <span>HEALTHY</span>
        </Badge>
        <p className="text-[10px] text-muted-foreground">{formatDate(expDate)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* FEFO Radar Header & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-gradient-to-r from-card to-background p-4 shadow-xs">
        <div className="space-y-1">
          <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-rose-500" />
            FEFO Expiry Tracking Radar
          </h2>
          <p className="text-xs text-muted-foreground">
            First-Expiry, First-Out matrix ensuring strict pharmacy compliance and zero wastage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by medicine, batch, SKU…"
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Select value={windowFilter} onValueChange={(v: any) => setWindowFilter(v)}>
            <SelectTrigger className="w-36 h-8 text-xs font-medium">
              <SelectValue placeholder="Expiry Window" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Windows</SelectItem>
              <SelectItem value="critical" className="text-xs text-amber-600 font-medium">Critical (&le;30d)</SelectItem>
              <SelectItem value="near_90" className="text-xs text-yellow-600 font-medium">Near Expiry (&le;90d)</SelectItem>
              <SelectItem value="expired" className="text-xs text-red-600 font-medium">Expired Batches</SelectItem>
              <SelectItem value="healthy" className="text-xs text-emerald-600 font-medium">Healthy (&gt;90d)</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadBatches()}
            disabled={loading}
            className="h-8 gap-1 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* FEFO Batches Table */}
      <div className="rounded-xl border border-border/70 bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 text-xs">
              <TableHead className="font-semibold">Medicine & SKU</TableHead>
              <TableHead className="font-semibold">Batch Number</TableHead>
              <TableHead className="font-semibold">Expiry & Compliance</TableHead>
              <TableHead className="font-semibold text-right">MRP / Unit</TableHead>
              <TableHead className="font-semibold text-right">Cost Price</TableHead>
              <TableHead className="font-semibold text-center">Available Stock</TableHead>
              <TableHead className="font-semibold text-right pr-4">Quick Dispense</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-7 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filteredBatches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-xs text-muted-foreground">
                  <div className="flex flex-col items-center justify-center space-y-1.5">
                    <Clock className="h-7 w-7 text-muted-foreground/50" />
                    <span>No batches found matching the selected expiry window.</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredBatches.map((b) => {
                const isOut = b.availableQuantity <= 0
                return (
                  <TableRow key={b.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="space-y-0.5">
                        <span className="font-medium text-xs text-foreground block">
                          {b.product.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="font-mono">{b.product.sku}</span>
                          {b.product.rack && (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              · Rack {formatRack(b.product.rack)}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-xs font-bold bg-muted/60 px-2 py-0.5 rounded border border-border/60">
                        {b.batchNumber}
                      </span>
                    </TableCell>

                    <TableCell>
                      {getExpiryDisplay(b.expiryDate)}
                    </TableCell>

                    <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                      {formatCurrency(Number(b.mrp) || 0)}
                    </TableCell>

                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatCurrency(Number(b.purchasePrice) || 0)}
                    </TableCell>

                    <TableCell className="text-center font-mono">
                      <span
                        className={`font-bold text-xs ${
                          isOut
                            ? 'text-destructive'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {b.availableQuantity} units
                      </span>
                      {b.reservedQuantity > 0 && (
                        <span className="block text-[10px] text-muted-foreground">
                          ({b.reservedQuantity} reserved)
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {onAdjustProduct && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onAdjustProduct(b.product.id, b.product.name)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="Adjust Stock"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isOut}
                          onClick={() => handleDispenseToPos(b)}
                          className="h-7 gap-1 px-2 text-xs border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground font-medium transition-all shadow-xs"
                          title={isOut ? 'Batch is out of stock' : 'Add 1 unit to POS cart'}
                        >
                          <Plus className="h-3 w-3" />
                          <ShoppingCart className="h-3 w-3" />
                          <span>Dispense</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination Toolbar */}
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground bg-muted/20">
          <span>
            Showing {filteredBatches.length} of {totalCount} total batches
          </span>

          <div className="flex items-center gap-2">
            <span>Page {page} of {Math.max(totalPages, 1)}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-7 px-2 text-xs"
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="h-7 px-2 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
