'use client'

// ─────────────────────────────────────────────────────────────
// Component — MovementActionDialogs
// Enterprise modals for Pharmacy Stock Movements:
// 1. RelocateBoxDialog: Move medicine between Rack, Shelf, and Box
// 2. VendorReturnDialog: Return damaged/near-expiry stock to Supplier
// 3. DeadStockClearanceDialog: Dispose or liquidate dead/slow-moving stock
// ─────────────────────────────────────────────────────────────
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Layers,
  MapPin,
  RotateCcw,
  TrendingDown,
  Truck,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/lib/hooks/use-toast'

// ─── 1. RELOCATE BOX / STORAGE TRANSFER DIALOG ───────────────

interface RelocateBoxDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId?: string
  initialProduct?: {
    id: string
    name: string
    sku: string
    rack?: string | null
    shelf?: string | null
    box?: string | null
  } | null
  onSuccess: () => void
}

export function RelocateBoxDialog({
  open,
  onOpenChange,
  branchId,
  initialProduct,
  onSuccess,
}: RelocateBoxDialogProps) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [products, setProducts] = useState<any[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProduct?.id || '')
  const [toRack, setToRack] = useState('')
  const [toShelf, setToShelf] = useState('')
  const [toBox, setToBox] = useState('')
  const [reason, setReason] = useState('Physical storage reorganization')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (initialProduct?.id) {
      setSelectedProductId(initialProduct.id)
    }
  }, [initialProduct])

  useEffect(() => {
    if (open && products.length === 0) {
      fetch('/api/inventory?limit=50')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.data) {
            setProducts(d.data.map((item: any) => item.product || item))
          }
        })
        .catch(() => undefined)
    }
  }, [open, products.length])

  const currentProduct =
    initialProduct?.id === selectedProductId
      ? initialProduct
      : products.find((p) => p.id === selectedProductId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductId) {
      toast.error('Select a medicine to relocate')
      return
    }
    if (!toRack.trim() && !toBox.trim()) {
      toast.error('Provide at least a Target Rack or Box')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: branchId && branchId !== 'all' ? branchId : 'br-main',
          productId: selectedProductId,
          type: 'TRANSFER',
          quantity: 1, // Represents unit relocation
          referenceType: 'BOX_RELOCATION',
          fromRack: currentProduct?.rack || undefined,
          fromShelf: currentProduct?.shelf || undefined,
          fromBox: currentProduct?.box || undefined,
          toRack: toRack.trim().toUpperCase() || undefined,
          toShelf: toShelf.trim() || undefined,
          toBox: toBox.trim() || undefined,
          reason,
          notes: notes.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success(
          'Medicine Relocated Successfully',
          `${currentProduct?.name || 'Item'} moved to ${toRack || 'Rack'} > ${toBox || 'Box'}`
        )
        onOpenChange(false)
        onSuccess()
      } else {
        toast.error(data.error?.message || 'Failed to record relocation')
      }
    } catch {
      toast.error('Network error during relocation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base">Relocate Medicine / Box Transfer</DialogTitle>
              <DialogDescription className="text-xs">
                Move medicine across physical storage coordinates (Rack &gt; Shelf &gt; Box) with full audit trail.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Product selector if not pre-populated */}
          {!initialProduct && (
            <div className="space-y-1.5">
              <Label className="text-xs">Select Medicine</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Choose product..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Current Location Display */}
          <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Current Physical Location
            </span>
            <div className="mt-1 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <div className="text-xs font-medium text-foreground">
                <span className="font-bold">{currentProduct?.name || 'Selected Medicine'}</span>
                <p className="text-[11px] text-muted-foreground">
                  {currentProduct?.rack ? `Rack: ${currentProduct.rack}` : 'No Rack'} ·{' '}
                  {currentProduct?.shelf ? `Shelf: ${currentProduct.shelf}` : 'No Shelf'} ·{' '}
                  {currentProduct?.box ? `Box: ${currentProduct.box}` : 'No Box'}
                </p>
              </div>
            </div>
          </div>

          {/* Destination Target Location */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
              <Boxes className="h-3.5 w-3.5" />
              <span>Target Storage Coordinates</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Target Rack</Label>
                <Input
                  value={toRack}
                  onChange={(e) => setToRack(e.target.value)}
                  placeholder="e.g. RACK-B"
                  className="h-8 text-xs font-mono uppercase"
                  required
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Target Shelf</Label>
                <Input
                  value={toShelf}
                  onChange={(e) => setToShelf(e.target.value)}
                  placeholder="Shelf 2"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Target Box</Label>
                <Input
                  value={toBox}
                  onChange={(e) => setToBox(e.target.value)}
                  placeholder="Box 05"
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Reason for Relocation</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Physical storage reorganization" className="text-xs">
                  Physical storage reorganization
                </SelectItem>
                <SelectItem value="Fast-moving frontline allocation" className="text-xs">
                  Fast-moving frontline allocation
                </SelectItem>
                <SelectItem value="Cold storage temperature relocation" className="text-xs">
                  Cold storage temperature relocation
                </SelectItem>
                <SelectItem value="Box capacity overflow" className="text-xs">
                  Box capacity overflow
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Additional Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Moved 5 strips to Front Display Box"
              className="h-8 text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="gap-1.5 text-xs bg-sky-600 hover:bg-sky-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{submitting ? 'Relocating...' : 'Commit Relocation'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── 2. VENDOR RETURN (RTV) DIALOG ───────────────────────────

interface VendorReturnDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId?: string
  initialRow?: any | null
  onSuccess: () => void
}

export function VendorReturnDialog({
  open,
  onOpenChange,
  branchId,
  initialRow,
  onSuccess,
}: VendorReturnDialogProps) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [quantity, setQuantity] = useState('10')
  const [reason, setReason] = useState('Near expiry return agreement')
  const [notes, setNotes] = useState('')

  const prodName = initialRow?.inventory?.product?.name || 'Medicine'
  const batchNumber = initialRow?.batch?.batchNumber || 'Batch'
  const supplierName = initialRow?.supplierName || initialRow?.batch?.supplier?.name || 'Distributor'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const qty = parseInt(quantity, 10)
    if (isNaN(qty) || qty <= 0) {
      toast.error('Enter a valid return quantity')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: branchId && branchId !== 'all' ? branchId : initialRow?.inventory?.branch?.id || 'br-main',
          productId: initialRow.inventory.productId,
          batchId: initialRow.batchId || undefined,
          type: 'RETURN_OUT',
          quantity: qty,
          referenceType: 'VENDOR_RETURN',
          referenceId: `RTV-${Date.now().toString().slice(-6)}`,
          reason,
          notes: notes.trim() ? `To: ${supplierName} — ${notes.trim()}` : `To: ${supplierName}`,
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success(
          'Supplier Return Recorded',
          `${qty} units of ${prodName} (Lot ${batchNumber}) returned to ${supplierName}`
        )
        onOpenChange(false)
        onSuccess()
      } else {
        toast.error(data.error?.message || 'Failed to process vendor return')
      }
    } catch {
      toast.error('Network error during vendor return')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Truck className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base">Supplier Return (RTV)</DialogTitle>
              <DialogDescription className="text-xs">
                Issue stock return to distributor for near-expiry, damaged, or recalled batches.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground">{prodName}</span>
              <Badge variant="outline" className="text-[10px] font-mono">
                Lot: {batchNumber}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Truck className="h-3 w-3 text-sky-500" />
              <span>Supplier: {supplierName}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Return Units</Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-8 text-xs font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Return Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Near expiry return agreement" className="text-xs">
                    Near expiry agreement
                  </SelectItem>
                  <SelectItem value="Damaged packaging / seal broken" className="text-xs">
                    Damaged packaging
                  </SelectItem>
                  <SelectItem value="Manufacturer recall" className="text-xs">
                    Manufacturer recall
                  </SelectItem>
                  <SelectItem value="Excess stock return" className="text-xs">
                    Excess stock return
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Supplier Credit Note / Reference</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Credit Memo #CR-8821 pending"
              className="h-8 text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{submitting ? 'Processing...' : 'Issue Vendor Return'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── 3. DEAD STOCK DISPOSAL / CLEARANCE DIALOG ───────────────

interface DeadStockClearanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId?: string
  initialRow?: any | null
  onSuccess: () => void
}

export function DeadStockClearanceDialog({
  open,
  onOpenChange,
  branchId,
  initialRow,
  onSuccess,
}: DeadStockClearanceDialogProps) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [quantity, setQuantity] = useState('5')
  const [clearanceType, setClearanceType] = useState<'WRITE_OFF' | 'TRANSFER'>('WRITE_OFF')
  const [reason, setReason] = useState('Zero movement > 90 days write-off')
  const [notes, setNotes] = useState('')

  const prodName = initialRow?.inventory?.product?.name || 'Dead Stock Medicine'
  const sku = initialRow?.inventory?.product?.sku || ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const qty = parseInt(quantity, 10)
    if (isNaN(qty) || qty <= 0) {
      toast.error('Enter valid quantity')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: branchId && branchId !== 'all' ? branchId : initialRow?.inventory?.branch?.id || 'br-main',
          productId: initialRow.inventory.productId,
          batchId: initialRow.batchId || undefined,
          type: clearanceType,
          quantity: qty,
          referenceType: 'DEAD_STOCK_CLEARANCE',
          referenceId: `DSC-${Date.now().toString().slice(-6)}`,
          toRack: clearanceType === 'TRANSFER' ? 'CLEARANCE' : undefined,
          toBox: clearanceType === 'TRANSFER' ? 'BIN-DISCOUNT' : undefined,
          reason,
          notes: notes.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success(
          'Dead Stock Clearance Recorded',
          `${qty} units of ${prodName} ${clearanceType === 'WRITE_OFF' ? 'written off' : 'transferred to Clearance Bin'}`
        )
        onOpenChange(false)
        onSuccess()
      } else {
        toast.error(data.error?.message || 'Failed to process dead stock clearance')
      }
    } catch {
      toast.error('Network error during clearance')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
              <TrendingDown className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base">Dead Stock Clearance &amp; Write-Off</DialogTitle>
              <DialogDescription className="text-xs">
                Write off unsellable capital or transfer dead stock to discount liquidation bin.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground">{prodName}</span>
              <Badge variant="destructive" className="text-[10px] font-mono">
                {sku}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-rose-500" />
              <span>Dead stock identified by multi-threaded movement analytics (&gt;60d inactive)</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Clearance Action</Label>
              <Select
                value={clearanceType}
                onValueChange={(v) => setClearanceType(v as 'WRITE_OFF' | 'TRANSFER')}
              >
                <SelectTrigger className="h-8 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WRITE_OFF" className="text-xs text-rose-600">
                    Write-Off / Scrapped
                  </SelectItem>
                  <SelectItem value="TRANSFER" className="text-xs text-sky-600">
                    Transfer to Clearance Bin
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Units to Clear</Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-8 text-xs font-mono"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Disposal / Clearance Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Zero movement > 90 days write-off" className="text-xs">
                  Zero movement &gt; 90 days write-off
                </SelectItem>
                <SelectItem value="Shelf life depleted / Obsolete" className="text-xs">
                  Shelf life depleted / Obsolete
                </SelectItem>
                <SelectItem value="Damaged beyond repair" className="text-xs">
                  Damaged beyond repair
                </SelectItem>
                <SelectItem value="B2B Wholesale liquidation lot" className="text-xs">
                  B2B Wholesale liquidation lot
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Authorization / Disposal Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Authorized by Chief Pharmacist"
              className="h-8 text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="gap-1.5 text-xs bg-rose-600 hover:bg-rose-700"
            >
              <TrendingDown className="h-3.5 w-3.5" />
              <span>{submitting ? 'Recording...' : 'Record Clearance'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
