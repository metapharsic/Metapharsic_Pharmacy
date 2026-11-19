'use client'

import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Clock,
  Coins,
  DollarSign,
  PackageCheck,
  PackageX,
  Percent,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { InventorySummary } from '@/lib/inventory/inventory-service'
import { formatCurrency } from '@/lib/utils/currency'

interface InventoryKpiCardsProps {
  summary: InventorySummary | null
  loading?: boolean
  selectedFilter?: string
  onFilterClick?: (status: string) => void
  onTabChange?: (tab: string) => void
  onRefresh?: () => void
}

export function InventoryKpiCards({
  summary,
  loading,
  selectedFilter,
  onFilterClick,
  onTabChange,
  onRefresh,
}: InventoryKpiCardsProps) {
  if (loading && !summary) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
    )
  }

  const s = summary ?? {
    totalSkus: 0,
    totalUnits: 0,
    reservedUnits: 0,
    availableUnits: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    valuationAtCost: 0,
    valuationAtMrp: 0,
    potentialGrossProfit: 0,
    marginPercent: 0,
    nearExpiryBatchesCount: 0,
    expiredBatchesCount: 0,
    pendingAdjustmentsCount: 0,
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Stock Valuation & Potential Revenue */}
      <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-background p-3.5 shadow-xs transition-all hover:shadow-md hover:border-primary/40">
        <div className="flex items-center justify-between text-muted-foreground mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Coins className="h-3.5 w-3.5" />
            Stock Valuation
          </span>
          <Badge variant="outline" className="text-[10px] bg-background/80 font-mono">
            {s.marginPercent.toFixed(1)}% margin
          </Badge>
        </div>

        <div className="space-y-1">
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-mono">
            {formatCurrency(s.valuationAtMrp)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-1.5">
            <span>Cost: {formatCurrency(s.valuationAtCost)}</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center">
              +₹{Math.round(s.potentialGrossProfit).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Total Units & SKUs */}
      <div
        onClick={() => onFilterClick?.('all')}
        className={`cursor-pointer relative overflow-hidden rounded-xl border p-3.5 shadow-xs transition-all hover:shadow-md ${
          selectedFilter === 'all'
            ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/30'
            : 'border-sky-500/25 bg-gradient-to-br from-sky-500/10 via-card to-background hover:border-sky-500/40'
        }`}
      >
        <div className="flex items-center justify-between text-muted-foreground mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
            <Boxes className="h-3.5 w-3.5" />
            Total On-Hand Stock
          </span>
          <Badge variant="outline" className="text-[10px] bg-background/80 font-mono text-sky-600 dark:text-sky-400">
            {s.totalSkus} SKUs
          </Badge>
        </div>

        <div className="space-y-1">
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-mono">
            {s.availableUnits.toLocaleString('en-IN')}{' '}
            <span className="text-xs font-normal text-muted-foreground">units available</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-1.5">
            <span>Total Units: {s.totalUnits.toLocaleString('en-IN')}</span>
            {s.reservedUnits > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {s.reservedUnits} reserved in carts
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">0 locked</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Low Stock & Out of Stock Radar */}
      <div
        onClick={() => onFilterClick?.(s.lowStockCount > 0 ? 'low_stock' : 'out_of_stock')}
        className={`cursor-pointer relative overflow-hidden rounded-xl border p-3.5 shadow-xs transition-all hover:shadow-md ${
          selectedFilter === 'low_stock' || selectedFilter === 'out_of_stock'
            ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30'
            : 'border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-card to-background hover:border-amber-500/40'
        }`}
      >
        <div className="flex items-center justify-between text-muted-foreground mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Reorder Alert Radar
          </span>
          {s.outOfStockCount > 0 && (
            <Badge variant="destructive" className="text-[10px] font-mono">
              {s.outOfStockCount} Out of Stock
            </Badge>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 font-mono">
              {s.lowStockCount}
            </span>
            <span className="text-xs text-muted-foreground">medicines below reorder point</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-1.5">
            <span>Filter Low Stock</span>
            <span className="text-primary font-medium flex items-center gap-0.5 text-[10px]">
              Click to view <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>

      {/* 4. FEFO Expiry Radar */}
      <div
        onClick={() => onTabChange?.('fefo')}
        className="cursor-pointer relative overflow-hidden rounded-xl border border-rose-500/25 bg-gradient-to-br from-rose-500/10 via-card to-background p-3.5 shadow-xs transition-all hover:shadow-md hover:border-rose-500/40"
      >
        <div className="flex items-center justify-between text-muted-foreground mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            FEFO Expiry Radar
          </span>
          {s.expiredBatchesCount > 0 && (
            <Badge variant="destructive" className="text-[10px] font-mono animate-pulse">
              {s.expiredBatchesCount} Expired
            </Badge>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 font-mono">
              {s.nearExpiryBatchesCount}
            </span>
            <span className="text-xs text-muted-foreground">batches expiring &lt;90 days</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-1.5">
            <span>FEFO Batch Radar</span>
            <span className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-0.5 text-[10px]">
              Open Radar <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
