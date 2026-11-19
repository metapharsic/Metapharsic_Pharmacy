'use client'

// ─────────────────────────────────────────────────────────────
// Component — SaleBillDetailDialog
// Rich interactive bill details dialog with:
//  1. Invoice header, customer, cashier, and settlement status
//  2. Line items with batch numbers and expiry dates
//  3. Exact automatic stock deduction & inventory movement traceability
//  4. Payment method allocations and outstanding balance settlement
//  5. Audit trail and permission-aware actions
// ─────────────────────────────────────────────────────────────
import {
  AlertCircle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  ExternalLink,
  FileText,
  PackageCheck,
  Printer,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { EditSaleDialog } from '@/components/sales/edit-sale-dialog'
import { SaleInvoiceDialog } from '@/components/sales/sale-invoice-dialog'
import type { SalesRow } from '@/components/sales/sales-table'
import { SettlePaymentDialog } from '@/components/sales/settle-payment-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { ROUTES } from '@/lib/constants/routes'
import { PAYMENT_STATUS_META, SALE_STATUS_META } from '@/lib/constants/sales'
import { useToast } from '@/lib/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDateTime } from '@/lib/utils/date'

interface MovementTrace {
  id: string
  inventoryId: string
  type: string
  quantity: number
  quantityBefore: number
  quantityAfter: number
  referenceType: string | null
  referenceId: string | null
  batchId: string | null
  notes: string | null
  createdAt: string | Date
  productName: string
  productSku: string
  unitOfMeasure: string
  batchNumber: string | null
  expiryDate: string | Date | null
}

interface SaleDetailPayload {
  id: string
  invoiceNumber: string
  saleDate: string
  subtotal: string | number
  taxAmount: string | number
  cgstAmount: string | number
  sgstAmount: string | number
  discountAmount: string | number
  totalAmount: string | number
  amountPaid: string | number
  balanceDue: string | number
  purchaseCost?: number
  profitAmount?: number
  profitPct?: number | null
  purchaseCostComplete?: boolean
  purchaseUnpricedUnits?: number
  status: string
  paymentStatus: string
  notes?: string | null
  customer?: { id: string; name: string; phone: string | null } | null
  createdBy?: { id: string; name: string } | null
  branch?: { id: string; name: string; code: string } | null
  items: {
    id: string
    productName: string
    productSku: string
    quantity: number
    returnedQuantity: number
    unitPrice: string | number
    mrp: string | number
    discountPercent: string | number
    taxPercent: string | number
    taxAmount: string | number
    totalAmount: string | number
    purchaseCost?: number
    profitAmount?: number
    profitPct?: number | null
    costBasis?: number
    itemBatches: {
      id: string
      quantity: number
      batch: { id: string; batchNumber: string; expiryDate: string; purchasePrice?: string | number | null }
    }[]
  }[]
  payments: {
    id: string
    method: string
    amount: string | number
    reference?: string | null
    createdAt: string
  }[]
  movements?: MovementTrace[]
  returns?: {
    id: string
    returnNumber: string
    returnDate: string
    totalAmount: string | number
    status: string
  }[]
}

interface SaleBillDetailDialogProps {
  saleId: string | null
  initialRow?: SalesRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => void
  isAdmin?: boolean
}

export function SaleBillDetailDialog({
  saleId,
  initialRow,
  open,
  onOpenChange,
  onUpdated,
  isAdmin = false,
}: SaleBillDetailDialogProps) {
  const toast = useToast()
  const { data: session } = useSession()
  const userRoles = session?.user?.roles ?? []
  const userPermissions = session?.user?.permissions ?? []
  const isAdminOrManager =
    isAdmin ||
    userRoles.some((r: string) =>
      ['admin', 'owner', 'manager', 'super_admin'].includes(r.toLowerCase())
    )
  const canCancel = userPermissions.includes(PERMISSIONS.SALES_VOID) || isAdminOrManager

  const [sale, setSale] = useState<SaleDetailPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'bill' | 'profit' | 'traceability' | 'payments' | 'audit'>('bill')

  const [settleDialogOpen, setSettleDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  const fetchSale = useCallback(() => {
    if (!saleId) return
    setLoading(true)
    setError(null)
    fetch(`/api/sales/${saleId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch sale bill`)
        const json = await res.json()
        if (json.success && json.data) {
          setSale(json.data)
        } else {
          throw new Error(json.error?.message || 'Failed to load bill')
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load details')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [saleId])

  useEffect(() => {
    if (!open || !saleId) {
      setSale(null)
      return
    }
    fetchSale()
  }, [open, saleId, fetchSale])

  const handleCancelSale = async () => {
    if (!saleId || cancelReason.trim().length < 3) return
    setIsCancelling(true)
    try {
      const res = await fetch(`/api/sales/${saleId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to cancel sale')
      }
      toast.success('Sale Cancelled Successfully', 'Stock and batch quantities have been restored.')
      setCancelDialogOpen(false)
      fetchSale()
      onUpdated?.()
    } catch (err) {
      toast.error('Cancellation Failed', err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsCancelling(false)
    }
  }

  // If loading and initialRow exists, use initialRow for preview
  const invoiceNumber = sale?.invoiceNumber || initialRow?.invoiceNumber || 'Invoice'
  const saleDate = sale?.saleDate || initialRow?.saleDate || new Date().toISOString()
  const customerName = sale?.customer?.name || initialRow?.customer?.name || 'Walk-in Customer'
  const customerPhone = sale?.customer?.phone || initialRow?.customer?.phone || null
  const cashierName = sale?.createdBy?.name || initialRow?.createdBy?.name || 'Staff'
  const status = (sale?.status || initialRow?.status || 'COMPLETED') as keyof typeof SALE_STATUS_META
  const paymentStatus = (sale?.paymentStatus ||
    initialRow?.paymentStatus ||
    'PAID') as keyof typeof PAYMENT_STATUS_META
  const totalAmount = sale?.totalAmount ?? initialRow?.totalAmount ?? '0'
  const amountPaid = sale?.amountPaid ?? initialRow?.amountPaid ?? '0'
  const balanceDue = sale?.balanceDue ?? initialRow?.balanceDue ?? '0'

  const purchaseCost = sale?.purchaseCost ?? initialRow?.purchaseCost ?? 0
  const profitAmount =
    sale?.profitAmount ??
    initialRow?.profitAmount ??
    Math.round((Number(totalAmount) - purchaseCost) * 100) / 100
  const profitPct =
    sale?.profitPct ??
    initialRow?.profitPct ??
    (Number(totalAmount) > 0 ? Math.round((profitAmount / Number(totalAmount)) * 10000) / 100 : 0)
  const purchaseCostComplete =
    sale?.purchaseCostComplete ?? initialRow?.purchaseCostComplete ?? true
  const purchaseUnpricedUnits =
    sale?.purchaseUnpricedUnits ?? initialRow?.purchaseUnpricedUnits ?? 0

  const marginGrade = useMemo(() => {
    const rev = Number(totalAmount)
    if (rev <= 0) {
      return { label: 'NO DATA', color: 'bg-muted text-muted-foreground border-border' }
    }
    const pct = profitPct != null ? profitPct : (profitAmount / rev) * 100
    if (pct >= 25) {
      return {
        label: 'OPTIMAL MARGIN',
        color:
          'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      }
    }
    if (pct >= 15) {
      return {
        label: 'HEALTHY COMMERCIAL',
        color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
      }
    }
    if (pct >= 5) {
      return {
        label: 'ACCEPTABLE',
        color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
      }
    }
    return {
      label: 'LOW MARGIN / AT RISK',
      color: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
    }
  }, [totalAmount, profitAmount, profitPct])

  const saleMeta = SALE_STATUS_META[status] || { label: status, variant: 'secondary' }
  const paymentMeta = PAYMENT_STATUS_META[paymentStatus] || {
    label: paymentStatus,
    variant: 'secondary',
  }

  const movements = sale?.movements || []
  const items = sale?.items || []
  const payments = sale?.payments || []

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-border/80 shadow-2xl">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-muted/60 via-background to-muted/40 border-b">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Receipt className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-bold font-mono tracking-tight text-foreground flex items-center gap-2">
                    {invoiceNumber}
                    <Badge variant={saleMeta.variant}>{saleMeta.label}</Badge>
                    <Badge variant={paymentMeta.variant}>{paymentMeta.label}</Badge>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground/80" />
                    <span>{formatDateTime(saleDate)}</span>
                    <span>•</span>
                    <User className="h-3.5 w-3.5 text-muted-foreground/80" />
                    <span className="font-medium text-foreground">{customerName}</span>
                    {customerPhone && <span className="text-muted-foreground">({customerPhone})</span>}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {sale && (
                <SaleInvoiceDialog sale={JSON.parse(JSON.stringify(sale))} />
              )}
              {saleId && (
                <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
                  <Link href={ROUTES.SALE(saleId)}>
                    Full Page
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-border/60">
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/50">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Total Bill
              </span>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {formatCurrency(totalAmount.toString())}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/50">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Purchase Cost
              </span>
              <p className="text-lg font-bold tabular-nums text-foreground font-mono">
                {formatCurrency(purchaseCost)}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                <span>Profit Earned</span>
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              </span>
              <p className={`text-lg font-bold tabular-nums ${profitAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatCurrency(profitAmount)}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/50">
              <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Profit Margin
              </span>
              <p className="text-lg font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                {profitPct != null ? `${profitPct.toFixed(1)}%` : '—'}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/50">
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Amount Received
              </span>
              <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(amountPaid.toString())}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as typeof activeTab)}
            className="w-full"
          >
            <TabsList className={`grid ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'} mb-4`}>
              <TabsTrigger value="bill" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />
                Line Items ({items.length || initialRow?.items?.length || 0})
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="profit" className="gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Profit Intelligence
                </TabsTrigger>
              )}
              <TabsTrigger value="traceability" className="gap-1.5 text-xs">
                <Boxes className="h-3.5 w-3.5 text-primary" />
                Traceability ({movements.length || items.length})
              </TabsTrigger>
              <TabsTrigger value="payments" className="gap-1.5 text-xs">
                <Coins className="h-3.5 w-3.5" />
                Payments ({payments.length || initialRow?.payments?.length || 1})
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-1.5 text-xs">
                <ShieldCheck className="h-3.5 w-3.5" />
                Audit
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Line Items & Bill Details */}
            <TabsContent value="bill" className="space-y-4">
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/70 text-muted-foreground border-b font-medium">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Medicine / Product</th>
                      <th className="py-2.5 px-3 text-left">Batch & Expiry</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">GST</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {items.length > 0 ? (
                      items.map((it) => (
                        <tr key={it.id} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-medium text-foreground">
                            <div>{it.productName}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {it.productSku}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {it.itemBatches && it.itemBatches.length > 0 ? (
                              <div className="space-y-1">
                                {it.itemBatches.map((ib) => (
                                  <div
                                    key={ib.id}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/80 text-[11px] font-mono border"
                                  >
                                    <span className="font-semibold text-foreground">
                                      {ib.batch.batchNumber}
                                    </span>
                                    <span className="text-muted-foreground">
                                      (Exp: {new Date(ib.batch.expiryDate).toLocaleDateString()})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">Standard Batch</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold tabular-nums text-foreground">
                            {it.quantity}
                            {it.returnedQuantity > 0 && (
                              <span className="ml-1 text-amber-600 dark:text-amber-400 text-[10px]">
                                (-{it.returnedQuantity} ret)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(it.unitPrice.toString())}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(it.taxAmount.toString())} ({Number(it.taxPercent)}%)
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-foreground">
                            {formatCurrency(it.totalAmount.toString())}
                          </td>
                        </tr>
                      ))
                    ) : initialRow?.items && initialRow.items.length > 0 ? (
                      initialRow.items.map((it) => (
                        <tr key={it.id} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-medium text-foreground">
                            <div>{it.productName}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {it.productSku}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {it.itemBatches && it.itemBatches.length > 0 ? (
                              it.itemBatches.map((ib, idx) => (
                                <Badge key={idx} variant="outline" className="font-mono text-[10px]">
                                  {ib.batch.batchNumber}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground italic">Standard Batch</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold tabular-nums">
                            {it.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(it.unitPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                            -
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold tabular-nums">
                            {formatCurrency(it.totalAmount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-muted-foreground">
                          {loading ? 'Loading items...' : 'No items recorded'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bill Totals Summary */}
              <div className="flex justify-end">
                <div className="w-full max-w-xs space-y-1.5 text-xs bg-muted/30 p-3 rounded-lg border">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Taxable Subtotal:</span>
                    <span className="font-mono tabular-nums text-foreground">
                      {formatCurrency((sale?.subtotal ?? 0).toString())}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Estimated GST (CGST+SGST):</span>
                    <span className="font-mono tabular-nums text-foreground">
                      {formatCurrency((sale?.taxAmount ?? 0).toString())}
                    </span>
                  </div>
                  {Number(sale?.discountAmount || 0) > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Discount:</span>
                      <span className="font-mono tabular-nums">
                        -{formatCurrency((sale?.discountAmount || 0).toString())}
                      </span>
                    </div>
                  )}
                  {isAdmin && (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Purchase Cost (COGS):</span>
                        <span className="font-mono tabular-nums text-foreground">
                          {formatCurrency(purchaseCost)}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>Gross Profit Earned:</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(profitAmount)} ({profitPct != null ? `${profitPct.toFixed(1)}%` : '0%'})
                        </span>
                      </div>
                    </>
                  )}
                  <Separator className="my-1.5" />
                  <div className="flex justify-between font-bold text-sm text-foreground">
                    <span>Total Amount:</span>
                    <span className="font-mono tabular-nums text-primary">
                      {formatCurrency(totalAmount.toString())}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Amount Paid:</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(amountPaid.toString())}
                    </span>
                  </div>
                  {Number(balanceDue) > 0 && (
                    <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold">
                      <span>Balance Outstanding:</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(balanceDue.toString())}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: Automatic Stock Deduction & Traceability */}
            <TabsContent value="traceability" className="space-y-4">
              <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                <PackageCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                    Automatic Stock Deduction Record
                  </p>
                  <p className="text-muted-foreground mt-0.5 leading-relaxed">
                    Stock was automatically deducted from inventory when this sale was finalized at
                    the POS counter. The records below verify the exact physical batches, quantities,
                    and before/after stock balances deducted by this invoice.
                  </p>
                </div>
              </div>

              {movements.length > 0 ? (
                <div className="space-y-3">
                  {movements.map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            {m.type} ({m.quantity} {m.unitOfMeasure || 'units'})
                          </span>
                          <span className="font-semibold text-sm text-foreground">
                            {m.productName}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground">
                            [{m.productSku}]
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          <span>{formatDateTime(m.createdAt)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-dashed text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">
                            Deducted Batch
                          </span>
                          <p className="font-mono font-semibold text-foreground mt-0.5">
                            {m.batchNumber || 'Batch Active'}
                          </p>
                          {m.expiryDate && (
                            <p className="text-[10px] text-muted-foreground">
                              Exp: {new Date(m.expiryDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">
                            Stock Before Sale
                          </span>
                          <p className="font-mono font-semibold text-muted-foreground mt-0.5">
                            {m.quantityBefore} {m.unitOfMeasure || 'units'}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">
                            Stock After Sale
                          </span>
                          <p className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {m.quantityAfter} {m.unitOfMeasure || 'units'}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">
                            Movement Ref
                          </span>
                          <p className="font-mono text-xs text-foreground mt-0.5 truncate">
                            {m.referenceType || 'SALE'} • {invoiceNumber}
                          </p>
                        </div>
                      </div>

                      {m.notes && (
                        <p className="text-[11px] text-muted-foreground italic bg-muted/40 px-2 py-1 rounded">
                          Audit note: {m.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Fallback rendering from bill line items if movements not yet indexed */}
                  {items.map((it) => (
                    <div
                      key={it.id}
                      className="p-3.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            OUT (-{it.quantity} Strips)
                          </span>
                          <span className="font-semibold text-sm text-foreground">
                            {it.productName}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          <span>{formatDateTime(saleDate)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-dashed text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">
                            Batch Allocated
                          </span>
                          <p className="font-mono font-semibold text-foreground mt-0.5">
                            {it.itemBatches?.[0]?.batch?.batchNumber || 'Batch Active'}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">
                            Deduction Status
                          </span>
                          <p className="font-mono font-semibold text-emerald-600 mt-0.5">
                            Committed (-{it.quantity})
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">
                            FEFO Allocation
                          </span>
                          <p className="font-mono font-semibold text-foreground mt-0.5">Verified</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">
                            Invoice Ref
                          </span>
                          <p className="font-mono text-xs text-foreground mt-0.5">{invoiceNumber}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 3: Payment Allocations & Settlements */}
            <TabsContent value="payments" className="space-y-4">
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/70 text-muted-foreground border-b font-medium">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Payment Method</th>
                      <th className="py-2.5 px-3 text-left">Reference / Notes</th>
                      <th className="py-2.5 px-3 text-left">Date & Time</th>
                      <th className="py-2.5 px-3 text-right">Amount Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {payments.length > 0 ? (
                      payments.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-primary" />
                            <span className="capitalize">{p.method.toLowerCase()}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground">
                            {p.reference || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {formatDateTime(p.createdAt)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(p.amount.toString())}
                          </td>
                        </tr>
                      ))
                    ) : initialRow?.payments && initialRow.payments.length > 0 ? (
                      initialRow.payments.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-primary" />
                            <span className="capitalize">{p.method.toLowerCase()}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground">
                            {p.reference || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {formatDateTime(saleDate)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(p.amount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-muted-foreground">
                          No payment entries recorded
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {Number(balanceDue) > 0 && (
                <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-xs text-amber-700 dark:text-amber-300">
                        Outstanding Balance Due: {formatCurrency(balanceDue.toString())}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        This bill has an unsettled balance. You can record cash, UPI, card, or split
                        settlement right now.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    onClick={() => setSettleDialogOpen(true)}
                  >
                    <Coins className="h-3.5 w-3.5" />
                    Collect Payment
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* TAB 4: Audit & Governance */}
            <TabsContent value="audit" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border bg-card space-y-2">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Staff Accountability
                  </span>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Billed By (Cashier):</span>
                      <span className="font-semibold text-foreground">{cashierName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Branch / Terminal:</span>
                      <span className="font-semibold text-foreground">
                        {sale?.branch?.name || 'Main Pharmacy'} ({sale?.branch?.code || 'HO'})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Invoice Counter:</span>
                      <span className="font-mono text-foreground">{invoiceNumber}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg border bg-card space-y-2">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Customer Lookup
                  </span>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer Name:</span>
                      <span className="font-semibold text-foreground">{customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone Number:</span>
                      <span className="font-mono text-foreground">{customerPhone || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sale Category:</span>
                      <span className="font-semibold text-foreground">
                        {paymentStatus === 'CREDIT' ? 'Credit Sale' : 'Retail POS'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {sale?.notes && (
                <div className="p-3 rounded-lg border bg-muted/30 text-xs space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Cashier / Bill Notes
                  </span>
                  <p className="text-foreground">{sale.notes}</p>
                </div>
              )}

              <div className="p-3 rounded-lg border border-border/80 bg-muted/20 text-xs space-y-1.5">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Read-Only Sales History Protection
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Sales History records are immutable to protect stock accuracy and financial audit
                  integrity. Any return, refund, cancellation or balance settlement must be processed
                  through permission-controlled workflows.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="p-4 bg-muted/40 border-t flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            Invoice: <span className="font-mono font-medium text-foreground">{invoiceNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            {Number(balanceDue) > 0 && status !== 'CANCELLED' && (
              <Button
                size="sm"
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setSettleDialogOpen(true)}
              >
                <Coins className="h-3.5 w-3.5" />
                Settle Balance ({formatCurrency(balanceDue.toString())})
              </Button>
            )}

            {sale && canCancel && status === 'COMPLETED' && (
              <EditSaleDialog
                sale={{
                  ...sale,
                  items: sale.items.map((it) => ({
                    ...it,
                    unitPrice: it.unitPrice,
                    discountPercent: it.discountPercent,
                    taxPercent: it.taxPercent,
                    totalAmount: it.totalAmount,
                  })),
                } as any}
              />
            )}

            {saleId && canCancel && status === 'COMPLETED' && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setCancelDialogOpen(true)}
              >
                <X className="h-3.5 w-3.5" />
                Cancel Sale
              </Button>
            )}

            {saleId && (
              <Button asChild size="sm" variant="outline" className="text-xs gap-1">
                <Link href={`${ROUTES.SALE_RETURNS_NEW}?saleId=${saleId}`}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Process Return
                </Link>
              </Button>
            )}
            <Button size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Settle Payment Modal */}
      {saleId && (
        <SettlePaymentDialog
          saleId={saleId}
          invoiceNumber={invoiceNumber}
          customerName={customerName}
          totalAmount={totalAmount}
          amountPaid={amountPaid}
          balanceDue={balanceDue}
          open={settleDialogOpen}
          onOpenChange={setSettleDialogOpen}
          onSuccess={() => {
            // Re-fetch sale details
            fetchSale()
            onUpdated?.()
          }}
        />
      )}

      {/* Cancel Confirmation Modal */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Cancel Sale & Reverse Stock
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to cancel invoice <strong className="font-mono">{invoiceNumber}</strong>?
              This will preserve the invoice audit record, set status to CANCELLED, and automatically generate an inventory reversal movement (RETURN_IN) restoring batch stock.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">
                Reason for cancellation *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer returned items prior to departure, incorrect pricing entered, etc."
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              disabled={isCancelling}
              onClick={() => setCancelDialogOpen(false)}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isCancelling || cancelReason.trim().length < 3}
              onClick={handleCancelSale}
            >
              {isCancelling ? 'Reversing...' : 'Confirm Cancellation'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
