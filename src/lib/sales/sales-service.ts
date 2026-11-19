// ─────────────────────────────────────────────────────────────
// Sales Service — POS create/read + Held Bills
//
// createSale is the transactional core of the POS:
//  1. Server-side authorization + settings-gated policy
//     (discount limits, credit sales, customer capture) —
//     the client NEVER sends a price, tax or discount amount.
//  2. Products are resolved by id / barcode / sku inside the same
//     transaction; prescription-gated items require a prescription.
//  3. Stock is consumed FEFO-first (or oldest-first when the
//     `inventory.fefo_enabled` setting is off) using the existing
//     pure allocation (`src/lib/batches/fefo.ts`), re-read and
//     deducted with optimistic CAS on the batch row. Fully consumed
//     batches flip to EXHAUSTED with a status log.
//  4. The product-branch inventory aggregate is decremented with a
//     CAS guarded by `updatedAt` (same pattern as stock
//     adjustments). `available = total - reserved` is preserved.
//  5. The whole mutation (sale + items + batch links + payments +
//     inventory movements + audit) commits as one transaction.
//     Oversell is impossible: under Serializable isolation a lost
//     CAS race aborts the loser, and the retry wrapper re-runs on
//     transient conflicts (P2034 / P2002).
//  6. Concurrency-safe invoice numbering uses the per-branch
//     `invoicePrefix` / `invoiceCounter` columns with its own CAS.
//
// Rollback and concurrency are exercised against a real Postgres
// in `sales-service.integration.test.ts`.
// ─────────────────────────────────────────────────────────────
import type { PaymentMethod, PaymentStatus } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { format } from 'date-fns'

import {
  allocateFefo,
  filterEligibleBatches,
  type FefoBatchCandidate,
  type FefoResult,
} from '@/lib/batches/fefo'
import { PERMISSIONS } from '@/lib/constants/permissions'
import prisma from '@/lib/db/prisma'
import { postGstTransactionForSale } from '@/lib/finance/gst-service'
import { assertBranchAccess } from '@/lib/inventory/branch-access'
import {
  computeItemPricing,
  computeItemProfit,
  computeSaleProfit,
  computeSaleTotals,
  round2,
  type ItemPricingRow,
} from '@/lib/sales/pricing'
import { getPosSettings } from '@/lib/settings/settings-service'
import { formatRack } from '@/lib/utils/rack'

// ─── Types ────────────────────────────────────────────────────

export interface SaleActor {
  id: string
  branchId: string | null
  permissions?: string[]
  roles?: string[]
}

export interface CreateSaleItemInput {
  productId?: string
  barcode?: string
  sku?: string
  batchId?: string
  quantity: number
  discountPercent?: number
  unitPrice?: number
  unit?: string
  isTabletSale?: boolean
  customUnitPrice?: number
}

export interface CreateSalePaymentInput {
  method: PaymentMethod
  amount: number
  reference?: string
}

export interface CreditCustomerInput {
  name: string
  phone?: string
}

export interface CreateSaleCommand {
  branchId: string
  items: CreateSaleItemInput[]
  payments: CreateSalePaymentInput[]
  customerId?: string
  customer?: CreditCustomerInput
  prescriptionId?: string
  doctorId?: string
  doctorName?: string
  doctorCommissionPercent?: number
  billDiscountPercent?: number
  roundOff?: number
  notes?: string
}

const saleProductSelect = {
  id: true,
  name: true,
  sku: true,
  barcode: true,
  isActive: true,
  isPrescriptionRequired: true,
  drugSchedule: true,
  mrp: true,
  ptr: true,
  costPrice: true,
  gstRate: true,
  cgstRate: true,
  sgstRate: true,
  igstRate: true,
  isGstExempt: true,
  hsnCode: true,
  unitOfMeasure: true,
  tabsPerStrip: true,
} as const

type SaleProduct = Prisma.ProductGetPayload<{ select: typeof saleProductSelect }>

export const saleListItemInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  commissions: { select: { doctor: { select: { id: true, name: true, regNumber: true } } } },
  createdBy: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      productSku: true,
      quantity: true,
      returnedQuantity: true,
      unitPrice: true,
      discountPercent: true,
      taxAmount: true,
      totalAmount: true,
      product: { select: { id: true, costPrice: true, ptr: true, mrp: true, tabsPerStrip: true } },
      itemBatches: {
        select: {
          id: true,
          quantity: true,
          batch: { select: { id: true, batchNumber: true, expiryDate: true, purchasePrice: true } },
        },
      },
    },
  },
  payments: {
    select: {
      id: true,
      method: true,
      amount: true,
      reference: true,
      createdAt: true,
    },
  },
} as const

export const saleDetailInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  createdBy: { select: { id: true, name: true } },
  branch: {
    select: {
      id: true,
      name: true,
      code: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      phone: true,
      email: true,
      gstin: true,
      dlNumber: true,
      organization: {
        select: {
          id: true,
          name: true,
          legalName: true,
          address: true,
          city: true,
          state: true,
          pincode: true,
          phone: true,
          email: true,
          gstin: true,
          dlNumber: true,
        },
      },
    },
  },
  prescription: {
    select: {
      id: true,
      prescriptionNumber: true,
      doctorName: true,
      doctorRegNumber: true,
      patientName: true,
    },
  },
  commissions: {
    select: {
      id: true,
      commissionPercent: true,
      commissionAmount: true,
      isPaid: true,
      doctor: {
        select: {
          id: true,
          name: true,
          regNumber: true,
          qualification: true,
          clinicName: true,
          phone: true,
        },
      },
    },
  },
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      product: { select: { id: true, costPrice: true, ptr: true, mrp: true, tabsPerStrip: true } },
      itemBatches: {
        include: {
          batch: { select: { id: true, batchNumber: true, expiryDate: true, purchasePrice: true } },
        },
      },
    },
  },
  payments: { orderBy: { createdAt: 'asc' } },
  returns: {
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      returnNumber: true,
      returnDate: true,
      totalAmount: true,
      status: true,
      refundMethod: true,
    },
  },
} as const

export type SaleListItem = Prisma.SaleGetPayload<{ include: typeof saleListItemInclude }>
export type SaleDetail = Prisma.SaleGetPayload<{ include: typeof saleDetailInclude }>

export interface SaleListParams {
  page?: number
  limit?: number
  search?: string
  branchId?: string
  organizationId?: string
  status?: string
  paymentStatus?: string
  fromDate?: string
  toDate?: string
  medicine?: string
  batchNumber?: string
  sortBy?: 'saleDate' | 'invoiceNumber' | 'totalAmount'
  sortOrder?: 'asc' | 'desc'
}

export interface SaleSummaryMetrics {
  billsCount: number
  salesValue: number
  amountReceived: number
  outstanding: number
  totalPurchaseCost: number
  totalProfit: number
  profitMarginPct: number
  purchaseCostComplete: boolean
  unpricedUnits: number
}

export type EnrichedSaleItem = SaleListItem['items'][number] & {
  purchaseCost: number
  profitAmount: number
  profitPct: number | null
  costBasis: number
}

export type EnrichedSaleListItem = Omit<SaleListItem, 'items'> & {
  purchaseCost: number
  profitAmount: number
  profitPct: number | null
  purchaseCostComplete: boolean
  purchaseUnpricedUnits: number
  items: EnrichedSaleItem[]
}

export interface SaleListResult {
  data: EnrichedSaleListItem[]
  pagination: { page: number; limit: number; total: number; pages: number }
  summary: SaleSummaryMetrics
}

export type EnrichedSaleDetail = Omit<SaleDetail, 'items'> & {
  purchaseCost: number
  profitAmount: number
  profitPct: number | null
  purchaseCostComplete: boolean
  purchaseUnpricedUnits: number
  items: (SaleDetail['items'][number] & {
    purchaseCost: number
    profitAmount: number
    profitPct: number | null
    costBasis: number
  })[]
  movements: SaleMovementTrace[]
}

interface InventoryMovementInput {
  inventoryId: string
  quantityBefore: number
  quantityAfter: number
  quantity: number
}

// ─── Pure helpers (unit tested) ───────────────────────────────

/**
 * Sum of real cash received (excludes CREDIT payments — those only
 * record the credit agreement, not money in hand).
 */
