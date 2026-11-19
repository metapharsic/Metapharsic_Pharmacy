// ─────────────────────────────────────────────────────────────
// Multi-Threaded Inventory Analytics Worker (Node.js Worker Thread)
// Offloads heavy CPU calculation:
// 1. Dead stock detection & aging bracket categorization (60d/90d/180d)
// 2. Vendor-specific stock valuation, credit exposure & return-window rollups
// 3. Rack, Shelf, and Box physical layout tree generation
// ─────────────────────────────────────────────────────────────
const { parentPort } = require('worker_threads')

function getRackCode(r) {
  if (!r) return null
  if (typeof r === 'object') return r.code || null
  return String(r)
}

function getShelfNumber(r, fallbackShelf) {
  if (r && typeof r === 'object' && r.shelfNumber) return String(r.shelfNumber)
  if (fallbackShelf) return String(fallbackShelf)
  return null
}

function getBoxName(product) {
  if (!product) return null
  if (product.box) return String(product.box)
  if (product.rack && typeof product.rack === 'object' && product.rack.description) {
    const parts = product.rack.description.split('›')
    if (parts.length >= 3) return parts[2].trim()
  }
  return null
}

/**
 * Perform dead stock calculation on input data
 */
function computeDeadStock(payload) {
  const { inventories, saleItemsMap, movementsMap, nowTimestamp, thresholdDays = 90 } = payload
  const now = nowTimestamp || Date.now()

  const deadItems = []
  let totalDeadCapitalAtCost = 0
  let totalDeadCapitalAtMrp = 0
  let slowMovingCount = 0
  let deadStockCount = 0
  let obsoleteCount = 0
  let totalAgingItemsCount = 0

  for (const inv of inventories) {
    if (inv.availableQuantity <= 0) continue

    const lastSaleTime = saleItemsMap[inv.productId] || 0
    const lastMovementTime = movementsMap[inv.id] || 0
    let lastActivityTime = Math.max(lastSaleTime, lastMovementTime)

    if (lastActivityTime === 0) {
      const firstBatch = inv.product?.batches?.[0]
      const batchCreatedAt = firstBatch?.createdAt ? new Date(firstBatch.createdAt).getTime() : 0
      const invCreatedAt = inv.createdAt ? new Date(inv.createdAt).getTime() : 0
      lastActivityTime = batchCreatedAt || invCreatedAt || (inv.updatedAt ? new Date(inv.updatedAt).getTime() : now)
    }

    const daysInactive = Math.max(0, Math.floor((now - lastActivityTime) / (1000 * 60 * 60 * 24)))

    // Cost price and MRP fallback
    const costPrice = Number(inv.product.costPrice) || (Number(inv.product.mrp) * 0.7) || 0
    const mrp = Number(inv.product.mrp) || 0
    const capitalLockedAtCost = Math.round(costPrice * inv.availableQuantity * 100) / 100
    const capitalLockedAtMrp = Math.round(mrp * inv.availableQuantity * 100) / 100

    let status = 'HEALTHY'
    if (daysInactive >= 180) {
      status = 'OBSOLETE'
    } else if (daysInactive >= 90) {
      status = 'DEAD_STOCK'
    } else if (daysInactive >= 60) {
      status = 'SLOW_MOVING'
    }

    // Accumulate executive KPI card summary counts across all items with daysInactive >= 60
    if (daysInactive >= 60) {
      totalAgingItemsCount++
      totalDeadCapitalAtCost += capitalLockedAtCost
      totalDeadCapitalAtMrp += capitalLockedAtMrp
      if (status === 'SLOW_MOVING') slowMovingCount++
      else if (status === 'DEAD_STOCK') deadStockCount++
      else if (status === 'OBSOLETE') obsoleteCount++
    }

    // Apply daysInactive >= thresholdDays solely when selecting items for the returned deadItems list
    if (daysInactive >= thresholdDays) {
      const firstBatch = inv.product?.batches?.[0]
      const supplierName =
        firstBatch?.purchase?.supplier?.name ||
        firstBatch?.supplier?.name ||
        firstBatch?.supplierName ||
        firstBatch?.supplierRef ||
        'Direct / Primary'
      const supplierId =
        firstBatch?.purchase?.supplier?.id ||
        firstBatch?.supplier?.id ||
        firstBatch?.supplierId ||
        null

      deadItems.push({
        inventoryId: inv.id,
        productId: inv.productId,
        productName: inv.product.name,
        sku: inv.product.sku,
        barcode: inv.product.barcode || null,
        rack: getRackCode(inv.product.rack),
        shelf: getShelfNumber(inv.product.rack, inv.product.shelf),
        box: getBoxName(inv.product),
        unitOfMeasure: inv.product.unitOfMeasure,
        branchId: inv.branchId,
        branchName: inv.branch?.name,
        availableQuantity: inv.availableQuantity,
        daysInactive,
        status,
        costPrice,
        mrp,
        capitalLockedAtCost,
        capitalLockedAtMrp,
        lastActivityDate: new Date(lastActivityTime).toISOString(),
        supplierName,
        supplierId,
        batchNumber: firstBatch?.batchNumber || null,
        expiryDate: firstBatch?.expiryDate ? new Date(firstBatch.expiryDate).toISOString() : null,
      })
    }
  }

  // Sort by highest capital locked at cost
  deadItems.sort((a, b) => b.capitalLockedAtCost - a.capitalLockedAtCost)

  return {
    deadItems,
    summary: {
      totalDeadItemsCount: totalAgingItemsCount,
      totalDeadCapitalAtCost: Math.round(totalDeadCapitalAtCost * 100) / 100,
      totalDeadCapitalAtMrp: Math.round(totalDeadCapitalAtMrp * 100) / 100,
      slowMovingCount,
      deadStockCount,
      obsoleteCount,
    },
  }
}

