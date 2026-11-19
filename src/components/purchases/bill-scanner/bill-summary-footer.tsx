'use client'

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Edit3,
  Receipt,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react'
import React, { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'

import { round2 } from './types'

export interface BillSummaryFooterProps {
  subtotal: number
  taxAmount: number
  discountAmount: number
  roundOff: number
  totalAmount: number
  extractedTotal?: number
  variance: number
  isReconciled: boolean
  onRoundOffChange?: (roundOff: number) => void
  onTotalAmountChange?: (total: number) => void
  onCommitClick: () => void
  onResetClick?: () => void
  disabled?: boolean
  committing?: boolean
  className?: string
}

export function BillSummaryFooter({
  subtotal,
  taxAmount,
  discountAmount,
  roundOff,
  totalAmount,
  extractedTotal,
  variance,
  isReconciled,
  onRoundOffChange,
  onTotalAmountChange,
  onCommitClick,
  onResetClick,
  disabled = false,
  committing = false,
  className,
}: BillSummaryFooterProps) {
  const [isEditingTotal, setIsEditingTotal] = useState(false)
  const [tempTotal, setTempTotal] = useState(totalAmount.toFixed(2))

  const hasExtractedTarget = extractedTotal !== undefined && extractedTotal > 0
  const hasVarianceMismatch = hasExtractedTarget && !isReconciled

  return (
    <div className={cn('space-y-3', className)}>
      {/* Math Variance / Reconciliation Banner */}
      {hasExtractedTarget && (
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5 transition-all text-xs',
            hasVarianceMismatch
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
          )}
        >
          <div className="flex items-center gap-2.5">
            {hasVarianceMismatch ? (
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <div>
              <p className="font-semibold">
                {hasVarianceMismatch
                  ? 'Invoice Arithmetic Discrepancy Detected'
                  : 'Invoice Totals Reconciled'}
              </p>
              <p className="text-[11px] opacity-90 mt-0.5">
                {hasVarianceMismatch ? (
                  <>
                    The computed line item sum (<strong>₹{totalAmount.toFixed(2)}</strong>) differs
                    from the extracted document total (<strong>₹{extractedTotal.toFixed(2)}</strong>)
                    by <strong>₹{variance.toFixed(2)}</strong>. Please verify line item rates,
                    quantities, or discounts before provisioning.
                  </>
                ) : (
                  <>
                    Computed total (<strong>₹{totalAmount.toFixed(2)}</strong>) matches the
                    extracted invoice grand total (within statutory ₹1.00 rounding tolerance).
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'font-mono text-xs uppercase',
                hasVarianceMismatch
                  ? 'border-amber-500/50 bg-amber-500/20 text-amber-900 dark:text-amber-200'
                  : 'border-emerald-500/50 bg-emerald-500/20 text-emerald-900 dark:text-emerald-200'
              )}
            >
              {hasVarianceMismatch ? `Variance: ₹${variance.toFixed(2)}` : 'Math Verified'}
            </Badge>
            {hasVarianceMismatch && (
              <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-mono text-[10px] uppercase flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />
                Admin Override Ready
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Summary Financial Bar & Action Buttons */}
      <Card className="border border-border/80 bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Financial Metrics Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs divide-x-0 sm:divide-x divide-border/60">
              {/* Taxable Subtotal */}
              <div className="space-y-0.5 sm:pr-4">
                <span className="text-muted-foreground">Taxable Subtotal</span>
                <p className="font-mono text-sm font-semibold text-foreground">
                  ₹{subtotal.toFixed(2)}
                </p>
              </div>

              {/* GST / Taxes */}
              <div className="space-y-0.5 sm:px-4">
                <span className="text-muted-foreground">GST Taxes</span>
                <p className="font-mono text-sm font-semibold text-foreground">
                  +₹{taxAmount.toFixed(2)}
                </p>
              </div>

              {/* Trade Discount */}
              <div className="space-y-0.5 sm:px-4">
                <span className="text-muted-foreground">Trade Discounts</span>
                <p className="font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  -₹{discountAmount.toFixed(2)}
                </p>
              </div>

              {/* Round Off Adjustment */}
              <div className="space-y-0.5 sm:pl-4">
                <span className="text-muted-foreground">Round Off (₹)</span>
                {onRoundOffChange ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={roundOff}
                    onChange={(e) => onRoundOffChange(round2(parseFloat(e.target.value) || 0))}
                    disabled={disabled}
                    className="h-7 w-20 font-mono text-xs text-right mt-0.5"
                  />
                ) : (
                  <p className="font-mono text-sm font-semibold text-foreground">
                    {roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
                  </p>
                )}
              </div>
            </div>

            {/* Total Payable & Confirmation Trigger */}
            <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-border/60">
              <div className="text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    Total Payable Amount
                  </span>
                  {onTotalAmountChange && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditingTotal) {
                          const val = parseFloat(tempTotal)
                          if (!isNaN(val) && val >= 0) {
                            onTotalAmountChange(round2(val))
                          }
                          setIsEditingTotal(false)
                        } else {
                          setTempTotal(totalAmount.toFixed(2))
                          setIsEditingTotal(true)
                        }
                      }}
                      className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                    >
                      <Edit3 className="h-2.5 w-2.5" />
                      <span>{isEditingTotal ? 'Done' : 'Edit'}</span>
                    </button>
                  )}
                </div>
                {isEditingTotal && onTotalAmountChange ? (
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-sm font-bold text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={tempTotal}
                      onChange={(e) => setTempTotal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseFloat(tempTotal)
                          if (!isNaN(val) && val >= 0) {
                            onTotalAmountChange(round2(val))
                          }
                          setIsEditingTotal(false)
                        }
                      }}
                      className="h-7 w-28 text-right font-mono text-sm font-bold text-foreground"
                    />
                  </div>
                ) : (
                  <p className="font-mono text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                    ₹{totalAmount.toFixed(2)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {onResetClick && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onResetClick}
                    disabled={disabled || committing}
                    className="gap-1.5 h-10 text-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </Button>
                )}

                <Button
                  type="button"
                  variant="default"
                  onClick={onCommitClick}
                  disabled={disabled || committing || totalAmount <= 0}
                  className={cn(
                    'gap-2 h-10 px-5 text-xs font-semibold shadow-md',
                    'bg-emerald-600 hover:bg-emerald-700 text-white'
                  )}
                >
                  <Receipt className="h-4 w-4" />
                  <span>Commit &amp; Provision Stock</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
