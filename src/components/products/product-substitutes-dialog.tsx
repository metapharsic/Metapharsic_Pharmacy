'use client'

import { formatRack } from '@/lib/utils/rack'

// ─────────────────────────────────────────────────────────────
// Component — ProductSubstitutesDialog
// Generic salt substitute finder — suggests equivalent active
// pharmaceutical formulations with live stock on hand and price.
// ─────────────────────────────────────────────────────────────
import { ArrowRight, CheckCircle2, Clock, MapPin, Package, RefreshCw, Sparkles, XCircle } from 'lucide-react'
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
import type { SubstituteProduct } from '@/lib/products/product-service'

interface ProductSubstitutesDialogProps {
  product: ProductRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProductSubstitutesDialog({ product, open, onOpenChange }: ProductSubstitutesDialogProps) {
  const [substitutes, setSubstitutes] = useState<SubstituteProduct[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && product?.id) {
      setLoading(true)
      fetch(`/api/products/${product.id}/substitutes`)
        .then((r) => r.json())
        .then((json: { success: boolean; data?: SubstituteProduct[] }) => {
          if (json.success && json.data) {
            setSubstitutes(json.data)
          } else {
            setSubstitutes([])
          }
        })
        .catch(() => setSubstitutes([]))
        .finally(() => setLoading(false))
    }
  }, [open, product?.id])

  if (!product) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <DialogTitle className="text-base font-semibold text-foreground">
              Generic Substitutes Finder
            </DialogTitle>
          </div>
          <div className="bg-muted/30 p-2.5 rounded-lg border border-border/60 mt-2">
            <p className="text-xs text-muted-foreground">Prescribed Formulation:</p>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <div>
                <p className="text-sm font-semibold text-foreground">{product.name}</p>
                <p className="text-xs font-mono text-primary font-medium">
                  {product.genericName || 'No generic salt specified'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-mono font-bold text-foreground">₹{product.mrp}</p>
                <p className="text-[10px] text-muted-foreground">{product.totalStock ?? 0} in stock</p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground tracking-wide uppercase">
              Equivalent Therapeutic Formulations ({substitutes.length})
            </h4>
            {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />}
          </div>

          {loading ? (
            <div className="flex h-36 flex-col items-center justify-center gap-2 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <p className="text-xs">Scanning active formulations in dispensary…</p>
            </div>
          ) : substitutes.length === 0 ? (
            <div className="flex h-36 flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted text-center p-4">
              <Package className="h-7 w-7 text-muted-foreground/60 mb-1" />
              <p className="text-xs font-medium text-foreground">No Direct Substitutes Available</p>
              <p className="text-[11px] text-muted-foreground">
                No other products currently match generic salt &quot;{product.genericName}&quot;.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {substitutes.map((sub) => {
                const priceDiff = Number(sub.mrp) - Number(product.mrp)
                const isCheaper = priceDiff < 0

                return (
                  <div
                    key={sub.id}
                    className="p-3 rounded-lg border border-border/70 bg-card hover:bg-muted/20 transition-colors flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-foreground truncate">
                          {sub.name}
                        </span>
                        {sub.matchReason && (
                          <Badge variant="outline" className="text-[10px] font-normal py-0 bg-primary/5 text-primary border-primary/20">
                            {sub.matchReason}
                          </Badge>
                        )}
                        {sub.manufacturer && (
                          <Badge variant="outline" className="text-[10px] font-normal py-0">
                            {sub.manufacturer}
                          </Badge>
                        )}
                        {sub.rack && (
                          <Badge variant="secondary" className="text-[10px] font-mono py-0 gap-0.5">
                            <MapPin className="h-2.5 w-2.5" />
                            {formatRack(sub.rack)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        SKU: {sub.sku} • {sub.unitOfMeasure}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center justify-end gap-1 font-mono text-xs font-bold text-foreground">
                        <span>₹{sub.mrp}</span>
                        {isCheaper && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                            (-₹{Math.abs(priceDiff).toFixed(2)})
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5">
                        {sub.totalStock > 0 ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] py-0 font-mono">
                            {sub.totalStock} in stock
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[10px] py-0 font-mono">
                            Out of stock
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
