'use client'

import { formatRack, formatShelf } from '@/lib/utils/rack'

import {
  Boxes,
  Check,
  CheckCircle2,
  CornerDownRight,
  Loader2,
  Package,
  Plus,
  Search,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/lib/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/currency'

interface AssignMedicineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetLocation: {
    rack: string
    shelf: string
    box: string
  } | null
  onAssigned: () => void
}

interface ProductSearchResult {
  id: string
  name: string
  sku: string
  barcode?: string | null
  mrp: number
  rack?: string | null
  shelf?: string | null
  box?: string | null
  inventory?: { availableQuantity: number }[]
}

export function AssignMedicineDialog({
  open,
  onOpenChange,
  targetLocation,
  onAssigned,
}: AssignMedicineDialogProps) {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [products, setProducts] = useState<ProductSearchResult[]>([])

  // Search products when user types
  useEffect(() => {
    if (!open) {
      setSearch('')
      setProducts([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (search.trim()) {
          params.set('search', search.trim())
        }
        params.set('limit', '25')

        const res = await fetch(`/api/products?${params.toString()}`)
        const json = await res.json()
        if (json.success && json.data) {
          const list = Array.isArray(json.data) ? json.data : json.data.products || []
          setProducts(list)
        }
      } catch {
        // silent search error
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [search, open])

  const handleAssign = async (product: ProductSearchResult) => {
    if (!targetLocation) return
    setAssigningId(product.id)

    try {
      const res = await fetch('/api/inventory/locations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          rack: targetLocation.rack,
          shelf: targetLocation.shelf,
          box: targetLocation.box,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success(`Assigned "${product.name}" to ${targetLocation.box}`)
        onAssigned()
        // Update local state to reflect new location immediately
        setProducts((prev) =>
          prev.map((p) =>
            p.id === product.id
              ? {
                  ...p,
                  rack: targetLocation.rack,
                  shelf: targetLocation.shelf,
                  box: targetLocation.box,
                }
              : p
          )
        )
      } else {
        toast.error(json.error?.message || 'Failed to assign medicine')
      }
    } catch {
      toast.error('Network error assigning medicine')
    } finally {
      setAssigningId(null)
    }
  }

  if (!targetLocation) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-primary" />
            <span>Assign Medicine to Box</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Target Destination:{' '}
            <strong className="text-foreground font-mono">
              {formatRack(targetLocation.rack)} &gt; {formatShelf(targetLocation.shelf)} &gt; {targetLocation.box}
            </strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medicine by name, SKU, or barcode…"
              className="pl-8 h-8 text-xs"
              autoFocus
            />
            {loading && (
              <Loader2 className="absolute right-2.5 top-2.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Product Results List */}
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {products.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-muted-foreground space-y-1">
                <Boxes className="h-6 w-6 mx-auto opacity-50" />
                <p className="text-xs font-medium">No medicines found</p>
                <p className="text-[11px]">Type a medicine name or SKU to search store inventory</p>
              </div>
            ) : (
              products.map((p) => {
                const stock =
                  p.inventory?.reduce((acc, i) => acc + (i.availableQuantity || 0), 0) ?? 0
                const isCurrentBox =
                  p.rack === targetLocation.rack &&
                  p.shelf === targetLocation.shelf &&
                  p.box === targetLocation.box

                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-2.5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-xs">{p.name}</span>
                        {isCurrentBox && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          >
                            In this Box
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                        <span>SKU: {p.sku}</span>
                        <span>· MRP: {formatCurrency(p.mrp)}</span>
                        <span>· Stock: {stock} units</span>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 font-mono">
                        <CornerDownRight className="h-2.5 w-2.5" />
                        <span>
                          Current Location:{' '}
                          {p.rack ? (
                            <strong className="text-foreground">
                              {formatRack(p.rack)} &gt; {formatShelf(p.shelf) || 'No Shelf'} &gt; {p.box || 'No Box'}
                            </strong>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              Unassigned
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div>
                      {isCurrentBox ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled
                          className="h-7 text-xs text-muted-foreground gap-1"
                        >
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>Placed</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => void handleAssign(p)}
                          disabled={assigningId === p.id}
                          className="h-7 text-xs gap-1 bg-primary text-primary-foreground font-medium"
                        >
                          {assigningId === p.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Plus className="h-3 w-3" />
                          )}
                          <span>Assign</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
