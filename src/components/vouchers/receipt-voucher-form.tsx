'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Building,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileCode,
  FileText,
  HelpCircle,
  IndianRupee,
  Layers,
  Plus,
  RefreshCw,
  Search,
  User,
  Wallet,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { BillAllocationInput, InstrumentType } from '@/lib/vouchers/voucher-validations'
import { BillAllocationModal, type UnpaidInvoice } from './bill-allocation-modal'

export interface BranchOption {
  id: string
  name: string
  code?: string | null
}

export interface LedgerOption {
  id: string
  code: string
  name: string
  group: string | null
  balance: number | string
}

export interface CustomerOption {
  id: string
  name: string
  phone: string | null
  outstandingBalance: number
  unpaidInvoicesCount?: number
}

export interface ReceiptVoucherItem {
  id: string
  voucherNumber: string
  date: string | Date
  narration?: string | null
  amount: number
  debitLedgerName: string
  customerName: string
  customerPhone?: string | null
  allocationsCount: number
  branchName?: string | null
  createdByName?: string | null
  createdAt: string | Date
}

interface ReceiptVoucherFormProps {
  branches: BranchOption[]
  initialLedgers: LedgerOption[]
  initialCustomers: CustomerOption[]
  initialVouchers: ReceiptVoucherItem[]
  defaultBranchId?: string
}

