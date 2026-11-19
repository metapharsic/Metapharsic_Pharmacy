// ─────────────────────────────────────────────────────────────
// Multi-Threaded Purchase Analytics Worker (Node.js Worker Thread)
// Offloads heavy calculations:
// 1. Pipeline rollups (PRs, POs, GRNs, Invoices, Payables Ageing)
// 2. Intelligent Auto-Reorder & Stockout Risk Forecasting
// 3. Supplier Quotation Matrix & Effective Landed Cost Comparison
// ─────────────────────────────────────────────────────────────
const { parentPort } = require('worker_threads')

/**
 * 1. Compute Pipeline Overview
 */
function computePurchasePipeline(payload) {
  const { purchases = [], suppliers = [], inventoryMovements = [], nowTimestamp } = payload
  const now = nowTimestamp || Date.now()

  let totalPoValue = 0
  let draftCount = 0
  let orderedCount = 0
  let partiallyReceivedCount = 0
  let receivedCount = 0
  let invoicedCount = 0
  let cancelledCount = 0

  let totalOutstandingPayables = 0
  let dueWithin7Days = 0
  let dueWithin15Days = 0
  let dueWithin30Days = 0
  let overduePayables = 0

  for (const p of purchases) {
    const total = Number(p.totalAmount) || 0
    const balance = Number(p.balanceDue) || 0
    totalPoValue += total

    if (p.status === 'DRAFT') draftCount++
    else if (p.status === 'ORDERED') orderedCount++
    else if (p.status === 'PARTIALLY_RECEIVED') partiallyReceivedCount++
    else if (p.status === 'RECEIVED') receivedCount++
    else if (p.status === 'INVOICED') invoicedCount++
    else if (p.status === 'CANCELLED') cancelledCount++

    // Payables ageing
    if (balance > 0) {
      totalOutstandingPayables += balance
      const invoiceDate = p.invoiceDate ? new Date(p.invoiceDate).getTime() : new Date(p.purchaseDate).getTime()
      const creditDays = p.supplier?.creditDays || 30
      const dueDate = invoiceDate + creditDays * 24 * 60 * 60 * 1000
      const daysUntilDue = Math.floor((dueDate - now) / (1000 * 60 * 60 * 24))

      if (daysUntilDue < 0) {
        overduePayables += balance
      } else if (daysUntilDue <= 7) {
        dueWithin7Days += balance
      } else if (daysUntilDue <= 15) {
        dueWithin15Days += balance
      } else {
        dueWithin30Days += balance
      }
    }
  }

  // Supplier exposure ranking
  const supplierExposure = suppliers
    .map((s) => ({
      id: s.id,
      name: s.name,
      creditDays: s.creditDays || 30,
      outstandingBalance: Number(s.outstandingBalance) || 0,
      gstin: s.gstin || null,
      dlNumber: s.dlNumber || null,
    }))
    .sort((a, b) => b.outstandingBalance - a.outstandingBalance)
    .slice(0, 5)

  // Generate operational fast-track actions for chemist
  const urgentActions = []
  const firstOrderedPo = purchases.find((p) => p.status === 'ORDERED' || p.status === 'PARTIALLY_RECEIVED')
  if (firstOrderedPo) {
    urgentActions.push({
      type: 'GRN_PENDING',
      title: 'Goods Arrived at Receiving Dock',
      description: `${firstOrderedPo.purchaseNumber} from ${firstOrderedPo.supplier?.name || 'Distributor'} awaiting physical batch inspection`,
      poId: firstOrderedPo.id,
      purchaseNumber: firstOrderedPo.purchaseNumber,
      actionLabel: 'Inspect & Receive GRN',
      targetStage: 'receipts',
      priority: 'HIGH',
    })
  }

  const firstReceivedPo = purchases.find((p) => p.status === 'RECEIVED')
  if (firstReceivedPo) {
    urgentActions.push({
      type: 'MATCH_PENDING',
      title: `${receivedCount} Receipts Awaiting 3-Way Match`,
      description: `Physical goods verified. Match supplier invoice before payment liability posting (e.g. ${firstReceivedPo.purchaseNumber})`,
      poId: firstReceivedPo.id,
      purchaseNumber: firstReceivedPo.purchaseNumber,
      actionLabel: 'Launch 3-Way Match',
      targetStage: 'invoices',
      priority: 'MEDIUM',
    })
  }

  const prCountNum = Number(payload.prCount) || 0
  if (prCountNum > 0) {
    urgentActions.push({
      type: 'PR_PENDING',
      title: `${prCountNum} Requisitions Awaiting Approval`,
      description: 'Internal branch stock replenishment requests awaiting purchase manager authorization',
      actionLabel: 'Review Requisitions',
      targetStage: 'requisitions',
      priority: 'URGENT',
    })
  }

  return {
    totalPoCount: purchases.length,
    totalPoValue: Math.round(totalPoValue * 100) / 100,
    statusBreakdown: {
      draft: draftCount,
      ordered: orderedCount,
      partiallyReceived: partiallyReceivedCount,
      received: receivedCount,
      invoiced: invoicedCount,
      cancelled: cancelledCount,
    },
    counts: {
      requisitionsPending: prCountNum,
      quotesActive: Number(payload.quoteCount) || 0,
      ordersOpen: orderedCount,
      pendingReceival: orderedCount + partiallyReceivedCount,
      pendingInvoicing: receivedCount,
      overduePayables: overduePayables > 0 ? 1 : 0,
      pendingReturns: Number(payload.returnCount) || 0,
      suppliersCount: Number(payload.totalSuppliersCount) || suppliers.length || 0,
    },
    payables: {
      totalOutstanding: Math.round(totalOutstandingPayables * 100) / 100,
      dueWithin7Days: Math.round(dueWithin7Days * 100) / 100,
      dueWithin15Days: Math.round(dueWithin15Days * 100) / 100,
      dueWithin30Days: Math.round(dueWithin30Days * 100) / 100,
      overdue: Math.round(overduePayables * 100) / 100,
    },
    topSupplierExposure: supplierExposure,
    urgentActions,
  }
}