/**
 * Perform vendor-specific stock rollup
 */
function computeVendorStock(payload) {
  const { suppliers, batches, nowTimestamp } = payload
  const now = nowTimestamp || Date.now()
  const in60Days = now + 60 * 24 * 60 * 60 * 1000

  const supplierMap = new Map()

  for (const s of suppliers) {
    supplierMap.set(s.id, {
      supplierId: s.id,
      supplierName: s.name,
      contactPerson: s.contactPerson || null,
      phone: s.phone || null,
      email: s.email || null,
      dlNumber: s.dlNumber || null,
      creditDays: s.creditDays || 30,
      outstandingBalance: Number(s.outstandingBalance) || 0,
      totalSkus: 0,
      totalAvailableUnits: 0,
      totalValuationAtCost: 0,
      totalValuationAtMrp: 0,
      nearExpiryUnitsCount: 0,
      nearExpiryValuationAtCost: 0,
      batches: [],
      skuSet: new Set(),
    })
  }

  // Handle batches without explicit supplier
  const defaultSupplierId = 'unknown-vendor'
  supplierMap.set(defaultSupplierId, {
    supplierId: defaultSupplierId,
    supplierName: 'Unassigned / Direct Purchases',
    contactPerson: null,
    phone: null,
    email: null,
    dlNumber: null,
    creditDays: 0,
    outstandingBalance: 0,
    totalSkus: 0,
    totalAvailableUnits: 0,
    totalValuationAtCost: 0,
    totalValuationAtMrp: 0,
    nearExpiryUnitsCount: 0,
    nearExpiryValuationAtCost: 0,
    batches: [],
    skuSet: new Set(),
  })

  for (const b of batches) {
    const sId = b.purchase?.supplierId || b.purchase?.supplier?.id || b.supplierId || defaultSupplierId
    let vendor = supplierMap.get(sId)
    if (!vendor) {
      vendor = supplierMap.get(defaultSupplierId)
    }

    const cost = Number(b.purchasePrice) || 0
    const mrp = Number(b.mrp) || 0
    const available = b.quantity - (b.reservedQuantity || 0) - (b.soldQuantity || 0)

    if (available > 0) {
      vendor.skuSet.add(b.productId)
      vendor.totalAvailableUnits += available
      vendor.totalValuationAtCost += cost * available
      vendor.totalValuationAtMrp += mrp * available

      const expTime = new Date(b.expiryDate).getTime()
      const isNearExpiry = expTime <= in60Days && expTime >= now

      if (isNearExpiry) {
        vendor.nearExpiryUnitsCount += available
        vendor.nearExpiryValuationAtCost += cost * available
      }

      vendor.batches.push({
        id: b.id,
        batchNumber: b.batchNumber,
        productId: b.productId,
        productName: b.product?.name || 'Unknown',
        sku: b.product?.sku || '',
        rack: getRackCode(b.product?.rack),
        shelf: getShelfNumber(b.product?.rack, b.product?.shelf),
        box: b.product?.box || null,
        expiryDate: b.expiryDate,
        isNearExpiry,
        costPrice: cost,
        mrp,
        availableQuantity: available,
        supplierRef: b.supplierRef || null,
      })
    }
  }

  const result = []
  for (const v of supplierMap.values()) {
    if (v.totalAvailableUnits > 0 || v.batches.length > 0) {
      result.push({
        supplierId: v.supplierId,
        supplierName: v.supplierName,
        contactPerson: v.contactPerson,
        phone: v.phone,
        email: v.email,
        dlNumber: v.dlNumber,
        creditDays: v.creditDays,
        outstandingBalance: v.outstandingBalance,
        totalSkus: v.skuSet.size,
        totalAvailableUnits: v.totalAvailableUnits,
        totalValuationAtCost: Math.round(v.totalValuationAtCost * 100) / 100,
        totalValuationAtMrp: Math.round(v.totalValuationAtMrp * 100) / 100,
        nearExpiryUnitsCount: v.nearExpiryUnitsCount,
        nearExpiryValuationAtCost: Math.round(v.nearExpiryValuationAtCost * 100) / 100,
        batches: v.batches.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()),
      })
    }
  }

  result.sort((a, b) => b.totalValuationAtCost - a.totalValuationAtCost)
  return result
}

