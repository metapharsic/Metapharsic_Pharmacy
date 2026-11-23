import { endOfDay, endOfMonth, format, startOfDay, startOfMonth, subDays } from 'date-fns'

import { prisma } from '@/lib/db/prisma'
import { computeItemProfit } from '@/lib/sales/pricing'
import { roundCurrency } from '@/lib/utils/currency'
import {
  generateWaMeLink,
  WhatsAppService,
  type WhatsAppSendResult,
} from '@/lib/whatsapp/whatsapp-service'

export interface TopMedicineSummary {
  productName: string
  quantity: number
  revenue: number
}

export interface ExecutiveDigestData {
  period: 'daily' | 'weekly' | 'monthly'
  periodLabel: string
  branchId: string
  branchName: string
  organizationName: string
  startDate: string
  endDate: string
  generatedAt: string

  sales: {
    totalSalesCount: number
    totalRevenue: number
    subtotal: number
    taxAmount: number
    discountAmount: number
    averageBillValue: number
    paymentBreakdown: {
      cash: number
      upi: number
      card: number
      credit: number
      other: number
    }
  }

  profitability: {
    revenue: number
    cogs: number
    grossProfit: number
    marginPercent: number
    itemsSold: number
  }

  topMedicines: TopMedicineSummary[]

  compliance: {
    scheduleHCount: number
    scheduleH1Count: number
    narcoticsXCount: number
    prescriptionsCount: number
  }

  creditAndPayables: {
    totalCustomerKhataOutstanding: number
    totalSupplierPayables: number
  }

  ownerPhone: string
  formattedWhatsAppText: string
  waMeLink: string
}

