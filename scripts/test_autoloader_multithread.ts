/**
 * Verification test for Multi-Threaded Inventory Auto-Loader
 */

import { runInventoryAutoloader } from '../src/lib/scanner/inventory-autoloader-client'

async function main() {
  console.log('[TEST] Starting 5-Thread Inventory Auto-Loader Test...')

  // Sample items resembling the user's invoice from WhatsApp Image (Hyper Pharma)
  const sampleRawItems = [
    {
      id: 'it-1',
      rawDescription: 'A TO Z SYP (REVON)',
      batchNumber: '25E01',
      expiryDate: '2027-03-31',
      billedQuantity: 0, // missing from OCR
      unitCost: 0,       // missing from OCR
      mrp: 0,
      totalAmount: 327.25,
      taxPercent: 5,
    },
    {
      id: 'it-2',
      rawDescription: 'AMBROLYTE DROPS',
      batchNumber: '6KI02',
      expiryDate: '2027-03-31',
      billedQuantity: 0,
      unitCost: 0,
      mrp: 0,
      totalAmount: 116.16,
      taxPercent: 5,
    },
    {
      id: 'it-3',
      rawDescription: 'ATARAX SYP',
      batchNumber: '02E09',
      expiryDate: '2029-04-30',
      billedQuantity: 0,
      unitCost: 0,
      mrp: 0,
      totalAmount: 120.86,
      taxPercent: 5,
    },
  ]

  // Existing historical invoicing data in database
  const sampleHistory = [
    {
      productName: 'AMBROLYTE DROPS',
      unitCost: 55.31,
      ptr: 55.31,
      mrp: 75.0,
      taxPercent: 5,
      packSize: '15ml',
      tabsPerStrip: 1,
    },
  ]

  const sampleCatalog = [
    {
      id: 'prod-existing-1',
      name: 'Ambrolyte Drops 15ml',
      sku: 'AMB-DRP',
      mrp: 75.0,
      ptr: 55.31,
      costPrice: 50.0,
      gstRate: 5,
      packSize: '15ml',
      tabsPerStrip: 1,
    },
  ]

  const result = await runInventoryAutoloader({
    rawItems: sampleRawItems,
    catalogProducts: sampleCatalog,
    purchaseHistory: sampleHistory,
    financials: { totalAmount: 564.27 },
  })

  console.log('\n[RESULT] Success:', result.success)
  console.log('[RESULT] Merkle Root:', result.merkleRoot)
  console.log('[RESULT] Threads Executed:', result.threads.length)

  result.threads.forEach((t) => {
    console.log(`  -> [${t.threadId}] ${t.name}: ${t.status} (${t.executionDurationMs}ms, memory: ${t.memoryUsageMb}MB)`)
  })

  console.log('\n[ENRICHED LINE ITEMS]:')
  result.items.forEach((item, i) => {
    console.log(`  Item ${i + 1}:`)
    console.log(`    Name: "${item.productName}" (Raw: "${item.rawDescription}")`)
    console.log(`    Product ID: ${item.matchedProductId}`)
    console.log(`    Billed Qty: ${item.billedQuantity}`)
    console.log(`    Unit Cost (PTR): ₹${item.unitCost}`)
    console.log(`    MRP: ₹${item.mrp}`)
    console.log(`    Line Total: ₹${item.totalAmount}`)
    console.log(`    Is New: ${item.isNewProduct}`)
  })

  // Assertions
  if (result.threads.length !== 5) throw new Error('Expected 5 threads')
  if (result.items.length !== 3) throw new Error('Expected 3 items')
  for (const it of result.items) {
    if (!it.productName) throw new Error('Item missing productName')
    if (it.billedQuantity <= 0) throw new Error('Item missing billedQuantity')
    if (it.unitCost <= 0) throw new Error('Item missing unitCost')
    if (it.mrp <= 0) throw new Error('Item missing mrp')
  }

  console.log('\n[SUCCESS] All 5 threads executed and all invoice items loaded into inventory!')
}

main().catch((err) => {
  console.error('[ERROR]', err)
  process.exit(1)
})

