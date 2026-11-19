import { PrismaClient } from '@prisma/client'
import Decimal from 'decimal.js'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
    ? (process.env.DATABASE_URL.includes('connection_limit=')
        ? process.env.DATABASE_URL
        : process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'connection_limit=5&pool_timeout=15')
    : undefined,
})

async function main() {
  console.log('Seeding rich transactional history (Purchases, Sales, Profit) for Apollo and Krishna chemist shops...')

  const apolloOrg = await prisma.organization.findUnique({ where: { code: 'APOLLO' }, include: { branches: true, users: true } })
  const krishnaOrg = await prisma.organization.findUnique({ where: { code: 'KRISHNA' }, include: { branches: true, users: true } })

  if (!apolloOrg || !apolloOrg.branches[0]) {
    console.error('Apollo Org not found!')
    return
  }
  if (!krishnaOrg || !krishnaOrg.branches[0]) {
    console.error('Krishna Org not found!')
    return
  }

  const apolloBranchId = apolloOrg.branches[0].id
  const apolloAdmin = apolloOrg.users.find(u => u.email === 'apollo.admin@pharmacare.local') || apolloOrg.users[0]
  const apolloCashier = apolloOrg.users.find(u => u.email === 'apollo.cashier@pharmacare.local') || apolloAdmin

  const krishnaBranchId = krishnaOrg.branches[0].id
  const krishnaAdmin = krishnaOrg.users.find(u => u.email === 'ramesh@krishnamed.com') || krishnaOrg.users[0]
  const krishnaCashier = krishnaOrg.users.find(u => u.email === 'krishna.cashier@krishnamed.com') || krishnaAdmin

  // Sample medicines data
  const sampleMedicines = [
    { name: 'Augmentin 625 Duo Tablet', genericName: 'Amoxicillin and Clavulanic Acid', hsn: '3004', cost: 145.20, mrp: 201.70, schedule: 'H' },
    { name: 'Pan 40 Tablet', genericName: 'Pantoprazole Gastro-Resistant', hsn: '3004', cost: 82.50, mrp: 114.50, schedule: 'H' },
    { name: 'Azithral 500 Tablet', genericName: 'Azithromycin Tablets IP', hsn: '3004', cost: 95.00, mrp: 132.00, schedule: 'H' },
    { name: 'Telma 40 Tablet', genericName: 'Telmisartan Tablets IP', hsn: '3004', cost: 110.00, mrp: 155.00, schedule: 'H' },
    { name: 'Dolo 650 Tablet', genericName: 'Paracetamol Tablets IP', hsn: '3004', cost: 24.50, mrp: 34.00, schedule: 'H' },
    { name: 'Clexane 40mg Injection', genericName: 'Enoxaparin Sodium', hsn: '3004', cost: 420.00, mrp: 580.00, schedule: 'H' },
    { name: 'Glycomet GP 1 Tablet', genericName: 'Glimepiride and Metformin', hsn: '3004', cost: 78.00, mrp: 108.50, schedule: 'H' },
    { name: 'Montair LC Tablet', genericName: 'Montelukast and Levocetirizine', hsn: '3004', cost: 165.00, mrp: 228.00, schedule: 'H' },
  ]

  async function seedShop(org: typeof apolloOrg, branchId: string, adminUser: typeof apolloAdmin, cashierUser: typeof apolloCashier, prefix: string) {
    console.log(`\nSeeding shop: ${org.name} [${org.code}]...`)

    // Clean up previous runs for this branch
    await prisma.saleItemBatch.deleteMany({ where: { batch: { branchId } } }).catch(() => {})
    await prisma.saleItem.deleteMany({ where: { sale: { branchId } } }).catch(() => {})
    await prisma.payment.deleteMany({ where: { sale: { branchId } } }).catch(() => {})
    await prisma.sale.deleteMany({ where: { branchId } }).catch(() => {})
    await prisma.purchaseItem.deleteMany({ where: { purchase: { branchId } } }).catch(() => {})
    await prisma.purchase.deleteMany({ where: { branchId } }).catch(() => {})
    await prisma.inventory.deleteMany({ where: { branchId } }).catch(() => {})
    await prisma.batch.deleteMany({ where: { branchId } }).catch(() => {})
    await prisma.product.deleteMany({ where: { organizationId: org.id } }).catch(() => {})
    await prisma.supplier.deleteMany({ where: { organizationId: org.id } }).catch(() => {})
    await prisma.customer.deleteMany({ where: { organizationId: org.id } }).catch(() => {})

    // 1. Create Supplier for this shop
    const supplier = await prisma.supplier.create({
      data: {
        organizationId: org.id,
        name: `${org.name} Wholesale Distributors`,
        gstin: `36${org.code}1234F1Z5`,
        dlNumber: `20B/21B-${org.code}-5521`,
        phone: '9848099887',
        email: `distributor@${org.slug}.local`,
        address: 'Wholesale Pharma Market, Hyderabad',
        outstandingBalance: 35000.0,
      },
    })

    // 2. Create Customers
    const customer1 = await prisma.customer.create({
      data: {
        organizationId: org.id,
        name: `Sunita Rao (${org.code})`,
        phone: '9876543001',
        email: `sunita@${org.slug}.patient`,
        outstandingBalance: 1200.0,
      },
    })
    const customer2 = await prisma.customer.create({
      data: {
        organizationId: org.id,
        name: `Venkatesh Reddy (${org.code})`,
        phone: '9876543002',
        email: `venkat@${org.slug}.patient`,
        outstandingBalance: 0,
      },
    })

    // 3. Create Products, Batches, Inventory & Purchases
    const createdProducts = []
    for (let i = 0; i < sampleMedicines.length; i++) {
      const med = sampleMedicines[i]
      const prod = await prisma.product.create({
        data: {
          organizationId: org.id,
          name: `${med.name} [${org.code}]`,
          genericName: med.genericName,
          sku: `SKU-${org.code}-${String(i + 1).padStart(3, '0')}`,
          barcode: `${prefix}${100000 + i}`,
          hsnCode: med.hsn,
          costPrice: med.cost,
          ptr: med.cost,
          mrp: med.mrp,
          gstRate: 12,
          createdById: adminUser.id,
          isActive: true,
        },
      })

      // Batch
      const batch = await prisma.batch.create({
        data: {
          productId: prod.id,
          branchId,
          batchNumber: `BT-${org.code}-${2026}${i + 1}`,
          expiryDate: new Date('2028-12-31'),
          purchasePrice: med.cost,
          ptr: med.cost,
          mrp: med.mrp,
          quantity: 200,
          status: 'ACTIVE',
        },
      })

      // Inventory
      await prisma.inventory.create({
        data: {
          productId: prod.id,
          branchId,
          totalQuantity: 200,
          availableQuantity: 200,
          reservedQuantity: 0,
        },
      })

      createdProducts.push({ prod, batch, med })
    }

    // 4. Create Inward Purchases
    let totalPurchasedAmount = 0
    const purchaseItemsData = createdProducts.map(({ prod, med }) => {
      const qty = 50
      const lineTotal = qty * med.cost
      totalPurchasedAmount += lineTotal
      return {
        productId: prod.id,
        orderedQuantity: qty,
        receivedQuantity: qty,
        freeQuantity: 5,
        unitCost: med.cost,
        mrp: med.mrp,
        totalAmount: lineTotal,
        batchNumber: `PB-${prod.sku}`,
        expiryDate: new Date('2028-12-31'),
      }
    })

    const purchase = await prisma.purchase.create({
      data: {
        purchaseNumber: `PO-${org.code}-001`,
        branchId,
        supplierId: supplier.id,
        invoiceNumber: `INV-WHOLESALE-${org.code}-881`,
        invoiceDate: new Date(),
        purchaseDate: new Date(),
        status: 'RECEIVED',
        subtotal: totalPurchasedAmount * 0.88,
        taxAmount: totalPurchasedAmount * 0.12,
        totalAmount: totalPurchasedAmount,
        amountPaid: totalPurchasedAmount - 35000,
        balanceDue: 35000,
        createdById: adminUser.id,
        items: { create: purchaseItemsData },
      },
    })
    console.log(`✓ Purchase bill created: ${purchase.purchaseNumber} (Total: ₹${totalPurchasedAmount.toFixed(2)})`)

    // 5. Create 15 Realistic Sales Transactions with Computed Profit
    let totalSalesRevenue = 0
    let totalCogs = 0

    for (let sIdx = 1; sIdx <= 15; sIdx++) {
      const itemsCount = 2 + (sIdx % 3)
      let saleSubtotal = 0
      let saleTax = 0
      const saleItemsToCreate = []

      for (let k = 0; k < itemsCount; k++) {
        const itemIdx = (sIdx + k) % createdProducts.length
        const { prod, batch, med } = createdProducts[itemIdx]
        const soldQty = 2 + (k % 4)
        const lineTotal = soldQty * med.mrp
        const lineCost = soldQty * med.cost
        saleSubtotal += lineTotal * 0.88
        saleTax += lineTotal * 0.12
        totalCogs += lineCost

        saleItemsToCreate.push({
          productId: prod.id,
          productName: prod.name,
          productSku: prod.sku,
          quantity: soldQty,
          unitPrice: med.mrp,
          mrp: med.mrp,
          totalAmount: lineTotal,
          itemBatches: {
            create: {
              batchId: batch.id,
              quantity: soldQty,
              unitPrice: med.mrp,
            },
          },
        })
      }

      const saleTotal = Math.round((saleSubtotal + saleTax) * 100) / 100
      totalSalesRevenue += saleTotal

      const cust = sIdx % 2 === 0 ? customer1 : customer2
      const payMethod = sIdx % 3 === 0 ? 'UPI' : sIdx % 3 === 1 ? 'CASH' : 'CARD'

      const sale = await prisma.sale.create({
        data: {
          invoiceNumber: `INV-${org.code}-${String(sIdx).padStart(5, '0')}`,
          branchId,
          customerId: cust.id,
          saleDate: new Date(Date.now() - (15 - sIdx) * 24 * 3600 * 1000),
          status: 'COMPLETED',
          paymentStatus: 'PAID',
          subtotal: Math.round(saleSubtotal * 100) / 100,
          taxAmount: Math.round(saleTax * 100) / 100,
          discountAmount: 0,
          totalAmount: saleTotal,
          amountPaid: saleTotal,
          createdById: cashierUser.id,
          items: { create: saleItemsToCreate },
          payments: {
            create: {
              method: payMethod as any,
              amount: saleTotal,
              paymentDate: new Date(),
            },
          },
        },
      })
    }

    const grossProfit = totalSalesRevenue - totalCogs
    const marginPct = (grossProfit / totalSalesRevenue) * 100
    console.log(`✓ 15 Completed Sales generated: Revenue: ₹${totalSalesRevenue.toFixed(2)} | COGS: ₹${totalCogs.toFixed(2)} | Profit: ₹${grossProfit.toFixed(2)} (${marginPct.toFixed(1)}%)`)
  }

  await seedShop(apolloOrg, apolloBranchId, apolloAdmin, apolloCashier, '8901')
  await seedShop(krishnaOrg, krishnaBranchId, krishnaAdmin, krishnaCashier, '8902')

  console.log('\nAll chemist shop financial histories seeded successfully!')
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
