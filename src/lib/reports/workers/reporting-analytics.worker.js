// ─────────────────────────────────────────────────────────────
// Multi-Threaded Reporting Analytics Worker (Node.js Worker Thread)
// Offloads heavy CPU-bound report aggregations and statutory audits:
// 1. Sales financials & daily business-day bucketing
// 2. Gross profit, COGS & category margin calculations
// 3. Statutory Schedule H / H1 compliance auditing & flags
// 4. Doctor referral conversion & commission aggregation
// ─────────────────────────────────────────────────────────────
const { parentPort } = require('worker_threads')

function roundTwo(num) {
  return Math.round((Number(num) || 0) * 100) / 100
}

/**
 * Format a Date object to YYYY-MM-DD in the target IANA timezone
 */
function toBusinessDayString(dateInput, timeZone) {
  try {
    const d = new Date(dateInput)
    if (isNaN(d.getTime())) return 'UNKNOWN_DATE'
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  } catch {
    return new Date(dateInput).toISOString().split('T')[0]
  }
}

/**
 * Task 1: Compute Sales Financials & Daily Breakdown
 */
function computeSalesFinancials(payload) {
  const { sales, timeZone = 'Asia/Kolkata', excludedSalesCount = 0 } = payload

  let totalRevenue = 0
  let totalTax = 0
  let totalDiscount = 0
  let totalSalesCount = 0

  const dailyMap = {}

  for (let i = 0; i < sales.length; i++) {
    const sale = sales[i]
    if (sale.status !== 'COMPLETED') continue

    const rev = Number(sale.totalAmount) || 0
    const tax = Number(sale.taxAmount) || 0
    const disc = Number(sale.discountAmount) || 0

    totalRevenue += rev
    totalTax += tax
    totalDiscount += disc
    totalSalesCount += 1

    const dayKey = toBusinessDayString(sale.saleDate, timeZone)
    if (!dailyMap[dayKey]) {
      dailyMap[dayKey] = {
        date: dayKey,
        salesCount: 0,
        revenue: 0,
        tax: 0,
        discount: 0,
      }
    }

    const bucket = dailyMap[dayKey]
    bucket.salesCount += 1
    bucket.revenue += rev
    bucket.tax += tax
    bucket.discount += disc
  }

  // Format daily breakdown rows
  const dailyBreakdown = Object.values(dailyMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      salesCount: d.salesCount,
      revenue: roundTwo(d.revenue),
      tax: roundTwo(d.tax),
      discount: roundTwo(d.discount),
      averageBillValue: d.salesCount > 0 ? roundTwo(d.revenue / d.salesCount) : 0,
    }))

  const roundedRevenue = roundTwo(totalRevenue)
  const averageOrderValue = totalSalesCount > 0 ? roundTwo(totalRevenue / totalSalesCount) : 0

  return {
    totalSalesCount,
    totalRevenue: roundedRevenue,
    totalTax: roundTwo(totalTax),
    totalDiscount: roundTwo(totalDiscount),
    excludedSalesCount,
    averageOrderValue,
    dailyBreakdown,
  }
}

/**
 * Task 2: Compute Gross Profit, COGS, and Category Margins
 */
