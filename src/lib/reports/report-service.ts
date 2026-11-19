import type { Prisma } from '@prisma/client'
import { addDays } from 'date-fns'

import { prisma } from '@/lib/db/prisma'
import { roundCurrency } from '@/lib/utils/currency'
import { runReportingWorker } from './reporting-worker-bridge'

interface ConsumptionEntry {
  productId: string
  productName: string
  sku: string
  totalConsumed: number
  salesConsumed: number
  otherConsumed: number
}

interface DailySalesEntry {
  date: string
  salesCount: number
  revenue: number
  tax: number
  discount: number
  averageBillValue?: number
}

export interface ReportPagination {
  page: number
  limit: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
}

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 500
const MAX_LIMIT = 2000
const FALLBACK_TIMEZONE = 'Asia/Kolkata'

function normalizePagination(pagination?: ReportPagination): { page: number; limit: number } {
  const page = Math.max(1, Math.floor(pagination?.page ?? DEFAULT_PAGE) || DEFAULT_PAGE)
  const rawLimit = Math.floor(pagination?.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT
  const limit = Math.min(Math.max(1, rawLimit), MAX_LIMIT)
  return { page, limit }
}

function paginate<T>(rows: T[], page: number, limit: number): PaginatedResult<T> {
  return {
    data: rows.slice((page - 1) * limit, page * limit),
    total: rows.length,
  }
}

/**
 * Resolve the business timezone for a branch via its organization.
 * Falls back to Asia/Kolkata (the schema default).
 */
async function resolveBranchTimezone(branchId: string): Promise<string> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { organization: { select: { timezone: true } } },
  })
  return branch?.organization?.timezone || FALLBACK_TIMEZONE
}

export class ReportService {
  /**
   * Daily Stock Position Report
   */
  static async getDailyStockPosition(branchId: string, pagination?: ReportPagination) {
    const { page, limit } = normalizePagination(pagination)
    const inventory = await prisma.inventory.findMany({
      where: { branchId },
      include: {
        product: true,
      },
      orderBy: {
        product: {
          name: 'asc',
        },
      },
    })

    const rows = inventory.map((inv) => ({
      productId: inv.productId,
      productName: inv.product.name,
      sku: inv.product.sku,
      batchTotal: inv.totalQuantity,
      availableQuantity: inv.availableQuantity,
      reservedQuantity: inv.reservedQuantity,
      mrp: Number(inv.product.mrp),
      value: roundCurrency(inv.availableQuantity * Number(inv.product.mrp)),
    }))
    return { ...paginate(rows, page, limit), page, limit }
  }

  /**
   * Near-Expiry Report
   */
  static async getNearExpiry(
    branchId: string,
    daysThreshold: number = 90,
    pagination?: ReportPagination
  ) {
    const { page, limit } = normalizePagination(pagination)
    const thresholdDate = addDays(new Date(), daysThreshold)

    const batches = await prisma.batch.findMany({
      where: {
        branchId,
        quantity: { gt: 0 },
        expiryDate: {
          lte: thresholdDate,
        },
      },
      include: {
        product: true,
      },
      orderBy: {
        expiryDate: 'asc',
      },
    })

    const rows = batches.map((batch) => ({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      productId: batch.productId,
      productName: batch.product.name,
      sku: batch.product.sku,
      expiryDate: batch.expiryDate,
      quantity: batch.quantity,
      daysToExpiry: Math.ceil(
        (batch.expiryDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24)
      ),
    }))
    return { ...paginate(rows, page, limit), page, limit }
  }

  /**
   * Narcotic Register
   */
  static async getNarcoticRegister(
    branchId: string,
    startDate?: Date,
    endDate?: Date,
    pagination?: ReportPagination
  ) {
    const { page, limit } = normalizePagination(pagination)
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        inventory: {
          branchId,
          product: {
            drugSchedule: {
              in: ['X', 'H1'],
            },
          },
        },
        ...(startDate && endDate ? { createdAt: { gte: startDate, lte: endDate } } : {}),
      },
      include: {
        inventory: {
          include: {
            product: true,
          },
        },
        batch: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const rows = movements.map((m) => ({
      id: m.id,
      date: m.createdAt,
      type: m.type,
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      productName: m.inventory.product.name,
      drugSchedule: m.inventory.product.drugSchedule,
      batchNumber: m.batch?.batchNumber,
      quantity: m.quantity,
      quantityBefore: m.quantityBefore,
      quantityAfter: m.quantityAfter,
      notes: m.notes,
    }))
    return { ...paginate(rows, page, limit), page, limit }
  }