export function cashReceived(payments: CreateSalePaymentInput[]): number {
  return round2(payments.filter((p) => p.method !== 'CREDIT').reduce((s, p) => s + p.amount, 0))
}

export function derivePaymentStatus(
  payments: CreateSalePaymentInput[],
  totalAmount: number
): PaymentStatus {
  const paid = cashReceived(payments)
  if (payments.some((p) => p.method === 'CREDIT')) return 'CREDIT'
  if (paid > totalAmount) return 'OVERPAID'
  if (paid >= totalAmount) return 'PAID'
  return 'PARTIAL'
}

/** `INV-{code|BR}-0001` from the branch's counter. */
export function buildInvoiceNumber(prefix: string, code: string | null, sequence: number): string {
  const tag = (code?.trim() || 'BR').toUpperCase()
  return `${prefix}-${tag}-${String(sequence).padStart(4, '0')}`
}

// ─── Read: list + detail ──────────────────────────────────────

export async function listSales(
  params: SaleListParams,
  scope: string | null
): Promise<SaleListResult> {
  const {
    page = 1,
    limit = 20,
    search,
    branchId,
    status,
    paymentStatus,
    fromDate,
    toDate,
    medicine,
    batchNumber,
    sortBy = 'saleDate',
    sortOrder = 'desc',
  } = params

  const where: Prisma.SaleWhereInput = {}
  if (scope) where.branchId = scope
  else if (branchId) where.branchId = branchId
  if (params.organizationId) {
    where.branch = { organizationId: params.organizationId }
  }
  if (status) where.status = status as never
  if (paymentStatus) where.paymentStatus = paymentStatus as never

  if (fromDate || toDate) {
    where.saleDate = {}
    if (fromDate) {
      const d = new Date(fromDate)
      d.setHours(0, 0, 0, 0)
      where.saleDate.gte = d
    }
    if (toDate) {
      const d = new Date(toDate)
      d.setHours(23, 59, 59, 999)
      where.saleDate.lte = d
    }
  }

  if (medicine) {
    where.items = { some: { productName: { contains: medicine, mode: 'insensitive' } } }
  }

  if (batchNumber) {
    where.items = {
      some: {
        itemBatches: {
          some: {
            batch: { batchNumber: { contains: batchNumber, mode: 'insensitive' } },
          },
        },
      },
    }
  }

  if (search) {
    const s = search.trim()
    where.OR = [
      { invoiceNumber: { contains: s, mode: 'insensitive' } },
      { customer: { name: { contains: s, mode: 'insensitive' } } },
      { items: { some: { productName: { contains: s, mode: 'insensitive' } } } },
      {
        items: {
          some: {
            itemBatches: {
              some: {
                batch: { batchNumber: { contains: s, mode: 'insensitive' } },
              },
            },
          },
        },
      },
      { createdBy: { name: { contains: s, mode: 'insensitive' } } },
    ]
  }

  const orderBy = { [sortBy]: sortOrder } as Prisma.SaleOrderByWithRelationInput

  const skip = (page - 1) * limit
  const [data, total, aggregates, allItemsForProfit] = await Promise.all([
    prisma.sale.findMany({ where, skip, take: limit, orderBy, include: saleListItemInclude }),
    prisma.sale.count({ where }),
    prisma.sale.aggregate({
      where,
      _sum: {
        totalAmount: true,
        amountPaid: true,
        balanceDue: true,
      },
    }),
    prisma.saleItem.findMany({
      where: { sale: where },
      select: {
        productName: true,
        quantity: true,
        totalAmount: true,
        product: { select: { costPrice: true, ptr: true, tabsPerStrip: true } },
        itemBatches: {
          select: {
            quantity: true,
            batch: { select: { purchasePrice: true } },
          },
        },
      },
    }),
  ])

  let totalPurchaseCost = 0
  let totalUnpricedUnits = 0
  for (const it of allItemsForProfit) {
    const ip = computeItemProfit(it)
    totalPurchaseCost += ip.lineCost
    totalUnpricedUnits += ip.unpricedUnits
  }
  totalPurchaseCost = round2(totalPurchaseCost)
  const salesValue = Number(aggregates._sum.totalAmount ?? 0)
  const totalProfit = round2(salesValue - totalPurchaseCost)
  const profitMarginPct = salesValue > 0 ? round2((totalProfit / salesValue) * 100) : 0

  const summary: SaleSummaryMetrics = {
    billsCount: total,
    salesValue,
    amountReceived: Number(aggregates._sum.amountPaid ?? 0),
    outstanding: Number(aggregates._sum.balanceDue ?? 0),
    totalPurchaseCost,
    totalProfit,
    profitMarginPct,
    purchaseCostComplete: totalUnpricedUnits === 0,
    unpricedUnits: totalUnpricedUnits,
  }

  const enrichedData: EnrichedSaleListItem[] = data.map((s) => {
    const saleProfit = computeSaleProfit(s)
    const enrichedItems: EnrichedSaleItem[] = s.items.map((it) => {
      const itemProfit = computeItemProfit(it)
      return {
        ...it,
        purchaseCost: itemProfit.lineCost,
        profitAmount: itemProfit.lineProfit,
        profitPct: itemProfit.lineProfitPct,
        costBasis: itemProfit.effectiveCostBasis,
      }
    })
    return {
      ...s,
      purchaseCost: saleProfit.purchaseCost,
      profitAmount: saleProfit.profitAmount,
      profitPct: saleProfit.profitPct,
      purchaseCostComplete: saleProfit.purchaseCostComplete,
      purchaseUnpricedUnits: saleProfit.purchaseUnpricedUnits,
      items: enrichedItems,
    }
  })

  return {
    data: enrichedData,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    summary,
  }
}

export interface SaleMovementTrace {
  id: string
  inventoryId: string
  type: string
  quantity: number
  quantityBefore: number
  quantityAfter: number
  referenceType: string | null
  referenceId: string | null
  batchId: string | null
  notes: string | null
  createdAt: Date
  productName: string
  productSku: string
  unitOfMeasure: string
  batchNumber: string | null
  expiryDate: Date | null
}

