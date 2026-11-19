'use client'

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Minus,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'

import { ReceiptInvoice, type ReceiptData } from '@/components/pos/receipt-invoice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/lib/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/currency'

import { editSaleAction } from '@/app/(dashboard)/sales/[id]/sale-actions'

export interface EditableSaleItem {
  id: string
  productId: string
  productName: string
  productSku: string
  quantity: number
  unitPrice: number | string | { toString(): string }
  discountPercent?: number | string | { toString(): string }
  taxPercent?: number | string | { toString(): string }
  totalAmount: number | string | { toString(): string }
  itemBatches?: Array<{
    batch?: {
      id?: string
      batchNumber?: string
      expiryDate?: string | Date
    }
  }>
}

interface EditSaleDialogProps {
  sale: Omit<ReceiptData, 'items'> & {
    items: EditableSaleItem[]
  }
}

export function EditSaleDialog({ sale }: EditSaleDialogProps) {
  const [open, setOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [reason, setReason] = useState('Medical staff mistakenly added 1 extra tablet')
  const [refundCash, setRefundCash] = useState(true)
  const [savedSale, setSavedSale] = useState<ReceiptData | null>(null)

  const router = useRouter()
  const toast = useToast()

  // Initialize editable state
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    sale.items.forEach((item) => {
      const id = item.id || ''
      initial[id] = item.quantity
    })
    return initial
  })

  // Reset when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      const initial: Record<string, number> = {}
      sale.items.forEach((item) => {
        const id = item.id || ''
        initial[id] = item.quantity
      })
      setQuantities(initial)
      setReason('Medical staff mistakenly added 1 extra tablet')
      setRefundCash(true)
    }
  }

  const updateQty = (itemId: string, newQty: number) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: Math.max(0, newQty),
    }))
  }

  // Calculate live preview totals
  const preview = useMemo(() => {
    let totalItems = 0
    let estimatedSubtotal = 0
    let estimatedTax = 0
    let estimatedTotal = 0
    let totalReturnedTablets = 0

    const itemPreviews = sale.items.map((item) => {
      const itemId = item.id || ''
      const originalQty = item.quantity
      const currentQty = quantities[itemId] ?? originalQty

      const unitPrice = Number(item.unitPrice)
      const discPercent = Number(item.discountPercent || 0)
      const taxPercent = Number(item.taxPercent || 0)

      const gross = currentQty * unitPrice
      const disc = (gross * discPercent) / 100
      const taxable = gross - disc
      const tax = (taxable * taxPercent) / 100
      const lineTotal = taxable + tax

      if (currentQty > 0) {
        totalItems += 1
        estimatedSubtotal += gross
        estimatedTax += tax
        estimatedTotal += lineTotal
      }

      if (currentQty < originalQty) {
        totalReturnedTablets += originalQty - currentQty
      }

      return {
        ...item,
        originalQty,
        currentQty,
        qtyDiff: originalQty - currentQty,
        lineTotal,
      }
    })

    const originalTotal = Number(sale.totalAmount)
    const refundAmount = Math.max(0, originalTotal - estimatedTotal)
    const hasChanges = itemPreviews.some((i) => i.qtyDiff !== 0)

    return {
      itemPreviews,
      totalItems,
      estimatedTotal: Math.round(estimatedTotal * 100) / 100,
      originalTotal,
      refundAmount: Math.round(refundAmount * 100) / 100,
      totalReturnedTablets,
      hasChanges,
    }
  }, [sale, quantities])

  const handleSave = async (autoPrint: boolean) => {
    if (!preview.hasChanges) {
      toast.info('No changes detected', 'Quantity values are the same as the original invoice.')
      return
    }

    if (preview.totalItems === 0) {
      toast.error(
        'Cannot remove all items',
        'At least one item must remain on the invoice. Use "Cancel Sale" if you need to void the entire bill.'
      )
      return
    }

    try {
      setIsSaving(true)

      const payloadItems = Object.entries(quantities).map(([saleItemId, quantity]) => ({
        saleItemId,
        quantity,
      }))

      const result = await editSaleAction({
        saleId: sale.id as string,
        items: payloadItems,
        reason: reason.trim() || 'Medical staff entered extra tablet by mistake',
        refundCashDifference: refundCash,
      })

      toast.success(
        'Invoice Corrected Successfully',
        preview.totalReturnedTablets > 0
          ? `${preview.totalReturnedTablets} tablet(s) returned to batch stock & inventory.`
          : 'Sale line items updated.'
      )

      setSavedSale(result)
      setOpen(false)

      if (autoPrint) {
        setPrintOpen(true)
      } else {
        router.refresh()
      }
    } catch (error) {
      toast.error(
        'Failed to correct sale',
        error instanceof Error ? error.message : 'An unexpected error occurred'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-amber-500/40 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 font-medium"
          >
            <Pencil className="h-4 w-4" />
            Edit / Correct Sale
          </Button>
        </DialogTrigger>

        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-amber-100 p-1.5 text-amber-700">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">
                  Edit Invoice {sale.invoiceNumber}
                </DialogTitle>
                <DialogDescription>
                  Admin Correction Mode — Fix billing mistakes (e.g. medical staff added an extra tablet).
                  Stock will be restored to inventory batches automatically.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Context Notice */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Quick Medical Billing Correction</p>
                <p className="text-amber-800 mt-0.5">
                  If 1 extra tablet was accidentally added during customer checkout, decrease its quantity below.
                  The extra tablet will immediately return to its batch and available stock.
                </p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="rounded-md border bg-card">
              <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground grid grid-cols-12 gap-2 items-center">
                <span className="col-span-5">Product & Batch</span>
                <span className="col-span-2 text-right">Price</span>
                <span className="col-span-3 text-center">Corrected Qty</span>
                <span className="col-span-2 text-right">Line Total</span>
              </div>

              <div className="divide-y text-sm">
                {preview.itemPreviews.map((item) => {
                  const itemId = item.id || ''
                  const batchInfo = item.itemBatches?.[0]?.batch
                  const isReduced = item.qtyDiff > 0
                  const isIncreased = item.qtyDiff < 0
                  const isRemoved = item.currentQty === 0

                  return (
                    <div
                      key={itemId}
                      className={`grid grid-cols-12 gap-2 items-center px-3 py-3 transition-colors ${
                        isRemoved
                          ? 'bg-destructive/5 opacity-60'
                          : isReduced
                            ? 'bg-emerald-50/40'
                            : ''
                      }`}
                    >
                      {/* Product Name & SKU */}
                      <div className="col-span-5 pr-2">
                        <p className="font-medium leading-tight">{item.productName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.productSku}
                          {batchInfo?.batchNumber && (
                            <span className="ml-1 text-xs font-mono text-muted-foreground/80">
                              · B:{batchInfo.batchNumber}
                            </span>
                          )}
                        </p>
                        {isReduced && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 mt-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Restoring {item.qtyDiff} tablet(s) to stock
                          </span>
                        )}
                        {isIncreased && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 mt-1">
                            Deducting {Math.abs(item.qtyDiff)} tablet(s) from stock
                          </span>
                        )}
                      </div>

                      {/* Price */}
                      <div className="col-span-2 text-right tabular-nums text-muted-foreground text-xs">
                        {formatCurrency(Number(item.unitPrice))}
                      </div>

                      {/* Quantity Stepper */}
                      <div className="col-span-3 flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 rounded-full border-muted-foreground/30 hover:bg-muted"
                          onClick={() => updateQty(itemId, item.currentQty - 1)}
                          disabled={item.currentQty <= 0}
                          title="Reduce quantity by 1"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>

                        <Input
                          type="number"
                          min={0}
                          value={item.currentQty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10)
                            updateQty(itemId, isNaN(val) ? 0 : val)
                          }}
                          className="h-7 w-12 text-center text-xs font-bold tabular-nums px-1"
                        />

                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 rounded-full border-muted-foreground/30 hover:bg-muted"
                          onClick={() => updateQty(itemId, item.currentQty + 1)}
                          title="Increase quantity by 1"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>

                        {item.currentQty > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => updateQty(itemId, 0)}
                            title="Remove item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>


                      {/* Line Total */}
                      <div className="col-span-2 text-right tabular-nums font-semibold">
                        {item.currentQty === 0 ? (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatCurrency(item.lineTotal)}
                          </span>
                        ) : (
                          formatCurrency(item.lineTotal)
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Financial Summary & Refund Card */}
            <div className="rounded-lg border bg-muted/20 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Original Invoice Total:</span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(preview.originalTotal)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Corrected Invoice Total:</span>
                <span className="font-bold text-base text-primary tabular-nums">
                  {formatCurrency(preview.estimatedTotal)}
                </span>
              </div>

              {preview.refundAmount > 0 && (
                <div className="flex items-center justify-between pt-2 border-t text-sm">
                  <div className="flex items-center gap-1.5 font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Difference / Refund to Customer:</span>
                  </div>
                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-2.5 py-0.5">
                    {formatCurrency(preview.refundAmount)}
                  </Badge>
                </div>
              )}
            </div>

            {/* Reason & Options */}
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Reason for Correction (Audit Log)
                </label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Medical staff mistakenly added 1 extra tablet"
                  className="text-xs"
                />
              </div>

              {preview.refundAmount > 0 && (
                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="refund-diff"
                    checked={refundCash}
                    onCheckedChange={(checked) => setRefundCash(Boolean(checked))}
                  />
                  <label
                    htmlFor="refund-diff"
                    className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Refund {formatCurrency(preview.refundAmount)} in Cash to customer immediately
                  </label>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleSave(false)}
                disabled={isSaving || !preview.hasChanges}
              >
                {isSaving ? 'Saving...' : 'Save Only'}
              </Button>

              <Button
                type="button"
                variant="default"
                size="sm"
                className="gap-1.5 bg-primary text-primary-foreground font-semibold shadow"
                onClick={() => handleSave(true)}
                disabled={isSaving || !preview.hasChanges}
              >
                <Printer className="h-4 w-4" />
                {isSaving ? 'Updating...' : 'Save & Print Bill'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Immediate Print Dialog on Save */}
      <Dialog
        open={printOpen}
        onOpenChange={(isOpen) => {
          setPrintOpen(isOpen)
          if (!isOpen) {
            router.refresh()
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              Print Corrected Invoice {savedSale?.invoiceNumber || sale.invoiceNumber}
            </DialogTitle>
            <DialogDescription>
              The invoice has been recalculated and extra stock has been restored to inventory.
            </DialogDescription>
          </DialogHeader>

          {savedSale && <ReceiptInvoice sale={savedSale} showPrintButton={true} />}
        </DialogContent>
      </Dialog>
    </>
  )
}