/**
 * 2. Intelligent Auto-Reorder & Stockout Risk Calculation
 * Target Stock = ADS * Target Days
 * Suggested Order = Target Stock - Available Stock - Open PO Qty
 */
function computeReorderSuggestions(payload) {
  const { candidates = [], sales30Days = [], targetDays = 15 } = payload

  // Map 30-day sales velocity per product
  const salesMap = new Map()
  for (const s of sales30Days) {
    const cur = salesMap.get(s.productId) || 0
    salesMap.set(s.productId, cur + Number(s.quantity))
  }

  const suggestions = candidates.map((item) => {
    const totalSold30Days = salesMap.get(item.productId) || 0
    const avgDailySales = Math.max(0.1, Math.round((totalSold30Days / 30) * 10) / 10) // minimum 0.1 to avoid div by zero
    const available = Number(item.availableQuantity) || 0
    const openPoQty = Number(item.pendingPoQuantity) || 0

    // Buffer target based on daily velocity
    const targetStock = Math.ceil(avgDailySales * targetDays)
    const netDeficit = targetStock - available - openPoQty
    const suggestedQuantity = Math.max(0, netDeficit > 0 ? netDeficit : 0)

    let urgency = 'NORMAL'
    if (available === 0) urgency = 'CRITICAL'
    else if (available <= Number(item.minStockLevel || item.reorderLevel / 2)) urgency = 'URGENT'

    const unitCost = Number(item.costPrice) || (Number(item.mrp) * 0.7) || 0
    const estimatedCost = Math.round(suggestedQuantity * unitCost * 100) / 100

    return {
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      barcode: item.barcode,
      unitOfMeasure: item.unitOfMeasure,
      availableQuantity: available,
      minStockLevel: item.minStockLevel || 10,
      reorderLevel: item.reorderLevel || 20,
      avgDailySales,
      targetDays,
      targetStock,
      openPoQty,
      suggestedQuantity,
      unitCost,
      estimatedCost,
      urgency,
      preferredSupplierId: item.preferredSupplierId || null,
      preferredSupplierName: item.preferredSupplierName || 'Primary Wholesaler',
    }
  })

  // Filter items where replenishment is actually recommended
  const actionable = suggestions.filter((s) => s.suggestedQuantity > 0)
  actionable.sort((a, b) => {
    const urgencyOrder = { CRITICAL: 0, URGENT: 1, NORMAL: 2 }
    return (urgencyOrder[a.urgency] ?? 2) - (urgencyOrder[b.urgency] ?? 2)
  })

  const totalEstimatedCost = actionable.reduce((sum, s) => sum + s.estimatedCost, 0)

  return {
    items: actionable,
    summary: {
      totalCandidatesCount: actionable.length,
      criticalCount: actionable.filter((i) => i.urgency === 'CRITICAL').length,
      urgentCount: actionable.filter((i) => i.urgency === 'URGENT').length,
      normalCount: actionable.filter((i) => i.urgency === 'NORMAL').length,
      totalSuggestedUnits: actionable.reduce((sum, s) => sum + s.suggestedQuantity, 0),
      totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
    },
  }
}

