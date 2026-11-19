'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Check,
  CreditCard,
  DollarSign,
  FileCheck,
  Percent,
  Plus,
  Printer,
  ShieldAlert,
  Stethoscope,
  UserCheck,
} from 'lucide-react'

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
import { useToast } from '@/lib/hooks/use-toast'
import { calculateIntelligentBillDiscount } from '@/lib/pricing/discount-exemption'
import { playSuccessCheckoutSound, playWarningSound } from '@/lib/sound/sound-effects'
import type { CustomerProfileData } from './customer-profiling-bar'

export interface DoctorOption {
  id: string
  name: string
  regNumber?: string | null
  clinicName?: string | null
  commissionPercent: number
}

interface BillFinalizeDialogProps {
  items?: any[]
  open: boolean
  onOpenChange: (open: boolean) => void
  subtotal: number
  itemDiscountTotal: number
  taxTotal: number
  grossTotal: number
  customerName?: string
  selectedCustomer?: CustomerProfileData | null
  doctors: DoctorOption[]
  onFinalizeBill: (params: {
    doctorId?: string
    doctorName?: string
    doctorCommissionPercent?: number
    billDiscountPercent: number
    roundOff: number
    paymentMethod: string
    paymentReference?: string
    cashTendered?: number
    changeAmount?: number
  }) => void
  saving?: boolean
}

