import type { Metadata } from 'next'
import { can, getSession } from '@/lib/auth/auth-helpers'
import { getTenantContext } from '@/lib/auth/tenant-context'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'
import { CustomizableAdminDashboard } from '@/components/dashboard/customizable-admin-dashboard'

export const metadata: Metadata = { title: 'Admin Dispensary Dashboard | Sovereign Pharma' }

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
          take: 8,
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
  ] = await Promise.all([
    can(PERMISSIONS.SALES_READ),
    can(PERMISSIONS.INVENTORY_READ),
    can(PERMISSIONS.BATCHES_READ),
    can(PERMISSIONS.PRESCRIPTIONS_READ),
    can(PERMISSIONS.PURCHASES_READ),
    can(PERMISSIONS.CUSTOMERS_READ),
    can(PERMISSIONS.SUPPLIERS_READ),
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

  return (
    <CustomizableAdminDashboard
      todayRevenue={todayRevenue}
      todaySalesCount={todaySalesCount}
      totalProducts={stats.totalProducts}
      lowStockCount={lowStockCount}
      expiringCount={expiringCount}
      pendingRxCount={pendingRxCount}
      recentSales={(stats.recentSales as any) || []}
      branchId={stats.branchId}
      permissions={{
        sales: canSales,
        inventory: canInventory,
        batches: canBatches,
        prescriptions: canPrescriptions,
        purchases: canPurchases,
        customers: canCustomers,
        suppliers: canSuppliers,
      }}
    />
  )
}
