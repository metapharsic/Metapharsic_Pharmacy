// ─────────────────────────────────────────────────────────────
// Category Analytics & Valuation Service (Enterprise Tier-1 ERP)
// Computes live inventory valuation at Cost & MRP, stock rollups,
// expiry risks, low stock alerts, and regulatory classification.
// ─────────────────────────────────────────────────────────────
import prisma from '@/lib/db/prisma'

export interface CategoryAnalyticsMetric {
  categoryId: string
  name: string
  slug: string
  parentId: string | null
  productCount: number
  availableStockUnits: number
  valuationCost: number
  valuationMrp: number
  potentialGrossProfit: number
  marginPercent: number
  nearExpiryBatchesCount: number
  lowStockProductsCount: number
  scheduleCount: number // Schedule H, H1, X
  rxRequiredCount: number
  isActive: boolean
}

export interface DispensaryCategoryRollup {
  grandTotals: {
    totalCategories: number
    totalProductsMapped: number
    totalUniqueProducts?: number
    totalInventoryUnits: number
    totalAvailableStockUnits?: number
    totalValuationCost: number
    totalValuationMrp: number
    totalPotentialGrossProfit: number
    overallMarginPercent: number
    aggregateMarginPercent?: number
    totalNearExpiryBatches: number
    totalLowStockProducts: number
  }
  categoryMetrics: Record<string, CategoryAnalyticsMetric>
}

/**
 * Computes live category analytics directly from active PostgreSQL tables
 */
