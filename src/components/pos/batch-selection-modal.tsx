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
import { useI18n } from '@/lib/i18n/i18n-context'

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
  productNameAr?: string | null
  genericName?: string | null
  genericNameAr?: string | null
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
  productNameAr,
  genericName,
  genericNameAr,
  dpcoCeiling,
  drugSchedule,
  isDiscountable,
  batches,
  onConfirm,
}: BatchSelectionModalProps) {
  const { isAr, isPureArabic, formatPrice, translateDrug, translateGeneric } = useI18n()
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

  const displayName = isPureArabic
    ? (productNameAr || translateDrug(productName))
    : isAr
      ? `${translateDrug(productName, productNameAr)} / ${productName}`
      : productName

  const displayGeneric = isPureArabic
    ? (genericNameAr || (genericName ? translateGeneric(genericName) : null))
    : genericName

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-600" />
              {isAr ? 'اختيار التشغيلة والتسعير' : 'Batch Selection & Pricing'}
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-xs">
              {isAr ? `${batches.length} تشغيلات متاحة` : `${batches.length} Available Batch(es)`}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground text-sm">{displayName}</span>
            {displayGeneric && <span className="ml-1.5 text-muted-foreground">({displayGeneric})</span>}
          </DialogDescription>
        </DialogHeader>

        {/* Batch Selection Table */}
        <div className="border rounded-lg overflow-hidden my-2 max-h-52 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/70 font-semibold text-muted-foreground border-b sticky top-0">
              <tr>
                <th className="py-2 px-3 text-left">{isAr ? 'رقم التشغيلة' : 'Batch No.'}</th>
                <th className="py-2 px-3 text-left">{isAr ? 'تاريخ الانتهاء' : 'Expiry Date'}</th>
                <th className="py-2 px-3 text-right">{isAr ? 'الرصيد' : 'Stock'}</th>
                <th className="py-2 px-3 text-right">{isAr ? 'سعر الجمهور' : 'MRP'}</th>
                <th className="py-2 px-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
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
                            {isAr ? 'أولوية' : 'FEFO'}
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
                        {expDate.toLocaleDateString(isAr ? 'ar-SA' : undefined)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono">{batch.available}</td>
                    <td className="py-2 px-3 text-right font-mono font-medium">{formatPrice(Number(batch.mrp))}</td>
                    <td className="py-2 px-3 text-center">
                      {isExpired ? (
                        <Badge variant="destructive" className="text-[10px] py-0 px-1">
                          {isAr ? 'منتهي الصلاحية' : 'EXPIRED'}
                        </Badge>
                      ) : isNearExpiry ? (
                        <Badge variant="outline" className="border-amber-500 text-amber-600 text-[10px] py-0 px-1">
                          {isAr ? 'قريب الانتهاء' : 'Near Expiry'}
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] py-0 px-1">
                          {isAr ? 'نشط' : 'Active'}
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
              {isAr ? 'الكمية' : 'Quantity'}
              {selectedBatch && (
                <span className="text-[11px] text-muted-foreground font-normal">
                  {isAr ? `(الحد الأقصى: ${selectedBatch.available})` : `(Max: ${selectedBatch.available})`}
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
              {isAr ? 'السعر / سعر الجمهور' : 'Rate / MRP'}
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
              {isAr ? 'نسبة الخصم (%)' : 'Item Discount (%)'}
              {exemption.isExempt && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1 py-0.5 rounded ml-2">
                  {exemption.badgeText || (isAr ? 'معفى' : 'Exempt')}
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
          <span>{isAr ? 'لوحة المفاتيح: اضغط Enter للتنقل وإضافة الصنف' : 'Keyboard: Press Enter to advance fields & add item'}</span>
          <div className="text-sm font-semibold text-foreground">
            {isAr ? 'إجمالي البند: ' : 'Line Total: '}{formatPrice(quantity * rate * (1 - discountPercent / 100))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedBatch || quantity <= 0 || (selectedBatch && quantity > selectedBatch.available)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {isAr ? 'إضافة إلى الفاتورة (Enter)' : 'Add to Bill (Enter)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
