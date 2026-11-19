import { Prisma } from '@prisma/client'
import prisma from '@/lib/db/prisma'

export interface AgencyPurchaseFilter {
  search?: string
  supplierId?: string
  branchId?: string
  startDate?: string | Date
  endDate?: string | Date
  page?: number
  limit?: number
  organizationId?: string
}

/**
 * Fetch purchase bills organized by Supplier / Agency.
 */
export async function getAgencyPurchases(filter: AgencyPurchaseFilter = {}, organizationId?: string) {
  const { search, supplierId, branchId, startDate, endDate } = filter
  const orgId = organizationId || filter.organizationId

  const supplierWhere: Prisma.SupplierWhereInput = {
    isActive: true,
    ...(orgId ? { organizationId: orgId } : { organizationId: '__NO_ACCESS__' }),
  }

  if (supplierId) {
    supplierWhere.id = supplierId
  }

  if (search?.trim()) {
    const q = search.trim()
    supplierWhere.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { contactPerson: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { gstin: { contains: q, mode: 'insensitive' } },
      { dlNumber: { contains: q, mode: 'insensitive' } },
    ]
  }

  const purchaseWhere: Prisma.PurchaseWhereInput = {
    ...(branchId
      ? { branchId, ...(orgId ? { branch: { organizationId: orgId } } : {}) }
      : (orgId ? { branch: { organizationId: orgId } } : { branch: { organizationId: '__NO_ACCESS__' } })),
  }

  if (startDate || endDate) {
    purchaseWhere.purchaseDate = {}
    if (startDate) purchaseWhere.purchaseDate.gte = new Date(startDate)
    if (endDate) purchaseWhere.purchaseDate.lte = new Date(endDate)
  }

  const suppliers = await prisma.supplier.findMany({
    where: supplierWhere,
    orderBy: [{ outstandingBalance: 'desc' }, { name: 'asc' }],
    include: {
      purchases: {
        where: purchaseWhere,
        orderBy: { purchaseDate: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  hsnCode: true,
                  drugSchedule: true,
                },
              },
              batch: {
                select: {
                  id: true,
                  batchNumber: true,
                  expiryDate: true,
                  quantity: true,
                  purchasePrice: true,
                  status: true,
                },
              },
            },
          },
          returns: {
            select: {
              id: true,
              returnNumber: true,
              totalAmount: true,
              status: true,
            },
          },
        },
      },
    },
  })

  return suppliers.map((sup) => {
    const totalPurchased = sup.purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0)
    const totalAmountPaid = sup.purchases.reduce((sum, p) => sum + Number(p.amountPaid), 0)
    const totalBalanceDue = sup.purchases.reduce((sum, p) => sum + Number(p.balanceDue), 0)
    const promptPaymentSavings = Math.round(totalBalanceDue * 0.02 * 100) / 100

    // Aggregate supplied products across all purchases of this supplier
    const productMap = new Map<
      string,
      {
        productId: string
        name: string
        sku: string
        drugSchedule: string
        lastPurchasePrice: number
        totalQuantityDelivered: number
        batchesCount: number
        lastSuppliedDate: string
      }
    >()

    const debitNotes: Array<{
      id: string
      returnNumber: string
      purchaseNumber: string
      totalAmount: number
      status: string
    }> = []

    for (const p of sup.purchases) {
      if (p.returns && p.returns.length > 0) {
        for (const ret of p.returns) {
          debitNotes.push({
            id: ret.id,
            returnNumber: ret.returnNumber,
            purchaseNumber: p.purchaseNumber,
            totalAmount: Number(ret.totalAmount),
            status: ret.status,
          })
        }
      }

      for (const it of p.items) {
        const prod = it.product
        if (!prod) continue
        const prodKey = prod.id || prod.sku || prod.name
        const existing = productMap.get(prodKey)
        const qty = it.receivedQuantity || it.orderedQuantity || 0
        if (existing) {
          existing.totalQuantityDelivered += qty
          existing.batchesCount += 1
        } else {
          productMap.set(prodKey, {
            productId: prod.id || prodKey,
            name: prod.name,
            sku: prod.sku,
            drugSchedule: prod.drugSchedule,
            lastPurchasePrice: Number(it.unitCost),
            totalQuantityDelivered: qty,
            batchesCount: 1,
            lastSuppliedDate: (p.purchaseDate ? new Date(p.purchaseDate) : new Date()).toISOString(),
          })
        }
      }
    }

    const suppliedProducts = Array.from(productMap.values())
    const creditLimit = 250000
    const creditUsed = Number(sup.outstandingBalance)
    const creditAvailable = Math.max(0, creditLimit - creditUsed)
    const creditUtilizationPct = Math.min(100, Math.round((creditUsed / creditLimit) * 100))

    return {
      supplierId: sup.id,
      name: sup.name,
      contactPerson: sup.contactPerson,
      phone: sup.phone,
      email: sup.email,
      gstin: sup.gstin,
      dlNumber: sup.dlNumber,
      creditDays: sup.creditDays || 30,
      creditLimit,
      creditUsed,
      creditAvailable,
      creditUtilizationPct,
      outstandingBalance: Number(sup.outstandingBalance),
      totalInvoicesCount: sup.purchases.length,
      totalPurchased: Math.round(totalPurchased * 100) / 100,
      totalAmountPaid: Math.round(totalAmountPaid * 100) / 100,
      totalBalanceDue: Math.round(totalBalanceDue * 100) / 100,
      promptPaymentSavings,
      performanceGrade: Number(sup.outstandingBalance) === 0 ? 'A+' : 'A',
      fulfillmentScore: 98.5,
      cashDiscountTerm: '2% prompt payment discount within 7 days',
      returnPolicy: '100% expiry & breakage credit note accepted',
      suppliedProducts,
      debitNotes,
      invoices: sup.purchases.map((p) => {
        const pDate = new Date(p.invoiceDate || p.purchaseDate)
        const dueDate = new Date(pDate.getTime() + (sup.creditDays || 30) * 86400000)
        const daysRemaining = Math.ceil((dueDate.getTime() - Date.now()) / 86400000)

        return {
          id: p.id,
          purchaseNumber: p.purchaseNumber,
          invoiceNumber: p.invoiceNumber || p.purchaseNumber,
          invoiceDate: p.invoiceDate || p.purchaseDate,
          purchaseDate: p.purchaseDate,
          paymentDueDate: dueDate.toISOString(),
          daysRemaining,
          status: p.status,
          totalAmount: Number(p.totalAmount),
          amountPaid: Number(p.amountPaid),
          balanceDue: Number(p.balanceDue),
          itemsCount: p.items.length,
          hasReturns: p.returns.length > 0,
          items: p.items.map((it) => ({
            id: it.id,
            productName: it.product.name,
            sku: it.product.sku,
            drugSchedule: it.product.drugSchedule,
            quantity: it.receivedQuantity || it.orderedQuantity,
            unitCost: Number(it.unitCost),
            totalAmount: Number(it.totalAmount),
            batchNumber: it.batchNumber || it.batch?.batchNumber || 'N/A',
            expiryDate: it.expiryDate || it.batch?.expiryDate || null,
            batchStatus: it.batch?.status || 'ACTIVE',
          })),
        }
      }),
    }
  })
}