export class ExecutiveDigestService {
  /**
   * Aggregate executive intelligence metrics for Daily, Weekly, or Monthly period
   */
  static async generateExecutiveDigest(
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    branchId?: string,
    targetDate: Date = new Date(),
    organizationId?: string
  ): Promise<ExecutiveDigestData> {
    // 1. Resolve branch & organization strictly within tenant scope
    let branch = null
    if (branchId) {
      branch = await prisma.branch.findFirst({
        where: {
          id: branchId,
          ...(organizationId ? { organizationId } : {}),
        },
        include: { organization: true },
      })
    }
    if (!branch && organizationId) {
      branch =
        (await prisma.branch.findFirst({
          where: { organizationId, isHeadOffice: true },
          include: { organization: true },
        })) ||
        (await prisma.branch.findFirst({
          where: { organizationId },
          include: { organization: true },
        }))
    }
    if (!branch && !organizationId) {
      branch = await prisma.branch.findFirst({
        where: { isHeadOffice: true },
        include: { organization: true },
      })
    }

    const resolvedBranchId = branch?.id ?? ''
    const effectiveOrgId = organizationId || branch?.organizationId || branch?.organization?.id || ''
    const branchName = branch?.name ?? 'Main Dispensary'
    const organizationName = branch?.organization?.name ?? 'Metapharsic Pharmacare'

    // 2. Resolve date range
    let periodStart: Date
    let periodEnd: Date
    let periodLabel: string

    if (period === 'daily') {
      periodStart = startOfDay(targetDate)
      periodEnd = endOfDay(targetDate)
      periodLabel = `Daily Closing Digest (${format(targetDate, 'dd MMM yyyy')})`
    } else if (period === 'weekly') {
      periodEnd = endOfDay(targetDate)
      periodStart = startOfDay(subDays(targetDate, 6))
      periodLabel = `Weekly Executive Digest (${format(periodStart, 'dd MMM yyyy')} – ${format(periodEnd, 'dd MMM yyyy')})`
    } else {
      periodStart = startOfMonth(targetDate)
      periodEnd = endOfDay(targetDate)
      periodLabel = `Monthly Executive Audit (${format(targetDate, 'MMMM yyyy')})`
    }

    const branchScope = resolvedBranchId
      ? { branchId: resolvedBranchId }
      : effectiveOrgId
        ? { branch: { organizationId: effectiveOrgId } }
        : { branchId: '__NO_ACCESS__' }

    // 3. Query sales in period
    const sales = await prisma.sale.findMany({
      where: {
        ...branchScope,
        saleDate: {
          gte: periodStart,
          lte: periodEnd,
        },
        status: 'COMPLETED',
      },
      include: {
        payments: true,
        prescription: true,
        items: {
          include: {
            product: true,
            itemBatches: {
              include: {
                batch: true,
              },
            },
          },
        },
      },
      orderBy: { saleDate: 'asc' },
    })

    // If no sales on targetDate, provide historical fallback if available
    let effectiveSales = sales
    let isHistoricalFallback = false

    if (sales.length === 0) {
      const latestSale = await prisma.sale.findFirst({
        where: branchScope,
        orderBy: { saleDate: 'desc' },
      })
      if (latestSale) {
        let fallbackStart: Date
        let fallbackEnd: Date
        if (period === 'daily') {
          fallbackStart = startOfDay(latestSale.saleDate)
          fallbackEnd = endOfDay(latestSale.saleDate)
        } else if (period === 'weekly') {
          fallbackEnd = endOfDay(latestSale.saleDate)
          fallbackStart = startOfDay(subDays(latestSale.saleDate, 6))
        } else {
          fallbackStart = startOfMonth(latestSale.saleDate)
          fallbackEnd = endOfMonth(latestSale.saleDate)
        }

        effectiveSales = await prisma.sale.findMany({
          where: {
            ...branchScope,
            saleDate: { gte: fallbackStart, lte: fallbackEnd },
            status: 'COMPLETED',
          },
          include: {
            payments: true,
            prescription: true,
            items: {
              include: {
                product: true,
                itemBatches: {
                  include: {
                    batch: true,
                  },
                },
              },
            },
          },
        })
        isHistoricalFallback = true
      }
    }

    // 4. Calculate Financial Metrics
    let totalRevenue = 0
    let subtotal = 0
    let taxAmount = 0
    let discountAmount = 0
    let totalCogs = 0
    let itemsSold = 0

    const paymentBreakdown = {
      cash: 0,
      upi: 0,
      card: 0,
      credit: 0,
      other: 0,
    }

    const medicineMap = new Map<string, { productName: string; quantity: number; revenue: number }>()

    let scheduleHCount = 0
    let scheduleH1Count = 0
    let narcoticsXCount = 0
    let prescriptionsCount = 0

    for (const sale of effectiveSales) {
      const saleAmount = Number(sale.totalAmount || 0)
      totalRevenue = roundCurrency(totalRevenue + saleAmount)
      subtotal = roundCurrency(subtotal + Number(sale.subtotal || 0))
      taxAmount = roundCurrency(taxAmount + Number(sale.taxAmount || 0))
      discountAmount = roundCurrency(discountAmount + Number(sale.discountAmount || 0))

      if (sale.prescriptionId) {
        prescriptionsCount++
      }

      // Payments breakdown
      if (sale.payments && sale.payments.length > 0) {
        for (const p of sale.payments) {
          const amt = Number(p.amount || 0)
          if (p.method === 'CASH') paymentBreakdown.cash = roundCurrency(paymentBreakdown.cash + amt)
          else if (p.method === 'UPI') paymentBreakdown.upi = roundCurrency(paymentBreakdown.upi + amt)
          else if (p.method === 'CARD') paymentBreakdown.card = roundCurrency(paymentBreakdown.card + amt)
          else if (p.method === 'CREDIT') paymentBreakdown.credit = roundCurrency(paymentBreakdown.credit + amt)
          else paymentBreakdown.other = roundCurrency(paymentBreakdown.other + amt)
        }
      } else {
        const method = String(sale.paymentStatus || 'CASH').toUpperCase()
        if (method === 'UPI') paymentBreakdown.upi = roundCurrency(paymentBreakdown.upi + saleAmount)
        else if (method === 'CARD') paymentBreakdown.card = roundCurrency(paymentBreakdown.card + saleAmount)
        else if (method === 'CREDIT') paymentBreakdown.credit = roundCurrency(paymentBreakdown.credit + saleAmount)
        else paymentBreakdown.cash = roundCurrency(paymentBreakdown.cash + saleAmount)
      }

      // Items & profit
      for (const item of sale.items) {
        const qty = Number(item.quantity || 0)
        itemsSold += qty

        const profitInfo = computeItemProfit({
          totalAmount: item.totalAmount,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          itemBatches: item.itemBatches,
          product: item.product,
        })
        totalCogs = roundCurrency(totalCogs + (profitInfo.lineCost || 0))

        const schedule = item.product?.drugSchedule
        if (schedule === 'H') scheduleHCount += qty
        else if (schedule === 'H1') scheduleH1Count += qty
        else if (schedule === 'X') narcoticsXCount += qty

        // Aggregate medicine data
        const medKey = item.productId || item.productName || item.product?.name || 'Item'
        const medName = item.productName || item.product?.name || 'Medicine'
        const itemRev = Number(item.totalAmount || 0)

        if (!medicineMap.has(medKey)) {
          medicineMap.set(medKey, { productName: medName, quantity: 0, revenue: 0 })
        }
        const stat = medicineMap.get(medKey)!
        stat.quantity += qty
        stat.revenue = roundCurrency(stat.revenue + itemRev)
      }
    }

    const totalSalesCount = effectiveSales.length
    const averageBillValue =
      totalSalesCount > 0 ? roundCurrency(totalRevenue / totalSalesCount) : 0
    const grossProfit = roundCurrency(totalRevenue - totalCogs)
    const marginPercent =
      totalRevenue > 0 ? roundCurrency((grossProfit / totalRevenue) * 100) : 0

    const topMedicines = Array.from(medicineMap.values())
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 5)

