'use client'

import { formatRack } from '@/lib/utils/rack'

// ─────────────────────────────────────────────────────────────
// Component — ProductBatchDialog
// Interactive batch stock breakdown flyout — displays active
// lots, expiry countdown, quarantine state, and prices.
// ─────────────────────────────────────────────────────────────
import { Package, Calendar, Clock, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ProductRow, ProductBatchSummary } from '@/components/products/product-table'

interface ProductBatchDialogProps {
  product: ProductRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function getDaysRemaining(expiryDate: string | Date): { days: number; isExpired: boolean; isNearExpiry: boolean } {
  const now = new Date()
  const exp = new Date(expiryDate)
  const diffTime = exp.getTime() - now.getTime()
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return {
    days,
    isExpired: days <= 0,
    isNearExpiry: days > 0 && days <= 90,
  }
}

export function ProductBatchDialog({ product, open, onOpenChange }: ProductBatchDialogProps) {
  if (!product) return null

  const batches = product.batches ?? []
  const totalStock = product.totalStock ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 mr-6">
            <div>
              <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                {product.name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                SKU: <span className="font-mono text-foreground font-medium">{product.sku}</span>
                {product.manufacturer && ` • ${product.manufacturer}`}
                {product.rack && ` • Rack ${formatRack(product.rack)}`}
              </p>
            </div>
            <Badge
              variant="outline"
              className={
                totalStock > 0
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs font-mono px-2 py-0.5'
                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 text-xs font-mono px-2 py-0.5'
              }
            >
              Total: {totalStock} strips {Boolean(product.tabsPerStrip && product.tabsPerStrip > 1) && `(${totalStock * (product.tabsPerStrip ?? 1)} tabs)`}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {batches.length === 0 ? (
            <div className="flex h-36 flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted text-center p-4">
              <Package className="h-7 w-7 text-muted-foreground/60 mb-1" />
              <p className="text-xs font-medium text-foreground">No Active Batches In Stock</p>
              <p className="text-[11px] text-muted-foreground">
                All inventory batches for this formulation are depleted, expired, or pending Goods Receipt.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border/70 overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-medium">
                    <th className="py-2 px-3 font-semibold">Batch No</th>
                    <th className="py-2 px-3 font-semibold">Expiry Date</th>
                    <th className="py-2 px-3 font-semibold text-right">Available Qty</th>
                    <th className="py-2 px-3 font-semibold text-right">Batch MRP</th>
                    <th className="py-2 px-3 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {batches.map((b) => {
                    const { days, isExpired, isNearExpiry } = getDaysRemaining(b.expiryDate)
                    const d = new Date(b.expiryDate)
                    const expFormatted = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`

                    return (
                      <tr key={b.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-medium text-foreground">
                          {b.batchNumber}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs">{expFormatted}</span>
                            {isExpired ? (
                              <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 text-[9px] py-0 px-1 font-sans">
                                Expired
                              </Badge>
                            ) : isNearExpiry ? (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[9px] py-0 px-1 font-sans gap-0.5">
                                <AlertTriangle className="h-2 w-2" />
                                {days}d left
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[9px] py-0 px-1 font-sans">
                                {days}d left
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground">
                          {b.availableQuantity}
                          <span className="text-[10px] text-muted-foreground font-normal ml-1">
                            / {b.quantity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-foreground font-medium">
                          ₹{b.mrp}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {b.availableQuantity > 0 ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] py-0 gap-0.5">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30 text-[10px] py-0">
                              Depleted
                            </Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-muted/20 p-2.5 rounded-lg border border-border/40">
            <span>
              Prescription Rule:{' '}
              <span className="font-semibold text-foreground">
                {product.isPrescriptionRequired ? 'Rx Required' : 'Over the Counter (OTC)'}
              </span>
            </span>
            <span>
              Drug Schedule:{' '}
              <span className="font-semibold text-foreground">
                {product.drugSchedule === 'NONE' ? 'Standard' : `Schedule ${product.drugSchedule}`}
              </span>
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
