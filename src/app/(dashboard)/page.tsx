import {
  AlertTriangle,
  Building2,
  ExternalLink,
  FileText,
  Package,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { can, getSession } from '@/lib/auth/auth-helpers'
import { getTenantContext } from '@/lib/auth/tenant-context'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'

export const metadata: Metadata = { title: 'Dashboard' }

async function getDashboardStats(permissions: {
  sales: boolean
  inventory: boolean
  batches: boolean
  prescriptions: boolean
}) {
  const tenant = await getTenantContext()
  const organizationId = tenant?.organizationId ?? undefined
  const branchId = tenant?.branchId ?? undefined
  const orgBranchIds = tenant?.orgBranchIds ?? []

  const branchScope = branchId
    ? { branchId }
    : organizationId
      ? { branch: { organizationId } }
      : {}

  const batchScope = branchId
    ? { branchId }
    : organizationId
      ? (orgBranchIds.length > 0 ? { branchId: { in: orgBranchIds } } : { branchId: '__no_such_branch__' })
      : {}

  const prescriptionScope = branchId
    ? { branchId }
    : organizationId
      ? (orgBranchIds.length > 0 ? { branchId: { in: orgBranchIds } } : { branchId: '__no_such_branch__' })
      : {}

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    todaySales,
    totalProducts,
    lowStockCount,
    expiringCount,
    pendingPrescriptions,
    recentSales,
  ] = await Promise.all([
    permissions.sales
      ? prisma.sale.aggregate({
          where: {
            ...branchScope,
            saleDate: { gte: today },
            status: 'COMPLETED',
          },
          _sum: { totalAmount: true },
          _count: { _all: true },
        })
      : Promise.resolve(null),
    prisma.product.count({
      where: {
        ...(organizationId ? { organizationId } : {}),
        isActive: true,
      },
    }),
    permissions.inventory
      ? prisma.inventory.count({
          where: {
            ...branchScope,
            availableQuantity: { lte: 10, gt: 0 },
          },
        })
      : Promise.resolve(null),
    permissions.batches
      ? prisma.batch.count({
          where: {
            status: 'ACTIVE',
            ...batchScope,
            expiryDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            },
          },
        })
      : Promise.resolve(null),
    permissions.prescriptions
      ? prisma.prescription.count({
          where: {
            status: 'PENDING',
            ...prescriptionScope,
          },
        })
      : Promise.resolve(null),
    permissions.sales
      ? prisma.sale.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          where: branchScope,
          include: { customer: { select: { name: true } } },
        })
      : Promise.resolve(null),
  ])

  return {
    todaySales,
    totalProducts,
    lowStockCount,
    expiringCount,
    pendingPrescriptions,
    recentSales,
    branchId,
  }
}