/**
 * Perform Rack, Shelf, and Box physical layout tree generation
 */
function computeRackBoxMatrix(payload) {
  const { products } = payload
  const rackMap = new Map()
  const unassigned = []

  for (const p of products) {
    const availableStock = p.inventory?.reduce((s, i) => s + (i.availableQuantity || 0), 0) || 0
    const mrp = Number(p.mrp) || 0
    const costPrice = Number(p.costPrice) || (Number(p.ptr) || Math.round(mrp * 0.75 * 100) / 100)
    const totalMrpValue = Math.round(mrp * availableStock * 100) / 100
    const totalCostValue = Math.round(costPrice * availableStock * 100) / 100

    const rackCode = getRackCode(p.rack)
    const shelfNum = getShelfNumber(p.rack, p.shelf)

    if (!rackCode) {
      unassigned.push({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        unitOfMeasure: p.unitOfMeasure,
        mrp,
        costPrice,
        totalStock: availableStock,
        totalMrpValue,
        totalCostValue,
      })
      continue
    }

    const rackKey = rackCode.trim().toUpperCase()
    if (!rackMap.has(rackKey)) {
      rackMap.set(rackKey, {
        rackName: rackKey,
        shelves: new Map(),
        totalProducts: 0,
        totalUnits: 0,
        totalValuationAtMrp: 0,
        totalValuationAtCost: 0,
      })
    }

    const rackObj = rackMap.get(rackKey)
    const shelfKey = (shelfNum || 'General Shelf').trim()
    if (!rackObj.shelves.has(shelfKey)) {
      rackObj.shelves.set(shelfKey, {
        shelfName: shelfKey,
        boxes: new Map(),
        shelfUnits: 0,
        totalValuationAtMrp: 0,
        totalValuationAtCost: 0,
      })
    }

    const shelfObj = rackObj.shelves.get(shelfKey)
    const boxKey = (p.box || 'Main Bin').trim()
    if (!shelfObj.boxes.has(boxKey)) {
      shelfObj.boxes.set(boxKey, {
        boxName: boxKey,
        products: [],
        boxUnits: 0,
        totalValuationAtMrp: 0,
        totalValuationAtCost: 0,
      })
    }

    const boxObj = shelfObj.boxes.get(boxKey)

    boxObj.products.push({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      rack: p.rack,
      shelf: p.shelf,
      box: p.box,
      mrp,
      costPrice,
      availableStock,
      reorderLevel: p.reorderLevel,
      totalMrpValue,
      totalCostValue,
    })

    boxObj.boxUnits += availableStock
    boxObj.totalValuationAtMrp += totalMrpValue
    boxObj.totalValuationAtCost += totalCostValue

    shelfObj.shelfUnits += availableStock
    shelfObj.totalValuationAtMrp += totalMrpValue
    shelfObj.totalValuationAtCost += totalCostValue

    rackObj.totalProducts += 1
    rackObj.totalUnits += availableStock
    rackObj.totalValuationAtMrp += totalMrpValue
    rackObj.totalValuationAtCost += totalCostValue
  }

  // Format into clean serializable tree
  const racks = []
  for (const [rName, rData] of rackMap.entries()) {
    const shelves = []
    for (const [sName, sData] of rData.shelves.entries()) {
      const boxes = []
      for (const [bName, bData] of sData.boxes.entries()) {
        boxes.push({
          boxName: bName,
          productCount: bData.products.length,
          totalUnits: bData.boxUnits,
          totalValuationAtMrp: Math.round(bData.totalValuationAtMrp * 100) / 100,
          totalValuationAtCost: Math.round(bData.totalValuationAtCost * 100) / 100,
          products: bData.products,
        })
      }
      shelves.push({
        shelfName: sName,
        totalUnits: sData.shelfUnits,
        totalValuationAtMrp: Math.round(sData.totalValuationAtMrp * 100) / 100,
        totalValuationAtCost: Math.round(sData.totalValuationAtCost * 100) / 100,
        boxes,
      })
    }
    racks.push({
      rackName: rName,
      totalProducts: rData.totalProducts,
      totalUnits: rData.totalUnits,
      totalValuationAtMrp: Math.round(rData.totalValuationAtMrp * 100) / 100,
      totalValuationAtCost: Math.round(rData.totalValuationAtCost * 100) / 100,
      shelves,
    })
  }

  racks.sort((a, b) => a.rackName.localeCompare(b.rackName))

  return {
    racks,
    unassignedCount: unassigned.length,
    unassignedProducts: unassigned,
  }
}

