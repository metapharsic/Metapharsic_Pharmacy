'use client'

import { formatRack, formatShelf } from '@/lib/utils/rack'

// ─────────────────────────────────────────────────────────────
// Component — AdjustmentsTable
// Lists stock adjustments with physical storage coordinates (Rack/Shelf/Box),
// batch expiry alerts, vendor information, financial valuation impact,
// and supervisor approval workflow actions.
// ─────────────────────────────────────────────────────────────
import type { ColumnDef } from '@tanstack/react-table'
import {
  AlertTriangle,
  Building2,
  Check,
  Clock,
  Layers,
  Package,
  Pencil,
  PlusCircle,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'

import { DataTable } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils/date'

// ─── Types ───────────────────────────────────────────────────

export type AdjustmentType =
  | 'PHYSICAL_COUNT'
  | 'DAMAGE'
  | 'THEFT'
  | 'EXPIRY'
  | 'CORRECTION'
  | 'OPENING_STOCK'

export type AdjustmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface AdjustmentRow {
  id: string
  branchId: string
  productId: string
  batchId?: string | null
  adjustmentType: AdjustmentType
  quantity: number
  reason: string
  notes?: string | null
  status: AdjustmentStatus
  approvedAt: string | null
  createdAt: string
  product: {
    id: string
    name: string
    sku: string
    rack?: string | null
    shelf?: string | null
    box?: string | null
    mrp?: number | null
    costPrice?: number | null
  }
  branch: { id: string; name: string; code: string | null }
  createdBy: { id: string; name: string }
  batch?: {
    id: string
    batchNumber: string
    expiryDate: string | Date
    purchasePrice?: number
    mrp?: number
    quantity?: number
    supplier?: { id: string; name: string } | null
  } | null
  costImpact?: number
  mrpImpact?: number
  isNearExpiry?: boolean
  isDeadStock?: boolean
}

interface AdjustmentsTableProps {
  rows: AdjustmentRow[]
  isLoading?: boolean
  canApprove?: boolean
  canAdjust?: boolean
  onApprove?: (row: AdjustmentRow) => void
  onReject?: (row: AdjustmentRow) => void
  onEdit?: (row: AdjustmentRow) => void
  onDelete?: (row: AdjustmentRow) => void
  onAppendMore?: (row: AdjustmentRow) => void
}

// ─── Metadata ─────────────────────────────────────────────────

const TYPE_META: Record<AdjustmentType, { label: string; variant: 'secondary' | 'outline' | 'destructive' }> = {
  PHYSICAL_COUNT: { label: 'Physical Count', variant: 'secondary' },
  DAMAGE: { label: 'Damage', variant: 'destructive' },
  THEFT: { label: 'Theft', variant: 'destructive' },
  EXPIRY: { label: 'Expiry Write-off', variant: 'destructive' },
  CORRECTION: { label: 'Correction', variant: 'outline' },
  OPENING_STOCK: { label: 'Opening Stock', variant: 'secondary' },
}

const STATUS_META: Record<
  AdjustmentStatus,
  { label: string; variant: 'warning' | 'success' | 'destructive' }
> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'destructive' },
}

// ─── Columns ─────────────────────────────────────────────────

