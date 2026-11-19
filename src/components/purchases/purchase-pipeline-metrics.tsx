'use client'

import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FileCheck,
  PackageCheck,
  Receipt,
  ShoppingBag,
  Sparkles,
  Zap,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/currency'

interface PipelineMetricsProps {
  data: {
    totalPoCount: number
    totalPoValue: number
    statusBreakdown: {
      draft: number
      ordered: number
      partiallyReceived: number
      received: number
      invoiced: number
      cancelled: number
    }
    counts?: {
      requisitionsPending?: number
      quotesActive?: number
      ordersOpen?: number
      pendingReceival?: number
      pendingInvoicing?: number
      overduePayables?: number
      pendingReturns?: number
    }
    payables: {
      totalOutstanding: number
      dueWithin7Days: number
      dueWithin15Days: number
      dueWithin30Days: number
      overdue: number
    }
    topSupplierExposure: {
      id: string
      name: string
      creditDays: number
      outstandingBalance: number
      gstin: string | null
      dlNumber: string | null
    }[]
    urgentActions?: Array<{
      type: string
      title: string
      description: string
      poId?: string
      purchaseNumber?: string
      actionLabel: string
      targetStage: string
      priority: string
    }>
  } | null
  loading?: boolean
  onNavigateToTab?: (tab: string) => void
  onQuickAction?: (action: any) => void
}