export async function getCategoryAnalytics(
  branchId?: string,
  organizationId?: string
): Promise<DispensaryCategoryRollup> {
  const ninetyDaysFromNow = new Date()
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90)

  // 1. Fetch categories
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      isActive: true,
    },
  })

  // 2. Fetch product-category relationships with product details and active batches, scoped to tenant organization
  const productCategories = await prisma.productCategory.findMany({
    where: {
      product: {
        isActive: true,
        ...(organizationId ? { organizationId } : {}),
      },
    },
    select: {
      categoryId: true,
      productId: true,
      product: {
        select: {
          id: true,
          name: true,
          costPrice: true,
          mrp: true,
          minStockLevel: true,
          drugSchedule: true,
          isPrescriptionRequired: true,
          inventory: {
            where: branchId ? { branchId } : {},
            select: {
              availableQuantity: true,
              totalQuantity: true,
              reservedQuantity: true,
            },
          },
          batches: {
            where: {
              status: 'ACTIVE',
              ...(branchId ? { branchId } : {}),
            },
            select: {
              id: true,
              batchNumber: true,
              expiryDate: true,
              purchasePrice: true,
              mrp: true,
              quantity: true,
              reservedQuantity: true,
              soldQuantity: true,
            },
          },
        },
      },
    },
  })

  // 3. Build unique product summaries
  interface ProductSummary {
    id: string
    name: string
    isSchedule: boolean
    isRx: boolean
    isLowStock: boolean
    availableStockUnits: number
    valuationCost: number
    valuationMrp: number
    nearExpiryBatchesCount: number
  }

  const productSummaryMap = new Map<string, ProductSummary>()
  // Map categoryId -> Set<productId>
  const directCategoryProducts = new Map<string, Set<string>>()

  for (const pc of productCategories) {
    if (!directCategoryProducts.has(pc.categoryId)) {
      directCategoryProducts.set(pc.categoryId, new Set<string>())
    }
    directCategoryProducts.get(pc.categoryId)!.add(pc.productId)

    if (!productSummaryMap.has(pc.productId)) {
      const prod = pc.product
      const defaultProdCost = prod.costPrice ? Number(prod.costPrice) : Number(prod.mrp) * 0.75
      const defaultProdMrp = Number(prod.mrp)

      const availUnits = (prod.inventory || []).reduce(
        (sum, inv) => sum + (inv.availableQuantity || 0),
        0
      )

      let costVal = 0
      let mrpVal = 0
      let nearExpiryCount = 0

      if (prod.batches.length > 0) {
        let remainingToValue = availUnits
        for (const batch of prod.batches) {
          if (new Date(batch.expiryDate) <= ninetyDaysFromNow) {
            nearExpiryCount += 1
          }

          if (remainingToValue <= 0) continue
          const batchQty = Math.min(remainingToValue, batch.quantity)
          const batchCost = batch.purchasePrice ? Number(batch.purchasePrice) : defaultProdCost
          const batchMrp = batch.mrp ? Number(batch.mrp) : defaultProdMrp

          costVal += batchQty * batchCost
          mrpVal += batchQty * batchMrp
          remainingToValue -= batchQty
        }

        if (remainingToValue > 0) {
          costVal += remainingToValue * defaultProdCost
          mrpVal += remainingToValue * defaultProdMrp
        }
      } else {
        costVal = availUnits * defaultProdCost
        mrpVal = availUnits * defaultProdMrp
      }

      productSummaryMap.set(pc.productId, {
        id: prod.id,
        name: prod.name,
        isSchedule: ['H', 'H1', 'X'].includes(prod.drugSchedule),
        isRx: prod.isPrescriptionRequired,
        isLowStock: availUnits <= prod.minStockLevel,
        availableStockUnits: availUnits,
        valuationCost: costVal,
        valuationMrp: mrpVal,
        nearExpiryBatchesCount: nearExpiryCount,
      })
    }
  }

  // 4. Build descendant category map for hierarchy subtree rollup
  const categoryDescendantsMap = new Map<string, Set<string>>()
  for (const cat of categories) {
    const descendants = new Set<string>([cat.id])
    let added = true
    while (added) {
      added = false
      for (const c of categories) {
        if (c.parentId && descendants.has(c.parentId) && !descendants.has(c.id)) {
          descendants.add(c.id)
          added = true
        }
      }
    }
    categoryDescendantsMap.set(cat.id, descendants)
  }

  // 5. Compute metrics for each category (rollup over unique products in subtree)
  const metricsMap: Record<string, CategoryAnalyticsMetric> = {}

  for (const cat of categories) {
    const descendantIds = categoryDescendantsMap.get(cat.id) ?? new Set([cat.id])
    const subtreeProductIds = new Set<string>()

    for (const did of descendantIds) {
      const pids = directCategoryProducts.get(did)
      if (pids) {
        for (const pid of pids) {
          subtreeProductIds.add(pid)
        }
      }
    }

    let catUnits = 0
    let catCost = 0
    let catMrp = 0
    let catNearExpiry = 0
    let catLowStock = 0
    let catSchedule = 0
    let catRx = 0

    for (const pid of subtreeProductIds) {
      const summary = productSummaryMap.get(pid)
      if (!summary) continue

      catUnits += summary.availableStockUnits
      catCost += summary.valuationCost
      catMrp += summary.valuationMrp
      catNearExpiry += summary.nearExpiryBatchesCount
      if (summary.isLowStock) catLowStock += 1
      if (summary.isSchedule) catSchedule += 1
      if (summary.isRx) catRx += 1
    }

    const roundedCost = Math.round(catCost * 100) / 100
    const roundedMrp = Math.round(catMrp * 100) / 100
    const grossProfit = Math.round((roundedMrp - roundedCost) * 100) / 100
    const margin = roundedMrp > 0 ? Math.round(((grossProfit / roundedMrp) * 100) * 10) / 10 : 0

    metricsMap[cat.id] = {
      categoryId: cat.id,
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId,
      productCount: subtreeProductIds.size,
      availableStockUnits: catUnits,
      valuationCost: roundedCost,
      valuationMrp: roundedMrp,
      potentialGrossProfit: grossProfit,
      marginPercent: margin,
      nearExpiryBatchesCount: catNearExpiry,
      lowStockProductsCount: catLowStock,
      scheduleCount: catSchedule,
      rxRequiredCount: catRx,
      isActive: cat.isActive,
    }
  }

  // 6. Calculate Grand Totals across unique products (zero multi-category double counting)
  let grandTotalUnits = 0
  let grandTotalCost = 0
  let grandTotalMrp = 0
  let grandTotalNearExpiry = 0
  let grandTotalLowStock = 0

  for (const summary of productSummaryMap.values()) {
    grandTotalUnits += summary.availableStockUnits
    grandTotalCost += summary.valuationCost
    grandTotalMrp += summary.valuationMrp
    grandTotalNearExpiry += summary.nearExpiryBatchesCount
    if (summary.isLowStock) grandTotalLowStock += 1
  }

  grandTotalCost = Math.round(grandTotalCost * 100) / 100
  grandTotalMrp = Math.round(grandTotalMrp * 100) / 100
  const grandTotalProfit = Math.round((grandTotalMrp - grandTotalCost) * 100) / 100
  const overallMargin = grandTotalMrp > 0 ? Math.round(((grandTotalProfit / grandTotalMrp) * 100) * 10) / 10 : 0

  return {
    grandTotals: {
      totalCategories: categories.length,
      totalProductsMapped: productSummaryMap.size,
      totalUniqueProducts: productSummaryMap.size,
      totalInventoryUnits: grandTotalUnits,
      totalAvailableStockUnits: grandTotalUnits,
      totalValuationCost: grandTotalCost,
      totalValuationMrp: grandTotalMrp,
      totalPotentialGrossProfit: grandTotalProfit,
      overallMarginPercent: overallMargin,
      aggregateMarginPercent: overallMargin,
      totalNearExpiryBatches: grandTotalNearExpiry,
      totalLowStockProducts: grandTotalLowStock,
    },
    categoryMetrics: metricsMap,
  }
}
