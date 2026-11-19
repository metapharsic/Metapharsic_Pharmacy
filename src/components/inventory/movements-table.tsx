'use client'

import { formatRack, formatShelf } from '@/lib/utils/rack'

// ─────────────────────────────────────────────────────────────
// Component — MovementsTable
// Shows the stock movement history with Rack > Shelf > Box coordinates,
// Vendor/Supplier identification, FEFO near-expiry radar, dead stock flags,
// and valuation impacts for pharmacy chemists.
// ─────────────────────────────────────────────────────────────
import type { ColumnDef } from '@tanstack/react-table'
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  ExternalLink,
  Layers,
  MapPin,
  RotateCcw,
  TrendingDown,
  Truck,
} from 'lucide-react'

import { DataTable } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils/date'

// ─── Types ───────────────────────────────────────────────────

export type MovementType =
  'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN_IN' | 'RETURN_OUT' | 'TRANSFER' | 'WRITE_OFF'

export interface MovementRow {
  id: string
  type: MovementType
  quantity: number
  quantityBefore: number
  quantityAfter: number
  referenceType: string | null
  referenceId: string | null
  batchId?: string | null
  notes: string | null
  createdAt: string
  inventory: {
    productId: string
    product: {
      id: string
      name: string
      sku: string
      unitOfMeasure: string
      rack?: string | null
      shelf?: string | null
      box?: string | null
      costPrice?: number | null
      mrp?: number | null
    }
    branch: { id: string; name: string; code: string | null }
  }
  batch?: {
    id: string
    batchNumber: string
    expiryDate: string
    mrp?: number | null
    purchasePrice?: number | null
    supplierId?: string | null
    supplier?: { id: string; name: string } | null
  } | null
  unitCost?: number
  unitMrp?: number
  costValuation?: number
  mrpValuation?: number
  isNearExpiry?: boolean
  isExpired?: boolean
  daysToExpiry?: number | null
  isDeadStock?: boolean
  supplierName?: string
  supplierId?: string | null
  rack?: string | null
  shelf?: string | null
  box?: string | null
}

interface MovementsTableProps {
  rows: MovementRow[]
  isLoading?: boolean
  onRelocate?: (row: MovementRow) => void
  onVendorReturn?: (row: MovementRow) => void
}

// ─── Type metadata ────────────────────────────────────────────

const TYPE_META: Record<
  MovementType,
  { label: string; variant: 'default' | 'info' | 'warning' | 'secondary' | 'destructive' }
> = {
  IN: { label: 'Stock In', variant: 'default' },
  OUT: { label: 'Stock Out', variant: 'destructive' },
  ADJUSTMENT: { label: 'Adjustment', variant: 'warning' },
  RETURN_IN: { label: 'Customer Return', variant: 'info' },
  RETURN_OUT: { label: 'Supplier Return', variant: 'secondary' },
  TRANSFER: { label: 'Transfer / Relocate', variant: 'secondary' },
  WRITE_OFF: { label: 'Write-off', variant: 'destructive' },
}

