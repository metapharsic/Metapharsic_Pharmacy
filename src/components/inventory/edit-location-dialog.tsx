'use client'

import { MapPin, Package } from 'lucide-react'
import { useEffect, useState } from 'react'

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
import { useToast } from '@/lib/hooks/use-toast'

interface EditLocationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: {
    id: string
    name: string
    sku: string
    rack?: string | null
    shelf?: string | null
    box?: string | null
  } | null
  onSaved: () => void
}

export function EditLocationDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: EditLocationDialogProps) {
  const toast = useToast()
  const [rack, setRack] = useState('')
  const [shelf, setShelf] = useState('')
  const [box, setBox] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (product && open) {
      setRack(product.rack || '')
      setShelf(product.shelf || '')
      setBox(product.box || '')
    }
  }, [product, open])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product) return

    setSaving(true)
    try {
      const res = await fetch('/api/inventory/locations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          rack: rack.trim() || null,
          shelf: shelf.trim() || null,
          box: box.trim() || null,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success(
          'Storage Location Updated',
          `${product.name} relocated to ${rack || 'Unassigned'} > ${shelf || 'Shelf'} > ${box || 'Box'}`
        )
        onSaved()
        onOpenChange(false)
      } else {
        toast.error(json.error?.message || 'Failed to update location')
      }
    } catch {
      toast.error('Network error saving location')
    } finally {
      setSaving(false)
    }
  }

  if (!product) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <MapPin className="h-4 w-4 text-primary" />
            <span>Assign Storage Location</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Organize medicine by Rack, Shelf tier, and Box/Bin so pharmacists find items instantly.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/30 p-2.5 text-xs space-y-0.5">
            <span className="font-semibold text-foreground block">{product.name}</span>
            <span className="font-mono text-muted-foreground">SKU: {product.sku}</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="loc-rack" className="text-xs font-semibold">
                Rack / Cabinet
              </Label>
              <Input
                id="loc-rack"
                value={rack}
                onChange={(e) => setRack(e.target.value)}
                placeholder="e.g. RACK-A"
                className="h-8 text-xs font-mono uppercase"
              />
              <p className="text-[10px] text-muted-foreground">e.g. RACK-A, RACK-B</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="loc-shelf" className="text-xs font-semibold">
                Shelf Tier
              </Label>
              <Input
                id="loc-shelf"
                value={shelf}
                onChange={(e) => setShelf(e.target.value)}
                placeholder="e.g. Shelf 2"
                className="h-8 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">e.g. Shelf 1, 2, 3</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="loc-box" className="text-xs font-semibold">
                Box / Bin / Tray
              </Label>
              <Input
                id="loc-box"
                value={box}
                onChange={(e) => setBox(e.target.value)}
                placeholder="e.g. Box 04"
                className="h-8 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">e.g. Box 01, Bin 4</p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="text-xs gap-1.5">
              <Package className="h-3.5 w-3.5" />
              <span>{saving ? 'Saving...' : 'Save Storage Location'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
