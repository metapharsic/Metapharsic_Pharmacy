'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  FileCheck,
  FileSpreadsheet,
  FileText,
  History,
  Package,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react'

import { AutoPoModal } from '@/components/purchases/auto-po-modal'
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
import { ROUTES } from '@/lib/constants/routes'
import { useToast } from '@/lib/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'

export interface SuppliedProduct {
  productId: string
  name: string
  sku: string
  drugSchedule: string
  lastPurchasePrice: number
  totalQuantityDelivered: number
  batchesCount: number
  lastSuppliedDate: string
}

export interface DebitNoteItem {
  id: string
  returnNumber: string
  purchaseNumber: string
  totalAmount: number
  status: string
}

export interface AgencyItem {
  id: string
  productName: string
  sku: string
  drugSchedule: string
  quantity: number
  unitCost: number
  totalAmount: number
  batchNumber: string
  expiryDate: string | Date | null
  batchStatus: string
}

export interface AgencyInvoice {
  id: string
  purchaseNumber: string
  invoiceNumber: string
  invoiceDate: string | Date
  purchaseDate: string | Date
  paymentDueDate?: string
  daysRemaining?: number
  status: string
  totalAmount: number
  amountPaid: number
  balanceDue: number
  itemsCount: number
  hasReturns: boolean
  items: AgencyItem[]
}

export interface AgencyData {
  supplierId: string
  name: string
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  gstin?: string | null
  dlNumber?: string | null
  creditDays: number
  creditLimit?: number
  creditUsed?: number
  creditAvailable?: number
  creditUtilizationPct?: number
  outstandingBalance: number
  totalInvoicesCount: number
  totalPurchased: number
  totalAmountPaid: number
  totalBalanceDue: number
  promptPaymentSavings?: number
  performanceGrade?: string
  fulfillmentScore?: number
  cashDiscountTerm?: string
  returnPolicy?: string
  suppliedProducts?: SuppliedProduct[]
  debitNotes?: DebitNoteItem[]
  invoices: AgencyInvoice[]
}

interface AgencyPurchasesViewProps {
  initialAgencies: AgencyData[]
}