export function PurchasePipelineMetrics({
  data,
  loading = false,
  onNavigateToTab,
  onQuickAction,
}: PipelineMetricsProps) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse border-border/40 bg-muted/20">
            <CardHeader className="h-20" />
            <CardContent className="h-16" />
          </Card>
        ))}
      </div>
    )
  }

  const { statusBreakdown, payables, topSupplierExposure, urgentActions = [] } = data

  return (
    <div className="space-y-6">
      {/* ─── Chemist Fast-Track Operational Hub (Immediate Actions) ─── */}
      {urgentActions.length > 0 && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-card to-background shadow-xs overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">
                    Chemist Operational Action Center
                  </CardTitle>
                  <CardDescription className="text-xs">
                    High-priority purchasing bottlenecks requiring immediate chemist approval or dock inspection
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                {urgentActions.length} Pending Actions
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {urgentActions.map((action, i) => (
                <div
                  key={i}
                  className="flex flex-col justify-between rounded-lg border border-border/80 bg-background/80 p-3 shadow-2xs hover:border-primary/50 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                        {action.type === 'GRN_PENDING' && (
                          <PackageCheck className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                        {action.type === 'MATCH_PENDING' && (
                          <Receipt className="h-3.5 w-3.5 text-purple-600" />
                        )}
                        {action.type === 'PR_PENDING' && (
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        {action.title}
                      </span>
                      <Badge
                        variant={action.priority === 'HIGH' ? 'destructive' : 'warning'}
                        className="text-[9px] px-1 py-0"
                      >
                        {action.priority}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                      {action.description}
                    </p>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      className={`h-7 text-xs gap-1 font-medium ${
                        action.type === 'GRN_PENDING'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : action.type === 'MATCH_PENDING'
                          ? 'bg-purple-600 hover:bg-purple-700 text-white'
                          : 'bg-primary'
                      }`}
                      onClick={() => {
                        if (onQuickAction) {
                          onQuickAction(action)
                        } else if (onNavigateToTab) {
                          onNavigateToTab(action.targetStage)
                        }
                      }}
                    >
                      {action.actionLabel} <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Top 4 KPI Cards ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Commitments */}
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card to-background shadow-xs">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-blue-500/10 blur-xl" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Purchase Orders
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {formatCurrency(data.totalPoValue)}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{data.totalPoCount}</span> orders
              created across all branches
            </p>
          </CardContent>
        </Card>

        {/* Goods Awaiting Receiving */}
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card to-background shadow-xs">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-emerald-500/10 blur-xl" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receiving Pipeline
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <PackageCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {statusBreakdown.ordered + statusBreakdown.partiallyReceived}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {statusBreakdown.partiallyReceived} partial &middot; {statusBreakdown.ordered} awaiting
              dock arrival
            </p>
          </CardContent>
        </Card>

        {/* Total Accounts Payable */}
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card to-background shadow-xs">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-purple-500/10 blur-xl" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Accounts Payable
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {formatCurrency(payables.totalOutstanding)}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span>
                {formatCurrency(payables.dueWithin7Days)} due in &le; 7 days
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Overdue Vendor Bills */}
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card to-background shadow-xs">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-4 -translate-y-4 rounded-full bg-rose-500/10 blur-xl" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue Payables
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tracking-tight ${
                payables.overdue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
              }`}
            >
              {formatCurrency(payables.overdue)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {payables.overdue > 0 ? 'Past agreed supplier credit terms' : 'All supplier invoices current'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payables Ageing Schedule & Status Pipeline */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Payables Ageing Buckets */}
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Accounts Payable Due-Date Ageing Schedule
                </CardTitle>
                <CardDescription>
                  Cash outflow forecast structured around supplier credit days and due dates
                </CardDescription>
              </div>
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab('payments')}
                  className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Manage Payments <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
                <div className="text-[11px] font-medium text-muted-foreground">Due in &le; 7 Days</div>
                <div className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(payables.dueWithin7Days)}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">Immediate liquidity</div>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
                <div className="text-[11px] font-medium text-muted-foreground">8 – 15 Days</div>
                <div className="mt-1 text-lg font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(payables.dueWithin15Days)}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">Near-term cycle</div>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
                <div className="text-[11px] font-medium text-muted-foreground">16 – 30 Days</div>
                <div className="mt-1 text-lg font-bold text-foreground">
                  {formatCurrency(payables.dueWithin30Days)}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">Standard terms</div>
              </div>

              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-center">
                <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400">Overdue</div>
                <div className="mt-1 text-lg font-bold text-rose-600 dark:text-rose-400">
                  {formatCurrency(payables.overdue)}
                </div>
                <div className="mt-0.5 text-[10px] text-rose-500">Requires settlement</div>
              </div>
            </div>

            {/* Document Lifecycle Flow Visualizer */}
            <div className="mt-4 rounded-xl border border-border/60 bg-background/50 p-4">
              <div className="mb-2 text-xs font-semibold text-muted-foreground">
                Document Lifecycle Status Distribution
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6 text-center text-xs">
                <div className="rounded-md border border-border/40 bg-muted/20 p-2">
                  <div className="font-semibold text-foreground">{statusBreakdown.draft}</div>
                  <div className="text-[10px] text-muted-foreground">Draft PO</div>
                </div>
                <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-2">
                  <div className="font-semibold text-blue-600 dark:text-blue-400">
                    {statusBreakdown.ordered}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Ordered</div>
                </div>
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
                  <div className="font-semibold text-amber-600 dark:text-amber-400">
                    {statusBreakdown.partiallyReceived}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Part Receipt</div>
                </div>
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2">
                  <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {statusBreakdown.received}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Received (GRN)</div>
                </div>
                <div className="rounded-md border border-purple-500/30 bg-purple-500/10 p-2">
                  <div className="font-semibold text-purple-600 dark:text-purple-400">
                    {statusBreakdown.invoiced}
                  </div>
                  <div className="text-[10px] text-muted-foreground">3-Way Matched</div>
                </div>
                <div className="rounded-md border border-border/40 bg-muted/20 p-2">
                  <div className="font-semibold text-muted-foreground">
                    {statusBreakdown.cancelled}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Cancelled</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Supplier Exposure & Compliance */}
        <Card className="border-border/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Top Supplier Exposure</CardTitle>
                <CardDescription>Highest outstanding liabilities & compliance</CardDescription>
              </div>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {topSupplierExposure.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No active supplier exposure records found.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {topSupplierExposure.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="truncate text-xs font-semibold text-foreground">{s.name}</div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{s.creditDays}d terms</span>
                        {s.gstin && <span className="font-mono text-[9px] truncate">GSTIN: {s.gstin}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-foreground">
                        {formatCurrency(s.outstandingBalance)}
                      </div>
                      <span className="text-[9px] text-muted-foreground">Liability</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