function computeGrossProfit(payload) {
  const { saleItems } = payload

  let totalRevenue = 0
  let totalCogs = 0
  let totalItemsSold = 0

  const categoryMap = {}
  const items = []

  for (let i = 0; i < saleItems.length; i++) {
    const it = saleItems[i]
    const revenue = roundTwo(Number(it.totalAmount) || 0)
    const purchasePrice = Number(it.purchasePrice) || 0
    const quantity = Number(it.quantity) || 0
    const cogs = roundTwo(purchasePrice * quantity)
    const profit = roundTwo(revenue - cogs)
    const margin = revenue > 0 ? roundTwo((profit / revenue) * 100) : 0

    totalRevenue += revenue
    totalCogs += cogs
    totalItemsSold += quantity

    const category = it.categoryName || 'General'

    // Category aggregation
    if (!categoryMap[category]) {
      categoryMap[category] = {
        category,
        totalItemsSold: 0,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
      }
    }
    const catBucket = categoryMap[category]
    catBucket.totalItemsSold += quantity
    catBucket.revenue += revenue
    catBucket.cogs += cogs
    catBucket.grossProfit += profit

    items.push({
      id: it.id,
      productName: it.productName || 'Unknown Product',
      sku: it.sku || 'SKU-N/A',
      category,
      quantity,
      saleRevenue: revenue,
      purchaseCost: cogs,
      grossProfit: profit,
      profitMargin: margin,
    })
  }

  const overallGrossProfit = roundTwo(totalRevenue - totalCogs)
  const overallMarginPercent =
    totalRevenue > 0 ? roundTwo((overallGrossProfit / totalRevenue) * 100) : 0

  const categoryBreakdown = Object.values(categoryMap)
    .sort((a, b) => b.revenue - a.revenue)
    .map((c) => ({
      category: c.category,
      totalItemsSold: c.totalItemsSold,
      revenue: roundTwo(c.revenue),
      cogs: roundTwo(c.cogs),
      grossProfit: roundTwo(c.grossProfit),
      profitMarginPercent: c.revenue > 0 ? roundTwo((c.grossProfit / c.revenue) * 100) : 0,
    }))

  return {
    summary: {
      totalRevenue: roundTwo(totalRevenue),
      totalCogs: roundTwo(totalCogs),
      grossProfit: overallGrossProfit,
      profitMarginPercent: overallMarginPercent,
      totalItemsSold,
    },
    categoryBreakdown,
    items,
  }
}

/**
 * Task 3: Audit Schedule H / H1 Regulatory Compliance
 */
function auditScheduleHCompliance(payload) {
  const { rows } = payload

  let compliantEntries = 0
  let warningEntries = 0
  let criticalEntries = 0

  const auditedRows = rows.map((r) => {
    const flags = []
    const isScheduleH1 = r.schedule === 'H1'

    const hasDoctorRegNumber = Boolean(r.doctorRegNumber && r.doctorRegNumber.trim() !== '')
    const hasDoctorName = Boolean(r.doctorName && r.doctorName !== 'Prescription Attached' && r.doctorName.trim() !== '')
    const hasPatientContact = Boolean((r.patientPhone && r.patientPhone.trim() !== '') || (r.patientAddress && r.patientAddress.trim() !== ''))
    const hasBatch = Boolean(r.batchNumber && r.batchNumber !== 'Primary' && r.batchNumber.trim() !== '')

    if (!hasDoctorRegNumber) {
      flags.push('MISSING_DOCTOR_REG_NO')
    }
    if (!hasDoctorName) {
      flags.push('MISSING_DOCTOR_NAME')
    }
    if (!hasPatientContact) {
      flags.push('MISSING_PATIENT_CONTACT')
    }
    if (!hasBatch) {
      flags.push('MISSING_BATCH_NUMBER')
    }

    let isExpiredAtSale = false
    if (r.expiryDate && r.date) {
      const exp = new Date(r.expiryDate).getTime()
      const sale = new Date(r.date).getTime()
      if (exp < sale) {
        isExpiredAtSale = true
        flags.push('DISPENSED_EXPIRED_BATCH')
      }
    }

    let complianceStatus = 'COMPLIANT'
    if (isExpiredAtSale || (isScheduleH1 && !hasDoctorRegNumber)) {
      complianceStatus = 'CRITICAL'
      criticalEntries += 1
    } else if (flags.length > 0) {
      complianceStatus = 'WARNING'
      warningEntries += 1
    } else {
      compliantEntries += 1
    }

    return {
      ...r,
      complianceStatus,
      complianceFlags: flags,
      isScheduleH1,
    }
  })

  const totalEntries = rows.length
  const complianceRatePercent =
    totalEntries > 0 ? roundTwo((compliantEntries / totalEntries) * 100) : 100

  return {
    data: auditedRows,
    complianceMetrics: {
      totalEntries,
      compliantEntries,
      warningEntries,
      criticalEntries,
      complianceRatePercent,
    },
  }
}

/**
 * Task 4: Aggregate Doctor Referrals, Revenue & Commissions
 */
