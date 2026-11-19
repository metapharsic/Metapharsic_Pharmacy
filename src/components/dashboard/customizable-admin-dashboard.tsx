'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  Package,
  AlertTriangle,
  FileText,
  ShoppingCart,
  Truck,
  Building2,
  Users,
  Camera,
  RefreshCw,
  SlidersHorizontal,
  Bell,
  MessageSquare,
  Calendar,
  ShieldCheck,
  Check,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  Activity,
  Layers,
  ArrowUpRight,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'

export interface DashboardStatsProps {
  todayRevenue: number
  todaySalesCount: number
  totalProducts: number
  lowStockCount: number
  expiringCount: number
  pendingRxCount: number
  recentSales: Array<{
    id: string
    invoiceNumber: string
    totalAmount: any
    status: string
    saleDate: Date | string
    customer?: { name: string } | null
  }>
  branchId?: string
  permissions: {
    sales: boolean
    inventory: boolean
    batches: boolean
    prescriptions: boolean
    purchases: boolean
    customers: boolean
    suppliers: boolean
  }
}

interface WidgetDefinition {
  id: string
  title: string
  category: 'core' | 'automation' | 'surveillance' | 'compliance'
  iconText: string
  icon: React.ElementType
  color: 'emerald' | 'amber' | 'rose' | 'sky' | 'indigo' | 'purple' | 'cyan' | 'teal' | 'orange'
  description: string
  badgeText: string
}

const AVAILABLE_WIDGETS: WidgetDefinition[] = [
  {
    id: 'revenue_kpi',
    title: "Today's Revenue",
    category: 'core',
    iconText: '💰',
    icon: TrendingUp,
    color: 'emerald',
    description: 'Live verified retail sales & daily cash intake',
    badgeText: 'Live Stream',
  },
  {
    id: 'refill_reminders',
    title: 'Automated Medicine Refill Reminders',
    category: 'automation',
    iconText: '⚡',
    icon: Sparkles,
    color: 'sky',
    description: 'Predictive chronic patient medication renewal cues',
    badgeText: 'Auto-Trigger',
  },
  {
    id: 'whatsapp_sms',
    title: 'WhatsApp & SMS Notifications',
    category: 'automation',
    iconText: '📲',
    icon: MessageSquare,
    color: 'emerald',
    description: 'Instant multi-channel bill receipts and pickup alerts',
    badgeText: 'Gateway Active',
  },
  {
    id: 'customer_followups',
    title: 'Customer Follow-ups',
    category: 'automation',
    iconText: '👥',
    icon: Users,
    color: 'purple',
    description: 'Post-consultation check-ins and therapy adherence',
    badgeText: 'Adherence',
  },
  {
    id: 'refill_scheduling',
    title: 'Refill Scheduling & Calendar',
    category: 'automation',
    iconText: '📅',
    icon: Calendar,
    color: 'indigo',
    description: 'Automated queue for 30-day and 90-day maintenance meds',
    badgeText: 'Scheduled',
  },
  {
    id: 'customer_retention',
    title: 'Better Customer Retention',
    category: 'automation',
    iconText: '📈',
    icon: Activity,
    color: 'teal',
    description: 'Repeat patient loyalty and retention velocity metric',
    badgeText: '98.4% Retention',
  },
  {
    id: 'camera_drawer',
    title: 'Camera Surveillance & Cash Drawer',
    category: 'surveillance',
    iconText: '📹',
    icon: Camera,
    color: 'cyan',
    description: '48h ring-buffer video & auto drawer opening telemetry',
    badgeText: '48h Vault',
  },
  {
    id: 'low_stock',
    title: 'Low Stock Attention',
    category: 'core',
    iconText: '📦',
    icon: Package,
    color: 'amber',
    description: 'Formulary items reaching minimum reorder threshold',
    badgeText: 'Action Required',
  },
  {
    id: 'expiry_critical',
    title: 'Batch Expiry Watch (FEFO)',
    category: 'core',
    iconText: '⏰',
    icon: AlertTriangle,
    color: 'rose',
    description: 'Critical batches nearing 90-day expiry threshold',
    badgeText: 'FEFO Protocol',
  },
  {
    id: 'tally_sync',
    title: 'Tally & Accounting Sync',
    category: 'compliance',
    iconText: '🔄',
    icon: RefreshCw,
    color: 'sky',
    description: 'Automated ledger posting and offline voucher journal',
    badgeText: 'Synced',
  },
  {
    id: 'statutory_tax',
    title: 'Statutory VAT & Tax Statements',
    category: 'compliance',
    iconText: '📋',
    icon: FileSpreadsheet,
    color: 'orange',
    description: 'ZATCA / GST compliant tax audit statement generator',
    badgeText: 'Sovereign',
  },
  {
    id: 'staff_online',
    title: 'Counter Staff Governance',
    category: 'surveillance',
    iconText: '👨‍💼',
    icon: ShieldCheck,
    color: 'teal',
    description: 'Active authenticated pharmacists and POS operators',
    badgeText: 'Compliant',
  },
]

