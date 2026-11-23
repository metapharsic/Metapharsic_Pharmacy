'use client'

import { formatRack } from '@/lib/utils/rack'

import {
  AlertTriangle,
  Calendar,
  DollarSign,
  Layers,
  MapPin,
  Package,
  Pencil,
  ShieldAlert,
  Tag,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
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
import { Separator } from '@/components/ui/separator'
import { ROUTES } from '@/lib/constants/routes'
import { formatCurrency } from '@/lib/utils/currency'
import { useI18n } from '@/lib/i18n/i18n-context'

export interface ProductDetailBatch {
  id: string
  batchNumber: string
  expiryDate: string
  manufacturingDate?: string | null
  purchasePrice: number | string
  mrp: number | string
  quantity: number
  reservedQuantity: number
  soldQuantity: number
  status: string
}

export interface ProductDetailData {
  id: string
  name: string
  genericName?: string | null
  sku: string
  barcode?: string | null
  manufacturer?: string | null
  rack?: string | null
  composition?: string | null
  unitOfMeasure: string
  tabsPerStrip?: number | null
  packSize?: string | null
  drugSchedule: string
  isPrescriptionRequired: boolean
  isActive: boolean
  mrp: number | string
  ptr?: number | string | null
  costPrice?: number | string | null
  gstRate?: number | string
  minStockLevel?: number
  reorderLevel?: number
  categories?: { category: { id: string; name: string } }[]
  batches?: ProductDetailBatch[]
}

interface ProductDetailModalProps {
  productId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canEdit?: boolean
}

export function ProductDetailModal({
  productId,
  open,
  onOpenChange,
  canEdit = true,
}: ProductDetailModalProps) {
  const router = useRouter()
  const { territory } = useI18n()
  const [product, setProduct] = useState<ProductDetailData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !productId) {
      setProduct(null)
      return
    }

    setLoading(true)
    fetch(`/api/products/${productId}`)
      .then((r) => r.json())
      .then((json: { success: boolean; data?: ProductDetailData }) => {
        if (json.success && json.data) {
          setProduct(json.data)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, productId])

  if (!open) return null

  const cost = Number(product?.costPrice ?? 0)
  const mrp = Number(product?.mrp ?? 0)
  const margin = mrp > 0 && cost > 0 ? (((mrp - cost) / mrp) * 100).toFixed(1) : null

  const now = new Date().getTime()
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {loading || !product ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-5 w-5 animate-pulse" />
              <span>Loading product details…</span>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-xl font-bold">{product.name}</DialogTitle>
                <Badge variant={product.isActive ? 'success' : 'destructive'} className="text-xs">
                  {product.isActive ? 'Active' : 'Inactive'}
                </Badge>
                {product.isPrescriptionRequired ? (
                  <Badge variant="warning" className="text-xs">
                    Rx Required
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    OTC
                  </Badge>
                )}
                {product.drugSchedule && product.drugSchedule !== 'NONE' && (
                  <Badge variant="destructive" className="text-xs">
                    Schedule {product.drugSchedule}
                  </Badge>
                )}
              </div>
              {product.genericName && (
                <DialogDescription className="text-sm font-medium text-muted-foreground">
                  {product.genericName}
                </DialogDescription>
              )}
            </DialogHeader>

            {/* ─── Product Overview & Location ─── */}
            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-4">
              <div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Tag className="h-3 w-3" /> SKU
                </span>
                <span className="font-mono text-xs font-semibold">{product.sku}</span>
              </div>
              <div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> Rack Location
                </span>
                <span className="text-xs font-semibold text-primary">
                  {product.rack ? `Rack ${formatRack(product.rack)}` : 'Not assigned'}
                </span>
              </div>
              <div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Package className="h-3 w-3" /> Manufacturer
                </span>
                <span className="truncate text-xs font-semibold">
                  {product.manufacturer || 'Generic'}
                </span>
              </div>
              <div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Layers className="h-3 w-3" /> Unit of Measure
                </span>
                <span className="text-xs font-semibold">{product.unitOfMeasure} {Boolean(product.tabsPerStrip && product.tabsPerStrip > 1) && `(${product.tabsPerStrip} Tabs/Strip)`}</span>
              </div>
            </div>

            {/* ─── Financials & Margins ─── */}
            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5" /> Pricing & Margins
                </span>
                {margin && (
                  <Badge variant="outline" className="text-xs font-semibold text-emerald-600">
                    {margin}% Gross Margin
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-4">
                <div className="rounded bg-muted/40 p-2">
                  <div className="text-[11px] text-muted-foreground">Cost Price</div>
                  <div className="text-sm font-bold">{formatCurrency(cost)}</div>
                </div>
                <div className="rounded bg-muted/40 p-2">
                  <div className="text-[11px] text-muted-foreground">PTR</div>
                  <div className="text-sm font-bold">
                    {product.ptr ? formatCurrency(Number(product.ptr)) : '—'}
                  </div>
                </div>
                <div className="rounded bg-muted/40 p-2">
                  <div className="text-[11px] text-muted-foreground">MRP</div>
                  <div className="text-sm font-bold text-primary">{formatCurrency(mrp)}</div>
                </div>
                {Boolean(product.tabsPerStrip && product.tabsPerStrip > 1) && (
                  <div className="rounded bg-emerald-500/10 border border-emerald-500/20 p-2">
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">⚡ Loose Tab MRP</div>
                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(mrp / (product.tabsPerStrip ?? 1))}</div>
                  </div>
                )}
                <div className="rounded bg-muted/40 p-2">
                  <div className="text-[11px] text-muted-foreground">{territory === 'IN' ? 'GST Rate' : 'VAT Rate'}</div>
                  <div className="text-sm font-bold">{product.gstRate ?? (territory === 'IN' ? 12 : 0)}%</div>
                </div>
              </div>
            </div>

            <Separator />

            {/* ─── Batches List ─── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">
                    Active Batches ({product.batches?.length ?? 0})
                  </h3>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Sorted by FEFO (earliest expiry first)
                </span>
              </div>

              {!product.batches || product.batches.length === 0 ? (
                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                  No batches currently registered for this product
                </div>
              ) : (
                <div className="space-y-2">
                  {product.batches.map((b) => {
                    const exp = new Date(b.expiryDate)
                    const expTime = exp.getTime()
                    const isExpired = expTime < now
                    const isNear = !isExpired && expTime - now <= ninetyDaysMs
                    const available = b.quantity - (b.reservedQuantity ?? 0) - (b.soldQuantity ?? 0)

                    // Format date like "Mar 2027"
                    const expFormatted = exp.toLocaleDateString('en-IN', {
                      month: 'short',
                      year: 'numeric',
                    })

                    return (
                      <div
                        key={b.id}
                        className={`flex flex-col justify-between gap-2 rounded-lg border p-3 sm:flex-row sm:items-center ${
                          isExpired
                            ? 'border-red-200 bg-red-50/40 dark:border-red-950 dark:bg-red-950/20'
                            : isNear
                              ? 'border-amber-200 bg-amber-50/40 dark:border-amber-950 dark:bg-amber-950/20'
                              : 'bg-card'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold">{b.batchNumber}</span>
                            <span className="text-xs text-muted-foreground">|</span>
                            <span className="text-xs font-medium">Exp: {expFormatted}</span>
                            {isExpired && (
                              <Badge variant="destructive" className="gap-1 text-[10px]">
                                <ShieldAlert className="h-3 w-3" /> Expired
                              </Badge>
                            )}
                            {isNear && (
                              <Badge variant="warning" className="gap-1 text-[10px]">
                                <AlertTriangle className="h-3 w-3" /> Near Expiry ⚠️
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Cost: {formatCurrency(Number(b.purchasePrice))} &bull; MRP:{' '}
                            {formatCurrency(Number(b.mrp))} {Boolean(product.tabsPerStrip && product.tabsPerStrip > 1) && `• Loose: ${formatCurrency(Number(b.mrp) / (product.tabsPerStrip ?? 1))}/tab`}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xs font-semibold">
                              Qty:{' '}
                              <span className="text-sm font-bold text-foreground">
                                {Math.max(0, available)}
                              </span>
                              <span className="text-muted-foreground"> / {b.quantity}</span>
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {b.status}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 gap-1.5 mr-auto"
                onClick={() => router.push('/pos')}
              >
                ⚡ Sell at POS
              </Button>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    router.push(ROUTES.PRODUCT_EDIT(product.id))
                  }}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit Product
                </Button>
              )}
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
