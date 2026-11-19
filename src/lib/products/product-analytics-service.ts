// ─────────────────────────────────────────────────────────────
// Product Catalog Analytics & Inventory Intelligence Service
// Computes live dispensary stock status, valuation, low-stock,
// expiry risks, and catalog health metrics directly from PostgreSQL.
// ─────────────────────────────────────────────────────────────
import prisma from '@/lib/db/prisma'

export interface CatalogSummaryMetrics {
  totalProducts: number
  totalInStockUnits: number
  totalValuationCost: number
  totalValuationMrp: number
  overallMarginPercent: number
  lowStockCount: number
  outOfStockCount: number
  nearExpiryCount: number
  scheduleHCount: number
  manufacturerCount: number
}

export type StockStatus = 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK'

export interface EnrichedProductStockInfo {
  totalAvailableStock: number
  batchCount: number
  earliestExpiry: string | null
  nearExpiryBatchesCount: number
  stockStatus: StockStatus
}

/**
 * Computes live catalog-wide KPI metrics across all products and batches
 */
export async function getCatalogSummaryMetrics(
  branchId?: string,
  organizationId?: string
): Promise<CatalogSummaryMetrics> {
  const ninetyDaysFromNow = new Date()
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90)

  // Fetch all active products with active batches, strictly scoped to organization
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(organizationId ? { organizationId } : {}),
    },
    select: {
      id: true,
      costPrice: true,
      mrp: true,
      minStockLevel: true,
      drugSchedule: true,
      manufacturer: true,
      batches: {
        where: {
          status: 'ACTIVE',
          ...(branchId ? { branchId } : {}),
        },
        select: {
          quantity: true,
          reservedQuantity: true,
          soldQuantity: true,
          purchasePrice: true,
          mrp: true,
          expiryDate: true,
        },
      },
    },
  })

  let totalUnits = 0
  let totalCost = 0
  let totalMrp = 0
  let lowStock = 0
  let outOfStock = 0
  let nearExpiry = 0
  let scheduleH = 0
  const manufacturers = new Set<string>()

  for (const prod of products) {
    if (['H', 'H1', 'X'].includes(prod.drugSchedule)) {
      scheduleH += 1
    }
    if (prod.manufacturer) {
      manufacturers.add(prod.manufacturer)
    }

    const defaultCost = prod.costPrice ? Number(prod.costPrice) : Number(prod.mrp) * 0.75
    const defaultMrp = Number(prod.mrp)
    let prodAvailableStock = 0
    let hasNearExpiryBatch = false

    for (const batch of prod.batches) {
      const avail = Math.max(0, batch.quantity - batch.reservedQuantity - batch.soldQuantity)
      if (avail <= 0) continue

      prodAvailableStock += avail
      totalUnits += avail

      const bCost = batch.purchasePrice ? Number(batch.purchasePrice) : defaultCost
      const bMrp = batch.mrp ? Number(batch.mrp) : defaultMrp

      totalCost += avail * bCost
      totalMrp += avail * bMrp

      if (new Date(batch.expiryDate) <= ninetyDaysFromNow) {
        hasNearExpiryBatch = true
      }
    }

    if (hasNearExpiryBatch && prodAvailableStock > 0) {
      nearExpiry += 1
    }

    if (prodAvailableStock === 0) {
      outOfStock += 1
    } else if (prodAvailableStock <= prod.minStockLevel) {
      lowStock += 1
    }
  }

  totalCost = Math.round(totalCost * 100) / 100
  totalMrp = Math.round(totalMrp * 100) / 100
  const grossProfit = Math.round((totalMrp - totalCost) * 100) / 100
  const marginPercent = totalMrp > 0 ? Math.round(((grossProfit / totalMrp) * 100) * 10) / 10 : 0

  return {
    totalProducts: products.length,
    totalInStockUnits: totalUnits,
    totalValuationCost: totalCost,
    totalValuationMrp: totalMrp,
    overallMarginPercent: marginPercent,
    lowStockCount: lowStock,
    outOfStockCount: outOfStock,
    nearExpiryCount: nearExpiry,
    scheduleHCount: scheduleH,
    manufacturerCount: manufacturers.size,
  }
}