export function MovementsTable({
  rows,
  isLoading,
  onRelocate,
  onVendorReturn,
}: MovementsTableProps) {
  const columns: ColumnDef<MovementRow>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Date & Ref',
      cell: ({ row }) => (
        <div className="space-y-0.5 min-w-[120px]">
          <p className="font-mono text-xs font-medium text-foreground">
            {formatDateTime(row.original.createdAt)}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-semibold text-primary/80">
              {row.original.referenceType ?? 'MANUAL'}
            </span>
            {row.original.referenceId && (
              <span className="font-mono text-[10px] text-muted-foreground">
                #{row.original.referenceId.slice(-6)}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'inventory.product.name',
      header: 'Medicine & Batch',
      cell: ({ row }) => {
        const prod = row.original.inventory.product
        const batch = row.original.batch
        return (
          <div className="space-y-1 max-w-[240px]">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-xs text-foreground truncate">{prod.name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
              <span className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">
                {prod.sku}
              </span>
              {batch && (
                <Badge variant="outline" className="text-[10px] font-mono h-4 px-1 border-primary/30 text-primary">
                  Lot: {batch.batchNumber}
                </Badge>
              )}
            </div>
          </div>
        )
      },
    },
    {
      id: 'physicalLocation',
      header: 'Rack & Box Location',
      cell: ({ row }) => {
        const prod = row.original.inventory.product
        const rack = formatRack(row.original.rack || prod.rack)
        const shelf = formatShelf(row.original.shelf || prod.shelf)
        const rawBox = row.original.box || prod.box
        const box = typeof rawBox === 'object' ? '' : rawBox
        const isRelocation = row.original.referenceType === 'BOX_RELOCATION' || row.original.notes?.includes('Relocated:')

        if (isRelocation && row.original.notes?.includes('➔')) {
          // Extract transfer coordinates if available in notes
          const noteMatch = row.original.notes.match(/Relocated:\s*\[(.*?)\]\s*➔\s*\[(.*?)\]/)
          if (noteMatch) {
            return (
              <div className="space-y-1 min-w-[160px]">
                <div className="flex items-center gap-1 text-[11px] font-mono">
                  <span className="text-muted-foreground truncate max-w-[70px]">{noteMatch[1]}</span>
                  <ArrowRight className="h-3 w-3 text-sky-500 shrink-0" />
                  <span className="font-bold text-sky-600 dark:text-sky-400 truncate max-w-[70px]">{noteMatch[2]}</span>
                </div>
                <Badge variant="secondary" className="text-[9px] bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/20">
                  Box Relocated
                </Badge>
              </div>
            )
          }
        }

        if (!rack && !shelf && !box) {
          return (
            <Badge variant="outline" className="text-[10px] text-muted-foreground border-dashed">
              Unassigned Storage
            </Badge>
          )
        }

        return (
          <div className="space-y-0.5 min-w-[140px]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{rack || 'No Rack'}</span>
              <span className="text-muted-foreground">›</span>
              <span className="text-primary font-bold">{box || shelf || 'Shelf'}</span>
            </div>
            {shelf && box && (
              <p className="text-[10px] text-muted-foreground pl-5">
                {shelf} · {box}
              </p>
            )}
          </div>
        )
      },
    },
    {
      id: 'vendor',
      header: 'Vendor / Supplier',
      cell: ({ row }) => {
        const supplierName = row.original.supplierName || row.original.batch?.supplier?.name || 'Direct Wholesaler'
        return (
          <div className="space-y-0.5 min-w-[140px]">
            <div className="flex items-center gap-1.5 text-xs text-foreground font-medium truncate max-w-[150px]">
              <Truck className="h-3.5 w-3.5 text-sky-500 shrink-0" />
              <span className="truncate" title={supplierName}>{supplierName}</span>
            </div>
            <p className="text-[10px] text-muted-foreground pl-5 font-mono">
              {row.original.inventory.branch.name}
            </p>
          </div>
        )
      },
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const meta = TYPE_META[row.original.type] ?? {
          label: row.original.type,
          variant: 'secondary',
        }
        return <Badge variant={meta.variant}>{meta.label}</Badge>
      },
    },
    {
      id: 'fefoDeadStock',
      header: 'Chemist Radar',
      cell: ({ row }) => {
        const { isNearExpiry, isExpired, daysToExpiry, isDeadStock } = row.original
        const hasBadges = isNearExpiry || isExpired || isDeadStock

        if (!hasBadges) {
          return (
            <Badge variant="outline" className="text-[10px] text-emerald-600 bg-emerald-500/10 border-emerald-500/20 font-medium">
              Healthy Stock
            </Badge>
          )
        }

        return (
          <div className="flex flex-col gap-1 min-w-[110px]">
            {isExpired && (
              <Badge variant="destructive" className="gap-1 text-[10px] h-4 font-semibold">
                <AlertTriangle className="h-2.5 w-2.5" />
                <span>EXPIRED</span>
              </Badge>
            )}
            {!isExpired && isNearExpiry && (
              <Badge variant="warning" className="gap-1 text-[10px] h-4 font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
                <Clock className="h-2.5 w-2.5" />
                <span>{daysToExpiry ? `${daysToExpiry}d Expiry` : 'Near Expiry'}</span>
              </Badge>
            )}
            {isDeadStock && (
              <Badge variant="outline" className="gap-1 text-[10px] h-4 font-semibold bg-rose-500/10 text-rose-600 border-rose-500/30">
                <TrendingDown className="h-2.5 w-2.5" />
                <span>Dead Stock</span>
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'quantity',
      header: 'Qty & Delta',
      cell: ({ row }) => {
        const qty = row.original.quantity
        const isNegative = qty < 0
        return (
          <div className="space-y-0.5">
            <span className={`text-sm font-bold font-mono ${isNegative ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {qty > 0 ? `+${qty}` : qty}
            </span>
            <p className="text-[10px] font-mono text-muted-foreground">
              {row.original.quantityBefore} → {row.original.quantityAfter}
            </p>
          </div>
        )
      },
    },
    {
      id: 'valuation',
      header: 'Cost Valuation',
      cell: ({ row }) => {
        const cost = row.original.costValuation ?? 0
        const isNegative = row.original.quantity < 0
        return (
          <div className="space-y-0.5">
            <span className={`text-xs font-bold font-mono ${isNegative ? 'text-foreground' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {isNegative ? '-' : '+'}₹{cost.toFixed(2)}
            </span>
            {row.original.mrpValuation ? (
              <p className="text-[10px] text-muted-foreground font-mono">
                MRP: ₹{row.original.mrpValuation.toFixed(2)}
              </p>
            ) : null}
          </div>
        )
      },
    },
    {
      accessorKey: 'notes',
      header: 'Notes & Actions',
      cell: ({ row }) => {
        const notes = row.original.notes
        return (
          <div className="space-y-1.5 min-w-[130px]">
            {notes ? (
              <p className="text-[11px] text-muted-foreground line-clamp-1" title={notes}>
                {notes}
              </p>
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            )}

            <div className="flex items-center gap-1">
              {onRelocate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-primary"
                  title="Relocate medicine to another Rack / Shelf / Box"
                  onClick={() => onRelocate(row.original)}
                >
                  <Layers className="h-3.5 w-3.5" />
                </Button>
              )}
              {onVendorReturn && row.original.batchId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-sky-600"
                  title="Process Supplier Return for this batch"
                  onClick={() => onVendorReturn(row.original)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      emptyMessage="No stock movements found."
    />
  )
}

