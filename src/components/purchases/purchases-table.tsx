'use client'

// ─────────────────────────────────────────────────────────────
// Component — PurchasesTable
// Lists purchase orders with status badges, delivery tracking,
// supplier confirmation, print/email capabilities, and direct GRN.
// ─────────────────────────────────────────────────────────────
import type { ColumnDef } from '@tanstack/react-table'
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  PackageCheck,
  Printer,
  Receipt,
  RotateCcw,
  Truck,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { PurchaseOrderPrintDialog } from '@/components/purchases/purchase-order-print-dialog'
import { DataTable } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants/routes'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDateTime } from '@/lib/utils/date'

// ─── Types ───────────────────────────────────────────────────

export type PurchaseStatusRow =
  | 'DRAFT'
  | 'ORDERED'
  | 'SENT'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'INVOICED'
  | 'CANCELLED'

export interface PurchaseRow {
  id: string
  purchaseNumber: string
  purchaseDate: string
  expectedDate?: string | null
  status: PurchaseStatusRow
  totalAmount: string
  supplier: { id: string; name: string } | null
  createdBy: { id: string; name: string } | null
  items?: Array<{
    id: string
    orderedQuantity: number
    receivedQuantity: number
    freeQuantity?: number
  }>
}

// ─── Metadata ─────────────────────────────────────────────────

export const PURCHASE_STATUS_META: Record<
  PurchaseStatusRow,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' }
> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  ORDERED: { label: 'Ordered', variant: 'info' },
  SENT: { label: 'Sent', variant: 'info' },
  PARTIALLY_RECEIVED: { label: 'Partially Received', variant: 'warning' },
  RECEIVED: { label: 'Received', variant: 'success' },
  INVOICED: { label: 'Invoiced', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
}

interface PurchasesTableProps {
  rows: PurchaseRow[]
  isLoading?: boolean
  onReceive?: (id: string) => void
  onInvoiceMatch?: (id: string) => void
}

export function PurchasesTable({ rows, isLoading, onReceive, onInvoiceMatch }: PurchasesTableProps) {
  const [activePrintId, setActivePrintId] = useState<string | null>(null)
  const [printModalOpen, setPrintModalOpen] = useState(false)

  const handleOpenPrint = (id: string) => {
    setActivePrintId(id)
    setPrintModalOpen(true)
  }

  const columns: ColumnDef<PurchaseRow>[] = [
    {
      accessorKey: 'purchaseNumber',
      header: 'PO Number',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-mono font-bold text-xs text-foreground">
            {row.original.purchaseNumber}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatDateTime(row.original.purchaseDate)}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'supplier.name',
      header: 'Supplier Distributor',
      cell: ({ row }) =>
        row.original.supplier ? (
          <div>
            <div className="font-semibold text-xs text-foreground">{row.original.supplier.name}</div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Authorised Vendor</span>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'supplierConfirmation',
      header: 'Confirmation',
      cell: ({ row }) => {
        const s = row.original.status
        if (s === 'DRAFT') {
          return (
            <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted-foreground/30">
              Not Sent
            </Badge>
          )
        }
        if (s === 'ORDERED' || s === 'SENT') {
          return (
            <Badge className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/30">
              Awaiting Ack
            </Badge>
          )
        }
        if (s === 'PARTIALLY_RECEIVED') {
          return (
            <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
              In Transit / Part
            </Badge>
          )
        }
        if (s === 'RECEIVED' || s === 'INVOICED') {
          return (
            <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Confirmed & Recd
            </Badge>
          )
        }
        return <span className="text-muted-foreground text-xs">—</span>
      },
    },
    {
      id: 'pendingDelivery',
      header: 'Pending Delivery',
      cell: ({ row }) => {
        const p = row.original
        const isClosed = ['RECEIVED', 'INVOICED', 'CANCELLED'].includes(p.status)

        if (isClosed) {
          return (
            <span className="text-xs text-muted-foreground">
              {p.status === 'CANCELLED' ? 'Cancelled' : 'Complete (100%)'}
            </span>
          )
        }

        // Calculate pending days if expectedDate is provided
        const expDate = p.expectedDate ? new Date(p.expectedDate) : null
        const now = new Date()
        let deliveryPill: React.ReactNode = null

        if (expDate) {
          const diffMs = expDate.getTime() - now.getTime()
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

          if (diffDays < 0) {
            deliveryPill = (
              <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30 text-[10px]">
                Overdue by {Math.abs(diffDays)}d
              </Badge>
            )
          } else if (diffDays === 0) {
            deliveryPill = (
              <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]">
                Due Today
              </Badge>
            )
          } else {
            deliveryPill = (
              <Badge className="bg-primary/10 text-primary border-primary/25 text-[10px]">
                Due in {diffDays}d
              </Badge>
            )
          }
        }

        return (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs font-mono font-medium">
                {expDate ? formatDateTime(expDate.toISOString()) : 'Pending sched.'}
              </span>
            </div>
            {deliveryPill && <div>{deliveryPill}</div>}
          </div>
        )
      },
    },
    {
      accessorKey: 'totalAmount',
      header: 'Order Value',
      cell: ({ row }) => (
        <span className="font-bold text-xs tabular-nums text-foreground">
          {formatCurrency(row.original.totalAmount)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Workflow Stage',
      cell: ({ row }) => {
        const meta = PURCHASE_STATUS_META[row.original.status]
        return (
          <Badge variant={meta.variant} className="text-[10px] font-semibold">
            {meta.label}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const p = row.original
        const canReceive = ['ORDERED', 'SENT', 'PARTIALLY_RECEIVED'].includes(p.status)
        const canInvoiceMatch = ['RECEIVED', 'PARTIALLY_RECEIVED'].includes(p.status)

        return (
          <div className="flex items-center gap-1 justify-end">
            {/* Direct GRN Button for Partially Received or Ordered POs */}
            {canReceive && onReceive && (
              <Button
                variant="outline"
                size="sm"
                className={`h-7 text-xs gap-1 font-semibold ${
                  p.status === 'PARTIALLY_RECEIVED'
                    ? 'border-amber-500/50 text-amber-700 bg-amber-500/10 hover:bg-amber-500/20'
                    : 'border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10'
                }`}
                onClick={() => onReceive(p.id)}
                title={p.status === 'PARTIALLY_RECEIVED' ? 'Receive Remaining Quantity' : 'Generate GRN'}
              >
                <PackageCheck className="h-3 w-3" />
                {p.status === 'PARTIALLY_RECEIVED' ? 'Receive GRN' : 'GRN'}
              </Button>
            )}

            {canInvoiceMatch && onInvoiceMatch && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-purple-500/30 text-purple-600 hover:bg-purple-500/10 gap-1"
                onClick={() => onInvoiceMatch(p.id)}
              >
                <Receipt className="h-3 w-3" />
                Match
              </Button>
            )}

            {/* Print PO */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenPrint(p.id)}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Print Purchase Order"
            >
              <Printer className="h-3.5 w-3.5" />
            </Button>

            {/* Email PO */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenPrint(p.id)}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
              title="Email Purchase Order"
            >
              <Mail className="h-3.5 w-3.5" />
            </Button>

            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link href={ROUTES.PURCHASE(p.id)}>View</Link>
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyMessage="No purchase orders found."
      />

      {/* Print & Email Modal */}
      <PurchaseOrderPrintDialog
        purchaseId={activePrintId}
        open={printModalOpen}
        onOpenChange={setPrintModalOpen}
      />
    </>
  )
}