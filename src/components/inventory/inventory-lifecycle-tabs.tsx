'use client'

import {
  Boxes,
  Clock,
  FileSpreadsheet,
  LayoutGrid,
  SlidersHorizontal,
  TrendingDown,
  Truck,
} from 'lucide-react'

export type InventoryTab =
  | 'stock'
  | 'locations'
  | 'dead_stock'
  | 'vendors'
  | 'fefo'
  | 'adjustments'
  | 'movements'

interface InventoryLifecycleTabsProps {
  currentTab: InventoryTab
  onSelectTab: (tab: InventoryTab) => void
  counts?: {
    totalSkus?: number
    nearExpiryCount?: number
    pendingAdjustmentsCount?: number
    deadStockCount?: number
  }
}

export function InventoryLifecycleTabs({
  currentTab,
  onSelectTab,
  counts = {},
}: InventoryLifecycleTabsProps) {
  const tabs: {
    id: InventoryTab
    label: string
    sublabel: string
    icon: any
    badge?: number
    badgeColor?: string
  }[] = [
    {
      id: 'stock',
      label: 'Live Stock',
      sublabel: 'Real-Time Balance',
      icon: Boxes,
      badge: counts.totalSkus,
      badgeColor: 'bg-primary/10 text-primary border-primary/20',
    },
    {
      id: 'locations',
      label: 'Rack & Boxes',
      sublabel: 'Storage Map & Bins',
      icon: LayoutGrid,
    },
    {
      id: 'dead_stock',
      label: 'Dead Stock Radar',
      sublabel: 'Capital Lockup & Aging',
      icon: TrendingDown,
      badge: counts.deadStockCount,
      badgeColor: 'bg-destructive/15 text-destructive border-destructive/30',
    },
    {
      id: 'vendors',
      label: 'Vendor Inventory',
      sublabel: 'Distributor Stocks',
      icon: Truck,
    },
    {
      id: 'fefo',
      label: 'FEFO Expiry',
      sublabel: 'Near-Expiry Radar',
      icon: Clock,
      badge: counts.nearExpiryCount,
      badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold animate-pulse',
    },
    {
      id: 'adjustments',
      label: 'Adjustments',
      sublabel: 'Variance & Approvals',
      icon: SlidersHorizontal,
      badge: counts.pendingAdjustmentsCount,
      badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold',
    },
    {
      id: 'movements',
      label: 'Audit Ledger',
      sublabel: 'Immutable History',
      icon: FileSpreadsheet,
    },
  ]

  return (
    <div className="w-full border-b border-border/60 bg-muted/20 pb-1 pt-1 backdrop-blur-sm">
      <div className="flex space-x-1.5 overflow-x-auto p-1.5 scrollbar-thin">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = currentTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`group relative flex min-w-[150px] flex-1 items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all duration-200 ${
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
                    {tab.label}
                  </span>
                  {typeof tab.badge === 'number' && tab.badge > 0 && (
                    <span
                      className={`inline-flex items-center rounded-full border px-1.5 py-0.2 text-[10px] font-bold ${
                        tab.badgeColor || 'bg-primary/10 text-primary'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>
                <p className="truncate text-[10px] text-muted-foreground">{tab.sublabel}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
