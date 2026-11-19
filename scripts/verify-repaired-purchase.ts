import prisma from '../src/lib/db/prisma'

async function main() {
  const p = await prisma.purchase.findUnique({
    where: { id: 'cmw55b6750002d05je8sgdwb0' },
    include: { items: { include: { product: true } } },
  })
  console.log('Purchase:', p?.purchaseNumber)
  for (const it of p?.items || []) {
    console.log(
      it.product.name.padEnd(25),
      it.product.sku.padEnd(25),
      it.batchNumber.padEnd(16),
      `Unit: ₹${it.unitCost}`,
      `Total: ₹${it.totalAmount}`
    )
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect())

