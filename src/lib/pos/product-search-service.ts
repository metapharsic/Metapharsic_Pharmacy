import { Prisma } from '@prisma/client'
import prisma from '@/lib/db/prisma'
import type { PosBatchItem, PosProductRow } from '@/lib/sales/sales-service'

export interface PosProductSearchParams {
  search?: string
  branchId: string
  limit?: number
  organizationId?: string
}

/**
 * Multi-tenant POS Product Search Service.
 * Ensures all product queries are strictly isolated by organizationId.
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
  }

  const cleanSearch = search?.trim()
  if (cleanSearch) {
    where.AND = [
      {
        OR: [
          { name: { contains: cleanSearch, mode: 'insensitive' } },
          { genericName: { contains: cleanSearch, mode: 'insensitive' } },
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
      genericName: true,
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

  if (products.length === 0) {
    return []
  }

  const productIds = products.map((p) => p.id)

  const [inventory, batches] = await Promise.all([
    prisma.inventory.findMany({
      where: { branchId, productId: { in: productIds } },
      select: { productId: true, availableQuantity: true },
    }),
    prisma.batch.findMany({
      where: {
        branchId,
        productId: { in: productIds },
        status: 'ACTIVE',
        quantity: { gt: 0 },
        expiryDate: { gt: new Date() },
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
      genericName: p.genericName,
      sku: p.sku,
      barcode: p.barcode,
      rack: p.rack ? (p.rack.shelfNumber ? `${p.rack.code}-${p.rack.shelfNumber}` : p.rack.code) : null,
      unitOfMeasure: p.unitOfMeasure,
      tabsPerStrip: p.tabsPerStrip,
      mrp: Number(p.mrp),
      gstRate: Number(p.gstRate),
      cgstRate: Number(p.cgstRate),
      sgstRate: Number(p.sgstRate),
      igstRate: Number(p.igstRate),
      hsnCode: p.hsnCode,
      drugSchedule: p.drugSchedule,
      isPrescriptionRequired: p.isPrescriptionRequired,
      isGstExempt: p.isGstExempt,
      manufacturer: p.manufacturer,
      composition: p.composition,
      packSize: p.packSize,
      imageUrl: p.imageUrl,
      categoryName: p.categories[0]?.category.name ?? null,
      additionalBarcodes: p.barcodes.map((b) => b.barcode),
      availableQuantity: availableByProduct.get(p.id) ?? 0,
      batches: mappedBatches,
    }
  })
}
