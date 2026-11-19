import { PrismaClient, PurchaseStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📦 Seeding additional Suppliers and Purchase orders...')

  const branch = (await prisma.branch.findFirst({ where: { isHeadOffice: true, organizationId: 'default-org' } })) || (await prisma.branch.findFirst({ where: { organizationId: 'default-org' } }))
  const admin = (await prisma.user.findFirst({ where: { email: 'admin@pharmacare.local', organizationId: 'default-org' } })) || (await prisma.user.findFirst({ where: { organizationId: 'default-org' } }))
  if (!branch || !admin) return

  const products = await prisma.product.findMany({ where: { organizationId: 'default-org' }, take: 15 })

  const suppliersData = [
    {
      name: 'Sun Pharma Distribution Ltd',
      contactPerson: 'Suresh Patil',
      email: 'orders@sunpharma-dist.local',
      phone: '+91 98200 11223',
      gstin: '27AABCS1234F1Z1',
      dlNumber: 'MH-WZ-884910',
      address: 'Plot 45, MIDC Industrial Area, Andheri East, Mumbai',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400093',
      creditDays: 30,
    },
    {
      name: 'Cipla Trade Logistics',
      contactPerson: 'Ramesh Mehta',
      email: 'supply@ciplatrade.local',
      phone: '+91 98200 44556',
      gstin: '27AABCC9988D1Z8',
      dlNumber: 'MH-WZ-771234',
      address: 'Cipla Depot, Vikhroli Logistics Park, Mumbai',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400079',
      creditDays: 45,
    },
    {
      name: 'Abbott Healthcare Supply Hub',
      contactPerson: 'Kavita Deshmukh',
      email: 'invoicing@abbott-supply.local',
      phone: '+91 98200 77889',
      gstin: '27AABCA3322B1Z3',
      dlNumber: 'MH-WZ-559012',
      address: 'Godown 12, Bhiwandi Warehousing Hub, Thane',
      city: 'Thane',
      state: 'Maharashtra',
      pincode: '421302',
      creditDays: 30,
    },
  ]

  for (let i = 0; i < suppliersData.length; i++) {
    const s = suppliersData[i]
    let supplier = await prisma.supplier.findFirst({
      where: {
        name: s.name,
        OR: [{ organizationId: 'default-org' }, { organizationId: null }],
      },
    })
    if (!supplier) {
      supplier = await prisma.supplier.create({ data: { ...s, organizationId: 'default-org' } })
    } else {
      supplier = await prisma.supplier.update({
        where: { id: supplier.id },
        data: { ...s, organizationId: 'default-org' },
      })
    }

    // Create 2 purchase orders per supplier
    for (let p = 0; p < 2; p++) {
      const pNum = `PO-2026-09-${String(100 + i * 2 + p)}`
      const existingPo = await prisma.purchase.findUnique({ where: { purchaseNumber: pNum } })
      if (!existingPo) {
        const prod1 = products[(i * 2 + p) % products.length]
        const prod2 = products[(i * 2 + p + 1) % products.length]
        const subtotal = 12500 + (i * 1500)
        const tax = Math.round(subtotal * 0.12)
        const total = subtotal + tax

        await prisma.purchase.create({
          data: {
            purchaseNumber: pNum,
            branchId: branch.id,
            supplierId: supplier.id,
            invoiceNumber: `SUPP-INV-${String(8800 + i * 10 + p)}`,
            invoiceDate: new Date(Date.now() - (i + 1) * 86400000 * 3),
            purchaseDate: new Date(Date.now() - (i + 1) * 86400000 * 3),
            status: PurchaseStatus.RECEIVED,
            subtotal,
            taxAmount: tax,
            totalAmount: total,
            amountPaid: total,
            balanceDue: 0,
            notes: 'Procurement verified against physical delivery challan.',
            createdById: admin.id,
            items: {
              create: [
                {
                  productId: prod1.id,
                  orderedQuantity: 50,
                  receivedQuantity: 50,
                  freeQuantity: 5,
                  unitCost: 120,
                  totalAmount: 6000,
                  mrp: 160,
                },
                {
                  productId: prod2.id,
                  orderedQuantity: 40,
                  receivedQuantity: 40,
                  freeQuantity: 4,
                  unitCost: 150,
                  totalAmount: 6000,
                  mrp: 200,
                },
              ],
            },
          },
        })
      }
    }
  }

  console.log('✅ Suppliers and Purchases seeded successfully.')
}

main()
  .catch((e) => {
    console.error('Error:', e)
  })
  .finally(() => prisma.$disconnect())
