/** @jest-environment node */

import prisma from '@/lib/db/prisma'
import { fetchSidebarAggregates, getDbWorkerPool } from '@/lib/db/db-worker-pool'
import { onboardChemistShop } from '@/lib/organization/org-service'
import { getProducts } from '@/lib/products/product-service'

describe('Milestone 4: Seed Data Isolation & Clean New Chemist State', () => {
  const timestamp = Date.now()
  const testStoreCode = `CLN${timestamp.toString().slice(-5)}`
  const testAdminEmail = `clean.chemist.${timestamp}@testpharmacy.local`

  let createdOrgId: string | null = null
  let createdBranchId: string | null = null
  const createdUserIds: string[] = []

  beforeAll(async () => {
    // 1. Onboard a brand new Chemist Shop
    const result = await onboardChemistShop({
      code: testStoreCode,
      name: 'Clean Slate Healthcare Pharmacy',
      legalName: 'Clean Slate Healthcare Pharmacy Pvt. Ltd.',
      adminName: 'Dr. Clean Chemist',
      adminEmail: testAdminEmail,
      adminPassword: 'Password@Clean123',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
      subscriptionPlan: 'PRO',
      validityDays: 365,
    })

    expect(result.success).toBe(true)
    expect(result.organization.id).toBeDefined()
    expect(result.branch.id).toBeDefined()

    createdOrgId = result.organization.id
    createdBranchId = result.branch.id
    createdUserIds.push(result.adminUser.id)

    // Collect child staff user IDs created during onboarding for thorough cleanup
    const staff = await prisma.user.findMany({
      where: { organizationId: createdOrgId },
      select: { id: true },
    })
    for (const u of staff) {
      if (!createdUserIds.includes(u.id)) {
        createdUserIds.push(u.id)
      }
    }
  })

  afterAll(async () => {
    // Clean up all provisioned test entities
    if (createdOrgId) {
      // Clean user relations and users
      if (createdUserIds.length > 0) {
        await prisma.userRole.deleteMany({
          where: { userId: { in: createdUserIds } },
        })
        await prisma.auditLog.deleteMany({
          where: { userId: { in: createdUserIds } },
        })
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        })
      }

      // Clean organization settings
      await prisma.organizationSetting.deleteMany({
        where: { organizationId: createdOrgId },
      })

      // Clean branch
      if (createdBranchId) {
        await prisma.rack.deleteMany({ where: { branchId: createdBranchId } })
        await prisma.branch.deleteMany({ where: { id: createdBranchId } })
      }

      // Clean audit logs for org
      await prisma.auditLog.deleteMany({
        where: { entityId: createdOrgId },
      })

      // Clean organization
      await prisma.organization.deleteMany({
        where: { id: createdOrgId },
      })
    }

    await getDbWorkerPool().terminate().catch(() => {})
    await prisma.$disconnect()
  })

  // ─────────────────────────────────────────────────────────────
  // TASK 1: Verification of Seed Data Multi-Tenant Scoping
  // ─────────────────────────────────────────────────────────────
  describe('Task 1: Database Seed Multi-Tenant Scoping Integrity', () => {
    it('ensures zero unscoped users exist in the platform database', async () => {
      const unscopedUsers = await prisma.user.count({
        where: { organizationId: null },
      })
      expect(unscopedUsers).toBe(0)
    })

    it('ensures zero unscoped products exist in the platform database', async () => {
      const unscopedProducts = await prisma.product.count({
        where: { organizationId: null },
      })
      expect(unscopedProducts).toBe(0)
    })

    it('ensures zero unscoped categories exist in the platform database', async () => {
      const unscopedCategories = await prisma.category.count({
        where: { organizationId: null },
      })
      expect(unscopedCategories).toBe(0)
    })

    it('ensures zero unscoped suppliers exist in the platform database', async () => {
      const unscopedSuppliers = await prisma.supplier.count({
        where: { organizationId: null },
      })
      expect(unscopedSuppliers).toBe(0)
    })

    it('ensures zero unscoped customers exist in the platform database', async () => {
      const unscopedCustomers = await prisma.customer.count({
        where: { organizationId: null },
      })
      expect(unscopedCustomers).toBe(0)
    })

    it('ensures zero unscoped doctors exist in the platform database', async () => {
      const unscopedDoctors = await prisma.doctor.count({
        where: { organizationId: null },
      })
      expect(unscopedDoctors).toBe(0)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // TASK 2: Clean Tenant State across all 8 Domain Models
  // ─────────────────────────────────────────────────────────────
  describe('Task 2: Clean 0-Record State across All 8 Core Domain Models', () => {
    it('1. Products: newly onboarded chemist shop has exactly 0 products', async () => {
      const productCount = await prisma.product.count({
        where: { organizationId: createdOrgId! },
      })
      expect(productCount).toBe(0)

      // Service query also returns empty result
      const productQueryResult = await getProducts({ organizationId: createdOrgId! })
      expect(productQueryResult.pagination.total).toBe(0)
      expect(productQueryResult.data).toHaveLength(0)
    })

    it('2. Inventory: newly onboarded chemist shop has exactly 0 inventory records', async () => {
      const branchInventoryCount = await prisma.inventory.count({
        where: { branchId: createdBranchId! },
      })
      expect(branchInventoryCount).toBe(0)

      const orgInventoryCount = await prisma.inventory.count({
        where: { branch: { organizationId: createdOrgId! } },
      })
      expect(orgInventoryCount).toBe(0)
    })

    it('3. Batches: newly onboarded chemist shop has exactly 0 active/inactive batches', async () => {
      const branchBatchCount = await prisma.batch.count({
        where: { branchId: createdBranchId! },
      })
      expect(branchBatchCount).toBe(0)

      const orgBatchCount = await prisma.batch.count({
        where: { product: { organizationId: createdOrgId! } },
      })
      expect(orgBatchCount).toBe(0)
    })

    it('4. Sales: newly onboarded chemist shop has exactly 0 sales / bills', async () => {
      const branchSalesCount = await prisma.sale.count({
        where: { branchId: createdBranchId! },
      })
      expect(branchSalesCount).toBe(0)

      const orgSalesCount = await prisma.sale.count({
        where: { branch: { organizationId: createdOrgId! } },
      })
      expect(orgSalesCount).toBe(0)
    })

    it('5. Purchases: newly onboarded chemist shop has exactly 0 purchase orders', async () => {
      const branchPurchasesCount = await prisma.purchase.count({
        where: { branchId: createdBranchId! },
      })
      expect(branchPurchasesCount).toBe(0)

      const orgPurchasesCount = await prisma.purchase.count({
        where: { branch: { organizationId: createdOrgId! } },
      })
      expect(orgPurchasesCount).toBe(0)
    })

    it('6. Customers: newly onboarded chemist shop has exactly 0 customers', async () => {
      const customerCount = await prisma.customer.count({
        where: { organizationId: createdOrgId! },
      })
      expect(customerCount).toBe(0)
    })

    it('7. Suppliers: newly onboarded chemist shop has exactly 0 suppliers', async () => {
      const supplierCount = await prisma.supplier.count({
        where: { organizationId: createdOrgId! },
      })
      expect(supplierCount).toBe(0)
    })

    it('8. Finance / Vouchers / Ledgers: newly onboarded chemist shop has 0 vouchers & movements', async () => {
      const voucherCount = await prisma.voucher.count({
        where: { branchId: createdBranchId! },
      })
      expect(voucherCount).toBe(0)

      const movementCount = await prisma.inventoryMovement.count({
        where: { inventory: { branchId: createdBranchId! } },
      })
      expect(movementCount).toBe(0)

      const adjustmentCount = await prisma.stockAdjustment.count({
        where: { branchId: createdBranchId! },
      })
      expect(adjustmentCount).toBe(0)

      const heldBillCount = await prisma.heldBill.count({
        where: { branchId: createdBranchId! },
      })
      expect(heldBillCount).toBe(0)

      const prescriptionCount = await prisma.prescription.count({
        where: { branchId: createdBranchId! },
      })
      expect(prescriptionCount).toBe(0)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // TASK 3: Parallel Background Worker & Sidebar Aggregate Isolation
  // ─────────────────────────────────────────────────────────────
  describe('Task 3: Parallel Fetch Worker & Sidebar Prefetcher 0-Metrics', () => {
    it('returns clean 0-counts across all 5 telemetry domains in fetchSidebarAggregates', async () => {
      const stats = await fetchSidebarAggregates(createdOrgId!, createdBranchId!)

      // Inventory domain
      expect(stats.inventory.totalProducts).toBe(0)
      expect(stats.inventory.lowStockCount).toBe(0)
      expect(stats.inventory.outOfStockCount).toBe(0)
      expect(stats.inventory.activeBatches).toBe(0)

      // Commerce domain
      expect(stats.commerce.todaySalesCount).toBe(0)
      expect(stats.commerce.pendingPrescriptions).toBe(0)
      expect(stats.commerce.todayRevenue).toBe(0)

      // Finance domain
      expect(stats.finance.receiptVouchersCount).toBe(0)
      expect(stats.finance.activeLedgersCount).toBe(0)
      expect(stats.finance.pendingPayablesCount).toBe(0)

      // Clinical domain
      expect(stats.clinical.totalDoctors).toBe(0)
      expect(stats.clinical.pendingCommissions).toBe(0)
      expect(stats.clinical.activeCustomers).toBe(0)

      // Expiry domain
      expect(stats.expiry.expiredCount).toBe(0)
      expect(stats.expiry.expiring30Count).toBe(0)
      expect(stats.expiry.expiring90Count).toBe(0)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Cross-Tenant Boundary Protection (Zero Leakage from Demo Orgs)
  // ─────────────────────────────────────────────────────────────
  describe('Cross-Tenant Boundary: Zero Leakage from Demo Organizations', () => {
    it('confirms demo organizations contain data while new chemist has 0', async () => {
      const defaultOrgProducts = await prisma.product.count({
        where: { organizationId: 'default-org' },
      })
      expect(defaultOrgProducts).toBeGreaterThan(0)

      const newChemistProducts = await prisma.product.count({
        where: { organizationId: createdOrgId! },
      })
      expect(newChemistProducts).toBe(0)

      const defaultOrgSuppliers = await prisma.supplier.count({
        where: { organizationId: 'default-org' },
      })
      expect(defaultOrgSuppliers).toBeGreaterThan(0)

      const newChemistSuppliers = await prisma.supplier.count({
        where: { organizationId: createdOrgId! },
      })
      expect(newChemistSuppliers).toBe(0)

      const defaultOrgCustomers = await prisma.customer.count({
        where: { organizationId: 'default-org' },
      })
      expect(defaultOrgCustomers).toBeGreaterThan(0)

      const newChemistCustomers = await prisma.customer.count({
        where: { organizationId: createdOrgId! },
      })
      expect(newChemistCustomers).toBe(0)
    })
  })
})