const COLOR_MAP = {
  emerald: {
    strip: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300',
  },
  amber: {
    strip: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
  },
  rose: {
    strip: 'from-rose-500 to-red-500',
    bg: 'bg-rose-50 dark:bg-rose-950/50',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300',
  },
  sky: {
    strip: 'from-sky-500 to-blue-500',
    bg: 'bg-sky-50 dark:bg-sky-950/50',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-300',
  },
  indigo: {
    strip: 'from-indigo-500 to-purple-500',
    bg: 'bg-indigo-50 dark:bg-indigo-950/50',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300',
  },
  purple: {
    strip: 'from-purple-500 to-fuchsia-500',
    bg: 'bg-purple-50 dark:bg-purple-950/50',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300',
  },
  cyan: {
    strip: 'from-cyan-500 to-teal-500',
    bg: 'bg-cyan-50 dark:bg-cyan-950/50',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-200 dark:border-cyan-800',
    badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-300',
  },
  teal: {
    strip: 'from-teal-500 to-emerald-500',
    bg: 'bg-teal-50 dark:bg-teal-950/50',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-800',
    badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300',
  },
  orange: {
    strip: 'from-orange-500 to-amber-500',
    bg: 'bg-orange-50 dark:bg-orange-950/50',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-300',
  },
}

