'use client'

// ─────────────────────────────────────────────────────────────
// Component — SettlePaymentDialog
// Streamlined modal for settling outstanding balances on sales:
//  - Keeps invoice balance outstanding until fully settled
//  - Supports split payment & partial settlements
//  - Multi-method support: Cash, UPI, Card, Cheque, Netbanking
//  - Automatically syncs customer ledger and updates live metrics
// ─────────────────────────────────────────────────────────────
import {
  Banknote,
  CheckCircle2,
  Coins,
  CreditCard,
  QrCode,
  Receipt,
  RotateCw,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'

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
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/lib/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/currency'

interface SettlePaymentDialogProps {
  saleId: string
  invoiceNumber: string
  customerName?: string | null
  totalAmount: string | number
  amountPaid: string | number
  balanceDue: string | number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const PAYMENT_METHODS: SearchableSelectOption[] = [
  { value: 'CASH', label: 'Cash Payment', badge: 'Counter', badgeVariant: 'default' },
  { value: 'UPI', label: 'UPI / QR Code', badge: 'Instant', badgeVariant: 'secondary' },
  { value: 'CARD', label: 'Debit / Credit Card', badge: 'POS Terminal', badgeVariant: 'outline' },
  { value: 'NETBANKING', label: 'Net Banking / IMPS', badge: 'Direct', badgeVariant: 'secondary' },
  { value: 'CHEQUE', label: 'Cheque / Draft', badge: 'Clearing', badgeVariant: 'outline' },
]

export function SettlePaymentDialog({
  saleId,
  invoiceNumber,
  customerName,
  totalAmount,
  amountPaid,
  balanceDue,
  open,
  onOpenChange,
  onSuccess,
}: SettlePaymentDialogProps) {
  const toast = useToast()
  const maxDue = Number(balanceDue) || 0

  const [amount, setAmount] = useState<string>(String(maxDue))
  const [method, setMethod] = useState<string>('UPI')
  const [reference, setReference] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync default amount when opening
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setAmount(String(maxDue))
      setReference('')
      setNotes('')
    }
    onOpenChange(nextOpen)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = Number(amount)

    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Invalid Amount', 'Please enter a valid payment amount greater than zero.')
      return
    }

    if (numAmount > maxDue) {
      toast.error(
        'Amount Exceeds Due',
        `Payment cannot exceed the outstanding balance of ${formatCurrency(maxDue.toString())}.`
      )
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/sales/${saleId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          method,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to record payment')
      }

      toast.success(
        'Payment Recorded Successfully',
        `Received ${formatCurrency(numAmount.toString())} for invoice ${invoiceNumber}`
      )
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      toast.error('Payment Failed', err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden shadow-2xl border-border/80">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-background to-muted/40 border-b">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Coins className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Collect Payment / Settle Balance
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Record settlement against invoice <span className="font-mono font-semibold">{invoiceNumber}</span>
                </DialogDescription>
              </div>
            </div>

            {/* Balances summary */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border/50 text-xs">
              <div className="p-2 rounded bg-background/80 border text-center">
                <span className="text-[10px] text-muted-foreground uppercase font-medium">Bill Total</span>
                <p className="font-bold tabular-nums text-foreground mt-0.5">
                  {formatCurrency(totalAmount.toString())}
                </p>
              </div>
              <div className="p-2 rounded bg-background/80 border text-center">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-medium">
                  Received
                </span>
                <p className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatCurrency(amountPaid.toString())}
                </p>
              </div>
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-center">
                <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold">
                  Balance Due
                </span>
                <p className="font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                  {formatCurrency(balanceDue.toString())}
                </p>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="p-5 space-y-4 text-xs">
            {/* Amount input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="settle-amount" className="text-xs font-semibold">
                  Amount to Collect (₹) *
                </Label>
                <button
                  type="button"
                  onClick={() => setAmount(String(maxDue))}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Full balance ({formatCurrency(maxDue.toString())})
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2 text-muted-foreground font-mono font-bold">₹</span>
                <Input
                  id="settle-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={maxDue}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7 font-mono font-bold text-sm"
                  required
                />
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Payment Method *</Label>
              <SearchableSelect
                value={method}
                onChange={setMethod}
                options={PAYMENT_METHODS}
                placeholder="Select payment method"
                className="h-9 text-xs"
              />
            </div>

            {/* Reference Number */}
            <div className="space-y-1.5">
              <Label htmlFor="settle-ref" className="text-xs font-semibold">
                Transaction Reference / Auth Code
              </Label>
              <Input
                id="settle-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. UPI Ref #, Card last 4 digits, Cheque #"
                className="text-xs font-mono"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="settle-notes" className="text-xs font-semibold">
                Counter Notes (Optional)
              </Label>
              <Input
                id="settle-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Received from customer at desk counter"
                className="text-xs"
              />
            </div>

            {customerName && (
              <p className="text-[11px] text-muted-foreground italic">
                * Customer ledger for <strong>{customerName}</strong> will be automatically credited with this settlement.
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-muted/30 border-t flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || Number(amount) <= 0}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Confirm Payment ({formatCurrency(amount || '0')})
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