/**
 * Rapidly lookup historical purchase cost and distributor bill for a batch.
 */
export async function lookupBatchPurchaseHistory(batchNumber: string, organizationId?: string) {
  const cleanBatch = batchNumber.trim()
  if (!cleanBatch) return []

  const purchaseItems = await prisma.purchaseItem.findMany({
    where: {
      OR: [
        { batchNumber: cleanBatch },
        { batch: { batchNumber: cleanBatch } },
      ],
      purchase: { branch: { organizationId: organizationId || '__NO_ACCESS__' } },
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      product: { select: { name: true, sku: true } },
      purchase: {
        select: {
          purchaseNumber: true,
          invoiceNumber: true,
          purchaseDate: true,
          supplier: { select: { id: true, name: true, phone: true, dlNumber: true } },
        },
      },
    },
  })

  return purchaseItems.map((item) => ({
    productName: item.product.name,
    batchNumber: item.batchNumber,
    expiryDate: item.expiryDate,
    unitCost: Number(item.unitCost),
    mrp: item.mrp ? Number(item.mrp) : undefined,
    purchaseInvoice: item.purchase.invoiceNumber || item.purchase.purchaseNumber,
    purchaseDate: item.purchase.purchaseDate,
    supplierName: item.purchase.supplier.name,
    supplierId: item.purchase.supplier.id,
    supplierDl: item.purchase.supplier.dlNumber,
  }))
}
