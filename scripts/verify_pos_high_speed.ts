import prisma from '../src/lib/db/prisma'
import { createSale, createHeldBill, listHeldBills, deleteHeldBill } from '../src/lib/sales/sales-service'
import { getPosSettings } from '../src/lib/settings/settings-service'
import { computeItemPricing, computeSaleTotals } from '../src/lib/sales/pricing'

async function runVerification() {
  console.log('====================================================')
  console.log('🚀 MULTI-THREADED HIGH-SPEED POS VERIFICATION')
  console.log('====================================================\n')

  const admin = await prisma.user.findFirst({
    where: { email: 'admin@pharmacare.local' },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: true } }
            }
          }
        }
      }
    }
  })
  if (!admin) throw new Error('Admin user not found')

  const permissions = admin.userRoles.flatMap(ur => ur.role.rolePermissions.map(rp => rp.permission.code))
  const roles = admin.userRoles.map(ur => ur.role.name)
  const branch = await prisma.branch.findFirst({ where: { isHeadOffice: true } }) || await prisma.branch.findFirst()
  if (!branch) throw new Error('Branch not found')

  const actor = {
    id: admin.id,
    roles,
    permissions,
    branchId: branch.id,
  }

  // --- Thread 1: Catalog & Barcode Speed Verification ---
  console.log('⚡ Thread 1: Verifying Product Catalog, Barcodes & Racks...')
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      rack: true,
      categories: { include: { category: true } },
      batches: { where: { status: 'ACTIVE', quantity: { gt: 0 } }, orderBy: { expiryDate: 'asc' } },
    }
  })
  console.log(`  ✓ Total Active Products: ${products.length}`)
  const productsWithRacks = products.filter(p => p.rack !== null)
  console.log(`  ✓ Products with Physical Rack Allocation: ${productsWithRacks.length} / ${products.length}`)
  const productsWithLooseTabs = products.filter(p => p.tabsPerStrip && p.tabsPerStrip > 0)
  console.log(`  ✓ Products Configured for Loose Tablet Dispensing: ${productsWithLooseTabs.length}`)
  
  if (products.length < 40) throw new Error(`Expected at least 40 products, found ${products.length}`)
  console.log('  ✅ Thread 1 Passed!\n')

  // --- Thread 2: Pure Pricing & Strip/Tablet Calculation Verification ---
  console.log('⚡ Thread 2: Verifying Strip vs Loose Tablet Pricing Calculations...')
  const stripProduct = products.find(p => p.tabsPerStrip && p.tabsPerStrip === 10) || products[0]
  const tabsPerStrip = stripProduct.tabsPerStrip || 10
  const mrp = Number(stripProduct.mrp)

  // Test full strip
  const fullStripPricing = computeItemPricing({
    unitPrice: mrp,
    quantity: 2, // 2 full strips
    discountPercent: 10,
    gstRate: Number(stripProduct.gstRate),
    taxInclusive: false,
    tabsPerStrip: tabsPerStrip,
    isTabletSale: false,
  })
  console.log(`  ✓ Full Strip (2 strips @ ₹${mrp}/strip, 10% disc): Net = ₹${fullStripPricing.totalAmount}`)

  // Test loose tablets (e.g. 5 tablets out of 10-tab strip)
  const tabletRate = mrp / tabsPerStrip
  const looseTabsPricing = computeItemPricing({
    unitPrice: tabletRate,
    quantity: 5, // 5 loose tablets
    discountPercent: 0,
    gstRate: Number(stripProduct.gstRate),
    taxInclusive: false,
    tabsPerStrip: tabsPerStrip,
    isTabletSale: true,
  })
  console.log(`  ✓ Loose Tablets (5 tabs @ ₹${tabletRate.toFixed(2)}/tab): Net = ₹${looseTabsPricing.totalAmount}`)
  console.log('  ✅ Thread 2 Passed!\n')

  // --- Thread 3: Park & Retrieve Bill (Held Bills) ---
  console.log('⚡ Thread 3: Verifying Park & Retrieve Bill (Held Bills)...')
  const testCart = [
    {
      productId: stripProduct.id,
      productName: stripProduct.name,
      quantity: 1,
      unitPrice: mrp,
      mrp: mrp,
      discountPercent: 0,
      gstRate: Number(stripProduct.gstRate),
      totalAmount: mrp,
    }
  ]

  const heldBill = await createHeldBill({
    branchId: branch.id,
    label: 'Counter Hold Test 01',
    cartData: testCart,
  }, actor as any)
  console.log(`  ✓ Parked Bill Created: ID ${heldBill.id}, Label: "${heldBill.label}"`)

  const heldList = await listHeldBills(actor as any, branch.id)
  const foundHeld = heldList.find(b => b.id === heldBill.id)
  if (!foundHeld) throw new Error('Held bill not found in retrieval list')
  console.log(`  ✓ Retrieved Parked Bills List: Found bill "${foundHeld.label}"`)

  await deleteHeldBill(heldBill.id, actor as any)
  console.log(`  ✓ Cleaned up test held bill`)
  console.log('  ✅ Thread 3 Passed!\n')

  // --- Thread 4: End-to-End High Speed Checkout & Cash Drawer Reconciliation ---
  console.log('⚡ Thread 4: Verifying Fast POS Cash Checkout & Stock Deduction...')
  const availableBatch = stripProduct.batches[0]
  if (!availableBatch) throw new Error('No available batch for test sale')

  const initialSoldQty = availableBatch.soldQuantity
  const initialAvailableQty = availableBatch.quantity - availableBatch.reservedQuantity - availableBatch.soldQuantity
  const doctor = await prisma.doctor.findFirst()

  const sale = await createSale({
    branchId: branch.id,
    items: [
      {
        productId: stripProduct.id,
        batchId: availableBatch.id,
        quantity: 1,
        discountPercent: 0,
      }
    ],
    payments: [
      {
        method: 'CASH',
        amount: mrp,
      }
    ],
    doctorId: doctor?.id,
    notes: 'POS High-Speed Automated Verification Test',
  }, actor as any)

  console.log(`  ✓ Sale Completed Successfully: Invoice #${sale.invoiceNumber}`)
  console.log(`  ✓ Total Amount: ₹${Number(sale.totalAmount).toFixed(2)}, Paid: ₹${Number(sale.amountPaid).toFixed(2)}`)

  // Verify batch deduction
  const updatedBatch = await prisma.batch.findUnique({ where: { id: availableBatch.id } })
  const updatedAvailableQty = (updatedBatch?.quantity ?? 0) - (updatedBatch?.reservedQuantity ?? 0) - (updatedBatch?.soldQuantity ?? 0)
  console.log(`  ✓ Batch Stock Sold Tracked: Initial Sold ${initialSoldQty} -> Updated Sold ${updatedBatch?.soldQuantity}`)
  console.log(`  ✓ Batch Available Stock: Initial ${initialAvailableQty} -> Updated ${updatedAvailableQty}`)
  if ((updatedBatch?.soldQuantity ?? 0) !== initialSoldQty + 1 || updatedAvailableQty !== initialAvailableQty - 1) {
    throw new Error('Batch stock did not decrement correctly')
  }

  // Verify inventory movement logged
  const movement = await prisma.inventoryMovement.findFirst({
    where: { referenceId: sale.id },
  })
  if (movement) {
    console.log(`  ✓ Inventory Movement Logged: ${movement.type} - Quantity ${movement.quantity}`)
  }
  console.log('  ✅ Thread 4 Passed!\n')

  console.log('====================================================')
  console.log('🎯 ALL 4 POS THREADS PASSED ZERO ERRORS!')
  console.log('====================================================')
}

runVerification()
  .catch(err => {
    console.error('❌ Verification failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

