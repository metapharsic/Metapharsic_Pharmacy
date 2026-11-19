import type { PrismaClient } from '@prisma/client'

const DEMO_STOCK_MAP: Record<string, { batchNumber: string; qty: number; expiryMonths?: number }> = {
  'DLO-650': { batchNumber: 'D-101', qty: 180, expiryMonths: 20 },
  'DLO-500': { batchNumber: 'D-044', qty: 45, expiryMonths: 18 },
  'DLO-120-SYR': { batchNumber: 'D-120-OUT', qty: 0, expiryMonths: 12 }, // OUT OF STOCK for substitute triggers!
  'DLO-100-DRP': { batchNumber: 'DP-09', qty: 12, expiryMonths: 14 },
  'CAL-650': { batchNumber: 'CP-650', qty: 95, expiryMonths: 22 },
  'P650-TAB': { batchNumber: 'P-650-B', qty: 210, expiryMonths: 24 },
  'PAC-650': { batchNumber: 'PAC-01', qty: 60, expiryMonths: 18 },
  'SML-650': { batchNumber: 'SML-01', qty: 60, expiryMonths: 18 },
  'CAL-120-SUSP': { batchNumber: 'CP-11', qty: 25, expiryMonths: 16 },
  'CRO-120-SUSP': { batchNumber: 'CR-02', qty: 18, expiryMonths: 16 },
  'AZI-500-3': { batchNumber: 'AZ-902', qty: 40, expiryMonths: 36 },
  'AUG-625': { batchNumber: 'AG-229', qty: 40, expiryMonths: 24 },
}

export async function seedInventoryAndBatches(prisma: PrismaClient) {
  const branch =
    (await prisma.branch.findFirst({ where: { isHeadOffice: true, organizationId: 'default-org' } })) ||
    (await prisma.branch.findFirst({ where: { id: 'default-branch' } }))
  if (!branch) {
    console.log('  ⚠️ No default branch found, skipping inventory seed')
    return
  }

  const products = await prisma.product.findMany({
    where: { organizationId: 'default-org' },
  })
  if (products.length === 0) {
    console.log('  ⚠️ No default-org products found, skipping inventory seed')
    return
  }

  const now = new Date()

  for (const product of products) {
    const mfgDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const price = product.costPrice ?? product.ptr ?? product.mrp ?? 10
    const mrp = Number(product.mrp) > 0 ? product.mrp : 20

    // Standard batch expiring in 18 months
    const demoOverride = DEMO_STOCK_MAP[product.sku]
    const batch1Number = demoOverride?.batchNumber ?? `BAT-${product.sku}-01`
    const batchQty = demoOverride !== undefined ? demoOverride.qty : 100
    const expiryMonths = demoOverride?.expiryMonths ?? 18
    const standardExpiry = new Date(now.getTime() + expiryMonths * 30 * 24 * 60 * 60 * 1000)

    const batch1 = await prisma.batch.upsert({
      where: { productId_batchNumber: { productId: product.id, batchNumber: batch1Number } },
      update: {
        quantity: batchQty,
        purchasePrice: price,
        mrp: mrp,
      },
      create: {
        product: { connect: { id: product.id } },
        batchNumber: batch1Number,
        manufacturingDate: mfgDate,
        expiryDate: standardExpiry,
        purchasePrice: price,
        mrp: mrp,
        quantity: batchQty,
        reservedQuantity: 0,
        soldQuantity: 0,
        status: 'ACTIVE',
        branchId: branch.id,
      },
    })

    let totalQty = batchQty
    let availableQty = batchQty - batch1.reservedQuantity - batch1.soldQuantity

    // For Paracetamol, add a near-expiry batch (expiring in 45 days) for expiry alert testing
    if (product.sku === 'PCM-500') {
      const nearExpiryDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000)
      const batch2Number = `BAT-${product.sku}-NEAR`
      const batch2 = await prisma.batch.upsert({
        where: { productId_batchNumber: { productId: product.id, batchNumber: batch2Number } },
        update: {
          branchId: branch.id,
        },
        create: {
          product: { connect: { id: product.id } },
          batchNumber: batch2Number,
          manufacturingDate: new Date(now.getTime() - 300 * 24 * 60 * 60 * 1000),
          expiryDate: nearExpiryDate,
          purchasePrice: price,
          mrp: mrp,
          quantity: 20,
          reservedQuantity: 0,
          soldQuantity: 0,
          status: 'ACTIVE',
          branchId: branch.id,
        },
      })
      totalQty += batch2.quantity
      availableQty += batch2.quantity - batch2.reservedQuantity - batch2.soldQuantity
    }

    // Upsert inventory record
    await prisma.inventory.upsert({
      where: { productId_branchId: { productId: product.id, branchId: branch.id } },
      update: {
        totalQuantity: totalQty,
        availableQuantity: availableQty,
      },
      create: {
        productId: product.id,
        branchId: branch.id,
        totalQuantity: totalQty,
        reservedQuantity: 0,
        availableQuantity: availableQty,
      },
    })
  }

  console.log(`  ✓ Batches and inventory seeded for ${products.length} products`)
}
