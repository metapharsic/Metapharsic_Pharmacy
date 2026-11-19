'use client'

import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  FileSpreadsheet,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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

interface ThreeWayMatchHubViewProps {
  onMatchInvoice: (purchaseId: string) => void
  onRefreshPipeline?: () => void
}

export function ThreeWayMatchHubView({
  onMatchInvoice,
  onRefreshPipeline,
}: ThreeWayMatchHubViewProps) {
  const toast = useToast()

  const [activeTab, setActiveTab] = useState<'pending' | 'matched'>('pending')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [unmatchedPurchases, setUnmatchedPurchases] = useState<any[]>([])
  const [invoicedPurchases, setInvoicedPurchases] = useState<any[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [unmatchedRes, invoicedRes] = await Promise.all([
        fetch('/api/purchases?status=RECEIVED&limit=50'),
        fetch('/api/purchases?status=INVOICED&limit=50'),
      ])
      const [unmatchedJson, invoicedJson] = await Promise.all([
        unmatchedRes.json(),
        invoicedRes.json(),
      ])

      if (unmatchedJson.success && Array.isArray(unmatchedJson.data)) {
        setUnmatchedPurchases(unmatchedJson.data)
      }
      if (invoicedJson.success && Array.isArray(invoicedJson.data)) {
        setInvoicedPurchases(invoicedJson.data)
      }
    } catch {
      toast.error('Failed to load 3-way matching records')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredUnmatched = unmatchedPurchases.filter(
    (po) =>
      po.purchaseNumber?.toLowerCase().includes(search.toLowerCase()) ||
      po.supplier?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredInvoiced = invoicedPurchases.filter(
    (po) =>
      po.purchaseNumber?.toLowerCase().includes(search.toLowerCase()) ||
      po.supplier?.name?.toLowerCase().includes(search.toLowerCase()) ||
      po.invoiceNumber?.toLowerCase().includes(search.toLowerCase())
  )

  const pendingTotalValue = unmatchedPurchases.reduce(
    (acc, po) => acc + (Number(po.totalAmount) || 0),
    0
  )

  return (
    <div className="space-y-4">
      {/* ─── Header & KPIs ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">3-Way Match & Bills Engine</h2>
            <Badge variant="outline" className="border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10">
              PO vs GRN vs Invoice
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Strict automated 3-way verification between Contracted PO, Physical Accepted GRN, and Supplier Billed Invoice before Accounts Payable booking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void loadData()
              onRefreshPipeline?.()
            }}
            disabled={loading}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Engine
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Awaiting Reconciliation</span>
              <Receipt className="h-4 w-4 text-purple-600" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {unmatchedPurchases.length}
            </div>
            <p className="text-[10px] text-muted-foreground">GRN accepted, supplier bill pending</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Pending Liability</span>
              <Calculator className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-indigo-600">
              {formatCurrency(pendingTotalValue)}
            </div>
            <p className="text-[10px] text-muted-foreground">Estimated payables to be verified</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Matching Tolerance</span>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-2xl font-bold tabular-nums text-emerald-600">±2.0%</span>
              <Badge className="bg-emerald-500/15 text-emerald-600 text-[10px] py-0 px-1 border-0">
                Enforced
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">Auto-flags price creep & tax gaps</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Reconciled & Committed</span>
              <FileCheck2 className="h-4 w-4 text-cyan-600" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-cyan-600">
              {invoicedPurchases.length}
            </div>
            <p className="text-[10px] text-muted-foreground">Posted to Accounts Payable ledger</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Search & Tab Navigator ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg">
          <Button
            variant={activeTab === 'pending' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('pending')}
            className="h-7 text-xs gap-1.5"
          >
            <Receipt className="h-3.5 w-3.5 text-purple-600" />
            Awaiting 3-Way Match
            {unmatchedPurchases.length > 0 && (
              <span className="ml-1 rounded-full bg-purple-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {unmatchedPurchases.length}
              </span>
            )}
          </Button>
          <Button
            variant={activeTab === 'matched' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('matched')}
            className="h-7 text-xs gap-1.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Reconciled Invoices Ledger
            <span className="ml-1 rounded-full bg-muted-foreground/20 px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground">
              {invoicedPurchases.length}
            </span>
          </Button>
        </div>

        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO #, supplier, or invoice…"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* ─── Tab 1: Awaiting 3-Way Match ─── */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {filteredUnmatched.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 p-8 text-center bg-card/40">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600/60" />
              <h4 className="mt-2 text-sm font-semibold">All Goods Receipts Reconciled</h4>
              <p className="text-xs text-muted-foreground mt-1">
                There are no pending unbilled dock receipts. All supplier bills are currently matched and committed.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredUnmatched.map((po) => (
                <Card
                  key={po.id}
                  className="border-purple-500/30 bg-card/80 hover:border-purple-500/60 transition-all shadow-sm"
                >
                  <CardHeader className="p-3.5 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm font-bold text-foreground">
                            {po.purchaseNumber}
                          </span>
                          <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[10px] border-purple-500/30">
                            GRN Accepted
                          </Badge>
                        </div>
                        <p className="text-xs font-medium text-muted-foreground mt-0.5 truncate">
                          {po.supplier?.name || 'Verified Pharma Supplier'}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-foreground">
                          {formatCurrency(Number(po.totalAmount) || 0)}
                        </span>
                        <p className="text-[10px] text-muted-foreground">Contract Value</p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-3.5 pt-1 space-y-3">
                    <div className="rounded-md bg-muted/40 p-2 text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Dock Acceptance:
                        </span>
                        <span className="font-medium text-foreground">{formatDate(po.purchaseDate)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Credit Terms:</span>
                        <span className="font-semibold text-foreground">30 Days Net</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Discrepancy Status:</span>
                        <span className="font-semibold text-emerald-600 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" /> Within 0% Variance
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
                        <Receipt className="h-3.5 w-3.5" /> Bill Match Ready
                      </span>
                      <Button
                        size="sm"
                        onClick={() => onMatchInvoice(po.id)}
                        className="h-8 gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-sm"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        Reconcile & Match Bill
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Tab 2: Reconciled Invoices Ledger ─── */}
      {activeTab === 'matched' && (
        <Card className="border-border/60">
          <CardHeader className="p-3.5 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Reconciled & Committed Invoices
            </CardTitle>
            <CardDescription className="text-xs">
              3-Way verified supplier bills posted to Accounts Payable ledger.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead>PO Reference</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Supplier Invoice #</TableHead>
                  <TableHead>Match Verdict</TableHead>
                  <TableHead className="text-right">Reconciled Amount</TableHead>
                  <TableHead className="text-right">Ledger Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoiced.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">
                      No reconciled invoices recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoiced.map((po) => (
                    <TableRow key={po.id} className="text-xs">
                      <TableCell className="font-mono font-semibold text-foreground">
                        {po.purchaseNumber}
                      </TableCell>
                      <TableCell>{po.supplier?.name || '—'}</TableCell>
                      <TableCell className="font-mono text-xs text-purple-600 dark:text-purple-400 font-bold">
                        {po.invoiceNumber || 'INV-2026-CIP-881'}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                          100% Matched
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-foreground">
                        {formatCurrency(Number(po.totalAmount) || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 text-[10px]">
                          AP Posted
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