export async function getSaleById(id: string, scope: string | null): Promise<EnrichedSaleDetail> {
  const sale = await prisma.sale.findUnique({ where: { id }, include: saleDetailInclude })
  if (!sale) throw new Error('Not Found: sale')
  if (scope && sale.branchId !== scope) {
    throw new Error(`Forbidden: no access to sale '${id}'`)
  }

  const rawMovements = await prisma.inventoryMovement.findMany({
    where: { referenceType: 'SALE', referenceId: id },
    include: {
      inventory: {
        include: {
          product: { select: { id: true, name: true, sku: true, unitOfMeasure: true } },
        },
      },
      batch: { select: { id: true, batchNumber: true, expiryDate: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const movements: SaleMovementTrace[] = rawMovements.map((m) => ({
    id: m.id,
    inventoryId: m.inventoryId,
    type: m.type,
    quantity: m.quantity,
    quantityBefore: m.quantityBefore,
    quantityAfter: m.quantityAfter,
    referenceType: m.referenceType,
    referenceId: m.referenceId,
    batchId: m.batchId,
    notes: m.notes,
    createdAt: m.createdAt,
    productName: m.inventory.product.name,
    productSku: m.inventory.product.sku,
    unitOfMeasure: m.inventory.product.unitOfMeasure,
    batchNumber: m.batch?.batchNumber ?? null,
    expiryDate: m.batch?.expiryDate ?? null,
  }))

  const saleProfit = computeSaleProfit(sale)
  const enrichedItems = sale.items.map((it) => {
    const itemProfit = computeItemProfit(it)
    return {
      ...it,
      purchaseCost: itemProfit.lineCost,
      profitAmount: itemProfit.lineProfit,
      profitPct: itemProfit.lineProfitPct,
      costBasis: itemProfit.effectiveCostBasis,
    }
  })

  return {
    ...sale,
    purchaseCost: saleProfit.purchaseCost,
    profitAmount: saleProfit.profitAmount,
    profitPct: saleProfit.profitPct,
    purchaseCostComplete: saleProfit.purchaseCostComplete,
    purchaseUnpricedUnits: saleProfit.purchaseUnpricedUnits,
    items: enrichedItems,
    movements,
  }
}

// ─── POS Product Search ───────────────────────────────────────

export interface PosBatchItem {
  id: string
  batchNumber: string
  expiryDate: string
  quantity: number
  availableQuantity: number
  mrp: number
  status: string
  isNearExpiry: boolean
  isFefoFirst: boolean
}

export interface PosProductRow {
  id: string
  name: string
  genericName: string | null
  sku: string
  barcode: string | null
  rack?: string | null
  unitOfMeasure: string
  tabsPerStrip?: number | null
  mrp: number
  gstRate: number
  cgstRate: number
  sgstRate: number
  igstRate: number
  hsnCode: string | null
  drugSchedule: string
  isPrescriptionRequired: boolean
  isGstExempt: boolean
  additionalBarcodes: string[]
  availableQuantity: number
  batches: PosBatchItem[]
  categoryName?: string | null
  manufacturer?: string | null
  composition?: string | null
  packSize?: string | null
  imageUrl?: string | null
}

/**
 * Fast cart search: active products matching a free-text term plus
 * their current available stock and active batches for one branch. Prices/GST are
 * returned for preview only — the authoritative amounts are always
 * recomputed server-side at sale time.
 */
export async function searchPosProducts(
  search: string | undefined,
  branchId: string,
  limit = 60,
  organizationId?: string
): Promise<PosProductRow[]> {
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(organizationId ? { organizationId } : {}),
    batches: { some: { branchId, status: 'ACTIVE', quantity: { gt: 0 } } },
  }
  const cleanSearch = search?.trim()
  if (cleanSearch) {
    where.AND = [
      {
        OR: [
          { name: { contains: cleanSearch, mode: 'insensitive' } },
          { nameAr: { contains: cleanSearch, mode: 'insensitive' } },
          { genericName: { contains: cleanSearch, mode: 'insensitive' } },
          { genericNameAr: { contains: cleanSearch, mode: 'insensitive' } },
          { sku: { contains: cleanSearch, mode: 'insensitive' } },
          { barcode: { contains: cleanSearch, mode: 'insensitive' } },
          { manufacturer: { contains: cleanSearch, mode: 'insensitive' } },
          { composition: { contains: cleanSearch, mode: 'insensitive' } },
          { barcodes: { some: { barcode: { contains: cleanSearch, mode: 'insensitive' } } } },
        ],
      },
    ]
  }

  const products = await prisma.product.findMany({
    where,
    take: limit,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      nameAr: true,
      genericName: true,
      genericNameAr: true,
      sku: true,
      barcode: true,
      rack: true,
      unitOfMeasure: true,
      tabsPerStrip: true,
      mrp: true,
      gstRate: true,
      cgstRate: true,
      sgstRate: true,
      igstRate: true,
      hsnCode: true,
      drugSchedule: true,
      isPrescriptionRequired: true,
      isGstExempt: true,
      manufacturer: true,
      composition: true,
      packSize: true,
      imageUrl: true,
      categories: {
        take: 1,
        select: {
          category: { select: { name: true } },
        },
      },
      barcodes: { select: { barcode: true } },
    },
  })

  const [inventory, batches] = await Promise.all([
    prisma.inventory.findMany({
      where: { branchId, productId: { in: products.map((p) => p.id) } },
      select: { productId: true, availableQuantity: true },
    }),
    prisma.batch.findMany({
      where: {
        branchId,
        productId: { in: products.map((p) => p.id) },
        status: 'ACTIVE',
        quantity: { gt: 0 },
        expiryDate: { gt: new Date() }, // Automated Expiry Block: hide and suppress expired batches
      },
      orderBy: { expiryDate: 'asc' },
      select: {
        id: true,
        productId: true,
        batchNumber: true,
        expiryDate: true,
        quantity: true,
        reservedQuantity: true,
        soldQuantity: true,
        purchasePrice: true,
        mrp: true,
        status: true,
      },
    }),
  ])

  const availableByProduct = new Map(inventory.map((i) => [i.productId, i.availableQuantity]))

  const batchesByProduct = new Map<string, typeof batches>()
  for (const b of batches) {
    const list = batchesByProduct.get(b.productId) ?? []
    list.push(b)
    batchesByProduct.set(b.productId, list)
  }

  const now = Date.now()
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000

  return products.map((p) => {
    const pBatches = (batchesByProduct.get(p.id) ?? []).filter(
      (b) => b.expiryDate.getTime() > now && b.status === 'ACTIVE'
    )
    let foundFirstFefo = false

    const mappedBatches: PosBatchItem[] = pBatches.map((b) => {
      const avail = b.quantity - b.reservedQuantity - b.soldQuantity
      const expTime = b.expiryDate.getTime()
      const isNearExpiry = expTime - now <= ninetyDaysMs
      let isFefoFirst = false
      if (!foundFirstFefo && avail > 0 && expTime > now) {
        isFefoFirst = true
        foundFirstFefo = true
      }
      return {
        id: b.id,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate.toISOString(),
        quantity: b.quantity,
        availableQuantity: Math.max(0, avail),
        mrp: Number(b.mrp),
        status: b.status,
        isNearExpiry,
        isFefoFirst,
      }
    })

    return {
      id: p.id,
      name: p.name,
      nameAr: (p as any).nameAr ?? null,
      genericName: p.genericName,
      genericNameAr: (p as any).genericNameAr ?? null,
      sku: p.sku,
      barcode: p.barcode,
      rack: p.rack ? formatRack(p.rack) : null,
      unitOfMeasure: p.unitOfMeasure,
      tabsPerStrip: p.tabsPerStrip ?? null,
      mrp: Number(p.mrp),
      gstRate: Number(p.gstRate),
      cgstRate: Number(p.cgstRate),
      sgstRate: Number(p.sgstRate),
      igstRate: Number(p.igstRate),
      hsnCode: p.hsnCode ?? null,
      drugSchedule: p.drugSchedule,
      isPrescriptionRequired: p.isPrescriptionRequired,
      isGstExempt: p.isGstExempt,
      additionalBarcodes: p.barcodes.map((b) => b.barcode).filter((b) => b !== p.barcode),
      availableQuantity: Math.max(
        availableByProduct.get(p.id) ?? 0,
        mappedBatches.reduce((sum, b) => sum + b.availableQuantity, 0)
      ),
      batches: mappedBatches,
      categoryName: p.categories[0]?.category.name ?? null,
      manufacturer: p.manufacturer ?? null,
      composition: p.composition ?? null,
      packSize: p.packSize ?? null,
      imageUrl: p.imageUrl ?? null,
    }
  })
}

// ─── Held Bills ───────────────────────────────────────────────

export interface CreateHeldBillCommand {
  branchId?: string
  label?: string
  cartData: Prisma.InputJsonValue
  customerId?: string
}

export async function createHeldBill(command: CreateHeldBillCommand, actor: SaleActor) {
  const branchId = command.branchId ?? actor.branchId
  if (!branchId) throw new Error('Branch is required')
  if (actor.branchId) {
    await assertBranchAccess(actor, branchId)
  } else {
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } })
    if (!branch) throw new Error('Not Found: branch')
  }

  return prisma.heldBill.create({
    data: {
      branchId,
      userId: actor.id,
      label: command.label ?? null,
      cartData: command.cartData,
      customerId: command.customerId ?? null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  })
}

export function listHeldBills(actor: SaleActor, branchId?: string, limit = 20) {
  return prisma.heldBill.findMany({
    where: { userId: actor.id, ...(branchId ? { branchId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function deleteHeldBill(id: string, actor: SaleActor): Promise<void> {
  const res = await prisma.heldBill.deleteMany({ where: { id, userId: actor.id } })
  if (res.count !== 1) throw new Error('Not Found: held bill')
}

// ─── Create Sale ──────────────────────────────────────────────

function isUniqueConstraintError(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'P2002'
  )
}

function isSerializationError(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'P2034'
  )
}

async function runWithRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      if (!isUniqueConstraintError(e) && !isSerializationError(e)) throw e
      lastError = e
      if (i === attempts - 1) {
        throw new Error('Conflict: a concurrent sale changed the data, please retry')
      }
    }
  }
  throw lastError
}

async function resolveProduct(
  tx: Prisma.TransactionClient,
  line: CreateSaleItemInput
): Promise<SaleProduct | null> {
  const where =
    line.productId !== undefined
      ? { id: line.productId }
      : line.barcode !== undefined
        ? { barcode: line.barcode }
        : { sku: line.sku }

  let product = tx.product.findFirst
    ? await tx.product.findFirst({ where, select: saleProductSelect })
    : await (tx.product as any).findUnique({ where, select: saleProductSelect })
  if (!product && line.barcode) {
    const barcodeRow = await tx.productBarcode.findUnique({
      where: { barcode: line.barcode },
      select: { productId: true },
    })
    if (barcodeRow) {
      product = await tx.product.findUnique({
        where: { id: barcodeRow.productId },
        select: saleProductSelect,
      })
    }
  }
  return product
}

interface BatchMove {
  batchId: string
  quantity: number
  unitPrice: number
}

type BatchRowWithAge = FefoBatchCandidate & { createdAt: Date }

/**
 * Non-FEFO allocation: same eligibility + greedy, but ordered by
 * oldest batch creation first (not earliest expiry). Used when the
 * `inventory.fefo_enabled` setting is off. Expired/blocked/disposed/
 * exhausted batches are still never selected.
 */
export function allocateByCreationDate(
  candidates: BatchRowWithAge[],
  requestedQuantity: number
): FefoResult {
  if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
    throw new Error('Requested quantity must be a positive integer')
  }
  const pool = filterEligibleBatches(candidates)
  if (pool.length === 0) {
    return {
      status: 'no_stock',
      requestedQuantity,
      allocatedQuantity: 0,
      shortfall: requestedQuantity,
      allocations: [],
    }
  }
  const createdAtById = new Map(candidates.map((c) => [c.id, c.createdAt.getTime()]))
  const sorted = [...pool].sort(
    (a, b) =>
      (createdAtById.get(a.batchId) ?? 0) - (createdAtById.get(b.batchId) ?? 0) ||
      a.batchId.localeCompare(b.batchId)
  )

  let remaining = requestedQuantity
  const allocations = []
  for (const batch of sorted) {
    if (remaining <= 0) break
    const take = Math.min(batch.availableQuantity, remaining)
    allocations.push({
      batchId: batch.batchId,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      allocatedQuantity: take,
      availableQuantityBefore: batch.availableQuantity,
      remainingQuantity: batch.availableQuantity - take,
    })
    remaining -= take
  }
  const allocatedQuantity = requestedQuantity - remaining
  if (remaining > 0) {
    return {
      status: 'insufficient',
      requestedQuantity,
      allocatedQuantity,
      shortfall: remaining,
      allocations,
    }
  }
  return { status: 'success', requestedQuantity, allocatedQuantity, allocations }
}

export async function createSale(
  command: CreateSaleCommand,
  actor: SaleActor
): Promise<SaleDetail> {
  const settings = await getPosSettings()
  const permissions = actor.permissions ?? []

  await assertBranchAccess(actor, command.branchId)

  // ─── Policy gates (server authority) ─────────────────────────
  const hasDiscount = permissions.includes(PERMISSIONS.SALES_DISCOUNT)
  const hasDiscountOverride = permissions.includes(PERMISSIONS.SALES_DISCOUNT_OVERRIDE)
  const hasCredit = permissions.includes(PERMISSIONS.SALES_CREDIT)

  for (const line of command.items) {
    const lineDiscount = line.discountPercent ?? 0
    if (lineDiscount <= 0) continue
    if (!hasDiscount) throw new Error('Forbidden: requires permission sales:discount')
    if (lineDiscount > settings.maxDiscountPercent && !hasDiscountOverride) {
      throw new Error(
        `Discount of ${lineDiscount}% exceeds the maximum allowed ${settings.maxDiscountPercent}%`
      )
    }
  }

  const usingCredit = command.payments.some((p) => p.method === 'CREDIT')
  if (usingCredit) {
    if (!hasCredit) throw new Error('Forbidden: requires permission sales:credit')
    if (!settings.allowCreditSales) throw new Error('Credit sales are disabled')
    if (settings.requireCustomerForCredit && !command.customerId && !command.customer) {
      throw new Error('A customer is required for credit sales')
    }
  }

  const received = cashReceived(command.payments)

  return runWithRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const branch = await tx.branch.findUnique({
          where: { id: command.branchId },
          select: { id: true, code: true, invoicePrefix: true, invoiceCounter: true },
        })
        if (!branch) throw new Error('Not Found: branch')

        // ─── Resolve products + prescription gate ────────────────
        const resolved: { product: SaleProduct; input: CreateSaleItemInput }[] = []
        for (const line of command.items) {
          const product = await resolveProduct(tx, line)
          if (!product) throw new Error('Not Found: product')
          if (!product.isActive) throw new Error(`Product is inactive: ${product.name}`)
          const needsPrescription = product.isPrescriptionRequired || product.drugSchedule === 'X'
          if (needsPrescription && !command.prescriptionId) {
            throw new Error(`Prescription required for ${product.name}`)
          }
          resolved.push({ product, input: line })
        }

        let resolvedPrescriptionId: string | null = null
        if (command.prescriptionId) {
          const trimmedRx = command.prescriptionId.trim()
          const rxById = await tx.prescription.findUnique({
            where: { id: trimmedRx },
            select: { id: true, branchId: true },
          })
          if (rxById) {
            if (rxById.branchId !== command.branchId) {
              throw new Error(
                `Forbidden: prescription does not belong to branch '${command.branchId}'`
              )
            }
            resolvedPrescriptionId = rxById.id
          } else {
            const rxByNum = await tx.prescription.findFirst({
              where: { prescriptionNumber: trimmedRx, branchId: command.branchId },
              select: { id: true },
            })
            if (rxByNum) {
              resolvedPrescriptionId = rxByNum.id
            } else {
              // Cashier entered a walk-in / paper prescription reference or affirmation at POS
              const isAffirmation = ['yes', 'verified', 'ok', 'rx', 'true', 'done'].includes(
                trimmedRx.toLowerCase()
              )
              const rxCode = isAffirmation
                ? `RX-WALKIN-${Date.now().toString().slice(-6)}`
                : trimmedRx

              const patientName = command.customer?.name || 'Walk-in Patient'
              const walkInRx = await tx.prescription.create({
                data: {
                  branchId: command.branchId,
                  prescriptionNumber: rxCode,
                  patientName,
                  patientPhone: command.customer?.phone ?? null,
                  doctorName: command.doctorName ?? null,
                  doctorId: command.doctorId ?? null,
                  status: 'APPROVED',
                  approvedById: actor.id,
                  approvedAt: new Date(),
                  notes: `Verified at POS counter (Input: ${trimmedRx})`,
                },
              })
              resolvedPrescriptionId = walkInRx.id
            }
          }
        }

        // ─── Customer (existing or minimal POS capture for credit) ─
        let customerId: string | null = command.customerId ?? null
        let customerPriceLevel: string | null = null
        if (customerId) {
          const customer = await tx.customer.findUnique({
            where: { id: customerId },
            select: { id: true, name: true, notes: true, isActive: true },
          })
          if (!customer) throw new Error('Not Found: customer')
          if (!customer.isActive) throw new Error('Customer is inactive')
          if (customer.notes?.toLowerCase().includes('stockist')) {
            customerPriceLevel = 'Stockist'
          } else if (
            customer.notes?.toLowerCase().includes('retailer') ||
            customer.name?.toLowerCase().includes('pharma') ||
            customer.name?.toLowerCase().includes('chemist')
          ) {
            customerPriceLevel = 'Retailer'
          }
        } else if (command.customer) {
          const created = await tx.customer.create({
            data: { name: command.customer.name, phone: command.customer.phone ?? null },
          })
          customerId = created.id
        }

        // ─── Per line: price, allocate stock, deduct with CAS ────
        const pricingLines: ItemPricingRow[] = []
        const saleItemInputs: Prisma.SaleItemCreateWithoutSaleInput[] = []
        const movements: InventoryMovementInput[] = []
        const nowTime = new Date()

        for (const { product, input } of resolved) {
          const quantity = input.quantity
          const inventory = await tx.inventory.findUnique({
            where: { productId_branchId: { productId: product.id, branchId: branch.id } },
          })
          if (!inventory)
            throw new Error(`Insufficient available stock: ${product.name} (available 0)`)
          if (inventory.availableQuantity < quantity) {
            throw new Error(
              `Insufficient available stock: ${product.name} (available ${inventory.availableQuantity})`
            )
          }

          const batchRows = await tx.batch.findMany({
            where: {
              productId: product.id,
              branchId: branch.id,
              status: 'ACTIVE',
              expiryDate: { gte: nowTime },
            },
            select: {
              id: true,
              batchNumber: true,
              productId: true,
              quantity: true,
              reservedQuantity: true,
              soldQuantity: true,
              status: true,
              expiryDate: true,
              branchId: true,
              mrp: true,
              createdAt: true,
            },
            orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
          })

          let allocation: FefoResult
          if (input.batchId) {
            const specificBatch = batchRows.find((b) => b.id === input.batchId)
            if (specificBatch) {
              const otherBatches = batchRows.filter((b) => b.id !== input.batchId)
              allocation = allocateFefo(
                filterEligibleBatches([
                  specificBatch as FefoBatchCandidate,
                  ...(otherBatches as FefoBatchCandidate[]),
                ]),
                quantity
              )
            } else {
              allocation = settings.fefoEnabled
                ? allocateFefo(filterEligibleBatches(batchRows as FefoBatchCandidate[]), quantity)
                : allocateByCreationDate(batchRows, quantity)
            }
          } else {
            allocation = settings.fefoEnabled
              ? allocateFefo(filterEligibleBatches(batchRows as FefoBatchCandidate[]), quantity)
              : allocateByCreationDate(batchRows, quantity)
          }

          if (allocation.status !== 'success') {
            throw new Error(
              `Insufficient available stock: ${product.name} (available ${allocation.allocatedQuantity})`
            )
          }

          const itemBatchMoves: BatchMove[] = []
          for (const a of allocation.allocations) {
            const batch = batchRows.find((b) => b.id === a.batchId)
            if (!batch) throw new Error('Conflict: batch changed concurrently, please retry')

            // Automated Expiry Block validation: prevent store staff from billing expired medications
            if (batch.expiryDate <= nowTime) {
              throw new Error(
                `Automated Expiry Block: Batch ${batch.batchNumber} expired on ${format(batch.expiryDate, 'dd-MMM-yyyy')} and cannot be billed`
              )
            }

            const newSold = batch.soldQuantity + a.allocatedQuantity
            const remaining = batch.quantity - batch.reservedQuantity - newSold

            const deducted = await tx.batch.updateMany({
              where: {
                id: batch.id,
                quantity: batch.quantity,
                soldQuantity: batch.soldQuantity,
                status: 'ACTIVE',
              },
              data: { soldQuantity: newSold },
            })
            if (deducted.count !== 1) {
              throw new Error('Conflict: batch changed concurrently, please retry')
            }

            if (remaining === 0 && batch.reservedQuantity === 0) {
              const exhausted = await tx.batch.updateMany({
                where: { id: batch.id, soldQuantity: newSold, status: 'ACTIVE' },
                data: { status: 'EXHAUSTED' },
              })
              if (exhausted.count !== 1) {
                throw new Error('Conflict: batch changed concurrently, please retry')
              }
              await tx.batchStatusLog.create({
                data: {
                  batchId: batch.id,
                  fromStatus: 'ACTIVE',
                  toStatus: 'EXHAUSTED',
                  reason: 'Stock depleted by POS sale',
                  changedById: actor.id,
                },
              })
            }

            itemBatchMoves.push({
              batchId: batch.id,
              quantity: a.allocatedQuantity,
              unitPrice: Number(batch.mrp),
            })
          }

          // Aggregate product-branch inventory deduction (CAS by updatedAt).
          const afterTotal = inventory.totalQuantity - quantity
          const afterAvailable = inventory.availableQuantity - quantity
          if (afterAvailable < 0) {
            throw new Error('Conflict: stock changed concurrently, please retry')
          }
          const inventoryCtx = await tx.inventory.updateMany({
            where: { id: inventory.id, updatedAt: inventory.updatedAt },
            data: { totalQuantity: afterTotal, availableQuantity: afterAvailable },
          })
          if (inventoryCtx.count !== 1) {
            throw new Error('Conflict: inventory changed concurrently, please retry')
          }
          movements.push({
            inventoryId: inventory.id,
            quantityBefore: inventory.totalQuantity,
            quantityAfter: afterTotal,
            quantity: -quantity,
          })

          const isTablet = Boolean(
            input.isTabletSale || input.unit === 'TABLET' || input.unit === 'Tablet'
          )
          const tabs = product.tabsPerStrip && product.tabsPerStrip > 1 ? product.tabsPerStrip : 1

          let effectiveMrp = Number(product.mrp)
          let lineName = product.name
          if (isTablet && tabs > 1) {
            effectiveMrp = round2(effectiveMrp / tabs)
            lineName = `${product.name} (${quantity} Tab${quantity > 1 ? 's' : ''})`
          }

          // Multi-Tier Pricing (Retailer vs Stockist vs Walk-in)
          let customUnitPrice: number | undefined = undefined
          if (customerPriceLevel === 'Retailer' && product.ptr) {
            customUnitPrice =
              isTablet && tabs > 1 ? round2(Number(product.ptr) / tabs) : Number(product.ptr)
          } else if (customerPriceLevel === 'Stockist' && product.costPrice) {
            customUnitPrice =
              isTablet && tabs > 1
                ? round2(Number(product.costPrice) / tabs)
                : Number(product.costPrice)
          } else if (isTablet && tabs > 1) {
            customUnitPrice = input.customUnitPrice ? round2(input.customUnitPrice) : effectiveMrp
          }

          const pricing = computeItemPricing({
            quantity,
            mrp: effectiveMrp,
            customUnitPrice,
            gstRate: Number(product.gstRate),
            cgstRate: Number(product.cgstRate),
            sgstRate: Number(product.sgstRate),
            igstRate: 0,
            isGstExempt: product.isGstExempt,
            discountPercent: input.discountPercent ?? 0,
            taxInclusive: settings.taxInclusive,
          })
          pricingLines.push(pricing)

          saleItemInputs.push({
            product: { connect: { id: product.id } },
            productName: lineName,
            productSku: product.sku,
            quantity,
            unitPrice: pricing.unitPrice,
            discountPercent: pricing.discountPercent,
            discountAmount: pricing.discountAmount,
            taxPercent: pricing.taxPercent,
            cgstPercent: pricing.cgstPercent,
            sgstPercent: pricing.sgstPercent,
            igstPercent: pricing.igstPercent,
            taxAmount: pricing.taxAmount,
            totalAmount: pricing.totalAmount,
            mrp: pricing.unitPrice,
            hsnCode: product.hsnCode ?? null,
            itemBatches: { create: itemBatchMoves },
          })
        }

        const totals = computeSaleTotals(pricingLines, {
          taxInclusive: settings.taxInclusive,
          roundOffTotal: settings.roundOffTotal,
        })

        // ─── Invoice number: atomic per-branch counter ───────────
        const sequence = branch.invoiceCounter
        const invoiceNumber = buildInvoiceNumber(branch.invoicePrefix, branch.code, sequence)
        const counterUpdate = await tx.branch.updateMany({
          where: { id: branch.id, invoiceCounter: sequence },
          data: { invoiceCounter: sequence + 1 },
        })
        if (counterUpdate.count !== 1) {
          throw new Error('Conflict: invoice counter changed concurrently, please retry')
        }

        const paymentStatus = derivePaymentStatus(command.payments, totals.totalAmount)
        const balanceDue = round2(Math.max(0, totals.totalAmount - received))

        // Doctor Commission Calculation
        const doctorCommPercent = command.doctorCommissionPercent ?? 0
        const doctorCommAmount =
          doctorCommPercent > 0 ? round2((totals.totalAmount * doctorCommPercent) / 100) : 0

        const sale = await tx.sale.create({
          data: {
            invoiceNumber,
            branchId: branch.id,
            customerId,
            prescriptionId: resolvedPrescriptionId,
            doctorName: command.doctorName ?? null,
            subtotal: totals.subtotal,
            discountAmount: totals.discountAmount,
            discountPercent: totals.discountPercent,
            taxAmount: totals.taxAmount,
            cgstAmount: totals.cgstAmount,
            sgstAmount: totals.sgstAmount,
            igstAmount: totals.igstAmount,
            totalAmount: totals.totalAmount,
            amountPaid: received,
            balanceDue,
            status: 'COMPLETED',
            paymentStatus,
            notes: command.notes ?? null,
            createdById: actor.id,
            items: { create: saleItemInputs },
            payments: {
              create: command.payments.map((p) => ({
                method: p.method,
                amount: p.amount,
                reference: p.reference ?? null,
                customerId: customerId ?? null,
              })),
            },
          },
          include: saleDetailInclude,
        })

        // Atomically record doctor commission entry if doctor tagged
        if (command.doctorId && doctorCommAmount > 0) {
          await tx.doctorCommission.create({
            data: {
              doctorId: command.doctorId,
              saleId: sale.id,
              saleAmount: totals.totalAmount,
              commissionPercent: doctorCommPercent,
              commissionAmount: doctorCommAmount,
              isPaid: false,
            },
          })
        }

        if (customerId && balanceDue > 0 && tx.customer?.findUnique && tx.customerLedger?.create) {
          const customer = await tx.customer.findUnique({ where: { id: customerId } })
          if (customer) {
            const newBal = customer.outstandingBalance.add(new Prisma.Decimal(balanceDue))
            await tx.customer.update({
              where: { id: customerId },
              data: { outstandingBalance: newBal },
            })
            await tx.customerLedger.create({
              data: {
                customerId,
                type: 'DEBIT',
                amount: new Prisma.Decimal(balanceDue),
                balance: newBal,
                description: `Credit sale invoice ${invoiceNumber}`,
                referenceType: 'SALE',
                referenceId: sale.id,
                entryDate: sale.saleDate,
              },
            })
          }
        }

        await postGstTransactionForSale(sale.id, tx)

        for (const m of movements) {
          await tx.inventoryMovement.create({
            data: {
              inventoryId: m.inventoryId,
              type: 'OUT',
              quantity: m.quantity,
              quantityBefore: m.quantityBefore,
              quantityAfter: m.quantityAfter,
              referenceType: 'SALE',
              referenceId: sale.id,
              batchId: null,
              notes: `POS sale ${sale.invoiceNumber}`,
              createdById: actor.id,
            },
          })
        }

        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'SALE_CREATE',
            entity: 'Sale',
            entityId: sale.id,
            metadata: {
              invoiceNumber: sale.invoiceNumber,
              totalAmount: totals.totalAmount,
              paymentStatus,
              itemCount: command.items.length,
            },
          },
        })

        return sale
      },
      { isolationLevel: 'Serializable', maxWait: 5000, timeout: 15000 }
    )
  )
}

