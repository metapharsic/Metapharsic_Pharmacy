// ─────────────────────────────────────────────────────────────
// Multi-Threaded Validation Engine: Categories, Therapeutic Classifications & Inventory
// Uses Node.js worker_threads across 4 concurrent threads:
// Thread 1: Dual-Root Hierarchy & Descendant Inventory Filtering
// Thread 2: Category Analytics Rollups, Deduplication & Stock Ledger Consistency
// Thread 3: Physical Storage Normalization (Rack/Shelf/Box) & Movement Safety (Zero Object Leakage)
// Thread 4: Therapeutic Substitutes Discovery & Stock Cross-Referencing
// ─────────────────────────────────────────────────────────────
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface WorkerMessage {
  threadId: number
  name: string
  passed: boolean
  details: string[]
  metrics?: Record<string, any>
  durationMs?: number
}

function sendSafe(msg: WorkerMessage) {
  try {
    parentPort?.postMessage(msg)
  } catch (err) {
    console.error('Failed to post message from worker:', err)
  }
}

if (!isMainThread) {
  const { threadId, name } = workerData as { threadId: number; name: string }

  async function executeWorker() {
    const start = Date.now()
    const { getDescendantCategoryIds, getCategoryTree, getProductSubstitutes } = await import(
      '../src/lib/products/product-service'
    )
    const { getInventory, getInventorySummary, getMovements, getAdjustments } = await import(
      '../src/lib/inventory/inventory-service'
    )
    const { getCategoryAnalytics } = await import(
      '../src/lib/categories/category-analytics-service'
    )

    const details: string[] = []
    let passed = true
    let metrics: Record<string, any> = {}

    try {
      if (threadId === 1) {
        // ─── THREAD 1: Dual-Root Hierarchy & Descendant Inventory Filtering ────
        const dosageRoot = await prisma.category.findUnique({
          where: { slug: 'dosage-forms' },
          include: { children: true },
        })
        const therapeuticRoot = await prisma.category.findUnique({
          where: { slug: 'therapeutic-classifications' },
          include: { children: true },
        })

        if (!dosageRoot || !therapeuticRoot) {
          passed = false
          details.push('❌ Roots dosage-forms or therapeutic-classifications missing in DB')
        } else {
          details.push(`✓ Dual roots found: Dosage Forms (${dosageRoot.children.length} subs) & Therapeutic (${therapeuticRoot.children.length} subs)`)
        }

        // Test descendant resolution
        if (dosageRoot) {
          const dosageDescendants = await getDescendantCategoryIds(dosageRoot.id)
          const expectedCount = dosageRoot.children.length + 1
          if (dosageDescendants.length === expectedCount) {
            details.push(`✓ Dosage Forms descendant resolution: ${dosageDescendants.length} IDs (root + ${dosageRoot.children.length} children)`)
          } else {
            passed = false
            details.push(`❌ Expected ${expectedCount} dosage descendants, got ${dosageDescendants.length}`)
          }

          // Test getInventory filtering by root category
          const dosageInv = await getInventory({ categoryId: dosageRoot.id, limit: 100 })
          details.push(`✓ getInventory by Dosage Forms root: ${dosageInv.data.length} items found`)

          // Verify every item has categories and no object leakage
          let categoryLeakage = false
          for (const item of dosageInv.data) {
            if (typeof item.product.rack === 'object' && item.product.rack !== null) {
              categoryLeakage = true
            }
            if (!item.product.categories || item.product.categories.length === 0) {
              details.push(`⚠️ Product ${item.product.name} has no categories populated in InventoryRow`)
            }
          }
          if (categoryLeakage) {
            passed = false
            details.push('❌ Detected raw Object on product.rack in inventory results!')
          } else {
            details.push('✓ product.rack strictly string/null across all returned inventory rows')
          }
          metrics.dosageItemsCount = dosageInv.data.length
        }

        if (therapeuticRoot) {
          const therapeuticDescendants = await getDescendantCategoryIds(therapeuticRoot.id)
          details.push(`✓ Therapeutic descendant resolution: ${therapeuticDescendants.length} IDs`)
          const therapeuticInv = await getInventory({ categoryId: therapeuticRoot.id, limit: 100 })
          details.push(`✓ getInventory by Therapeutic Classifications root: ${therapeuticInv.data.length} items found`)
          metrics.therapeuticItemsCount = therapeuticInv.data.length
        }
      } else if (threadId === 2) {
        // ─── THREAD 2: Category Analytics Rollups & Stock Ledger Consistency ────
        const analytics = await getCategoryAnalytics()
        details.push(`✓ Analytics grand totals: ${analytics.grandTotals.totalUniqueProducts} unique products, ${analytics.grandTotals.totalAvailableStockUnits} stock units`)
        details.push(`✓ Grand Valuation: ₹${analytics.grandTotals.totalValuationMrp} MRP / ₹${analytics.grandTotals.totalValuationCost} Cost (Margin: ${analytics.grandTotals.aggregateMarginPercent}%)`)

        // Verify category summary matches getInventorySummary
        const overallSummary = await getInventorySummary()
        details.push(`✓ Inventory summary: ${overallSummary.totalUnits} total units, ₹${overallSummary.valuationAtMrp.toFixed(2)} valuation`)

        // Verify subtree stock rollup for dosage forms root
        const dosageRoot = await prisma.category.findUnique({ where: { slug: 'dosage-forms' } })
        if (dosageRoot) {
          const rootMetric = analytics.categoryMetrics[dosageRoot.id]
          const dosageSummary = await getInventorySummary(undefined, dosageRoot.id)
          details.push(`✓ Dosage Forms subtree rollup: ${rootMetric?.availableStockUnits ?? 0} units (inventory summary: ${dosageSummary.availableUnits} units)`)
          if (rootMetric && rootMetric.availableStockUnits !== dosageSummary.availableUnits) {
            passed = false
            details.push(`❌ Mismatch between category metric stock (${rootMetric.availableStockUnits}) and inventory summary stock (${dosageSummary.availableUnits})`)
          }
        }

        metrics = {
          uniqueProducts: analytics.grandTotals.totalUniqueProducts,
          totalStockUnits: analytics.grandTotals.totalAvailableStockUnits,
          valuationMrp: analytics.grandTotals.totalValuationMrp,
          marginPercent: analytics.grandTotals.aggregateMarginPercent,
        }
      } else if (threadId === 3) {
        // ─── THREAD 3: Physical Storage Normalization & Movement React Safety ────
        const movementsResult = await getMovements({ page: 1, limit: 50 })
        details.push(`✓ getMovements retrieved: ${movementsResult.data.length} movement records`)

        let objectLeakFound = false
        for (const m of movementsResult.data) {
          if (typeof m.rack === 'object' && m.rack !== null) objectLeakFound = true
          if (typeof m.shelf === 'object' && m.shelf !== null) objectLeakFound = true
          if (typeof m.inventory?.product?.rack === 'object' && m.inventory.product.rack !== null) objectLeakFound = true
        }

        if (objectLeakFound) {
          passed = false
          details.push('❌ Object leakage found in MovementRow! This triggers React child crash.')
        } else {
          details.push('✓ Zero object leakage in movements: rack and shelf are string/null on root and product')
        }

        // Test adjustments normalizer
        const adjustmentsResult = await getAdjustments({ page: 1, limit: 50 })
        details.push(`✓ getAdjustments retrieved: ${adjustmentsResult.data.length} adjustment records`)
        let adjLeakFound = false
        for (const a of adjustmentsResult.data) {
          if (typeof a.product?.rack === 'object' && a.product.rack !== null) adjLeakFound = true
        }
        if (adjLeakFound) {
          passed = false
          details.push('❌ Object leakage found in AdjustmentRow product.rack!')
        } else {
          details.push('✓ Zero object leakage in adjustments: product.rack is strictly string/null')
        }

        metrics = {
          movementsCount: movementsResult.data.length,
          adjustmentsCount: adjustmentsResult.data.length,
          reactSafeStorageCoordinates: true,
        }
      } else if (threadId === 4) {
        // ─── THREAD 4: Therapeutic Substitutes & Stock Cross-Referencing ────
        const products = await prisma.product.findMany({
          take: 5,
          select: { id: true, name: true, genericName: true },
        })

        let totalSubstitutesTested = 0
        for (const p of products) {
          const subs = await getProductSubstitutes(p.id)
          totalSubstitutesTested += subs.length
          for (const s of subs) {
            if (s.id === p.id) {
              passed = false
              details.push(`❌ Product ${p.name} appeared in its own substitute list!`)
            }
            if (typeof s.stockOnHand !== 'number') {
              passed = false
              details.push(`❌ Substitute ${s.name} missing numerical stockOnHand!`)
            }
            if (!s.matchReason) {
              passed = false
              details.push(`❌ Substitute ${s.name} missing matchReason!`)
            }
          }
        }
        details.push(`✓ Tested ${products.length} products: generated ${totalSubstitutesTested} substitutes with real-time stockOnHand and matchReason`)
        metrics = {
          productsEvaluated: products.length,
          totalSubstitutesGenerated: totalSubstitutesTested,
        }
      }
    } catch (err) {
      passed = false
      details.push(`❌ Thread exception: ${err instanceof Error ? err.stack || err.message : String(err)}`)
    } finally {
      try {
        await prisma.$disconnect()
      } catch {}
      sendSafe({
        threadId,
        name,
        passed,
        details,
        metrics,
        durationMs: Date.now() - start,
      })
    }
  }

  executeWorker()
} else {
  // ─── Main Thread ────────────────────────────────────────────
  async function main() {
    console.log('======================================================================')
    console.log('🚀 MULTI-THREADED VALIDATION: CATEGORIES, THERAPEUTIC GROUPS & INVENTORY')
    console.log('======================================================================\n')

    const threads = [
      { id: 1, name: 'Dual-Root Hierarchy & Descendant Inventory Filtering' },
      { id: 2, name: 'Stock Aggregation & Category Analytics Ledger Consistency' },
      { id: 3, name: 'Physical Storage Normalization & Movement React Safety' },
      { id: 4, name: 'Therapeutic Substitutes Discovery & Stock Cross-Referencing' },
    ]

    const startTime = Date.now()
    const results: WorkerMessage[] = []

    await Promise.all(
      threads.map((t) => {
        return new Promise<void>((resolve) => {
          const worker = new Worker(__filename, {
            workerData: { threadId: t.id, name: t.name },
          })

          worker.on('message', (msg: WorkerMessage) => {
            results.push(msg)
            console.log(`[Thread ${msg.threadId}] ${msg.name} (${msg.durationMs}ms) -> ${msg.passed ? '✅ PASS' : '❌ FAIL'}`)
            for (const d of msg.details) {
              console.log(`   ${d}`)
            }
            if (msg.metrics) {
              console.log(`   Metrics:`, JSON.stringify(msg.metrics))
            }
            resolve()
          })

          worker.on('error', (err) => {
            console.error(`[Thread ${t.id}] ❌ Worker Error:`, err)
            results.push({
              threadId: t.id,
              name: t.name,
              passed: false,
              details: [`Worker error: ${err.message}`],
            })
            resolve()
          })

          worker.on('exit', (code) => {
            if (code !== 0 && !results.some((r) => r.threadId === t.id)) {
              results.push({
                threadId: t.id,
                name: t.name,
                passed: false,
                details: [`Worker exited with code ${code}`],
              })
            }
            resolve()
          })
        })
      })
    )

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log('\n----------------------------------------------------------------------')
    console.log(`THREAD EXECUTION COMPLETED (${totalTime}s total elapsed)`)
    console.log('----------------------------------------------------------------------')

    const allPassed = results.length === 4 && results.every((r) => r.passed)
    if (allPassed) {
      console.log('\n🎉 ALL 4 MULTI-THREADED VALIDATION THREADS PASSED SUCCESSFULLY!')
      console.log('======================================================================\n')
      process.exit(0)
    } else {
      console.error('\n⚠️ SOME THREADS FAILED VALIDATION.')
      console.log('======================================================================\n')
      process.exit(1)
    }
  }

  main().catch((e) => {
    console.error('Fatal engine error:', e)
    process.exit(1)
  })
}
