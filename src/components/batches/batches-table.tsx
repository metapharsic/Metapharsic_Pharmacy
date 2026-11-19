'use client'

import { formatRack, formatShelf } from '@/lib/utils/rack'

// ─────────────────────────────────────────────────────────────
// Component — BatchesTable
// High-standard batch matrix: Rack > Shelf > Box coordinates,
// Chemist FEFO & Dead Stock Radar, Vendor Attribution, and Actions
// ─────────────────────────────────────────────────────────────
import type { ColumnDef } from '@tanstack/react-table'
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  Layers,
  MapPin,
  Plus,
  RotateCcw,
  ShieldAlert,
  Truck,
} from 'lucide-react'
import Link from 'next/link'

import { DataTable } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants/routes'
import { formatCurrency } from '@/lib/utils/currency'
import { daysUntilExpiry, formatDate } from '@/lib/utils/date'
import { STATUS_META } from '@/lib/validations/batch'

export { STATUS_META }

// ─── Types ───────────────────────────────────────────────────

export type BatchStatusRow = 'ACTIVE' | 'BLOCKED' | 'EXPIRED' | 'DISPOSED' | 'EXHAUSTED'

export interface BatchRow {
  id: string
  batchNumber: string
  expiryDate: string
  manufacturingDate: string | null
  status: BatchStatusRow
  quantity: number
  availableQuantity: number
  purchasePrice: string
  mrp: string
  product: {
    id: string
    name: string
    sku: string
    rack?: string | null
    shelf?: string | null
    box?: string | null
    unitOfMeasure?: string | null
  }
  supplierName?: string
  supplierId?: string | null
  rack?: string | null
  shelf?: string | null
  box?: string | null
  daysUntilExpiry?: number
  fefoTier?: 'CRITICAL' | 'WARNING' | 'INFO' | 'HEALTHY' | 'EXPIRED'
  isDeadStock?: boolean
  valuationAtCost?: number
  valuationAtMrp?: number
}

interface BatchesTableProps {
  rows: BatchRow[]
  isLoading?: boolean
  onRelocate?: (batch: BatchRow) => void
  onVendorReturn?: (batch: BatchRow) => void
  onBlock?: (batch: BatchRow) => void
}

// ─── Columns ─────────────────────────────────────────────────

