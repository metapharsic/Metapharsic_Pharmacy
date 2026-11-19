'use client'

import { formatRack, formatShelf } from '@/lib/utils/rack'

// ─────────────────────────────────────────────────────────────
// Component — EditAdjustmentDialog
// Allows pharmacists/supervisors to modify, edit, or append notes
// to an existing raised stock adjustment with real-time valuation diff.
// ─────────────────────────────────────────────────────────────
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Package,
  Pencil,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { AdjustmentRow, AdjustmentType } from '@/components/inventory/adjustments-table'
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

interface EditAdjustmentDialogProps {
  adjustment: AdjustmentRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (message: string) => void
}

const ADJUSTMENT_TYPES = [
  { value: 'PHYSICAL_COUNT', label: 'Physical Count Discrepancy' },
  { value: 'EXPIRY', label: 'Near Expiry / Expired Return' },
  { value: 'DAMAGE', label: 'Damaged Goods Write-off' },
  { value: 'THEFT', label: 'Theft / Missing Units' },
  { value: 'CORRECTION', label: 'Inventory Correction' },
  { value: 'OPENING_STOCK', label: 'Opening Stock Entry' },
]

export function EditAdjustmentDialog({
  adjustment,
  open,
  onOpenChange,
  onUpdated,
}: EditAdjustmentDialogProps) {
  const toast = useToast()

  const [quantity, setQuantity] = useState<string>('')
  const [adjustmentType, setAdjustmentType] = useState<string>('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && adjustment) {
      setQuantity(String(adjustment.quantity))
      setAdjustmentType(adjustment.adjustmentType)
      setReason(adjustment.reason)
      setNotes(adjustment.notes ?? '')
      setError(null)
    }
  }, [open, adjustment])

  const parsedQty = Number(quantity)
  const isQtyValid = Number.isFinite(parsedQty) && parsedQty !== 0

  // Calculate new financial impact vs old financial impact
  const financialDiff = useMemo(() => {
    if (!adjustment || !isQtyValid) return null

    const unitCost = adjustment.batch?.purchasePrice != null
      ? Number(adjustment.batch.purchasePrice)
      : (adjustment.product.costPrice != null
          ? Number(adjustment.product.costPrice)
          : Number(adjustment.product.mrp || 0) * 0.7)
    const unitMrp = adjustment.batch?.mrp != null
      ? Number(adjustment.batch.mrp)
      : Number(adjustment.product.mrp || 0)

    const oldCost = adjustment.costImpact ?? Math.round(adjustment.quantity * unitCost * 100) / 100
    const newCost = Math.round(parsedQty * unitCost * 100) / 100
    const oldMrp = adjustment.mrpImpact ?? Math.round(adjustment.quantity * unitMrp * 100) / 100
    const newMrp = Math.round(parsedQty * unitMrp * 100) / 100

    return {
      oldCost,
      newCost,
      costDiff: Math.round((newCost - oldCost) * 100) / 100,
      oldMrp,
      newMrp,
      mrpDiff: Math.round((newMrp - oldMrp) * 100) / 100,
    }
  }, [adjustment, parsedQty, isQtyValid])

  if (!adjustment) return null

  const isPending = adjustment.status === 'PENDING'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!adjustment) return
    setError(null)

    if (!isQtyValid) {
      setError('Quantity delta must be a non-zero whole number.')
      return
    }
    if (!reason.trim()) {
      setError('Audit reason is required.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/adjustments/${adjustment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: parsedQty,
          adjustmentType: adjustmentType as AdjustmentType,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
        }),
      })

      const json = (await res.json()) as {
        success: boolean
        message?: string
        error?: { message?: string }
      }

      if (res.ok && json.success) {
        toast.success(json.message ?? 'Stock adjustment updated successfully')
        onUpdated(json.message ?? 'Adjustment updated')
        onOpenChange(false)
      } else {
        setError(json.error?.message ?? 'Failed to update adjustment.')
      }
    } catch {
      setError('Network error while updating adjustment.')
    } finally {
      setSubmitting(false)
    }
  }

  const p = adjustment.product
  const locStr = [
    p.rack ? `Rack ${formatRack(p.rack)}` : null,
    p.shelf ? p.shelf : null,
    p.box ? `Box ${p.box}` : null,
  ].filter(Boolean).join(' › ')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Pencil className="h-5 w-5 text-primary" />
              Modify Raised Stock Adjustment
            </DialogTitle>
            <DialogDescription>
              {isPending
                ? 'Update discrepancy quantity, reason, or notes prior to supervisor approval.'
                : 'Modify audit justification or differential quantity for this approved adjustment.'}
            </DialogDescription>
          </DialogHeader>

          {/* Product & Location Banner */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-sm text-foreground">{p.name}</span>
                <span className="text-muted-foreground ml-2 font-mono">({p.sku})</span>
              </div>
              <Badge variant={isPending ? 'warning' : 'success'} className="text-[10px]">
                {adjustment.status}
              </Badge>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-medium text-foreground">
                  Storage: {locStr || 'Unassigned'}
                </span>
              </div>
              <div>
                Branch: <span className="font-medium text-foreground">{adjustment.branch.name}</span>
              </div>
            </div>

            {adjustment.batch && (
              <div className="flex items-center justify-between border-t pt-1.5 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Batch: <span className="font-mono font-medium">{adjustment.batch.batchNumber}</span></span>
                </div>
                {adjustment.batch.supplier && (
                  <div className="flex items-center gap-1 text-primary">
                    <Building2 className="h-3 w-3" />
                    <span>Vendor: {adjustment.batch.supplier.name}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quantity & Adjustment Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-quantity" className="text-xs font-semibold">
                Adjustment Delta Quantity (±) *
              </Label>
              <Input
                id="edit-quantity"
                type="number"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-9 font-mono font-bold"
              />
              <p className="text-[10px] text-muted-foreground">
                Original quantity: {adjustment.quantity > 0 ? `+${adjustment.quantity}` : adjustment.quantity}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-type" className="text-xs font-semibold">
                Adjustment Type *
              </Label>
              <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                <SelectTrigger id="edit-type" className="h-9 text-xs">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Valuation Diff Card */}
          {financialDiff && (
            <div className="rounded-lg border bg-card p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b pb-1.5 text-muted-foreground">
                <span className="font-medium">Valuation Re-calculation:</span>
                <span className="font-mono text-[11px]">
                  Old: ₹{financialDiff.oldCost.toFixed(2)} → New: ₹{financialDiff.newCost.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Cost Price Net Delta:</span>
                <span
                  className={`font-mono font-bold ${
                    financialDiff.newCost >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {financialDiff.newCost >= 0 ? '+' : ''}₹{financialDiff.newCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>MRP Retail Value:</span>
                <span className="font-mono">
                  {financialDiff.newMrp >= 0 ? '+' : ''}₹{financialDiff.newMrp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* Audit Reason & Append Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-reason" className="text-xs font-semibold">
              Audit Reason *
            </Label>
            <Input
              id="edit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-notes" className="text-xs font-semibold">
              Chemist / Auditor Remarks &amp; Append Notes
            </Label>
            <Textarea
              id="edit-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Append notes, return RMA, or audit trail remarks..."
              className="text-xs"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
              {error}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !isQtyValid}
              className="bg-primary hover:bg-primary/90"
            >
              {submitting ? 'Saving Changes...' : 'Save & Update Adjustment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
