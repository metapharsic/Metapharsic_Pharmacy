/**
 * Standalone End-to-End Verification Runner for Milestone 5:
 * Automated Multi-Tenant Data Isolation, Cross-Tenant Boundary Security & Adversarial Testing
 *
 * Usage: npx tsx scripts/verify-multi-tenant-isolation.ts
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { NextRequest } from 'next/server'

import { setAmbientTestUser } from '../src/lib/auth/auth-helpers'
import { getTenantContext, assertBranchBelongsToOrg } from '../src/lib/auth/tenant-context'
import { assertBranchAccess } from '../src/lib/inventory/branch-access'
import { fetchSidebarAggregates, getDbWorkerPool } from '../src/lib/db/db-worker-pool'
import { onboardChemistShop } from '../src/lib/organization/org-service'
import { getProducts } from '../src/lib/products/product-service'
import { getBatches } from '../src/lib/batches/batch-service'
import { listSales, searchPosProducts } from '../src/lib/sales/sales-service'
import { listPurchases, listSuppliers, createPurchase } from '../src/lib/purchases/purchase-service'
import { listCustomers } from '../src/lib/customers/customer-service'
import { listDoctors } from '../src/lib/doctors/doctor-service'
import { listReceivables, listPayables } from '../src/lib/finance/finance-service'
import { ReportService } from '../src/lib/reports/report-service'

// Route handlers for direct HTTP boundary verification
import { GET as pipelineGET } from '../src/app/api/purchases/pipeline/route'
import { GET as requisitionsGET } from '../src/app/api/purchases/requisitions/route'
import { GET as quotationsGET } from '../src/app/api/purchases/quotations/route'
import { GET as suggestionsGET } from '../src/app/api/purchases/requisitions/suggestions/route'
import { GET as agencyGET } from '../src/app/api/purchases/agency/route'
import { GET as productsGET } from '../src/app/api/products/route'
import { GET as customersGET } from '../src/app/api/customers/route'
import { GET as doctorsGET } from '../src/app/api/doctors/route'
import { GET as platformAnalyticsGET } from '../src/app/api/platform/analytics/route'

const prisma = new PrismaClient()

interface CheckResult {
  tier: string
  name: string
  passed: boolean
  expected: any
  actual: any
  details?: string
}

async function runMultiTenantVerification() {
  console.log('🧪 =========================================================================')
  console.log('   MILESTONE 5: AUTOMATED MULTI-TENANT ISOLATION & ADVERSARIAL SUITE')
  console.log('=========================================================================\n')

  const results: CheckResult[] = []

  function assert(
    tier: string,
    name: string,
    actual: any,
    expected: any,
    details?: string
  ) {
    const passed =
      actual === expected ||
      JSON.stringify(actual) === JSON.stringify(expected)
    results.push({ tier, name, passed, expected, actual, details })
    const icon = passed ? '✅' : '❌'
    console.log(`  ${icon} [${tier}] ${name} (Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)})`)
    if (!passed && details) {
      console.log(`     ⚠️  Failure detail: ${details}`)
    }
  }

  const timestamp = Date.now()

  // Track created entities for deterministic cleanup
  const cleanupOrgIds: string[] = []
  const cleanupBranchIds: string[] = []
  const cleanupUserIds: string[] = []
  const cleanupProductIds: string[] = []
  const cleanupCustomerIds: string[] = []
  const cleanupSupplierIds: string[] = []
  const cleanupDoctorIds: string[] = []
  const cleanupPurchaseIds: string[] = []
  const cleanupSaleIds: string[] = []

  try {
    // ─────────────────────────────────────────────────────────────
    // SETUP: Establish 3 Distinct Chemist Organizations
    // ─────────────────────────────────────────────────────────────
    console.log('🏗️  [SETUP] Provisioning & Aligning Multi-Tenant Test Organizations...')

    // Tenant A: Apollo Pharmacy & Healthcare
    const orgApolloId = 'org-apollo-pharma'
    const branchApolloId = 'branch-apollo-01'
    let apolloOrg = await prisma.organization.findUnique({ where: { id: orgApolloId } })
    if (!apolloOrg) {
      apolloOrg = await prisma.organization.create({
        data: {
          id: orgApolloId,
          code: 'APOLLO',
          slug: 'apollo',
          name: 'Apollo Pharmacy & Healthcare',
          status: 'ACTIVE',
          subscriptionPlan: 'ENTERPRISE',
        },
      })
      cleanupOrgIds.push(orgApolloId)
    }

    let apolloBranch = await prisma.branch.findUnique({ where: { id: branchApolloId } })
    if (!apolloBranch) {
      apolloBranch = await prisma.branch.create({
        data: {
          id: branchApolloId,
          organizationId: orgApolloId,
          name: 'Apollo Banjara Hills Branch',
          code: 'AP-BH',
          isHeadOffice: true,
          isActive: true,
        },
      })
      cleanupBranchIds.push(branchApolloId)
    }

    // Tenant B: Krishna Medical Store
    const orgKrishnaId = 'org-krishna-medical'
    const branchKrishnaId = 'branch-krishna-01'
    let krishnaOrg = await prisma.organization.findUnique({ where: { id: orgKrishnaId } })
    if (!krishnaOrg) {
      krishnaOrg = await prisma.organization.create({
        data: {
          id: orgKrishnaId,
          code: 'KRISHNA',
          slug: `krishna-${timestamp}`,
          name: 'Krishna Medical Store',
          status: 'ACTIVE',
          subscriptionPlan: 'GROWTH',
        },
      })
      cleanupOrgIds.push(orgKrishnaId)
    }

    let krishnaBranch = await prisma.branch.findUnique({ where: { id: branchKrishnaId } })
    if (!krishnaBranch) {
      krishnaBranch = await prisma.branch.create({
        data: {
          id: branchKrishnaId,
          organizationId: orgKrishnaId,
          name: 'Krishna Medical Main Counter',
          code: 'KM-01',
          isHeadOffice: true,
          isActive: true,
        },
      })
      cleanupBranchIds.push(branchKrishnaId)
    }

    // Users for Apollo and Krishna
    const apolloAdminEmail = `apollo.test.${timestamp}@pharmacare.local`
    const apolloUser = await prisma.user.create({
      data: {
        email: apolloAdminEmail,
        name: 'Apollo Admin Tester',
        organizationId: orgApolloId,
        branchId: branchApolloId,
        isActive: true,
        isSuperAdmin: false,
      },
    })
    cleanupUserIds.push(apolloUser.id)

    const krishnaAdminEmail = `krishna.test.${timestamp}@pharmacare.local`
    const krishnaUser = await prisma.user.create({
      data: {
        email: krishnaAdminEmail,
        name: 'Krishna Admin Tester',
        organizationId: orgKrishnaId,
        branchId: branchKrishnaId,
        isActive: true,
        isSuperAdmin: false,
      },
    })
    cleanupUserIds.push(krishnaUser.id)

    // Tenant C: Dynamically onboarded fresh chemist shop ("Shifa Medical Store")
    console.log('🏪 [SETUP] Dynamically onboarding Tenant C: Shifa Medical Store...')
    const shifaCode = `SHF${timestamp.toString().slice(-5)}`
    const shifaEmail = `shifa.admin.${timestamp}@testpharma.local`
    const shifaOnboard = await onboardChemistShop({
      code: shifaCode,
      name: 'Shifa Medical Store',
      legalName: 'Shifa Medical Store LLP',
      adminName: 'Shifa Pharmacist Admin',
      adminEmail: shifaEmail,
      adminPassword: 'Password@Shifa123',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500001',
      subscriptionPlan: 'GROWTH',
      validityDays: 365,
    })

    const orgShifaId = shifaOnboard.organization.id
    const branchShifaId = shifaOnboard.branch.id
    cleanupOrgIds.push(orgShifaId)
    cleanupBranchIds.push(branchShifaId)
    cleanupUserIds.push(shifaOnboard.adminUser.id)

    // Collect child staff user IDs for cleanup
    const shifaStaff = await prisma.user.findMany({
      where: { organizationId: orgShifaId },
      select: { id: true },
    })
    for (const u of shifaStaff) {
      if (!cleanupUserIds.includes(u.id)) {
        cleanupUserIds.push(u.id)
      }
    }

    console.log(`  ✓ Tenant A: ${apolloOrg.name} [Org: ${orgApolloId}, Branch: ${branchApolloId}]`)
    console.log(`  ✓ Tenant B: ${krishnaOrg.name} [Org: ${orgKrishnaId}, Branch: ${branchKrishnaId}]`)
    console.log(`  ✓ Tenant C: ${shifaOnboard.organization.name} [Org: ${orgShifaId}, Branch: ${branchShifaId}]`)

    // Seed domain records for Tenant A (Apollo)
    const apolloProdSku = `AP-PARA-${timestamp.toString().slice(-4)}`
    const apolloProduct = await prisma.product.create({
      data: {
        organizationId: orgApolloId,
        createdById: apolloUser.id,
        name: 'Apollo Paracetamol 650mg Forte',
        genericName: 'Paracetamol',
        sku: apolloProdSku,
        barcode: `890${timestamp.toString().slice(-9)}1`,
        mrp: new Prisma.Decimal(50.0),
        costPrice: new Prisma.Decimal(25.0),
        isActive: true,
        unitOfMeasure: 'Strip',
      },
    })
    cleanupProductIds.push(apolloProduct.id)

    const apolloBatch = await prisma.batch.create({
      data: {
        productId: apolloProduct.id,
        branchId: branchApolloId,
        batchNumber: `AP-B-${timestamp.toString().slice(-4)}`,
        quantity: 150,
        purchasePrice: new Prisma.Decimal(25.0),
        mrp: new Prisma.Decimal(50.0),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
      },
    })

    await prisma.inventory.upsert({
      where: { productId_branchId: { productId: apolloProduct.id, branchId: branchApolloId } },
      create: {
        productId: apolloProduct.id,
        branchId: branchApolloId,
        totalQuantity: 150,
        availableQuantity: 150,
      },
      update: {
        totalQuantity: 150,
        availableQuantity: 150,
      },
    })

    const apolloCustomer = await prisma.customer.create({
      data: {
        organizationId: orgApolloId,
        name: 'Apollo Care Patient Alpha',
        phone: `91${timestamp.toString().slice(-8)}1`,
        creditLimit: new Prisma.Decimal(5000),
        outstandingBalance: new Prisma.Decimal(1250),
        isActive: true,
      },
    })
    cleanupCustomerIds.push(apolloCustomer.id)

    const apolloSupplier = await prisma.supplier.create({
      data: {
        organizationId: orgApolloId,
        name: 'Apollo Direct Wholesaler Alpha',
        phone: `92${timestamp.toString().slice(-8)}1`,
        outstandingBalance: new Prisma.Decimal(8500),
        isActive: true,
      },
    })
    cleanupSupplierIds.push(apolloSupplier.id)

    const apolloDoctor = await prisma.doctor.create({
      data: {
        organizationId: orgApolloId,
        name: 'Dr. Apollo Cardiologist Alpha',
        phone: `93${timestamp.toString().slice(-8)}1`,
        registrationNo: `AP-DOC-${timestamp.toString().slice(-5)}1`,
        regNumber: `AP-DOC-${timestamp.toString().slice(-5)}1`,
        isActive: true,
      },
    })
    cleanupDoctorIds.push(apolloDoctor.id)

    const apolloSale = await prisma.sale.create({
      data: {
        invoiceNumber: `AP-INV-${timestamp.toString().slice(-6)}1`,
        branchId: branchApolloId,
        customerId: apolloCustomer.id,
        totalAmount: new Prisma.Decimal(500),
        subtotal: new Prisma.Decimal(500),
        amountPaid: new Prisma.Decimal(500),
        balanceDue: new Prisma.Decimal(0),
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        createdById: apolloUser.id,
        items: {
          create: {
            productId: apolloProduct.id,
            productName: apolloProduct.name,
            productSku: apolloProduct.sku,
            quantity: 10,
            unitPrice: new Prisma.Decimal(50),
            mrp: new Prisma.Decimal(50),
            totalAmount: new Prisma.Decimal(500),
          },
        },
      },
    })
    cleanupSaleIds.push(apolloSale.id)

    const apolloPurchase = await prisma.purchase.create({
      data: {
        purchaseNumber: `AP-PO-${timestamp.toString().slice(-6)}1`,
        branchId: branchApolloId,
        supplierId: apolloSupplier.id,
        totalAmount: new Prisma.Decimal(2500),
        subtotal: new Prisma.Decimal(2500),
        amountPaid: new Prisma.Decimal(0),
        balanceDue: new Prisma.Decimal(2500),
        status: 'ORDERED',
        createdById: apolloUser.id,
        items: {
          create: {
            productId: apolloProduct.id,
            batchId: apolloBatch.id,
            orderedQuantity: 100,
            unitCost: new Prisma.Decimal(25),
            mrp: new Prisma.Decimal(50),
            totalAmount: new Prisma.Decimal(2500),
          },
        },
      },
    })
    cleanupPurchaseIds.push(apolloPurchase.id)

    // Seed domain records for Tenant B (Krishna)
    const krishnaProdSku = `KM-AMOX-${timestamp.toString().slice(-4)}`
    const krishnaProduct = await prisma.product.create({
      data: {
        organizationId: orgKrishnaId,
        createdById: krishnaUser.id,
        name: 'Krishna Amoxicillin 500mg Plus',
        genericName: 'Amoxicillin',
        sku: krishnaProdSku,
        barcode: `890${timestamp.toString().slice(-9)}2`,
        mrp: new Prisma.Decimal(75.0),
        costPrice: new Prisma.Decimal(40.0),
        isActive: true,
        unitOfMeasure: 'Strip',
      },
    })
    cleanupProductIds.push(krishnaProduct.id)

    const krishnaBatch = await prisma.batch.create({
      data: {
        productId: krishnaProduct.id,
        branchId: branchKrishnaId,
        batchNumber: `KM-B-${timestamp.toString().slice(-4)}`,
        quantity: 200,
        purchasePrice: new Prisma.Decimal(40.0),
        mrp: new Prisma.Decimal(75.0),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
      },
    })

    await prisma.inventory.upsert({
      where: { productId_branchId: { productId: krishnaProduct.id, branchId: branchKrishnaId } },
      create: {
        productId: krishnaProduct.id,
        branchId: branchKrishnaId,
        totalQuantity: 200,
        availableQuantity: 200,
      },
      update: {
        totalQuantity: 200,
        availableQuantity: 200,
      },
    })

    const krishnaCustomer = await prisma.customer.create({
      data: {
        organizationId: orgKrishnaId,
        name: 'Krishna Care Patient Beta',
        phone: `91${timestamp.toString().slice(-8)}2`,
        creditLimit: new Prisma.Decimal(10000),
        outstandingBalance: new Prisma.Decimal(3400),
        isActive: true,
      },
    })
    cleanupCustomerIds.push(krishnaCustomer.id)

    const krishnaSupplier = await prisma.supplier.create({
      data: {
        organizationId: orgKrishnaId,
        name: 'Krishna Wholesale Distributor Beta',
        phone: `92${timestamp.toString().slice(-8)}2`,
        outstandingBalance: new Prisma.Decimal(14200),
        isActive: true,
      },
    })
    cleanupSupplierIds.push(krishnaSupplier.id)

    const krishnaDoctor = await prisma.doctor.create({
      data: {
        organizationId: orgKrishnaId,
        name: 'Dr. Krishna Pediatrician Beta',
        phone: `93${timestamp.toString().slice(-8)}2`,
        registrationNo: `KM-DOC-${timestamp.toString().slice(-5)}2`,
        regNumber: `KM-DOC-${timestamp.toString().slice(-5)}2`,
        isActive: true,
      },
    })
    cleanupDoctorIds.push(krishnaDoctor.id)

    const krishnaSale = await prisma.sale.create({
      data: {
        invoiceNumber: `KM-INV-${timestamp.toString().slice(-6)}2`,
        branchId: branchKrishnaId,
        customerId: krishnaCustomer.id,
        totalAmount: new Prisma.Decimal(750),
        subtotal: new Prisma.Decimal(750),
        amountPaid: new Prisma.Decimal(750),
        balanceDue: new Prisma.Decimal(0),
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        createdById: krishnaUser.id,
        items: {
          create: {
            productId: krishnaProduct.id,
            productName: krishnaProduct.name,
            productSku: krishnaProduct.sku,
            quantity: 10,
            unitPrice: new Prisma.Decimal(75),
            mrp: new Prisma.Decimal(75),
            totalAmount: new Prisma.Decimal(750),
          },
        },
      },
    })
    cleanupSaleIds.push(krishnaSale.id)

    const krishnaPurchase = await prisma.purchase.create({
      data: {
        purchaseNumber: `KM-PO-${timestamp.toString().slice(-6)}2`,
        branchId: branchKrishnaId,
        supplierId: krishnaSupplier.id,
        totalAmount: new Prisma.Decimal(4000),
        subtotal: new Prisma.Decimal(4000),
        amountPaid: new Prisma.Decimal(0),
        balanceDue: new Prisma.Decimal(4000),
        status: 'ORDERED',
        createdById: krishnaUser.id,
        items: {
          create: {
            productId: krishnaProduct.id,
            batchId: krishnaBatch.id,
            orderedQuantity: 100,
            unitCost: new Prisma.Decimal(40),
            mrp: new Prisma.Decimal(75),
            totalAmount: new Prisma.Decimal(4000),
          },
        },
      },
    })
    cleanupPurchaseIds.push(krishnaPurchase.id)

    console.log('  ✓ Seeded distinct test data for Apollo and Krishna.\n')

    // Prepare Actors for Simulated Sessions
    const apolloActor = {
      id: apolloUser.id,
      organizationId: orgApolloId,
      branchId: branchApolloId,
      permissions: ['purchases:read', 'purchases:create', 'sales:read', 'products:read', 'inventory:read', 'reports:sales', 'finance:read'],
      roles: ['admin'],
      isSuperAdmin: false,
    }

    const krishnaActor = {
      id: krishnaUser.id,
      organizationId: orgKrishnaId,
      branchId: branchKrishnaId,
      permissions: ['purchases:read', 'purchases:create', 'sales:read', 'products:read', 'inventory:read', 'reports:sales', 'finance:read'],
      roles: ['admin'],
      isSuperAdmin: false,
    }

    const shifaActor = {
      id: shifaOnboard.adminUser.id,
      organizationId: orgShifaId,
      branchId: branchShifaId,
      permissions: ['purchases:read', 'purchases:create', 'sales:read', 'products:read', 'inventory:read', 'reports:sales', 'finance:read'],
      roles: ['owner'],
      isSuperAdmin: false,
    }

    const superAdminActor = {
      id: 'super-admin-verifier',
      organizationId: 'default-org',
      branchId: 'default-branch',
      permissions: ['platform:read', 'reports:sales', 'purchases:read'],
      roles: ['super_admin'],
      isSuperAdmin: true,
    }

    const unassociatedActor = {
      id: 'unassociated-user-tester',
      organizationId: null,
      branchId: null,
      permissions: ['products:read', 'customers:read', 'purchases:read', 'finance:read', 'reports:sales'],
      roles: ['cashier'],
      isSuperAdmin: false,
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 1: Feature Coverage (11 Functional Domains)
    // ─────────────────────────────────────────────────────────────
    console.log('🔍 [TIER 1] Verifying Multi-Tenant Isolation across 11 Functional Domains...')

    // 1. Products
    const apolloProds = await getProducts({ organizationId: orgApolloId })
    const krishnaProds = await getProducts({ organizationId: orgKrishnaId })
    const shifaProds = await getProducts({ organizationId: orgShifaId })

    assert('Tier 1: Products', 'Apollo sees Apollo product', apolloProds.data.some((p) => p.sku === apolloProdSku), true)
    assert('Tier 1: Products', 'Apollo does NOT see Krishna product', apolloProds.data.some((p) => p.sku === krishnaProdSku), false)
    assert('Tier 1: Products', 'Krishna sees Krishna product', krishnaProds.data.some((p) => p.sku === krishnaProdSku), true)
    assert('Tier 1: Products', 'Krishna does NOT see Apollo product', krishnaProds.data.some((p) => p.sku === apolloProdSku), false)
    assert('Tier 1: Products', 'Shifa New Chemist has exactly 0 products', shifaProds.pagination.total === 0, true)

    // 2. Inventory
    const apolloInv = await prisma.inventory.findMany({ where: { branchId: branchApolloId }, include: { product: true } })
    const krishnaInv = await prisma.inventory.findMany({ where: { branchId: branchKrishnaId }, include: { product: true } })
    const shifaInv = await prisma.inventory.findMany({ where: { branchId: branchShifaId } })

    assert('Tier 1: Inventory', 'Apollo branch inventory has Apollo product', apolloInv.some((i) => i.productId === apolloProduct.id), true)
    assert('Tier 1: Inventory', 'Apollo branch inventory does NOT have Krishna product', apolloInv.some((i) => i.productId === krishnaProduct.id), false)
    assert('Tier 1: Inventory', 'Krishna branch inventory has Krishna product', krishnaInv.some((i) => i.productId === krishnaProduct.id), true)
    assert('Tier 1: Inventory', 'Krishna branch inventory does NOT have Apollo product', krishnaInv.some((i) => i.productId === apolloProduct.id), false)
    assert('Tier 1: Inventory', 'Shifa New Chemist has 0 inventory records', shifaInv.length === 0, true)

    // 3. Batches
    const apolloBatches = await getBatches({ branchId: branchApolloId })
    const krishnaBatches = await getBatches({ branchId: branchKrishnaId })
    const shifaBatches = await getBatches({ branchId: branchShifaId })

    assert('Tier 1: Batches', 'Apollo sees Apollo batch AP-B', apolloBatches.data.some((b) => b.batchNumber === apolloBatch.batchNumber), true)
    assert('Tier 1: Batches', 'Apollo does NOT see Krishna batch KM-B', apolloBatches.data.some((b) => b.batchNumber === krishnaBatch.batchNumber), false)
    assert('Tier 1: Batches', 'Krishna sees Krishna batch KM-B', krishnaBatches.data.some((b) => b.batchNumber === krishnaBatch.batchNumber), true)
    assert('Tier 1: Batches', 'Krishna does NOT see Apollo batch AP-B', krishnaBatches.data.some((b) => b.batchNumber === apolloBatch.batchNumber), false)
    assert('Tier 1: Batches', 'Shifa New Chemist has 0 batches', shifaBatches.data.length === 0, true)

    // 4. Sales
    const apolloSales = await listSales({}, branchApolloId)
    const krishnaSales = await listSales({}, branchKrishnaId)
    const shifaSales = await listSales({}, branchShifaId)

    assert('Tier 1: Sales', 'Apollo sees Apollo sale', apolloSales.data.some((s) => s.id === apolloSale.id), true)
    assert('Tier 1: Sales', 'Apollo does NOT see Krishna sale', apolloSales.data.some((s) => s.id === krishnaSale.id), false)
    assert('Tier 1: Sales', 'Krishna sees Krishna sale', krishnaSales.data.some((s) => s.id === krishnaSale.id), true)
    assert('Tier 1: Sales', 'Krishna does NOT see Apollo sale', krishnaSales.data.some((s) => s.id === apolloSale.id), false)
    assert('Tier 1: Sales', 'Shifa New Chemist has 0 sales', shifaSales.data.length === 0, true)

    // 5. Purchases
    const apolloPurch = await listPurchases({}, apolloActor)
    const krishnaPurch = await listPurchases({}, krishnaActor)
    const shifaPurch = await listPurchases({}, shifaActor)

    assert('Tier 1: Purchases', 'Apollo sees Apollo purchase', apolloPurch.data.some((p) => p.id === apolloPurchase.id), true)
    assert('Tier 1: Purchases', 'Apollo does NOT see Krishna purchase', apolloPurch.data.some((p) => p.id === krishnaPurchase.id), false)
    assert('Tier 1: Purchases', 'Krishna sees Krishna purchase', krishnaPurch.data.some((p) => p.id === krishnaPurchase.id), true)
    assert('Tier 1: Purchases', 'Krishna does NOT see Apollo purchase', krishnaPurch.data.some((p) => p.id === apolloPurchase.id), false)
    assert('Tier 1: Purchases', 'Shifa New Chemist has 0 purchases', shifaPurch.data.length === 0, true)

    // 6. Customers
    const apolloCusts = await listCustomers({ organizationId: orgApolloId } as any)
    const krishnaCusts = await listCustomers({ organizationId: orgKrishnaId } as any)
    const shifaCusts = await listCustomers({ organizationId: orgShifaId } as any)

    assert('Tier 1: Customers', 'Apollo sees Apollo customer', apolloCusts.data.some((c) => c.id === apolloCustomer.id), true)
    assert('Tier 1: Customers', 'Apollo does NOT see Krishna customer', apolloCusts.data.some((c) => c.id === krishnaCustomer.id), false)
    assert('Tier 1: Customers', 'Krishna sees Krishna customer', krishnaCusts.data.some((c) => c.id === krishnaCustomer.id), true)
    assert('Tier 1: Customers', 'Krishna does NOT see Apollo customer', krishnaCusts.data.some((c) => c.id === apolloCustomer.id), false)
    assert('Tier 1: Customers', 'Shifa New Chemist has 0 customers', shifaCusts.data.length === 0, true)

    // 7. Suppliers
    const apolloSupps = await listSuppliers({}, apolloActor)
    const krishnaSupps = await listSuppliers({}, krishnaActor)
    const shifaSupps = await listSuppliers({}, shifaActor)

    assert('Tier 1: Suppliers', 'Apollo sees Apollo supplier', apolloSupps.data.some((s) => s.id === apolloSupplier.id), true)
    assert('Tier 1: Suppliers', 'Apollo does NOT see Krishna supplier', apolloSupps.data.some((s) => s.id === krishnaSupplier.id), false)
    assert('Tier 1: Suppliers', 'Krishna sees Krishna supplier', krishnaSupps.data.some((s) => s.id === krishnaSupplier.id), true)
    assert('Tier 1: Suppliers', 'Krishna does NOT see Apollo supplier', krishnaSupps.data.some((s) => s.id === apolloSupplier.id), false)
    assert('Tier 1: Suppliers', 'Shifa New Chemist has 0 suppliers', shifaSupps.data.length === 0, true)

    // 8. Doctors
    const apolloDocs = await listDoctors({ organizationId: orgApolloId })
    const krishnaDocs = await listDoctors({ organizationId: orgKrishnaId })
    const shifaDocs = await listDoctors({ organizationId: orgShifaId })

    assert('Tier 1: Doctors', 'Apollo sees Apollo doctor', apolloDocs.some((d) => d.id === apolloDoctor.id), true)
    assert('Tier 1: Doctors', 'Apollo does NOT see Krishna doctor', apolloDocs.some((d) => d.id === krishnaDoctor.id), false)
    assert('Tier 1: Doctors', 'Krishna sees Krishna doctor', krishnaDocs.some((d) => d.id === krishnaDoctor.id), true)
    assert('Tier 1: Doctors', 'Krishna does NOT see Apollo doctor', krishnaDocs.some((d) => d.id === apolloDoctor.id), false)
    assert('Tier 1: Doctors', 'Shifa New Chemist has 0 doctors', shifaDocs.length === 0, true)

    // 9. Finance (Receivables & Payables)
    const apolloRec = await listReceivables({}, apolloActor)
    const krishnaRec = await listReceivables({}, krishnaActor)
    const shifaRec = await listReceivables({}, shifaActor)

    assert('Tier 1: Finance', 'Apollo receivables has Apollo customer', apolloRec.data.some((r) => r.id === apolloCustomer.id), true)
    assert('Tier 1: Finance', 'Apollo receivables does NOT have Krishna customer', apolloRec.data.some((r) => r.id === krishnaCustomer.id), false)
    assert('Tier 1: Finance', 'Krishna receivables has Krishna customer', krishnaRec.data.some((r) => r.id === krishnaCustomer.id), true)
    assert('Tier 1: Finance', 'Krishna receivables does NOT have Apollo customer', krishnaRec.data.some((r) => r.id === apolloCustomer.id), false)
    assert('Tier 1: Finance', 'Shifa New Chemist has 0 receivables', shifaRec.data.length === 0, true)

    const apolloPay = await listPayables({}, apolloActor)
    const krishnaPay = await listPayables({}, krishnaActor)
    const shifaPay = await listPayables({}, shifaActor)

    assert('Tier 1: Finance', 'Apollo payables has Apollo supplier', apolloPay.data.some((p) => p.id === apolloSupplier.id), true)
    assert('Tier 1: Finance', 'Apollo payables does NOT have Krishna supplier', apolloPay.data.some((p) => p.id === krishnaSupplier.id), false)
    assert('Tier 1: Finance', 'Krishna payables has Krishna supplier', krishnaPay.data.some((p) => p.id === krishnaSupplier.id), true)
    assert('Tier 1: Finance', 'Krishna payables does NOT have Apollo supplier', krishnaPay.data.some((p) => p.id === apolloSupplier.id), false)
    assert('Tier 1: Finance', 'Shifa New Chemist has 0 payables', shifaPay.data.length === 0, true)

    // 10. Reports
    const apolloStockReport = await ReportService.getDailyStockPosition(branchApolloId)
    const krishnaStockReport = await ReportService.getDailyStockPosition(branchKrishnaId)
    const shifaStockReport = await ReportService.getDailyStockPosition(branchShifaId)

    assert('Tier 1: Reports', 'Apollo stock report contains Apollo product', apolloStockReport.data.some((s) => s.productId === apolloProduct.id), true)
    assert('Tier 1: Reports', 'Apollo stock report does NOT contain Krishna product', apolloStockReport.data.some((s) => s.productId === krishnaProduct.id), false)
    assert('Tier 1: Reports', 'Krishna stock report contains Krishna product', krishnaStockReport.data.some((s) => s.productId === krishnaProduct.id), true)
    assert('Tier 1: Reports', 'Krishna stock report does NOT contain Apollo product', krishnaStockReport.data.some((s) => s.productId === apolloProduct.id), false)
    assert('Tier 1: Reports', 'Shifa stock report has 0 items', shifaStockReport.data.length === 0, true)

    const apolloDoctorReport = await ReportService.getDoctorPerformanceReport('', orgApolloId)
    const krishnaDoctorReport = await ReportService.getDoctorPerformanceReport('', orgKrishnaId)
    const shifaDoctorReport = await ReportService.getDoctorPerformanceReport('', orgShifaId)

    assert('Tier 1: Reports', 'Apollo doctor report includes Apollo doctor', apolloDoctorReport.some((d) => d.id === apolloDoctor.id), true)
    assert('Tier 1: Reports', 'Apollo doctor report excludes Krishna doctor', apolloDoctorReport.some((d) => d.id === krishnaDoctor.id), false)
    assert('Tier 1: Reports', 'Krishna doctor report includes Krishna doctor', krishnaDoctorReport.some((d) => d.id === krishnaDoctor.id), true)
    assert('Tier 1: Reports', 'Krishna doctor report excludes Apollo doctor', krishnaDoctorReport.some((d) => d.id === apolloDoctor.id), false)
    assert('Tier 1: Reports', 'Shifa doctor report has 0 doctors', shifaDoctorReport.length === 0, true)

    // 11. Parallel Fetch (Sidebar Telemetry Aggregates)
    const apolloStats = await fetchSidebarAggregates(orgApolloId, branchApolloId)
    const krishnaStats = await fetchSidebarAggregates(orgKrishnaId, branchKrishnaId)
    const shifaStats = await fetchSidebarAggregates(orgShifaId, branchShifaId)

    assert('Tier 1: Parallel Fetch', 'Apollo stats: totalProducts > 0', apolloStats.inventory.totalProducts > 0, true)
    assert('Tier 1: Parallel Fetch', 'Apollo stats: activeCustomers > 0', apolloStats.clinical.activeCustomers > 0, true)
    assert('Tier 1: Parallel Fetch', 'Krishna stats: totalProducts > 0', krishnaStats.inventory.totalProducts > 0, true)
    assert('Tier 1: Parallel Fetch', 'Krishna stats: activeCustomers > 0', krishnaStats.clinical.activeCustomers > 0, true)
    assert('Tier 1: Parallel Fetch', 'Shifa stats: totalProducts is 0', shifaStats.inventory.totalProducts === 0, true)
    assert('Tier 1: Parallel Fetch', 'Shifa stats: todaySalesCount is 0', shifaStats.commerce.todaySalesCount === 0, true)
    assert('Tier 1: Parallel Fetch', 'Shifa stats: activeLedgersCount is 0', shifaStats.finance.activeLedgersCount === 0, true)
    assert('Tier 1: Parallel Fetch', 'Shifa stats: activeCustomers is 0', shifaStats.clinical.activeCustomers === 0, true)
    assert('Tier 1: Parallel Fetch', 'Shifa stats: expiredCount is 0', shifaStats.expiry.expiredCount === 0, true)

    // ─────────────────────────────────────────────────────────────
    // TIER 2: Boundary & Corner Cases (Adversarial Security)
    // ─────────────────────────────────────────────────────────────
    console.log('\n🛡️  [TIER 2] Testing Boundary Security & Corner Cases...')

    // 1. Alien branchId on Purchase Endpoints returning HTTP 403 Forbidden
    setAmbientTestUser(apolloActor)

    // Pipeline
    const pipelineReq = new NextRequest(`http://localhost:3000/api/purchases/pipeline?branchId=${branchKrishnaId}`)
    const pipelineRes = await pipelineGET(pipelineReq)
    assert('Tier 2: Alien Branch', 'GET /api/purchases/pipeline returns 403 Forbidden', pipelineRes.status === 403, true)

    // Requisitions
    const requisitionsReq = new NextRequest(`http://localhost:3000/api/purchases/requisitions?branchId=${branchKrishnaId}`)
    const requisitionsRes = await requisitionsGET(requisitionsReq)
    assert('Tier 2: Alien Branch', 'GET /api/purchases/requisitions returns 403 Forbidden', requisitionsRes.status === 403, true)

    // Quotations
    const quotationsReq = new NextRequest(`http://localhost:3000/api/purchases/quotations?branchId=${branchKrishnaId}`)
    const quotationsRes = await quotationsGET(quotationsReq)
    assert('Tier 2: Alien Branch', 'GET /api/purchases/quotations returns 403 Forbidden', quotationsRes.status === 403, true)

    // Suggestions
    const suggestionsReq = new NextRequest(`http://localhost:3000/api/purchases/requisitions/suggestions?branchId=${branchKrishnaId}`)
    const suggestionsRes = await suggestionsGET(suggestionsReq)
    assert('Tier 2: Alien Branch', 'GET /api/purchases/requisitions/suggestions returns 403 Forbidden', suggestionsRes.status === 403, true)

    // Agency
    const agencyReq = new NextRequest(`http://localhost:3000/api/purchases/agency?branchId=${branchKrishnaId}`)
    const agencyRes = await agencyGET(agencyReq)
    assert('Tier 2: Alien Branch', 'GET /api/purchases/agency returns 403 Forbidden', agencyRes.status === 403, true)

    // 2. PO Branch Mismatch Rejection
    let poMismatchRejected = false
    let poErrorMessage = ''
    try {
      await createPurchase(
        {
          branchId: branchKrishnaId, // Cross-tenant alien branch!
          supplierId: apolloSupplier.id,
          status: 'DRAFT',
          items: [
            {
              productId: apolloProduct.id,
              orderedQuantity: 10,
              unitCost: 25,
            },
          ],
        },
        apolloActor
      )
    } catch (err: any) {
      poMismatchRejected = true
      poErrorMessage = err.message
    }
    assert('Tier 2: PO Mismatch', 'createPurchase rejects alien branchId with Forbidden', poMismatchRejected && poErrorMessage.includes('Forbidden'), true)

    // 3. assertBranchBelongsToOrg & assertBranchAccess directly
    let assertBelongsRejected = false
    try {
      await assertBranchBelongsToOrg(branchKrishnaId, orgApolloId)
    } catch (err: any) {
      assertBelongsRejected = true
    }
    assert('Tier 2: Tenant Context', 'assertBranchBelongsToOrg throws on cross-tenant branch', assertBelongsRejected, true)

    let assertBranchAccessRejected = false
    try {
      await assertBranchAccess(apolloActor, branchKrishnaId)
    } catch (err: any) {
      assertBranchAccessRejected = true
    }
    assert('Tier 2: Branch Access', 'assertBranchAccess throws on foreign branch', assertBranchAccessRejected, true)

    // 4. Unassociated User with Missing organizationId
    setAmbientTestUser(unassociatedActor)

    const unassociatedCustomers = await listCustomers({} as any)
    assert('Tier 2: Unassociated User', 'listCustomers returns 0 for user with missing organizationId', unassociatedCustomers.data.length === 0, true)

    const unassociatedSuppliers = await listSuppliers({}, unassociatedActor)
    assert('Tier 2: Unassociated User', 'listSuppliers returns 0 for user with missing organizationId', unassociatedSuppliers.data.length === 0, true)

    const unassociatedReceivables = await listReceivables({}, unassociatedActor)
    assert('Tier 2: Unassociated User', 'listReceivables returns 0 for user with missing organizationId', unassociatedReceivables.data.length === 0, true)

    const unassociatedPayables = await listPayables({}, unassociatedActor)
    assert('Tier 2: Unassociated User', 'listPayables returns 0 for user with missing organizationId', unassociatedPayables.data.length === 0, true)

    const unassociatedProdsRes = await productsGET(new NextRequest('http://localhost:3000/api/products'))
    const unassociatedProds = await unassociatedProdsRes.json()
    assert('Tier 2: Unassociated User', 'GET /api/products returns 0 for user with missing organizationId', unassociatedProds.data.length === 0, true)

    const unassociatedDocsRes = await doctorsGET(new NextRequest('http://localhost:3000/api/doctors'))
    const unassociatedDocs = await unassociatedDocsRes.json()
    assert('Tier 2: Unassociated User', 'GET /api/doctors returns 0 for user with missing organizationId', unassociatedDocs.data.length === 0, true)

    // ─────────────────────────────────────────────────────────────
    // TIER 3: Cross-Feature Interactions (Concurrency & Hybrid Lookups)
    // ─────────────────────────────────────────────────────────────
    console.log('\n⚡ [TIER 3] Testing Cross-Feature Interactions & Parallel Execution...')

    const [
      cPrefetchA,
      cPrefetchB,
      cPrefetchC,
      cPosSearchA,
      cPosSearchB,
      cPosSearchC,
      cWorkerA,
    ] = await Promise.all([
      fetchSidebarAggregates(orgApolloId, branchApolloId),
      fetchSidebarAggregates(orgKrishnaId, branchKrishnaId),
      fetchSidebarAggregates(orgShifaId, branchShifaId),
      searchPosProducts('Apollo', branchApolloId, 50, orgApolloId),
      searchPosProducts('Krishna', branchKrishnaId, 50, orgKrishnaId),
      searchPosProducts('', branchShifaId, 50, orgShifaId),
      getDbWorkerPool().executeParallelFetch(orgApolloId, branchApolloId),
    ])

    assert('Tier 3: Concurrent Search', 'POS Search Tenant A finds Apollo product', cPosSearchA.some((p) => p.sku === apolloProdSku), true)
    assert('Tier 3: Concurrent Search', 'POS Search Tenant A isolates from Krishna product', cPosSearchA.some((p) => p.sku === krishnaProdSku), false)
    assert('Tier 3: Concurrent Search', 'POS Search Tenant B finds Krishna product', cPosSearchB.some((p) => p.sku === krishnaProdSku), true)
    assert('Tier 3: Concurrent Search', 'POS Search Tenant B isolates from Apollo product', cPosSearchB.some((p) => p.sku === apolloProdSku), false)
    assert('Tier 3: Concurrent Search', 'POS Search Tenant C returns exactly 0 products', cPosSearchC.length === 0, true)
    assert('Tier 3: Concurrent Worker', 'Concurrent parallel worker A executed successfully', cWorkerA.allSuccessful, true)
    assert('Tier 3: Concurrent Telemetry', 'Concurrent Shifa prefetch returns clean 0 total products', cPrefetchC.inventory.totalProducts === 0, true)

    // ─────────────────────────────────────────────────────────────
    // TIER 4: Real-World Scenarios (Full Onboarding & Platform Guard)
    // ─────────────────────────────────────────────────────────────
    console.log('\n🌍 [TIER 4] Testing Real-World Scenarios & Super-Admin Guard...')

    // 1. Newly onboarded chemist state across all domain views
    const [
      shifaFinalProds,
      shifaFinalInv,
      shifaFinalBatches,
      shifaFinalSales,
      shifaFinalPurch,
      shifaFinalCust,
      shifaFinalSupp,
      shifaFinalDocs,
      shifaFinalVouchers,
    ] = await Promise.all([
      prisma.product.count({ where: { organizationId: orgShifaId } }),
      prisma.inventory.count({ where: { branchId: branchShifaId } }),
      prisma.batch.count({ where: { branchId: branchShifaId } }),
      prisma.sale.count({ where: { branchId: branchShifaId } }),
      prisma.purchase.count({ where: { branchId: branchShifaId } }),
      prisma.customer.count({ where: { organizationId: orgShifaId } }),
      prisma.supplier.count({ where: { organizationId: orgShifaId } }),
      prisma.doctor.count({ where: { organizationId: orgShifaId } }),
      prisma.voucher.count({ where: { branchId: branchShifaId } }),
    ])

    assert('Tier 4: Onboarded Chemist', 'Shifa final products count is 0', shifaFinalProds === 0, true)
    assert('Tier 4: Onboarded Chemist', 'Shifa final inventory count is 0', shifaFinalInv === 0, true)
    assert('Tier 4: Onboarded Chemist', 'Shifa final batches count is 0', shifaFinalBatches === 0, true)
    assert('Tier 4: Onboarded Chemist', 'Shifa final sales count is 0', shifaFinalSales === 0, true)
    assert('Tier 4: Onboarded Chemist', 'Shifa final purchases count is 0', shifaFinalPurch === 0, true)
    assert('Tier 4: Onboarded Chemist', 'Shifa final customers count is 0', shifaFinalCust === 0, true)
    assert('Tier 4: Onboarded Chemist', 'Shifa final suppliers count is 0', shifaFinalSupp === 0, true)
    assert('Tier 4: Onboarded Chemist', 'Shifa final doctors count is 0', shifaFinalDocs === 0, true)
    assert('Tier 4: Onboarded Chemist', 'Shifa final vouchers count is 0', shifaFinalVouchers === 0, true)

    // Confirm Tenant A and Tenant B data was never touched during onboarding
    const apolloIntactCount = await prisma.product.count({ where: { organizationId: orgApolloId } })
    const krishnaIntactCount = await prisma.product.count({ where: { organizationId: orgKrishnaId } })
    assert('Tier 4: Existing Tenants Intact', 'Apollo data intact post-onboarding', apolloIntactCount > 0, true)
    assert('Tier 4: Existing Tenants Intact', 'Krishna data intact post-onboarding', krishnaIntactCount > 0, true)

    // 2. Super-Admin vs Non-Superadmin Platform Route Security
    setAmbientTestUser(apolloActor)
    const platformNonAdminRes = await platformAnalyticsGET()
    assert('Tier 4: Platform Security', 'Non-superadmin blocked from /api/platform/analytics with 403', platformNonAdminRes.status === 403, true)

    setAmbientTestUser(superAdminActor)
    const platformAdminRes = await platformAnalyticsGET()
    const platformData = await platformAdminRes.json()
    assert('Tier 4: Platform Security', 'Super-Admin accesses /api/platform/analytics with 200', platformAdminRes.status === 200, true)
    assert('Tier 4: Platform Security', 'Platform analytics returns global overview', platformData.success === true && platformData.data?.platformSummary !== undefined, true)

  } finally {
    // ─────────────────────────────────────────────────────────────
    // Deterministic Database & Worker Cleanup
    // ─────────────────────────────────────────────────────────────
    console.log('\n🧹 [CLEANUP] Cleaning up temporary test records & disconnecting resources...')

    try {
      if (cleanupSaleIds.length > 0) {
        await prisma.saleItem.deleteMany({ where: { saleId: { in: cleanupSaleIds } } })
        await prisma.sale.deleteMany({ where: { id: { in: cleanupSaleIds } } })
      }
      if (cleanupPurchaseIds.length > 0) {
        await prisma.purchaseItem.deleteMany({ where: { purchaseId: { in: cleanupPurchaseIds } } })
        await prisma.purchase.deleteMany({ where: { id: { in: cleanupPurchaseIds } } })
      }
      if (cleanupProductIds.length > 0) {
        await prisma.batch.deleteMany({ where: { productId: { in: cleanupProductIds } } })
        await prisma.inventory.deleteMany({ where: { productId: { in: cleanupProductIds } } })
        await prisma.product.deleteMany({ where: { id: { in: cleanupProductIds } } })
      }
      if (cleanupCustomerIds.length > 0) {
        await prisma.customer.deleteMany({ where: { id: { in: cleanupCustomerIds } } })
      }
      if (cleanupSupplierIds.length > 0) {
        await prisma.supplier.deleteMany({ where: { id: { in: cleanupSupplierIds } } })
      }
      if (cleanupDoctorIds.length > 0) {
        await prisma.doctor.deleteMany({ where: { id: { in: cleanupDoctorIds } } })
      }
      if (cleanupUserIds.length > 0) {
        await prisma.userRole.deleteMany({ where: { userId: { in: cleanupUserIds } } })
        await prisma.auditLog.deleteMany({ where: { userId: { in: cleanupUserIds } } })
        await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } })
      }
      for (const orgId of cleanupOrgIds) {
        if (orgId !== 'org-apollo-pharma') {
          await prisma.organizationSetting.deleteMany({ where: { organizationId: orgId } })
          await prisma.rack.deleteMany({ where: { branch: { organizationId: orgId } } })
          await prisma.branch.deleteMany({ where: { organizationId: orgId } })
          await prisma.auditLog.deleteMany({ where: { entityId: orgId } })
          await prisma.organization.deleteMany({ where: { id: orgId } })
        }
      }
      console.log('  ✓ Database cleanups complete.')
    } catch (cleanErr) {
      console.error('  ⚠️  Non-fatal error during cleanup:', cleanErr)
    }

    setAmbientTestUser(null)
    await getDbWorkerPool().terminate().catch(() => {})
    await prisma.$disconnect()
  }

  // Final Summary & Exit
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  console.log('\n=========================================================================')
  console.log(`🏁 MILESTONE 5 VERIFICATION AUDIT RESULT: ${passed}/${results.length} PASSED (${failed} FAILED)`)
  console.log('=========================================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
  process.exit(0)
}

runMultiTenantVerification().catch((err) => {
  console.error('Fatal execution error:', err)
  process.exit(1)
})
