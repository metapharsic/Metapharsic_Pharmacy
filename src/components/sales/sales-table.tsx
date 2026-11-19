'use client'

// ─────────────────────────────────────────────────────────────
// Component — SalesTable
// Lists completed sales/invoices with payment + sale status and
// descriptive commercial profit intelligence.
// ─────────────────────────────────────────────────────────────
import type { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'

import { DataTable } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants/routes'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDateTime } from '@/lib/utils/date'

import {
  PAYMENT_STATUS_META,
  SALE_STATUS_META,
  type PaymentStatusRow,
  type SaleStatusRow,
} from '@/lib/constants/sales'
export {
  PAYMENT_STATUS_META,
  SALE_STATUS_META,
  type PaymentStatusRow,
  type SaleStatusRow,
}

export interface SalesItemSummary {
  id: string
  productName: string
  productSku: string
  quantity: number
  returnedQuantity?: number
  unitPrice?: string
  totalAmount?: string
  purchaseCost?: number
  profitAmount?: number
  profitPct?: number | null
  costBasis?: number
  itemBatches?: {
    id: string
    quantity: number
    batch: {
      id: string
      batchNumber: string
      expiryDate: string
      purchasePrice?: string | null
    }
  }[]
}

export interface SalesPaymentSummary {
  id: string
  method: string
  amount: string
  reference?: string | null
}

export interface SalesRow {
  id: string
  invoiceNumber: string
  saleDate: string
  status: SaleStatusRow
  paymentStatus: PaymentStatusRow
  totalAmount: string
  amountPaid: string
  balanceDue: string
  purchaseCost?: number
  profitAmount?: number
  profitPct?: number | null
  purchaseCostComplete?: boolean
  purchaseUnpricedUnits?: number
  customer: { id: string; name: string; phone: string | null } | null
  createdBy: { id: string; name: string } | null
  items?: SalesItemSummary[]
  payments?: SalesPaymentSummary[]
}

// ─── Columns Builder ──────────────────────────────────────────

export function getSalesColumns(
  onViewBill?: (row: SalesRow) => void,
  onSettleBalance?: (row: SalesRow) => void,
  isAdmin: boolean = false
): ColumnDef<SalesRow>[] {
  return [
    {
      accessorKey: 'invoiceNumber',
      header: 'Invoice',
      meta: {
        className: 'w-[130px]',
      },
      cell: ({ row }) => (
        <div>
          <button
            type="button"
            onClick={() => onViewBill?.(row.original)}
            className="font-semibold tracking-tight text-primary font-mono text-xs hover:underline text-left"
          >
            {row.original.invoiceNumber}
          </button>
          <div className="text-[11px] text-muted-foreground whitespace-nowrap mt-0.5">
            {formatDateTime(row.original.saleDate)}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'customer.name',
      header: 'Customer',
      meta: {
        className: 'min-w-[130px]',
      },
      cell: ({ row }) =>
        row.original.customer ? (
          <div>
            <div className="font-medium text-foreground text-xs">{row.original.customer.name}</div>
            {row.original.customer.phone && (
              <div className="text-[11px] text-muted-foreground">{row.original.customer.phone}</div>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground italic text-xs">Walk-in Customer</span>
        ),
    },
    {
      id: 'medicines',
      header: 'Medicines & Batches Sold',
      meta: {
        className: 'min-w-[200px]',
      },
      cell: ({ row }) => {
        const items = row.original.items || []
        if (items.length === 0) {
          return <span className="text-muted-foreground text-xs italic">Items recorded on bill</span>
        }
        return (
          <div className="space-y-1 py-0.5">
            {items.map((it, idx) => (
              <div key={it.id || idx} className="text-xs">
                <span className="font-medium text-foreground">{it.productName}</span>
                <span className="ml-1 text-muted-foreground">· Qty {it.quantity}</span>
                {it.itemBatches && it.itemBatches.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono bg-muted text-muted-foreground border">
                    {it.itemBatches.map((b) => b.batch.batchNumber).join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )
      },
    },
    {
      accessorKey: 'totalAmount',
      header: 'Total',
      meta: {
        align: 'right',
        className: 'w-[95px] text-right',
      },
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums text-foreground text-xs">
          {formatCurrency(row.original.totalAmount)}
        </span>
      ),
    },
    ...(isAdmin
      ? [
          {
            accessorKey: 'purchaseCost' as const,
            header: 'Purchase Cost',
            meta: {
              align: 'right' as const,
              className: 'w-[105px] text-right',
            },
            cell: ({ row }: { row: { original: SalesRow } }) => {
              const cost = row.original.purchaseCost ?? 0
              return (
                <div className="text-right">
                  <span className="font-mono text-muted-foreground text-xs tabular-nums">
                    {formatCurrency(cost)}
                  </span>
                  {row.original.purchaseCostComplete === false && (
                    <div
                      className="text-[9px] text-amber-600 dark:text-amber-400 font-bold uppercase"
                      title={`${row.original.purchaseUnpricedUnits || 0} units unpriced`}
                    >
                      {row.original.purchaseUnpricedUnits} unpriced
                    </div>
                  )}
                </div>
              )
            },
          },
          {
            accessorKey: 'profitAmount' as const,
            header: 'Profit Earned',
            meta: {
              align: 'right' as const,
              className: 'w-[110px] text-right',
            },
            cell: ({ row }: { row: { original: SalesRow } }) => {
              const profit = row.original.profitAmount ?? 0
              const isPositive = profit >= 0
              return (
                <div className="text-right">
                  <span
                    className={`font-bold tabular-nums text-xs ${
                      isPositive
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatCurrency(profit)}
                  </span>
                </div>
              )
            },
          },
          {
            accessorKey: 'profitPct' as const,
            header: 'Profit %',
            meta: {
              align: 'center' as const,
              className: 'w-[95px] text-center',
            },
            cell: ({ row }: { row: { original: SalesRow } }) => {
              const pct = row.original.profitPct
              let badgeClasses = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              if (pct != null) {
                if (pct >= 20) {
                  badgeClasses =
                    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/40'
                } else if (pct >= 10) {
                  badgeClasses =
                    'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300/40'
                } else if (pct >= 0) {
                  badgeClasses =
                    'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/40'
                } else {
                  badgeClasses =
                    'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300/40'
                }
              }
              return (
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${badgeClasses}`}
                >
                  {pct != null ? `${pct.toFixed(1)}%` : '—'}
                </span>
              )
            },
          },
        ]
      : []),
    {
      accessorKey: 'amountPaid',
      header: 'Payment Received',
      meta: {
        align: 'right',
        className: 'w-[125px] text-right',
      },
      cell: ({ row }) => {
        const primaryPayment = row.original.payments?.[0]
        return (
          <div className="text-right">
            <div className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
              {formatCurrency(row.original.amountPaid)}
            </div>
            {primaryPayment && (
              <div className="text-[10px] text-muted-foreground capitalize">
                {primaryPayment.method.toLowerCase()}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'paymentStatus',
      header: 'Payment',
      meta: {
        align: 'center',
        className: 'w-[105px] text-center',
      },
      cell: ({ row }) => {
        const meta = PAYMENT_STATUS_META[row.original.paymentStatus]
        return <Badge variant={meta.variant}>{meta.label}</Badge>
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      meta: {
        align: 'center',
        className: 'w-[95px] text-center',
      },
      cell: ({ row }) => {
        const meta = SALE_STATUS_META[row.original.status]
        return <Badge variant={meta.variant}>{meta.label}</Badge>
      },
    },
    {
      accessorKey: 'createdBy.name',
      header: 'Cashier',
      meta: {
        className: 'w-[100px]',
      },
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {row.original.createdBy?.name ?? '-'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      meta: {
        align: 'right',
        className: 'w-[145px] text-right',
      },
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1.5">
          {Number(row.original.balanceDue) > 0 && row.original.status !== 'CANCELLED' && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/30 gap-1"
              onClick={() => onSettleBalance?.(row.original)}
            >
              Settle
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs font-medium"
            onClick={() => onViewBill?.(row.original)}
          >
            View bill
          </Button>
        </div>
      ),
    },
  ]
}

// ─── Component ───────────────────────────────────────────────

interface SalesTableProps {
  rows: SalesRow[]
  isLoading?: boolean
  total?: number
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  onViewBill?: (row: SalesRow) => void
  onSettleBalance?: (row: SalesRow) => void
  isAdmin?: boolean
}

export function SalesTable({
  rows,
  isLoading,
  total,
  page,
  totalPages,
  onPageChange,
  onViewBill,
  onSettleBalance,
  isAdmin = false,
}: SalesTableProps) {
  const tableColumns = getSalesColumns(onViewBill, onSettleBalance, isAdmin)

  return (
    <DataTable
      columns={tableColumns}
      data={rows}
      isLoading={isLoading}
      emptyMessage="No sales found."
      manualPagination={total !== undefined || totalPages !== undefined}
      totalRows={total}
      pageIndex={page}
      pageCount={totalPages}
      onPageChange={onPageChange}
    />
  )
}