export function ReceiptVoucherForm({
  branches,
  initialLedgers,
  initialCustomers,
  initialVouchers,
  defaultBranchId,
}: ReceiptVoucherFormProps) {
  const toast = useToast()

  // Master data state
  const [ledgers, setLedgers] = useState<LedgerOption[]>(initialLedgers)
  const [customers, setCustomers] = useState<CustomerOption[]>(initialCustomers)
  const [vouchers, setVouchers] = useState<ReceiptVoucherItem[]>(initialVouchers)
  const [loadingVouchers, setLoadingVouchers] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form states
  const [branchId, setBranchId] = useState(defaultBranchId || branches[0]?.id || '')
  const [voucherNumber, setVoucherNumber] = useState('')
  const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().split('T')[0])
  const [debitLedgerId, setDebitLedgerId] = useState(initialLedgers[0]?.id || '')
  const [customerId, setCustomerId] = useState('')
  const [amount, setAmount] = useState<number | ''>('')
  const [instrumentType, setInstrumentType] = useState<InstrumentType>('CASH')
  const [instrumentNumber, setInstrumentNumber] = useState('')
  const [instrumentDate, setInstrumentDate] = useState('')
  const [bankName, setBankName] = useState('')
  const [narration, setNarration] = useState('')

  // Party stats & Unpaid Bills
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [customerBalance, setCustomerBalance] = useState<number>(0)

  // Allocations modal state
  const [allocations, setAllocations] = useState<BillAllocationInput[]>([])
  const [isAllocModalOpen, setIsAllocModalOpen] = useState(false)

  // Voucher preview modal
  const [selectedVoucherPreview, setSelectedVoucherPreview] = useState<any | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // Filter for vouchers register
  const [searchFilter, setSearchFilter] = useState('')

  // References for keyboard navigation
  const formRef = useRef<HTMLDivElement>(null)

  // Fetch unpaid invoices and balance when customerId changes
  useEffect(() => {
    if (!customerId) {
      setUnpaidInvoices([])
      setCustomerBalance(0)
      setAllocations([])
      return
    }

    const selectedCust = customers.find((c) => c.id === customerId)
    if (selectedCust) {
      setCustomerBalance(selectedCust.outstandingBalance)
    }

    setLoadingInvoices(true)
    fetch(`/api/vouchers/receipt/unpaid-bills?customerId=${customerId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setUnpaidInvoices(json.data.unpaidBills)
          setCustomerBalance(json.data.customerSummary.outstandingBalance)
          // If amount is set and allocations empty, auto-allocate
          if (typeof amount === 'number' && amount > 0 && allocations.length === 0) {
            autoAllocate(amount, json.data.unpaidBills)
          }
        }
      })
      .catch(() => toast.error('Failed to load customer invoices'))
      .finally(() => setLoadingInvoices(false))
  }, [customerId])

  // Helper for quick auto allocation
  const autoAllocate = (amt: number, bills: UnpaidInvoice[]) => {
    let remaining = amt
    const newAllocations: BillAllocationInput[] = []

    for (const bill of bills) {
      if (remaining <= 0.001) break
      const alloc = Math.min(remaining, bill.balanceDue)
      const rounded = Math.round(alloc * 100) / 100
      if (rounded > 0) {
        newAllocations.push({
          refType: 'AGST_REF',
          invoiceId: bill.id,
          refNumber: bill.invoiceNumber,
          allocatedAmount: rounded,
        })
        remaining = Math.max(0, Math.round((remaining - rounded) * 100) / 100)
      }
    }

    if (remaining > 0.001) {
      newAllocations.push({
        refType: 'ADVANCE',
        invoiceId: null,
        refNumber: 'ADVANCE',
        allocatedAmount: Math.round(remaining * 100) / 100,
      })
    }

    setAllocations(newAllocations)
  }

  // Handle amount change
  const handleAmountChange = (val: number | '') => {
    setAmount(val)
    if (typeof val === 'number' && val > 0 && customerId) {
      autoAllocate(val, unpaidInvoices)
    } else {
      setAllocations([])
    }
  }

  // Refetch vouchers register
  const refreshVouchers = async () => {
    setLoadingVouchers(true)
    try {
      const res = await fetch(`/api/vouchers/receipt?limit=30`)
      const json = await res.json()
      if (json.success) {
        setVouchers(json.data)
      }
    } catch {
      toast.error('Failed to refresh vouchers list')
    } finally {
      setLoadingVouchers(false)
    }
  }

  // Double-entry validation calculation
  const totalAllocated = allocations.reduce((acc, a) => acc + (Number(a.allocatedAmount) || 0), 0)
  const isBalanced =
    typeof amount === 'number' && amount > 0 && Math.abs(amount - totalAllocated) < 0.01

  // Handle keyboard shortcuts (Enter for next field, Ctrl + A for Save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + A or Cmd + A to accept/save voucher
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !isAllocModalOpen && !isPreviewOpen) {
        e.preventDefault()
        handleSubmit()
        return
      }

      // Enter key navigation across inputs
      if (e.key === 'Enter' && !isAllocModalOpen && !isPreviewOpen) {
        const target = e.target as HTMLElement
        if (target && target.tagName !== 'BUTTON' && target.tagName !== 'TEXTAREA') {
          const formElements = formRef.current?.querySelectorAll<HTMLElement>(
            'input, select, [role="combobox"]'
          )
          if (formElements) {
            const elements = Array.from(formElements)
            const currentIndex = elements.indexOf(target)
            if (currentIndex > -1 && currentIndex < elements.length - 1) {
              e.preventDefault()
              elements[currentIndex + 1].focus()
            }
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [branchId, debitLedgerId, customerId, amount, allocations, instrumentType, isAllocModalOpen, isPreviewOpen])

  // Form submit handler
  const handleSubmit = async () => {
    if (!branchId) {
      toast.error('Please select a Branch')
      return
    }
    if (!debitLedgerId) {
      toast.error('Please select a Debit Account (Cash/Bank)')
      return
    }
    if (!customerId) {
      toast.error('Please select a Party (Customer)')
      return
    }
    if (typeof amount !== 'number' || amount <= 0) {
      toast.error('Please enter a valid Receipt Amount')
      return
    }
    if (!isBalanced) {
      toast.error(
        `Allocations (₹${totalAllocated.toFixed(2)}) must equal Receipt Amount (₹${Number(amount).toFixed(2)})`
      )
      setIsAllocModalOpen(true)
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        voucherNumber: voucherNumber.trim() || undefined,
        date: new Date(voucherDate),
        narration: narration.trim() || undefined,
        branchId,
        debitLedgerId,
        customerId,
        amount,
        instrumentType,
        instrumentNumber: instrumentNumber.trim() || undefined,
        instrumentDate: instrumentDate ? new Date(instrumentDate) : undefined,
        bankName: bankName.trim() || undefined,
        allocations,
      }

      const res = await fetch('/api/vouchers/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to create Receipt Voucher')
      }

      toast.success(json.message || 'Receipt Voucher recorded successfully!')

      // Reset form state
      setAmount('')
      setAllocations([])
      setVoucherNumber('')
      setInstrumentNumber('')
      setBankName('')
      setNarration('')

      // Refresh data
      refreshVouchers()

      // Refetch customer unpaid invoices
      if (customerId) {
        const unpaidRes = await fetch(`/api/vouchers/receipt/unpaid-bills?customerId=${customerId}`)
        const unpaidJson = await unpaidRes.json()
        if (unpaidJson.success) {
          setUnpaidInvoices(unpaidJson.data.unpaidBills)
          setCustomerBalance(unpaidJson.data.customerSummary.outstandingBalance)
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  // Download Tally XML
  const handleDownloadTallyXml = (voucherId: string, vchNumber: string) => {
    window.open(`/api/vouchers/receipt/${voucherId}/tally-xml?download=true`, '_blank')
    toast.success(`Exporting ${vchNumber} to Ledger XML`)
  }

  // View voucher details modal
  const handleViewDetails = async (voucherId: string) => {
    try {
      const res = await fetch(`/api/vouchers/receipt/${voucherId}`)
      const json = await res.json()
      if (json.success) {
        setSelectedVoucherPreview(json.data)
        setIsPreviewOpen(true)
      }
    } catch {
      // Fallback
      toast.error('Failed to load voucher details')
    }
  }

  // Filtered vouchers register
  const filteredVouchers = vouchers.filter((v) => {
    if (!searchFilter) return true
    const s = searchFilter.toLowerCase()
    return (
      v.voucherNumber.toLowerCase().includes(s) ||
      v.customerName.toLowerCase().includes(s) ||
      v.debitLedgerName.toLowerCase().includes(s)
    )
  })

  const selectedDebitLedger = ledgers.find((l) => l.id === debitLedgerId)
  const selectedCustomer = customers.find((c) => c.id === customerId)

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950/20 via-background to-background p-5 rounded-xl border">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-md">
            <IndianRupee className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">Receipt Voucher (F6)</h1>
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs uppercase">
                Double-Entry Ledger
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Record customer payments, settle unpaid sales invoices (Agst Ref), and update accounts receivable.
            </p>
          </div>
        </div>

        {/* Hotkeys Quick Reference Bar */}
        <div className="flex items-center gap-2 text-xs bg-muted/60 p-2 rounded-lg border font-mono">
          <span className="text-muted-foreground">Shortcuts:</span>
          <kbd className="px-1.5 py-0.5 bg-background rounded border text-[11px] font-semibold">
            Enter
          </kbd>{' '}
          Next
          <span className="text-muted-foreground">•</span>
          <kbd className="px-1.5 py-0.5 bg-background rounded border text-[11px] font-semibold">
            Ctrl + A
          </kbd>{' '}
          Save
        </div>
      </div>

      {/* Main Form & Entry Box */}
      <Card className="border-emerald-500/30 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              Voucher Entry Particulars
            </CardTitle>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Real-Time Ledger Sync
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6" ref={formRef}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Row 1: Branch, Voucher Number, Date */}
            <div className="md:col-span-4 space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" />
                Branch
              </Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} {b.code ? `(${b.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-4 space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Voucher Number
              </Label>
              <Input
                placeholder="Auto (e.g. RC-2026-0001)"
                value={voucherNumber}
                onChange={(e) => setVoucherNumber(e.target.value)}
                className="h-10 font-mono"
              />
            </div>

            <div className="md:col-span-4 space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Voucher Date
              </Label>
              <Input
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className="h-10 font-mono"
              />
            </div>

            {/* Row 2: Debit Account (Dr) - Cash or Bank */}
            <div className="md:col-span-6 space-y-1.5 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                  <Wallet className="h-4 w-4" />
                  Account (Debit / Dr)
                </Label>
                {selectedDebitLedger && (
                  <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                    Balance: ₹{Number(selectedDebitLedger.balance).toFixed(2)} Dr
                  </span>
                )}
              </div>
              <Select value={debitLedgerId} onValueChange={setDebitLedgerId}>
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Select Cash or Bank Account" />
                </SelectTrigger>
                <SelectContent>
                  {ledgers.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      <span className="font-semibold">{l.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        [{l.group || 'Asset'}]
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Funds received will increase this Cash-in-Hand or Bank Asset account.
              </p>
            </div>

            {/* Row 3: Credit Party (Cr) - Customer / Sundry Debtors */}
            <div className="md:col-span-6 space-y-1.5 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-blue-800 dark:text-blue-400 flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  Particulars / Party (Credit / Cr)
                </Label>
                {customerId && (
                  <Badge
                    variant="outline"
                    className="font-mono text-xs border-blue-400 text-blue-700 dark:text-blue-300"
                  >
                    Balance: ₹{customerBalance.toFixed(2)} Dr
                  </Badge>
                )}
              </div>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Search or select Customer" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-semibold">{c.name}</span>
                      {c.phone && <span className="text-xs text-muted-foreground ml-2">({c.phone})</span>}
                      <span className="text-xs font-mono ml-2 text-rose-600">
                        ₹{Number(c.outstandingBalance).toFixed(2)} Dr
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Receivable balance will decrease upon receipt voucher creation.</span>
                {unpaidInvoices.length > 0 && (
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    {unpaidInvoices.length} Unpaid Invoices
                  </span>
                )}
              </div>
            </div>

            {/* Row 4: Amount & Bill Allocation Trigger */}
            <div className="md:col-span-6 space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Receipt Amount (₹)
              </Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount === '' ? '' : amount}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : parseFloat(e.target.value) || 0
                    handleAmountChange(val)
                  }}
                  className="pl-9 h-10 font-mono text-base font-bold text-emerald-600"
                />
              </div>
            </div>

            {/* Bill Allocations Card Button */}
            <div className="md:col-span-6 space-y-1.5 flex flex-col justify-end">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Bill Allocations (Agst Ref)</span>
                <span className="font-mono text-[11px]">
                  Allocated: ₹{totalAllocated.toFixed(2)} / ₹{typeof amount === 'number' ? amount.toFixed(2) : '0.00'}
                </span>
              </Label>
              <Button
                type="button"
                variant={isBalanced ? 'outline' : 'default'}
                onClick={() => setIsAllocModalOpen(true)}
                disabled={!customerId || typeof amount !== 'number' || amount <= 0}
                className={`h-10 w-full justify-between font-medium ${
                  !isBalanced && typeof amount === 'number' && amount > 0
                    ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                    : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                }`}
              >
                <span className="flex items-center gap-2 text-sm">
                  <Layers className="h-4 w-4" />
                  {allocations.length > 0
                    ? `${allocations.length} Line(s) Configured`
                    : 'Click to Allocate Bills'}
                </span>
                {isBalanced ? (
                  <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Balanced
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    Configure
                  </Badge>
                )}
              </Button>
            </div>

            {/* Row 5: Payment Instrument Details */}
            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" />
                Payment Mode
              </Label>
              <Select
                value={instrumentType}
                onValueChange={(val: InstrumentType) => setInstrumentType(val)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CHEQUE">Cheque / DD</SelectItem>
                  <SelectItem value="UPI">UPI / QR</SelectItem>
                  <SelectItem value="NEFT_RTGS">NEFT / RTGS</SelectItem>
                  <SelectItem value="CARD">Debit / Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Cheque / UTR / Ref No
              </Label>
              <Input
                placeholder={instrumentType === 'CASH' ? 'N/A' : 'Ref # or Cheque #'}
                value={instrumentNumber}
                onChange={(e) => setInstrumentNumber(e.target.value)}
                disabled={instrumentType === 'CASH'}
                className="h-10 font-mono"
              />
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Instrument Date
              </Label>
              <Input
                type="date"
                value={instrumentDate}
                onChange={(e) => setInstrumentDate(e.target.value)}
                disabled={instrumentType === 'CASH'}
                className="h-10 font-mono"
              />
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Bank Name
              </Label>
              <Input
                placeholder={instrumentType === 'CASH' ? 'N/A' : 'Bank Name'}
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                disabled={instrumentType === 'CASH'}
                className="h-10"
              />
            </div>

            {/* Row 6: Narration */}
            <div className="md:col-span-12 space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Narration / Remarks
              </Label>
              <Textarea
                placeholder="Being payment received towards invoices..."
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                className="min-h-[60px] text-sm"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isBalanced ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Double-entry balanced. Ready to save.
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> Receipt amount must match allocated bills before saving.
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAmount('')
                  setAllocations([])
                  setCustomerId('')
                }}
              >
                Reset
              </Button>
              <Button
                type="button"
                disabled={submitting || !isBalanced}
                onClick={handleSubmit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 min-w-[160px]"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Accept (Save Voucher)
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bill Allocation Modal */}
      <BillAllocationModal
        open={isAllocModalOpen}
        onOpenChange={setIsAllocModalOpen}
        customerName={selectedCustomer?.name || 'Party'}
        outstandingBalance={customerBalance}
        voucherAmount={typeof amount === 'number' ? amount : 0}
        unpaidInvoices={unpaidInvoices}
        allocations={allocations}
        onSaveAllocations={(newAllocs) => setAllocations(newAllocs)}
      />

      {/* Recent Receipt Vouchers Register Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileCode className="h-4 w-4 text-primary" />
                Receipt Voucher Register
              </CardTitle>
              <CardDescription className="text-xs">
                History of receipt transactions with Ledger XML export support.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search voucher or party..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={refreshVouchers}
                disabled={loadingVouchers}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingVouchers ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs font-medium text-muted-foreground border-y">
                <tr>
                  <th className="py-2.5 px-4 text-left">Voucher #</th>
                  <th className="py-2.5 px-4 text-left">Date</th>
                  <th className="py-2.5 px-4 text-left">Party (Sundry Debtors)</th>
                  <th className="py-2.5 px-4 text-left">Debit Account</th>
                  <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-4 text-center">Settled Bills</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                      No receipt vouchers found. Record your first receipt above.
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((vch) => (
                    <tr key={vch.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-xs text-primary">
                        {vch.voucherNumber}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(vch.date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {vch.customerName}
                        {vch.customerPhone && (
                          <div className="text-[11px] text-muted-foreground">{vch.customerPhone}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-muted-foreground">
                        {vch.debitLedgerName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                        ₹{Number(vch.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {vch.allocationsCount} bill(s)
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs gap-1 border hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400"
                            onClick={() => handleDownloadTallyXml(vch.id, vch.voucherNumber)}
                            title="Download standard XML for accounting & ledger import"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Ledger XML
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
