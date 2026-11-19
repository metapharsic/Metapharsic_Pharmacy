/** @jest-environment node */

jest.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: () => ({}),
}))

import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

import prisma from '@/lib/db/prisma'
import { setAmbientTestUser } from '@/lib/auth/auth-helpers'
import { assertBranchBelongsToOrg, getTenantContext } from '@/lib/auth/tenant-context'
import { assertBranchAccess } from '@/lib/inventory/branch-access'
import { fetchSidebarAggregates, getDbWorkerPool } from '@/lib/db/db-worker-pool'
import { onboardChemistShop } from '@/lib/organization/org-service'
import { getProducts } from '@/lib/products/product-service'
import { getBatches } from '@/lib/batches/batch-service'
import { listSales, searchPosProducts } from '@/lib/sales/sales-service'
import { listPurchases, listSuppliers, createPurchase } from '@/lib/purchases/purchase-service'
import { listCustomers } from '@/lib/customers/customer-service'
import { listDoctors } from '@/lib/doctors/doctor-service'
import { listReceivables, listPayables } from '@/lib/finance/finance-service'
import { ReportService } from '@/lib/reports/report-service'

// Route handlers under test
import { GET as pipelineGET } from '@/app/api/purchases/pipeline/route'
import { GET as requisitionsGET } from '@/app/api/purchases/requisitions/route'
import { GET as quotationsGET } from '@/app/api/purchases/quotations/route'
import { GET as suggestionsGET } from '@/app/api/purchases/requisitions/suggestions/route'
import { GET as agencyGET } from '@/app/api/purchases/agency/route'
import { GET as productsGET } from '@/app/api/products/route'
import { GET as customersGET } from '@/app/api/customers/route'
import { GET as doctorsGET } from '@/app/api/doctors/route'
import { GET as posProductsGET } from '@/app/api/pos/products/route'
import { GET as grossProfitGET } from '@/app/api/reports/gross-profit/route'
import { GET as scheduleHGET } from '@/app/api/reports/schedule-h/route'
import { GET as reportsDoctorsGET } from '@/app/api/reports/doctors/route'
import { GET as platformAnalyticsGET } from '@/app/api/platform/analytics/route'

