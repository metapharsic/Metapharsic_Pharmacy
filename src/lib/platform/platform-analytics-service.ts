import { Prisma } from '@prisma/client'
import prisma from '@/lib/db/prisma'

export interface ChemistItemFinancialRecord {
  productId: string
  productName: string
  genericName: string | null
  sku: string
  hsnCode: string | null
  drugSchedule: string
  mrp: number
  costPrice: number

  // Purchases Inward
  purchasedQuantity: number
  freeQuantity: number
  totalInwardUnits: number
  avgPurchaseRate: number
  totalPurchaseSpend: number
  primarySupplier: string | null
  latestBatchNumber: string | null
  latestExpiryDate: string | null

  // Sales Outward
  soldQuantity: number
  salesInvoicesCount: number
  avgSellingPrice: number
  grossSalesRevenue: number
  cogs: number

  // Profitability
  grossProfit: number
  profitMarginPercent: number
  profitPerUnit: number
  healthTier: 'EXCEPTIONAL' | 'HEALTHY' | 'MODERATE' | 'LOW'

  // Current Live Stock Position
  availableStock: number
  stockValuationAtCost: number
  stockValuationAtMrp: number
  potentialStockProfit: number
}

export interface ChemistFinancialStats {
  organizationId: string
  organizationCode: string
  organizationName: string
  slug: string
  city: string | null
  state: string | null
  phone: string | null
  email: string | null
  gstin: string | null
  dlNumber: string | null
  status: string
  subscriptionPlan: string
  branchesCount: number
  usersCount: number
  
  // Purchases Inward
  purchases: {
    totalAmount: number
    billsCount: number
    amountPaid: number
    balanceDue: number
  }
  
  // Sales & Revenue
  sales: {
    grossRevenue: number
    subtotal: number
    taxAmount: number
    discountAmount: number
    invoicesCount: number
    unitsSold: number
  }
  
  // Cost of Goods Sold (COGS) & Profitability
  profitability: {
    cogs: number
    grossProfit: number
    profitMarginPercent: number
    healthTier: 'EXCEPTIONAL' | 'HEALTHY' | 'MODERATE' | 'LOW'
  }
  
  // Live Inventory Valuation
  inventory: {
    totalProducts: number
    totalUnits: number
    valuationAtCost: number
    valuationAtMrp: number
    potentialProfit: number
  }
  
  // Ledger (Payables vs Receivables)
  ledger: {
    accountsPayable: number
    accountsReceivable: number
  }
  
  // Top 5 Profit-Driving Medicines
  topMedicines: Array<{
    name: string
    unitsSold: number
    revenue: number
    cost: number
    profit: number
    marginPercent: number
  }>
  
  // Individual item purchase and sales intelligence ledger for each entity
  itemizedLedger: ChemistItemFinancialRecord[]

  // Recent 5 Invoices
  recentInvoices: Array<{
    invoiceNumber: string
    date: string
    customerName: string
    amount: number
    paymentMethod: string
    itemsCount: number
  }>
}

export interface PlatformRollupSummary {
  totalRevenue: number
  totalPurchases: number
  totalCogs: number
  netGrossProfit: number
  weightedMarginPercent: number
  totalShopsCount: number
  totalBranchesCount: number
  totalStaffCount: number
  totalInventoryAtCost: number
  totalInventoryAtMrp: number
  totalReceivables: number
  totalPayables: number
}

export interface PlatformAnalyticsData {
  platformSummary: PlatformRollupSummary
  chemists: ChemistFinancialStats[]
}

/**
 * Computes deep financial intelligence, purchases, sales, COGS, and profit margins
 * across all chemist shops registered in the multi-tenant system.
 * Strictly for Platform Super-Admin consumption.
 */