/**
 * Perform multi-threaded stock adjustment analytics:
 * Calculates real-time cost impact, MRP impact, near-expiry flags, and dead stock correlations
 */
function computeAdjustmentAnalytics(payload) {
  const { adjustments = [], nowTimestamp = Date.now(), deadProductIds = [] } = payload
  const deadSet = new Set(deadProductIds)
  const now = new Date(nowTimestamp)
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  let totalQty = 0
  let totalCostImpact = 0
  let totalMrpImpact = 0
  let nearExpiryCount = 0
  let deadStockCount = 0
  let boxDiscrepancyCount = 0

  const enriched = adjustments.map((adj) => {
    const qty = adj.quantity || 0
    totalQty += qty

    // Determine unit cost and MRP with cascade fallback
    const unitCost = adj.batch?.purchasePrice != null
      ? Number(adj.batch.purchasePrice)
      : (adj.product?.costPrice != null
          ? Number(adj.product.costPrice)
          : (Number(adj.product?.mrp || 0) * 0.7))
    const unitMrp = adj.batch?.mrp != null
      ? Number(adj.batch.mrp)
      : Number(adj.product?.mrp || 0)

    const costImpact = Math.round(qty * unitCost * 100) / 100
    const mrpImpact = Math.round(qty * unitMrp * 100) / 100

    totalCostImpact += costImpact
    totalMrpImpact += mrpImpact

    // Expiry check (<90 days or already past expiry)
    let isNearExpiry = false
    if (adj.batch?.expiryDate) {
      const expDate = new Date(adj.batch.expiryDate)
      if (expDate <= ninetyDaysFromNow) {
        isNearExpiry = true
        nearExpiryCount++
      }
    }

    // Dead stock check (product inactive in sales & movements)
    const isDeadStock = deadSet.has(adj.productId)
    if (isDeadStock) {
      deadStockCount++
    }

    // Physical count discrepancy on mapped physical storage coordinates
    const adjRack = getRackCode(adj.product?.rack)
    if (adj.adjustmentType === 'PHYSICAL_COUNT' && (adj.product?.box || adjRack)) {
      boxDiscrepancyCount++
    }

    return {
      ...adj,
      costImpact,
      mrpImpact,
      isNearExpiry,
      isDeadStock,
    }
  })

  return {
    items: enriched,
    summary: {
      totalCount: adjustments.length,
      netQuantity: totalQty,
      netCostImpact: Math.round(totalCostImpact * 100) / 100,
      netMrpImpact: Math.round(totalMrpImpact * 100) / 100,
      nearExpiryCount,
      deadStockCount,
      boxDiscrepancyCount,
    },
  }
}

