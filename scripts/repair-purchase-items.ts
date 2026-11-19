import prisma from '../src/lib/db/prisma'

const MEDICINE_MAPPINGS = [
  { batch: 'ALKE 25660230', name: 'A TO Z SYP (REVON)', pack: '200ml Syrup' },
  { batch: 'CIPL 6K00100', name: 'AMBROLITE DROPS', pack: '15ml Drops' },
  { batch: 'ADIS MPD261122', name: 'AMBROLITE DROPS', pack: '15ml Drops' },
  { batch: 'OCB D260341', name: 'ATARAX SYP', pack: '100ml Syrup' },
  { batch: 'Z056H2000', name: 'AUGPEN DROPS', pack: '10ml Drops' },
  { batch: 'MANK B0A0Z028', name: 'BANDY PLUS SYP', pack: '10ml Suspension' },
  { batch: 'MEYE 377E2640', name: 'CALDIMAX P SYP', pack: '200ml Syrup' },
  { batch: 'DR.R BHEZ/ADA', name: 'CLAVAM BID FORTE SYP', pack: '30ml Dry Syrup' },
  { batch: 'ABBO MBM0051', name: 'CLAVAM DRY SYP', pack: '30ml Dry Syrup' },
  { batch: 'DR.R 9544', name: 'CLAVAM FORTE DRY SYP', pack: '30ml Dry Syrup' },
  { batch: 'ALBE 26349016', name: 'COLIC AID DROPS', pack: '15ml Drops' },
  { batch: 'FAMA V1A12003', name: 'ERIKID SYP', pack: '60ml Syrup' },
  { batch: 'UNIQ PSM26004', name: 'KIDPRED SYP', pack: '60ml Syrup' },
  { batch: 'ICPA 026544', name: 'LIVO-UP SYP', pack: '200ml Syrup' },
  { batch: 'FBC 03265271', name: 'METROGYL SYP', pack: '60ml Syrup' },
  { batch: 'ALKE 25460118', name: 'MEFTAL P SYP', pack: '60ml Suspension' },
  { batch: 'MEYE 606/2627', name: 'MUCINAC PLUS SYP', pack: '100ml Syrup' },
  { batch: 'DR.R CT600816', name: 'THEX 250MG INJ', pack: '1 Vial' },
]

async function main() {
  const purchaseId = 'cmw55b6750002d05je8sgdwb0'
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { items: true },
  })
  if (!purchase) {
    console.log('Purchase not found')
    return
  }
  console.log('Found purchase with', purchase.items.length, 'items')

  for (const mapping of MEDICINE_MAPPINGS) {
    let product = await prisma.product.findFirst({
      where: { name: { equals: mapping.name, mode: 'insensitive' } },
    })
    if (!product) {
      const sku = `SKU-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
      product = await prisma.product.create({
        data: {
          name: mapping.name,
          sku,
          packSize: mapping.pack,
          tabsPerStrip: 10,
          costPrice: 50,
          ptr: 50,
          mrp: 65,
          gstRate: 5,
          cgstRate: 2.5,
          sgstRate: 2.5,
          igstRate: 5,
          isActive: true,
          createdById: purchase.createdById,
        },
      })
      console.log('Created product:', product.name, product.sku)
    } else {
      console.log('Found existing product:', product.name, product.sku)
    }

    const pItem = purchase.items.find((it) => it.batchNumber === mapping.batch)
    if (pItem) {
      await prisma.purchaseItem.update({
        where: { id: pItem.id },
        data: { productId: product.id },
      })
      console.log('Updated purchaseItem', pItem.id, '->', product.name)
      
      const existingBatch = await prisma.batch.findFirst({
        where: { batchNumber: mapping.batch, purchaseId: purchase.id },
      })
      if (existingBatch && existingBatch.productId !== product.id) {
        // Check if there is already a batch with (product.id, mapping.batch)
        const targetBatch = await prisma.batch.findUnique({
          where: { productId_batchNumber: { productId: product.id, batchNumber: mapping.batch } },
        })
        if (targetBatch) {
          await prisma.batch.delete({ where: { id: existingBatch.id } })
        } else {
          await prisma.batch.update({
            where: { id: existingBatch.id },
            data: { productId: product.id },
          })
        }
      }
      console.log('Updated batch for', mapping.batch, '->', product.name)
    }
  }
  console.log('ALL ITEMS SUCCESSFULLY REPAIRED!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
