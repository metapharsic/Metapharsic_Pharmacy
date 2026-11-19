import { Prisma } from '@prisma/client'
import prisma from '@/lib/db/prisma'
import { assertBranchAccess, type AuthUser } from '@/lib/inventory/branch-access'

export interface LowStockCandidate {
  productId: string
  productName: string
  sku: string
  barcode: string | null
  unitOfMeasure: string
  branchId: string
  branchName: string
  availableQuantity: number
  totalQuantity: number
  reorderLevel: number
  minStockLevel: number
  maxStockLevel: number | null
  suggestedQuantity: number
  estimatedUnitCost: number
  mrp: number
  taxPercent: number
  suggestedSupplierId: string | null
  suggestedSupplierName: string | null
  hasPendingPo: boolean
  pendingPoNumber: string | null
}

export interface GeneratedPoItemSummary {
  productId: string
  productName: string
  sku: string
  orderedQuantity: number
  unitCost: number
  taxPercent: number
  taxAmount: number
  totalAmount: number
}

export interface AutoPoSummary {
  purchaseId: string
  purchaseNumber: string
  supplierId: string
  supplierName: string
  branchId: string
  branchName: string
  itemCount: number
  totalQuantity: number
  subtotal: number
  taxAmount: number
  totalAmount: number
  status: string
  items: GeneratedPoItemSummary[]
}

export interface GenerateAutoPoInput {
  branchId?: string
  items?: {
    productId: string
    branchId: string
    supplierId: string
    orderedQuantity: number
    unitCost?: number
  }[]
}

/**
 * Identify all inventory items currently at or below their reorder level.
 * Computes suggested reorder quantity, identifies historical supplier, and checks for open POs.
 */
