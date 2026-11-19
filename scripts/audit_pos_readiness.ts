import prisma from '../src/lib/db/prisma'
import { getPosSettings } from '../src/lib/settings/settings-service'

async function auditPos() {
  console.log('====================================================')
  console.log('🔍 HIGH-SPEED DISPENSARY POS AUDIT')
  console.log('====================================================')

  // 1. Settings & Configurations Provisioned in DB
  console.log('\n--- 1. System & Organization Settings in DB ---')
  const [sysSettings, orgSettings, posSettings] = await Promise.all([
    prisma.systemSetting.findMany({ where: { category: { in: ['pos', 'inventory', 'general'] } } }),
    prisma.organizationSetting.findMany(),
    getPosSettings().catch(e => ({ error: e.message })),
  ])
  console.log(`System Settings in DB: ${sysSettings.length} keys`)
  sysSettings.forEach(s => console.log(`  - [${s.category}] ${s.key} = "${s.value}" (${s.dataType})`))
  console.log(`Resolved POS Typed Settings:`, posSettings)

  // 2. Products, Barcodes & Batches for POS
  console.log('\n--- 2. Product Catalog & Barcode Readiness ---')
  const [totalProducts, activeProducts, productsWithBarcode, productsWithRack, productsWithTabsPerStrip] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({ where: { OR: [{ barcode: { not: null } }, { barcodes: { some: {} } }] } }),
    prisma.product.count({ where: { rackId: { not: null } } }),
    prisma.product.count({ where: { tabsPerStrip: { not: null, gt: 0 } } }),
  ])
  console.log(`Total Products: ${totalProducts}`)
  console.log(`Active Products: ${activeProducts}`)
  console.log(`Products with Barcode: ${productsWithBarcode}`)
  console.log(`Products with Rack/Shelf: ${productsWithRack}`)
  console.log(`Products with tabsPerStrip (Loose Tablet Billing): ${productsWithTabsPerStrip}`)

  // 3. Batches & FEFO Availability
  console.log('\n--- 3. Batches & FEFO Availability ---')
  const [totalBatches, activeBatches, expiringIn30d, outOfStockBatches] = await Promise.all([
    prisma.batch.count(),
    prisma.batch.count({ where: { status: 'ACTIVE', quantity: { gt: 0 } } }),
    prisma.batch.count({ where: { status: 'ACTIVE', quantity: { gt: 0 }, expiryDate: { lte: new Date(Date.now() + 30 * 86400000) } } }),
    prisma.batch.count({ where: { quantity: { lte: 0 } } }),
  ])
  console.log(`Total Batches: ${totalBatches}`)
  console.log(`Active Batches with Stock: ${activeBatches}`)
  console.log(`Batches Expiring in <=30 days: ${expiringIn30d}`)
  console.log(`Zero Stock Batches: ${outOfStockBatches}`)

  // 4. Held Bills (Park / Retrieve Bill)
  console.log('\n--- 4. Held Bills (Park / Retrieve) ---')
  const heldBillsCount = await prisma.heldBill.count()
  console.log(`Held Bills in DB: ${heldBillsCount}`)

  // 5. Prescriptions & Doctors Tagging
  console.log('\n--- 5. Doctors & Regulatory Prescriptions ---')
  const [doctorsCount, prescriptionsCount] = await Promise.all([
    prisma.doctor.count(),
    prisma.prescription.count(),
  ])
  console.log(`Doctors in DB: ${doctorsCount}`)
  console.log(`Prescriptions in DB: ${prescriptionsCount}`)

  // 6. Customers & Khata (Udhaar)
  console.log('\n--- 6. Customer Khata & Credit Sales ---')
  const [customersCount, creditCustomersCount] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { outstandingBalance: { gt: 0 } } }),
  ])
  console.log(`Total Customers: ${customersCount}`)
  console.log(`Customers with Outstanding Khata: ${creditCustomersCount}`)

  // 7. Recent Sales & Invoices
  console.log('\n--- 7. Sales & Billing Records ---')
  const [salesCount, todaySalesCount] = await Promise.all([
    prisma.sale.count(),
    prisma.sale.count({ where: { saleDate: { gte: new Date(new Date().setHours(0,0,0,0)) } } }),
  ])
  console.log(`Lifetime Invoices: ${salesCount}`)
  console.log(`Today's Invoices: ${todaySalesCount}`)

  console.log('\n====================================================')
  console.log('✅ AUDIT COMPLETE')
  console.log('====================================================')
}

auditPos().catch(console.error).finally(() => prisma.$disconnect())

