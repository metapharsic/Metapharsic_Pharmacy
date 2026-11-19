import { PrismaClient } from '@prisma/client'
import { getProducts, createProduct } from '../src/lib/products/product-service'
import { getInventory, getInventorySummary } from '../src/lib/inventory/inventory-service'
import { getBatches } from '../src/lib/batches/batch-service'
import { getExpiringBatches, getExpiredBatches, getExpirySummary } from '../src/lib/batches/expiry-service'
import { searchPosProducts, listSales } from '../src/lib/sales/sales-service'
import { onboardChemistShop } from '../src/lib/organization/org-service'

const prisma = new PrismaClient()

async function main() {
  console.log('=== VERIFYING AMJAD PHARMACY CLEAN SLATE ===')
  const amjadOrgId = 'cmwnr97a0000ec005aagqq8ov'
  const amjadBranchId = 'cmwnr97a6000gc005cduyjiwr'

  // 1. Products
  const products = await getProducts({ organizationId: amjadOrgId })
  console.log(`Amjad Products Count: ${products.data.length} (Expected: 0)`)
  if (products.data.length !== 0) throw new Error('Amjad has products!')

  // 2. Inventory
  const inventory = await getInventory({ organizationId: amjadOrgId })
  console.log(`Amjad Inventory Count: ${inventory.data.length} (Expected: 0)`)
  if (inventory.data.length !== 0) throw new Error('Amjad has inventory!')

  // 3. Inventory Summary
  const invSummary = await getInventorySummary(undefined, undefined, amjadOrgId)
  console.log(`Amjad Inventory Summary: Total SKUs=${invSummary.totalSkus}, Units=${invSummary.totalUnits}, Value=${invSummary.valuationAtCost} (Expected all 0)`)
  if (invSummary.totalSkus !== 0 || invSummary.totalUnits !== 0 || invSummary.valuationAtCost !== 0) {
    throw new Error('Amjad inventory summary is non-zero!')
  }

  // 4. Batches
  const batches = await getBatches({ organizationId: amjadOrgId })
  console.log(`Amjad Batches Count: ${batches.data.length} (Expected: 0)`)
  if (batches.data.length !== 0) throw new Error('Amjad has batches!')

  // 5. Expiring & Expired Batches
  const expiring = await getExpiringBatches({ organizationId: amjadOrgId })
  const expired = await getExpiredBatches({ organizationId: amjadOrgId })
  const expSummary = await getExpirySummary(undefined, undefined, amjadOrgId)
  console.log(`Amjad Expiring: ${expiring.data.length}, Expired: ${expired.data.length}, Summary Expiring: ${expSummary.expiring} (Expected: all 0)`)
  if (expiring.data.length !== 0 || expired.data.length !== 0 || expSummary.expiring !== 0) {
    throw new Error('Amjad has expiring/expired batches!')
  }

  // 6. POS Search
  const posProducts = await searchPosProducts(undefined, amjadBranchId, 60, amjadOrgId)
  console.log(`Amjad POS Products Count: ${posProducts.length} (Expected: 0)`)
  if (posProducts.length !== 0) throw new Error('Amjad has POS products!')

  // 7. Sales History
  const sales = await listSales({ organizationId: amjadOrgId })
  console.log(`Amjad Sales Count: ${sales.data.length} (Expected: 0)`)
  if (sales.data.length !== 0) throw new Error('Amjad has sales!')

  console.log('\n=== TESTING NEW CHEMIST ONBOARDING CLEAN SLATE ===')
  const testStoreCode = `TEST_${Date.now().toString().slice(-4)}`
  const testAdminEmail = `admin.${testStoreCode.toLowerCase()}@testpharma.com`

  const onboardResult = await onboardChemistShop({
    code: testStoreCode,
    name: `Test Clean Chemist ${testStoreCode}`,
    zone: 'OM_MUSCAT',
    adminEmail: testAdminEmail,
    adminName: 'Test Chemist Admin',
    adminPassword: 'Password@123',
  })

  console.log(`Onboarded new chemist: ${onboardResult.organization.name} (${onboardResult.organization.id})`)

  // Check product count for newly created entity
  const newEntityProducts = await getProducts({ organizationId: onboardResult.organization.id })
  console.log(`New Entity Products: ${newEntityProducts.data.length} (Expected: 0)`)
  if (newEntityProducts.data.length !== 0) throw new Error('Newly created entity was seeded with products!')

  // Check batches count for newly created entity
  const newEntityBatches = await getBatches({ organizationId: onboardResult.organization.id })
  console.log(`New Entity Batches: ${newEntityBatches.data.length} (Expected: 0)`)
  if (newEntityBatches.data.length !== 0) throw new Error('Newly created entity was seeded with batches!')

  console.log('\n=== TESTING CROSS-TENANT ISOLATION ON NEW PRODUCT CREATION ===')
  // Create 1 product in the new entity
  const createdProd = await createProduct({
    name: 'Test Tenant Specific Syrup 100ml',
    sku: `${testStoreCode}-SYRUP-001`,
    mrp: 12.5,
    costPrice: 9.0,
    unitOfMeasure: 'BOTTLE',
    gstRate: 5,
    minStockLevel: 5,
    reorderLevel: 10,
    isActive: true,
    isReturnable: true,
    drugSchedule: 'NONE',
    isPrescriptionRequired: false,
    organizationId: onboardResult.organization.id,
    createdById: onboardResult.adminUser.id,
  })
  console.log(`Created product: ${createdProd.name} for org ${onboardResult.organization.id}`)

  // Verify new entity has 1 product
  const afterNewEntityProducts = await getProducts({ organizationId: onboardResult.organization.id })
  console.log(`New Entity Products after addition: ${afterNewEntityProducts.data.length} (Expected: 1)`)
  if (afterNewEntityProducts.data.length !== 1) throw new Error('New entity product not found!')

  // Verify Amjad still has 0 products
  const amjadAfter = await getProducts({ organizationId: amjadOrgId })
  console.log(`Amjad Products after other tenant added item: ${amjadAfter.data.length} (Expected: 0)`)
  if (amjadAfter.data.length !== 0) throw new Error('Amjad contaminated by new entity product!')

  // Clean up the temporary test tenant
  console.log('\nCleaning up temporary test tenant...')
  const bIds = [onboardResult.branch.id]
  await prisma.rack.deleteMany({ where: { branchId: { in: bIds } } })
  await prisma.product.deleteMany({ where: { organizationId: onboardResult.organization.id } })
  await prisma.organizationSetting.deleteMany({ where: { organizationId: onboardResult.organization.id } })
  await prisma.userRole.deleteMany({ where: { user: { organizationId: onboardResult.organization.id } } })
  await prisma.session.deleteMany({ where: { user: { organizationId: onboardResult.organization.id } } })
  await prisma.user.deleteMany({ where: { organizationId: onboardResult.organization.id } })
  await prisma.branch.deleteMany({ where: { organizationId: onboardResult.organization.id } })
  await prisma.organization.delete({ where: { id: onboardResult.organization.id } })
  console.log('Cleanup completed successfully!')

  console.log('\n✅ ALL MULTI-TENANT ISOLATION AND CLEAN SLATE TESTS PASSED!')
}

main()
  .catch((err) => {
    console.error('❌ Verification failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
