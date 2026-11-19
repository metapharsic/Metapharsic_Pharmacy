'use client'

import { AlertTriangle, Calendar, CheckCircle2, Clock, DollarSign, Package, Plus, ShoppingCart, SlidersHorizontal, Truck, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'

export interface BatchItem {
  id: string
  productId: string
  batchNumber: string
  expiryDate: string
  manufacturingDate?: string | null
  purchasePrice: number | string
  mrp: number | string
  quantity: number
  reservedQuantity: number
  availableQuantity: number
  status: 'ACTIVE' | 'BLOCKED' | 'EXPIRED' | 'DISPOSED' | 'EXHAUSTED'
  supplier?: { id: string; name: string } | null
}

interface ProductBatchDrawerProps {
  productId: string
  productName: string
  branchId: string
  onQuickAddToPos?: (batch: BatchItem) => void
  onAdjustBatch?: (batch: BatchItem) => void
}

export function ProductBatchDrawer({
  productId,
  productName,
  branchId,
  onQuickAddToPos,
  onAdjustBatch,
}: ProductBatchDrawerProps) {
  const [batches, setBatches] = useState<BatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      productId,
      limit: '50',
      sortBy: 'expiryDate',
      sortOrder: 'asc',
    })
    if (branchId && branchId !== 'all') {
      params.set('branchId', branchId)
    }

    fetch(`/api/batches?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (!isMounted) return
        if (json.success && Array.isArray(json.data)) {
          setBatches(json.data)
        } else {
          setError(json.error?.message || 'Unable to load batches')
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : 'Network error')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [productId, branchId])

  const getExpiryBadge = (expiryStr: string) => {
    const expDate = new Date(expiryStr)
    const now = new Date()
    const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return (
        <Badge variant="destructive" className="gap-1 font-mono text-[10px] bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30">
          <XCircle className="h-3 w-3" />
          <span>Expired ({Math.abs(diffDays)}d ago)</span>
        </Badge>
      )
    }
    if (diffDays <= 30) {
      return (
        <Badge variant="destructive" className="gap-1 font-mono text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse">
          <AlertTriangle className="h-3 w-3" />
          <span>Critical ({diffDays}d left)</span>
        </Badge>
      )
    }
    if (diffDays <= 90) {
      return (
        <Badge variant="warning" className="gap-1 font-mono text-[10px] bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
          <Clock className="h-3 w-3" />
          <span>Near Expiry ({diffDays}d)</span>
        </Badge>
      )
    }
    return (
      <Badge variant="success" className="gap-1 font-mono text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
        <CheckCircle2 className="h-3 w-3" />
        <span>Valid ({formatDate(expDate)})</span>
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive flex items-center justify-between">
        <span>Failed to load batches: {error}</span>
        <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="h-6 text-[11px]">
          Retry
        </Button>
      </div>
    )
  }

  if (batches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-center">
        <Package className="h-6 w-6 text-muted-foreground/60 mx-auto mb-1.5" />
        <p className="text-xs font-medium text-foreground">No physical batches registered</p>
        <p className="text-[11px] text-muted-foreground">
          Stock is tracked at product-level or active batches are depleted.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/70 bg-gradient-to-b from-card to-background p-4 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs tracking-tight text-foreground flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-primary" />
            FEFO Batch Inventory ({batches.length} {batches.length === 1 ? 'batch' : 'batches'})
          </span>
          <span className="text-[11px] text-muted-foreground">
            Earliest-expiring batches dispensed first
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {batches.map((batch) => {
          const isOut = batch.availableQuantity <= 0
          return (
            <div
              key={batch.id}
              className={`group relative rounded-lg border p-3 transition-all hover:shadow-md ${
                isOut
                  ? 'border-border/40 bg-muted/20 opacity-75'
                  : 'border-border/80 bg-card hover:border-primary/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-foreground">
                      #{batch.batchNumber}
                    </span>
                    {batch.supplier?.name && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded font-medium">
                        <Truck className="h-2.5 w-2.5 text-sky-500" />
                        <span className="truncate max-w-[100px]">{batch.supplier.name}</span>
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5">{getExpiryBadge(batch.expiryDate)}</div>
                </div>

                <div className="text-right">
                  <div className="font-semibold text-xs text-foreground">
                    MRP {formatCurrency(Number(batch.mrp) || 0)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Cost: {formatCurrency(Number(batch.purchasePrice) || 0)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Available:</span>
                  <span
                    className={`font-mono font-bold ${
                      isOut
                        ? 'text-destructive'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {batch.availableQuantity} units
                  </span>
                  {batch.reservedQuantity > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      ({batch.reservedQuantity} rsvd)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {onAdjustBatch && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAdjustBatch(batch)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      title="Adjust Stock"
                    >
                      <SlidersHorizontal className="h-3 w-3" />
                    </Button>
                  )}

                  {onQuickAddToPos && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isOut}
                      onClick={() => onQuickAddToPos(batch)}
                      className="h-6 gap-1 px-1.5 text-[10px] border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground font-medium"
                      title="Dispense this batch to POS"
                    >
                      <Plus className="h-2.5 w-2.5" />
                      <ShoppingCart className="h-2.5 w-2.5" />
                      <span>Dispense</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