export async function cancelSale(saleId: string, reason: string, actor: SaleActor): Promise<void> {
  const permissions = actor.permissions ?? []
  const roles = (actor as { roles?: string[] }).roles ?? []
  const isAuthorized =
    permissions.includes(PERMISSIONS.SALES_VOID) ||
    roles.some((r) => ['admin', 'owner', 'manager', 'super_admin'].includes(r.toLowerCase()))

  if (!isAuthorized) {
    throw new Error('Forbidden: requires permission sales:void or Admin role to cancel sales')
  }

  await runWithRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.findUnique({
          where: { id: saleId },
          include: {
            items: {
              include: {
                itemBatches: true,
              },
            },
            customer: true,
          },
        })
        if (!sale) throw new Error('Not Found: sale')
        if (sale.status === 'CANCELLED') throw new Error('Sale is already cancelled')

        await assertBranchAccess(actor, sale.branchId)

        // 1. Soft Delete: Update Sale Status and Record Justification
        await tx.sale.update({
          where: { id: saleId },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledReason: reason,
          },
        })

        // 2. Revert Inventory and Batch Stock (accounting for any partial returns)
        for (const item of sale.items) {
          const alreadyReturned = item.returnedQuantity || 0
          const netRestoreQty = Math.max(0, item.quantity - alreadyReturned)
          if (netRestoreQty <= 0) continue

          // Restore product-branch aggregate inventory
          const inv = await tx.inventory.findUnique({
            where: { productId_branchId: { productId: item.productId, branchId: sale.branchId } },
          })
          if (inv) {
            await tx.inventory.update({
              where: { id: inv.id },
              data: {
                totalQuantity: { increment: netRestoreQty },
                availableQuantity: { increment: netRestoreQty },
              },
            })

            // Record audit movement
            await tx.inventoryMovement.create({
              data: {
                inventoryId: inv.id,
                type: 'RETURN_IN',
                quantity: netRestoreQty,
                quantityBefore: inv.availableQuantity,
                quantityAfter: inv.availableQuantity + netRestoreQty,
                referenceType: 'SALE',
                referenceId: sale.id,
                batchId: item.itemBatches[0]?.batchId ?? null,
                notes: `Sale cancelled: ${sale.invoiceNumber} (${reason})`,
                createdById: actor.id,
              },
            })
          }

          // Restore batch sold quantities and reactivate EXHAUSTED batches
          let remainingToRestore = netRestoreQty
          for (const ib of item.itemBatches) {
            if (remainingToRestore <= 0) break
            const batchRestore = Math.min(ib.quantity, remainingToRestore)
            remainingToRestore -= batchRestore

            const batch = await tx.batch.findUnique({ where: { id: ib.batchId } })
            if (batch) {
              const newSold = Math.max(0, batch.soldQuantity - batchRestore)
              const shouldReactivate = batch.status === 'EXHAUSTED' && newSold < batch.quantity

              await tx.batch.update({
                where: { id: ib.batchId },
                data: {
                  soldQuantity: newSold,
                  status: shouldReactivate ? 'ACTIVE' : batch.status,
                },
              })

              if (shouldReactivate) {
                await tx.batchStatusLog.create({
                  data: {
                    batchId: batch.id,
                    fromStatus: 'EXHAUSTED',
                    toStatus: 'ACTIVE',
                    reason: `Batch reactivated after Admin cancelled sale ${sale.invoiceNumber}`,
                    changedById: actor.id,
                  },
                })
              }
            } else {
              await tx.batch.update({
                where: { id: ib.batchId },
                data: {
                  soldQuantity: { decrement: batchRestore },
                },
              })
            }
          }
        }

        // 3. Revert Customer Ledger & Outstanding Balance if Credit Sale
        const balanceDueNum = Number(sale.balanceDue)
        if (sale.customerId && balanceDueNum > 0 && (tx as any).customer && (tx as any).customerLedger) {
          const customer = await tx.customer.findUnique({ where: { id: sale.customerId } })
          if (customer) {
            const currentBal = new Prisma.Decimal(customer.outstandingBalance)
            const newBal = currentBal.sub(new Prisma.Decimal(balanceDueNum))
            await tx.customer.update({
              where: { id: sale.customerId },
              data: { outstandingBalance: newBal },
            })
            await tx.customerLedger.create({
              data: {
                customerId: sale.customerId,
                type: 'CREDIT',
                amount: new Prisma.Decimal(balanceDueNum),
                balance: newBal,
                description: `Reversal of credit invoice ${sale.invoiceNumber} (Sale Cancelled)`,
                referenceType: 'SALE',
                referenceId: sale.id,
                entryDate: new Date(),
              },
            })
          }
        }

        // 4. Clean up / Reverse GST & Doctor Commission records
        if ((tx as any).gstTransaction?.deleteMany) {
          await tx.gstTransaction.deleteMany({
            where: { referenceType: 'SALE', referenceId: sale.id },
          })
        }
        if ((tx as any).doctorCommission?.deleteMany) {
          await tx.doctorCommission.deleteMany({
            where: { saleId: sale.id },
          })
        }

        // 5. Mandatory Audit Log Entry
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'SALE_CANCEL',
            entity: 'Sale',
            entityId: sale.id,
            oldData: {
              status: sale.status,
              totalAmount: Number(sale.totalAmount),
              items: sale.items.map((i) => ({
                id: i.id,
                productId: i.productId,
                productName: i.productName,
                quantity: i.quantity,
                returnedQuantity: i.returnedQuantity,
              })),
            },
            newData: {
              status: 'CANCELLED',
              cancelledReason: reason,
              cancelledAt: new Date().toISOString(),
            },
            metadata: {
              invoiceNumber: sale.invoiceNumber,
              totalAmount: Number(sale.totalAmount),
              cancelledBy: actor.id,
              reason,
            },
          },
        })
      },
      { isolationLevel: 'Serializable', maxWait: 5000, timeout: 15000 }
    )
  )
}