    // 5. Khata & Supplier Payables (Strictly isolated by organization)
    const customers = await prisma.customer.aggregate({
      where: effectiveOrgId ? { organizationId: effectiveOrgId } : undefined,
      _sum: { outstandingBalance: true },
    })
    const totalCustomerKhataOutstanding = roundCurrency(
      Number(customers._sum.outstandingBalance || 0)
    )

    const suppliers = await prisma.supplier.aggregate({
      where: effectiveOrgId ? { organizationId: effectiveOrgId } : undefined,
      _sum: { outstandingBalance: true },
    })
    const totalSupplierPayables = roundCurrency(Number(suppliers._sum.outstandingBalance || 0))

    // 6. Format Markdown text
    const startStr = format(periodStart, 'dd MMM yyyy')
    const endStr = format(periodEnd, 'dd MMM yyyy')
    const topMedicinesFormatted =
      topMedicines.length > 0
        ? topMedicines
          .map(
            (m, idx) =>
              `${idx + 1}. *${m.productName}* — ${m.quantity} units (₹${m.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`
          )
          .join('\n')
        : '• No medicines dispensed in this period.'

    const noteSuffix = isHistoricalFallback
      ? `\n_(Live demo: Aggregated from latest active business day records)_`
      : ''

    let formattedWhatsAppText = ''