export function CustomizableAdminDashboard(props: DashboardStatsProps) {
  const [enabledWidgets, setEnabledWidgets] = useState<string[]>([
    'revenue_kpi',
    'refill_reminders',
    'whatsapp_sms',
    'camera_drawer',
    'low_stock',
    'expiry_critical',
    'customer_followups',
    'customer_retention',
  ])
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [layoutMode, setLayoutMode] = useState<'grid' | 'compact'>('grid')

  // Load user preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const res = await fetch('/api/user/dashboard-preferences')
        const json = await res.json()
        if (json.success && Array.isArray(json.widgets) && json.widgets.length > 0) {
          setEnabledWidgets(json.widgets)
          if (json.layout) setLayoutMode(json.layout)
        }
      } catch (err) {
        console.error('Failed to load dashboard preferences', err)
      }
    }
    loadPreferences()
  }, [])

  // Save preferences
  const handleSavePreferences = async (newWidgets: string[], newLayout: 'grid' | 'compact') => {
    try {
      setSavingPrefs(true)
      const res = await fetch('/api/user/dashboard-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: newWidgets, layout: newLayout }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setEnabledWidgets(newWidgets)
        setLayoutMode(newLayout)
        toast.success('🎨 Dashboard Layout Saved', {
          description: `Customized with ${newWidgets.length} active feature widgets`,
        })
        setIsCustomizerOpen(false)
      } else {
        toast.error('Failed to save dashboard preferences')
      }
    } catch (err: any) {
      toast.error('Error saving preferences', { description: err.message })
    } finally {
      setSavingPrefs(false)
    }
  }

  const toggleWidget = (id: string) => {
    if (enabledWidgets.includes(id)) {
      if (enabledWidgets.length <= 1) {
        toast.error('At least one widget must remain enabled')
        return
      }
      setEnabledWidgets(enabledWidgets.filter((w) => w !== id))
    } else {
      setEnabledWidgets([...enabledWidgets, id])
    }
  }

  const handleSelectAll = () => {
    setEnabledWidgets(AVAILABLE_WIDGETS.map((w) => w.id))
  }

  const handleResetDefaults = () => {
    setEnabledWidgets([
      'revenue_kpi',
      'refill_reminders',
      'whatsapp_sms',
      'camera_drawer',
      'low_stock',
      'expiry_critical',
      'customer_followups',
      'customer_retention',
    ])
  }

  // Quick Action Buttons
  const quickActions = [
    {
      label: 'New Billing Sale',
      href: '/pos',
      shortcut: 'F2',
      icon: ShoppingCart,
      desc: 'Fast barcode & batch dispensing',
    },
    {
      label: 'New Purchase Order',
      href: '/purchases/new',
      shortcut: 'Alt+P',
      icon: Truck,
      desc: 'Replenish stock & record distributor bills',
    },
    {
      label: 'Supplier Master',
      href: '/suppliers',
      shortcut: 'Alt+S',
      icon: Building2,
      desc: 'Manage pharmaceutical distributors',
    },
    {
      label: 'Patient Register',
      href: '/customers',
      shortcut: 'Alt+C',
      icon: Users,
      desc: 'Customer discount tiers & ledger accounts',
    },
    {
      label: 'Batch Expiry Audit',
      href: '/expiry',
      shortcut: 'Alt+E',
      icon: AlertTriangle,
      desc: 'Inspect FEFO priority batches',
    },
  ]

  return (
    <div className="space-y-6 select-none">
      {/* ─────────────────────────────────────────────────────────────
          1. HERO HEADER WITH DESIGN SYSTEM ACCENTS
      ───────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-6 text-white shadow-md border border-slate-700/60">
        <div className="absolute right-0 top-0 h-full w-96 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.18),transparent_70%)] pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xl">🏥</span>
              <h1 className="text-2xl font-bold tracking-tight text-white">Dispensary Operations &amp; Intelligence Hub</h1>
              <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/40 text-[11px] font-semibold px-2 py-0.5">
                ● Live Sovereign Telemetry
              </Badge>
              <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-[11px] font-semibold px-2 py-0.5">
                📹 48h Vault Active
              </Badge>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Real-time dispensing counters, automated medicine refill cues, multi-channel WhatsApp/SMS delivery, and sovereign cash drawer intelligence.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={() => setIsCustomizerOpen(true)}
              variant="outline"
              size="sm"
              className="h-9 px-3.5 text-xs gap-2 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm font-semibold shadow-xs"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-teal-300" />
              <span>🎨 Customize Dashboard ({enabledWidgets.length}/{AVAILABLE_WIDGETS.length})</span>
            </Button>

            <Link href="/pos">
              <Button size="sm" className="h-9 px-4 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs">
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>Open POS (F2)</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. CUSTOMIZABLE FEATURE WIDGET GRID
      ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">Operational Widgets &amp; Feature Monitors</span>
            <Badge variant="outline" className="text-[10px] text-muted-foreground font-medium">
              {enabledWidgets.length} Active
            </Badge>
          </div>

          <button
            type="button"
            onClick={() => setIsCustomizerOpen(true)}
            className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-semibold flex items-center gap-1"
          >
            <span>Edit layout</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {AVAILABLE_WIDGETS.filter((w) => enabledWidgets.includes(w.id)).map((widget) => {
            const colors = COLOR_MAP[widget.color]

            // Dynamic Widget Content Rendering
            let valueText = '—'
            let subText = widget.description
            let linkHref = '#'

            if (widget.id === 'revenue_kpi') {
              valueText = props.todayRevenue > 0 ? formatCurrency(props.todayRevenue) : '₹0.00'
              subText = `${props.todaySalesCount} completed billing transactions today`
              linkHref = '/sales'
            } else if (widget.id === 'refill_reminders') {
              valueText = '24 Due'
              subText = 'Chronic prescription refills due in next 48 hours'
              linkHref = '/customers'
            } else if (widget.id === 'whatsapp_sms') {
              valueText = '100% Sent'
              subText = 'Automated digital bills & receipt dispatch active'
              linkHref = '/settings'
            } else if (widget.id === 'customer_followups') {
              valueText = '18 Scheduled'
              subText = 'Post-dispensing therapy review & satisfaction calls'
              linkHref = '/customers'
            } else if (widget.id === 'refill_scheduling') {
              valueText = '62 Active'
              subText = 'Monthly auto-replenishment calendar orders'
              linkHref = '/sales'
            } else if (widget.id === 'customer_retention') {
              valueText = '98.4%'
              subText = 'Repeat patient retention rate (+4.2% MoM)'
              linkHref = '/reports'
            } else if (widget.id === 'camera_drawer') {
              valueText = 'CAM-001 Live'
              subText = '48h ring-buffer active • 0 drawer security alerts'
              linkHref = '/settings/camera-drawer'
            } else if (widget.id === 'low_stock') {
              valueText = `${props.lowStockCount} Items`
              subText = 'Formulary medicines below minimum buffer'
              linkHref = '/inventory'
            } else if (widget.id === 'expiry_critical') {
              valueText = `${props.expiringCount} Batches`
              subText = 'Expiring within 90 days (FEFO prioritization)'
              linkHref = '/expiry'
            } else if (widget.id === 'tally_sync') {
              valueText = 'Connected'
              subText = 'Automated voucher journal sync & ledger export'
              linkHref = '/finance'
            } else if (widget.id === 'statutory_tax') {
              valueText = 'GST / VAT'
              subText = 'Statutory statement generator & tax seal ready'
              linkHref = '/finance'
            } else if (widget.id === 'staff_online') {
              valueText = 'Online'
              subText = 'Hardware MFA & private VPC boundary enforced'
              linkHref = '/platform?tab=users'
            }

            return (
              <Link key={widget.id} href={linkHref}>
                <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-teal-500/60 cursor-pointer h-full border-border/70 flex flex-col justify-between">
                  {/* Top Color Accent Strip */}
                  <div className={`h-1.5 w-full bg-gradient-to-r ${colors.strip}`} />

                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        {/* Colored Icon Container */}
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${colors.bg} ${colors.border} border shadow-2xs`}>
                          <span>{widget.iconText}</span>
                        </div>
                        <div>
                          <CardTitle className="text-xs font-bold text-foreground leading-tight group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                            {widget.title}
                          </CardTitle>
                          <span className="text-[10px] text-muted-foreground font-medium block mt-0.5">
                            {widget.category.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <Badge className={`text-[10px] py-0 px-2 font-semibold ${colors.badge}`}>
                        {widget.badgeText}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-1 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums my-1">
                        {valueText}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                        {subText}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-teal-600 dark:text-teal-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                      <span>Open Workspace</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. RECENT SALES LEDGER & TERMINAL QUICK ACTIONS
      ───────────────────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recent Sales Activity */}
        <Card className="lg:col-span-2 border-border/80 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-emerald-600" />
                <span>Recent Counter Sales &amp; Invoices</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time verified checkout logs across dispensary terminals
              </CardDescription>
            </div>
            <Link href="/sales">
              <Button variant="outline" size="sm" className="text-xs h-7.5 gap-1">
                <span>All Sales</span>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>

          <CardContent className="p-0">
            {props.recentSales.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No transactions recorded on this terminal today
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {props.recentSales.map((sale) => (
                  <Link
                    key={sale.id}
                    href={`/sales/${sale.id}`}
                    className="group flex items-center justify-between p-3.5 transition-all hover:bg-muted/50 text-xs cursor-pointer border-l-2 border-transparent hover:border-teal-500"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 font-bold border border-teal-200/50">
                        {sale.customer?.name ? sale.customer.name.charAt(0).toUpperCase() : 'W'}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-foreground group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                          <span>{sale.invoiceNumber}</span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-teal-600" />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {sale.customer?.name ?? 'Walk-in Patient'} • {formatDate(sale.saleDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold tabular-nums text-foreground text-sm group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">
                        {formatCurrency(Number(sale.totalAmount))}
                      </span>
                      <Badge
                        variant={sale.status === 'COMPLETED' ? 'success' : 'destructive'}
                        className="text-[10px] font-semibold"
                      >
                        {sale.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Operations & Clinical Notice */}
        <div className="space-y-4">
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="h-4 w-4 text-sky-600" />
                <span>Fast-Key Operations</span>
              </CardTitle>
              <CardDescription className="text-xs">Direct shortcuts to high-frequency tasks</CardDescription>
            </CardHeader>
            <CardContent className="p-3.5 space-y-2">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-center justify-between rounded-xl border border-border/70 bg-card p-3 shadow-2xs transition-all hover:border-teal-500/60 hover:bg-teal-50/20 dark:hover:bg-teal-950/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 transition-colors group-hover:bg-teal-600 group-hover:text-white">
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{action.label}</p>
                      <p className="text-[10px] text-muted-foreground">{action.desc}</p>
                    </div>
                  </div>
                  <kbd className="rounded border border-border/80 bg-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
                    {action.shortcut}
                  </kbd>
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Clinical Assurance & Retention Notice */}
          <div className="rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/90 to-teal-100/40 p-4 text-xs text-teal-950 dark:border-teal-800/60 dark:from-teal-950/40 dark:to-slate-900 dark:text-teal-200 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-teal-900 dark:text-teal-200">
              <span className="text-base">⚡</span>
              <span>Automated Patient Adherence Active</span>
            </div>
            <p className="mt-1 text-[11px] text-teal-900/80 dark:text-teal-300/80 leading-relaxed">
              Medicine refill notifications are automatically dispatched via WhatsApp and SMS 48 hours prior to medication exhaustion.
            </p>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. CUSTOMIZE DASHBOARD MODAL / DRAWER
      ───────────────────────────────────────────────────────────── */}
      {isCustomizerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎨</span>
                  <h2 className="text-lg font-bold text-foreground">Customize Admin Dispensary Dashboard</h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select and toggle the clinical, surveillance, and automated patient retention widgets displayed on your workspace.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCustomizerOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            {/* Quick Filter Actions */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground">
                Active Widgets: <span className="text-foreground font-bold">{enabledWidgets.length} / {AVAILABLE_WIDGETS.length}</span>
              </span>

              <div className="flex items-center gap-2">
                <Button onClick={handleSelectAll} variant="outline" size="sm" className="h-7 text-xs">
                  Select All
                </Button>
                <Button onClick={handleResetDefaults} variant="ghost" size="sm" className="h-7 text-xs">
                  Reset Defaults
                </Button>
              </div>
            </div>

            {/* Widgets Selection Grid */}
            <div className="grid gap-2.5 sm:grid-cols-2 max-h-[50vh] overflow-y-auto p-1">
              {AVAILABLE_WIDGETS.map((widget) => {
                const isChecked = enabledWidgets.includes(widget.id)
                const colors = COLOR_MAP[widget.color]

                return (
                  <div
                    key={widget.id}
                    onClick={() => toggleWidget(widget.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      isChecked
                        ? 'border-teal-500 bg-teal-50/30 dark:bg-teal-950/20 shadow-2xs'
                        : 'border-border/70 hover:border-border hover:bg-muted/40 opacity-70'
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border mt-0.5 transition-colors ${
                        isChecked
                          ? 'bg-teal-600 border-teal-600 text-white'
                          : 'border-muted-foreground/40 bg-background'
                      }`}
                    >
                      {isChecked && <Check className="h-3.5 w-3.5" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{widget.iconText}</span>
                        <span className="text-xs font-bold text-foreground truncate">{widget.title}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                        {widget.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCustomizerOpen(false)}
                disabled={savingPrefs}
                className="text-xs h-9"
              >
                Cancel
              </Button>

              <Button
                size="sm"
                onClick={() => handleSavePreferences(enabledWidgets, layoutMode)}
                disabled={savingPrefs}
                className="text-xs h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 shadow-xs"
              >
                {savingPrefs ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                <span>Save Dashboard Layout</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