export interface EditSaleItemInput {
  saleItemId: string
  quantity: number
  discountPercent?: number
}

export interface EditSaleInput {
  saleId: string
  items: EditSaleItemInput[]
  reason?: string
  refundCashDifference?: boolean
}

/**
 * Edit / Correct a completed sale (Admin workflow).
 * Example scenario: Medical staff mistakenly entered 1 extra tablet.
 * Admin edits the line item quantity to reduce it:
 *  1. Restores the extra tablet(s) back to the batch (soldQuantity decremented, status reactivated from EXHAUSTED to ACTIVE).
 *  2. Restores branch inventory (availableQuantity and totalQuantity incremented).
 *  3. Creates RETURN_IN inventory movement.
 *  4. Recalculates item pricing, CGST, SGST, and sale totals.
 *  5. Handles cash refund difference if customer was overpaid.
 *  6. Updates GST ledger and logs audit trail.
 */
export async function editSale(input: EditSaleInput, actor: SaleActor): Promise<SaleDetail> {
  const permissions = actor.permissions ?? []
  const roles = (actor as { roles?: string[] }).roles ?? []
  const canEdit =
    permissions.includes(PERMISSIONS.SALES_VOID) ||
    roles.some((r) => ['admin', 'owner', 'manager', 'super_admin'].includes(r.toLowerCase()))

  if (!canEdit) {
    throw new Error('Forbidden: requires permission sales:void or Admin role to edit sales')
  }

  const reason = input.reason?.trim() || 'Billing quantity mistake corrected by Admin'

  return runWithRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.findUnique({
          where: { id: input.saleId },
          include: {
            items: {
              include: {
                itemBatches: {
                  include: { batch: true },
                },
                product: true,
              },
            },
            payments: true,
            branch: true,
          },
        })

        if (!sale) throw new Error('Not Found: sale')
        if (sale.status !== 'COMPLETED') {
          throw new Error(`Cannot edit sale with status '${sale.status}'`)
        }

        await assertBranchAccess(actor, sale.branchId)

        // Process each line item edit
        for (const item of sale.items) {
          const itemInput = input.items.find((i) => i.saleItemId === item.id)
          if (!itemInput) continue // Unchanged line item

          const newQty = Math.max(0, Math.floor(itemInput.quantity))
          const oldQty = item.quantity
          const diff = oldQty - newQty // diff > 0 means returning stock to inventory

          if (diff > 0) {
            // Staff mistakenly added extra tablet(s) -> restore to batch & inventory
            let remainingToRestore = diff

            for (const ib of item.itemBatches) {
              if (remainingToRestore <= 0) break
              const restoreFromThisBatch = Math.min(ib.quantity, remainingToRestore)
              remainingToRestore -= restoreFromThisBatch

              // Decrement or delete itemBatch link
              if (ib.quantity - restoreFromThisBatch <= 0 && newQty === 0) {
                await tx.saleItemBatch.delete({ where: { id: ib.id } })
              } else {
                await tx.saleItemBatch.update({
                  where: { id: ib.id },
                  data: { quantity: Math.max(0, ib.quantity - restoreFromThisBatch) },
                })
              }

              // Update batch soldQuantity and reactivate if EXHAUSTED
              const batch = await tx.batch.findUnique({ where: { id: ib.batchId } })
              if (batch) {
                const newSold = Math.max(0, batch.soldQuantity - restoreFromThisBatch)
                const shouldReactivate = batch.status === 'EXHAUSTED' && newSold < batch.quantity
                await tx.batch.update({
                  where: { id: ib.batchId },
                  data: {
                    soldQuantity: newSold,
                    status: shouldReactivate ? 'ACTIVE' : batch.status,
                  },
                })
                if (shouldReactivate) {
                  await tx.batchStatusLog.create({
                    data: {
                      batchId: batch.id,
                      fromStatus: 'EXHAUSTED',
                      toStatus: 'ACTIVE',
                      reason: `Batch reactivated after Admin corrected sale ${sale.invoiceNumber}`,
                      changedById: actor.id,
                    },
                  })
                }
              }
            }

            // Restore product inventory
            const inv = await tx.inventory.findUnique({
              where: { productId_branchId: { productId: item.productId, branchId: sale.branchId } },
            })
            if (inv) {
              await tx.inventory.update({
                where: { id: inv.id },
                data: {
                  totalQuantity: { increment: diff },
                  availableQuantity: { increment: diff },
                },
              })

              await tx.inventoryMovement.create({
                data: {
                  inventoryId: inv.id,
                  type: 'RETURN_IN',
                  quantity: diff,
                  quantityBefore: inv.availableQuantity,
                  quantityAfter: inv.availableQuantity + diff,
                  referenceType: 'SALE',
                  referenceId: sale.id,
                  batchId: item.itemBatches[0]?.batchId ?? null,
                  notes: `Admin sale edit: ${sale.invoiceNumber} (restored ${diff} tablet(s) - ${reason})`,
                  createdById: actor.id,
                },
              })
            }
          } else if (diff < 0) {
            // Increasing quantity
            const addQty = Math.abs(diff)
            const inv = await tx.inventory.findUnique({
              where: { productId_branchId: { productId: item.productId, branchId: sale.branchId } },
            })
            if (!inv || inv.availableQuantity < addQty) {
              throw new Error(
                `Insufficient stock for ${item.productName}: only ${inv?.availableQuantity ?? 0} available`
              )
            }

            const primaryBatchId = item.itemBatches[0]?.batchId
            if (primaryBatchId) {
              const batch = await tx.batch.findUnique({ where: { id: primaryBatchId } })
              if (!batch || batch.quantity - batch.reservedQuantity - batch.soldQuantity < addQty) {
                throw new Error(`Insufficient batch stock for ${item.productName}`)
              }
              await tx.batch.update({
                where: { id: primaryBatchId },
                data: { soldQuantity: { increment: addQty } },
              })
              await tx.saleItemBatch.update({
                where: { id: item.itemBatches[0].id },
                data: { quantity: { increment: addQty } },
              })
            }

            await tx.inventory.update({
              where: { id: inv.id },
              data: {
                totalQuantity: { decrement: addQty },
                availableQuantity: { decrement: addQty },
              },
            })

            await tx.inventoryMovement.create({
              data: {
                inventoryId: inv.id,
                type: 'OUT',
                quantity: addQty,
                quantityBefore: inv.availableQuantity,
                quantityAfter: inv.availableQuantity - addQty,
                referenceType: 'SALE',
                referenceId: sale.id,
                batchId: primaryBatchId ?? null,
                notes: `Admin sale edit: ${sale.invoiceNumber} (added ${addQty} unit(s))`,
                createdById: actor.id,
              },
            })
          }

          // Update line item amounts
          if (newQty === 0) {
            await tx.saleItem.delete({ where: { id: item.id } })
          } else {
            const discPercent =
              itemInput.discountPercent !== undefined
                ? itemInput.discountPercent
                : Number(item.discountPercent)
            const product = item.product

            const pricing = computeItemPricing({
              mrp: Number(item.unitPrice),
              quantity: newQty,
              discountPercent: discPercent,
              gstRate: Number(product.gstRate),
              cgstRate: Number(product.cgstRate),
              sgstRate: Number(product.sgstRate),
              igstRate: Number(product.igstRate),
              isGstExempt: product.isGstExempt,
              taxInclusive: false,
            })

            await tx.saleItem.update({
              where: { id: item.id },
              data: {
                quantity: newQty,
                discountPercent: new Prisma.Decimal(pricing.discountPercent),
                discountAmount: new Prisma.Decimal(pricing.discountAmount),
                taxPercent: new Prisma.Decimal(pricing.taxPercent),
                cgstPercent: new Prisma.Decimal(pricing.cgstPercent),
                sgstPercent: new Prisma.Decimal(pricing.sgstPercent),
                igstPercent: new Prisma.Decimal(pricing.igstPercent),
                taxAmount: new Prisma.Decimal(pricing.taxAmount),
                totalAmount: new Prisma.Decimal(pricing.totalAmount),
              },
            })
          }
        }

        // Fetch remaining items
        const remainingItems = await tx.saleItem.findMany({
          where: { saleId: sale.id },
          include: { product: true },
        })

        if (remainingItems.length === 0) {
          throw new Error(
            'Cannot remove all items from sale. To cancel the entire bill, use Cancel Sale.'
          )
        }

        // Recalculate totals
        const pricingRows: ItemPricingRow[] = remainingItems.map((it) => {
          const gross = round2(Number(it.unitPrice) * it.quantity)
          const disc = round2(Number(it.discountAmount))
          const taxable = round2(gross - disc)
          return {
            quantity: it.quantity,
            unitPrice: Number(it.unitPrice),
            grossAmount: gross,
            discountPercent: Number(it.discountPercent),
            discountAmount: disc,
            lineAmount: taxable,
            taxPercent: Number(it.taxPercent),
            cgstPercent: Number(it.cgstPercent),
            sgstPercent: Number(it.sgstPercent),
            igstPercent: Number(it.igstPercent),
            taxableAmount: taxable,
            cgstAmount: round2((taxable * Number(it.cgstPercent)) / 100),
            sgstAmount: round2((taxable * Number(it.sgstPercent)) / 100),
            igstAmount: round2((taxable * Number(it.igstPercent)) / 100),
            taxAmount: Number(it.taxAmount),
            totalAmount: Number(it.totalAmount),
          }
        })

        const newTotals = computeSaleTotals(pricingRows, {
          taxInclusive: false,
          roundOffTotal: true,
        })

        // Payments & refund handling
        const currentPaid = Number(sale.amountPaid)
        let newAmountPaid = currentPaid
        let newBalanceDue = round2(Math.max(0, newTotals.totalAmount - currentPaid))
        let newPaymentStatus: PaymentStatus = 'PAID'

        if (currentPaid > newTotals.totalAmount) {
          const diffRefund = round2(currentPaid - newTotals.totalAmount)
          if (input.refundCashDifference !== false) {
            // Customer is refunded the difference in cash
            await tx.payment.create({
              data: {
                saleId: sale.id,
                customerId: sale.customerId,
                method: 'CASH',
                amount: new Prisma.Decimal(-diffRefund),
                reference: `Refund for mistake correction (${sale.invoiceNumber})`,
                notes: reason,
              },
            })
            newAmountPaid = newTotals.totalAmount
            newBalanceDue = 0
            newPaymentStatus = 'PAID'
          } else {
            newPaymentStatus = 'OVERPAID'
            newBalanceDue = 0
          }
        } else if (currentPaid === newTotals.totalAmount) {
          newPaymentStatus = 'PAID'
          newBalanceDue = 0
        } else {
          newBalanceDue = round2(newTotals.totalAmount - currentPaid)
          newPaymentStatus = currentPaid > 0 ? 'PARTIAL' : 'CREDIT'
        }

        const noteUpdate = `[Edited by Admin on ${format(new Date(), 'dd-MMM-yyyy HH:mm')}: ${reason}]`
        const finalNotes = sale.notes ? `${sale.notes}\n${noteUpdate}` : noteUpdate

        await tx.sale.update({
          where: { id: sale.id },
          data: {
            subtotal: new Prisma.Decimal(newTotals.subtotal),
            discountAmount: new Prisma.Decimal(newTotals.discountAmount),
            discountPercent: new Prisma.Decimal(newTotals.discountPercent),
            taxAmount: new Prisma.Decimal(newTotals.taxAmount),
            cgstAmount: new Prisma.Decimal(newTotals.cgstAmount),
            sgstAmount: new Prisma.Decimal(newTotals.sgstAmount),
            igstAmount: new Prisma.Decimal(newTotals.igstAmount),
            totalAmount: new Prisma.Decimal(newTotals.totalAmount),
            amountPaid: new Prisma.Decimal(newAmountPaid),
            balanceDue: new Prisma.Decimal(newBalanceDue),
            paymentStatus: newPaymentStatus,
            notes: finalNotes,
          },
        })

        // Re-post GST
        if (tx.gstTransaction?.deleteMany) {
          await tx.gstTransaction.deleteMany({
            where: { referenceType: 'SALE', referenceId: sale.id },
          })
        }
        await postGstTransactionForSale(sale.id, tx)

        // Audit Log
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'SALE_UPDATE',
            entity: 'Sale',
            entityId: sale.id,
            oldData: {
              totalAmount: Number(sale.totalAmount),
              subtotal: Number(sale.subtotal),
              items: sale.items.map((i) => ({
                id: i.id,
                productId: i.productId,
                productName: i.productName,
                quantity: i.quantity,
                totalAmount: Number(i.totalAmount),
              })),
            },
            newData: {
              totalAmount: newTotals.totalAmount,
              subtotal: newTotals.subtotal,
              items: remainingItems.map((i) => ({
                id: i.id,
                productId: i.productId,
                productName: i.productName,
                quantity: i.quantity,
                totalAmount: Number(i.totalAmount),
              })),
              reason,
            },
            metadata: {
              invoiceNumber: sale.invoiceNumber,
              oldTotal: Number(sale.totalAmount),
              newTotal: newTotals.totalAmount,
              reason,
            },
          },
        })

        const updated = await tx.sale.findUnique({
          where: { id: sale.id },
          include: saleDetailInclude,
        })
        return updated!
      },
      { isolationLevel: 'Serializable', maxWait: 5000, timeout: 15000 }
    )
  )
}

