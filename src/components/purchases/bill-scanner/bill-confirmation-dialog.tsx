'use client'

import {
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  CreditCard,
  Edit3,
  FileText,
  Loader2,
  PackageCheck,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils/cn'

import type { ReviewBillData } from './types'

export interface BillConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  billData: ReviewBillData
  branchName?: string
  onConfirm: (options?: {
    adminRiskAccepted?: boolean
    overrideTotal?: number
    overrideReason?: string
  }) => Promise<void> | void
  isSubmitting?: boolean
}

export function BillConfirmationDialog({
  open,
  onOpenChange,
  billData,
  branchName = 'Main Pharmacy Branch',
  onConfirm,
  isSubmitting = false,
}: BillConfirmationDialogProps) {
  const [hasAffirmed, setHasAffirmed] = useState<boolean>(true)
  const [adminRiskAccepted, setAdminRiskAccepted] = useState<boolean>(true)
  const [overrideReason, setOverrideReason] = useState<string>('Admin approved bill amount under full administrator authority')
  const [isEditingTotal, setIsEditingTotal] = useState<boolean>(false)
  const [customTotal, setCustomTotal] = useState<string>(billData.totalAmount.toFixed(2))

  useEffect(() => {
    setCustomTotal(billData.totalAmount.toFixed(2))
  }, [billData.totalAmount])

  const totalBilledUnits = billData.items.reduce((acc, it) => acc + (it.billedQuantity || 0), 0)
  const totalFreeUnits = billData.items.reduce((acc, it) => acc + (it.freeQuantity || 0), 0)
  const totalUsableUnits = totalBilledUnits + totalFreeUnits

  const isPaidMode = billData.paymentMethod && billData.paymentMethod !== 'CREDIT'

  const itemTotalSum = billData.items.reduce((acc, it) => acc + (it.totalAmount || 0), 0)
  const roundOff = billData.roundOff || 0
  const taxAmount = billData.taxAmount || 0
  const discountAmount = billData.discountAmount || 0

  const parsedCustom = parseFloat(customTotal)
  const effectiveTotal =
    isEditingTotal && !isNaN(parsedCustom) && parsedCustom >= 0
      ? parsedCustom
      : billData.totalAmount

  // Accounting variance tolerance detection
  const diff1 = Math.abs((itemTotalSum + roundOff) - effectiveTotal)
  const diff2 = Math.abs((itemTotalSum + taxAmount + roundOff - discountAmount) - effectiveTotal)
  const diff3 = Math.abs(itemTotalSum - effectiveTotal)
  const variance = Math.min(diff1, diff2, diff3)
  const hasVariance = variance > 2.0

  // Admin always has full authority to confirm and save at own risk
  const canConfirm = !isSubmitting

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!canConfirm || isSubmitting) return
    await onConfirm({
      adminRiskAccepted: true,
      overrideTotal: effectiveTotal,
      overrideReason: overrideReason.trim() || 'Admin authorized purchase bill at own risk',
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-xl max-h-[92vh] overflow-y-auto p-6">
        <AlertDialogHeader className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <PackageCheck className="h-5 w-5" />
            <AlertDialogTitle className="text-lg font-bold">
              Confirm Purchase Ingestion &amp; Live Stock Provisioning
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-xs text-muted-foreground">
            Please review the quantitative summary below. Once confirmed, pharmaceutical batches will be created,
            vendor master credentials synced, payment settlements posted, and inventory incremented immediately.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Executive Summary Card */}
        <div className="my-2 space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-xs">
          <div className="grid grid-cols-2 gap-3 pb-3 border-b border-border/60">
            <div>
              <span className="text-muted-foreground block text-[11px]">Distributor / Supplier Master</span>
              <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                {billData.supplierName || 'Unknown Distributor'}
              </span>
              <div className="text-[10px] font-mono text-muted-foreground space-y-0.5 mt-0.5">
                {billData.supplierGstin && <div>GST: {billData.supplierGstin}</div>}
                {billData.supplierPan && <div>PAN: {billData.supplierPan}</div>}
                {billData.supplierPhone && <div>Phone: {billData.supplierPhone}</div>}
              </div>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px]">Invoice Details</span>
              <span className="font-semibold font-mono text-foreground flex items-center gap-1 mt-0.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                {billData.invoiceNumber}
              </span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Calendar className="h-3 w-3" />
                Dated: {billData.invoiceDate}
              </span>
              {billData.dueDate && (
                <span className="text-[10px] text-muted-foreground block mt-0.5 font-mono">
                  Due: {billData.dueDate} ({billData.creditDays ?? 21}d credit)
                </span>
              )}
            </div>
          </div>

          {/* Payment Terms Summary */}
          <div className="rounded-md bg-background/80 p-2.5 border border-border/50 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase font-medium">
                  Payment Mode &amp; Terms
                </span>
                <span className="font-semibold text-foreground flex items-center gap-1">
                  {billData.paymentMethod || 'CREDIT'}
                  {billData.paymentReference && (
                    <span className="text-[10px] font-mono font-normal text-muted-foreground">
                      (Ref: {billData.paymentReference})
                    </span>
                  )}
                </span>
              </div>
            </div>

            <Badge
              variant="outline"
              className={cn(
                'text-[10px] uppercase font-mono px-2 py-0.5',
                isPaidMode
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
              )}
            >
              {isPaidMode ? 'Fully Settled (₹0 Due)' : `₹${effectiveTotal.toFixed(2)} Credit Payable`}
            </Badge>
          </div>

          {/* Quantitative Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 py-2 text-center">
            <div className="rounded-md bg-background/80 p-2 border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                Line Items
              </span>
              <span className="font-mono text-base font-bold text-foreground">
                {billData.items.length}
              </span>
            </div>

            <div className="rounded-md bg-background/80 p-2 border border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                Total Units
              </span>
              <span className="font-mono text-base font-bold text-foreground">
                {totalUsableUnits}
              </span>
              {totalFreeUnits > 0 && (
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 block font-semibold">
                  ({totalBilledUnits} + {totalFreeUnits} Free)
                </span>
              )}
            </div>

            <div className="rounded-md bg-background/80 p-2 border border-border/50 relative group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                  Total Amount
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingTotal((p) => !p)}
                  className="text-[9px] text-primary hover:underline flex items-center gap-0.5"
                  title="Edit Total Amount directly"
                >
                  <Edit3 className="h-2.5 w-2.5" />
                  <span>{isEditingTotal ? 'Done' : 'Edit'}</span>
                </button>
              </div>
              {isEditingTotal ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs font-bold text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={customTotal}
                    onChange={(e) => setCustomTotal(e.target.value)}
                    className="h-6 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 text-right px-1"
                  />
                </div>
              ) : (
                <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                  ₹{effectiveTotal.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Receiving Branch: <strong>{branchName}</strong></span>
            <span>Status: <Badge variant="outline" className="text-[10px] uppercase font-mono">RECEIVED</Badge></span>
          </div>
        </div>

        {/* Math Variance / Arithmetic Discrepancy Notice */}
        {hasVariance && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-950 dark:text-amber-100 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Reconciliation Discrepancy Detected</span>
              </div>
              <Badge variant="outline" className="border-amber-500/50 bg-amber-500/20 text-amber-900 dark:text-amber-200 font-mono text-[10px]">
                Variance: ₹{variance.toFixed(2)}
              </Badge>
            </div>
            <p className="text-[11px] leading-relaxed opacity-95">
              Line item sum is <strong>₹{itemTotalSum.toFixed(2)}</strong>, while the bill total is <strong>₹{effectiveTotal.toFixed(2)}</strong> (variance: ₹{variance.toFixed(2)}). Standard automated verification is blocked. Administrator authority is required to save and provision at admin&apos;s risk.
            </p>
          </div>
        )}

        {/* Administrator Authority & Risk Override Section */}
        <div
          className={cn(
            'rounded-lg border p-3.5 space-y-2.5 transition-all',
            hasVariance
              ? 'border-amber-500/60 bg-amber-500/5 dark:bg-amber-950/20 shadow-sm'
              : 'border-primary/30 bg-primary/5'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="font-bold text-xs uppercase tracking-wide text-foreground">
                Administrator Authority &amp; Risk Override
              </span>
            </div>
            <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-mono text-[9px] uppercase">
              Admin Full Authority
            </Badge>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            As Administrator, you have full privilege to save this bill with whatever amount is showing (<strong>₹{effectiveTotal.toFixed(2)}</strong>) at your own risk. Batches will be created, stock incremented, and an audit trail recorded under your credentials.
          </p>

          <div className="flex items-start space-x-2.5 pt-1">
            <Checkbox
              id="affirm-admin-risk"
              checked={adminRiskAccepted}
              onCheckedChange={(checked) => setAdminRiskAccepted(Boolean(checked))}
              disabled={isSubmitting}
              className="mt-0.5 border-amber-500 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
            />
            <Label
              htmlFor="affirm-admin-risk"
              className="text-xs font-semibold text-foreground cursor-pointer leading-tight select-none"
            >
              I authorize this purchase bill with Total Amount ₹{effectiveTotal.toFixed(2)} at my own risk under Administrator Authority.
            </Label>
          </div>

          {adminRiskAccepted && (
            <div className="space-y-1 pt-1">
              <Label htmlFor="admin-override-reason" className="text-[10px] text-muted-foreground font-medium">
                Authorization Note / Override Reason (Optional):
              </Label>
              <Input
                id="admin-override-reason"
                placeholder="e.g. Physical distributor bill cash discount accepted by Admin"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="h-7 text-xs bg-background/80"
              />
            </div>
          )}
        </div>

        {/* Regular Verification Checkbox (only when no variance) */}
        {!hasVariance && (
          <div className="flex items-start space-x-2 pt-1">
            <Checkbox
              id="affirm-verification"
              checked={hasAffirmed}
              onCheckedChange={(checked) => setHasAffirmed(Boolean(checked))}
              disabled={isSubmitting}
              className="mt-0.5"
            />
            <Label
              htmlFor="affirm-verification"
              className="text-xs font-normal text-muted-foreground cursor-pointer leading-tight select-none"
            >
              I have verified all batch numbers, expiry dates, quantities, and rates against the distributor invoice.
            </Label>
          </div>
        )}

        {/* Action Buttons */}
        <AlertDialogFooter className="mt-4 gap-2">
          <AlertDialogCancel disabled={isSubmitting} className="text-xs">
            Back to Review
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={cn(
              'text-xs gap-1.5 font-semibold text-white shadow-md transition-all',
              hasVariance
                ? canConfirm
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
                : canConfirm
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Provisioning Inventory...</span>
              </>
            ) : hasVariance ? (
              <>
                <ShieldAlert className="h-3.5 w-3.5 text-amber-200" />
                <span>Save at Admin Risk &amp; Provision (₹{effectiveTotal.toFixed(2)})</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Confirm &amp; Provision Inventory (₹{effectiveTotal.toFixed(2)})</span>
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