/**
 * 3. Supplier Quotation Matrix & Effective Landed Cost
 */
function computeQuotationComparison(payload) {
  const { quotations = [] } = payload

  const evaluated = quotations.map((q) => {
    const paidQty = Number(q.paidQuantity) || 0
    const freeQty = Number(q.freeQuantity) || 0
    const totalUnits = paidQty + freeQty

    const unitRate = Number(q.basicRate) || 0
    const discountPct = Number(q.discountPercent) || 0
    const taxPct = Number(q.taxPercent) || 0
    const freight = Number(q.freightCharges) || 0

    const basicTotal = paidQty * unitRate
    const discountAmount = basicTotal * (discountPct / 100)
    const taxableAmount = basicTotal - discountAmount
    const taxAmount = taxableAmount * (taxPct / 100)
    const totalNetPayable = Math.round((taxableAmount + taxAmount + freight) * 100) / 100

    const effectiveLandedCost = totalUnits > 0
      ? Math.round((totalNetPayable / totalUnits) * 100) / 100
      : unitRate

    // Commercial risk evaluation:
    // Factors: Short shelf life (< 12 months), Long lead time (> 4 days), Short credit period (< 15 days)
    let riskScore = 100
    const shelfLifeMonths = Number(q.remainingShelfLifeMonths) || 24
    const leadTimeDays = Number(q.leadTimeDays) || 2
    const creditDays = Number(q.creditDays) || 30

    if (shelfLifeMonths < 6) riskScore -= 40
    else if (shelfLifeMonths < 12) riskScore -= 20

    if (leadTimeDays > 5) riskScore -= 20
    else if (leadTimeDays > 3) riskScore -= 10

    if (creditDays < 15) riskScore -= 15

    let riskRating = 'LOW'
    if (riskScore < 50) riskRating = 'HIGH'
    else if (riskScore < 75) riskRating = 'MODERATE'

    return {
      ...q,
      totalUnits,
      basicTotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      totalNetPayable,
      effectiveLandedCost,
      riskScore,
      riskRating,
    }
  })

  // Sort by lowest effective landed cost
  evaluated.sort((a, b) => a.effectiveLandedCost - b.effectiveLandedCost)

  const bestValueSupplier = evaluated.length > 0 ? evaluated[0] : null

  return {
    quotations: evaluated,
    recommendedSupplierId: bestValueSupplier ? bestValueSupplier.supplierId : null,
    recommendationReason: bestValueSupplier
      ? `Best effective landed cost ₹${bestValueSupplier.effectiveLandedCost}/unit with ${bestValueSupplier.riskRating.toLowerCase()} commercial risk (${bestValueSupplier.totalUnits} units including ${bestValueSupplier.freeQuantity} free)`
      : null,
  }
}

// ─── Worker Event Listener ────────────────────────────────────
if (parentPort) {
  parentPort.on('message', (message) => {
    try {
      const { id, command, payload } = message
      let result = null

      if (command === 'ANALYZE_PURCHASE_PIPELINE') {
        result = computePurchasePipeline(payload)
      } else if (command === 'ANALYZE_REORDER_SUGGESTIONS') {
        result = computeReorderSuggestions(payload)
      } else if (command === 'COMPARE_QUOTATIONS') {
        result = computeQuotationComparison(payload)
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
  computePurchasePipeline,
  computeReorderSuggestions,
  computeQuotationComparison,
}
