'use client'

import { AlertTriangle, Layers, RotateCcw, ShieldAlert, Truck } from 'lucide-react'
import { useState } from 'react'

import type { BatchRow } from '@/components/batches/batches-table'
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

// ─────────────────────────────────────────────────────────────
// 1. Batch Relocation Dialog (Rack > Shelf > Box)
// ─────────────────────────────────────────────────────────────

interface BatchRelocateDialogProps {
  batch: BatchRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function BatchRelocateDialog({
  batch,
  open,
  onOpenChange,
  onSuccess,
}: BatchRelocateDialogProps) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [rack, setRack] = useState('')
  const [shelf, setShelf] = useState('')
  const [box, setBox] = useState('')
  const [reason, setReason] = useState('Optimizing shelf storage for fast dispensing')

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && batch) {
      setRack(batch.rack || batch.product.rack || '')
      setShelf(batch.shelf || batch.product.shelf || '')
      setBox(batch.box || batch.product.box || '')
      setReason('Optimizing shelf storage for fast dispensing')
    }
    onOpenChange(isOpen)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!batch) return

    setLoading(true)
    try {
      const res = await fetch(`/api/batches/${batch.id}/relocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rack: rack.trim() || null,
          shelf: shelf.trim() || null,
          box: box.trim() || null,
          reason: reason.trim(),
        }),
      })

      const json = await res.json()
      if (res.ok && json.success) {
        toast.success(json.message || 'Storage coordinates updated successfully')
        onOpenChange(false)
        onSuccess()
      } else {
        toast.error(json.error?.message || 'Failed to relocate batch storage')
      }
    } catch {
      toast.error('Network error while updating batch storage')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <Layers className="h-5 w-5" />
              <DialogTitle>Relocate Medicine Storage</DialogTitle>
            </div>
            <DialogDescription>
              Assign or modify physical storage coordinates for{' '}
              <span className="font-semibold text-foreground">{batch?.product.name}</span> (Batch:{' '}
              <span className="font-mono font-medium">{batch?.batchNumber}</span>).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-md bg-muted/60 p-3 text-xs space-y-1">
              <p className="text-muted-foreground font-medium">Current Storage Location:</p>
              <p className="font-mono font-semibold text-foreground">
                {[batch?.rack || batch?.product.rack, batch?.shelf || batch?.product.shelf, batch?.box || batch?.product.box]
                  .filter(Boolean)
                  .join(' > ') || 'Unassigned (No Rack / Box)'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="batch-rack" className="text-xs">Rack / Bay</Label>
                <Input
                  id="batch-rack"
                  placeholder="e.g. A1"
                  value={rack}
                  onChange={(e) => setRack(e.target.value)}
                  className="font-mono uppercase text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batch-shelf" className="text-xs">Shelf Tier</Label>
                <Input
                  id="batch-shelf"
                  placeholder="e.g. Shelf 2"
                  value={shelf}
                  onChange={(e) => setShelf(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batch-box" className="text-xs">Box / Bin #</Label>
                <Input
                  id="batch-box"
                  placeholder="e.g. Box 04"
                  value={box}
                  onChange={(e) => setBox(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-muted-foreground">Quick assign rack:</span>
              {['A1', 'A2', 'B1', 'B2', 'COLD-01', 'FAST-01'].map((preset) => (
                <Badge
                  key={preset}
                  variant="outline"
                  className="cursor-pointer text-[10px] hover:bg-primary/10"
                  onClick={() => setRack(preset)}
                >
                  {preset}
                </Badge>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="batch-reason" className="text-xs">Relocation Reason</Label>
              <Input
                id="batch-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for storage update"
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Update Storage & Provision'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────
// 2. Batch Vendor Return Dialog (RTV)
// ─────────────────────────────────────────────────────────────

interface BatchVendorReturnDialogProps {
  batch: BatchRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function BatchVendorReturnDialog({
  batch,
  open,
  onOpenChange,
  onSuccess,
}: BatchVendorReturnDialogProps) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('Near Expiry return under vendor credit policy')
  const [debitNote, setDebitNote] = useState('')
  const [notes, setNotes] = useState('')

  const supplierName = batch?.supplierName || 'Direct Wholesaler'
  const maxAvailable = batch?.availableQuantity ?? 0

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && batch) {
      setQuantity(Math.min(batch.availableQuantity, Math.max(1, batch.availableQuantity)))
      setReason(batch.daysUntilExpiry !== undefined && batch.daysUntilExpiry <= 60
        ? 'Near Expiry return under vendor credit agreement'
        : 'Vendor return for stock reconciliation')
      setDebitNote(`DN-${Date.now().toString().slice(-6)}`)
      setNotes('')
    }
    onOpenChange(isOpen)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!batch) return

    if (quantity <= 0 || quantity > maxAvailable) {
      toast.error(`Return quantity must be between 1 and ${maxAvailable}`)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/batches/${batch.id}/vendor-return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity,
          reason: reason.trim(),
          debitNoteNumber: debitNote.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })

      const json = await res.json()
      if (res.ok && json.success) {
        toast.success(json.message || 'Vendor return processed successfully')
        onOpenChange(false)
        onSuccess()
      } else {
        toast.error(json.error?.message || 'Failed to process vendor return')
      }
    } catch {
      toast.error('Network error while processing vendor return')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
              <RotateCcw className="h-5 w-5" />
              <DialogTitle>Return to Vendor (RTV)</DialogTitle>
            </div>
            <DialogDescription>
              Return batch stock to wholesaler and generate debit note reference.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-md border p-3 text-xs space-y-1.5 bg-muted/40">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Medicine:</span>
                <span className="font-semibold">{batch?.product.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Batch & Expiry:</span>
                <span className="font-mono">{batch?.batchNumber} · {batch?.expiryDate.slice(0, 10)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Supplier:</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <Truck className="h-3 w-3 text-sky-500" />
                  {supplierName}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Available Stock:</span>
                <span className="font-bold text-foreground font-mono">{maxAvailable} units</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rtv-qty" className="text-xs">Return Quantity</Label>
                <Input
                  id="rtv-qty"
                  type="number"
                  min={1}
                  max={maxAvailable}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="font-mono text-sm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rtv-debit" className="text-xs">Debit Note #</Label>
                <Input
                  id="rtv-debit"
                  placeholder="e.g. DN-2026-01"
                  value={debitNote}
                  onChange={(e) => setDebitNote(e.target.value)}
                  className="font-mono text-xs uppercase"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rtv-reason" className="text-xs">Return Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="rtv-reason" className="text-xs">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Near Expiry return under vendor credit policy">
                    Near Expiry (FEFO Clearance)
                  </SelectItem>
                  <SelectItem value="Damaged outer packaging or seal broken">
                    Damaged Packaging / Broken Seal
                  </SelectItem>
                  <SelectItem value="Manufacturer recall / QC hold">
                    Manufacturer Recall / QC Hold
                  </SelectItem>
                  <SelectItem value="Slow-moving stock liquidation under buyback agreement">
                    Dead Stock / Slow-Moving Buyback
                  </SelectItem>
                  <SelectItem value="Wrong item shipped / excess delivery">
                    Wrong Item / Excess Delivery
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rtv-notes" className="text-xs">Internal Notes</Label>
              <Textarea
                id="rtv-notes"
                rows={2}
                placeholder="Optional supplier dispatch notes or tracking"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || maxAvailable <= 0}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              {loading ? 'Processing...' : 'Confirm Supplier Return'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────
// 3. Batch Quarantine / Block Dialog
// ─────────────────────────────────────────────────────────────

interface BatchBlockDialogProps {
  batch: BatchRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function BatchBlockDialog({
  batch,
  open,
  onOpenChange,
  onSuccess,
}: BatchBlockDialogProps) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('Quality quarantine pending laboratory testing')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!batch) return

    setLoading(true)
    try {
      const res = await fetch(`/api/batches/${batch.id}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      })

      const json = await res.json()
      if (res.ok && json.success) {
        toast.success('Batch quarantined and blocked from dispensing')
        onOpenChange(false)
        onSuccess()
      } else {
        toast.error(json.error?.message || 'Failed to block batch')
      }
    } catch {
      toast.error('Network error while blocking batch')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              <DialogTitle>Quarantine / Block Batch</DialogTitle>
            </div>
            <DialogDescription>
              Block batch <span className="font-mono font-medium">{batch?.batchNumber}</span> ({batch?.product.name}) from POS dispensing and sales.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Immediate Safety Enforcement</span>
              </div>
              <p>
                Once blocked, this batch cannot be selected at the cash counter or dispensed in prescriptions until reviewed.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="block-reason" className="text-xs">Quarantine Reason</Label>
              <Input
                id="block-reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for blocking batch"
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading ? 'Quarantining...' : 'Block Batch'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
