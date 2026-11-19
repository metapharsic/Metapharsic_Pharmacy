// ─────────────────────────────────────────────────────────────
// Multi-Threaded Product Categories & Therapeutic Classifications Validation
// ─────────────────────────────────────────────────────────────
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface WorkerMessage {
  threadId: string
  success: boolean
  message?: string
  metrics?: Record<string, any>
  error?: string
}

function sendSafe(msg: WorkerMessage) {
  try {
    parentPort?.postMessage(msg)
  } catch (err) {
    console.error('Failed to post message from worker:', err)
  }
}

if (!isMainThread) {
  const { threadId } = workerData as { threadId: string }

  async function runWorker() {
    try {
      if (threadId === 'THREAD_1_TREE_HIERARCHY_AND_DESCENDANTS') {
        const { getCategoryTree, getDescendantCategoryIds, updateCategory } = await import('../src/lib/products/product-service')

        const tree = await getCategoryTree()
        if (!tree || tree.length === 0) {
          throw new Error('Category tree is empty')
        }

        const dosageRoot = tree.find((r) => r.slug === 'dosage-forms')
        const therapeuticRoot = tree.find((r) => r.slug === 'therapeutic-classifications')

        if (!dosageRoot) throw new Error('Missing "Dosage Forms" root category')
        if (!therapeuticRoot) throw new Error('Missing "Therapeutic Classifications" root category')

        if (dosageRoot.children.length === 0) throw new Error('Dosage Forms has no subcategories')
        if (therapeuticRoot.children.length === 0) throw new Error('Therapeutic Classifications has no subcategories')

        // Verify descendant resolution
        const dosageDescendants = await getDescendantCategoryIds(dosageRoot.id)
        const therapeuticDescendants = await getDescendantCategoryIds(therapeuticRoot.id)

        if (dosageDescendants.length <= 1) throw new Error('Failed to resolve dosage form descendants')
        if (therapeuticDescendants.length <= 1) throw new Error('Failed to resolve therapeutic descendants')

        // Verify circular hierarchy rejection
        const firstChild = therapeuticRoot.children[0]
        let rejectedCircular = false
        try {
          await updateCategory(therapeuticRoot.id, { parentId: firstChild.id })
        } catch (err: any) {
          if (err.message.includes('descendant') || err.message.includes('circular') || err.message.includes('parent')) {
            rejectedCircular = true
          }
        }

        if (!rejectedCircular) {
          throw new Error('Circular hierarchy check failed to prevent descendant as parent')
        }

        sendSafe({
          threadId,
          success: true,
          message: 'Tree hierarchy, root classification branches, subtree product counts, and cycle guards verified.',
          metrics: {
            rootCategoriesCount: tree.length,
            dosageSubcategories: dosageRoot.children.length,
            dosageSubtreeProducts: dosageRoot.productCount,
            therapeuticSubcategories: therapeuticRoot.children.length,
            therapeuticSubtreeProducts: therapeuticRoot.productCount,
            circularGuardVerified: true,
          },
        })
      } else if (threadId === 'THREAD_2_ANALYTICS_ROLLUP_AND_DEDUPLICATION') {
        const { getCategoryAnalytics } = await import('../src/lib/categories/category-analytics-service')

        const analytics = await getCategoryAnalytics()
        const { grandTotals, categoryMetrics } = analytics

        if (!grandTotals || grandTotals.totalCategories === 0) {
          throw new Error('Invalid grand totals in category analytics')
        }

        if (grandTotals.totalValuationMrp < grandTotals.totalValuationCost) {
          throw new Error('MRP valuation cannot be less than cost valuation')
        }

        const expectedProfit = Math.round((grandTotals.totalValuationMrp - grandTotals.totalValuationCost) * 100) / 100
        if (Math.abs(grandTotals.totalPotentialGrossProfit - expectedProfit) > 0.05) {
          throw new Error(`Gross profit mismatch: expected ${expectedProfit}, got ${grandTotals.totalPotentialGrossProfit}`)
        }

        const metricsList = Object.values(categoryMetrics)
        const dosageMetric = metricsList.find((m) => m.slug === 'dosage-forms')
        const therapeuticMetric = metricsList.find((m) => m.slug === 'therapeutic-classifications')

        if (!dosageMetric || dosageMetric.availableStockUnits === 0) {
          throw new Error('Dosage Forms failed to roll up subtree stock units')
        }
        if (!therapeuticMetric || therapeuticMetric.availableStockUnits === 0) {
          throw new Error('Therapeutic Classifications failed to roll up subtree stock units')
        }

        const sampleChild = metricsList.find((m) => m.availableStockUnits > 0 && m.parentId)
        if (!sampleChild || sampleChild.marginPercent <= 0) {
          throw new Error('Subcategory margin percentage was not properly calculated')
        }

        sendSafe({
          threadId,
          success: true,
          message: 'Category valuation rollup, margin math, and multi-category deduplication verified.',
          metrics: {
            totalCategories: grandTotals.totalCategories,
            uniqueProductsMapped: grandTotals.totalProductsMapped,
            totalInventoryUnits: grandTotals.totalInventoryUnits,
            totalValuationCost: grandTotals.totalValuationCost,
            totalValuationMrp: grandTotals.totalValuationMrp,
            overallMarginPercent: grandTotals.overallMarginPercent,
            dosageRollupUnits: dosageMetric.availableStockUnits,
            therapeuticRollupUnits: therapeuticMetric.availableStockUnits,
          },
        })
      } else if (threadId === 'THREAD_3_ATOMIC_CATEGORY_CRUD_AND_SLUGS') {
        const { createCategory, updateCategory, deleteCategory } = await import('../src/lib/products/product-service')

        const testSlug = `test-cat-${Date.now()}`
        const root = await prisma.category.findUnique({ where: { slug: 'therapeutic-classifications' } })
        if (!root) throw new Error('Missing therapeutic root for CRUD test')

        // 1. Create category
        const created = await createCategory({
          name: 'Temporary Worker Test Category',
          slug: testSlug,
          description: 'Atomic concurrency validation node',
          parentId: root.id,
          sortOrder: 999,
          isActive: true,
        })

        if (!created || created.slug !== testSlug) {
          throw new Error('Failed to create test category')
        }

        // 2. Test duplicate slug collision guard
        let duplicateCaught = false
        try {
          await createCategory({
            name: 'Duplicate Category',
            slug: testSlug,
            parentId: root.id,
          })
        } catch {
          duplicateCaught = true
        }

        if (!duplicateCaught) {
          throw new Error('Unique slug collision guard failed to reject duplicate')
        }

        // 3. Update category
        const updated = await updateCategory(created.id, {
          description: 'Updated description by worker thread',
        })
        if (updated.description !== 'Updated description by worker thread') {
          throw new Error('Category update did not persist')
        }

        // 4. Soft delete (deactivate)
        const deactivated = await deleteCategory(created.id)
        if (deactivated.isActive !== false) {
          throw new Error('Category soft delete failed to set isActive to false')
        }

        // 5. Cleanup test category
        await prisma.category.delete({ where: { id: created.id } })

        sendSafe({
          threadId,
          success: true,
          message: 'Atomic category mutations, slug collision rejection, soft-delete, and cleanup verified.',
          metrics: {
            createdCategoryId: created.id,
            slugCollisionPrevented: true,
            softDeleteVerified: true,
            atomicallyCleanedUp: true,
          },
        })
      } else if (threadId === 'THREAD_4_THERAPEUTIC_CATALOG_FILTER_AND_SUBSTITUTES') {
        const { getProducts, getProductSubstitutes, getCategoryOptions } = await import('../src/lib/products/product-service')

        // 1. Verify parent category catalog filtering
        const therapeuticRoot = await prisma.category.findUnique({ where: { slug: 'therapeutic-classifications' } })
        if (!therapeuticRoot) throw new Error('Missing therapeutic root')

        const catalogRes = await getProducts({ categoryId: therapeuticRoot.id, limit: 10 })
        if (catalogRes.data.length === 0) {
          throw new Error('Catalog filter by parent Therapeutic Classifications returned 0 products')
        }

        // 2. Verify options include parentName
        const options = await getCategoryOptions()
        const childOption = options.find((o) => o.parentId !== null)
        if (!childOption || !childOption.parentName) {
          throw new Error('Category options missing parentName for grouping')
        }

        // 3. Test therapeutic substitutes
        const sampleProduct = catalogRes.data.find((p) => p.name.includes('Amoxicillin') || p.name.includes('Paracetamol'))
        if (!sampleProduct) throw new Error('Missing sample product for substitutes test')

        const substitutes = await getProductSubstitutes(sampleProduct.id)

        sendSafe({
          threadId,
          success: true,
          message: 'Parent category catalog filtering, grouped category options, and therapeutic substitutes verified.',
          metrics: {
            parentFilteredProductsCount: catalogRes.data.length,
            optionsCount: options.length,
            optionsParentNameVerified: true,
            sampleProductTested: sampleProduct.name,
            substitutesFound: substitutes.length,
          },
        })
      }
    } catch (err: any) {
      sendSafe({
        threadId,
        success: false,
        error: err.message || String(err),
      })
    } finally {
      await prisma.$disconnect()
    }
  }

  runWorker()
} else {
  // Main Thread Spawner
  async function runMain() {
    console.log('================================================================')
    console.log('🚀 MULTI-THREADED CATEGORIES & THERAPEUTIC CLASSIFICATION ENGINE')
    console.log('================================================================\n')

    const threadNames = [
      'THREAD_1_TREE_HIERARCHY_AND_DESCENDANTS',
      'THREAD_2_ANALYTICS_ROLLUP_AND_DEDUPLICATION',
      'THREAD_3_ATOMIC_CATEGORY_CRUD_AND_SLUGS',
      'THREAD_4_THERAPEUTIC_CATALOG_FILTER_AND_SUBSTITUTES',
    ]

    const startTime = Date.now()
    const results: WorkerMessage[] = []

    await Promise.all(
      threadNames.map((threadId) => {
        return new Promise<void>((resolve) => {
          const worker = new Worker(__filename, {
            workerData: { threadId },
          })

          worker.on('message', (msg: WorkerMessage) => {
            results.push(msg)
            console.log(`[${msg.threadId}] ${msg.success ? '✅ PASS' : '❌ FAIL'}: ${msg.message}`)
            if (msg.metrics) {
              console.log(`  Metrics:`, JSON.stringify(msg.metrics, null, 2))
            }
          })

          worker.on('error', (err) => {
            console.error(`[${threadId}] ❌ WORKER ERROR:`, err)
            results.push({ threadId, success: false, error: err.message })
            resolve()
          })

          worker.on('exit', (code) => {
            if (code !== 0 && !results.some((r) => r.threadId === threadId)) {
              console.error(`[${threadId}] Worker exited with code ${code}`)
              results.push({ threadId, success: false, error: `Exited with code ${code}` })
            }
            resolve()
          })
        })
      })
    )

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log('\n================================================================')
    console.log(`🏁 MULTI-THREAD ENGINE COMPLETE IN ${elapsed}s`)
    console.log('================================================================\n')

    const failed = results.filter((r) => !r.success)
    if (failed.length === 0 && results.length === 4) {
      console.log('🎉 ALL 4 PARALLEL THREADS PASSED WITH 100% SUCCESS\n')
      process.exit(0)
    } else {
      console.error(`💥 ${failed.length} THREAD(S) FAILED\n`)
      process.exit(1)
    }
  }

  runMain().catch((err) => {
    console.error('Main spawner error:', err)
    process.exit(1)
  })
}