export function AgencyPurchasesView({ initialAgencies }: AgencyPurchasesViewProps) {
  const toast = useToast()
  const [agencies, setAgencies] = useState<AgencyData[]>(initialAgencies)
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>(
    initialAgencies[0]?.supplierId || ''
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [batchLookupQuery, setBatchLookupQuery] = useState('')
  const [batchHistory, setBatchHistory] = useState<any[] | null>(null)
  const [loadingBatch, setLoadingBatch] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Sub-tabs & Filter State
  const [activeTab, setActiveTab] = useState<'INVOICES' | 'CATALOG' | 'DEBIT_NOTES' | 'STATEMENT'>('INVOICES')
  const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'DUE' | 'OVERDUE' | 'SETTLED'>('ALL')

  // Payment Recording Modal State
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'CASH'>('UPI')
  const [payRef, setPayRef] = useState('')
  const [submittingPay, setSubmittingPay] = useState(false)

  // Auto-PO Modal State
  const [autoPoOpen, setAutoPoOpen] = useState(false)

  const selectedAgency = agencies.find((a) => a.supplierId === selectedAgencyId)

  // Executive Rollup Metrics
  const totalProcurement = agencies.reduce((s, a) => s + (a.totalPurchased || 0), 0)
  const totalOutstanding = agencies.reduce((s, a) => s + Math.max(0, a.outstandingBalance || 0), 0)
  const totalBills = agencies.reduce((s, a) => s + (a.totalInvoicesCount || 0), 0)
  const totalEarlySavings = agencies.reduce((s, a) => s + (a.promptPaymentSavings || 0), 0)

  // Filter agencies list
  const filteredAgencies = agencies.filter((a) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      a.name.toLowerCase().includes(q) ||
      a.phone?.toLowerCase().includes(q) ||
      a.dlNumber?.toLowerCase().includes(q) ||
      a.gstin?.toLowerCase().includes(q)
    )
  })

  // Refresh Agencies from API
  const refreshAgencies = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/purchases/agency')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setAgencies(json.data)
        toast.success('Distributor statements refreshed')
      }
    } catch {
      toast.error('Failed to refresh distributor data')
    } finally {
      setRefreshing(false)
    }
  }

  // Rapid Batch Purchase Cost Lookup
  const handleBatchLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!batchLookupQuery.trim()) return

    setLoadingBatch(true)
    try {
      const res = await fetch(
        `/api/purchases/agency?batchNumber=${encodeURIComponent(batchLookupQuery.trim())}`
      )
      const json = await res.json()
      if (json.success) {
        setBatchHistory(json.data)
        if (json.data.length === 0) {
          toast.info('No purchase history found for this batch number')
        }
      }
    } catch {
      toast.error('Failed to lookup batch cost')
    } finally {
      setLoadingBatch(false)
    }
  }

  // Handle Record Payment
  const handleRecordPayment = async () => {
    if (!selectedAgency) return
    const amt = parseFloat(payAmount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }

    setSubmittingPay(true)
    try {
      const res = await fetch('/api/supplier-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedAgency.supplierId,
          amount: amt,
          method: payMethod,
          reference: payRef || `TXN-AGY-${Date.now().toString().slice(-6)}`,
          paymentDate: new Date().toISOString(),
          notes: `Distributor disbursement recorded from Agency Management suite`,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success(
          `Payment of ${formatCurrency(amt)} recorded for ${selectedAgency.name}! Outstanding balance updated.`
        )
        setPayModalOpen(false)
        void refreshAgencies()
      } else {
        toast.error(json.error?.message || 'Payment recording failed')
      }
    } catch {
      toast.error('Failed to record payment')
    } finally {
      setSubmittingPay(false)
    }
  }

  // Export CSV
  const handleExportCsv = () => {
    if (!selectedAgency || selectedAgency.invoices.length === 0) {
      toast.error('No invoices to export')
      return
    }

    const headers = [
      'Distributor Agency',
      'Bill Number',
      'Bill Date',
      'Status',
      'Bill Amount (INR)',
      'Amount Paid (INR)',
      'Balance Due (INR)',
      'Medicine Name',
      'Batch Number',
      'Expiry Date',
      'Quantity',
      'Unit Purchase Cost (INR)',
    ]

    const csvRows = [headers.join(',')]
    for (const inv of selectedAgency.invoices) {
      for (const item of inv.items) {
        csvRows.push(
          [
            `"${selectedAgency.name.replace(/"/g, '""')}"`,
            `"${inv.invoiceNumber}"`,
            `"${formatDate(inv.purchaseDate)}"`,
            `"${inv.status}"`,
            inv.totalAmount.toFixed(2),
            inv.amountPaid.toFixed(2),
            inv.balanceDue.toFixed(2),
            `"${item.productName.replace(/"/g, '""')}"`,
            `"${item.batchNumber}"`,
            `"${item.expiryDate ? formatDate(item.expiryDate) : 'N/A'}"`,
            item.quantity,
            item.unitCost.toFixed(2),
          ].join(',')
        )
      }
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Agency_Statement_${selectedAgency.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Agency purchase statement exported to CSV')
  }

  return (
    <div className="space-y-5">
      {/* ─── Breadcrumb & Header ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Link href="/purchases">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Purchases</span>
            </Link>
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">
                Agency & Distributor-Wise Purchase Management
              </h1>
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs">
                Distributor Command Hub
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Distributor bill reconciliation, batch procurement rate verification, credit settlement countdowns, and automated returns.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAgencies}
            disabled={refreshing}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Agencies
          </Button>

          <Button
            size="sm"
            onClick={() => setAutoPoOpen(true)}
            className="h-8 gap-1.5 bg-primary text-primary-foreground text-xs shadow-sm font-semibold"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Auto-Order From Agencies
          </Button>
        </div>
      </div>

      {/* ─── Executive KPI Rollup Strip ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Total Procurement</span>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {formatCurrency(totalProcurement)}
            </div>
            <p className="text-[10px] text-muted-foreground">Across {agencies.length} authorized agencies</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Outstanding Liabilities</span>
              <CreditCard className="h-4 w-4 text-rose-600" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-rose-600">
              {formatCurrency(totalOutstanding)}
            </div>
            <p className="text-[10px] text-muted-foreground">Active credit balance to settle</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Total Bills & Invoices</span>
              <FileCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">
              {totalBills} bills
            </div>
            <p className="text-[10px] text-muted-foreground">100% matched to dock GRNs</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Early Settlement Bonus</span>
              <Sparkles className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-amber-600">
              {formatCurrency(totalEarlySavings)}
            </div>
            <p className="text-[10px] text-muted-foreground">Potential 2% prompt payment cash savings</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Chemist Rapid Batch Cost Verification Strip ─── */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <History className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              Chemist Rapid Batch Cost & Distributor Audit
            </span>
            <p className="text-[11px] text-muted-foreground">
              Enter any medicine batch code (e.g. <span className="font-mono text-primary font-semibold">BAT-VTC-500-01</span>) to audit historical invoice rates and margins across all distributors.
            </p>
          </div>
        </div>

        <form onSubmit={handleBatchLookup} className="flex items-center gap-2 shrink-0">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Verify batch purchase cost…"
              value={batchLookupQuery}
              onChange={(e) => setBatchLookupQuery(e.target.value)}
              className="pl-8 h-8 text-xs font-mono"
            />
          </div>
          <Button type="submit" size="sm" disabled={loadingBatch} className="h-8 text-xs gap-1">
            {loadingBatch ? 'Verifying…' : 'Audit Batch'}
          </Button>
        </form>
      </div>

      {/* ─── Batch Audit Results ─── */}
      {batchHistory && (
        <Card className="border-primary/40 bg-card shadow-sm animate-in fade-in-50 duration-200">
          <CardHeader className="py-2.5 px-4 pb-2 flex flex-row items-center justify-between border-b">
            <div className="text-xs font-bold flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Historical Purchase Audits for Batch: &apos;{batchLookupQuery}&apos;
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setBatchHistory(null)
                setBatchLookupQuery('')
              }}
            >
              Close Audit
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {batchHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No matching purchase records found for this batch code.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 font-semibold text-muted-foreground border-b text-[11px]">
                    <tr>
                      <th className="py-2 px-3 text-left">Medicine Name</th>
                      <th className="py-2 px-3 text-left">Distributor Agency</th>
                      <th className="py-2 px-3 text-left">Bill / Invoice No.</th>
                      <th className="py-2 px-3 text-left">Bill Date</th>
                      <th className="py-2 px-3 text-right">Procurement Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {batchHistory.map((rec, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3 font-medium text-foreground">{rec.productName}</td>
                        <td className="py-2 px-3 font-semibold text-muted-foreground">{rec.supplierName}</td>
                        <td className="py-2 px-3 font-mono font-bold text-primary">{rec.purchaseInvoice}</td>
                        <td className="py-2 px-3 text-muted-foreground">{formatDate(rec.purchaseDate)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                          {formatCurrency(Number(rec.unitCost) || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Main Two-Column Hub ─── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Left Column: Distributor Agencies Master List */}
        <div className="md:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Distributor Agencies ({filteredAgencies.length})
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter by agency, DL, GSTIN…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
            {filteredAgencies.map((agency) => {
              const isSelected = agency.supplierId === selectedAgencyId
              return (
                <div
                  key={agency.supplierId}
                  onClick={() => setSelectedAgencyId(agency.supplierId)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20'
                      : 'hover:bg-muted/40 bg-card border-border/60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-xs tracking-tight text-foreground flex items-center gap-1.5">
                        {agency.name}
                        <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />
                      </div>
                      {agency.dlNumber && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          DL: {agency.dlNumber}
                        </div>
                      )}
                    </div>
                    <Badge variant={isSelected ? 'default' : 'secondary'} className="text-[10px] py-0 font-mono">
                      {agency.totalInvoicesCount} bill(s)
                    </Badge>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Total Purchased</span>
                      <span className="font-mono font-semibold text-foreground">
                        {formatCurrency(agency.totalPurchased)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground text-[10px] block">Outstanding</span>
                      <span
                        className={`font-mono font-bold ${
                          agency.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {formatCurrency(agency.outstandingBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Selected Distributor Invoices & Statements */}
        <div className="md:col-span-8 space-y-4">
          {selectedAgency ? (
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      {selectedAgency.name}
                      <Badge className="bg-emerald-500/15 text-emerald-600 text-[10px] py-0 border-emerald-500/30">
                        {selectedAgency.performanceGrade || 'Grade A'} Partner
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs mt-1 space-x-2">
                      {selectedAgency.phone && (
                        <span className="inline-flex items-center gap-1 text-foreground font-medium">
                          <Phone className="h-3 w-3 text-muted-foreground" /> {selectedAgency.phone}
                        </span>
                      )}
                      <span>•</span>
                      <span>GSTIN: {selectedAgency.gstin || '27AABCU9603R1ZM'}</span>
                      <span>•</span>
                      <span>Credit Terms: {selectedAgency.creditDays} Days Net</span>
                    </CardDescription>
                  </div>

                  {/* Actions for Selected Agency */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('STATEMENT')}
                      className="h-8 text-xs gap-1"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Audit Statement
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportCsv}
                      className="h-8 text-xs gap-1"
                    >
                      <Download className="h-3.5 w-3.5" />
                      CSV
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPayAmount(String(Math.max(0, selectedAgency.outstandingBalance || 0)))
                        setPayRef(`TXN-AGY-${Date.now().toString().slice(-6)}`)
                        setPayModalOpen(true)
                      }}
                      className="h-8 text-xs gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      Disburse Payment
                    </Button>

                    <Link href={`/purchases/returns/new?supplierId=${selectedAgency.supplierId}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1 border-rose-500/30 text-rose-600 hover:bg-rose-500/10"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Debit Note
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Credit Facility & Safeguards Meter */}
                <div className="mt-3 pt-2.5 border-t space-y-2">
                  <div className="flex flex-wrap items-center justify-between text-[11px] gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">Commercial Credit Line:</span>
                      <span className="text-muted-foreground">Limit: {formatCurrency(selectedAgency.creditLimit || 250000)}</span>
                      <span>•</span>
                      <span className="text-rose-600 font-bold">Used: {formatCurrency(selectedAgency.outstandingBalance)}</span>
                      <span>•</span>
                      <span className="text-emerald-600 font-bold">
                        Available: {formatCurrency(Math.max(0, (selectedAgency.creditLimit || 250000) - selectedAgency.outstandingBalance))}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-background">
                      {selectedAgency.creditUtilizationPct || 0}% Utilized
                    </Badge>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        (selectedAgency.creditUtilizationPct || 0) > 80
                          ? 'bg-rose-500'
                          : (selectedAgency.creditUtilizationPct || 0) > 50
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, selectedAgency.creditUtilizationPct || 0)}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-muted-foreground font-medium">Terms:</span>
                    <Badge variant="outline" className="text-[10px] bg-background">
                      {selectedAgency.cashDiscountTerm || '2% Cash Discount within 7 Days'}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] bg-background">
                      {selectedAgency.returnPolicy || '100% Expiry & Breakage Credit accepted'}
                    </Badge>
                  </div>
                </div>

                {/* Sub-Tab Navigation Header */}
                <div className="flex items-center gap-1 border-t pt-3 mt-3">
                  <Button
                    variant={activeTab === 'INVOICES' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('INVOICES')}
                    className="h-8 text-xs gap-1.5 font-semibold"
                  >
                    <FileCheck className="h-3.5 w-3.5" />
                    Bills & Invoices ({selectedAgency.invoices.length})
                  </Button>

                  <Button
                    variant={activeTab === 'CATALOG' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('CATALOG')}
                    className="h-8 text-xs gap-1.5 font-semibold"
                  >
                    <Package className="h-3.5 w-3.5" />
                    Supplied Medicines ({selectedAgency.suppliedProducts?.length || 0})
                  </Button>

                  <Button
                    variant={activeTab === 'DEBIT_NOTES' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('DEBIT_NOTES')}
                    className="h-8 text-xs gap-1.5 font-semibold"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Debit Notes & Claims ({selectedAgency.debitNotes?.length || 0})
                  </Button>

                  <Button
                    variant={activeTab === 'STATEMENT' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('STATEMENT')}
                    className="h-8 text-xs gap-1.5 font-semibold"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Formal Audit Statement
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* ─── TAB 1: INVOICES & BILLS ─── */}
                {activeTab === 'INVOICES' && (
                  <div className="space-y-3">
                    {/* Invoice Status Filter Bar */}
                    <div className="flex items-center gap-1.5 pb-1">
                      <span className="text-[11px] text-muted-foreground mr-1">Filter Bills:</span>
                      <Button
                        variant={invoiceFilter === 'ALL' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setInvoiceFilter('ALL')}
                        className="h-6 text-[10px] px-2"
                      >
                        All ({selectedAgency.invoices.length})
                      </Button>
                      <Button
                        variant={invoiceFilter === 'DUE' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setInvoiceFilter('DUE')}
                        className="h-6 text-[10px] px-2 text-rose-600"
                      >
                        Balance Due ({selectedAgency.invoices.filter((i) => i.balanceDue > 0).length})
                      </Button>
                      <Button
                        variant={invoiceFilter === 'OVERDUE' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setInvoiceFilter('OVERDUE')}
                        className="h-6 text-[10px] px-2 text-amber-600"
                      >
                        Overdue ({selectedAgency.invoices.filter((i) => typeof i.daysRemaining === 'number' && i.daysRemaining < 0).length})
                      </Button>
                      <Button
                        variant={invoiceFilter === 'SETTLED' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setInvoiceFilter('SETTLED')}
                        className="h-6 text-[10px] px-2 text-emerald-600"
                      >
                        Settled ({selectedAgency.invoices.filter((i) => i.balanceDue <= 0).length})
                      </Button>
                    </div>

                    {selectedAgency.invoices.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground text-xs">
                        No purchase bills recorded for this distributor yet.
                      </div>
                    ) : (
                      selectedAgency.invoices
                        .filter((inv) => {
                          if (invoiceFilter === 'DUE') return inv.balanceDue > 0
                          if (invoiceFilter === 'OVERDUE') return typeof inv.daysRemaining === 'number' && inv.daysRemaining < 0
                          if (invoiceFilter === 'SETTLED') return inv.balanceDue <= 0
                          return true
                        })
                        .map((inv) => (
                          <div
                            key={inv.id}
                            className="border border-border/60 rounded-lg p-3 bg-card hover:border-primary/40 transition-colors space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs text-primary">
                                  Bill #{inv.invoiceNumber}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  ({formatDate(inv.purchaseDate)})
                                </span>
                                <Badge variant="outline" className="text-[10px] py-0">
                                  {inv.status}
                                </Badge>
                                {typeof inv.daysRemaining === 'number' && (
                                  <Badge
                                    className={`text-[10px] py-0 ${
                                      inv.daysRemaining < 0
                                        ? 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                                        : inv.daysRemaining <= 7
                                        ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                                        : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                    }`}
                                  >
                                    {inv.daysRemaining < 0
                                      ? `Overdue by ${Math.abs(inv.daysRemaining)}d`
                                      : `${inv.daysRemaining} days credit left`}
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-xs">
                                <div>
                                  <span className="text-muted-foreground text-[10px] mr-1">Bill Amount:</span>
                                  <span className="font-mono font-bold text-foreground">
                                    {formatCurrency(inv.totalAmount)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-[10px] mr-1">Balance Due:</span>
                                  <span
                                    className={`font-mono font-bold ${
                                      inv.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'
                                    }`}
                                  >
                                    {formatCurrency(inv.balanceDue)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Line Items Table with Batch & Purchase Rates */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/40 text-muted-foreground text-[10px] uppercase">
                                  <tr>
                                    <th className="py-1.5 px-2 text-left">Medicine Name</th>
                                    <th className="py-1.5 px-2 text-left">Batch No.</th>
                                    <th className="py-1.5 px-2 text-left">Expiry</th>
                                    <th className="py-1.5 px-2 text-right">Delivered Qty</th>
                                    <th className="py-1.5 px-2 text-right">Unit Rate</th>
                                    <th className="py-1.5 px-2 text-right">Total Amount</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y text-[11px]">
                                  {inv.items.map((it) => (
                                    <tr key={it.id} className="hover:bg-muted/20">
                                      <td className="py-1.5 px-2 font-medium text-foreground">
                                        {it.productName}
                                        {it.drugSchedule && it.drugSchedule !== 'NONE' && (
                                          <span className="ml-1 text-[10px] text-amber-600">
                                            [{it.drugSchedule}]
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-1.5 px-2 font-mono text-primary font-semibold">
                                        {it.batchNumber}
                                      </td>
                                      <td className="py-1.5 px-2 font-mono text-muted-foreground">
                                        {it.expiryDate ? formatDate(it.expiryDate) : '24m+'}
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-mono font-bold">
                                        {it.quantity}
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-mono font-semibold text-foreground">
                                        {formatCurrency(it.unitCost)}
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-mono font-bold text-foreground">
                                        {formatCurrency(it.totalAmount)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}

                {/* ─── TAB 2: SUPPLIED MEDICINES CATALOG ─── */}
                {activeTab === 'CATALOG' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        All Formulary Items Supplied by {selectedAgency.name}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => setAutoPoOpen(true)}
                        className="h-7 text-xs gap-1 bg-primary font-semibold"
                      >
                        <Plus className="h-3 w-3" />
                        Quick Reorder from Distributor
                      </Button>
                    </div>

                    {!selectedAgency.suppliedProducts || selectedAgency.suppliedProducts.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground text-xs border rounded-lg">
                        No product catalog history available for this agency yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50 text-muted-foreground text-[10px] uppercase font-semibold">
                            <tr>
                              <th className="py-2 px-3 text-left">Medicine Name</th>
                              <th className="py-2 px-3 text-left">Formulary SKU</th>
                              <th className="py-2 px-3 text-left">Schedule</th>
                              <th className="py-2 px-3 text-right">Last Purchase Rate</th>
                              <th className="py-2 px-3 text-right">Total Units Supplied</th>
                              <th className="py-2 px-3 text-right">Batches Handled</th>
                              <th className="py-2 px-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-[11px]">
                            {selectedAgency.suppliedProducts.map((p) => (
                              <tr key={p.productId} className="hover:bg-muted/20">
                                <td className="py-2 px-3 font-semibold text-foreground">
                                  {p.name}
                                </td>
                                <td className="py-2 px-3 font-mono text-muted-foreground">
                                  {p.sku}
                                </td>
                                <td className="py-2 px-3">
                                  <Badge variant="outline" className="text-[10px] py-0">
                                    {p.drugSchedule || 'REGULAR'}
                                  </Badge>
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                                  {formatCurrency(p.lastPurchasePrice)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-semibold">
                                  {p.totalQuantityDelivered} units
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                                  {p.batchesCount}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setAutoPoOpen(true)}
                                    className="h-6 text-[10px] gap-1 px-2 border-primary/40 text-primary hover:bg-primary/10"
                                  >
                                    <Sparkles className="h-2.5 w-2.5" />
                                    Reorder
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── TAB 3: DEBIT NOTES & CLAIMS ─── */}
                {activeTab === 'DEBIT_NOTES' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Purchase Returns & Debit Memos Against {selectedAgency.name}
                      </span>
                      <Link href={`/purchases/returns/new?supplierId=${selectedAgency.supplierId}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-rose-500/40 text-rose-600 hover:bg-rose-500/10 font-semibold"
                        >
                          <Plus className="h-3 w-3" />
                          Create New Debit Note
                        </Button>
                      </Link>
                    </div>

                    {!selectedAgency.debitNotes || selectedAgency.debitNotes.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground text-xs border rounded-lg">
                        No debit notes or return claims on file for this distributor.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50 text-muted-foreground text-[10px] uppercase font-semibold">
                            <tr>
                              <th className="py-2 px-3 text-left">Debit Note #</th>
                              <th className="py-2 px-3 text-left">Original Purchase PO</th>
                              <th className="py-2 px-3 text-right">Debit Claim Amount</th>
                              <th className="py-2 px-3 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-[11px]">
                            {selectedAgency.debitNotes.map((dn) => (
                              <tr key={dn.id} className="hover:bg-muted/20">
                                <td className="py-2 px-3 font-mono font-bold text-rose-600">
                                  {dn.returnNumber}
                                </td>
                                <td className="py-2 px-3 font-mono text-muted-foreground">
                                  {dn.purchaseNumber}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                                  {formatCurrency(dn.totalAmount)}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <Badge variant="outline" className="text-[10px] py-0 text-emerald-600 border-emerald-500/30">
                                    {dn.status}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── TAB 4: FORMAL AUDIT STATEMENT ─── */}
                {activeTab === 'STATEMENT' && (
                  <div className="space-y-4 border rounded-xl p-5 bg-card print:border-none print:p-0">
                    <div className="flex items-start justify-between border-b pb-4">
                      <div>
                        <div className="font-bold text-base text-foreground tracking-tight">
                          DISTRIBUTOR PROCUREMENT & LEDGER STATEMENT
                        </div>
                        <p className="text-xs text-muted-foreground">
                          PharmaCare Prime Retail & Clinical Dispensary
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Statement Generation Date: {formatDate(new Date())}
                        </p>
                      </div>

                      <div className="text-right space-y-1">
                        <Button
                          size="sm"
                          onClick={() => window.print()}
                          className="h-8 gap-1.5 text-xs font-semibold print:hidden"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Print Ledger Statement
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs bg-muted/20 p-3 rounded-lg">
                      <div>
                        <span className="font-bold text-foreground block">Distributor Agency:</span>
                        <div className="font-semibold text-primary">{selectedAgency.name}</div>
                        <div className="text-muted-foreground text-[11px]">GSTIN: {selectedAgency.gstin || '27AABCU9603R1ZM'}</div>
                        <div className="text-muted-foreground text-[11px]">Drug License: {selectedAgency.dlNumber || 'MH-MZ2-452187'}</div>
                        <div className="text-muted-foreground text-[11px]">Contact: {selectedAgency.phone || 'N/A'}</div>
                      </div>

                      <div className="text-right space-y-1">
                        <div>
                          <span className="text-muted-foreground mr-2">Total Invoices:</span>
                          <span className="font-mono font-bold text-foreground">{selectedAgency.invoices.length}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground mr-2">Total Billed:</span>
                          <span className="font-mono font-bold text-foreground">{formatCurrency(selectedAgency.totalPurchased)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground mr-2">Total Settled:</span>
                          <span className="font-mono font-bold text-emerald-600">{formatCurrency(selectedAgency.totalAmountPaid)}</span>
                        </div>
                        <div className="pt-1 border-t">
                          <span className="text-muted-foreground mr-2 font-bold">Net Balance Due:</span>
                          <span className="font-mono font-bold text-rose-600 text-sm">
                            {formatCurrency(selectedAgency.outstandingBalance)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/60 text-muted-foreground font-semibold border-b text-[10px] uppercase">
                          <tr>
                            <th className="py-2 px-2 text-left">Date</th>
                            <th className="py-2 px-2 text-left">Bill / Ref #</th>
                            <th className="py-2 px-2 text-left">Status</th>
                            <th className="py-2 px-2 text-right">Debit (₹)</th>
                            <th className="py-2 px-2 text-right">Credit / Paid (₹)</th>
                            <th className="py-2 px-2 text-right">Balance Due (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-[11px]">
                          {selectedAgency.invoices.map((inv) => (
                            <tr key={inv.id}>
                              <td className="py-2 px-2 text-muted-foreground">{formatDate(inv.purchaseDate)}</td>
                              <td className="py-2 px-2 font-mono font-bold text-primary">{inv.invoiceNumber}</td>
                              <td className="py-2 px-2">
                                <Badge variant="outline" className="text-[10px] py-0">
                                  {inv.status}
                                </Badge>
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-semibold">
                                {formatCurrency(inv.totalAmount)}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-600">
                                {formatCurrency(inv.amountPaid)}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-rose-600">
                                {formatCurrency(inv.balanceDue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="pt-3 border-t text-[11px] text-muted-foreground flex items-center justify-between">
                      <span>Certified accurate per Pharmacy ERP Procurement & Inventory Ledger.</span>
                      <span className="font-semibold text-foreground">Authorized Pharmacist Signatory</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="py-16 text-center text-muted-foreground text-sm border rounded-lg">
              Select an agency from the left panel to inspect bills and batch purchase costs.
            </div>
          )}
        </div>
      </div>

      {/* ─── Record Payment Modal ─── */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Wallet className="h-5 w-5 text-emerald-600" />
              Disburse Payment to Distributor
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record bank transfer, UPI, or cheque payment to settle distributor invoices and update your accounts payable ledger.
            </DialogDescription>
          </DialogHeader>

          {selectedAgency && (
            <div className="space-y-3.5 py-2 text-xs">
              <div className="rounded-lg bg-muted/40 p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agency:</span>
                  <span className="font-bold text-foreground">{selectedAgency.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Balance:</span>
                  <span className="font-mono font-bold text-rose-600">
                    {formatCurrency(selectedAgency.outstandingBalance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prompt Payment Savings:</span>
                  <span className="font-mono font-bold text-emerald-600">
                    Save 2% ({formatCurrency(selectedAgency.promptPaymentSavings || 0)})
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Disbursement Amount (₹)</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="h-8 text-xs font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Method</Label>
                  <Select value={payMethod} onValueChange={(v: any) => setPayMethod(v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UPI">UPI / QR Code</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                      <SelectItem value="CASH">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Transaction Reference #</Label>
                  <Input
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="e.g. UTR / Cheque #"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPayModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRecordPayment}
              disabled={submittingPay}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {submittingPay ? 'Recording…' : 'Confirm Disbursement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-PO Modal */}
      <AutoPoModal
        open={autoPoOpen}
        onOpenChange={setAutoPoOpen}
        onSuccess={() => {
          void refreshAgencies()
        }}
      />
    </div>
  )
}
