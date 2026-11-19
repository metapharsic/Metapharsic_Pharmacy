/**
 * Standalone Verification Runner for Milestone 4:
 * Seed Data Isolation & Clean New Chemist State
 *
 * Usage: npx tsx scripts/verify-m4-new-chemist-clean-state.ts
 */

import { PrismaClient } from '@prisma/client'
import { fetchSidebarAggregates, getDbWorkerPool } from '../src/lib/db/db-worker-pool'
import { onboardChemistShop } from '../src/lib/organization/org-service'
import { getProducts } from '../src/lib/products/product-service'

const prisma = new PrismaClient()

interface CheckResult {
  name: string
  passed: boolean
  expected: any
  actual: any
  details?: string
}

async function runMilestone4Verification() {
  console.log('🧪 =========================================================')
  console.log('   MILESTONE 4 AUDIT: SEED DATA ISOLATION & CLEAN NEW CHEMIST')
  console.log('=========================================================\n')

  const results: CheckResult[] = []

  function assert(name: string, passed: boolean, expected: any, actual: any, details?: string) {
    results.push({ name, passed, expected, actual, details })
    const icon = passed ? '✅' : '❌'
    console.log(`  ${icon} ${name} (Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)})`)
    if (!passed && details) {
      console.log(`     ⚠️  Failure detail: ${details}`)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 1. Audit Unscoped Database Records (Zero unscoped records allowed)
  // ─────────────────────────────────────────────────────────────
  console.log('🔍 [STEP 1] Auditing Platform Database for Unscoped Records...')
  const [
    unscopedUsers,
    unscopedProducts,
    unscopedCategories,
    unscopedSuppliers,
    unscopedCustomers,
    unscopedDoctors,
  ] = await Promise.all([
    prisma.user.count({ where: { organizationId: null } }),
    prisma.product.count({ where: { organizationId: null } }),
    prisma.category.count({ where: { organizationId: null } }),
    prisma.supplier.count({ where: { organizationId: null } }),
    prisma.customer.count({ where: { organizationId: null } }),
    prisma.doctor.count({ where: { organizationId: null } }),
  ])

  assert('No unscoped users', unscopedUsers === 0, 0, unscopedUsers)
  assert('No unscoped products', unscopedProducts === 0, 0, unscopedProducts)
  assert('No unscoped categories', unscopedCategories === 0, 0, unscopedCategories)
  assert('No unscoped suppliers', unscopedSuppliers === 0, 0, unscopedSuppliers)
  assert('No unscoped customers', unscopedCustomers === 0, 0, unscopedCustomers)
  assert('No unscoped doctors', unscopedDoctors === 0, 0, unscopedDoctors)

  // ─────────────────────────────────────────────────────────────
  // 2. Provision Fresh Chemist Shop via Onboarding Flow
  // ─────────────────────────────────────────────────────────────
  console.log('\n🏪 [STEP 2] Onboarding Fresh Test Chemist Shop...')
  const timestamp = Date.now()
  const code = `CLN${timestamp.toString().slice(-5)}`
  const email = `clean.chemist.${timestamp}@testpharmacy.local`

  const onboardResult = await onboardChemistShop({
    code,
    name: 'Auditor Clean Chemist Shop',
    legalName: 'Auditor Clean Chemist Shop Pvt. Ltd.',
    adminName: 'Audit Chemist Admin',
    adminEmail: email,
    adminPassword: 'Password@Audit123',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001',
    subscriptionPlan: 'GROWTH',
    validityDays: 365,
  })

  const newOrg = onboardResult.organization
  const newBranch = onboardResult.branch
  console.log(`  ✓ Onboarded Shop: ${newOrg.name} [ID: ${newOrg.id}, Code: ${newOrg.code}]`)
  console.log(`  ✓ Onboarded Branch: ${newBranch.name} [ID: ${newBranch.id}, Code: ${newBranch.code}]`)

  // Track staff for cleanup
  const staff = await prisma.user.findMany({
    where: { organizationId: newOrg.id },
    select: { id: true },
  })
  const userIds = staff.map((u) => u.id)

  try {
    // ─────────────────────────────────────────────────────────────
    // 3. Verify Clean 0-Record Initial State across All 8 Domains
    // ─────────────────────────────────────────────────────────────
    console.log('\n📊 [STEP 3] Auditing Clean 0-Record State across All 8 Domain Models...')

    // 1. Products
    const prodCount = await prisma.product.count({ where: { organizationId: newOrg.id } })
    const prodQuery = await getProducts({ organizationId: newOrg.id })
    assert('Domain 1: Products count is 0', prodCount === 0, 0, prodCount)
    assert('Domain 1: Product query result count is 0', prodQuery.pagination.total === 0, 0, prodQuery.pagination.total)

    // 2. Inventory
    const invBranchCount = await prisma.inventory.count({ where: { branchId: newBranch.id } })
    const invOrgCount = await prisma.inventory.count({ where: { branch: { organizationId: newOrg.id } } })
    assert('Domain 2: Inventory branch count is 0', invBranchCount === 0, 0, invBranchCount)
    assert('Domain 2: Inventory org count is 0', invOrgCount === 0, 0, invOrgCount)

    // 3. Batches
    const batchBranchCount = await prisma.batch.count({ where: { branchId: newBranch.id } })
    const batchOrgCount = await prisma.batch.count({ where: { product: { organizationId: newOrg.id } } })
    assert('Domain 3: Batches branch count is 0', batchBranchCount === 0, 0, batchBranchCount)
    assert('Domain 3: Batches org count is 0', batchOrgCount === 0, 0, batchOrgCount)

    // 4. Sales
    const saleBranchCount = await prisma.sale.count({ where: { branchId: newBranch.id } })
    const saleOrgCount = await prisma.sale.count({ where: { branch: { organizationId: newOrg.id } } })
    assert('Domain 4: Sales branch count is 0', saleBranchCount === 0, 0, saleBranchCount)
    assert('Domain 4: Sales org count is 0', saleOrgCount === 0, 0, saleOrgCount)

    // 5. Purchases
    const purchBranchCount = await prisma.purchase.count({ where: { branchId: newBranch.id } })
    const purchOrgCount = await prisma.purchase.count({ where: { branch: { organizationId: newOrg.id } } })
    assert('Domain 5: Purchases branch count is 0', purchBranchCount === 0, 0, purchBranchCount)
    assert('Domain 5: Purchases org count is 0', purchOrgCount === 0, 0, purchOrgCount)

    // 6. Customers
    const custCount = await prisma.customer.count({ where: { organizationId: newOrg.id } })
    assert('Domain 6: Customers count is 0', custCount === 0, 0, custCount)

    // 7. Suppliers
    const suppCount = await prisma.supplier.count({ where: { organizationId: newOrg.id } })
    assert('Domain 7: Suppliers count is 0', suppCount === 0, 0, suppCount)

    // 8. Vouchers / Ledgers / Movements
    const voucherCount = await prisma.voucher.count({ where: { branchId: newBranch.id } })
    const movementCount = await prisma.inventoryMovement.count({ where: { inventory: { branchId: newBranch.id } } })
    const adjustmentCount = await prisma.stockAdjustment.count({ where: { branchId: newBranch.id } })
    const heldBillCount = await prisma.heldBill.count({ where: { branchId: newBranch.id } })
    const rxCount = await prisma.prescription.count({ where: { branchId: newBranch.id } })

    assert('Domain 8: Vouchers count is 0', voucherCount === 0, 0, voucherCount)
    assert('Domain 8: Stock movements count is 0', movementCount === 0, 0, movementCount)
    assert('Domain 8: Stock adjustments count is 0', adjustmentCount === 0, 0, adjustmentCount)
    assert('Domain 8: Held bills count is 0', heldBillCount === 0, 0, heldBillCount)
    assert('Domain 8: Prescriptions count is 0', rxCount === 0, 0, rxCount)

    // ─────────────────────────────────────────────────────────────
    // 4. Parallel Background Worker Sidebar Telemetry
    // ─────────────────────────────────────────────────────────────
    console.log('\n📈 [STEP 4] Auditing Parallel Background Worker Sidebar Telemetry...')
    const stats = await fetchSidebarAggregates(newOrg.id, newBranch.id)

    assert('Sidebar telemetry: inventory.totalProducts is 0', stats.inventory.totalProducts === 0, 0, stats.inventory.totalProducts)
    assert('Sidebar telemetry: inventory.lowStockCount is 0', stats.inventory.lowStockCount === 0, 0, stats.inventory.lowStockCount)
    assert('Sidebar telemetry: inventory.outOfStockCount is 0', stats.inventory.outOfStockCount === 0, 0, stats.inventory.outOfStockCount)
    assert('Sidebar telemetry: inventory.activeBatches is 0', stats.inventory.activeBatches === 0, 0, stats.inventory.activeBatches)
    assert('Sidebar telemetry: commerce.todaySalesCount is 0', stats.commerce.todaySalesCount === 0, 0, stats.commerce.todaySalesCount)
    assert('Sidebar telemetry: commerce.pendingPrescriptions is 0', stats.commerce.pendingPrescriptions === 0, 0, stats.commerce.pendingPrescriptions)
    assert('Sidebar telemetry: commerce.todayRevenue is 0', stats.commerce.todayRevenue === 0, 0, stats.commerce.todayRevenue)
    assert('Sidebar telemetry: finance.receiptVouchersCount is 0', stats.finance.receiptVouchersCount === 0, 0, stats.finance.receiptVouchersCount)
    assert('Sidebar telemetry: finance.activeLedgersCount is 0', stats.finance.activeLedgersCount === 0, 0, stats.finance.activeLedgersCount)
    assert('Sidebar telemetry: finance.pendingPayablesCount is 0', stats.finance.pendingPayablesCount === 0, 0, stats.finance.pendingPayablesCount)
    assert('Sidebar telemetry: clinical.totalDoctors is 0', stats.clinical.totalDoctors === 0, 0, stats.clinical.totalDoctors)
    assert('Sidebar telemetry: clinical.pendingCommissions is 0', stats.clinical.pendingCommissions === 0, 0, stats.clinical.pendingCommissions)
    assert('Sidebar telemetry: clinical.activeCustomers is 0', stats.clinical.activeCustomers === 0, 0, stats.clinical.activeCustomers)
    assert('Sidebar telemetry: expiry.expiredCount is 0', stats.expiry.expiredCount === 0, 0, stats.expiry.expiredCount)
    assert('Sidebar telemetry: expiry.expiring30Count is 0', stats.expiry.expiring30Count === 0, 0, stats.expiry.expiring30Count)
    assert('Sidebar telemetry: expiry.expiring90Count is 0', stats.expiry.expiring90Count === 0, 0, stats.expiry.expiring90Count)

    // ─────────────────────────────────────────────────────────────
    // 5. Cross-Tenant Barrier Verification
    // ─────────────────────────────────────────────────────────────
    console.log('\n🛡️ [STEP 5] Auditing Cross-Tenant Data Isolation against Demo Data...')
    const defaultOrgProducts = await prisma.product.count({ where: { organizationId: 'default-org' } })
    const defaultOrgSuppliers = await prisma.supplier.count({ where: { organizationId: 'default-org' } })
    const defaultOrgCustomers = await prisma.customer.count({ where: { organizationId: 'default-org' } })

    assert('Demo org has products', defaultOrgProducts > 0, '> 0', defaultOrgProducts)
    assert('New chemist sees 0 demo products', prodCount === 0, 0, prodCount)
    assert('Demo org has suppliers', defaultOrgSuppliers > 0, '> 0', defaultOrgSuppliers)
    assert('New chemist sees 0 demo suppliers', suppCount === 0, 0, suppCount)
    assert('Demo org has customers', defaultOrgCustomers > 0, '> 0', defaultOrgCustomers)
    assert('New chemist sees 0 demo customers', custCount === 0, 0, custCount)

  } finally {
    // ─────────────────────────────────────────────────────────────
    // 6. Cleanup Provisioned Chemist Shop
    // ─────────────────────────────────────────────────────────────
    console.log('\n🧹 [STEP 6] Cleaning up test chemist shop...')
    if (userIds.length > 0) {
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } })
      await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } })
      await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    }
    await prisma.organizationSetting.deleteMany({ where: { organizationId: newOrg.id } })
    await prisma.rack.deleteMany({ where: { branchId: newBranch.id } })
    await prisma.branch.deleteMany({ where: { id: newBranch.id } })
    await prisma.auditLog.deleteMany({ where: { entityId: newOrg.id } })
    await prisma.organization.deleteMany({ where: { id: newOrg.id } })
    console.log('  ✓ Cleaned up test organization and branches.')
  }

  // Final summary
  const passedCount = results.filter((r) => r.passed).length
  const failedCount = results.filter((r) => !r.passed).length
  console.log('\n=========================================================')
  console.log(`🏁 MILESTONE 4 AUDIT RESULT: ${passedCount}/${results.length} PASSED (${failedCount} FAILED)`)
  console.log('=========================================================\n')

  await getDbWorkerPool().terminate().catch(() => {})

  if (failedCount > 0) {
    process.exit(1)
  }
  process.exit(0)
}

runMilestone4Verification()
  .catch((err) => {
    console.error('Fatal execution error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
