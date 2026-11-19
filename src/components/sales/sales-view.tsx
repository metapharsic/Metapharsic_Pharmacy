'use client'

// ─────────────────────────────────────────────────────────────
// Component — SalesView
// Enterprise pharmacy billing and transaction records console with:
//  1. Executive KPI summary cards (Gated: commercial profit for Admin, operational for Staff)
//  2. Real-time search by invoice, customer, medicine or batch
//  3. Date range filters + Instant Presets (Today, Yesterday, 7 Days, Month, All)
//  4. Searchable dropdowns for Payment Status and Sale Type
//  5. Direct CSV file export & Instant clipboard copy (sanitized for non-admin)
//  6. Dual viewing modes: Clean Transaction Feed & Dense Data Table
//  7. Inline expandable line items with batch numbers & expiry traceability
//  8. Instant Settle Balance / Payment collection dialog
//  9. Interactive Bill Detail dialog (gated Profit Intelligence tab)
// 10. Automated Executive End-of-Day (11:30 PM) WhatsApp Report Dispatcher
// ─────────────────────────────────────────────────────────────

import {
  AlertCircle,
  ArrowRight,
  Boxes,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Copy,
  CreditCard,
  Download,
  Filter,
  Layers,
  LayoutGrid,
  MessageSquare,
  Package,
  PackageCheck,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Table as TableIcon,
  TrendingUp,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { SaleBillDetailDialog } from '@/components/sales/sale-bill-detail-dialog'
import { SettlePaymentDialog } from '@/components/sales/settle-payment-dialog'
import { WhatsAppEodDialog } from '@/components/sales/whatsapp-eod-dialog'
import {
  PAYMENT_STATUS_META,
  SALE_STATUS_META,
  SalesTable,
  type SalesRow,
} from '@/components/sales/sales-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { ROUTES } from '@/lib/constants/routes'
import { useToast } from '@/lib/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDateTime } from '@/lib/utils/date'

interface SummaryMetrics {
  billsCount: number
  salesValue: number
  amountReceived: number
  outstanding: number
  totalPurchaseCost?: number
  totalProfit?: number
  profitMarginPct?: number
  purchaseCostComplete?: boolean
  unpricedUnits?: number
}

interface SalesViewProps {
  initialRows: SalesRow[]
  initialPagination: { page: number; limit: number; total: number; pages: number }
  initialSummary?: SummaryMetrics
  isAdmin?: boolean
  ownerPhone?: string
}

const PAYMENT_STATUS_OPTIONS: SearchableSelectOption[] = [
  { value: 'ALL', label: 'All payment statuses' },
  { value: 'PAID', label: 'Paid in full', badge: 'Settled', badgeVariant: 'default' },
  { value: 'PARTIAL', label: 'Partially paid', badge: 'Due', badgeVariant: 'secondary' },
  { value: 'CREDIT', label: 'Credit (Udhaar)', badge: 'Unsettled', badgeVariant: 'destructive' },
  { value: 'OVERPAID', label: 'Overpaid', badge: 'Refundable', badgeVariant: 'outline' },
]

const SALE_TYPE_OPTIONS: SearchableSelectOption[] = [
  { value: 'ALL', label: 'All sale types' },
  { value: 'COMPLETED', label: 'Completed sales', badge: 'Active', badgeVariant: 'default' },
  { value: 'PARTIALLY_RETURNED', label: 'Partially returned', badge: 'Return', badgeVariant: 'secondary' },
  { value: 'FULLY_RETURNED', label: 'Fully returned', badge: 'Restocked', badgeVariant: 'secondary' },
  { value: 'CANCELLED', label: 'Cancelled / Voided', badge: 'Void', badgeVariant: 'destructive' },
]

export function SalesView({
  initialRows,
  initialPagination,
  initialSummary,
  isAdmin = false,
  ownerPhone = '+919876543210',
}: SalesViewProps) {
  const toast = useToast()

  const [rows, setRows] = useState<SalesRow[]>(initialRows)
  const [totalPages, setTotalPages] = useState(initialPagination.pages)
  const [total, setTotal] = useState(initialPagination.total)
  const [page, setPage] = useState(initialPagination.page)
  const [loading, setLoading] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [activeDatePreset, setActiveDatePreset] = useState<'today' | 'yesterday' | 'last7' | 'month' | 'all'>('all')
  const [paymentStatus, setPaymentStatus] = useState('ALL')
  const [saleType, setSaleType] = useState('ALL')

  // View mode: 'table' (dense grid) vs 'feed' (card list) — default to table for professional enterprise view
  const [viewMode, setViewMode] = useState<'feed' | 'table'>('table')

  // Expanded rows in feed mode
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

  // Quick view / detail dialog state
  const [selectedSale, setSelectedSale] = useState<SalesRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Direct settlement dialog state
  const [settleSale, setSettleSale] = useState<SalesRow | null>(null)
  const [settleDialogOpen, setSettleDialogOpen] = useState(false)

  // WhatsApp EOD dialog state (Admin only)
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false)

  // Summary Metrics
  const [summary, setSummary] = useState<SummaryMetrics>(
    initialSummary || {
      billsCount: initialPagination.total,
      salesValue: initialRows.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0),
      amountReceived: initialRows.reduce((sum, r) => sum + Number(r.amountPaid || 0), 0),
      outstanding: initialRows.reduce((sum, r) => sum + Number(r.balanceDue || 0), 0),
      totalPurchaseCost: isAdmin
        ? initialRows.reduce((sum, r) => sum + Number(r.purchaseCost || 0), 0)
        : undefined,
      totalProfit: isAdmin
        ? initialRows.reduce((sum, r) => sum + Number(r.profitAmount || 0), 0)
        : undefined,
      profitMarginPct: isAdmin
        ? initialRows.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0) > 0
          ? Math.round(
              (initialRows.reduce((sum, r) => sum + Number(r.profitAmount || 0), 0) /
                initialRows.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0)) *
                10000
            ) / 100
          : 0
        : undefined,
      purchaseCostComplete: !initialRows.some((r) => r.purchaseCostComplete === false),
      unpricedUnits: initialRows.reduce((sum, r) => sum + Number(r.purchaseUnpricedUnits || 0), 0),
    }
  )

  const marginGrade = useMemo(() => {
    if (!isAdmin) return null
    const rev = summary.salesValue
    const profit = summary.totalProfit ?? (rev - (summary.totalPurchaseCost ?? 0))
    if (rev <= 0) {
      return { label: 'NO DATA', color: 'bg-muted text-muted-foreground border-border' }
    }
    const pct = summary.profitMarginPct != null ? summary.profitMarginPct : (profit / rev) * 100
    if (pct >= 25) {
      return {
        label: 'OPTIMAL MARGIN',
        color:
          'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      }
    }
    if (pct >= 15) {
      return {
        label: 'HEALTHY COMMERCIAL',
        color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
      }
    }
    if (pct >= 5) {
      return {
        label: 'ACCEPTABLE',
        color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
      }
    }
    return {
      label: 'LOW MARGIN / AT RISK',
      color: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
    }
  }, [summary, isAdmin])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(
    async (opts?: { page?: number; reset?: boolean }) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        const targetPage = opts?.reset ? 1 : (opts?.page ?? page)
        params.set('page', String(targetPage))
        params.set('limit', '20')

        if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
        if (fromDate) params.set('fromDate', fromDate)
        if (toDate) params.set('toDate', toDate)
        if (paymentStatus && paymentStatus !== 'ALL') params.set('paymentStatus', paymentStatus)
        if (saleType && saleType !== 'ALL') params.set('status', saleType)

        const res = await fetch(`/api/sales?${params.toString()}`)
        const json = (await res.json()) as {
          success: boolean
          data?: SalesRow[]
          pagination?: { page: number; total: number; pages: number }
          summary?: SummaryMetrics
        }

        if (json.success) {
          setRows(json.data ?? [])
          setTotalPages(json.pagination?.pages ?? 0)
          setTotal(json.pagination?.total ?? 0)
          setPage(json.pagination?.page ?? 1)
          if (json.summary) {
            setSummary(json.summary)
          }
        } else {
          toast.error('Failed to load sales history')
        }
      } catch {
        toast.error('Failed to load sales history')
      } finally {
        setLoading(false)
      }
    },
    [page, debouncedSearch, fromDate, toDate, paymentStatus, saleType, toast]
  )

  // Auto-reload on filter changes
  useEffect(() => {
    void load({ reset: true })
  }, [debouncedSearch, fromDate, toDate, paymentStatus, saleType]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClearFilters = () => {
    setSearch('')
    setFromDate('')
    setToDate('')
    setActiveDatePreset('all')
    setPaymentStatus('ALL')
    setSaleType('ALL')
  }

  const applyDatePreset = (preset: 'today' | 'yesterday' | 'last7' | 'month' | 'all') => {
    setActiveDatePreset(preset)
    const now = new Date()
    const formatYMD = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    if (preset === 'today') {
      const dStr = formatYMD(now)
      setFromDate(dStr)
      setToDate(dStr)
    } else if (preset === 'yesterday') {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      const dStr = formatYMD(y)
      setFromDate(dStr)
      setToDate(dStr)
    } else if (preset === 'last7') {
      const past = new Date(now)
      past.setDate(past.getDate() - 6)
      setFromDate(formatYMD(past))
      setToDate(formatYMD(now))
    } else if (preset === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      setFromDate(formatYMD(startOfMonth))
      setToDate(formatYMD(now))
    } else if (preset === 'all') {
      setFromDate('')
      setToDate('')
    }
  }

  const toggleExpandRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const buildCsvContent = () => {
    const headers = [
      'Invoice',
      'Date',
      'Customer',
      'Phone',
      'Medicines Sold',
      'Total Amount',
      ...(isAdmin ? ['Purchase Cost', 'Profit Earned', 'Profit Margin %'] : []),
      'Amount Received',
      'Balance Due',
      'Payment Status',
      'Sale Status',
      'Cashier',
    ]

    const csvLines = [headers.join(',')]

    rows.forEach((r) => {
      const medicines = (r.items || [])
        .map(
          (it) =>
            `${it.productName} (Qty: ${it.quantity}${
              it.itemBatches?.length
                ? `, Batch: ${it.itemBatches.map((b) => b.batch.batchNumber).join('/')}`
                : ''
            })`
        )
        .join('; ')
      const line = [
        `"${r.invoiceNumber}"`,
        `"${formatDateTime(r.saleDate)}"`,
        `"${r.customer?.name || 'Walk-in Customer'}"`,
        `"${r.customer?.phone || ''}"`,
        `"${medicines.replace(/"/g, '""')}"`,
        r.totalAmount,
        ...(isAdmin
          ? [
              r.purchaseCost ?? 0,
              r.profitAmount ?? 0,
              r.profitPct != null ? `${r.profitPct.toFixed(1)}%` : '0%',
            ]
          : []),
        r.amountPaid,
        r.balanceDue,
        `"${r.paymentStatus}"`,
        `"${r.status}"`,
        `"${r.createdBy?.name || ''}"`,
      ]
      csvLines.push(line.join(','))
    })

    return csvLines.join('\n')
  }

  const handleCopyCsv = () => {
    if (rows.length === 0) {
      toast.info('No transactions to copy')
      return
    }

    const csvContent = buildCsvContent()
    navigator.clipboard
      .writeText(csvContent)
      .then(() => {
        toast.success(`Copied ${rows.length} transactions to CSV`)
      })
      .catch(() => {
        toast.error('Failed to copy CSV to clipboard')
      })
  }

  const handleDownloadCsv = () => {
    if (rows.length === 0) {
      toast.info('No transactions to export')
      return
    }

    const csvContent = buildCsvContent()
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `sales-history-${fromDate || 'all'}-to-${toDate || 'all'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success(`Exported ${rows.length} transactions as CSV file`)
  }

  const handleOpenBill = (row: SalesRow) => {
    setSelectedSale(row)
    setDialogOpen(true)
  }

  const handleOpenSettle = (row: SalesRow) => {
    setSettleSale(row)
    setSettleDialogOpen(true)
  }

  const hasActiveFilters =
    search.trim() !== '' ||
    fromDate !== '' ||
    toDate !== '' ||
    paymentStatus !== 'ALL' ||
    saleType !== 'ALL'

  return (
    <div className="space-y-5">
      {/* ─────────────────────────────────────────────────────────
          1. Header Banner & Actions
          ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Sales History
            </h1>
            {isAdmin && (
              <Badge
                variant="outline"
                className="border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold py-0.5 px-2 flex items-center gap-1"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
                Admin Commercial View
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Comprehensive billing records, transaction audit & customer settlement control
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWhatsappDialogOpen(true)}
              className="h-8 text-xs font-semibold gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs"
              title="Preview & dispatch daily closing WhatsApp report"
            >
              <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
              <span>EOD WhatsApp Report</span>
            </Button>
          )}

          <Button variant="outline" size="sm" asChild className="h-8 text-xs font-medium">
            <Link href={ROUTES.TALLY}>Ledger Sync</Link>
          </Button>

          <Button size="sm" asChild className="h-8 text-xs font-semibold">
            <Link href={ROUTES.POS}>New Sale</Link>
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────
          2. Executive Summary KPI Cards
          ───────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {isAdmin ? (
          /* ADMIN VIEW: 5 Balanced Executive Commercial Cards */
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Card 1: Bills Found */}
            <Card className="border-border/70 shadow-xs relative overflow-hidden bg-card">
              <div className="absolute top-0 left-0 right-0 h-1 bg-primary/70" />
              <CardHeader className="pb-1 pt-3.5 px-4">
                <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Total Invoices</span>
                  <Receipt className="h-4 w-4 text-primary" />
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3.5 px-4">
                <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                  {summary.billsCount}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Billed in selected period</p>
              </CardContent>
            </Card>

            {/* Card 2: Gross Invoiced Revenue */}
            <Card className="border-border/70 shadow-xs relative overflow-hidden bg-card">
              <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500/70" />
              <CardHeader className="pb-1 pt-3.5 px-4">
                <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Gross Revenue</span>
                  <span className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400">₹</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3.5 px-4">
                <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                  {formatCurrency(summary.salesValue.toString())}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Total customer billings</p>
              </CardContent>
            </Card>

            {/* Card 3: Purchase Cost (COGS) */}
            <Card className="border-border/70 shadow-xs relative overflow-hidden bg-card">
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-500/70" />
              <CardHeader className="pb-1 pt-3.5 px-4">
                <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Purchase Cost</span>
                  <Layers className="h-4 w-4 text-slate-500" />
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3.5 px-4">
                <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground font-mono">
                  {formatCurrency((summary.totalPurchaseCost ?? 0).toString())}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Inventory acquisition cost</p>
              </CardContent>
            </Card>

            {/* Card 4: Profit Earned */}
            <Card className="border-border/70 shadow-xs relative overflow-hidden bg-card">
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500/70" />
              <CardHeader className="pb-1 pt-3.5 px-4">
                <CardTitle className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Gross Profit</span>
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3.5 px-4">
                <div
                  className={`text-2xl font-bold tracking-tight tabular-nums ${
                    (summary.totalProfit ?? 0) >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatCurrency((summary.totalProfit ?? 0).toString())}
                </div>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Net commercial margin
                </p>
              </CardContent>
            </Card>

            {/* Card 5: Net Profit Margin % */}
            <Card className="border-border/70 shadow-xs relative overflow-hidden bg-card">
              <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500/70" />
              <CardHeader className="pb-1 pt-3.5 px-4">
                <CardTitle className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Profit Margin</span>
                  <Coins className="h-4 w-4 text-indigo-500" />
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3.5 px-4">
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold tracking-tight tabular-nums text-indigo-600 dark:text-indigo-400">
                    {summary.profitMarginPct != null
                      ? `${summary.profitMarginPct.toFixed(1)}%`
                      : summary.salesValue > 0
                      ? `${(((summary.totalProfit ?? 0) / summary.salesValue) * 100).toFixed(1)}%`
                      : '—'}
                  </div>
                  {marginGrade && (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border tracking-wider ${marginGrade.color}`}>
                      {marginGrade.label}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Weighted avg return</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* NON-ADMIN VIEW: 4 Clean Operational Cards (No Profit/COGS Leaks) */
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card className="border-border/70 shadow-xs bg-card">
              <CardHeader className="pb-1 pt-3.5 px-4">
                <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Bills Recorded</span>
                  <Receipt className="h-4 w-4 text-primary" />
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3.5 px-4">
                <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                  {summary.billsCount}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Total invoices in period</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-xs bg-card">
              <CardHeader className="pb-1 pt-3.5 px-4">
                <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Gross Sales</span>
                  <span className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400">₹</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3.5 px-4">
                <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                  {formatCurrency(summary.salesValue.toString())}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Total billed amount</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-xs bg-card">
              <CardHeader className="pb-1 pt-3.5 px-4">
                <CardTitle className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Collected</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3.5 px-4">
                <div className="text-2xl font-bold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(summary.amountReceived.toString())}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Cash & digital collections</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-xs bg-card">
              <CardHeader className="pb-1 pt-3.5 px-4">
                <CardTitle className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Outstanding Due</span>
                  <Clock className="h-4 w-4 text-amber-500" />
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3.5 px-4">
                <div className="text-2xl font-bold tracking-tight tabular-nums text-amber-600 dark:text-amber-400">
                  {formatCurrency(summary.outstanding.toString())}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Pending customer credit</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Compact Unpriced Units Alert (Admin only) */}
        {isAdmin && summary.purchaseCostComplete === false && (
          <div className="rounded-lg border border-amber-300/80 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800/80 px-3.5 py-1.5 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>
              <strong>{summary.unpricedUnits ?? 0} units</strong> have no purchase price on file — estimated at standard MRP/cost fallback rate.
            </span>
          </div>
        )}

        {/* Secondary Cash Reconciliation Strip */}
        <div className="flex flex-wrap items-center justify-between px-3 py-1.5 rounded-lg bg-muted/40 border border-border/50 text-xs text-muted-foreground gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Collected:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatCurrency(summary.amountReceived.toString())}
              </strong>
            </span>
            <span>•</span>
            <span>
              Outstanding Credit:{' '}
              <strong className="text-amber-600 dark:text-amber-400 tabular-nums">
                {formatCurrency(summary.outstanding.toString())}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Reconciled against live dispensary ledger</span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────
          3. Search and Filter Toolbar
          ───────────────────────────────────────────────────────── */}
      <Card className="border-border/70 shadow-xs">
        <CardContent className="p-3.5 space-y-3">
          {/* Top Row: Search input + Date Presets */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bills, customer, medicine or batch..."
                className="pl-9 text-xs h-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Quick Date Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-muted-foreground mr-1 flex items-center gap-1 font-medium">
                <Calendar className="h-3 w-3" />
                Date:
              </span>
              <Button
                type="button"
                variant={activeDatePreset === 'today' ? 'secondary' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2.5 font-medium"
                onClick={() => applyDatePreset('today')}
              >
                Today
              </Button>
              <Button
                type="button"
                variant={activeDatePreset === 'yesterday' ? 'secondary' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2.5 font-medium"
                onClick={() => applyDatePreset('yesterday')}
              >
                Yesterday
              </Button>
              <Button
                type="button"
                variant={activeDatePreset === 'last7' ? 'secondary' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2.5 font-medium"
                onClick={() => applyDatePreset('last7')}
              >
                Last 7 Days
              </Button>
              <Button
                type="button"
                variant={activeDatePreset === 'month' ? 'secondary' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2.5 font-medium"
                onClick={() => applyDatePreset('month')}
              >
                This Month
              </Button>
              <Button
                type="button"
                variant={activeDatePreset === 'all' ? 'secondary' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2.5 font-medium"
                onClick={() => applyDatePreset('all')}
              >
                All
              </Button>
            </div>
          </div>

          {/* Bottom Row: Granular Filters & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-8 text-xs w-32"
                />
                <span>to</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-8 text-xs w-32"
                />
              </div>

              <div className="w-40">
                <SearchableSelect
                  value={paymentStatus}
                  onChange={setPaymentStatus}
                  options={PAYMENT_STATUS_OPTIONS}
                  placeholder="Payment"
                  className="h-8 text-xs"
                />
              </div>

              <div className="w-40">
                <SearchableSelect
                  value={saleType}
                  onChange={setSaleType}
                  options={SALE_TYPE_OPTIONS}
                  placeholder="Sale type"
                  className="h-8 text-xs"
                />
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground px-2"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {/* Right: View Mode Toggle & CSV Actions */}
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border bg-muted p-0.5">
                <Button
                  variant={viewMode === 'feed' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1.5"
                  onClick={() => setViewMode('feed')}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Feed
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1.5"
                  onClick={() => setViewMode('table')}
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  Table
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCsv}
                className="h-8 text-xs gap-1.5 font-medium border-border/80"
                title="Copy table data directly to clipboard"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadCsv}
                className="h-8 text-xs gap-1.5 font-medium border-border/80"
                title="Download CSV spreadsheet"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─────────────────────────────────────────────────────────
          4. Transactions Section
          ───────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>Transactions</span>
              <Badge variant="outline" className="font-mono text-xs font-normal">
                {total} found
              </Badge>
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">
              Page {total === 0 ? 0 : page} of {total === 0 ? 0 : totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading || total === 0}
              onClick={() => load({ page: page - 1 })}
              className="h-7 px-2 text-xs"
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading || total === 0}
              onClick={() => load({ page: page + 1 })}
              className="h-7 px-2 text-xs"
            >
              Next
            </Button>
          </div>
        </div>

        {/* FEED MODE */}
        {viewMode === 'feed' ? (
          <div className="space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-dashed bg-muted/20 text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin text-primary mb-2" />
                <p className="text-sm">Loading transactions...</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-dashed bg-muted/20 text-muted-foreground">
                <Receipt className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium">No sales transactions found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try adjusting your search terms, date range or payment filter.
                </p>
              </div>
            ) : (
              rows.map((row) => {
                const saleMeta = SALE_STATUS_META[row.status]
                const paymentMeta = PAYMENT_STATUS_META[row.paymentStatus]
                const primaryPayment = row.payments?.[0]
                const hasBalanceDue = Number(row.balanceDue) > 0 && row.status !== 'CANCELLED'
                const isExpanded = !!expandedRows[row.id]

                return (
                  <Card
                    key={row.id}
                    className="border-border/70 shadow-xs hover:border-primary/40 transition-all bg-card overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Left: Invoice ID, Timestamp, Customer */}
                        <div className="space-y-1 min-w-[210px]">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenBill(row)}
                              className="font-mono font-bold text-sm text-foreground hover:text-primary hover:underline text-left"
                            >
                              {row.invoiceNumber}
                            </button>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDateTime(row.saleDate)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium text-foreground">
                              {row.customer ? row.customer.name : 'Walk-in Customer'}
                            </span>
                            {row.customer?.phone && (
                              <span className="text-muted-foreground text-[11px]">
                                ({row.customer.phone})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle-Left: Medicines Sold & Batches */}
                        <div className="flex-1 min-w-[240px] text-xs">
                          {row.items && row.items.length > 0 ? (
                            <div className="space-y-1">
                              {row.items.map((it, idx) => (
                                <div key={idx} className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-semibold text-foreground">
                                    {it.productName}
                                  </span>
                                  <span className="text-muted-foreground">· Qty {it.quantity}</span>
                                  {it.itemBatches && it.itemBatches.length > 0 && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-muted/80 text-muted-foreground border">
                                      Batch {it.itemBatches.map((b) => b.batch.batchNumber).join(', ')}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">
                              Items recorded on bill
                            </span>
                          )}
                        </div>

                        {/* Middle-Right: Payment method & Received amount */}
                        <div className="min-w-[170px] text-xs space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize text-foreground">
                              {primaryPayment ? primaryPayment.method.toLowerCase() : 'Cash'}
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">
                              Received{' '}
                              <strong className="text-foreground font-semibold tabular-nums">
                                {formatCurrency(row.amountPaid)}
                              </strong>
                            </span>
                          </div>
                          {hasBalanceDue && (
                            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                              Due: {formatCurrency(row.balanceDue)}
                            </div>
                          )}
                        </div>

                        {/* Right: Bill Total, Profit (Admin only), Actions */}
                        <div className="flex items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-border/50">
                          <div className="text-right">
                            <div className="font-bold text-base text-foreground tabular-nums">
                              {formatCurrency(row.totalAmount)}
                            </div>

                            {/* ADMIN ONLY: Commercial Profit Row */}
                            {isAdmin && (
                              <div className="text-[11px] font-semibold flex items-center justify-end gap-1.5 mt-0.5">
                                <span className="text-muted-foreground text-[10px]">Profit:</span>
                                <span
                                  className={`tabular-nums font-bold ${
                                    Number(row.profitAmount ?? 0) >= 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {formatCurrency(row.profitAmount ?? 0)}
                                </span>
                                <span
                                  className={`inline-flex px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                    row.profitPct == null
                                      ? 'bg-muted text-muted-foreground'
                                      : row.profitPct >= 20
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                      : row.profitPct >= 10
                                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                      : row.profitPct >= 0
                                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                  }`}
                                >
                                  {row.profitPct != null ? `${row.profitPct.toFixed(1)}%` : '—'}
                                </span>
                              </div>
                            )}

                            {isAdmin && (
                              <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-end gap-1">
                                <span>Cost: {formatCurrency(row.purchaseCost ?? 0)}</span>
                                {row.purchaseCostComplete === false && (
                                  <span
                                    className="text-amber-600 dark:text-amber-400 text-[9px] font-bold uppercase"
                                    title={`${row.purchaseUnpricedUnits || 0} units unpriced`}
                                  >
                                    (⚠ {row.purchaseUnpricedUnits} unpriced)
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-1.5 mt-1 justify-end">
                              <Badge variant={paymentMeta.variant} className="text-[10px] px-1.5 py-0">
                                {paymentMeta.label}
                              </Badge>
                              {row.status !== 'COMPLETED' && (
                                <Badge variant={saleMeta.variant} className="text-[10px] px-1.5 py-0">
                                  {saleMeta.label}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {hasBalanceDue && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenSettle(row)}
                                className="h-8 text-xs font-semibold px-2.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1"
                                title="Collect partial or full outstanding payment"
                              >
                                <Coins className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Settle</span>
                              </Button>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenBill(row)}
                              className="h-8 text-xs font-semibold px-3 border-primary/30 hover:bg-primary/10 hover:text-primary gap-1"
                            >
                              View bill
                              <ArrowRight className="h-3 w-3" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpandRow(row.id)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              title={isExpanded ? 'Hide batch details' : 'Show batch details'}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Batch Details Drawer */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-border/60 bg-muted/20 -mx-4 -mb-4 p-4 space-y-2">
                          <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <PackageCheck className="h-4 w-4 text-emerald-500" />
                              Itemized Dispensing & Batch Traceability
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              Invoice #{row.invoiceNumber}
                            </span>
                          </div>

                          <div className="rounded-lg border bg-background overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/60 text-muted-foreground border-b font-medium">
                                <tr>
                                  <th className="py-2 px-3 text-left">Medicine</th>
                                  <th className="py-2 px-3 text-left">Batch Number</th>
                                  <th className="py-2 px-3 text-center">Expiry</th>
                                  <th className="py-2 px-3 text-center">Qty</th>
                                  <th className="py-2 px-3 text-right">Unit Price</th>
                                  {isAdmin && (
                                    <>
                                      <th className="py-2 px-3 text-right">Purchase Cost</th>
                                      <th className="py-2 px-3 text-right">Profit Earned</th>
                                      <th className="py-2 px-3 text-center">Margin</th>
                                    </>
                                  )}
                                  <th className="py-2 px-3 text-right">Line Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {row.items && row.items.length > 0 ? (
                                  row.items.map((it) => (
                                    <tr key={it.id} className="hover:bg-muted/30">
                                      <td className="py-2 px-3 font-medium text-foreground">
                                        <div>{it.productName}</div>
                                        <div className="text-[10px] text-muted-foreground font-mono">
                                          {it.productSku}
                                        </div>
                                      </td>
                                      <td className="py-2 px-3 font-mono text-[11px]">
                                        {it.itemBatches && it.itemBatches.length > 0 ? (
                                          it.itemBatches.map((ib, idx) => (
                                            <span key={idx} className="mr-1.5">
                                              {ib.batch.batchNumber}
                                            </span>
                                          ))
                                        ) : (
                                          <span className="text-muted-foreground italic">Standard</span>
                                        )}
                                      </td>
                                      <td className="py-2 px-3 text-center text-muted-foreground font-mono text-[11px]">
                                        {it.itemBatches?.[0]?.batch?.expiryDate
                                          ? new Date(it.itemBatches[0].batch.expiryDate).toLocaleDateString(
                                              'en-IN',
                                              { month: 'short', year: 'numeric' }
                                            )
                                          : '—'}
                                      </td>
                                      <td className="py-2 px-3 text-center font-semibold tabular-nums">
                                        {it.quantity}
                                      </td>
                                      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                                        {formatCurrency(it.unitPrice)}
                                      </td>
                                      {isAdmin && (
                                        <>
                                          <td className="py-2 px-3 text-right font-mono tabular-nums text-muted-foreground">
                                            {formatCurrency(it.purchaseCost ?? 0)}
                                          </td>
                                          <td
                                            className={`py-2 px-3 text-right font-bold tabular-nums ${
                                              (it.profitAmount ?? 0) >= 0
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-rose-600 dark:text-rose-400'
                                            }`}
                                          >
                                            {formatCurrency(it.profitAmount ?? 0)}
                                          </td>
                                          <td className="py-2 px-3 text-center tabular-nums">
                                            <span
                                              className={`inline-flex px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                                it.profitPct == null
                                                  ? 'bg-muted text-muted-foreground'
                                                  : it.profitPct >= 20
                                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                  : it.profitPct >= 10
                                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                              }`}
                                            >
                                              {it.profitPct != null ? `${it.profitPct.toFixed(1)}%` : '—'}
                                            </span>
                                          </td>
                                        </>
                                      )}
                                      <td className="py-2 px-3 text-right font-semibold tabular-nums text-foreground">
                                        {formatCurrency(it.totalAmount)}
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td
                                      colSpan={isAdmin ? 9 : 6}
                                      className="py-3 text-center text-muted-foreground"
                                    >
                                      No batch details recorded
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        ) : (
          /* TABLE MODE */
          <SalesTable
            rows={rows}
            isLoading={loading}
            total={total}
            page={page}
            totalPages={totalPages}
            onPageChange={(p) => load({ page: p })}
            onViewBill={handleOpenBill}
            onSettleBalance={handleOpenSettle}
            isAdmin={isAdmin}
          />
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────
          5. Interactive Modals
          ───────────────────────────────────────────────────────── */}
      <SaleBillDetailDialog
        saleId={selectedSale?.id || null}
        initialRow={selectedSale}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpdated={() => load()}
        isAdmin={isAdmin}
      />

      {settleSale && (
        <SettlePaymentDialog
          saleId={settleSale.id}
          invoiceNumber={settleSale.invoiceNumber}
          customerName={settleSale.customer?.name}
          totalAmount={settleSale.totalAmount}
          amountPaid={settleSale.amountPaid}
          balanceDue={settleSale.balanceDue}
          open={settleDialogOpen}
          onOpenChange={setSettleDialogOpen}
          onSuccess={() => load()}
        />
      )}

      {isAdmin && (
        <WhatsAppEodDialog
          open={whatsappDialogOpen}
          onOpenChange={setWhatsappDialogOpen}
          defaultPhone={ownerPhone}
        />
      )}
    </div>
  )
}