export interface BatchRateRecord {
  id: string
  batchNumber: string
  purchasePrice: number
  mrp: number
  marginPercent: number
  quantity: number
  availableQuantity: number
  expiryDate: string
  manufacturingDate: string | null
  createdAt: string
  status: string
}

export interface ProductRateHistoryReport {
  productId: string
  productName: string
  sku: string
  genericName: string | null
  manufacturer: string | null
  currentMrp: number
  currentCostPrice: number | null
  gstRate: number
  batches: BatchRateRecord[]
  averageCostPrice: number
  averageMarginPercent: number
  priceVariationPercent: number
}

export interface ProductIndentRecommendation {
  productId: string
  productName: string
  sku: string
  currentStock: number
  minStockLevel: number
  suggestedReorderQuantity: number
  estimatedCostPrice: number
  estimatedOrderValue: number
  unitOfMeasure: string
  preferredSupplierId: string | null
}

export async function getProductRateHistory(productId: string): Promise<ProductRateHistoryReport | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      batches: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!product) return null

  const batches: BatchRateRecord[] = product.batches.map((b) => {
    const cost = b.purchasePrice
      ? Number(b.purchasePrice)
      : product.costPrice
      ? Number(product.costPrice)
      : Number(product.mrp) * 0.75
    const mrp = b.mrp ? Number(b.mrp) : Number(product.mrp)
    const profit = mrp - cost
    const margin = mrp > 0 ? Math.round(((profit / mrp) * 100) * 10) / 10 : 0
    const avail = Math.max(0, b.quantity - b.reservedQuantity - b.soldQuantity)

    return {
      id: b.id,
      batchNumber: b.batchNumber,
      purchasePrice: cost,
      mrp,
      marginPercent: margin,
      quantity: b.quantity,
      availableQuantity: avail,
      expiryDate: b.expiryDate.toISOString(),
      manufacturingDate: b.manufacturingDate ? b.manufacturingDate.toISOString() : null,
      createdAt: b.createdAt.toISOString(),
      status: b.status,
    }
  })

  const costs = batches.map((b) => b.purchasePrice)
  const avgCost =
    costs.length > 0
      ? Math.round((costs.reduce((a, b) => a + b, 0) / costs.length) * 100) / 100
      : product.costPrice
      ? Number(product.costPrice)
      : 0
  const margins = batches.map((b) => b.marginPercent)
  const avgMargin =
    margins.length > 0
      ? Math.round((margins.reduce((a, b) => a + b, 0) / margins.length) * 10) / 10
      : 0
  const minCost = costs.length > 0 ? Math.min(...costs) : avgCost
  const maxCost = costs.length > 0 ? Math.max(...costs) : avgCost
  const variation = minCost > 0 ? Math.round((((maxCost - minCost) / minCost) * 100) * 10) / 10 : 0

  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    genericName: product.genericName,
    manufacturer: product.manufacturer,
    currentMrp: Number(product.mrp),
    currentCostPrice: product.costPrice ? Number(product.costPrice) : null,
    gstRate: Number(product.gstRate),
    batches,
    averageCostPrice: avgCost,
    averageMarginPercent: avgMargin,
    priceVariationPercent: variation,
  }
}

export async function calculateProductIndent(productId: string): Promise<ProductIndentRecommendation | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      batches: {
        where: { status: 'ACTIVE' },
      },
    },
  })
  if (!product) return null

  let currentStock = 0
  let latestCost = product.costPrice ? Number(product.costPrice) : Number(product.mrp) * 0.75

  for (const b of product.batches) {
    const avail = Math.max(0, b.quantity - b.reservedQuantity - b.soldQuantity)
    currentStock += avail
    if (b.purchasePrice) latestCost = Number(b.purchasePrice)
  }

  const minLevel = product.minStockLevel ?? 10
  const deficit = Math.max(0, minLevel * 2 - currentStock)
  const suggestedQty = deficit > 0 ? Math.max(deficit, 10) : 0

  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    currentStock,
    minStockLevel: minLevel,
    suggestedReorderQuantity: suggestedQty,
    estimatedCostPrice: latestCost,
    estimatedOrderValue: Math.round(suggestedQty * latestCost * 100) / 100,
    unitOfMeasure: product.unitOfMeasure,
    preferredSupplierId: null,
  }
}

