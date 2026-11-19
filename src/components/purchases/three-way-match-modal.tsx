'use client'

import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  FileCheck,
  Receipt,
  Scale,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/lib/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'

interface PurchaseDetail {
  id: string
  purchaseNumber: string
  purchaseDate: string
  status: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  supplier?: {
    id: string
    name: string
    gstin?: string | null
    dlNumber?: string | null
    creditDays?: number
  } | null
  items: Array<{
    id: string
    product: { id: string; name: string; sku: string }
    orderedQuantity: number
    receivedQuantity: number
    freeQuantity?: number
    unitCost: number
    taxPercent: number
  }>
}

interface ThreeWayMatchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchase: PurchaseDetail | null
  onSuccess?: () => void
}

export function ThreeWayMatchModal({
  open,
  onOpenChange,
  purchase,
  onSuccess,
}: ThreeWayMatchModalProps) {
  const toast = useToast()

  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [tolerancePercent, setTolerancePercent] = useState('1')
  const [submitting, setSubmitting] = useState(false)

  // Billed item inputs
  const [billedItems, setBilledItems] = useState<
    Record<string, { billedQty: number; billedRate: number }>
  >({})

  // Initialize billed items from purchase item ordered/received quantities & rates
  useEffect(() => {
    if (purchase?.items) {
      const initial: Record<string, { billedQty: number; billedRate: number }> = {}
      purchase.items.forEach((item) => {
        initial[item.id] = {
          billedQty: item.receivedQuantity || item.orderedQuantity,
          billedRate: Number(item.unitCost),
        }
      })
      setBilledItems(initial)
      setInvoiceNumber(`INV-${purchase.purchaseNumber.replace('PO-', '')}`)
    }
  }, [purchase])

  if (!purchase) return null

  // Calculate live matched totals
  let billedSubtotal = 0
  let billedTax = 0
  const discrepancies: Array<{
    itemId: string
    productName: string
    type: 'QTY_MISMATCH' | 'RATE_VARIANCE'
    message: string
  }> = []

  const tolerance = (parseFloat(tolerancePercent) || 1) / 100

  purchase.items.forEach((item) => {
    const billed = billedItems[item.id] || {
      billedQty: item.receivedQuantity || item.orderedQuantity,
      billedRate: Number(item.unitCost),
    }

    const itemSubtotal = billed.billedQty * billed.billedRate
    const itemTax = itemSubtotal * ((item.taxPercent || 12) / 100)
    billedSubtotal += itemSubtotal
    billedTax += itemTax

    // 1. Quantity Match Check: Billed vs Accepted
    if (item.receivedQuantity > 0 && billed.billedQty !== item.receivedQuantity) {
      discrepancies.push({
        itemId: item.id,
        productName: item.product.name,
        type: 'QTY_MISMATCH',
        message: `Accepted GRN is ${item.receivedQuantity} units, but supplier billed ${billed.billedQty} units (variance: ${
          billed.billedQty - item.receivedQuantity
        })`,
      })
    }

    // 2. Rate Variance Check
    const poRate = Number(item.unitCost)
    const rateDiff = Math.abs(billed.billedRate - poRate)
    if (poRate > 0 && rateDiff / poRate > tolerance) {
      discrepancies.push({
        itemId: item.id,
        productName: item.product.name,
        type: 'RATE_VARIANCE',
        message: `PO contracted rate was ${formatCurrency(poRate)}, but billed at ${formatCurrency(
          billed.billedRate
        )} (${((rateDiff / poRate) * 100).toFixed(1)}% variance)`,
      })
    }
  })

  const billedTotal = billedSubtotal + billedTax
  const hasDiscrepancy = discrepancies.length > 0

  const handleAlignBilledToAccepted = () => {
    setBilledItems((prev) => {
      const updated = { ...prev }
      purchase.items.forEach((item) => {
        updated[item.id] = {
          billedQty: item.receivedQuantity,
          billedRate: Number(item.unitCost),
        }
      })
      return updated
    })
    toast.success('Billed quantities aligned with physical accepted delivery')
  }

  const handleUpdateBilled = (
    itemId: string,
    field: 'billedQty' | 'billedRate',
    val: number
  ) => {
    setBilledItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: val,
      },
    }))
  }

  const handlePostInvoice = async () => {
    if (!invoiceNumber.trim()) {
      toast.error('Supplier invoice number is required')
      return
    }

    setSubmitting(true)
    try {
      const itemsPayload = purchase.items.map((item) => {
        const billed = billedItems[item.id] || {
          billedQty: item.receivedQuantity,
          billedRate: Number(item.unitCost),
        }
        return {
          purchaseItemId: item.id,
          billedQuantity: billed.billedQty,
          billedRate: billed.billedRate,
          billedAmount: billed.billedQty * billed.billedRate,
        }
      })

      const res = await fetch(`/api/purchases/${purchase.id}/invoice-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierInvoiceNumber: invoiceNumber.trim(),
          supplierInvoiceDate: new Date(invoiceDate).toISOString(),
          billedSubtotal,
          billedTaxAmount: billedTax,
          billedTotalAmount: billedTotal,
          tolerancePercent: parseFloat(tolerancePercent) || 1,
          items: itemsPayload,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success(
          `Supplier bill matched and posted to Accounts Payable! (Ledger Ref: ${json.data.supplierLedgerEntryId})`
        )
        onOpenChange(false)
        onSuccess?.()
      } else {
        toast.error(json.error?.message || 'Invoice posting failed')
      }
    } catch {
      toast.error('Invoice posting failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Scale className="h-5 w-5 text-purple-600" />
                Three-Way Invoice Matching & Accounts Payable Posting
              </DialogTitle>
              <DialogDescription>
                Cross-matches PO (ordered) vs GRN (accepted) vs Supplier Bill (invoiced) before creating financial liabilities.
              </DialogDescription>
            </div>
            <Badge
              variant={hasDiscrepancy ? 'warning' : 'success'}
              className="mr-6 px-2.5 py-1 text-xs"
            >
              {hasDiscrepancy ? 'Discrepancy Flagged' : '100% 3-Way Matched'}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Header Metadata */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
            <div>
              <span className="text-muted-foreground">PO Reference:</span>
              <div className="font-mono font-semibold text-foreground">
                {purchase.purchaseNumber}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Supplier Distributor:</span>
              <div className="font-semibold text-foreground">
                {purchase.supplier?.name || 'Unknown'}
              </div>
              <div className="text-[10px] text-muted-foreground">
                GSTIN: {purchase.supplier?.gstin || 'Unregistered'} &middot; Terms:{' '}
                {purchase.supplier?.creditDays || 30} Days
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Order Date:</span>
              <div className="text-foreground">{formatDate(purchase.purchaseDate)}</div>
            </div>
          </div>

          {/* Invoice Header Inputs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Supplier Bill / Invoice # *</Label>
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-98421"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Invoice Date *</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Price Variance Tolerance %</Label>
              <Input
                type="number"
                step="0.1"
                value={tolerancePercent}
                onChange={(e) => setTolerancePercent(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Discrepancy Warnings */}
          {hasDiscrepancy && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span>3-Way Verification Variances Detected ({discrepancies.length})</span>
              </div>
              <ul className="list-disc pl-5 text-xs space-y-1 text-amber-800 dark:text-amber-300">
                {discrepancies.map((d, i) => (
                  <li key={i}>
                    <span className="font-semibold">{d.productName}:</span> {d.message}
                  </li>
                ))}
              </ul>
              <div className="text-[11px] text-amber-700/80 dark:text-amber-400/80 pt-1">
                Posting with variances will record the actual billed liability in Accounts Payable, routing the discrepancy to the audit trail.
              </div>
            </div>
          )}

          {/* 3-Way Line Item Match Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-purple-600" />
              Contracted vs Accepted vs Billed Comparison
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs border-purple-500/30 text-purple-600 hover:bg-purple-500/10 gap-1"
              onClick={handleAlignBilledToAccepted}
            >
              <CheckCircle2 className="h-3 w-3" />
              Auto-Align Billed Qty to Accepted Delivery
            </Button>
          </div>

          {/* 3-Way Line Item Match Table */}
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-xs">
                  <TableHead>Medicine</TableHead>
                  <TableHead className="text-right">PO Ordered</TableHead>
                  <TableHead className="text-right">GRN Accepted</TableHead>
                  <TableHead className="text-right font-bold text-foreground">
                    Billed Qty
                  </TableHead>
                  <TableHead className="text-right">PO Rate</TableHead>
                  <TableHead className="text-right font-bold text-foreground">
                    Billed Rate
                  </TableHead>
                  <TableHead className="text-right">Tax %</TableHead>
                  <TableHead className="text-right">Billed Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchase.items.map((item) => {
                  const billed = billedItems[item.id] || {
                    billedQty: item.receivedQuantity || item.orderedQuantity,
                    billedRate: Number(item.unitCost),
                  }
                  const qtyMismatch =
                    item.receivedQuantity > 0 && billed.billedQty !== item.receivedQuantity
                  const rateMismatch =
                    Math.abs(billed.billedRate - Number(item.unitCost)) / Number(item.unitCost) >
                    tolerance

                  return (
                    <TableRow key={item.id} className="text-xs">
                      <TableCell>
                        <div className="font-semibold text-foreground">{item.product.name}</div>
                        <div className="text-[10px] text-muted-foreground">{item.product.sku}</div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {item.orderedQuantity}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {item.receivedQuantity || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={billed.billedQty}
                          onChange={(e) =>
                            handleUpdateBilled(
                              item.id,
                              'billedQty',
                              parseInt(e.target.value, 10) || 0
                            )
                          }
                          className={`h-7 w-20 text-right text-xs font-mono font-bold ${
                            qtyMismatch ? 'border-amber-500 bg-amber-500/10' : ''
                          }`}
                        />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(item.unitCost)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={billed.billedRate}
                          onChange={(e) =>
                            handleUpdateBilled(
                              item.id,
                              'billedRate',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className={`h-7 w-24 text-right text-xs font-mono font-bold ${
                            rateMismatch ? 'border-amber-500 bg-amber-500/10' : ''
                          }`}
                        />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {item.taxPercent || 12}%
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {formatCurrency(billed.billedQty * billed.billedRate)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Financial Summary */}
          <div className="flex justify-end">
            <div className="w-72 space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxable Value:</span>
                <span className="font-mono">{formatCurrency(billedSubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST Tax Amount:</span>
                <span className="font-mono">{formatCurrency(billedTax)}</span>
              </div>
              <div className="border-t border-border/60 pt-1.5 flex justify-between text-sm font-bold">
                <span>Total Invoice Liability:</span>
                <span className="font-mono text-purple-600 dark:text-purple-400">
                  {formatCurrency(billedTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handlePostInvoice()}
            disabled={submitting || !invoiceNumber}
            className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
          >
            <Receipt className="h-4 w-4" />
            {submitting ? 'Posting…' : 'Approve & Post to Accounts Payable'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
