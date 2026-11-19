/**
 * Platform Chemist Financial Intelligence & Profitability Excel Generator (.xlsx)
 * Metapharsic Lifesciences & PharmaCare Multi-Tenant Architecture
 *
 * Generates an executive-formatted multi-sheet Excel workbook with:
 * - Selected range of chemist shops (All or filtered subset)
 * - Selected range of financial sections (KPIs, Financials, Inventory, AP/AR, Top Medicines, Transactions)
 * - Number formatting for Indian Rupee currency (₹ #,##0.00), percentages (0.0%), and integer units (#,##0)
 * - Dynamic column width auto-fitting to eliminate text clipping and "###" cell overflows
 * - Grand total summary rows with weighted margin calculations
 * - Official system authentication watermark: METAPHARSIC LIFESCIENCES PHARMACARE [AUTHENTICATED SYSTEM DOCUMENT]
 */

import type { ChemistFinancialStats, PlatformAnalyticsData } from '@/lib/platform/platform-analytics-service'
import {
  buildWorkbook,
  downloadExcelWorkbook,
  type ExcelSheetConfig,
  type ExcelWorkbookConfig,
} from './excel-export-service'

export interface ChemistExcelExportOptions {
  // Chemist Shop Scope
  selectedShopIds?: string[] // empty or null means ALL shops
  
  // Selected Range of Information Sections
  includeExecutiveKpi?: boolean
  includeFinancialOverview?: boolean
  includeItemizedLedger?: boolean
  includeInventoryValuation?: boolean
  includeLedgerExposure?: boolean
  includeTopMedicines?: boolean
  includeRecentTransactions?: boolean

  // Health Tier Filter
  healthTierFilter?: string // 'ALL' | 'EXCEPTIONAL' | 'HEALTHY' | 'MODERATE' | 'LOW'

  // Custom File Name
  customFilename?: string
}

export const DEFAULT_EXCEL_EXPORT_OPTIONS: ChemistExcelExportOptions = {
  includeExecutiveKpi: true,
  includeFinancialOverview: true,
  includeItemizedLedger: true,
  includeInventoryValuation: true,
  includeLedgerExposure: true,
  includeTopMedicines: true,
  includeRecentTransactions: true,
  healthTierFilter: 'ALL',
}

/**
 * Builds the complete multi-sheet ExcelWorkbookConfig based on selected range of information
 */