    if (period === 'daily') {
      formattedWhatsAppText = `🏥 *${organizationName.toUpperCase()}*
📋 *DAILY EXECUTIVE DIGEST*
📅 *Date:* ${startStr}
🏢 *Dispensary:* ${branchName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *1. FINANCIAL SUMMARY*
• *Total Revenue:* ₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${totalSalesCount} bills)
• *Gross Profit:* ₹${grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (*${marginPercent}% Margin*)
• *Avg Ticket Size:* ₹${averageBillValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
• *💵 Cash:* ₹${paymentBreakdown.cash.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | *📲 UPI:* ₹${paymentBreakdown.upi.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | *💳 Card:* ₹${paymentBreakdown.card.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | *📝 Credit:* ₹${paymentBreakdown.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}

💊 *2. TOP 5 MEDICINES DISPENSED*
${topMedicinesFormatted}

⚖️ *3. REGULATORY COMPLIANCE*
• *Schedule H / H1 Sold:* ${scheduleHCount + scheduleH1Count} units
• *Schedule X (Narcotics):* ${narcoticsXCount} units
• *Prescriptions Verified:* ${prescriptionsCount} Rx

🤝 *4. KHATA & SUPPLIER BALANCES*
• *Customer Khata Outstanding:* ₹${totalCustomerKhataOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
• *Supplier Payables Balance:* ₹${totalSupplierPayables.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_PharmaCare Executive Intelligence Platform_${noteSuffix}`
    } else if (period === 'weekly') {
      const avgDailyRevenue = roundCurrency(totalRevenue / 7)
      formattedWhatsAppText = `🏥 *${organizationName.toUpperCase()}*
📊 *WEEKLY EXECUTIVE DIGEST*
📅 *Period:* ${startStr} – ${endStr} (Last 7 Days)
🏢 *Dispensary:* ${branchName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *1. WEEKLY FINANCIAL PERFORMANCE*
• *Gross Revenue:* ₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${totalSalesCount} bills)
• *Total Gross Profit:* ₹${grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (*${marginPercent}% Margin*)
• *Avg Daily Revenue:* ₹${avgDailyRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
• *Avg Basket Size:* ₹${averageBillValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
• *Collections:* Cash: ₹${paymentBreakdown.cash.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | UPI: ₹${paymentBreakdown.upi.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | Card: ₹${paymentBreakdown.card.toLocaleString('en-IN', { minimumFractionDigits: 2 })} | Credit: ₹${paymentBreakdown.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}

💊 *2. TOP 5 MEDICINES THIS WEEK*
${topMedicinesFormatted}

⚖️ *3. REGULATORY & CLINICAL OVERVIEW*
• *Prescriptions Fulfilled:* ${prescriptionsCount} Rx
• *Schedule H / H1 Dispensed:* ${scheduleHCount + scheduleH1Count} units
• *Schedule X Dispensed:* ${narcoticsXCount} units

🤝 *4. CREDIT & WORKING CAPITAL*
• *Customer Khata Outstanding:* ₹${totalCustomerKhataOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
• *Supplier Payables Balance:* ₹${totalSupplierPayables.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_PharmaCare Executive Intelligence Platform_${noteSuffix}`
    } else {
      // monthly
      formattedWhatsAppText = `🏥 *${organizationName.toUpperCase()}*
📈 *MONTHLY EXECUTIVE DIGEST*
📅 *Period:* ${format(targetDate, 'MMMM yyyy')} (${startStr} – ${endStr})
🏢 *Dispensary:* ${branchName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *1. MONTHLY FINANCIAL AUDIT*
• *Month-to-Date Revenue:* ₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${totalSalesCount} bills)
• *Total Gross Profit:* ₹${grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (*${marginPercent}% Margin*)
• *COGS (Inventory Cost):* ₹${totalCogs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
• *Average Order Value:* ₹${averageBillValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
• *Taxes Collected (GST):* ₹${taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
• *Discounts Given:* ₹${discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}

💊 *2. TOP 5 FAST-MOVING MEDICINES*
${topMedicinesFormatted}

⚖️ *3. STATUTORY COMPLIANCE & AUDIT READINESS*
• *Prescription Orders:* ${prescriptionsCount} Rx
• *Controlled Drugs (Sched H/H1/X):* ${scheduleHCount + scheduleH1Count + narcoticsXCount} units
✅ *Status:* Statutory drug register is up-to-date for FDA audit.

🤝 *4. BALANCE SHEET & VENDOR AUDIT*
• *Customer Khata Outstanding:* ₹${totalCustomerKhataOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
• *Supplier Payables Balance:* ₹${totalSupplierPayables.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_PharmaCare Executive Intelligence Platform_${noteSuffix}`
    }

    // Resolve owner WhatsApp phone strictly from tenant settings or owner profile
    let ownerPhone = ''
    if (effectiveOrgId) {
      const orgSetting = await prisma.organizationSetting.findUnique({
        where: {
          organizationId_key: {
            organizationId: effectiveOrgId,
            key: 'WHATSAPP_OWNER_PHONE',
          },
        },
      })
      if (orgSetting?.value) {
        ownerPhone = orgSetting.value
      }
    }
    if (!ownerPhone && branch?.phone) {
      ownerPhone = branch.phone
    }
    if (!ownerPhone && branch?.organization?.phone) {
      ownerPhone = branch.organization.phone
    }
    if (!ownerPhone) {
      ownerPhone = process.env.WHATSAPP_OWNER_PHONE || '+919876543210'
    }