export async function getPlatformChemistAnalytics(): Promise<PlatformAnalyticsData> {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      branches: {
        select: { id: true, name: true, code: true },
      },
      _count: {
        select: {
          users: true,
          products: true,
          customers: true,
          suppliers: true,
        },
      },
    },
  })

  const chemistStats: ChemistFinancialStats[] = []

  let rollupRevenue = 0
  let rollupPurchases = 0
  let rollupCogs = 0
  let rollupInventoryCost = 0
  let rollupInventoryMrp = 0
  let rollupReceivables = 0
  let rollupPayables = 0
  let rollupBranchesCount = 0
  let rollupStaffCount = 0

  for (const org of organizations) {
    const branchIds = org.branches.map((b) => b.id)

    // 1. Inward Purchases
    const purchases = await prisma.purchase.findMany({
      where: {
        branchId: { in: branchIds },
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        totalAmount: true,
        amountPaid: true,
        balanceDue: true,
      },
    })

    const totalPurchaseAmt = purchases.reduce((acc, p) => acc + Number(p.totalAmount || 0), 0)
    const totalPurchasePaid = purchases.reduce((acc, p) => acc + Number(p.amountPaid || 0), 0)
    const totalPurchaseBalance = purchases.reduce((acc, p) => acc + Number(p.balanceDue || 0), 0)

    // 2. Outward Sales with Items and Batches for precise COGS calculation
    const sales = await prisma.sale.findMany({
      where: {
        branchId: { in: branchIds },
        status: { not: 'CANCELLED' },
      },
      include: {
        customer: { select: { name: true } },
        payments: { select: { method: true, amount: true } },
        items: {
          include: {
            product: { select: { name: true, costPrice: true, ptr: true, mrp: true } },
            itemBatches: {
              include: {
                batch: { select: { purchasePrice: true, ptr: true } },
              },
            },
          },
        },
      },
      orderBy: { saleDate: 'desc' },
    })

    let grossRevenue = 0
    let totalSubtotal = 0
    let totalTax = 0
    let totalDiscount = 0
    let totalUnitsSold = 0
    let shopCogs = 0

    // Profit tracking per medicine
    const medicineProfitMap = new Map<
      string,
      { name: string; unitsSold: number; revenue: number; cost: number }
    >()

    for (const sale of sales) {
      grossRevenue += Number(sale.totalAmount || 0)
      totalSubtotal += Number(sale.subtotal || 0)
      totalTax += Number(sale.taxAmount || 0)
      totalDiscount += Number(sale.discountAmount || 0)

      for (const item of sale.items) {
        const qty = item.quantity || 0
        totalUnitsSold += qty
        const itemRevenue = Number(item.totalAmount || 0)

        // Calculate true cost from batch purchasePrice, fallback to product costPrice
        let unitCost = 0
        if (item.itemBatches && item.itemBatches.length > 0) {
          const firstBatch = item.itemBatches[0].batch
          unitCost = Number(firstBatch.purchasePrice || firstBatch.ptr || item.product.costPrice || 0)
        } else {
          unitCost = Number(item.product.costPrice || item.product.ptr || 0)
        }

        const itemCost = unitCost * qty
        shopCogs += itemCost

        const existingMed = medicineProfitMap.get(item.product.name) || {
          name: item.product.name,
          unitsSold: 0,
          revenue: 0,
          cost: 0,
        }
        existingMed.unitsSold += qty
        existingMed.revenue += itemRevenue
        existingMed.cost += itemCost
        medicineProfitMap.set(item.product.name, existingMed)
      }
    }

    const grossProfit = Math.round((grossRevenue - shopCogs) * 100) / 100
    const profitMarginPercent =
      grossRevenue > 0 ? Math.round((grossProfit / grossRevenue) * 1000) / 10 : 0

    let healthTier: 'EXCEPTIONAL' | 'HEALTHY' | 'MODERATE' | 'LOW' = 'LOW'
    if (profitMarginPercent >= 25) healthTier = 'EXCEPTIONAL'
    else if (profitMarginPercent >= 18) healthTier = 'HEALTHY'
    else if (profitMarginPercent >= 10) healthTier = 'MODERATE'

    // 3. Live Inventory Valuation
    const inventoryItems = await prisma.inventory.findMany({
      where: {
        branchId: { in: branchIds },
      },
      include: {
        product: { select: { costPrice: true, ptr: true, mrp: true } },
      },
    })

    let totalInventoryUnits = 0
    let valuationAtCost = 0
    let valuationAtMrp = 0

    for (const inv of inventoryItems) {
      const avail = inv.availableQuantity || 0
      totalInventoryUnits += avail
      const cost = Number(inv.product.costPrice || inv.product.ptr || 0)
      const mrp = Number(inv.product.mrp || 0)
      valuationAtCost += avail * cost
      valuationAtMrp += avail * mrp
    }

    // 4. Supplier Payables & Customer Receivables
    const suppliers = await prisma.supplier.findMany({
      where: { organizationId: org.id },
      select: { outstandingBalance: true },
    })
    const accountsPayable = suppliers.reduce((acc, s) => acc + Number(s.outstandingBalance || 0), 0)

    const customers = await prisma.customer.findMany({
      where: { organizationId: org.id },
      select: { outstandingBalance: true },
    })
    const accountsReceivable = customers.reduce(
      (acc, c) => acc + Number(c.outstandingBalance || 0),
      0
    )

    // 5. Top 5 Profit Medicines
    const sortedMedicines = Array.from(medicineProfitMap.values())
      .map((m) => {
        const profit = Math.round((m.revenue - m.cost) * 100) / 100
        const margin = m.revenue > 0 ? Math.round((profit / m.revenue) * 1000) / 10 : 0
        return {
          name: m.name,
          unitsSold: m.unitsSold,
          revenue: Math.round(m.revenue * 100) / 100,
          cost: Math.round(m.cost * 100) / 100,
          profit,
          marginPercent: margin,
        }
      })
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5)

    // 6. Recent 5 Invoices
    const recentInvoices = sales.slice(0, 5).map((s) => ({
      invoiceNumber: s.invoiceNumber,
      date: s.saleDate.toISOString().split('T')[0],
      customerName: s.customer?.name || 'Walk-in Patient',
      amount: Number(s.totalAmount),
      paymentMethod: s.payments[0]?.method || 'CASH',
      itemsCount: s.items.length,
    }))

    // 7. Individual Item Purchase, Sales, Profit & Live Stock Ledger for this Entity
    const entityProducts = await prisma.product.findMany({
      where: {
        OR: [
          { organizationId: org.id },
          ...(org.code === 'DEFAULT' ? [{ organizationId: null }] : []),
        ],
      },
      include: {
        inventory: {
          where: { branchId: { in: branchIds } },
          select: { availableQuantity: true, totalQuantity: true },
        },
        batches: {
          where: { branchId: { in: branchIds } },
          orderBy: { createdAt: 'desc' },
          select: { batchNumber: true, expiryDate: true, purchasePrice: true, ptr: true, mrp: true },
        },
        purchaseItems: {
          where: {
            purchase: {
              branchId: { in: branchIds },
              status: { not: 'CANCELLED' },
            },
          },
          include: {
            purchase: {
              select: { purchaseDate: true, invoiceNumber: true, supplier: { select: { name: true } } },
            },
          },
        },
        saleItems: {
          where: {
            sale: {
              branchId: { in: branchIds },
              status: { not: 'CANCELLED' },
            },
          },
          include: {
            itemBatches: {
              include: {
                batch: { select: { purchasePrice: true, ptr: true } },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const itemizedLedger: ChemistItemFinancialRecord[] = entityProducts.map((p) => {
      // Inward Purchases
      const billedUnits = p.purchaseItems.reduce(
        (acc, pi) => acc + (pi.receivedQuantity || pi.orderedQuantity || 0),
        0
      )
      const freeUnits = p.purchaseItems.reduce((acc, pi) => acc + (pi.freeQuantity || 0), 0)
      const totalInwardUnits = billedUnits + freeUnits
      const totalPurchaseSpend = p.purchaseItems.reduce(
        (acc, pi) => acc + Number(pi.totalAmount || 0),
        0
      )
      const avgPurchaseRate =
        billedUnits > 0
          ? Math.round((totalPurchaseSpend / billedUnits) * 100) / 100
          : Number(p.costPrice || p.ptr || 0)
      const primarySupplier = p.purchaseItems[0]?.purchase?.supplier?.name || null
      const latestBatch = p.batches[0]

      // Sales Outward
      const soldUnits = p.saleItems.reduce((acc, si) => acc + (si.quantity || 0), 0)
      const grossSalesRev = p.saleItems.reduce((acc, si) => acc + Number(si.totalAmount || 0), 0)
      const avgSellingPrice =
        soldUnits > 0
          ? Math.round((grossSalesRev / soldUnits) * 100) / 100
          : Number(p.mrp || 0)

      let itemCogs = 0
      for (const si of p.saleItems) {
        let uCost = 0
        if (si.itemBatches && si.itemBatches.length > 0) {
          const b = si.itemBatches[0].batch
          uCost = Number(b.purchasePrice || b.ptr || p.costPrice || avgPurchaseRate || 0)
        } else {
          uCost = Number(p.costPrice || p.ptr || avgPurchaseRate || 0)
        }
        itemCogs += uCost * (si.quantity || 0)
      }

      // Profitability
      const grossProfit = Math.round((grossSalesRev - itemCogs) * 100) / 100
      const profitMarginPercent =
        grossSalesRev > 0 ? Math.round((grossProfit / grossSalesRev) * 1000) / 10 : 0
      const profitPerUnit =
        soldUnits > 0 ? Math.round((grossProfit / soldUnits) * 100) / 100 : 0

      let itemTier: 'EXCEPTIONAL' | 'HEALTHY' | 'MODERATE' | 'LOW' = 'LOW'
      if (profitMarginPercent >= 25) itemTier = 'EXCEPTIONAL'
      else if (profitMarginPercent >= 18) itemTier = 'HEALTHY'
      else if (profitMarginPercent >= 10) itemTier = 'MODERATE'

      // Live Inventory Stock Position
      const availableStock = p.inventory.reduce(
        (acc, inv) => acc + (inv.availableQuantity || 0),
        0
      )
      const stockValuationAtCost =
        Math.round(availableStock * Number(p.costPrice || avgPurchaseRate || 0) * 100) / 100
      const stockValuationAtMrp = Math.round(availableStock * Number(p.mrp || 0) * 100) / 100
      const potentialStockProfit = Math.round((stockValuationAtMrp - stockValuationAtCost) * 100) / 100

      return {
        productId: p.id,
        productName: p.name,
        genericName: p.genericName,
        sku: p.sku,
        hsnCode: p.hsnCode,
        drugSchedule: p.drugSchedule,
        mrp: Number(p.mrp || 0),
        costPrice: Number(p.costPrice || avgPurchaseRate || 0),
        purchasedQuantity: billedUnits,
        freeQuantity: freeUnits,
        totalInwardUnits,
        avgPurchaseRate,
        totalPurchaseSpend: Math.round(totalPurchaseSpend * 100) / 100,
        primarySupplier,
        latestBatchNumber: latestBatch?.batchNumber || null,
        latestExpiryDate: latestBatch?.expiryDate
          ? latestBatch.expiryDate.toISOString().split('T')[0]
          : null,
        soldQuantity: soldUnits,
        salesInvoicesCount: p.saleItems.length,
        avgSellingPrice,
        grossSalesRevenue: Math.round(grossSalesRev * 100) / 100,
        cogs: Math.round(itemCogs * 100) / 100,
        grossProfit,
        profitMarginPercent,
        profitPerUnit,
        healthTier: itemTier,
        availableStock,
        stockValuationAtCost,
        stockValuationAtMrp,
        potentialStockProfit,
      }
    })

    // Accumulate Rollup
    rollupRevenue += grossRevenue
    rollupPurchases += totalPurchaseAmt
    rollupCogs += shopCogs
    rollupInventoryCost += valuationAtCost
    rollupInventoryMrp += valuationAtMrp
    rollupReceivables += accountsReceivable
    rollupPayables += accountsPayable
    rollupBranchesCount += org.branches.length
    rollupStaffCount += org._count.users

    chemistStats.push({
      organizationId: org.id,
      organizationCode: org.code || org.id.slice(0, 8).toUpperCase(),
      organizationName: org.name,
      slug: org.slug || org.code?.toLowerCase() || 'shop',
      city: org.city,
      state: org.state,
      phone: org.phone,
      email: org.email,
      gstin: org.gstin,
      dlNumber: org.dlNumber,
      status: org.status,
      subscriptionPlan: org.subscriptionPlan,
      branchesCount: org.branches.length,
      usersCount: org._count.users,
      purchases: {
        totalAmount: Math.round(totalPurchaseAmt * 100) / 100,
        billsCount: purchases.length,
        amountPaid: Math.round(totalPurchasePaid * 100) / 100,
        balanceDue: Math.round(totalPurchaseBalance * 100) / 100,
      },
      sales: {
        grossRevenue: Math.round(grossRevenue * 100) / 100,
        subtotal: Math.round(totalSubtotal * 100) / 100,
        taxAmount: Math.round(totalTax * 100) / 100,
        discountAmount: Math.round(totalDiscount * 100) / 100,
        invoicesCount: sales.length,
        unitsSold: totalUnitsSold,
      },
      profitability: {
        cogs: Math.round(shopCogs * 100) / 100,
        grossProfit,
        profitMarginPercent,
        healthTier,
      },
      inventory: {
        totalProducts: org._count.products,
        totalUnits: totalInventoryUnits,
        valuationAtCost: Math.round(valuationAtCost * 100) / 100,
        valuationAtMrp: Math.round(valuationAtMrp * 100) / 100,
        potentialProfit: Math.round((valuationAtMrp - valuationAtCost) * 100) / 100,
      },
      ledger: {
        accountsPayable: Math.round(accountsPayable * 100) / 100,
        accountsReceivable: Math.round(accountsReceivable * 100) / 100,
      },
      topMedicines: sortedMedicines,
      itemizedLedger,
      recentInvoices,
    })
  }

  const netPlatformProfit = Math.round((rollupRevenue - rollupCogs) * 100) / 100
  const weightedPlatformMargin =
    rollupRevenue > 0 ? Math.round((netPlatformProfit / rollupRevenue) * 1000) / 10 : 0

  const platformSummary: PlatformRollupSummary = {
    totalRevenue: Math.round(rollupRevenue * 100) / 100,
    totalPurchases: Math.round(rollupPurchases * 100) / 100,
    totalCogs: Math.round(rollupCogs * 100) / 100,
    netGrossProfit: netPlatformProfit,
    weightedMarginPercent: weightedPlatformMargin,
    totalShopsCount: organizations.length,
    totalBranchesCount: rollupBranchesCount,
    totalStaffCount: rollupStaffCount,
    totalInventoryAtCost: Math.round(rollupInventoryCost * 100) / 100,
    totalInventoryAtMrp: Math.round(rollupInventoryMrp * 100) / 100,
    totalReceivables: Math.round(rollupReceivables * 100) / 100,
    totalPayables: Math.round(rollupPayables * 100) / 100,
  }

  return {
    platformSummary,
    chemists: chemistStats,
  }
}