function useColumns(
  canApprove: boolean,
  onApprove: ((row: AdjustmentRow) => void) | undefined,
  onReject: ((row: AdjustmentRow) => void) | undefined,
  onEdit: ((row: AdjustmentRow) => void) | undefined,
  onDelete: ((row: AdjustmentRow) => void) | undefined,
  onAppendMore: ((row: AdjustmentRow) => void) | undefined
): ColumnDef<AdjustmentRow>[] {
  const columns: ColumnDef<AdjustmentRow>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Date & Time',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      accessorKey: 'product.name',
      header: 'Medicine & Storage Location',
      cell: ({ row }) => {
        const p = row.original.product
        const hasLocation = Boolean(p.rack || p.shelf || p.box)

        return (
          <div className="space-y-1 max-w-[260px]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm leading-tight text-foreground hover:text-primary transition-colors">
                {p.name}
              </span>
              {row.original.isDeadStock && (
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                >
                  Dead Stock
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="font-mono text-[11px]">{p.sku}</span>
              {hasLocation ? (
                <span className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary font-medium px-1.5 py-0.5 rounded">
                  <Layers className="h-3 w-3" />
                  {formatRack(p.rack) ? `${formatRack(p.rack)}` : ''}
                  {formatShelf(p.shelf) ? ` › ${formatShelf(p.shelf)}` : ''}
                  {p.box ? ` › Box ${p.box}` : ''}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground/70 italic">No rack assigned</span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'batch.batchNumber',
      header: 'Batch & Expiry',
      cell: ({ row }) => {
        const batch = row.original.batch
        if (!batch) {
          return <span className="text-xs text-muted-foreground italic">Product aggregate</span>
        }

        const expDate = batch.expiryDate ? new Date(batch.expiryDate) : null
        const isNear = row.original.isNearExpiry

        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1">
              <Package className="h-3 w-3 text-muted-foreground" />
              <span className="font-mono text-xs font-medium">{batch.batchNumber}</span>
            </div>
            {expDate && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground">
                  Exp: {expDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </span>
                {isNear && (
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 px-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-medium"
                  >
                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                    Near Expiry
                  </Badge>
                )}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'batch.supplier.name',
      header: 'Supplier / Vendor',
      cell: ({ row }) => {
        const supplier = row.original.batch?.supplier
        if (!supplier) {
          return <span className="text-xs text-muted-foreground">—</span>
        }
        return (
          <div className="flex items-center gap-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium text-foreground truncate max-w-[140px]" title={supplier.name}>
              {supplier.name}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: 'branch.name',
      header: 'Branch',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.branch.name}</span>
      ),
    },
    {
      accessorKey: 'adjustmentType',
      header: 'Type & Reason',
      cell: ({ row }) => {
        const meta = TYPE_META[row.original.adjustmentType] ?? {
          label: row.original.adjustmentType,
          variant: 'secondary' as const,
        }
        return (
          <div className="space-y-1 max-w-[200px]">
            <Badge variant={meta.variant} className="text-[11px] font-medium">
              {meta.label}
            </Badge>
            <p className="text-xs text-muted-foreground line-clamp-1" title={row.original.reason}>
              {row.original.reason}
            </p>
          </div>
        )
      },
    },
    {
      accessorKey: 'quantity',
      header: 'Delta Qty',
      cell: ({ row }) => {
        const qty = row.original.quantity
        const isPositive = qty > 0

        return (
          <div className="flex items-center gap-1 font-mono text-sm">
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <TrendingDown className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span
              className={
                isPositive
                  ? 'font-bold text-emerald-600 dark:text-emerald-400'
                  : 'font-bold text-rose-600 dark:text-rose-400'
              }
            >
              {isPositive ? `+${qty}` : qty}
            </span>
          </div>
        )
      },
    },
    {
      id: 'financialImpact',
      header: 'Financial Impact',
      cell: ({ row }) => {
        const costImpact = row.original.costImpact
        const mrpImpact = row.original.mrpImpact

        if (costImpact == null && mrpImpact == null) {
          return <span className="text-xs text-muted-foreground">—</span>
        }

        const isPositive = (costImpact ?? 0) >= 0

        return (
          <div className="space-y-0.5 text-xs font-mono">
            <div
              className={`font-semibold ${
                isPositive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {isPositive ? '+' : ''}₹{costImpact?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-[10px] text-muted-foreground font-normal ml-1">cost</span>
            </div>
            {mrpImpact != null && (
              <div className="text-[11px] text-muted-foreground">
                MRP: {isPositive ? '+' : ''}₹{mrpImpact.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const meta = STATUS_META[row.original.status]
        return (
          <Badge variant={meta.variant} className="text-[11px] font-medium whitespace-nowrap">
            {meta.label}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'createdBy.name',
      header: 'Auditor / Created By',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.createdBy.name}</span>
      ),
    },
  ]

  if (canApprove || onEdit || onDelete || onAppendMore) {
    columns.push({
      id: 'actions',
      header: 'Action',
      cell: ({ row }) => {
        const adjustment = row.original
        const isPending = adjustment.status === 'PENDING'

        return (
          <div className="flex items-center gap-1">
            {/* Supervisor Approval & Rejection for PENDING */}
            {canApprove && isPending && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-500/30"
                  title="Approve and apply adjustment"
                  onClick={() => onApprove?.(adjustment)}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-500/30"
                  title="Reject adjustment"
                  onClick={() => onReject?.(adjustment)}
                >
                  <X className="h-3 w-3 mr-1" />
                  Reject
                </Button>
              </>
            )}

            {/* Append more items with respective vendor */}
            {onAppendMore && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                title="Add more items for this vendor"
                onClick={() => onAppendMore(adjustment)}
              >
                <PlusCircle className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Edit / Modify Option */}
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-muted"
                title="Modify adjustment"
                onClick={() => onEdit(adjustment)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Delete / Reversal Option */}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                title="Delete adjustment"
                onClick={() => onDelete(adjustment)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )
      },
    })
  }

  return columns
}

// ─── Component ───────────────────────────────────────────────

export function AdjustmentsTable({
  rows,
  isLoading,
  canApprove = false,
  onApprove,
  onReject,
  onEdit,
  onDelete,
  onAppendMore,
}: AdjustmentsTableProps) {
  const columns = useColumns(canApprove, onApprove, onReject, onEdit, onDelete, onAppendMore)

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      emptyMessage="No stock adjustments found matching your criteria."
    />
  )
}