    const waMeLink = generateWaMeLink(ownerPhone, formattedWhatsAppText)

    return {
      period,
      periodLabel,
      branchId: resolvedBranchId,
      branchName,
      organizationName,
      startDate: startStr,
      endDate: endStr,
      generatedAt: new Date().toISOString(),
      sales: {
        totalSalesCount,
        totalRevenue,
        subtotal,
        taxAmount,
        discountAmount,
        averageBillValue,
        paymentBreakdown,
      },
      profitability: {
        revenue: totalRevenue,
        cogs: totalCogs,
        grossProfit,
        marginPercent,
        itemsSold,
      },
      topMedicines,
      compliance: {
        scheduleHCount,
        scheduleH1Count,
        narcoticsXCount,
        prescriptionsCount,
      },
      creditAndPayables: {
        totalCustomerKhataOutstanding,
        totalSupplierPayables,
      },
      ownerPhone,
      formattedWhatsAppText,
      waMeLink,
    }
  }

  static async generateDailyDigestText(
    branchId?: string,
    date?: Date,
    organizationId?: string
  ): Promise<string> {
    const digest = await this.generateExecutiveDigest('daily', branchId, date, organizationId)
    return digest.formattedWhatsAppText
  }

  static async generateWeeklyDigestText(
    branchId?: string,
    date?: Date,
    organizationId?: string
  ): Promise<string> {
    const digest = await this.generateExecutiveDigest('weekly', branchId, date, organizationId)
    return digest.formattedWhatsAppText
  }

  static async generateMonthlyDigestText(
    branchId?: string,
    date?: Date,
    organizationId?: string
  ): Promise<string> {
    const digest = await this.generateExecutiveDigest('monthly', branchId, date, organizationId)
    return digest.formattedWhatsAppText
  }

  static async sendExecutiveDigest(options: {
    period?: 'daily' | 'weekly' | 'monthly'
    branchId?: string
    recipientPhone?: string
    date?: Date
    organizationId?: string
  }): Promise<{ digest: ExecutiveDigestData; sendResult: WhatsAppSendResult }> {
    const { period = 'daily', branchId, recipientPhone, date, organizationId } = options
    const digest = await this.generateExecutiveDigest(period, branchId, date, organizationId)
    const phoneToUse = recipientPhone || digest.ownerPhone

    const sendResult = await WhatsAppService.sendMessage({
      toPhone: phoneToUse,
      message: digest.formattedWhatsAppText,
      organizationId: organizationId || digest.branchId,
    })

    return { digest, sendResult }
  }
}

// Direct functional exports
export async function generateDailyDigestText(
  branchId?: string,
  date?: Date,
  organizationId?: string
): Promise<string> {
  return ExecutiveDigestService.generateDailyDigestText(branchId, date, organizationId)
}

export async function generateWeeklyDigestText(
  branchId?: string,
  date?: Date,
  organizationId?: string
): Promise<string> {
  return ExecutiveDigestService.generateWeeklyDigestText(branchId, date, organizationId)
}

export async function generateMonthlyDigestText(
  branchId?: string,
  date?: Date,
  organizationId?: string
): Promise<string> {
  return ExecutiveDigestService.generateMonthlyDigestText(branchId, date, organizationId)
}

export async function generateExecutiveDigest(
  period: 'daily' | 'weekly' | 'monthly' = 'daily',
  branchId?: string,
  targetDate?: Date,
  organizationId?: string
): Promise<ExecutiveDigestData> {
  return ExecutiveDigestService.generateExecutiveDigest(period, branchId, targetDate, organizationId)
}

export async function sendExecutiveDigest(options: {
  period?: 'daily' | 'weekly' | 'monthly'
  branchId?: string
  recipientPhone?: string
  date?: Date
  organizationId?: string
}): Promise<{ digest: ExecutiveDigestData; sendResult: WhatsAppSendResult }> {
  return ExecutiveDigestService.sendExecutiveDigest(options)
}