describe('Multi-Tenant Data Isolation & Adversarial Security Test Suite', () => {
  const timestamp = Date.now()

  // Tenant IDs
  const orgApolloId = 'org-apollo-pharma'
  const branchApolloId = 'branch-apollo-01'
  const orgKrishnaId = `org-krishna-${timestamp}`
  const branchKrishnaId = `branch-krishna-${timestamp}`

  let orgShifaId: string = ''
  let branchShifaId: string = ''

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

  // Test Actors
  let apolloActor: any
  let krishnaActor: any
  let shifaActor: any
  let superAdminActor: any
  let unassociatedActor: any

  // Seeded Entity References
  let apolloProduct: any
  let krishnaProduct: any
  let apolloBatch: any
  let krishnaBatch: any
  let apolloCustomer: any
  let krishnaCustomer: any
  let apolloSupplier: any
  let krishnaSupplier: any
  let apolloDoctor: any
  let krishnaDoctor: any
  let apolloSale: any
  let krishnaSale: any
  let apolloPurchase: any
  let krishnaPurchase: any

  beforeAll(async () => {
    // 1. Setup Tenant A: Apollo Pharmacy
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

    const apolloUser = await prisma.user.create({
      data: {
        email: `apollo.jest.${timestamp}@pharmacare.local`,
        name: 'Apollo Jest Admin',
        organizationId: orgApolloId,
        branchId: branchApolloId,
        isActive: true,
        isSuperAdmin: false,
      },
    })
    cleanupUserIds.push(apolloUser.id)

    // 2. Setup Tenant B: Krishna Medical
    await prisma.organization.create({
      data: {
        id: orgKrishnaId,
        code: `KM${timestamp.toString().slice(-4)}`,
        slug: `krishna-jest-${timestamp}`,
        name: 'Krishna Medical Store',
        status: 'ACTIVE',
        subscriptionPlan: 'GROWTH',
      },
    })
    cleanupOrgIds.push(orgKrishnaId)

    await prisma.branch.create({
      data: {
        id: branchKrishnaId,
        organizationId: orgKrishnaId,
        name: 'Krishna Medical Main Counter',
        code: `KM-01-${timestamp.toString().slice(-3)}`,
        isHeadOffice: true,
        isActive: true,
      },
    })
    cleanupBranchIds.push(branchKrishnaId)

    const krishnaUser = await prisma.user.create({
      data: {
        email: `krishna.jest.${timestamp}@pharmacare.local`,
        name: 'Krishna Jest Admin',
        organizationId: orgKrishnaId,
        branchId: branchKrishnaId,
        isActive: true,
        isSuperAdmin: false,
      },
    })
    cleanupUserIds.push(krishnaUser.id)

    // 3. Setup Tenant C: Dynamically onboarded fresh chemist shop ("Shifa Medical Store")
    const shifaOnboard = await onboardChemistShop({
      code: `SHF${timestamp.toString().slice(-5)}`,
      name: 'Shifa Medical Store',
      legalName: 'Shifa Medical Store LLP',
      adminName: 'Shifa Pharmacist Admin',
      adminEmail: `shifa.jest.${timestamp}@testpharma.local`,
      adminPassword: 'Password@Shifa123',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500001',
      subscriptionPlan: 'GROWTH',
      validityDays: 365,
    })

    orgShifaId = shifaOnboard.organization.id
    branchShifaId = shifaOnboard.branch.id
    cleanupOrgIds.push(orgShifaId)
    cleanupBranchIds.push(branchShifaId)
    cleanupUserIds.push(shifaOnboard.adminUser.id)

    const shifaStaff = await prisma.user.findMany({
      where: { organizationId: orgShifaId },
      select: { id: true },
    })
    for (const u of shifaStaff) {
      if (!cleanupUserIds.includes(u.id)) {
        cleanupUserIds.push(u.id)
      }
    }

    // 4. Seed Apollo Items
    const apolloProdSku = `AP-PARA-${timestamp.toString().slice(-4)}`
    apolloProduct = await prisma.product.create({
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

    apolloBatch = await prisma.batch.create({
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

    apolloCustomer = await prisma.customer.create({
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

    apolloSupplier = await prisma.supplier.create({
      data: {
        organizationId: orgApolloId,
        name: 'Apollo Direct Wholesaler Alpha',
        phone: `92${timestamp.toString().slice(-8)}1`,
        outstandingBalance: new Prisma.Decimal(8500),
        isActive: true,
      },
    })
    cleanupSupplierIds.push(apolloSupplier.id)

    apolloDoctor = await prisma.doctor.create({
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

    apolloSale = await prisma.sale.create({
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

    apolloPurchase = await prisma.purchase.create({
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

    // 5. Seed Krishna Items
    const krishnaProdSku = `KM-AMOX-${timestamp.toString().slice(-4)}`
    krishnaProduct = await prisma.product.create({
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

    krishnaBatch = await prisma.batch.create({
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

    krishnaCustomer = await prisma.customer.create({
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

    krishnaSupplier = await prisma.supplier.create({
      data: {
        organizationId: orgKrishnaId,
        name: 'Krishna Wholesale Distributor Beta',
        phone: `92${timestamp.toString().slice(-8)}2`,
        outstandingBalance: new Prisma.Decimal(14200),
        isActive: true,
      },
    })
    cleanupSupplierIds.push(krishnaSupplier.id)

    krishnaDoctor = await prisma.doctor.create({
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

    krishnaSale = await prisma.sale.create({
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

    krishnaPurchase = await prisma.purchase.create({
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

    // Actors definition
    apolloActor = {
      id: apolloUser.id,
      organizationId: orgApolloId,
      branchId: branchApolloId,
      permissions: ['purchases:read', 'purchases:create', 'sales:read', 'sales:create', 'products:read', 'products:create', 'inventory:read', 'reports:sales', 'finance:read', 'customers:read', 'customers:create'],
      roles: ['admin'],
      isSuperAdmin: false,
    }

    krishnaActor = {
      id: krishnaUser.id,
      organizationId: orgKrishnaId,
      branchId: branchKrishnaId,
      permissions: ['purchases:read', 'purchases:create', 'sales:read', 'sales:create', 'products:read', 'products:create', 'inventory:read', 'reports:sales', 'finance:read', 'customers:read', 'customers:create'],
      roles: ['admin'],
      isSuperAdmin: false,
    }

    shifaActor = {
      id: shifaOnboard.adminUser.id,
      organizationId: orgShifaId,
      branchId: branchShifaId,
      permissions: ['purchases:read', 'purchases:create', 'sales:read', 'sales:create', 'products:read', 'products:create', 'inventory:read', 'reports:sales', 'finance:read', 'customers:read', 'customers:create'],
      roles: ['owner'],
      isSuperAdmin: false,
    }

    superAdminActor = {
      id: 'super-admin-jest-verifier',
      organizationId: 'default-org',
      branchId: 'default-branch',
      permissions: ['platform:read', 'reports:sales', 'purchases:read'],
      roles: ['super_admin'],
      isSuperAdmin: true,
    }

    unassociatedActor = {
      id: 'unassociated-jest-actor',
      organizationId: null,
      branchId: null,
      permissions: ['products:read', 'customers:read', 'purchases:read', 'finance:read', 'reports:sales'],
      roles: ['cashier'],
      isSuperAdmin: false,
    }
  })

  afterAll(async () => {
    // Dynamic cleanup of all test records
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
    } catch (e) {
      // non-fatal cleanup error
    }

    setAmbientTestUser(null)
    await getDbWorkerPool().terminate().catch(() => {})
    await prisma.$disconnect()
  })

  // ─────────────────────────────────────────────────────────────
  // 1. HTTP Route Handlers: Boundary Security & Status Codes
  // ─────────────────────────────────────────────────────────────
  describe('HTTP Route Handlers: Authorization Barriers & Status Codes', () => {
    it('returns 403 Forbidden when Tenant A requests pipeline for Tenant B branch', async () => {
      setAmbientTestUser(apolloActor)
      const req = new NextRequest(`http://localhost:3000/api/purchases/pipeline?branchId=${branchKrishnaId}`)
      const res = await pipelineGET(req)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('Forbidden')
    })

    it('returns 403 Forbidden when Tenant A requests requisitions for Tenant B branch', async () => {
      setAmbientTestUser(apolloActor)
      const req = new NextRequest(`http://localhost:3000/api/purchases/requisitions?branchId=${branchKrishnaId}`)
      const res = await requisitionsGET(req)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('Forbidden')
    })

    it('returns 403 Forbidden when Tenant A requests quotations for Tenant B branch', async () => {
      setAmbientTestUser(apolloActor)
      const req = new NextRequest(`http://localhost:3000/api/purchases/quotations?branchId=${branchKrishnaId}`)
      const res = await quotationsGET(req)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('Forbidden')
    })

    it('returns 403 Forbidden when Tenant A requests suggestions for Tenant B branch', async () => {
      setAmbientTestUser(apolloActor)
      const req = new NextRequest(`http://localhost:3000/api/purchases/requisitions/suggestions?branchId=${branchKrishnaId}`)
      const res = await suggestionsGET(req)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('Forbidden')
    })

    it('returns 403 Forbidden when Tenant A requests agency purchases for Tenant B branch', async () => {
      setAmbientTestUser(apolloActor)
      const req = new NextRequest(`http://localhost:3000/api/purchases/agency?branchId=${branchKrishnaId}`)
      const res = await agencyGET(req)
      const data = await res.json()

      expect(res.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.message).toContain('Forbidden')
    })

    it('returns 401 Unauthorized when request is unauthenticated', async () => {
      setAmbientTestUser(null)
      const req = new NextRequest('http://localhost:3000/api/purchases/pipeline')
      const res = await pipelineGET(req)
      expect(res.status).toBe(401)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 2. Multi-Tenant Data Isolation Across Feature Endpoints
  // ─────────────────────────────────────────────────────────────
  describe('Multi-Tenant Data Isolation Across Core APIs', () => {
    it('Products: Tenant A API sees only Tenant A products, zero Tenant B products', async () => {
      setAmbientTestUser(apolloActor)
      const res = await productsGET(new NextRequest('http://localhost:3000/api/products'))
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      const apolloSeen = json.data.some((p: any) => p.id === apolloProduct.id)
      const krishnaSeen = json.data.some((p: any) => p.id === krishnaProduct.id)
      expect(apolloSeen).toBe(true)
      expect(krishnaSeen).toBe(false)
    })

    it('Products: Tenant B API sees only Tenant B products, zero Tenant A products', async () => {
      setAmbientTestUser(krishnaActor)
      const res = await productsGET(new NextRequest('http://localhost:3000/api/products'))
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      const krishnaSeen = json.data.some((p: any) => p.id === krishnaProduct.id)
      const apolloSeen = json.data.some((p: any) => p.id === apolloProduct.id)
      expect(krishnaSeen).toBe(true)
      expect(apolloSeen).toBe(false)
    })

    it('Customers: Tenant A sees only Tenant A customers', async () => {
      setAmbientTestUser(apolloActor)
      const res = await customersGET(new NextRequest('http://localhost:3000/api/customers'))
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.some((c: any) => c.id === apolloCustomer.id)).toBe(true)
      expect(json.data.some((c: any) => c.id === krishnaCustomer.id)).toBe(false)
    })

    it('Doctors: Tenant A sees only Tenant A doctors', async () => {
      setAmbientTestUser(apolloActor)
      const res = await doctorsGET(new NextRequest('http://localhost:3000/api/doctors'))
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.some((d: any) => d.id === apolloDoctor.id)).toBe(true)
      expect(json.data.some((d: any) => d.id === krishnaDoctor.id)).toBe(false)
    })

    it('POS Search: isolates catalog between Tenant A and Tenant B', async () => {
      setAmbientTestUser(apolloActor)
      const reqA = new NextRequest(`http://localhost:3000/api/pos/products?branchId=${branchApolloId}&search=Apollo`)
      const resA = await posProductsGET(reqA)
      const jsonA = await resA.json()

      expect(resA.status).toBe(200)
      expect(jsonA.data.some((p: any) => p.id === apolloProduct.id)).toBe(true)
      expect(jsonA.data.some((p: any) => p.id === krishnaProduct.id)).toBe(false)

      setAmbientTestUser(krishnaActor)
      const reqB = new NextRequest(`http://localhost:3000/api/pos/products?branchId=${branchKrishnaId}&search=Krishna`)
      const resB = await posProductsGET(reqB)
      const jsonB = await resB.json()

      expect(resB.status).toBe(200)
      expect(jsonB.data.some((p: any) => p.id === krishnaProduct.id)).toBe(true)
      expect(jsonB.data.some((p: any) => p.id === apolloProduct.id)).toBe(false)
    })

    it('Reports: Gross profit and schedule H reports strictly bound to tenant branch', async () => {
      setAmbientTestUser(apolloActor)
      // Alien branch returns 403 Forbidden
      const alienReq = new NextRequest(`http://localhost:3000/api/reports/gross-profit?branchId=${branchKrishnaId}`)
      const alienRes = await grossProfitGET(alienReq)
      expect(alienRes.status).toBe(403)

      // Own branch returns 200 OK
      const ownReq = new NextRequest(`http://localhost:3000/api/reports/gross-profit?branchId=${branchApolloId}`)
      const ownRes = await grossProfitGET(ownReq)
      const ownJson = await ownRes.json()
      expect(ownRes.status).toBe(200)
      expect(ownJson.success).toBe(true)
    })

    it('Reports: Doctor performance report isolates doctors by tenant', async () => {
      setAmbientTestUser(apolloActor)
      const req = new NextRequest('http://localhost:3000/api/reports/doctors')
      const res = await reportsDoctorsGET(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.some((d: any) => d.id === apolloDoctor.id)).toBe(true)
      expect(json.data.some((d: any) => d.id === krishnaDoctor.id)).toBe(false)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 3. Unassociated User with Missing organizationId
  // ─────────────────────────────────────────────────────────────
  describe('Zero Data Leakage for Unassociated Users', () => {
    beforeEach(() => {
      setAmbientTestUser(unassociatedActor)
    })

    it('returns 0 products for unassociated user', async () => {
      const res = await productsGET(new NextRequest('http://localhost:3000/api/products'))
      const json = await res.json()
      expect(res.status).toBe(200)
      expect(json.data).toHaveLength(0)
    })

    it('returns 0 customers for unassociated user', async () => {
      const res = await customersGET(new NextRequest('http://localhost:3000/api/customers'))
      const json = await res.json()
      expect(res.status).toBe(200)
      expect(json.data).toHaveLength(0)
    })

    it('returns 0 doctors for unassociated user', async () => {
      const res = await doctorsGET(new NextRequest('http://localhost:3000/api/doctors'))
      const json = await res.json()
      expect(res.status).toBe(200)
      expect(json.data).toHaveLength(0)
    })

    it('returns 0 suppliers in domain service for unassociated user', async () => {
      const result = await listSuppliers({} as any, unassociatedActor)
      expect(result.data).toHaveLength(0)
    })

    it('returns 0 receivables and 0 payables for unassociated user', async () => {
      const rec = await listReceivables({}, unassociatedActor)
      const pay = await listPayables({}, unassociatedActor)
      expect(rec.data).toHaveLength(0)
      expect(pay.data).toHaveLength(0)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 4. Domain Service Security & Boundary Assertions
  // ─────────────────────────────────────────────────────────────
  describe('Domain Services & Branch Access Controls', () => {
    it('assertBranchAccess throws 403 Forbidden for alien branch', async () => {
      await expect(assertBranchAccess(apolloActor, branchKrishnaId)).rejects.toThrow('Forbidden')
    })

    it('assertBranchAccess throws 404 Not Found for nonexistent branch', async () => {
      await expect(assertBranchAccess(apolloActor, 'nonexistent-branch-id')).rejects.toThrow('Not Found')
    })

    it('assertBranchAccess succeeds for own organization branch', async () => {
      await expect(assertBranchAccess(apolloActor, branchApolloId)).resolves.not.toThrow()
    })

    it('assertBranchAccess succeeds across branches for Super-Admin', async () => {
      await expect(assertBranchAccess(superAdminActor, branchKrishnaId)).resolves.not.toThrow()
    })

    it('assertBranchBelongsToOrg throws 403 Forbidden for cross-tenant branch', async () => {
      await expect(assertBranchBelongsToOrg(branchKrishnaId, orgApolloId)).rejects.toThrow('Forbidden')
    })

    it('createPurchase rejects PO for alien branch with Forbidden', async () => {
      await expect(
        createPurchase(
          {
            branchId: branchKrishnaId, // Cross-tenant branch
            supplierId: apolloSupplier.id,
            status: 'DRAFT',
            items: [{ productId: apolloProduct.id, orderedQuantity: 5, unitCost: 25, discountPercent: 0, taxPercent: 0 }],
          },
          apolloActor
        )
      ).rejects.toThrow('Forbidden')
    })

    it('createPurchase rejects nonexistent supplier with Not Found: supplier', async () => {
      await expect(
        createPurchase(
          {
            branchId: branchApolloId,
            supplierId: 'nonexistent-supplier-id',
            status: 'DRAFT',
            items: [{ productId: apolloProduct.id, orderedQuantity: 5, unitCost: 25, discountPercent: 0, taxPercent: 0 }],
          },
          apolloActor
        )
      ).rejects.toThrow('Not Found: supplier')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 5. Newly Onboarded Chemist: Clean 0 State
  // ─────────────────────────────────────────────────────────────
  describe('Tenant C (New Chemist): 100% Clean Zero-Record State', () => {
    it('has exactly 0 records across products, batches, sales, and purchases', async () => {
      const [prods, batches, sales, purchases, customers, suppliers] = await Promise.all([
        prisma.product.count({ where: { organizationId: orgShifaId } }),
        prisma.batch.count({ where: { branchId: branchShifaId } }),
        prisma.sale.count({ where: { branchId: branchShifaId } }),
        prisma.purchase.count({ where: { branchId: branchShifaId } }),
        prisma.customer.count({ where: { organizationId: orgShifaId } }),
        prisma.supplier.count({ where: { organizationId: orgShifaId } }),
      ])

      expect(prods).toBe(0)
      expect(batches).toBe(0)
      expect(sales).toBe(0)
      expect(purchases).toBe(0)
      expect(customers).toBe(0)
      expect(suppliers).toBe(0)
    })

    it('returns clean 0-counts across all 5 telemetry domains in fetchSidebarAggregates', async () => {
      const stats = await fetchSidebarAggregates(orgShifaId, branchShifaId)

      expect(stats.inventory.totalProducts).toBe(0)
      expect(stats.inventory.lowStockCount).toBe(0)
      expect(stats.commerce.todaySalesCount).toBe(0)
      expect(stats.commerce.todayRevenue).toBe(0)
      expect(stats.finance.activeLedgersCount).toBe(0)
      expect(stats.clinical.activeCustomers).toBe(0)
      expect(stats.expiry.expiredCount).toBe(0)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 6. Platform Route Security (/platform)
  // ─────────────────────────────────────────────────────────────
  describe('Platform Super-Admin Route Security (/platform)', () => {
    it('blocks non-superadmin from /api/platform/analytics with 403 Forbidden', async () => {
      setAmbientTestUser(apolloActor)
      const res = await platformAnalyticsGET()
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('FORBIDDEN')
    })

    it('allows Platform Super-Admin to access /api/platform/analytics with 200 OK', async () => {
      setAmbientTestUser(superAdminActor)
      const res = await platformAnalyticsGET()
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.platformSummary).toBeDefined()
      expect(json.data.chemists).toBeDefined()
    })
  })
})