export function getBatchColumns({
  onRelocate,
  onVendorReturn,
  onBlock,
}: {
  onRelocate?: (batch: BatchRow) => void
  onVendorReturn?: (batch: BatchRow) => void
  onBlock?: (batch: BatchRow) => void
}): ColumnDef<BatchRow>[] {
  return [
    {
      accessorKey: 'batchNumber',
      header: 'Batch & Status',
      cell: ({ row }) => {
        const meta = STATUS_META[row.original.status] ?? {
          label: row.original.status,
          variant: 'secondary',
        }
        return (
          <div className="space-y-1 min-w-[120px]">
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground">
              <span>{row.original.batchNumber}</span>
            </div>
            <Badge variant={meta.variant} className="text-[10px] px-1.5 py-0 h-4 font-normal">
              {meta.label}
            </Badge>
          </div>
        )
      },
    },
    {
      accessorKey: 'product.name',
      header: 'Medicine / SKU',
      cell: ({ row }) => (
        <div className="space-y-0.5 min-w-[170px]">
          <p className="font-semibold text-xs text-foreground truncate max-w-[200px]" title={row.original.product.name}>
            {row.original.product.name}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
            <span>{row.original.product.sku}</span>
            {row.original.product.unitOfMeasure && (
              <>
                <span>·</span>
                <span className="text-primary">{row.original.product.unitOfMeasure}</span>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'location',
      header: 'Physical Storage (Rack > Box)',
      cell: ({ row }) => {
        const rack = formatRack(row.original.rack || row.original.product?.rack)
        const shelf = formatShelf(row.original.shelf || row.original.product?.shelf)
        const rawBox = row.original.box || row.original.product?.box
        const box = typeof rawBox === 'object' ? '' : rawBox

        if (!rack && !box) {
          return (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] gap-1 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
              onClick={() => onRelocate?.(row.original)}
            >
              <Plus className="h-3 w-3" />
              Assign Box
            </Button>
          )
        }

        return (
          <div
            className="space-y-0.5 min-w-[130px] cursor-pointer group"
            onClick={() => onRelocate?.(row.original)}
            title="Click to relocate storage"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{rack || 'No Rack'}</span>
              <span className="text-muted-foreground">›</span>
              <span className="text-primary font-bold">{box || shelf || 'Shelf'}</span>
            </div>
            {shelf && box && (
              <p className="text-[10px] text-muted-foreground pl-5 font-mono">
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
        const supplierName = row.original.supplierName || 'Direct Wholesaler'
        return (
          <div className="space-y-0.5 min-w-[130px]">
            <div className="flex items-center gap-1.5 text-xs text-foreground font-medium truncate max-w-[160px]" title={supplierName}>
              <Truck className="h-3.5 w-3.5 text-sky-500 shrink-0" />
              <span className="truncate">{supplierName}</span>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'expiryDate',
      header: 'Chemist Radar (FEFO & Expiry)',
      cell: ({ row }) => {
        const days = row.original.daysUntilExpiry ?? daysUntilExpiry(row.original.expiryDate)
        const isDead = Boolean(row.original.isDeadStock)

        return (
          <div className="space-y-1 min-w-[160px]">
            <div className="flex items-center gap-1.5 text-xs font-mono font-medium">
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>{formatDate(row.original.expiryDate)}</span>
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              {days < 0 || row.original.status === 'EXPIRED' ? (
                <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                  <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                  Expired ({Math.abs(days)}d)
                </Badge>
              ) : days <= 30 ? (
                <Badge variant="destructive" className="text-[10px] h-4 px-1.5 animate-pulse bg-rose-600">
                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                  Critical ({days}d)
                </Badge>
              ) : days <= 60 ? (
                <Badge variant="warning" className="text-[10px] h-4 px-1.5 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20">
                  Warning ({days}d)
                </Badge>
              ) : days <= 90 ? (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/20">
                  Info ({days}d)
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                  Safe ({days}d)
                </Badge>
              )}

              {isDead && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-purple-600 bg-purple-500/10 border-purple-500/20">
                  Dead Stock
                </Badge>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'quantity',
      header: 'Stock & Avail',
      cell: ({ row }) => {
        const avail = row.original.availableQuantity
        const total = row.original.quantity
        return (
          <div className="space-y-0.5 min-w-[80px]">
            <div className="flex items-center gap-1">
              <span className={`text-xs font-bold font-mono ${avail === 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {avail}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">/ {total}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {avail === 0 ? 'Out of Stock' : 'Units Avail'}
            </p>
          </div>
        )
      },
    },
    {
      accessorKey: 'mrp',
      header: 'Valuation & MRP',
      cell: ({ row }) => {
        const valCost = row.original.valuationAtCost ?? (Number(row.original.purchasePrice || 0) * row.original.availableQuantity)
        return (
          <div className="space-y-0.5 min-w-[100px]">
            <span className="text-xs font-bold font-mono text-foreground">
              ₹{valCost.toFixed(2)}
            </span>
            <p className="text-[10px] text-muted-foreground font-mono">
              MRP: {formatCurrency(row.original.mrp)}
            </p>
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: 'Chemist Actions',
      cell: ({ row }) => {
        const b = row.original
        const canReturn = b.availableQuantity > 0
        const isBlocked = b.status === 'BLOCKED'

        return (
          <div className="flex items-center gap-1">
            {onRelocate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary"
                title="Relocate medicine storage (Rack > Shelf > Box)"
                onClick={() => onRelocate(b)}
              >
                <Layers className="h-3.5 w-3.5" />
              </Button>
            )}

            {onVendorReturn && canReturn && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-sky-600"
                title="Supplier Return (RTV)"
                onClick={() => onVendorReturn(b)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}

            {onBlock && b.status === 'ACTIVE' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                title="Quarantine / Block batch"
                onClick={() => onBlock(b)}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
              </Button>
            )}

            <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <Link href={ROUTES.BATCH(b.id)}>View</Link>
            </Button>
          </div>
        )
      },
    },
  ]
}

// ─── Component ───────────────────────────────────────────────

export function BatchesTable({
  rows,
  isLoading,
  onRelocate,
  onVendorReturn,
  onBlock,
}: BatchesTableProps) {
  const columns = getBatchColumns({ onRelocate, onVendorReturn, onBlock })

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      emptyMessage="No batches found matching the selected criteria."
    />
  )
}
