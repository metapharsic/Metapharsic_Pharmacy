'use client'

// ─────────────────────────────────────────────────────────────
// Component — ProductRateHistoryDialog
// Batch Rate History, PTS/PTR, and Gross Profit Margin Explorer
// ─────────────────────────────────────────────────────────────
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, DollarSign, Layers, Percent, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ProductRow } from '@/components/products/product-table'
import type { ProductRateHistoryReport } from '@/lib/products/product-analytics-service'
import { formatCurrency } from '@/lib/utils/currency'
import { useI18n } from '@/lib/i18n/i18n-context'

interface ProductRateHistoryDialogProps {
  product: ProductRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProductRateHistoryDialog({ product, open, onOpenChange }: ProductRateHistoryDialogProps) {
  const { territoryDef } = useI18n()
  const [data, setData] = useState<ProductRateHistoryReport | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && product?.id) {
      setLoading(true)
      fetch(`/api/products/${product.id}/rate-history`)
        .then((r) => r.json())
        .then((json: { success: boolean; data?: ProductRateHistoryReport }) => {
          if (json.success && json.data) {
            setData(json.data)
          } else {
            setData(null)
          }
        })
        .catch(() => setData(null))
        .finally(() => setLoading(false))
    }
  }, [open, product?.id])

  if (!product) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 mr-6">
            <div>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Rate History & Margin Profitability
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                <strong className="text-foreground">{product.name}</strong> • SKU: {product.sku}
                {product.manufacturer && ` • ${product.manufacturer}`}
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              GST {product.gstRate ?? 12}%
            </Badge>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            Loading batch rate history from PostgreSQL...
          </div>
        ) : !data ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No historical batches found for this product.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Financial KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-card border rounded-lg p-2.5">
                <span className="text-[11px] text-muted-foreground block">Retail MRP</span>
                <span className="text-sm font-bold font-mono text-foreground">
                  {formatCurrency(data.currentMrp)}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">Catalog standard</span>
              </div>

              <div className="bg-card border rounded-lg p-2.5">
                <span className="text-[11px] text-muted-foreground block">Avg Purchase Cost</span>
                <span className="text-sm font-bold font-mono text-foreground">
                  {formatCurrency(data.averageCostPrice)}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Across {data.batches.length} batch(es)
                </span>
              </div>

              <div className="bg-card border rounded-lg p-2.5">
                <span className="text-[11px] text-muted-foreground block">Blended Margin</span>
                <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {data.averageMarginPercent}%
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">Gross profit spread</span>
              </div>

              <div className="bg-card border rounded-lg p-2.5">
                <span className="text-[11px] text-muted-foreground block">Rate Fluctuation</span>
                <span className="text-sm font-bold font-mono text-foreground flex items-center gap-1">
                  {data.priceVariationPercent}%
                  {data.priceVariationPercent > 10 ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">Min/Max variation</span>
              </div>
            </div>

            {/* Batch Breakdown Table */}
            <div className="border rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-muted/50 border-b text-[11px] text-muted-foreground">
                  <tr>
                    <th className="p-2.5 font-medium">Batch / Lot</th>
                    <th className="p-2.5 font-medium">Receipt Date</th>
                    <th className="p-2.5 font-medium">Expiry</th>
                    <th className="p-2.5 font-medium text-right">Cost Price ({territoryDef.currency.code})</th>
                    <th className="p-2.5 font-medium text-right">MRP ({territoryDef.currency.code})</th>
                    <th className="p-2.5 font-medium text-right">Margin %</th>
                    <th className="p-2.5 font-medium text-right">Avail / Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.batches.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/20">
                      <td className="p-2.5 font-mono font-medium text-foreground">
                        {b.batchNumber}
                        <Badge
                          variant="outline"
                          className="ml-1.5 text-[9px] py-0 px-1 border-muted-foreground/30"
                        >
                          {b.status}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-muted-foreground">
                        {new Date(b.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="p-2.5 text-muted-foreground">
                        {new Date(b.expiryDate).toLocaleDateString('en-IN', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="p-2.5 font-mono text-right text-foreground">
                        {formatCurrency(b.purchasePrice)}
                      </td>
                      <td className="p-2.5 font-mono text-right text-foreground font-semibold">
                        {formatCurrency(b.mrp)}
                      </td>
                      <td className="p-2.5 font-mono text-right">
                        <span
                          className={`font-semibold ${
                            b.marginPercent >= 25
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : b.marginPercent >= 15
                              ? 'text-foreground'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {b.marginPercent}%
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-right text-muted-foreground">
                        <strong className="text-foreground">{b.availableQuantity}</strong> / {b.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
