'use client'

import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Plus,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/lib/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'

interface SupplierLiability {
  id: string
  name: string
  creditDays: number
  outstandingBalance: number
  gstin?: string | null
  dlNumber?: string | null
  phone?: string | null
  email?: string | null
}

interface InvoicedPurchase {
  id: string
  purchaseNumber: string
  invoiceNumber?: string | null
  invoiceDate?: string | null
  purchaseDate: string
  supplier?: { id: string; name: string } | null
  totalAmount: number
  balanceDue: number
  status: string
}

export function SupplierPaymentsView() {
  const toast = useToast()

  const [suppliers, setSuppliers] = useState<SupplierLiability[]>([])
  const [invoices, setInvoices] = useState<InvoicedPurchase[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Payment Recording Modal State
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'CASH'>('UPI')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentNotes, setPaymentNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Load Suppliers with Outstanding Balances
  const loadPayables = useCallback(async () => {
    setLoading(true)
    try {
      const [supRes, poRes] = await Promise.all([
        fetch('/api/suppliers?limit=100'),
        fetch('/api/purchases?status=INVOICED&limit=50'),
      ])
      const [supJson, poJson] = await Promise.all([supRes.json(), poRes.json()])

      if (supJson.success && Array.isArray(supJson.data)) {
        setSuppliers(supJson.data)
      }
      if (poJson.success && Array.isArray(poJson.data)) {
        setInvoices(poJson.data.filter((p: any) => Number(p.totalAmount) > 0))
      }
    } catch {
      toast.error('Failed to load accounts payable data')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadPayables()
  }, [loadPayables])

  const totalPayables = suppliers.reduce((sum, s) => sum + Math.max(0, Number(s.outstandingBalance) || 0), 0)

  const handleOpenPayForSupplier = (s: SupplierLiability) => {
    setSelectedSupplierId(s.id)
    setSelectedPurchaseId('')
    setPaymentAmount(String(Math.max(0, Number(s.outstandingBalance) || 0)))
    setPaymentReference(`TXN-${Date.now().toString().slice(-6)}`)
    setPayModalOpen(true)
  }

  const handleRecordPayment = async () => {
    if (!selectedSupplierId) {
      toast.error('Supplier selection is required')
      return
    }
    const amt = parseFloat(paymentAmount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Payment amount must be greater than 0')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/supplier-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          purchaseId: selectedPurchaseId || undefined,
          amount: amt,
          method: paymentMethod,
          reference: paymentReference || undefined,
          paymentDate: new Date(paymentDate).toISOString(),
          notes: paymentNotes || undefined,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success(
          `Payment of ${formatCurrency(amt)} recorded successfully! Outstanding balance updated.`
        )
        setPayModalOpen(false)
        void loadPayables()
      } else {
        toast.error(json.error?.message || 'Payment recording failed')
      }
    } catch {
      toast.error('Payment recording failed')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.gstin && s.gstin.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-4">
      {/* Top Payables Summary Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-border/60 bg-gradient-to-br from-card to-background shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Accounts Payable Balance
            </CardTitle>
            <Wallet className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
              {formatCurrency(totalPayables)}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Outstanding vendor liabilities across {suppliers.length} active suppliers
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-gradient-to-br from-card to-background shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Suppliers with Open Balance
            </CardTitle>
            <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {suppliers.filter((s) => Number(s.outstandingBalance) > 0).length}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Subject to agreed payment credit periods
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-gradient-to-br from-card to-background shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Settlement Modes Supported
            </CardTitle>
            <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold mt-1">UPI &middot; NEFT/RTGS &middot; Cheque &middot; Cash</div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Reconciles automatically to Supplier Ledger with audit trail
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search supplier or GSTIN…"
              className="pl-8"
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => void loadPayables()} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <Button
          onClick={() => {
            setSelectedSupplierId(suppliers[0]?.id || '')
            setSelectedPurchaseId('')
            setPaymentAmount('')
            setPaymentReference(`TXN-${Date.now().toString().slice(-6)}`)
            setPayModalOpen(true)
          }}
          className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
        >
          <Plus className="h-4 w-4" />
          Record Supplier Payment
        </Button>
      </div>

      {/* Supplier Ledger & Balance Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Supplier Accounts Payable Ledger & Aging
          </CardTitle>
          <CardDescription>
            Live outstanding liabilities with credit terms and one-click payment settlement.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Supplier Distributor</TableHead>
                <TableHead>Compliance & Contact</TableHead>
                <TableHead>Credit Terms</TableHead>
                <TableHead className="text-right">Outstanding Balance</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    Loading accounts payable balances…
                  </TableCell>
                </TableRow>
              ) : filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    No supplier payables records found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSuppliers.map((s) => {
                  const bal = Number(s.outstandingBalance) || 0
                  const hasLiability = bal > 0

                  return (
                    <TableRow key={s.id} className={hasLiability ? undefined : 'opacity-70'}>
                      <TableCell>
                        <div className="font-semibold text-foreground">{s.name}</div>
                        <div className="text-[11px] text-muted-foreground">ID: {s.id}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.gstin ? (
                          <div className="font-mono text-[11px]">GSTIN: {s.gstin}</div>
                        ) : (
                          <span className="text-muted-foreground">No GSTIN</span>
                        )}
                        {s.dlNumber && (
                          <div className="text-[10px] text-muted-foreground">DL: {s.dlNumber}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {s.creditDays || 30} Days Net
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className={`font-mono text-sm font-bold ${
                            hasLiability
                              ? 'text-purple-600 dark:text-purple-400'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {formatCurrency(bal)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={hasLiability ? 'warning' : 'success'}
                          className="text-[10px]"
                        >
                          {hasLiability ? 'Open Payable' : 'Settled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={hasLiability ? 'default' : 'outline'}
                          className={`h-7 text-xs gap-1 ${
                            hasLiability
                              ? 'bg-purple-600 hover:bg-purple-700 text-white'
                              : 'text-muted-foreground'
                          }`}
                          onClick={() => handleOpenPayForSupplier(s)}
                        >
                          <CreditCard className="h-3 w-3" />
                          Pay Vendor
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Record Payment Modal */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple-600" />
              Record Supplier Payment
            </DialogTitle>
            <DialogDescription>
              Disburse full or partial payment against supplier account. Reduces outstanding balance and commits to ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            {/* Supplier Selector */}
            <div className="space-y-1">
              <Label className="text-xs">Supplier Distributor *</Label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Supplier…" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} (Bal: {formatCurrency(s.outstandingBalance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Optional Specific PO / Bill Link */}
            {invoices.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Link to Invoiced PO (Optional)</Label>
                <Select
                  value={selectedPurchaseId || 'none'}
                  onValueChange={(v) => setSelectedPurchaseId(v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="General Account Payment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General Supplier Balance Payment</SelectItem>
                    {invoices
                      .filter(
                        (p) => !selectedSupplierId || p.supplier?.id === selectedSupplierId
                      )
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.purchaseNumber} {p.invoiceNumber ? `(${p.invoiceNumber})` : ''} — Bal:{' '}
                          {formatCurrency(p.balanceDue || p.totalAmount)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Amount & Method */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Amount Paid (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="font-mono text-sm font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Payment Method *</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v: any) => setPaymentMethod(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UPI">UPI (GooglePay / PhonePe)</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reference & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Transaction Ref / UTR / Cheque #</Label>
                <Input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="UTR-2938491823"
                  className="font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Payment Date *</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs">Payment Notes</Label>
              <Input
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Advance payment, invoice settlement, etc."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleRecordPayment()}
              disabled={submitting || !paymentAmount}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {submitting ? 'Recording…' : 'Confirm & Disburse'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