export async function getLowStockCandidates(
  branchId?: string,
  organizationId?: string
): Promise<LowStockCandidate[]> {
  const whereInventory: Prisma.InventoryWhereInput = {
    product: {
      isActive: true,
      ...(organizationId ? { organizationId } : {}),
    },
    ...(branchId && branchId !== 'all'
      ? { branchId, ...(organizationId ? { branch: { organizationId } } : {}) }
      : organizationId
        ? { branch: { organizationId } }
        : {}),
  }

  const inventoryRecords = await prisma.inventory.findMany({
    where: whereInventory,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          unitOfMeasure: true,
          reorderLevel: true,
          minStockLevel: true,
          maxStockLevel: true,
          costPrice: true,
          ptr: true,
          mrp: true,
          gstRate: true,
        },
      },
      branch: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ branch: { name: 'asc' } }, { product: { name: 'asc' } }],
  })

  // Filter records that are at or below reorder level
  const lowRecords = inventoryRecords.filter(
    (inv) => inv.availableQuantity <= inv.product.reorderLevel
  )

  if (lowRecords.length === 0) {
    return []
  }

  // Pre-fetch active suppliers
  const activeSuppliers = await prisma.supplier.findMany({
    where: { isActive: true, ...(organizationId ? { organizationId } : {}) },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  const fallbackSupplier = activeSuppliers[0] ?? null

  const productIds = Array.from(new Set(lowRecords.map((r) => r.productId)))
  const branchIds = Array.from(new Set(lowRecords.map((r) => r.branchId)))

  // Check for open/pending POs for these products
  const openPurchases = await prisma.purchase.findMany({
    where: {
      branchId: { in: branchIds },
      ...(organizationId ? { branch: { organizationId } } : {}),
      status: { in: ['DRAFT', 'ORDERED'] },
      items: { some: { productId: { in: productIds } } },
    },
    select: {
      id: true,
      purchaseNumber: true,
      branchId: true,
      items: {
        select: { productId: true },
      },
    },
  })

  const pendingPoMap = new Map<string, string>() // key: `${branchId}:${productId}` -> purchaseNumber
  for (const po of openPurchases) {
    for (const item of po.items) {
      const key = `${po.branchId}:${item.productId}`
      if (!pendingPoMap.has(key)) {
        pendingPoMap.set(key, po.purchaseNumber)
      }
    }
  }

  // Find latest purchase item for each product to identify historical supplier & cost
  const pastPurchaseItems = await prisma.purchaseItem.findMany({
    where: {
      productId: { in: productIds },
      purchase: {
        status: { in: ['RECEIVED', 'INVOICED', 'ORDERED', 'DRAFT'] },
        ...(organizationId ? { branch: { organizationId } } : {}),
      },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      productId: true,
      unitCost: true,
      purchase: {
        select: {
          supplier: {
            select: { id: true, name: true, isActive: true },
          },
        },
      },
    },
  })

  const historicalSupplierMap = new Map<
    string,
    { supplierId: string; supplierName: string; unitCost: number }
  >()
  for (const pi of pastPurchaseItems) {
    if (!historicalSupplierMap.has(pi.productId) && pi.purchase.supplier.isActive) {
      historicalSupplierMap.set(pi.productId, {
        supplierId: pi.purchase.supplier.id,
        supplierName: pi.purchase.supplier.name,
        unitCost: Number(pi.unitCost),
      })
    }
  }

  // Construct candidates
  const candidates: LowStockCandidate[] = lowRecords.map((inv) => {
    const prod = inv.product
    const pendingPoNumber = pendingPoMap.get(`${inv.branchId}:${inv.productId}`) ?? null

    // Supplier & Cost resolution
    const history = historicalSupplierMap.get(inv.productId)
    const suggestedSupplierId = history?.supplierId ?? fallbackSupplier?.id ?? null
    const suggestedSupplierName = history?.supplierName ?? fallbackSupplier?.name ?? null

    let estimatedUnitCost = history?.unitCost ?? 0
    if (estimatedUnitCost <= 0) {
      if (prod.costPrice && Number(prod.costPrice) > 0) {
        estimatedUnitCost = Number(prod.costPrice)
      } else if (prod.ptr && Number(prod.ptr) > 0) {
        estimatedUnitCost = Number(prod.ptr)
      } else {
        estimatedUnitCost = Math.round(Number(prod.mrp) * 0.7 * 100) / 100
      }
    }

    // Recommended reorder quantity calculation
    // Standard target = 2x reorder level; reorder enough to replenish back to safe stock
    let targetStock = prod.reorderLevel * 2
    if (prod.maxStockLevel && prod.maxStockLevel > prod.reorderLevel) {
      targetStock = prod.maxStockLevel
    }
    const deficit = Math.max(0, targetStock - inv.availableQuantity)
    const suggestedQuantity = Math.max(1, Math.max(prod.minStockLevel, deficit))

    return {
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      barcode: prod.barcode,
      unitOfMeasure: prod.unitOfMeasure,
      branchId: inv.branchId,
      branchName: inv.branch.name,
      availableQuantity: inv.availableQuantity,
      totalQuantity: inv.totalQuantity,
      reorderLevel: prod.reorderLevel,
      minStockLevel: prod.minStockLevel,
      maxStockLevel: prod.maxStockLevel,
      suggestedQuantity,
      estimatedUnitCost,
      mrp: Number(prod.mrp),
      taxPercent: Number(prod.gstRate ?? 12),
      suggestedSupplierId,
      suggestedSupplierName,
      hasPendingPo: pendingPoNumber !== null,
      pendingPoNumber,
    }
  })

  return candidates
}

/**
 * Automatically creates grouped DRAFT Purchase Orders for low-stock items.
 * Groups by (branchId, supplierId) and ensures anti-duplication.
 */
export async function generateLowStockPurchaseOrders(
  input: GenerateAutoPoInput,
  actor: AuthUser
): Promise<{ success: boolean; message: string; purchases: AutoPoSummary[] }> {
  // If specific items were passed, use them; otherwise, scan for all non-pending low-stock candidates
  let itemsToOrder: {
    productId: string
    branchId: string
    supplierId: string
    orderedQuantity: number
    unitCost?: number
  }[] = []

  if (input.items && input.items.length > 0) {
    itemsToOrder = input.items.filter((i) => i.orderedQuantity > 0 && i.supplierId)
  } else {
    const orgId = actor.isSuperAdmin ? undefined : actor.organizationId || '__NO_ACCESS__'
    const candidates = await getLowStockCandidates(input.branchId, orgId)
    // Only order items that do not already have an open PO and have a designated supplier
    itemsToOrder = candidates
      .filter((c) => !c.hasPendingPo && c.suggestedSupplierId && c.suggestedQuantity > 0)
      .map((c) => ({
        productId: c.productId,
        branchId: c.branchId,
        supplierId: c.suggestedSupplierId!,
        orderedQuantity: c.suggestedQuantity,
        unitCost: c.estimatedUnitCost,
      }))
  }

  if (itemsToOrder.length === 0) {
    return {
      success: true,
      message: 'No low-stock items requiring automated purchase orders.',
      purchases: [],
    }
  }

  // Verify branch permissions
  const uniqueBranches = Array.from(new Set(itemsToOrder.map((i) => i.branchId)))
  for (const bId of uniqueBranches) {
    await assertBranchAccess(actor, bId)
  }

  // Pre-fetch products
  const productIds = Array.from(new Set(itemsToOrder.map((i) => i.productId)))
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      isActive: true,
      ...(!actor.isSuperAdmin ? { organizationId: actor.organizationId || '__NO_ACCESS__' } : {}),
    },
    select: {
      id: true,
      name: true,
      sku: true,
      mrp: true,
      ptr: true,
      costPrice: true,
      gstRate: true,
    },
  })
  const productMap = new Map(products.map((p) => [p.id, p]))

  // Pre-fetch suppliers
  const supplierIds = Array.from(new Set(itemsToOrder.map((i) => i.supplierId)))
  const suppliers = await prisma.supplier.findMany({
    where: {
      id: { in: supplierIds },
      isActive: true,
      ...(!actor.isSuperAdmin ? { organizationId: actor.organizationId || '__NO_ACCESS__' } : {}),
    },
    select: { id: true, name: true },
  })
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]))

  // Pre-fetch branches
  const branches = await prisma.branch.findMany({
    where: { id: { in: uniqueBranches } },
    select: { id: true, name: true },
  })
  const branchMap = new Map(branches.map((b) => [b.id, b]))

  // Anti-duplication check: ensure no open PO was created in the meantime
  const existingOpenPos = await prisma.purchase.findMany({
    where: {
      branchId: { in: uniqueBranches },
      ...(!actor.isSuperAdmin ? { branch: { organizationId: actor.organizationId || '__NO_ACCESS__' } } : {}),
      status: { in: ['DRAFT', 'ORDERED'] },
      items: { some: { productId: { in: productIds } } },
    },
    select: {
      branchId: true,
      items: { select: { productId: true } },
    },
  })
  const pendingSet = new Set<string>()
  for (const po of existingOpenPos) {
    for (const it of po.items) {
      pendingSet.add(`${po.branchId}:${it.productId}`)
    }
  }

  // Filter out any items that already have a pending PO
  const filteredItems = itemsToOrder.filter((i) => !pendingSet.has(`${i.branchId}:${i.productId}`))
  if (filteredItems.length === 0) {
    return {
      success: true,
      message: 'All low-stock items already have pending purchase orders.',
      purchases: [],
    }
  }

  // Group items by `${branchId}:${supplierId}`
  const groups = new Map<
    string,
    {
      branchId: string
      supplierId: string
      items: typeof filteredItems
    }
  >()

  for (const item of filteredItems) {
    const key = `${item.branchId}:${item.supplierId}`
    if (!groups.has(key)) {
      groups.set(key, {
        branchId: item.branchId,
        supplierId: item.supplierId,
        items: [],
      })
    }
    groups.get(key)!.items.push(item)
  }

  const createdPurchases: AutoPoSummary[] = []

  // Execute database creation inside transaction
  await prisma.$transaction(async (tx) => {
    let seq = 1
    for (const group of groups.values()) {
      const supplier = supplierMap.get(group.supplierId)
      const branch = branchMap.get(group.branchId)
      if (!supplier || !branch) continue

      // Unique PO Number
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const purchaseNumber = `PO-AUTO-${timestamp}-${Date.now().toString().slice(-4)}${seq++}`

      let groupSubtotal = 0
      let groupTax = 0
      let groupTotal = 0
      let groupTotalQty = 0

      const lineItemsData = group.items.map((it) => {
        const prod = productMap.get(it.productId)
        if (!prod) {
          throw new Error(`Product not found or inactive: ${it.productId}`)
        }

        const unitCost =
          it.unitCost !== undefined && it.unitCost > 0
            ? it.unitCost
            : Number(prod.costPrice ?? prod.ptr ?? Number(prod.mrp) * 0.7)

        const taxPercent = Number(prod.gstRate ?? 12)
        const lineSubtotal = Math.round(it.orderedQuantity * unitCost * 100) / 100
        const lineTax = Math.round(lineSubtotal * (taxPercent / 100) * 100) / 100
        const lineTotal = Math.round((lineSubtotal + lineTax) * 100) / 100

        groupSubtotal += lineSubtotal
        groupTax += lineTax
        groupTotal += lineTotal
        groupTotalQty += it.orderedQuantity

        return {
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          orderedQuantity: it.orderedQuantity,
          receivedQuantity: 0,
          freeQuantity: 0,
          unitCost: new Prisma.Decimal(unitCost),
          discountPercent: new Prisma.Decimal(0),
          taxPercent: new Prisma.Decimal(taxPercent),
          taxAmount: new Prisma.Decimal(lineTax),
          totalAmount: new Prisma.Decimal(lineTotal),
          mrp: prod.mrp,
          ptr: prod.ptr,
        }
      })

      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          branchId: group.branchId,
          supplierId: group.supplierId,
          status: 'DRAFT',
          subtotal: new Prisma.Decimal(groupSubtotal),
          discountAmount: new Prisma.Decimal(0),
          taxAmount: new Prisma.Decimal(groupTax),
          totalAmount: new Prisma.Decimal(groupTotal),
          amountPaid: new Prisma.Decimal(0),
          balanceDue: new Prisma.Decimal(groupTotal),
          notes: `Automated Purchase Order generated for low-stock inventory (${lineItemsData.length} products).`,
          createdById: actor.id,
          items: {
            create: lineItemsData.map((li) => ({
              productId: li.productId,
              orderedQuantity: li.orderedQuantity,
              receivedQuantity: 0,
              freeQuantity: 0,
              unitCost: li.unitCost,
              discountPercent: li.discountPercent,
              taxPercent: li.taxPercent,
              taxAmount: li.taxAmount,
              totalAmount: li.totalAmount,
              mrp: li.mrp,
              ptr: li.ptr,
            })),
          },
        },
      })

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: 'PURCHASE_AUTO_CREATE',
          entity: 'Purchase',
          entityId: purchase.id,
          metadata: {
            purchaseNumber: purchase.purchaseNumber,
            supplierId: group.supplierId,
            itemCount: lineItemsData.length,
            totalAmount: groupTotal,
          },
        },
      })

      createdPurchases.push({
        purchaseId: purchase.id,
        purchaseNumber: purchase.purchaseNumber,
        supplierId: group.supplierId,
        supplierName: supplier.name,
        branchId: group.branchId,
        branchName: branch.name,
        itemCount: lineItemsData.length,
        totalQuantity: groupTotalQty,
        subtotal: groupSubtotal,
        taxAmount: groupTax,
        totalAmount: groupTotal,
        status: purchase.status,
        items: lineItemsData.map((li) => ({
          productId: li.productId,
          productName: li.productName,
          sku: li.sku,
          orderedQuantity: li.orderedQuantity,
          unitCost: Number(li.unitCost),
          taxPercent: Number(li.taxPercent),
          taxAmount: Number(li.taxAmount),
          totalAmount: Number(li.totalAmount),
        })),
      })
    }
  })

  return {
    success: true,
    message: `Successfully generated ${createdPurchases.length} draft purchase order(s).`,
    purchases: createdPurchases,
  }
}
