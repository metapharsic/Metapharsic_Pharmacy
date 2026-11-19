import {
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  GitCompare,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react'

export type PurchaseStage =
  | 'overview'
  | 'requisitions'
  | 'quotations'
  | 'orders'
  | 'receipts'
  | 'invoices'
  | 'payments'
  | 'agencies'
  | 'returns'
  | 'suppliers'

interface PurchaseLifecycleTabsProps {
  currentStage: PurchaseStage
  onSelectStage: (stage: PurchaseStage) => void
  counts?: {
    requisitionsPending?: number
    quotesActive?: number
    ordersOpen?: number
    pendingReceival?: number
    pendingInvoicing?: number
    overduePayables?: number
    agenciesCount?: number
    pendingReturns?: number
    suppliersCount?: number
  }
}

export function PurchaseLifecycleTabs({
  currentStage,
  onSelectStage,
  counts = {},
}: PurchaseLifecycleTabsProps) {
  const stages: {
    id: PurchaseStage
    label: string
    sublabel: string
    icon: any
    badge?: number
    badgeColor?: string
  }[] = [
    {
      id: 'overview',
      label: 'Pipeline Overview',
      sublabel: 'Lifecycle & Ageing',
      icon: BarChart3,
    },
    {
      id: 'requisitions',
      label: '1. Requisitions (PR)',
      sublabel: 'Auto-reorder & Needs',
      icon: FileText,
      badge: counts.requisitionsPending,
      badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    },
    {
      id: 'quotations',
      label: '2. RFQ & Quotes',
      sublabel: 'Landed Cost Matrix',
      icon: GitCompare,
      badge: counts.quotesActive,
      badgeColor: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    },
    {
      id: 'orders',
      label: '3. Purchase Orders',
      sublabel: 'Vendor Commitments',
      icon: ShoppingCart,
      badge: counts.ordersOpen,
      badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    },
    {
      id: 'receipts',
      label: '4. Goods Receipt (GRN)',
      sublabel: 'Inspection & Batches',
      icon: Truck,
      badge: counts.pendingReceival,
      badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    },
    {
      id: 'invoices',
      label: '5. 3-Way Match & Bills',
      sublabel: 'PO vs GRN vs Invoice',
      icon: Receipt,
      badge: counts.pendingInvoicing,
      badgeColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    },
    {
      id: 'payments',
      label: '6. Accounts Payable',
      sublabel: 'Credit Terms & Pay',
      icon: CreditCard,
      badge: counts.overduePayables,
      badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    },
    {
      id: 'agencies',
      label: 'Agency & Distributors',
      sublabel: 'Distributor Bills & Rates',
      icon: Building2,
      badge: counts.agenciesCount,
      badgeColor: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
    },
    {
      id: 'returns',
      label: 'Purchase Returns',
      sublabel: 'Debit Notes & Credit',
      icon: RotateCcw,
      badge: counts.pendingReturns,
      badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    },
    {
      id: 'suppliers',
      label: 'Supplier Master',
      sublabel: 'Profiles & Sourcing',
      icon: Users,
      badge: counts.suppliersCount,
      badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    },
  ]

  return (
    <div className="w-full border-b border-border/60 bg-muted/20 pb-1 pt-1 backdrop-blur-sm">
      <div className="flex space-x-1 overflow-x-auto p-1.5 scrollbar-thin">
        {stages.map((stage) => {
          const Icon = stage.icon
          const isActive = currentStage === stage.id
          return (
            <button
              key={stage.id}
              onClick={() => onSelectStage(stage.id)}
              className={`group relative flex min-w-[155px] flex-1 items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all duration-200 ${
                isActive
                  ? 'border-primary/40 bg-background shadow-sm ring-1 ring-primary/20'
                  : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-background/60 hover:text-foreground'
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground group-hover:bg-muted/80 group-hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`truncate text-xs font-semibold ${
                      isActive ? 'text-foreground' : 'text-foreground/80'
                    }`}
                  >
                    {stage.label}
                  </span>
                  {typeof stage.badge === 'number' && stage.badge > 0 && (
                    <span
                      className={`inline-flex items-center rounded-full border px-1.5 py-0.2 text-[10px] font-bold ${
                        stage.badgeColor || 'bg-primary/10 text-primary'
                      }`}
                    >
                      {stage.badge}
                    </span>
                  )}
                </div>
                <p className="truncate text-[10px] text-muted-foreground">{stage.sublabel}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