export default async function DashboardPage() {
  const [
    canSales,
    canInventory,
    canBatches,
    canPrescriptions,
    canPurchases,
    canCustomers,
    canSuppliers,
    session,
  ] = await Promise.all([
    can(PERMISSIONS.SALES_READ),
    can(PERMISSIONS.INVENTORY_READ),
    can(PERMISSIONS.BATCHES_READ),
    can(PERMISSIONS.PRESCRIPTIONS_READ),
    can(PERMISSIONS.PURCHASES_READ),
    can(PERMISSIONS.CUSTOMERS_READ),
    can(PERMISSIONS.SUPPLIERS_READ),
    getSession(),
  ])

  const stats = await getDashboardStats({
    sales: canSales,
    inventory: canInventory,
    batches: canBatches,
    prescriptions: canPrescriptions,
  })

  const todayRevenue = Number(stats.todaySales?._sum.totalAmount ?? 0)
  const todaySalesCount = stats.todaySales?._count?._all ?? 0
  const lowStockCount = stats.lowStockCount ?? 0
  const expiringCount = stats.expiringCount ?? 0
  const pendingRxCount = stats.pendingPrescriptions ?? 0

  const statCards = [
    canSales
      ? {
          title: "Today's Revenue",
          value: todayRevenue > 0 ? formatCurrency(todayRevenue) : '—',
          description: todaySalesCount > 0 ? `${todaySalesCount} completed transactions` : 'No transactions recorded today',
          badge: todayRevenue > 0 ? 'Live Dispensed' : 'Idle',
          badgeVariant: todayRevenue > 0 ? ('teal' as const) : ('secondary' as const),
          icon: TrendingUp,
          accent: 'teal',
        }
      : null,
    {
      title: 'Active Formulary',
      value: stats.totalProducts > 0 ? stats.totalProducts.toLocaleString() : '—',
      description: 'Formulary & generic database',
      badge: stats.totalProducts > 0 ? 'Catalog' : 'Idle',
      badgeVariant: 'secondary' as const,
      icon: Package,
      accent: 'slate',
    },
    canInventory
      ? {
          title: 'Stock Attention',
          value: lowStockCount > 0 ? lowStockCount.toLocaleString() : '—',
          description: lowStockCount > 0 ? 'Items below minimum reorder level' : 'All inventory levels optimal',
          badge: lowStockCount > 0 ? 'Reorder Needed' : 'Nominal',
          badgeVariant: lowStockCount > 0 ? ('warning' as const) : ('secondary' as const),
          icon: AlertTriangle,
          accent: 'amber',
        }
      : null,
    canBatches
      ? {
          title: 'Batches Expiring',
          value: expiringCount > 0 ? expiringCount.toLocaleString() : '—',
          description: expiringCount > 0 ? 'Expiring within 90 days (FEFO)' : 'No batches expiring soon',
          badge: expiringCount > 0 ? 'Review Batches' : 'Safe',
          badgeVariant: expiringCount > 0 ? ('destructive' as const) : ('secondary' as const),
          icon: ShoppingCart,
          accent: 'rose',
        }
      : null,
    canPrescriptions
      ? {
          title: 'Pending Prescriptions',
          value: pendingRxCount > 0 ? pendingRxCount.toLocaleString() : '—',
          description: pendingRxCount > 0 ? 'Awaiting pharmacist validation' : 'All prescriptions cleared',
          badge: pendingRxCount > 0 ? 'Pending Rx' : 'Cleared',
          badgeVariant: pendingRxCount > 0 ? ('info' as const) : ('secondary' as const),
          icon: FileText,
          accent: 'cyan',
        }
      : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null)

  const quickActions = [
    canSales
      ? {
          label: 'New Billing Sale',
          href: '/pos',
          shortcut: 'F2',
          icon: ShoppingCart,
          desc: 'Fast barcode & batch dispensing',
        }
      : null,
    canPurchases
      ? {
          label: 'New Purchase Order',
          href: '/purchases/new',
          shortcut: 'Alt+P',
          icon: Truck,
          desc: 'Replenish stock & record distributor bills',
        }
      : null,
    canSuppliers
      ? {
          label: 'Supplier Master',
          href: '/suppliers',
          shortcut: 'Alt+S',
          icon: Building2,
          desc: 'Manage pharmaceutical distributors & credit days',
        }
      : null,
    canCustomers
      ? {
          label: 'Patient Register',
          href: '/customers',
          shortcut: 'Alt+C',
          icon: Users,
          desc: 'Customer discount tiers & ledger accounts',
        }
      : null,
    canInventory
      ? {
          label: 'Batch Expiry Audit',
          href: '/expiry',
          shortcut: 'Alt+E',
          icon: AlertTriangle,
          desc: 'Inspect FEFO priority batches',
        }
      : null,
  ].filter((a): a is NonNullable<typeof a> => a !== null)

  return (
    <div className="space-y-6 select-none">
      {/* Page Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dispensary Dashboard</h1>
            <Badge variant="teal" className="text-[10px] font-semibold">
              Live Overview
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time dispensing operations, formulary status, and transaction ledger
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Reporting Cycle:</span>
          <span className="font-semibold text-foreground">{formatDate(new Date())}</span>
        </div>
      </div>

      {/* Modern High-Density KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((stat) => (
          <Card key={stat.title} className="relative overflow-hidden group hover:border-teal-500/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {stat.title}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                <stat.icon className="h-3.5 w-3.5" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <div className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {stat.value}
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                <span className="text-muted-foreground truncate max-w-[120px]">{stat.description}</span>
                <Badge variant={stat.badgeVariant} className="text-[10px] py-0 px-1.5 font-semibold">
                  {stat.badge}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid: Recent Sales & Quick Operations */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recent Sales Ledger */}
        {canSales && (
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Recent Sales Activity</CardTitle>
                <CardDescription className="text-xs">
                  Latest verified counter transactions {stats.branchId ? '' : 'across dispensary stations'}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild className="text-xs h-7.5">
                <a href="/sales">View All Sales</a>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {stats.recentSales?.length === 0 || !stats.recentSales ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No sales recorded on this terminal today
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {stats.recentSales.map((sale) => (
                    <Link
                      key={sale.id}
                      href={`/sales/${sale.id}`}
                      className="group flex items-center justify-between p-4 transition-all hover:bg-muted/50 text-xs cursor-pointer border-l-2 border-transparent hover:border-teal-500 hover:pl-3.5"
                      title={`Open invoice ${sale.invoiceNumber}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 font-semibold transition-colors group-hover:bg-teal-600 group-hover:text-white dark:bg-teal-950/60 dark:text-teal-300">
                          {sale.customer?.name ? sale.customer.name.charAt(0).toUpperCase() : 'W'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 font-semibold text-foreground group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                            <span>{sale.invoiceNumber}</span>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-teal-600 dark:text-teal-400" />
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {sale.customer?.name ?? 'Walk-in Customer'} • {formatDate(sale.saleDate)}
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
        )}

        {/* Clinical Quick Actions & Fast-Keys */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Terminal Operations</CardTitle>
              <CardDescription className="text-xs">Direct access to high-frequency tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {quickActions.map((action) => (
                <a
                  key={action.href}
                  href={action.href}
                  className="group flex items-center justify-between rounded-xl border border-border/80 bg-card p-3 shadow-2xs transition-all hover:border-teal-500/60 hover:shadow-card hover:bg-teal-50/20 dark:hover:bg-teal-950/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 transition-colors group-hover:bg-teal-600 group-hover:text-white dark:bg-teal-950/60 dark:text-teal-300">
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{action.label}</p>
                      <p className="text-[11px] text-muted-foreground">{action.desc}</p>
                    </div>
                  </div>
                  <kbd className="rounded border border-border/80 bg-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
                    {action.shortcut}
                  </kbd>
                </a>
              ))}
            </CardContent>
          </Card>

          {/* Clinical Assurance Notice */}
          <div className="rounded-xl border border-teal-200/80 bg-gradient-to-br from-teal-50/90 to-teal-100/40 p-3.5 text-xs text-teal-950 dark:border-teal-800/60 dark:from-teal-950/40 dark:to-slate-900 dark:text-teal-200 shadow-2xs">
            <div className="flex items-center gap-2 font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Regulatory Registry Active</span>
            </div>
            <p className="mt-1 text-[11px] text-teal-900/80 dark:text-teal-300/80 leading-relaxed">
              Schedule H1 drug dispensation strictly verified against prescribing doctor license masters.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
