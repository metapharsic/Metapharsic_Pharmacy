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
  customers: boolean
  suppliers: boolean
}) {
  try {
    const tenant = await getTenantContext()
    const organizationId = tenant?.organizationId || undefined
    const branchId = tenant?.branchId || undefined
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
      criticalExpiringCount,
      pendingPrescriptions,
      recentSales,
      salesByPayment,
      totalPatients,
      totalSuppliers,
      branchInfo,
      orgInfo,
    ] = await Promise.all([
      permissions.sales
        ? prisma.sale
            .aggregate({
              where: {
                ...branchScope,
                saleDate: { gte: today },
                status: 'COMPLETED',
              },
              _sum: { totalAmount: true },
              _count: { _all: true },
            })
            .catch(() => null)
        : Promise.resolve(null),
      prisma.product
        .count({
          where: {
            ...(organizationId ? { organizationId } : {}),
            isActive: true,
          },
        })
        .catch(() => 0),
      permissions.inventory
        ? prisma.inventory
            .count({
              where: {
                ...branchScope,
                availableQuantity: { lte: 10, gt: 0 },
              },
            })
            .catch(() => 0)
        : Promise.resolve(null),
      permissions.batches
        ? prisma.batch
            .count({
              where: {
                status: 'ACTIVE',
                ...batchScope,
                expiryDate: {
                  gte: new Date(),
                  lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                },
              },
            })
            .catch(() => 0)
        : Promise.resolve(null),
      permissions.batches
        ? prisma.batch
            .count({
              where: {
                status: 'ACTIVE',
                ...batchScope,
                expiryDate: {
                  gte: new Date(),
                  lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
              },
            })
            .catch(() => 0)
        : Promise.resolve(0),
      permissions.prescriptions
        ? prisma.prescription
            .count({
              where: {
                status: 'PENDING',
                ...prescriptionScope,
              },
            })
            .catch(() => 0)
        : Promise.resolve(null),
      permissions.sales
        ? prisma.sale
            .findMany({
              take: 8,
              orderBy: { createdAt: 'desc' },
              where: branchScope,
              include: { customer: { select: { name: true } } },
            })
            .catch(() => [])
        : Promise.resolve(null),
      permissions.sales
        ? prisma.payment
            .findMany({
              where: {
                paymentDate: { gte: today },
                saleId: { not: null },
                ...(branchId
                  ? { sale: { branchId } }
                  : organizationId
                    ? { sale: { branch: { organizationId } } }
                    : {}),
              },
              select: {
                method: true,
                amount: true,
              },
            })
            .catch((err) => {
              console.error('[Dashboard] Payment query failed:', err)
              return []
            })
        : Promise.resolve([]),
      permissions.customers
        ? prisma.customer
            .count({
              where: {
                ...(organizationId ? { organizationId } : {}),
              },
            })
            .catch(() => 0)
        : Promise.resolve(0),
      permissions.suppliers
        ? prisma.supplier
            .count({
              where: {
                ...(organizationId ? { organizationId } : {}),
                isActive: true,
              },
            })
            .catch(() => 0)
        : Promise.resolve(0),
      branchId
        ? prisma.branch
            .findUnique({
              where: { id: branchId },
              select: { name: true, code: true },
            })
            .catch(() => null)
        : Promise.resolve(null),
      organizationId
        ? prisma.organization
            .findUnique({
              where: { id: organizationId },
              select: { name: true, code: true, gstin: true, dlNumber: true },
            })
            .catch(() => null)
        : Promise.resolve(null),
    ])

    const paymentSplit: Record<string, { count: number; amount: number }> = {}
    for (const p of (salesByPayment as Array<{ method: string; amount: any }>) || []) {
      const m = String(p.method || 'OTHER')
      if (!paymentSplit[m]) {
        paymentSplit[m] = { count: 0, amount: 0 }
      }
      paymentSplit[m].count += 1
      paymentSplit[m].amount += Number(p.amount ?? 0)
    }

    return {
      todaySales,
      totalProducts,
      lowStockCount,
      expiringCount,
      criticalExpiringCount: criticalExpiringCount ?? 0,
      pendingPrescriptions,
      recentSales: recentSales || [],
      branchId,
      paymentSplit,
      totalPatients: totalPatients ?? 0,
      totalSuppliers: totalSuppliers ?? 0,
      branchName: branchInfo?.name,
      organizationName: orgInfo?.name,
      gstin: orgInfo?.gstin ?? undefined,
      dlNumber: orgInfo?.dlNumber ?? undefined,
    }
  } catch (err) {
    console.error('[Dashboard] Unexpected error in getDashboardStats:', err)
    return {
      todaySales: null,
      totalProducts: 0,
      lowStockCount: 0,
      expiringCount: 0,
      criticalExpiringCount: 0,
      pendingPrescriptions: null,
      recentSales: [],
      branchId: undefined,
      paymentSplit: {},
      totalPatients: 0,
      totalSuppliers: 0,
      branchName: undefined,
      organizationName: undefined,
      gstin: undefined,
      dlNumber: undefined,
    }
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
    customers: canCustomers,
    suppliers: canSuppliers,
  })

  const todayRevenue = Number(stats.todaySales?._sum?.totalAmount ?? 0)
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
      criticalExpiringCount={stats.criticalExpiringCount}
      pendingRxCount={pendingRxCount}
      totalPatients={stats.totalPatients}
      totalSuppliers={stats.totalSuppliers}
      paymentSplit={stats.paymentSplit}
      organizationName={stats.organizationName}
      branchName={stats.branchName}
      gstin={stats.gstin}
      dlNumber={stats.dlNumber}
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