export function buildChemistFinancialWorkbookConfig(
  data: PlatformAnalyticsData,
  options: ChemistExcelExportOptions = DEFAULT_EXCEL_EXPORT_OPTIONS
): ExcelWorkbookConfig {
  const { platformSummary, chemists } = data

  // 1. Filter chemists by selected shop IDs and health tier
  let filteredChemists = [...chemists]
  if (options.selectedShopIds && options.selectedShopIds.length > 0) {
    const idSet = new Set(options.selectedShopIds)
    filteredChemists = filteredChemists.filter((c) => idSet.has(c.organizationId))
  }
  if (options.healthTierFilter && options.healthTierFilter !== 'ALL') {
    filteredChemists = filteredChemists.filter(
      (c) => c.profitability.healthTier === options.healthTierFilter
    )
  }

  const currentDate = new Date().toISOString().split('T')[0]
  const sheets: ExcelSheetConfig[] = []

  const isSingleShop = filteredChemists.length === 1
  const scopeDescription = isSingleShop
    ? `Chemist Shop: ${filteredChemists[0].organizationName} [${filteredChemists[0].organizationCode}]`
    : `Consolidated Platform Scope: ${filteredChemists.length} Chemist Shops (${options.selectedShopIds?.length ? 'Selected Range' : 'All Tenants'})`

  // ─── TAB 1: EXECUTIVE KPI & PLATFORM SUMMARY ───
  if (options.includeExecutiveKpi !== false) {
    const totalRev = filteredChemists.reduce((acc, c) => acc + c.sales.grossRevenue, 0)
    const totalPurch = filteredChemists.reduce((acc, c) => acc + c.purchases.totalAmount, 0)
    const totalCogs = filteredChemists.reduce((acc, c) => acc + c.profitability.cogs, 0)
    const totalProfit = Math.round((totalRev - totalCogs) * 100) / 100
    const weightedMargin = totalRev > 0 ? Math.round((totalProfit / totalRev) * 1000) / 10 : 0
    const totalCostInv = filteredChemists.reduce((acc, c) => acc + c.inventory.valuationAtCost, 0)
    const totalMrpInv = filteredChemists.reduce((acc, c) => acc + c.inventory.valuationAtMrp, 0)
    const totalPotentialStockProfit = Math.round((totalMrpInv - totalCostInv) * 100) / 100
    const totalAP = filteredChemists.reduce((acc, c) => acc + c.ledger.accountsPayable, 0)
    const totalAR = filteredChemists.reduce((acc, c) => acc + c.ledger.accountsReceivable, 0)

    sheets.push({
      sheetName: 'Executive KPI Summary',
      title: 'METAPHARSIC LIFESCIENCES PHARMACARE [AUTHENTICATED SYSTEM DOCUMENT]',
      subtitle: `EXECUTIVE FINANCIAL INTELLIGENCE AUDIT REPORT &bull; ${scopeDescription}`,
      metadata: {
        'Report Generation Date': currentDate,
        'Platform Super-Admin': 'superadmin@pharmacare.local',
        'Chemist Shops Evaluated': filteredChemists.length,
        'Currency System': 'Indian Rupee (INR - ₹)',
        'Compliance Standard': 'Statutory Indian Accounting & DPCO Verification',
      },
      headers: [
        'Strategic Financial Metric',
        'Consolidated Value (₹)',
        'Unit / Percentage',
        'Executive Operational Context',
      ],
      data: [
        [
          'Total Gross Sales Revenue',
          totalRev,
          `${filteredChemists.reduce((acc, c) => acc + c.sales.invoicesCount, 0)} Invoices`,
          'Total patient billing revenue realized across counters',
        ],
        [
          'Total Inward Purchases',
          totalPurch,
          `${filteredChemists.reduce((acc, c) => acc + c.purchases.billsCount, 0)} Bills`,
          'Direct wholesale inventory procurement inwarded',
        ],
        [
          'True Cost of Goods Sold (COGS)',
          totalCogs,
          'At Purchase Rates',
          'Actual batch acquisition cost of dispensed medicines',
        ],
        [
          'Net Gross Profit',
          totalProfit,
          `${weightedMargin}% Margin`,
          'Consolidated profit realized (Sales Revenue - COGS)',
        ],
        [
          'Live Stock Asset Valuation (At Cost)',
          totalCostInv,
          `${filteredChemists.reduce((acc, c) => acc + c.inventory.totalUnits, 0)} Stock Units`,
          'Capital tied up in live branch pharmaceutical inventory',
        ],
        [
          'Live Stock Asset Valuation (At MRP)',
          totalMrpInv,
          'Retail Valuation',
          'Maximum retail price liquidation value of current stock',
        ],
        [
          'Potential Profit in Physical Stock',
          totalPotentialStockProfit,
          `${totalCostInv > 0 ? Math.round((totalPotentialStockProfit / totalCostInv) * 100) : 0}% Markup`,
          'Gross margin realizable upon complete stock sale',
        ],
        [
          'Distributor Accounts Payable (AP)',
          totalAP,
          'Wholesale Liabilities',
          'Outstanding credit payable to pharmaceutical distributors',
        ],
        [
          'Patient Accounts Receivable (AR)',
          totalAR,
          'Customer Credit',
          'Outstanding credit balances due from patients and institutions',
        ],
      ],
      columnWidths: [38, 26, 22, 55],
    })
  }

  // ─── TAB 2: CHEMIST FINANCIAL OVERVIEW & PROFITABILITY ───
  if (options.includeFinancialOverview !== false) {
    const headers = [
      'Store Code',
      'Chemist Shop Name',
      'Location / State',
      'Drug License (DL)',
      'GSTIN',
      'Plan',
      'Inward Purchases (₹)',
      'Bills',
      'Paid to Distributors (₹)',
      'Supplier Due (₹)',
      'Gross Sales Revenue (₹)',
      'Invoices',
      'Units Sold',
      'COGS (₹)',
      'Gross Profit (₹)',
      'Profit Margin (%)',
      'Health Status',
    ]

    const dataRows = filteredChemists.map((c) => [
      c.organizationCode,
      c.organizationName,
      c.city ? `${c.city}, ${c.state || 'India'}` : 'India',
      c.dlNumber || 'N/A',
      c.gstin || 'N/A',
      c.subscriptionPlan,
      c.purchases.totalAmount,
      c.purchases.billsCount,
      c.purchases.amountPaid,
      c.purchases.balanceDue,
      c.sales.grossRevenue,
      c.sales.invoicesCount,
      c.sales.unitsSold,
      c.profitability.cogs,
      c.profitability.grossProfit,
      c.profitability.profitMarginPercent / 100, // as fraction for 0.0% formatting
      c.profitability.healthTier,
    ])

    // Compute Summary Row
    const sumPurch = filteredChemists.reduce((acc, c) => acc + c.purchases.totalAmount, 0)
    const sumBills = filteredChemists.reduce((acc, c) => acc + c.purchases.billsCount, 0)
    const sumPaid = filteredChemists.reduce((acc, c) => acc + c.purchases.amountPaid, 0)
    const sumDue = filteredChemists.reduce((acc, c) => acc + c.purchases.balanceDue, 0)
    const sumSales = filteredChemists.reduce((acc, c) => acc + c.sales.grossRevenue, 0)
    const sumInvoices = filteredChemists.reduce((acc, c) => acc + c.sales.invoicesCount, 0)
    const sumUnits = filteredChemists.reduce((acc, c) => acc + c.sales.unitsSold, 0)
    const sumCogs = filteredChemists.reduce((acc, c) => acc + c.profitability.cogs, 0)
    const sumProfit = Math.round((sumSales - sumCogs) * 100) / 100
    const overallMargin = sumSales > 0 ? (sumProfit / sumSales) : 0

    const summaryRow = [
      'TOTAL',
      `Consolidated (${filteredChemists.length} Shops)`,
      '-',
      '-',
      '-',
      '-',
      sumPurch,
      sumBills,
      sumPaid,
      sumDue,
      sumSales,
      sumInvoices,
      sumUnits,
      sumCogs,
      sumProfit,
      overallMargin,
      overallMargin >= 0.25 ? 'EXCEPTIONAL' : overallMargin >= 0.18 ? 'HEALTHY' : 'MODERATE',
    ]

    sheets.push({
      sheetName: 'Chemist Financial Overview',
      title: 'METAPHARSIC LIFESCIENCES PHARMACARE [AUTHENTICATED SYSTEM DOCUMENT]',
      subtitle: `CHEMIST REVENUE, INWARD PURCHASES, COGS & PROFIT MARGINS &bull; ${scopeDescription}`,
      headers,
      data: dataRows,
      summaryRow,
      columnWidths: [14, 34, 22, 22, 20, 14, 22, 10, 22, 18, 24, 12, 12, 18, 20, 16, 16],
    })
  }

  // ─── TAB: INDIVIDUAL ITEM PURCHASES & SALES LEDGER (EACH ENTITY) ───
  if (options.includeItemizedLedger !== false) {
    const headers = [
      'Store Code',
      'Chemist Shop Name',
      'SKU',
      'Medicine / Product Name',
      'Generic Salt / Molecule',
      'HSN',
      'Schedule',
      'Inward Units',
      'Avg Purchase Cost (₹)',
      'Total Purchase Spend (₹)',
      'Primary Distributor',
      'Latest Batch',
      'Expiry Date',
      'Units Sold',
      'Avg Realized Rate (₹)',
      'Gross Sales Revenue (₹)',
      'COGS (₹)',
      'Gross Profit (₹)',
      'Margin (%)',
      'Profit / Unit (₹)',
      'Available Stock',
      'Stock Value at Cost (₹)',
      'Stock Value at MRP (₹)',
      'Potential Stock Profit (₹)',
      'Performance Health',
    ]

    const dataRows: (string | number)[][] = []
    let totalInwardUnits = 0
    let totalPurchSpend = 0
    let totalSoldUnits = 0
    let totalSalesRev = 0
    let totalCogs = 0
    let totalAvailStock = 0
    let totalCostVal = 0
    let totalMrpVal = 0

    for (const c of filteredChemists) {
      if (c.itemizedLedger && c.itemizedLedger.length > 0) {
        c.itemizedLedger.forEach((it) => {
          totalInwardUnits += it.totalInwardUnits
          totalPurchSpend += it.totalPurchaseSpend
          totalSoldUnits += it.soldQuantity
          totalSalesRev += it.grossSalesRevenue
          totalCogs += it.cogs
          totalAvailStock += it.availableStock
          totalCostVal += it.stockValuationAtCost
          totalMrpVal += it.stockValuationAtMrp

          dataRows.push([
            c.organizationCode,
            c.organizationName,
            it.sku,
            it.productName,
            it.genericName || 'Standard Formulation',
            it.hsnCode || '3004',
            it.drugSchedule,
            it.totalInwardUnits,
            it.avgPurchaseRate,
            it.totalPurchaseSpend,
            it.primarySupplier || 'Direct Wholesaler',
            it.latestBatchNumber || '-',
            it.latestExpiryDate || '-',
            it.soldQuantity,
            it.avgSellingPrice,
            it.grossSalesRevenue,
            it.cogs,
            it.grossProfit,
            it.profitMarginPercent / 100, // as fraction for 0.0% formatting
            it.profitPerUnit,
            it.availableStock,
            it.stockValuationAtCost,
            it.stockValuationAtMrp,
            it.potentialStockProfit,
            it.healthTier,
          ])
        })
      }
    }

    const totalGrossProfit = Math.round((totalSalesRev - totalCogs) * 100) / 100
    const weightedMargin = totalSalesRev > 0 ? (totalGrossProfit / totalSalesRev) : 0
    const totalPotentialProfit = Math.round((totalMrpVal - totalCostVal) * 100) / 100

    const summaryRow = [
      'TOTAL',
      `Consolidated Items (${dataRows.length} Medicines)`,
      '-',
      '-',
      '-',
      '-',
      '-',
      totalInwardUnits,
      '-',
      totalPurchSpend,
      '-',
      '-',
      '-',
      totalSoldUnits,
      '-',
      totalSalesRev,
      totalCogs,
      totalGrossProfit,
      weightedMargin,
      totalSoldUnits > 0 ? Math.round((totalGrossProfit / totalSoldUnits) * 100) / 100 : 0,
      totalAvailStock,
      totalCostVal,
      totalMrpVal,
      totalPotentialProfit,
      weightedMargin >= 0.25 ? 'EXCEPTIONAL' : weightedMargin >= 0.18 ? 'HEALTHY' : 'MODERATE',
    ]

    sheets.push({
      sheetName: 'Item Purchases & Sales',
      title: 'METAPHARSIC LIFESCIENCES PHARMACARE [AUTHENTICATED SYSTEM DOCUMENT]',
      subtitle: `INDIVIDUAL MEDICINE INWARD PURCHASES, OUTWARD SALES & PROFITABILITY LEDGER &bull; ${scopeDescription}`,
      headers,
      data: dataRows,
      summaryRow,
      columnWidths: [
        14, 32, 16, 34, 30, 12, 12, 16, 20, 24, 28, 16, 14, 14, 20, 24, 18, 20, 14, 16, 16, 24, 24, 26, 16,
      ],
    })
  }

  // ─── TAB 3: LIVE STOCK & ASSET VALUATION ───
  if (options.includeInventoryValuation !== false) {
    const headers = [
      'Store Code',
      'Chemist Shop Name',
      'Catalog Items',
      'Available Stock Units',
      'Stock Valuation at Cost (₹)',
      'Stock Valuation at MRP (₹)',
      'Potential Retail Profit in Stock (₹)',
      'Gross Markup on Cost (%)',
    ]

    const dataRows = filteredChemists.map((c) => {
      const markup =
        c.inventory.valuationAtCost > 0
          ? (c.inventory.potentialProfit / c.inventory.valuationAtCost)
          : 0
      return [
        c.organizationCode,
        c.organizationName,
        c.inventory.totalProducts,
        c.inventory.totalUnits,
        c.inventory.valuationAtCost,
        c.inventory.valuationAtMrp,
        c.inventory.potentialProfit,
        markup,
      ]
    })

    const sumProducts = filteredChemists.reduce((acc, c) => acc + c.inventory.totalProducts, 0)
    const sumUnits = filteredChemists.reduce((acc, c) => acc + c.inventory.totalUnits, 0)
    const sumCost = filteredChemists.reduce((acc, c) => acc + c.inventory.valuationAtCost, 0)
    const sumMrp = filteredChemists.reduce((acc, c) => acc + c.inventory.valuationAtMrp, 0)
    const sumPotential = Math.round((sumMrp - sumCost) * 100) / 100
    const sumMarkup = sumCost > 0 ? (sumPotential / sumCost) : 0

    const summaryRow = [
      'TOTAL',
      `Consolidated Inventory (${filteredChemists.length} Shops)`,
      sumProducts,
      sumUnits,
      sumCost,
      sumMrp,
      sumPotential,
      sumMarkup,
    ]

    sheets.push({
      sheetName: 'Inventory Asset Valuation',
      title: 'METAPHARSIC LIFESCIENCES PHARMACARE [AUTHENTICATED SYSTEM DOCUMENT]',
      subtitle: `LIVE STOCK ASSET VALUATION (WHOLESALE COST VS RETAIL MRP) &bull; ${scopeDescription}`,
      headers,
      data: dataRows,
      summaryRow,
      columnWidths: [14, 34, 16, 22, 26, 26, 32, 24],
    })
  }

  // ─── TAB 4: MARKET CREDIT & LEDGER EXPOSURE (AP vs AR) ───
  if (options.includeLedgerExposure !== false) {
    const headers = [
      'Store Code',
      'Chemist Shop Name',
      'Distributor Payables (AP ₹)',
      'Patient Receivables (AR ₹)',
      'Net Working Capital Balance (₹)',
      'Credit Exposure Status',
    ]

    const dataRows = filteredChemists.map((c) => {
      const net = c.ledger.accountsReceivable - c.ledger.accountsPayable
      const status =
        net >= 0
          ? 'Positive Net Balance (Surplus Receivables)'
          : 'Supplier Credit Utilization (Payable Excess)'
      return [
        c.organizationCode,
        c.organizationName,
        c.ledger.accountsPayable,
        c.ledger.accountsReceivable,
        net,
        status,
      ]
    })

    const sumAP = filteredChemists.reduce((acc, c) => acc + c.ledger.accountsPayable, 0)
    const sumAR = filteredChemists.reduce((acc, c) => acc + c.ledger.accountsReceivable, 0)
    const sumNet = sumAR - sumAP

    const summaryRow = [
      'TOTAL',
      `Consolidated Ledger (${filteredChemists.length} Shops)`,
      sumAP,
      sumAR,
      sumNet,
      sumNet >= 0 ? 'Net Positive Surplus' : 'Net Credit Payable',
    ]

    sheets.push({
      sheetName: 'Market Ledger (AP-AR)',
      title: 'METAPHARSIC LIFESCIENCES PHARMACARE [AUTHENTICATED SYSTEM DOCUMENT]',
      subtitle: `ACCOUNTS PAYABLE (DISTRIBUTORS) VS ACCOUNTS RECEIVABLE (PATIENTS) &bull; ${scopeDescription}`,
      headers,
      data: dataRows,
      summaryRow,
      columnWidths: [14, 34, 26, 26, 28, 40],
    })
  }

  // ─── TAB 5: TOP PROFIT-DRIVING MEDICINES ───
  if (options.includeTopMedicines !== false) {
    const headers = [
      'Store Code',
      'Chemist Shop Name',
      'Rank',
      'Medicine Name',
      'Units Sold',
      'Gross Revenue (₹)',
      'Acquisition Cost (₹)',
      'Gross Profit (₹)',
      'Profit Margin (%)',
    ]

    const dataRows: (string | number)[][] = []
    let totalTopRevenue = 0
    let totalTopCost = 0
    let totalTopUnits = 0

    for (const c of filteredChemists) {
      if (c.topMedicines && c.topMedicines.length > 0) {
        c.topMedicines.forEach((m, idx) => {
          totalTopUnits += m.unitsSold
          totalTopRevenue += m.revenue
          totalTopCost += m.cost
          dataRows.push([
            c.organizationCode,
            c.organizationName,
            idx + 1,
            m.name,
            m.unitsSold,
            m.revenue,
            m.cost,
            m.profit,
            m.marginPercent / 100, // as fraction for 0.0% formatting
          ])
        })
      }
    }

    const totalTopProfit = Math.round((totalTopRevenue - totalTopCost) * 100) / 100
    const topOverallMargin = totalTopRevenue > 0 ? (totalTopProfit / totalTopRevenue) : 0

    const summaryRow = [
      'TOTAL',
      'Top Medicines Aggregate',
      '-',
      `${dataRows.length} Medicines Evaluated`,
      totalTopUnits,
      totalTopRevenue,
      totalTopCost,
      totalTopProfit,
      topOverallMargin,
    ]

    sheets.push({
      sheetName: 'Top Profit Medicines',
      title: 'METAPHARSIC LIFESCIENCES PHARMACARE [AUTHENTICATED SYSTEM DOCUMENT]',
      subtitle: `TOP PROFIT-GENERATING MEDICINES RANKED BY MARGIN GENERATION &bull; ${scopeDescription}`,
      headers,
      data: dataRows,
      summaryRow,
      columnWidths: [14, 32, 8, 36, 14, 20, 20, 20, 16],
    })
  }

  // ─── TAB 6: RECENT INVOICES & TRANSACTION AUDIT ───
  if (options.includeRecentTransactions !== false) {
    const headers = [
      'Store Code',
      'Chemist Shop Name',
      'Invoice Number',
      'Date',
      'Patient / Customer',
      'Payment Mode',
      'Items Count',
      'Total Amount (₹)',
    ]

    const dataRows: (string | number)[][] = []
    let sumTransAmount = 0
    let sumTransItems = 0

    for (const c of filteredChemists) {
      if (c.recentInvoices && c.recentInvoices.length > 0) {
        c.recentInvoices.forEach((inv) => {
          sumTransAmount += inv.amount
          sumTransItems += inv.itemsCount
          dataRows.push([
            c.organizationCode,
            c.organizationName,
            inv.invoiceNumber,
            inv.date,
            inv.customerName,
            inv.paymentMethod,
            inv.itemsCount,
            inv.amount,
          ])
        })
      }
    }

    const summaryRow = [
      'TOTAL',
      'Recent Completed Sales',
      `${dataRows.length} Invoices`,
      '-',
      '-',
      '-',
      sumTransItems,
      sumTransAmount,
    ]

    sheets.push({
      sheetName: 'Recent Invoices Audit',
      title: 'METAPHARSIC LIFESCIENCES PHARMACARE [AUTHENTICATED SYSTEM DOCUMENT]',
      subtitle: `AUDIT LOG OF RECENT COMPLETED SALES TRANSACTIONS &bull; ${scopeDescription}`,
      headers,
      data: dataRows,
      summaryRow,
      columnWidths: [14, 32, 24, 14, 26, 16, 14, 20],
    })
  }

  const baseFilename = options.customFilename
    ? options.customFilename
    : isSingleShop
      ? `Metapharsic_${filteredChemists[0].organizationCode}_Financial_Audit_${currentDate}`
      : `Metapharsic_Chemist_Financial_Intelligence_${currentDate}`

  return {
    filename: `${baseFilename}.xlsx`,
    organizationName: 'METAPHARSIC LIFESCIENCES & PHARMACARE [SUPER-ADMIN]',
    sheets,
  }
}

/**
 * Triggers client-side formatted Excel workbook generation and download
 */
export function exportChemistFinancialExcel(
  data: PlatformAnalyticsData,
  options?: ChemistExcelExportOptions
): void {
  const config = buildChemistFinancialWorkbookConfig(data, options)
  downloadExcelWorkbook(config)
}