function aggregateDoctorReferrals(payload) {
  const { doctors } = payload

  const aggregated = doctors.map((doc) => {
    // Unique sales map across prescriptions and commissions
    const salesMap = {}

    if (Array.isArray(doc.prescriptions)) {
      for (let i = 0; i < doc.prescriptions.length; i++) {
        const p = doc.prescriptions[i]
        if (Array.isArray(p.sales)) {
          for (let j = 0; j < p.sales.length; j++) {
            const s = p.sales[j]
            salesMap[s.id] = {
              totalAmount: Number(s.totalAmount) || 0,
              status: s.status,
            }
          }
        }
      }
    }

    if (Array.isArray(doc.commissions)) {
      for (let i = 0; i < doc.commissions.length; i++) {
        const c = doc.commissions[i]
        if (c.sale && !salesMap[c.sale.id]) {
          salesMap[c.sale.id] = {
            totalAmount: Number(c.sale.totalAmount) || 0,
            status: c.sale.status,
          }
        }
      }
    }

    const uniqueSales = Object.values(salesMap)
    const completedSales = uniqueSales.filter((s) => s.status === 'COMPLETED')
    const totalSalesRevenue = roundTwo(completedSales.reduce((acc, s) => acc + s.totalAmount, 0))
    const salesCount = completedSales.length

    let totalCommission = 0
    let paidCommission = 0

    if (Array.isArray(doc.commissions)) {
      for (let i = 0; i < doc.commissions.length; i++) {
        const c = doc.commissions[i]
        const amt = Number(c.commissionAmount) || 0
        totalCommission += amt
        if (c.isPaid) {
          paidCommission += amt
        }
      }
    }

    const prescriptionsCount = doc._count?.prescriptions ?? (doc.prescriptions ? doc.prescriptions.length : 0)
    const pendingCommission = roundTwo(totalCommission - paidCommission)
    const conversionRatePercent =
      prescriptionsCount > 0 ? roundTwo((salesCount / prescriptionsCount) * 100) : 0
    const averageBillValue = salesCount > 0 ? roundTwo(totalSalesRevenue / salesCount) : 0

    return {
      id: doc.id,
      name: doc.name,
      regNumber: doc.regNumber || 'N/A',
      qualification: doc.qualification || 'MBBS',
      specialization: doc.specialization || 'General Practitioner',
      clinicName: doc.clinicName || 'Private Practice',
      phone: doc.phone || '—',
      email: doc.email || '—',
      commissionPercent: Number(doc.commissionPercent) || 0,
      isActive: Boolean(doc.isActive),
      prescriptionsCount,
      salesCount,
      totalSalesRevenue,
      totalCommission: roundTwo(totalCommission),
      paidCommission: roundTwo(paidCommission),
      pendingCommission,
      conversionRatePercent,
      averageBillValue,
    }
  })

  // Sort descending by total revenue generated
  aggregated.sort((a, b) => b.totalSalesRevenue - a.totalSalesRevenue)

  return aggregated
}

// ─────────────────────────────────────────────────────────────
// Worker Thread Event Listener
// ─────────────────────────────────────────────────────────────
if (parentPort) {
  parentPort.on('message', ({ id, command, payload }) => {
    try {
      let result
      switch (command) {
        case 'COMPUTE_SALES_FINANCIALS':
          result = computeSalesFinancials(payload)
          break
        case 'COMPUTE_GROSS_PROFIT':
          result = computeGrossProfit(payload)
          break
        case 'AUDIT_SCHEDULE_H_COMPLIANCE':
          result = auditScheduleHCompliance(payload)
          break
        case 'AGGREGATE_DOCTOR_REFERRALS':
          result = aggregateDoctorReferrals(payload)
          break
        default:
          throw new Error(`Unknown reporting worker command: ${command}`)
      }
      parentPort.postMessage({ id, success: true, data: result })
    } catch (err) {
      parentPort.postMessage({
        id,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })
}

// Export functions for direct synchronous fallback
module.exports = {
  computeSalesFinancials,
  computeGrossProfit,
  auditScheduleHCompliance,
  aggregateDoctorReferrals,
}