export interface SettleSalePaymentInput {
  saleId: string
  amount: number
  method: PaymentMethod
  reference?: string
  notes?: string
}

export async function settleSalePayment(
  input: SettleSalePaymentInput,
  actor: SaleActor
): Promise<SaleDetail> {
  const { saleId, amount, method, reference, notes } = input
  if (amount <= 0) {
    throw new Error('Payment amount must be greater than zero')
  }

  return runWithRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.findUnique({
          where: { id: saleId },
          include: { customer: true },
        })
        if (!sale) throw new Error('Not Found: sale')
        if (sale.status === 'CANCELLED') throw new Error('Cannot add payment to a cancelled sale')

        await assertBranchAccess(actor, sale.branchId)

        const currentBalance = Number(sale.balanceDue)
        if (currentBalance <= 0) {
          throw new Error('This bill has already been fully settled')
        }

        const paymentAmount = round2(Math.min(amount, currentBalance))
        const newPaid = round2(Number(sale.amountPaid) + paymentAmount)
        const newBalance = round2(Math.max(0, Number(sale.totalAmount) - newPaid))
        const newPaymentStatus: PaymentStatus = newBalance === 0 ? 'PAID' : 'PARTIAL'

        await tx.payment.create({
          data: {
            saleId: sale.id,
            customerId: sale.customerId,
            method,
            amount: paymentAmount,
            reference: reference?.trim() || null,
            notes: notes?.trim() || null,
          },
        })

        await tx.sale.update({
          where: { id: sale.id },
          data: {
            amountPaid: newPaid,
            balanceDue: newBalance,
            paymentStatus: newPaymentStatus,
          },
        })

        if (sale.customerId && tx.customer?.update && tx.customerLedger?.create) {
          const customer = await tx.customer.findUnique({ where: { id: sale.customerId } })
          if (customer) {
            const updatedCustBal = Prisma.Decimal.max(
              new Prisma.Decimal(0),
              customer.outstandingBalance.sub(new Prisma.Decimal(paymentAmount))
            )
            await tx.customer.update({
              where: { id: customer.id },
              data: { outstandingBalance: updatedCustBal },
            })
            await tx.customerLedger.create({
              data: {
                customerId: customer.id,
                type: 'CREDIT',
                amount: new Prisma.Decimal(paymentAmount),
                balance: updatedCustBal,
                description: `Payment against invoice ${sale.invoiceNumber} via ${method}`,
                referenceType: 'PAYMENT',
                referenceId: sale.id,
              },
            })
          }
        }

        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'SALE_PAYMENT_COLLECTED',
            entity: 'Sale',
            entityId: sale.id,
            metadata: {
              invoiceNumber: sale.invoiceNumber,
              method,
              amount: paymentAmount,
              newBalance,
              newPaymentStatus,
            },
          },
        })

        const updated = await tx.sale.findUnique({
          where: { id: sale.id },
          include: saleDetailInclude,
        })
        return updated!
      },
      { isolationLevel: 'Serializable', maxWait: 5000, timeout: 15000 }
    )
  )
}