export function BillFinalizeDialog({
  items = [],
  open,
  onOpenChange,
  subtotal,
  itemDiscountTotal,
  taxTotal,
  grossTotal,
  customerName,
  selectedCustomer,
  doctors,
  onFinalizeBill,
  saving,
}: BillFinalizeDialogProps) {
  const toast = useToast()

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('')
  const [billDiscountPercent, setBillDiscountPercent] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH')
  const [paymentReference, setPaymentReference] = useState<string>('')
  const [cashTendered, setCashTendered] = useState<number>(0)

  // Quick doctor add dialog state
  const [addDoctorOpen, setAddDoctorOpen] = useState(false)
  const [newDocName, setNewDocName] = useState('')
  const [newDocReg, setNewDocReg] = useState('')
  const [newDocClinic, setNewDocClinic] = useState('')
  const [newDocCommission, setNewDocCommission] = useState(5)
  const [savingDoc, setSavingDoc] = useState(false)

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId)

  // Map items to calculate intelligent DPCO/statutory exemption
  const itemsForCalc = useMemo(() => {
    return (items || []).map((l: any) => ({
      id: l.productId || l.id,
      name: l.name,
      grossAmount: Number(l.mrp || 0) * Number(l.quantity || 1),
      dpcoCeiling: l.dpcoCeiling,
      drugSchedule: l.drugSchedule,
      isDiscountable: l.isDiscountable,
      categoryName: l.categoryName,
    }))
  }, [items])

  const intelligentDiscount = useMemo(() => {
    return calculateIntelligentBillDiscount(itemsForCalc, billDiscountPercent)
  }, [itemsForCalc, billDiscountPercent])

  // Calculations
  const billDiscountAmount = intelligentDiscount.billDiscountAmount
  const totalBeforeRoundOff = Math.max(0, grossTotal - billDiscountAmount)
  const netPayable = Math.round(totalBeforeRoundOff)
  const roundOff = Math.round((netPayable - totalBeforeRoundOff) * 100) / 100
  const changeToReturn = Math.max(0, Math.round(((cashTendered || 0) - netPayable) * 100) / 100)

  useEffect(() => {
    if (open) {
      setCashTendered(netPayable)
    }
  }, [netPayable, open])

  // Doctor commission amount preview
  const commissionAmount =
    selectedDoctor && selectedDoctor.commissionPercent > 0
      ? Math.round(((netPayable * selectedDoctor.commissionPercent) / 100) * 100) / 100
      : 0

  const handleSaveDoctor = async () => {
    if (!newDocName.trim()) {
      toast.error('Doctor name is required')
      return
    }

    setSavingDoc(true)
    try {
      const res = await fetch('/api/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDocName.trim(),
          regNumber: newDocReg.trim() || undefined,
          clinicName: newDocClinic.trim() || undefined,
          commissionPercent: newDocCommission,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to add doctor')
      }

      doctors.push(json.data)
      setSelectedDoctorId(json.data.id)
      toast.success(`Doctor ${json.data.name} saved and tagged`)
      setAddDoctorOpen(false)
      setNewDocName('')
    } catch (err: any) {
      toast.error(err.message || 'Error saving doctor')
    } finally {
      setSavingDoc(false)
    }
  }

  const handleConfirm = () => {
    playSuccessCheckoutSound()
    onFinalizeBill({
      doctorId: selectedDoctor?.id,
      doctorName: selectedDoctor?.name,
      doctorCommissionPercent: selectedDoctor?.commissionPercent,
      billDiscountPercent,
      roundOff,
      paymentMethod,
      paymentReference: paymentReference.trim() || undefined,
      cashTendered: paymentMethod === 'CASH' ? cashTendered || netPayable : undefined,
      changeAmount: paymentMethod === 'CASH' ? changeToReturn : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FileCheck className="h-5 w-5 text-emerald-600" />
              Finalize & Save Bill
            </DialogTitle>
            <Badge className="bg-emerald-600 font-mono text-xs text-white">
              Fast Finalize (Ctrl+W)
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            Tag doctor commission, apply bill-level discount, and record payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1 text-xs">
          {/* Prescribing Doctor Tagging Section */}
          <div className="space-y-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-300">
                <Stethoscope className="h-3.5 w-3.5" />
                Referring Doctor Tagging
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 p-0 text-[11px] text-blue-600 dark:text-blue-400"
                onClick={() => setAddDoctorOpen(true)}
              >
                <Plus className="mr-0.5 h-3 w-3" /> New Doctor
              </Button>
            </div>

            <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
              <SelectTrigger className="h-9 bg-background">
                <SelectValue placeholder="Select Prescribing Doctor (Optional)" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="NONE">None / Over-the-counter</SelectItem>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    <span className="font-semibold">{d.name}</span>
                    {d.clinicName && (
                      <span className="ml-1.5 text-muted-foreground">({d.clinicName})</span>
                    )}
                    {d.commissionPercent > 0 && (
                      <span className="ml-2 font-mono text-emerald-600">
                        [{d.commissionPercent}% Comm.]
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedDoctor && selectedDoctor.commissionPercent > 0 && (
              <div className="flex items-center justify-between pt-1 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                <span>Commission Rate: {selectedDoctor.commissionPercent}%</span>
                <span className="font-bold">
                  Estimated Commission: ₹{commissionAmount.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Bill-Level Discount & Payment Details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  <Percent className="h-3 w-3" />
                  Overall Bill Discount (%)
                </Label>
                {billDiscountPercent > 0 && intelligentDiscount.billDiscountAmount > 0 && (
                  <span className="font-mono text-[11px] font-bold text-emerald-600">
                    -₹{intelligentDiscount.billDiscountAmount.toFixed(2)}
                  </span>
                )}
              </div>
              <Input
                type="number"
                min="0"
                max="100"
                value={billDiscountPercent}
                onChange={(e) =>
                  setBillDiscountPercent(
                    Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                  )
                }
                className="h-9 text-right font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <CreditCard className="h-3 w-3" />
                Payment Method
              </Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="UPI">UPI / QR Code</SelectItem>
                  <SelectItem value="CARD">Debit / Credit Card</SelectItem>
                  <SelectItem value="CREDIT">Customer Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Intelligent Exemption Notice */}
            {intelligentDiscount.exemptCount > 0 && (
              <div className="col-span-2 flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
                <div className="leading-tight">
                  <span className="font-semibold">Statutory DPCO Exemption:</span> {intelligentDiscount.exemptCount} medicine(s) (₹{intelligentDiscount.exemptGrossAmount.toFixed(2)}) are statutory price-controlled. Discount applies strictly to ₹{intelligentDiscount.eligibleGrossAmount.toFixed(2)} eligible medicines.
                </div>
              </div>
            )}
          </div>

          {paymentMethod === 'CASH' && (
            <div className="space-y-2 rounded-lg border border-border/80 bg-card/60 p-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5 text-teal-600" />
                  Cash Received / Tendered (₹)
                </Label>
                <span className="font-mono text-[11px] text-muted-foreground">
                  Net Due: ₹{netPayable.toFixed(2)}
                </span>
              </div>
              <Input
                type="number"
                min="0"
                step="1"
                value={cashTendered || ''}
                onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                className="h-9 font-mono text-sm font-bold"
                placeholder={`₹${netPayable}`}
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => setCashTendered(netPayable)}
                >
                  Exact (₹{netPayable})
                </Button>
                {[100, 200, 500, 1000, 2000]
                  .filter((d) => d >= netPayable)
                  .slice(0, 4)
                  .map((denom) => (
                    <Button
                      key={denom}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 font-mono text-[10px]"
                      onClick={() => setCashTendered(denom)}
                    >
                      ₹{denom}
                    </Button>
                  ))}
              </div>
              <div className="flex items-center justify-between rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs font-medium">
                <span className="text-emerald-800 dark:text-emerald-300">💵 Change to Return:</span>
                <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  ₹{changeToReturn.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {paymentMethod === 'CREDIT' && (
            <div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
              {!selectedCustomer && !customerName ? (
                <div className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                  ⚠️ Khata / Udhaar requires a customer to be selected. Please tag customer before
                  credit finalization.
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-amber-900 dark:text-amber-200">
                    Patient Khata Ledger: <strong>{selectedCustomer?.name || customerName}</strong>
                  </span>
                  <span className="font-mono font-bold text-amber-800 dark:text-amber-300">
                    Current Udhaar: ₹{(selectedCustomer?.outstandingBalance || 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {paymentMethod === 'UPI' && (
            <div className="space-y-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                  📲 Dynamic UPI QR
                </span>
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 text-[10px] text-emerald-600"
                >
                  Paytm / PhonePe / GPay
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Customer scans the dynamic QR code displayed on screen or printed thermal receipt
                for ₹{netPayable.toFixed(2)}.
              </p>
            </div>
          )}

          {paymentMethod !== 'CASH' && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Payment Reference / Transaction ID
              </Label>
              <Input
                placeholder="UPI UTR, Card Auth Code, or Cheque Ref"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="h-9 font-mono"
              />
            </div>
          )}

          {/* Financial Totals Summary Card */}
          <div className="space-y-1.5 rounded-lg border bg-muted/50 p-3 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Gross Subtotal:</span>
              <span className="font-mono">₹{subtotal.toFixed(2)}</span>
            </div>
            {itemDiscountTotal > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Item Discounts:</span>
                <span className="font-mono">-₹{itemDiscountTotal.toFixed(2)}</span>
              </div>
            )}
            {billDiscountAmount > 0 && (
              <div className="flex justify-between font-medium text-emerald-600">
                <span>Bill Discount ({billDiscountPercent}%):</span>
                <span className="font-mono">-₹{billDiscountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>GST Tax Amount:</span>
              <span className="font-mono">+₹{taxTotal.toFixed(2)}</span>
            </div>
            {roundOff !== 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Round-off:</span>
                <span className="font-mono">
                  {roundOff > 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 text-sm font-bold text-foreground">
              <span>Net Amount Payable:</span>
              <span className="font-mono text-base text-emerald-600">₹{netPayable.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Back to Cart
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={handleConfirm}
            className="min-w-[160px] bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
          >
            {saving ? 'Saving Bill...' : 'Accept & Print Bill'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Inline Quick Add Doctor Modal */}
      <Dialog open={addDoctorOpen} onOpenChange={setAddDoctorOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-sm font-bold">
              <Stethoscope className="h-4 w-4 text-blue-600" />
              Add Prescribing Doctor
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Doctor Name *</Label>
              <Input
                placeholder="Dr. Rajesh Sharma"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Medical Council Reg. No</Label>
              <Input
                placeholder="MCI-12345"
                value={newDocReg}
                onChange={(e) => setNewDocReg(e.target.value)}
                className="h-8 font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Clinic / Hospital</Label>
              <Input
                placeholder="City Care Hospital"
                value={newDocClinic}
                onChange={(e) => setNewDocClinic(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Commission Rate (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={newDocCommission}
                onChange={(e) => setNewDocCommission(parseFloat(e.target.value) || 0)}
                className="h-8 text-right font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddDoctorOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingDoc || !newDocName.trim()}
              onClick={handleSaveDoctor}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Save Doctor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