/**
 * Perform multi-threaded inventory movement analytics:
 * Calculates Inflow/Outflow velocity, Rack & Box activity, FEFO near-expiry warnings,
 * dead stock movements, and vendor-specific share.
 */
function computeMovementAnalytics(payload) {
  const { movements = [], nowTimestamp = Date.now(), deadProductIds = [] } = payload
  const deadSet = new Set(deadProductIds)
  const now = new Date(nowTimestamp)
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  let inflowCount = 0
  let inflowUnits = 0
  let inflowValuationAtCost = 0

  let outflowCount = 0
  let outflowUnits = 0
  let outflowValuationAtCost = 0
  let outflowValuationAtMrp = 0

  let transferCount = 0
  let transferUnits = 0

  let adjustmentCount = 0
  let adjustmentUnits = 0

  let rackBoxActivityCount = 0
  let nearExpiryCount = 0
  let expiredCount = 0
  let deadStockCount = 0

  const vendorMap = new Map()
  const locationMap = new Map()

  const enriched = movements.map((m) => {
    const qty = m.quantity || 0
    const absQty = Math.abs(qty)
    const product = m.inventory?.product || {}
    const batch = m.batch || {}

    // Unit Cost and MRP fallback
    const unitCost = batch.purchasePrice != null
      ? Number(batch.purchasePrice)
      : (product.costPrice != null
          ? Number(product.costPrice)
          : (Number(product.mrp || 0) * 0.7))
    const unitMrp = batch.mrp != null
      ? Number(batch.mrp)
      : Number(product.mrp || 0)

    const costValuation = Math.round(absQty * unitCost * 100) / 100
    const mrpValuation = Math.round(absQty * unitMrp * 100) / 100

    // Inflow vs Outflow categorization
    if (m.type === 'IN' || m.type === 'RETURN_IN') {
      inflowCount++
      inflowUnits += absQty
      inflowValuationAtCost += costValuation
    } else if (m.type === 'OUT' || m.type === 'RETURN_OUT' || m.type === 'WRITE_OFF') {
      outflowCount++
      outflowUnits += absQty
      outflowValuationAtCost += costValuation
      outflowValuationAtMrp += mrpValuation
    } else if (m.type === 'TRANSFER') {
      transferCount++
      transferUnits += absQty
    } else if (m.type === 'ADJUSTMENT') {
      adjustmentCount++
      adjustmentUnits += absQty
    }

    // Rack & Box physical storage tracking
    const rack = getRackCode(product.rack)
    const shelf = getShelfNumber(product.rack, product.shelf)
    const box = product.box || null
    const hasPhysicalStorage = Boolean(rack || shelf || box)
    if (hasPhysicalStorage || m.type === 'TRANSFER' || m.referenceType === 'BOX_RELOCATION') {
      rackBoxActivityCount++
    }

    if (rack || box) {
      const locKey = [rack, shelf, box].filter(Boolean).join(' > ')
      const cur = locationMap.get(locKey) || 0
      locationMap.set(locKey, cur + 1)
    }

    // Expiry & FEFO Radar
    let isNearExpiry = false
    let isExpired = false
    let daysToExpiry = null

    if (batch.expiryDate) {
      const expDate = new Date(batch.expiryDate)
      daysToExpiry = Math.floor((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (expDate <= now) {
        isExpired = true
        expiredCount++
      } else if (expDate <= ninetyDaysFromNow) {
        isNearExpiry = true
        nearExpiryCount++
      }
    }

    // Dead Stock check
    const isDeadStock = deadSet.has(product.id || m.inventory?.productId)
    if (isDeadStock) {
      deadStockCount++
    }

    // Vendor / Supplier tracking
    const supplier = batch.supplier || null
    const supplierId = batch.supplierId || supplier?.id || 'DIRECT'
    const supplierName = supplier?.name || (batch.supplierRef ? `Ref: ${batch.supplierRef}` : 'Direct Wholesaler')

    const vData = vendorMap.get(supplierName) || {
      supplierId,
      supplierName,
      movementCount: 0,
      units: 0,
      valuation: 0,
    }
    vData.movementCount++
    vData.units += absQty
    vData.valuation += costValuation
    vendorMap.set(supplierName, vData)

    return {
      ...m,
      unitCost,
      unitMrp,
      costValuation,
      mrpValuation,
      isNearExpiry,
      isExpired,
      daysToExpiry,
      isDeadStock,
      supplierName,
      supplierId,
      rack,
      shelf,
      box,
    }
  })

  // Top vendors by movement volume
  const topVendors = Array.from(vendorMap.values())
    .sort((a, b) => b.units - a.units)
    .slice(0, 5)
    .map((v) => ({ ...v, valuation: Math.round(v.valuation * 100) / 100 }))

  // Top locations
  const topStorageLocations = Array.from(locationMap.entries())
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // FEFO compliance score
  const stockOuts = outflowCount
  const fefoViolations = expiredCount
  const fefoComplianceScore = stockOuts > 0 ? Math.max(0, Math.round(((stockOuts - fefoViolations) / stockOuts) * 1000) / 10) : 100

  return {
    items: enriched,
    summary: {
      totalCount: movements.length,
      inflowCount,
      inflowUnits,
      inflowValuationAtCost: Math.round(inflowValuationAtCost * 100) / 100,
      outflowCount,
      outflowUnits,
      outflowValuationAtCost: Math.round(outflowValuationAtCost * 100) / 100,
      outflowValuationAtMrp: Math.round(outflowValuationAtMrp * 100) / 100,
      transferCount,
      transferUnits,
      adjustmentCount,
      adjustmentUnits,
      rackBoxActivityCount,
      nearExpiryCount,
      expiredCount,
      deadStockCount,
      vendorCount: vendorMap.size,
      fefoComplianceScore,
      topVendors,
      topStorageLocations,
    },
  }
}

/**
 * Perform high-standard Batch analytics:
 * - FEFO urgency distribution (Critical ≤30d, Warning ≤60d, Info ≤90d, Healthy >90d, Expired)
 * - Rack > Shelf > Box physical storage assignment mapping
 * - Dead stock capital lockup in batches
 * - Vendor exposure and stock valuation
 */
function computeBatchAnalytics(payload) {
  const { batches = [], deadProductIds = [], nowTimestamp } = payload
  const now = nowTimestamp ? new Date(nowTimestamp) : new Date()
  const deadSet = new Set(deadProductIds)

  let criticalCount = 0      // <= 30 days
  let warningCount = 0       // 31 - 60 days
  let infoCount = 0          // 61 - 90 days
  let healthyCount = 0       // > 90 days
  let expiredCount = 0       // <= 0 days (or status === 'EXPIRED')
  let quarantinedCount = 0   // status === 'BLOCKED'
  let exhaustedCount = 0     // status === 'EXHAUSTED'

  let totalUnits = 0
  let totalAvailableUnits = 0
  let totalValuationAtCost = 0
  let totalValuationAtMrp = 0
  let nearExpiryValuationAtCost = 0
  let expiredValuationAtCost = 0

  let rackBoxAssignedCount = 0
  let unassignedStorageCount = 0

  let deadStockBatchesCount = 0
  let deadStockValuationAtCost = 0

  const locationMap = new Map()
  const vendorMap = new Map()

  const enriched = batches.map((b) => {
    const qty = Number(b.quantity) || 0
    const avail = b.availableQuantity !== undefined
      ? Number(b.availableQuantity)
      : Math.max(0, qty - (Number(b.reservedQuantity) || 0) - (Number(b.soldQuantity) || 0))

    const costPrice = Number(b.purchasePrice) || Number(b.product?.costPrice) || (Number(b.mrp) * 0.7) || 0
    const mrp = Number(b.mrp) || Number(b.product?.mrp) || 0

    const valuationCost = Math.round(costPrice * avail * 100) / 100
    const valuationMrp = Math.round(mrp * avail * 100) / 100

    totalUnits += qty
    totalAvailableUnits += avail
    totalValuationAtCost += valuationCost
    totalValuationAtMrp += valuationMrp

    // Expiry calculation
    const expDate = b.expiryDate ? new Date(b.expiryDate) : null
    let daysUntilExpiry = 9999
    let fefoTier = 'HEALTHY'

    if (expDate) {
      daysUntilExpiry = Math.floor((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntilExpiry < 0 || b.status === 'EXPIRED') {
        fefoTier = 'EXPIRED'
        expiredCount++
        expiredValuationAtCost += valuationCost
      } else if (daysUntilExpiry <= 30) {
        fefoTier = 'CRITICAL'
        criticalCount++
        nearExpiryValuationAtCost += valuationCost
      } else if (daysUntilExpiry <= 60) {
        fefoTier = 'WARNING'
        warningCount++
        nearExpiryValuationAtCost += valuationCost
      } else if (daysUntilExpiry <= 90) {
        fefoTier = 'INFO'
        infoCount++
        nearExpiryValuationAtCost += valuationCost
      } else {
        fefoTier = 'HEALTHY'
        healthyCount++
      }
    }

    if (b.status === 'BLOCKED') quarantinedCount++
    if (b.status === 'EXHAUSTED') exhaustedCount++

    // Dead stock correlation
    const isDeadStock = deadSet.has(b.productId || b.product?.id)
    if (isDeadStock && avail > 0) {
      deadStockBatchesCount++
      deadStockValuationAtCost += valuationCost
    }

    // Physical Storage (Rack > Shelf > Box)
    const rack = getRackCode(b.product?.rack)
    const shelf = getShelfNumber(b.product?.rack, b.product?.shelf)
    const box = b.product?.box || null
    const hasStorage = Boolean(rack || box)
    if (hasStorage) {
      rackBoxAssignedCount++
      const locKey = [rack, shelf, box].filter(Boolean).join(' > ')
      const cur = locationMap.get(locKey) || { location: locKey, count: 0, units: 0, valuation: 0 }
      cur.count++
      cur.units += avail
      cur.valuation += valuationCost
      locationMap.set(locKey, cur)
    } else {
      unassignedStorageCount++
    }

    // Vendor / Supplier tracking
    const supplier = b.supplier || null
    const supplierName = supplier?.name || (b.supplierRef ? `Ref: ${b.supplierRef}` : 'Direct Wholesaler')
    const supplierId = supplier?.id || b.supplierId || null

    const vData = vendorMap.get(supplierName) || {
      supplierId,
      supplierName,
      batchCount: 0,
      units: 0,
      valuation: 0,
      nearExpiryCount: 0,
    }
    vData.batchCount++
    vData.units += avail
    vData.valuation += valuationCost
    if (['CRITICAL', 'WARNING', 'INFO'].includes(fefoTier)) {
      vData.nearExpiryCount++
    }
    vendorMap.set(supplierName, vData)

    return {
      ...b,
      rack,
      shelf,
      box,
      supplierName,
      supplierId,
      daysUntilExpiry,
      fefoTier,
      isDeadStock,
      valuationAtCost: valuationCost,
      valuationAtMrp: valuationMrp,
    }
  })

  // Top vendors sorted by valuation
  const topVendors = Array.from(vendorMap.values())
    .map((v) => ({ ...v, valuation: Math.round(v.valuation * 100) / 100 }))
    .sort((a, b) => b.valuation - a.valuation)
    .slice(0, 5)

  // Top storage locations
  const topStorageLocations = Array.from(locationMap.values())
    .map((l) => ({ ...l, valuation: Math.round(l.valuation * 100) / 100 }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 5)

  return {
    items: enriched,
    summary: {
      totalBatchesCount: batches.length,
      totalUnits,
      totalAvailableUnits,
      totalValuationAtCost: Math.round(totalValuationAtCost * 100) / 100,
      totalValuationAtMrp: Math.round(totalValuationAtMrp * 100) / 100,
      criticalCount,
      warningCount,
      infoCount,
      healthyCount,
      expiredCount,
      quarantinedCount,
      exhaustedCount,
      nearExpiryValuationAtCost: Math.round(nearExpiryValuationAtCost * 100) / 100,
      expiredValuationAtCost: Math.round(expiredValuationAtCost * 100) / 100,
      deadStockBatchesCount,
      deadStockValuationAtCost: Math.round(deadStockValuationAtCost * 100) / 100,
      rackBoxAssignedCount,
      unassignedStorageCount,
      topVendors,
      topStorageLocations,
    },
  }
}

// ─── Worker Event Listener ────────────────────────────────────
if (parentPort) {
  parentPort.on('message', (message) => {
    try {
      const { id, command, payload } = message
      let result = null

      if (command === 'ANALYZE_DEAD_STOCK') {
        result = computeDeadStock(payload)
      } else if (command === 'ANALYZE_VENDOR_STOCK') {
        result = computeVendorStock(payload)
      } else if (command === 'ANALYZE_LOCATION_MATRIX') {
        result = computeRackBoxMatrix(payload)
      } else if (command === 'ANALYZE_ADJUSTMENTS') {
        result = computeAdjustmentAnalytics(payload)
      } else if (command === 'ANALYZE_MOVEMENTS') {
        result = computeMovementAnalytics(payload)
      } else if (command === 'ANALYZE_BATCHES') {
        result = computeBatchAnalytics(payload)
      } else {
        throw new Error(`Unknown worker command: ${command}`)
      }

      parentPort.postMessage({ id, success: true, data: result })
    } catch (err) {
      parentPort.postMessage({
        id: message?.id,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })
}

module.exports = {
  computeDeadStock,
  computeVendorStock,
  computeRackBoxMatrix,
  computeAdjustmentAnalytics,
  computeMovementAnalytics,
  computeBatchAnalytics,
}