  /**
   * Consumption Report
   */
  static async getConsumptionReport(
    branchId: string,
    startDate: Date,
    endDate: Date,
    pagination?: ReportPagination
  ) {
    const { page, limit } = normalizePagination(pagination)
    // Consumption = stock dispensed via sales. Other OUT movements
    // (purchase returns to suppliers, adjustments, write-offs, transfers)
    // are stock movements but not consumption, so they are excluded.
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        type: 'OUT',
        referenceType: 'SALE',
        inventory: { branchId },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        inventory: {
          include: {
            product: true,
          },
        },
      },
    })

    const consumptionMap = new Map<string, ConsumptionEntry>()

    for (const m of movements) {
      const pId = m.inventory.productId
      if (!consumptionMap.has(pId)) {
        consumptionMap.set(pId, {
          productId: pId,
          productName: m.inventory.product.name,
          sku: m.inventory.product.sku,
          totalConsumed: 0,
          salesConsumed: 0,
          otherConsumed: 0,
        })
      }
      const entry = consumptionMap.get(pId)
      if (entry) {
        entry.totalConsumed += m.quantity
        if (m.referenceType === 'SALE') {
          entry.salesConsumed += m.quantity
        } else {
          entry.otherConsumed += m.quantity
        }
      }
    }

    const rows = Array.from(consumptionMap.values()).sort(
      (a, b) => b.totalConsumed - a.totalConsumed
    )
    return { ...paginate(rows, page, limit), page, limit }
  }

  /**
   * Supplier Performance Report
   */
  static async getSupplierPerformance(
    branchId: string,
    startDate: Date,
    endDate: Date,
    pagination?: ReportPagination
  ) {
    const { page, limit } = normalizePagination(pagination)
    const suppliers = await prisma.supplier.findMany({
      include: {
        purchases: {
          where: {
            branchId,
            purchaseDate: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
    })

    const rows = suppliers
      .filter((supplier) => supplier.purchases.length > 0)
      .map((supplier) => {
        const totalPurchases = supplier.purchases.length
        const completedPurchases = supplier.purchases.filter(
          (p) => p.status === 'RECEIVED' || p.status === 'INVOICED'
        ).length
        const totalAmount = roundCurrency(
          supplier.purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0)
        )

        return {
          supplierId: supplier.id,
          supplierName: supplier.name,
          totalPurchases,
          completedPurchases,
          fulfillmentRate:
            totalPurchases > 0 ? roundCurrency((completedPurchases / totalPurchases) * 100) : 0,
          totalAmount,
          // NOTE: outstandingBalance is supplier-global (not branch-scoped in the schema).
          outstandingBalance: Number(supplier.outstandingBalance),
        }
      })
      .sort((a, b) => b.totalAmount - a.totalAmount)
    return { ...paginate(rows, page, limit), page, limit }
  }

  /**
   * Sales & Financial Report (Multi-Threaded Calculation)
   */
  static async getSalesFinancials(branchId: string, startDate: Date, endDate: Date) {
    // Revenue semantics: only COMPLETED sales contribute to revenue.
    // Returned/cancelled sales are reported separately.
    const [sales, excludedSalesCount] = await Promise.all([
      prisma.sale.findMany({
        where: {
          branchId,
          saleDate: {
            gte: startDate,
            lte: endDate,
          },
          status: 'COMPLETED',
        },
        orderBy: {
          saleDate: 'asc',
        },
      }),
      prisma.sale.count({
        where: {
          branchId,
          saleDate: { gte: startDate, lte: endDate },
          status: { in: ['CANCELLED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED'] },
        },
      }),
    ])
    const timeZone = await resolveBranchTimezone(branchId)

    // Offload CPU-heavy daily business-day bucketing to worker thread
    const result = await runReportingWorker<
      {
        sales: Array<{
          totalAmount: unknown
          taxAmount: unknown
          discountAmount: unknown
          status: string
          saleDate: Date
        }>
        timeZone: string
        excludedSalesCount: number
      },
      {
        totalSalesCount: number
        totalRevenue: number
        totalTax: number
        totalDiscount: number
        excludedSalesCount: number
        averageOrderValue: number
        dailyBreakdown: DailySalesEntry[]
      }
    >('COMPUTE_SALES_FINANCIALS', {
      sales,
      timeZone,
      excludedSalesCount,
    })

    return result
  }

  /**
   * Schedule H & H1 Compliance Register for Drug Inspector Audits (Multi-Threaded Audit)
   */
  static async getScheduleHRegister(
    branchId: string,
    filter: { startDate?: Date; endDate?: Date; scheduleType?: 'H' | 'H1' | 'ALL' } = {},
    pagination?: ReportPagination
  ) {
    const { page = 1, limit = 50 } = pagination ?? {}
    const schedules =
      filter.scheduleType === 'H' ? ['H'] : filter.scheduleType === 'H1' ? ['H1'] : ['H', 'H1']

    const where: Prisma.SaleItemWhereInput = {
      product: { drugSchedule: { in: schedules as any } },
      sale: {
        branchId,
        status: 'COMPLETED',
        ...(filter.startDate || filter.endDate
          ? {
              saleDate: {
                ...(filter.startDate ? { gte: filter.startDate } : {}),
                ...(filter.endDate ? { lte: filter.endDate } : {}),
              },
            }
          : {}),
      },
    }

    const [total, items] = await Promise.all([
      prisma.saleItem.count({ where }),
      prisma.saleItem.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { sale: { saleDate: 'desc' } },
        include: {
          product: { select: { name: true, composition: true, drugSchedule: true } },
          itemBatches: {
            include: {
              batch: { select: { batchNumber: true, expiryDate: true } },
            },
          },
          sale: {
            select: {
              invoiceNumber: true,
              saleDate: true,
              customer: { select: { name: true, phone: true, address: true } },
              prescription: {
                select: {
                  patientName: true,
                  patientAge: true,
                  doctorName: true,
                  doctorRegNumber: true,
                  doctor: { select: { name: true, regNumber: true, clinicName: true } },
                },
              },
              doctorName: true,
            },
          },
        },
      }),
    ])

    const rawRows = items.map((it) => {
      const b = it.itemBatches[0]?.batch
      const patientName =
        it.sale.prescription?.patientName || it.sale.customer?.name || 'Walk-in Patient'
      const patientPhone = it.sale.customer?.phone || null
      const patientAddress = it.sale.customer?.address || null
      const doctorName =
        it.sale.prescription?.doctor?.name ||
        it.sale.prescription?.doctorName ||
        it.sale.doctorName ||
        'Prescription Attached'
      const doctorRegNumber =
        it.sale.prescription?.doctor?.regNumber ||
        it.sale.prescription?.doctorRegNumber ||
        null

      return {
        id: it.id,
        invoiceNumber: it.sale.invoiceNumber,
        date: it.sale.saleDate,
        patientName,
        patientPhone,
        patientAddress,
        doctorName,
        doctorRegNumber,
        productName: it.product.name,
        composition: it.product.composition,
        schedule: it.product.drugSchedule,
        batchNumber: b?.batchNumber || 'Primary',
        expiryDate: b?.expiryDate || null,
        quantity: it.quantity,
        rate: Number(it.unitPrice),
        totalAmount: Number(it.totalAmount),
      }
    })

    // Offload statutory compliance audit flags to worker thread
    const audited = await runReportingWorker<
      { rows: typeof rawRows },
      {
        data: typeof rawRows &
          Array<{
            complianceStatus: string
            complianceFlags: string[]
            isScheduleH1: boolean
          }>
        complianceMetrics: {
          totalEntries: number
          compliantEntries: number
          warningEntries: number
          criticalEntries: number
          complianceRatePercent: number
        }
      }
    >('AUDIT_SCHEDULE_H_COMPLIANCE', {
      rows: rawRows,
    })

    return {
      data: audited.data,
      metrics: audited.complianceMetrics,
      total,
      page,
      limit,
    }
  }

  /**
   * Sales, Purchase Cost (COGS), and Gross Profit Analytics (Multi-Threaded)
   */
  static async getGrossProfitReport(
    branchId: string,
    filter: { startDate?: Date; endDate?: Date } = {}
  ) {
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          branchId,
          status: 'COMPLETED',
          ...(filter.startDate || filter.endDate
            ? {
                saleDate: {
                  ...(filter.startDate ? { gte: filter.startDate } : {}),
                  ...(filter.endDate ? { lte: filter.endDate } : {}),
                },
              }
            : {}),
        },
      },
      include: {
        product: { select: { name: true, sku: true, categories: { include: { category: true } } } },
        itemBatches: {
          include: {
            batch: { select: { purchasePrice: true, mrp: true } },
          },
        },
      },
    })

    const rawItems = saleItems.map((it) => ({
      id: it.id,
      productName: it.product.name,
      sku: it.product.sku,
      categoryName: it.product.categories[0]?.category.name || 'General',
      quantity: it.quantity,
      totalAmount: Number(it.totalAmount),
      purchasePrice: Number(it.itemBatches[0]?.batch?.purchasePrice || 0),
    }))

    // Offload COGS, profit margins, and category rollups to worker thread
    const result = await runReportingWorker<
      { saleItems: typeof rawItems },
      {
        summary: {
          totalRevenue: number
          totalCogs: number
          grossProfit: number
          profitMarginPercent: number
          totalItemsSold: number
        }
        categoryBreakdown: Array<{
          category: string
          totalItemsSold: number
          revenue: number
          cogs: number
          grossProfit: number
          profitMarginPercent: number
        }>
        items: Array<{
          id: string
          productName: string
          sku: string
          category: string
          quantity: number
          saleRevenue: number
          purchaseCost: number
          grossProfit: number
          profitMargin: number
        }>
      }
    >('COMPUTE_GROSS_PROFIT', {
      saleItems: rawItems,
    })

    return result
  }

  /**
   * Doctor Referrals, Sales Conversion & Commissions (Multi-Threaded)
   */
  static async getDoctorPerformanceReport(search?: string, organizationId?: string) {
    const where: Prisma.DoctorWhereInput = {
      ...(organizationId ? { organizationId } : {}),
    }
    if (search?.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { regNumber: { contains: search.trim(), mode: 'insensitive' } },
        { specialization: { contains: search.trim(), mode: 'insensitive' } },
        { clinicName: { contains: search.trim(), mode: 'insensitive' } },
      ]
    }

    const doctors = await prisma.doctor.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            prescriptions: true,
            commissions: true,
          },
        },
        prescriptions: {
          select: {
            id: true,
            sales: {
              select: {
                id: true,
                totalAmount: true,
                saleDate: true,
                status: true,
              },
            },
          },
        },
        commissions: {
          select: {
            id: true,
            commissionAmount: true,
            isPaid: true,
            sale: {
              select: {
                id: true,
                totalAmount: true,
                status: true,
              },
            },
          },
        },
      },
    })

    // Offload de-duplication, referral metrics & commission aggregation to worker thread
    const result = await runReportingWorker<
      { doctors: typeof doctors },
      Array<{
        id: string
        name: string
        regNumber: string
        qualification: string
        specialization: string
        clinicName: string
        phone: string
        email: string
        commissionPercent: number
        isActive: boolean
        prescriptionsCount: number
        salesCount: number
        totalSalesRevenue: number
        totalCommission: number
        paidCommission: number
        pendingCommission: number
        conversionRatePercent: number
        averageBillValue: number
      }>
    >('AGGREGATE_DOCTOR_REFERRALS', {
      doctors,
    })

    return result
  }
}
