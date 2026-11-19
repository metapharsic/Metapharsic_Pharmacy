'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Calendar, CheckCircle2, DollarSign, Package, Percent, ShieldAlert } from 'lucide-react'

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
import { checkDiscountExemption } from '@/lib/pricing/discount-exemption'
import { playBarcodeScanSound } from '@/lib/sound/sound-effects'

export interface PosBatchOption {
  id: string
  batchNumber: string
  expiryDate: string | Date
  available: number
  mrp: number
  purchasePrice?: number
  isNearExpiry?: boolean
  isFefoFirst?: boolean
}

export interface SelectedBatchLine {
  batchId: string
  batchNumber: string
  expiryDate: string | Date
  quantity: number
  rate: number
  discountPercent: number
}

interface BatchSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productName: string
  genericName?: string | null
  dpcoCeiling?: number | string | null
  drugSchedule?: string | null
  isDiscountable?: boolean | null
  batches: PosBatchOption[]
  onConfirm: (line: SelectedBatchLine) => void
}

export function BatchSelectionModal({
  open,
  onOpenChange,
  productName,
  genericName,
  dpcoCeiling,
  drugSchedule,
  isDiscountable,
  batches,
  onConfirm,
}: BatchSelectionModalProps) {
  const exemption = useMemo(() => {
    return checkDiscountExemption({
      name: productName,
      dpcoCeiling,
      drugSchedule,
      isDiscountable,
    })
  }, [productName, dpcoCeiling, drugSchedule, isDiscountable])

  const [selectedBatchId, setSelectedBatchId] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [rate, setRate] = useState<number>(0)
  const [discountPercent, setDiscountPercent] = useState<number>(0)

  const qtyInputRef = useRef<HTMLInputElement>(null)
  const rateInputRef = useRef<HTMLInputElement>(null)
  const discountInputRef = useRef<HTMLInputElement>(null)

  // Auto-select FEFO-first batch or first active batch on modal open
  useEffect(() => {
    if (open && batches.length > 0) {
      const fefoBatch = batches.find((b) => b.isFefoFirst && b.available > 0) || batches.find((b) => b.available > 0) || batches[0]
      if (fefoBatch) {
        setSelectedBatchId(fefoBatch.id)
        setRate(Number(fefoBatch.mrp))
        setQuantity(1)
        setDiscountPercent(0)
      }
      setTimeout(() => qtyInputRef.current?.focus(), 150)
    }
  }, [open, batches])

  const selectedBatch = batches.find((b) => b.id === selectedBatchId)
  const now = new Date().getTime()

  const handleSelectBatch = (batch: PosBatchOption) => {
    const isExpired = new Date(batch.expiryDate).getTime() <= now
    if (isExpired) return
    setSelectedBatchId(batch.id)
    setRate(Number(batch.mrp))
    qtyInputRef.current?.focus()
  }

  const handleConfirm = () => {
    if (!selectedBatch) return
    if (quantity <= 0 || quantity > selectedBatch.available) return

    playBarcodeScanSound()
    onConfirm({
      batchId: selectedBatch.id,
      batchNumber: selectedBatch.batchNumber,
      expiryDate: selectedBatch.expiryDate,
      quantity,
      rate,
      discountPercent: exemption.isExempt ? 0 : discountPercent,
    })
    onOpenChange(false)
  }

  // Keyboard navigation across inputs
  const handleKeyDown = (e: React.KeyboardEvent, step: 'qty' | 'rate' | 'disc') => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (step === 'qty') rateInputRef.current?.focus()
      else if (step === 'rate') discountInputRef.current?.focus()
      else if (step === 'disc') handleConfirm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-600" />
              Batch Selection & Pricing
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-xs">
              {batches.length} Available Batch(es)
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground text-sm">{productName}</span>
            {genericName && <span className="ml-1.5 text-muted-foreground">({genericName})</span>}
          </DialogDescription>
        </DialogHeader>

        {/* Batch Selection Table */}
        <div className="border rounded-lg overflow-hidden my-2 max-h-52 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/70 font-semibold text-muted-foreground border-b sticky top-0">
              <tr>
                <th className="py-2 px-3 text-left">Batch No.</th>
                <th className="py-2 px-3 text-left">Expiry Date</th>
                <th className="py-2 px-3 text-right">Stock</th>
                <th className="py-2 px-3 text-right">MRP (₹)</th>
                <th className="py-2 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {batches.map((batch) => {
                const expDate = new Date(batch.expiryDate)
                const isExpired = expDate.getTime() <= now
                const isNearExpiry = batch.isNearExpiry
                const isSelected = batch.id === selectedBatchId

                return (
                  <tr
                    key={batch.id}
                    onClick={() => handleSelectBatch(batch)}
                    className={`cursor-pointer transition-colors ${
                      isExpired
                        ? 'opacity-45 bg-rose-500/5 cursor-not-allowed'
                        : isSelected
                          ? 'bg-emerald-500/15 font-semibold text-emerald-950 dark:text-emerald-200'
                          : 'hover:bg-muted/40'
                    }`}
                  >
                    <td className="py-2 px-3 font-mono">
                      <div className="flex items-center gap-1.5">
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                        <span>{batch.batchNumber}</span>
                        {batch.isFefoFirst && (
                          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-400 text-[10px] py-0 px-1 font-mono">
                            FEFO
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`font-mono text-xs ${
                          isExpired
                            ? 'text-rose-600 font-bold'
                            : isNearExpiry
                              ? 'text-amber-600 font-medium'
                              : ''
                        }`}
                      >
                        {expDate.toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono">{batch.available}</td>
                    <td className="py-2 px-3 text-right font-mono font-medium">₹{Number(batch.mrp).toFixed(2)}</td>
                    <td className="py-2 px-3 text-center">
                      {isExpired ? (
                        <Badge variant="destructive" className="text-[10px] py-0 px-1">
                          EXPIRED
                        </Badge>
                      ) : isNearExpiry ? (
                        <Badge variant="outline" className="border-amber-500 text-amber-600 text-[10px] py-0 px-1">
                          Near Expiry
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] py-0 px-1">
                          Active
                        </Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Quantity, Rate, and Discount Inputs */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg border">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              Quantity
              {selectedBatch && (
                <span className="text-[11px] text-muted-foreground font-normal">
                  (Max: {selectedBatch.available})
                </span>
              )}
            </Label>
            <Input
              ref={qtyInputRef}
              type="number"
              min="1"
              max={selectedBatch?.available || 999}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              onKeyDown={(e) => handleKeyDown(e, 'qty')}
              className="h-9 font-mono text-center font-bold"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              Rate / MRP (₹)
            </Label>
            <Input
              ref={rateInputRef}
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
              onKeyDown={(e) => handleKeyDown(e, 'rate')}
              className="h-9 font-mono text-right font-medium"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Percent className="h-3.5 w-3.5 text-muted-foreground" />
              Item Discount (%)
              {exemption.isExempt && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1 py-0.5 rounded ml-2">
                  {exemption.badgeText || 'Exempt'}
                </span>
              )}
            </Label>
            <Input
              ref={discountInputRef}
              type="number"
              min="0"
              max="100"
              disabled={exemption.isExempt}
              value={exemption.isExempt ? 0 : discountPercent}
              onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
              onKeyDown={(e) => handleKeyDown(e, 'disc')}
              className="h-9 font-mono text-right"
            />
          </div>
        </div>

        {/* Line Total Calculation */}
        <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
          <span>Keyboard: Press <kbd className="px-1 py-0.5 bg-muted rounded border text-[10px]">Enter</kbd> to advance fields & add item</span>
          <div className="text-sm font-semibold text-foreground">
            Line Total: ₹{((quantity * rate * (1 - discountPercent / 100))).toFixed(2)}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedBatch || quantity <= 0 || (selectedBatch && quantity > selectedBatch.available)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            Add to Bill (Enter)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
