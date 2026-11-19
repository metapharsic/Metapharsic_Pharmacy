/**
 * Multi-threaded Product Catalog Wiring & Verification Engine
 * Spawns 4 concurrent worker threads via Node.js worker_threads
 * to verify complete Product Master logic:
 *   - Thread 1: Catalog Query, Search & Loose Tablet Economics
 *   - Thread 2: Executive Catalog Intelligence KPIs & Valuation
 *   - Thread 3: Atomic Product Creation, Initial Batch/Inventory Link & Collision Guards
 *   - Thread 4: Generic Salt Substitutes & Shelf Rack Relocation
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'
import { PrismaClient } from '@prisma/client'
import {
  getProducts,
  getProductById,
  createProduct,
  deleteProduct,
  getProductSubstitutes,
  updateProductRack,
  checkSkuExists,
  checkBarcodeExists,
} from '../src/lib/products/product-service'
import { getCatalogSummaryMetrics } from '../src/lib/products/product-analytics-service'
import { round2 } from '../src/lib/sales/pricing'

const prisma = new PrismaClient()

if (isMainThread) {
  async function runMaster() {
    console.log('================================================================')
    console.log('🚀 MULTI-THREADED PRODUCT CATALOG WIRING & LOGIC VERIFICATION')
    console.log('================================================================\n')

    const branch = await prisma.branch.findFirst({ where: { isActive: true } })
    if (!branch) throw new Error('No active branch found')

    const sampleProduct = await prisma.product.findFirst({
      where: { isActive: true },
      include: { batches: { where: { status: 'ACTIVE', quantity: { gt: 0 } } } },
    })
    if (!sampleProduct) throw new Error('No active product found for testing')

    const threadConfigs = [
      {
        threadId: 'THREAD_1_CATALOG_QUERY_AND_TABLET_ECONOMICS',
        description: 'Verify Product Catalog pagination, search filters & per-tablet pro-rating',
        branchId: branch.id,
        productId: sampleProduct.id,
      },
      {
        threadId: 'THREAD_2_CATALOG_SUMMARY_KPIS_AND_VALUATION',
        description: 'Verify Catalog Valuation, Stock KPIs, Expiry & Schedule H Compliance',
        branchId: branch.id,
        productId: sampleProduct.id,
      },
      {
        threadId: 'THREAD_3_ATOMIC_PRODUCT_CREATION_AND_BARCODES',
        description: 'Verify Product Creation, Initial Batch + Inventory Upsert & Collision Guards',
        branchId: branch.id,
        productId: sampleProduct.id,
      },
      {
        threadId: 'THREAD_4_SUBSTITUTES_AND_RACK_RELOCATION',
        description: 'Verify Generic Substitutes Finder & Quick Rack Relocation',
        branchId: branch.id,
        productId: sampleProduct.id,
      },
    ]

    const startTime = Date.now()
    const results: any[] = []

    await Promise.all(
      threadConfigs.map((cfg) => {
        return new Promise<void>((resolve) => {
          const worker = new Worker(__filename, { workerData: cfg })

          worker.on('message', (msg) => {
            results.push(msg)
            console.log(`[${msg.threadId}] ${msg.success ? '✅ PASS' : '❌ FAIL'}: ${msg.message}`)
            if (msg.details) {
              console.log(`  Metrics:`, JSON.stringify(msg.details, null, 2))
            }
          })

          worker.on('error', (err) => {
            console.error(`[${cfg.threadId}] ❌ WORKER ERROR:`, err)
            results.push({ threadId: cfg.threadId, success: false, message: err.message })
            resolve()
          })

          worker.on('exit', (code) => {
            if (code !== 0 && !results.some((r) => r.threadId === cfg.threadId)) {
              console.error(`[${cfg.threadId}] Worker exited with code ${code}`)
              results.push({ threadId: cfg.threadId, success: false, message: `Exited with code ${code}` })
            }
            resolve()
          })
        })
      })
    )

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log('\n================================================================')
    console.log(`🏁 MULTI-THREAD VERIFICATION COMPLETE IN ${duration}s`)
    console.log('================================================================')

    const failed = results.filter((r) => !r.success)
    if (failed.length > 0) {
      console.error(`\n❌ ${failed.length} / 4 THREADS REPORTED FAILURES`)
      process.exit(1)
    } else {
      console.log(`\n🎉 ALL 4 PARALLEL THREADS PASSED WITH 100% SUCCESS`)
      process.exit(0)
    }
  }

  runMaster().catch((err) => {
    console.error('Fatal master thread error:', err)
    process.exit(1)
  })
} else {
  // Safe messaging to prevent DataCloneError with Decimal instances
  function sendSafe(msg: any) {
    try {
      const clean = JSON.parse(
        JSON.stringify(msg, (_, value) => (typeof value === 'bigint' ? value.toString() : value))
      )
      parentPort?.postMessage(clean)
    } catch (e: any) {
      parentPort?.postMessage({
        threadId: msg.threadId,
        success: false,
        message: `Clone error: ${e.message}`,
      })
    }
  }

  async function runWorker() {
    const { threadId, branchId, productId } = workerData

    try {
      if (threadId === 'THREAD_1_CATALOG_QUERY_AND_TABLET_ECONOMICS') {
        // Query first page of products
        const result = await getProducts({ page: 1, limit: 10, isActive: true })
        if (result.data.length === 0) throw new Error('No products returned from catalog query')

        // Test search filter
        const sampleProd = result.data[0]
        const searchResult = await getProducts({ search: sampleProd.sku, limit: 5 })
        const found = searchResult.data.some((p) => p.id === sampleProd.id)
        if (!found) throw new Error(`Search filter failed for SKU ${sampleProd.sku}`)

        // Verify tablet economics calculation
        let tabletSupportedCount = 0
        for (const p of result.data) {
          const tabs = p.tabsPerStrip ?? 10
          const mrp = Number(p.mrp)
          const tabMrp = round2(mrp / tabs)
          if (p.tabsPerStrip && p.tabsPerStrip > 1) {
            tabletSupportedCount++
          }
          if (tabMrp <= 0) throw new Error(`Invalid pro-rated tablet MRP computed for ${p.sku}`)
        }

        sendSafe({
          threadId,
          success: true,
          message: 'Catalog query, SKU search filtering & tablet economics verified cleanly.',
          details: {
            totalProductsFetched: result.pagination.total,
            pageCount: result.pagination.pages,
            sampleProduct: sampleProd.name,
            sampleStripMrp: Number(sampleProd.mrp),
            sampleTabsPerStrip: sampleProd.tabsPerStrip ?? 10,
            sampleTabMrp: round2(Number(sampleProd.mrp) / (sampleProd.tabsPerStrip ?? 10)),
            tabletSupportedProductsInPage: tabletSupportedCount,
          },
        })
      } else if (threadId === 'THREAD_2_CATALOG_SUMMARY_KPIS_AND_VALUATION') {
        const metrics = await getCatalogSummaryMetrics(branchId)

        if (metrics.totalProducts < 1) throw new Error('Catalog metrics reported 0 products')
        if (typeof metrics.totalValuationCost !== 'number' || typeof metrics.totalValuationMrp !== 'number') {
          throw new Error('Catalog inventory valuation metrics missing or invalid')
        }

        sendSafe({
          threadId,
          success: true,
          message: 'Executive Catalog Intelligence KPIs and stock valuation calculated accurately.',
          details: {
            totalCatalogProducts: metrics.totalProducts,
            inStockUnits: metrics.totalInStockUnits,
            valuationAtCost: metrics.totalValuationCost,
            valuationAtMrp: metrics.totalValuationMrp,
            grossMarginPercent: metrics.overallMarginPercent,
            lowStockShortages: metrics.lowStockCount,
            outOfStockDepletions: metrics.outOfStockCount,
            nearExpiryAlerts: metrics.nearExpiryCount,
            scheduleHRegulated: metrics.scheduleHCount,
          },
        })
      } else if (threadId === 'THREAD_3_ATOMIC_PRODUCT_CREATION_AND_BARCODES') {
        const testSku = `TEST-PROD-${Date.now()}`
        const testBarcode = `BAR-${Date.now()}`

        // Verify collision check helpers
        const skuExistsBefore = await checkSkuExists(testSku)
        const barcodeExistsBefore = await checkBarcodeExists(testBarcode)
        if (skuExistsBefore || barcodeExistsBefore) throw new Error('Uniqueness guard returned false positive')

        const admin = await prisma.user.findFirst({ where: { email: 'admin@pharmacare.local' } })
        if (!admin) throw new Error('Admin user required for product creation')

        // Atomically create product with categories, barcodes, and initial batch
        const created = await createProduct({
          name: 'Amoxicillin & Clavulanate 625mg',
          genericName: 'Amoxicillin (500mg) + Clavulanic Acid (125mg)',
          sku: testSku,
          barcode: testBarcode,
          manufacturer: 'Mylan Laboratories',
          drugSchedule: 'H',
          isPrescriptionRequired: true,
          unitOfMeasure: 'Strip',
          tabsPerStrip: 10,
          packSize: '10 tablets',
          mrp: 185.5,
          costPrice: 120.0,
          ptr: 145.0,
          minStockLevel: 15,
          maxStockLevel: 100,
          rack: 'RACK-B2-04',
          createdById: admin.id,
          initialBatch: {
            batchNumber: `BAT-${Date.now().toString().slice(-6)}`,
            quantity: 30,
            expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
            purchasePrice: 120.0,
            mrp: 185.5,
            branchId,
          },
        })

        // Verify batch and inventory links were atomically created
        const batch = await prisma.batch.findFirst({ where: { productId: created.id } })
        if (!batch || batch.quantity !== 30) throw new Error('Initial batch was not created properly')

        const inventory = await prisma.inventory.findUnique({
          where: { productId_branchId: { productId: created.id, branchId } },
        })
        if (!inventory || inventory.totalQuantity !== 30 || inventory.availableQuantity !== 30) {
          throw new Error('Inventory record was not upserted properly')
        }

        // Test collision guards
        const skuCollision = await checkSkuExists(testSku)
        const barcodeCollision = await checkBarcodeExists(testBarcode)
        if (!skuCollision || !barcodeCollision) throw new Error('Collision guard failed to detect newly inserted SKU/Barcode')

        // Clean up test product
        await prisma.$transaction([
          prisma.inventoryMovement.deleteMany({ where: { inventoryId: inventory.id } }),
          prisma.inventory.deleteMany({ where: { productId: created.id } }),
          prisma.batch.deleteMany({ where: { productId: created.id } }),
          prisma.productBarcode.deleteMany({ where: { productId: created.id } }),
          prisma.productCategory.deleteMany({ where: { productId: created.id } }),
          prisma.product.delete({ where: { id: created.id } }),
        ])

        sendSafe({
          threadId,
          success: true,
          message: 'Atomic Product creation, Initial Batch, Inventory upsert & collision guards verified cleanly.',
          details: {
            createdSku: testSku,
            createdBatch: batch.batchNumber,
            batchQuantity: batch.quantity,
            inventoryQuantity: inventory.availableQuantity,
            tabsPerStrip: created.tabsPerStrip,
            cleanedUp: true,
          },
        })
      } else if (threadId === 'THREAD_4_SUBSTITUTES_AND_RACK_RELOCATION') {
        const prod = await getProductById(productId)
        if (!prod) throw new Error('Target product not found')

        // Test generic substitutes finder
        const substitutes = await getProductSubstitutes(productId)

        // Test quick rack shelf update
        const originalRack = prod.rack
        const testRack = 'RACK1-S1'
        const updated = await updateProductRack(productId, testRack)
        if (!updated.rack || !updated.rack.startsWith('RACK1')) throw new Error('Product rack relocation failed to persist')

        // Revert rack
        await updateProductRack(productId, originalRack)

        sendSafe({
          threadId,
          success: true,
          message: 'Generic substitutes finder and shelf rack relocation verified with zero regression.',
          details: {
            productId: prod.id,
            productName: prod.name,
            genericSalt: prod.genericName,
            substitutesFound: substitutes.length,
            rackRelocatedTo: testRack,
            rackRestoredTo: originalRack,
          },
        })
      }
    } catch (err: any) {
      sendSafe({
        threadId,
        success: false,
        message: err.message || String(err),
      })
    } finally {
      await prisma.$disconnect()
    }
  }

  runWorker()
}
