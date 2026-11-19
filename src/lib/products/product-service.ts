// ─────────────────────────────────────────────────────────────
// Product Master Service
// ─────────────────────────────────────────────────────────────
import type {
  Prisma,
  Product,
  Category,
  ProductBarcode,
  HsnCode,
  Batch,
  Inventory,
} from '@prisma/client'

import prisma from '@/lib/db/prisma'

// ─── Types ────────────────────────────────────────────────────

export interface ProductWithRelations extends Product {
  categories: { category: Category }[]
  barcodes: ProductBarcode[]
  hsnCodeRef: HsnCode | null
  createdBy?: { id: string; name: string } | null
  batches?: Batch[]
  inventory?: (Inventory & { branch: { id: string; name: string; code: string | null } })[]
  rack?: { id: string; code: string; shelfNumber: string; description: string | null } | null
}

export interface CategoryNode extends Category {
  children: CategoryNode[]
  productCount: number
  directProductCount?: number
}

export interface ProductListParams {
  page?: number
  limit?: number
  search?: string
  categoryId?: string
  isActive?: boolean
  drugSchedule?: string
  stockStatus?: string
  sortBy?: 'name' | 'sku' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
  organizationId?: string
}

export interface ProductListResult {
  data: ProductWithRelations[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// ─── Category Service ────────────────────────────────────────

export async function getCategories(params?: {
  parentId?: string | null
  isActive?: boolean
  includeChildren?: boolean
}): Promise<Category[]> {
  const { parentId, isActive, includeChildren } = params ?? {}

  return prisma.category.findMany({
    where: {
      parentId: parentId ?? undefined,
      isActive: isActive ?? undefined,
    },
    include: {
      children: includeChildren
        ? {
            where: { isActive: isActive ?? undefined },
            orderBy: { sortOrder: 'asc' },
          }
        : false,
      _count: { select: { products: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
}

export async function getDescendantCategoryIds(rootCategoryId: string): Promise<string[]> {
  const allCategories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, parentId: true },
  })
  const descendants = new Set<string>([rootCategoryId])
  let added = true
  while (added) {
    added = false
    for (const cat of allCategories) {
      if (cat.parentId && descendants.has(cat.parentId) && !descendants.has(cat.id)) {
        descendants.add(cat.id)
        added = true
      }
    }
  }
  return Array.from(descendants)
}

export async function getCategoryTree(organizationId?: string): Promise<CategoryNode[]> {
  const [categories, productCategoryRows] = await Promise.all([
    prisma.category.findMany({
      where: {
        isActive: true,
        OR: [
          { organizationId: null },
          ...(organizationId ? [{ organizationId }] : []),
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.productCategory.findMany({
      where: {
        product: {
          isActive: true,
          ...(organizationId ? { organizationId } : {}),
        },
      },
      select: { categoryId: true, productId: true },
    }),
  ])

  // Map categoryId -> Set<productId> of directly mapped products
  const categoryProductsMap = new Map<string, Set<string>>()
  for (const pc of productCategoryRows) {
    let set = categoryProductsMap.get(pc.categoryId)
    if (!set) {
      set = new Set<string>()
      categoryProductsMap.set(pc.categoryId, set)
    }
    set.add(pc.productId)
  }

  const byParent = new Map<string | null, Category[]>()
  for (const category of categories) {
    const list = byParent.get(category.parentId) ?? []
    list.push(category)
    byParent.set(category.parentId, list)
  }

  // Recursive build computing unique product rollup across subtree
  const build = (parentId: string | null): { nodes: CategoryNode[]; subtreeProductIds: Set<string> } => {
    const children = byParent.get(parentId) ?? []
    const nodes: CategoryNode[] = []
    const allProductsInLevel = new Set<string>()

    for (const cat of children) {
      const childRes = build(cat.id)
      const directSet = categoryProductsMap.get(cat.id) ?? new Set<string>()
      const combinedSubtreeProducts = new Set<string>([...directSet, ...childRes.subtreeProductIds])

      for (const pid of combinedSubtreeProducts) {
        allProductsInLevel.add(pid)
      }

      nodes.push({
        ...cat,
        children: childRes.nodes,
        productCount: combinedSubtreeProducts.size,
        directProductCount: directSet.size,
      })
    }

    return { nodes, subtreeProductIds: allProductsInLevel }
  }

  return build(null).nodes
}

export async function getCategoryById(id: string): Promise<Category | null> {
  return prisma.category.findUnique({
    where: { id },
    include: {
      parent: true,
      children: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { products: true } },
    },
  })
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return prisma.category.findUnique({
    where: { slug },
    include: {
      parent: true,
      children: { orderBy: { sortOrder: 'asc' } },
    },
  })
}

export async function createCategory(data: Prisma.CategoryUncheckedCreateInput): Promise<Category> {
  return prisma.category.create({ data })
}

export async function updateCategory(
  id: string,
  data: Prisma.CategoryUncheckedUpdateInput
): Promise<Category> {
  if (data.parentId) {
    if (data.parentId === id) {
      throw new Error('A category cannot be its own parent')
    }
    const descendants = await getDescendantCategoryIds(id)
    if (descendants.includes(data.parentId as string)) {
      throw new Error('Cannot set a descendant category as parent (circular hierarchy)')
    }
  }
  return prisma.category.update({ where: { id }, data })
}

export async function deleteCategory(id: string): Promise<Category> {
  // Soft delete - mark inactive
  return prisma.category.update({
    where: { id },
    data: { isActive: false },
  })
}

export async function getCategoryOptions(organizationId?: string): Promise<
  { id: string; name: string; slug: string; parentId: string | null; parentName?: string | null }[]
> {
  const categories = await prisma.category.findMany({
    where: {
      isActive: true,
      OR: [
        { organizationId: null },
        ...(organizationId ? [{ organizationId }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      parent: { select: { name: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parentId,
    parentName: c.parent?.name ?? null,
  }))
}

// ─── HSN Code Service ────────────────────────────────────────

export async function getHsnCodes(): Promise<HsnCode[]> {
  return prisma.hsnCode.findMany({
    where: { isActive: true },
    orderBy: { code: 'asc' },
  })
}

export async function getHsnCodeByCode(code: string): Promise<HsnCode | null> {
  return prisma.hsnCode.findUnique({ where: { code } })
}

export async function listHsnCodesDetailed(query: {
  search?: string
  isActive?: boolean
} = {}): Promise<(HsnCode & { _count: { products: number } })[]> {
  const where: Prisma.HsnCodeWhereInput = {}

  if (query.search) {
    where.OR = [
      { code: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ]
  }

  if (query.isActive !== undefined) {
    where.isActive = query.isActive
  }

  return prisma.hsnCode.findMany({
    where,
    include: {
      _count: { select: { products: true } },
    },
    orderBy: { code: 'asc' },
  })
}

export async function createHsnCode(input: {
  code: string
  description: string
  gstRate: number
  cessRate?: number
}): Promise<HsnCode> {
  const halfRate = input.gstRate / 2
  const cess = input.cessRate ?? 0

  return prisma.hsnCode.create({
    data: {
      code: input.code.trim(),
      description: input.description.trim(),
      gstRate: input.gstRate,
      cgstRate: halfRate,
      sgstRate: halfRate,
      igstRate: input.gstRate,
      cessRate: cess,
      isActive: true,
    },
  })
}

export async function updateHsnCode(
  id: string,
  input: {
    description?: string
    gstRate?: number
    cessRate?: number
    isActive?: boolean
  }
): Promise<HsnCode> {
  const data: Prisma.HsnCodeUpdateInput = {}

  if (input.description !== undefined) {
    data.description = input.description.trim()
  }

  if (input.gstRate !== undefined) {
    const halfRate = input.gstRate / 2
    data.gstRate = input.gstRate
    data.cgstRate = halfRate
    data.sgstRate = halfRate
    data.igstRate = input.gstRate
  }

  if (input.cessRate !== undefined) {
    data.cessRate = input.cessRate
  }

  if (input.isActive !== undefined) {
    data.isActive = input.isActive
  }

  return prisma.hsnCode.update({
    where: { id },
    data,
  })
}

export async function deleteHsnCode(id: string): Promise<{ deleted: boolean; deactivated?: boolean }> {
  const hsn = await prisma.hsnCode.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  })

  if (!hsn) {
    throw new Error('Not Found: HSN Code not found')
  }

  if (hsn._count.products > 0) {
    // Cannot hard delete because products reference this HSN code; soft-deactivate instead
    await prisma.hsnCode.update({
      where: { id },
      data: { isActive: false },
    })
    return { deleted: false, deactivated: true }
  }

  await prisma.hsnCode.delete({ where: { id } })
  return { deleted: true }
}

// ─── Product Service ────────────────────────────────────────

export async function getProducts(params: ProductListParams = {}): Promise<ProductListResult> {
  const {
    page = 1,
    limit = 20,
    search,
    categoryId,
    isActive,
    drugSchedule,
    stockStatus,
    sortBy = 'name',
    sortOrder = 'asc',
  } = params

  const skip = (page - 1) * limit

  const where: Prisma.ProductWhereInput = {}

  if (params.organizationId) {
    where.organizationId = params.organizationId
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { genericName: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } },
      { manufacturer: { contains: search, mode: 'insensitive' } },
      { rack: { code: { contains: search, mode: 'insensitive' } } },
    ]
  }

  if (categoryId && categoryId !== 'all') {
    const descendantIds = await getDescendantCategoryIds(categoryId)
    where.categories = {
      some: { categoryId: { in: descendantIds } },
    }
  }

  if (isActive !== undefined) {
    where.isActive = isActive
  }

  if (drugSchedule && drugSchedule !== 'all') {
    where.drugSchedule = drugSchedule as 'NONE' | 'H' | 'H1' | 'X' | 'G' | 'J'
  }

  const ninetyDaysFromNow = new Date()
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90)

  if (stockStatus && stockStatus !== 'all') {
    if (stockStatus === 'in_stock') {
      where.batches = { some: { status: 'ACTIVE', quantity: { gt: 0 } } }
    } else if (stockStatus === 'out_of_stock') {
      where.batches = { none: { status: 'ACTIVE', quantity: { gt: 0 } } }
    } else if (stockStatus === 'near_expiry') {
      where.batches = { some: { status: 'ACTIVE', expiryDate: { lte: ninetyDaysFromNow }, quantity: { gt: 0 } } }
    }
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        categories: { include: { category: true } },
        barcodes: true,
        hsnCodeRef: true,
        rack: true,
        batches: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            batchNumber: true,
            quantity: true,
            reservedQuantity: true,
            soldQuantity: true,
            expiryDate: true,
            mrp: true,
            purchasePrice: true,
            status: true,
            productId: true,
            createdAt: true,
            updatedAt: true,
            manufacturingDate: true,
            blockedReason: true,
            supplierRef: true,
            purchaseId: true,
            branchId: true,
          },
          orderBy: { expiryDate: 'asc' },
        },
      },
    }),
    prisma.product.count({ where }),
  ])

  const mappedProducts = products.map((p: any) => ({
    ...p,
    rack: p.rack ? (p.rack.shelfNumber ? `${p.rack.code}-${p.rack.shelfNumber}` : p.rack.code) : null,
  }))

  return {
    data: mappedProducts as ProductWithRelations[],
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

export async function getProductById(id: string): Promise<ProductWithRelations | null> {
  return prisma.product.findUnique({
    where: { id },
    include: {
      categories: { include: { category: true } },
      barcodes: true,
      hsnCodeRef: true,
      rack: true,
      createdBy: { select: { id: true, name: true } },
      batches: {
        orderBy: { expiryDate: 'asc' },
      },
      inventory: {
        include: {
          branch: { select: { id: true, name: true, code: true } },
        },
      },
    },
  }).then((p: any) => p ? ({ ...p, rack: p.rack ? (p.rack.shelfNumber ? `${p.rack.code}-${p.rack.shelfNumber}` : p.rack.code) : null }) : null) as Promise<ProductWithRelations | null>
}

export async function getProductBySku(sku: string): Promise<Product | null> {
  return prisma.product.findFirst({ where: { sku } })
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  // Check primary barcode
  const primaryProduct = await prisma.product.findFirst({ where: { barcode } })
  if (primaryProduct) return primaryProduct

  // Check additional barcodes
  const productBarcode = await prisma.productBarcode.findUnique({
    where: { barcode },
    include: { product: true },
  })
  return productBarcode?.product ?? null
}

export async function createProduct(
  data: Prisma.ProductUncheckedCreateInput & {
    categoryIds?: string[]
    barcodes?: { barcode: string; type?: string; isPrimary?: boolean }[]
    initialBatch?: {
      batchNumber: string
      expiryDate: string
      manufacturingDate?: string | null
      quantity: number
      purchasePrice?: number
      mrp?: number
      branchId?: string
      rack?: string
    }
  }
): Promise<ProductWithRelations> {
  const { categoryIds, barcodes, initialBatch, rack: rawRack, ...productData } = data as any

  let resolvedRackId = productData.rackId ?? null
  if (rawRack && typeof rawRack === 'string' && rawRack.trim().length > 0) {
    const trimmed = rawRack.trim().toUpperCase()
    const parts = trimmed.split('-')
    const code = parts[0] || trimmed
    const shelfNumber = parts[1] || 'S1'
    const defaultBranch = await prisma.branch.findFirst({ select: { id: true } })
    const branchId = defaultBranch?.id ?? 'default-branch'
    const rackRec = await prisma.rack.upsert({
      where: {
        branchId_code_shelfNumber: {
          branchId,
          code,
          shelfNumber,
        },
      },
      create: {
        branchId,
        code,
        shelfNumber,
        description: trimmed,
      },
      update: {},
    })
    resolvedRackId = rackRec.id
  }
  productData.rackId = resolvedRackId

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data: productData })

    // Link categories
    if (categoryIds && categoryIds.length > 0) {
      await tx.productCategory.createMany({
        data: categoryIds.map((categoryId: string) => ({
          productId: product.id,
          categoryId,
        })),
        skipDuplicates: true,
      })
    }

    // Create additional barcodes
    if (barcodes && barcodes.length > 0) {
      await tx.productBarcode.createMany({
        data: barcodes.map((bc: any) => ({
          productId: product.id,
          barcode: bc.barcode,
          type: bc.type ?? 'EAN13',
          isPrimary: bc.isPrimary ?? false,
        })),
        skipDuplicates: true,
      })
    }

    // Create initial batch and inventory record if requested (e.g. from strip/barcode scan)
    if (initialBatch && initialBatch.batchNumber && initialBatch.quantity > 0) {
      let branchId = initialBatch.branchId
      if (!branchId) {
        const defaultBranch = await tx.branch.findFirst({
          where: { isActive: true },
          select: { id: true },
        })
        branchId = defaultBranch?.id ?? 'default-branch'
      }

      const expiryDate = new Date(initialBatch.expiryDate)
      const manufacturingDate = initialBatch.manufacturingDate ? new Date(initialBatch.manufacturingDate) : null
      const purchasePrice = initialBatch.purchasePrice ?? (product.costPrice ? Number(product.costPrice) : 0)
      const batchMrp = initialBatch.mrp ?? Number(product.mrp)

      const batch = await tx.batch.create({
        data: {
          productId: product.id,
          batchNumber: initialBatch.batchNumber.trim().toUpperCase(),
          expiryDate,
          manufacturingDate,
          purchasePrice,
          mrp: batchMrp,
          quantity: initialBatch.quantity,
          status: 'ACTIVE',
          branchId,
        },
      })

      const inventory = await tx.inventory.upsert({
        where: {
          productId_branchId: {
            productId: product.id,
            branchId,
          },
        },
        create: {
          productId: product.id,
          branchId,
          totalQuantity: initialBatch.quantity,
          availableQuantity: initialBatch.quantity,
        },
        update: {
          totalQuantity: { increment: initialBatch.quantity },
          availableQuantity: { increment: initialBatch.quantity },
        },
      })

      // Log inventory movement
      await tx.inventoryMovement.create({
        data: {
          inventoryId: inventory.id,
          type: 'IN',
          quantity: initialBatch.quantity,
          quantityBefore: 0,
          quantityAfter: initialBatch.quantity,
          referenceType: 'INITIAL_STOCK',
          referenceId: batch.id,
          batchId: batch.id,
          notes: `Initial stock loaded during product creation via Strip/Barcode Scan (Batch: ${batch.batchNumber})`,
          createdById: product.createdById,
        },
      })

      if (initialBatch.rack) {
        await tx.product.update({
          where: { id: product.id },
          data: { rack: initialBatch.rack },
        })
      }
    }

    // Return with relations
    return tx.product.findUniqueOrThrow({
      where: { id: product.id },
      include: {
        categories: { include: { category: true } },
        barcodes: true,
        hsnCodeRef: true,
      },
    })
  })
}

export async function updateProduct(
  id: string,
  data: Prisma.ProductUncheckedUpdateInput & {
    categoryIds?: string[]
    barcodes?: { barcode: string; type?: string; isPrimary?: boolean }[]
  }
): Promise<ProductWithRelations> {
  const { categoryIds, barcodes, rack: rawRack, ...productData } = data as any

  if (rawRack !== undefined) {
    if (rawRack && typeof rawRack === 'string' && rawRack.trim().length > 0) {
      const trimmed = rawRack.trim().toUpperCase()
      const parts = trimmed.split('-')
      const code = parts[0] || trimmed
      const shelfNumber = parts[1] || 'S1'
      const defaultBranch = await prisma.branch.findFirst({ select: { id: true } })
      const branchId = defaultBranch?.id ?? 'default-branch'
      const rackRec = await prisma.rack.upsert({
        where: {
          branchId_code_shelfNumber: {
            branchId,
            code,
            shelfNumber,
          },
        },
        create: {
          branchId,
          code,
          shelfNumber,
          description: trimmed,
        },
        update: {},
      })
      productData.rackId = rackRec.id
    } else {
      productData.rackId = null
    }
  }

  return prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: productData,
    })

    // Update categories if provided
    if (categoryIds !== undefined) {
      await tx.productCategory.deleteMany({ where: { productId: id } })
      if (categoryIds.length > 0) {
        await tx.productCategory.createMany({
          data: categoryIds.map((categoryId: string) => ({
            productId: id,
            categoryId,
          })),
          skipDuplicates: true,
        })
      }
    }

    // Update barcodes if provided
    if (barcodes !== undefined) {
      await tx.productBarcode.deleteMany({ where: { productId: id } })
      if (barcodes.length > 0) {
        await tx.productBarcode.createMany({
          data: barcodes.map((bc: any) => ({
            productId: id,
            barcode: bc.barcode,
            type: bc.type ?? 'EAN13',
            isPrimary: bc.isPrimary ?? false,
          })),
          skipDuplicates: true,
        })
      }
    }

    // Return with relations
    return tx.product.findUniqueOrThrow({
      where: { id },
      include: {
        categories: { include: { category: true } },
        barcodes: true,
        hsnCodeRef: true,
      },
    })
  })
}

export async function deleteProduct(id: string): Promise<Product> {
  // Soft delete - mark inactive
  return prisma.product.update({
    where: { id },
    data: { isActive: false },
  })
}

export async function toggleProductActive(id: string, isActive: boolean): Promise<Product> {
  return prisma.product.update({
    where: { id },
    data: { isActive },
  })
}

export async function checkSkuExists(sku: string, excludeId?: string): Promise<boolean> {
  const product = await prisma.product.findFirst({ where: { sku } })
  return !!product && product.id !== excludeId
}

export async function checkBarcodeExists(barcode: string, excludeId?: string): Promise<boolean> {
  const [product, productBarcode] = await Promise.all([
    prisma.product.findFirst({ where: { barcode } }),
    prisma.productBarcode.findUnique({ where: { barcode } }),
  ])
  return (
    (!!product && product.id !== excludeId) ||
    (!!productBarcode && productBarcode.productId !== excludeId)
  )
}

export async function updateProductRack(id: string, rackStr: string | null): Promise<Product & { rack: string | null }> {
  let resolvedRackId: string | null = null
  if (rackStr && rackStr.trim().length > 0) {
    const trimmed = rackStr.trim().toUpperCase()
    const parts = trimmed.split('-')
    const code = parts[0] || trimmed
    const shelfNumber = parts[1] || 'S1'
    const defaultBranch = await prisma.branch.findFirst({ select: { id: true } })
    const branchId = defaultBranch?.id ?? 'default-branch'
    const rackRec = await prisma.rack.upsert({
      where: {
        branchId_code_shelfNumber: {
          branchId,
          code,
          shelfNumber,
        },
      },
      create: {
        branchId,
        code,
        shelfNumber,
        description: trimmed,
      },
      update: {},
    })
    resolvedRackId = rackRec.id
  }

  const updated = await prisma.product.update({
    where: { id },
    data: { rackId: resolvedRackId },
    include: { rack: true },
  })

  return {
    ...updated,
    rack: updated.rack
      ? updated.rack.shelfNumber
        ? updated.rack.code + '-' + updated.rack.shelfNumber
        : updated.rack.code
      : null,
  } as any
}

export interface SubstituteProduct {
  id: string
  name: string
  genericName: string
  sku: string
  manufacturer: string | null
  rack: string | null
  mrp: string
  unitOfMeasure: string
  totalStock: number
  batchCount: number
  earliestExpiry: string | null
  matchReason?: string | null
  stockOnHand?: number
}

export async function getProductSubstitutes(productId: string): Promise<SubstituteProduct[]> {
  const current = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      genericName: true,
      composition: true,
      categories: { select: { categoryId: true } },
    },
  })

  if (!current) return []

  const generic = current.genericName?.trim()
  const categoryIds = current.categories.map((c) => c.categoryId)

  if (!generic && categoryIds.length === 0) {
    return []
  }

  const whereConditions: Prisma.ProductWhereInput[] = []
  if (generic && generic.length > 0) {
    whereConditions.push({
      genericName: { equals: generic, mode: 'insensitive' },
    })
  }
  if (categoryIds.length > 0) {
    whereConditions.push({
      categories: { some: { categoryId: { in: categoryIds } } },
    })
  }

  const rawCandidates = await prisma.product.findMany({
    where: {
      id: { not: productId },
      isActive: true,
      OR: whereConditions,
    },
    include: {
      batches: {
        where: { status: 'ACTIVE' },
        orderBy: { expiryDate: 'asc' },
      },
      rack: true,
    },
    take: 15,
  })

  return rawCandidates
    .map((p) => {
      let totalStock = 0
      let earliestExpiry: string | null = null

      for (const b of p.batches) {
        const avail = Math.max(0, b.quantity - b.reservedQuantity - b.soldQuantity)
        totalStock += avail
        if (avail > 0 && !earliestExpiry && b.expiryDate) {
          earliestExpiry = new Date(b.expiryDate).toISOString()
        }
      }

      const isGenericMatch = Boolean(generic && p.genericName && p.genericName.toLowerCase() === generic.toLowerCase())
      const matchReason = isGenericMatch
        ? `Salt Equivalent (${p.genericName})`
        : 'Therapeutic Category Substitute'

      return {
        id: p.id,
        name: p.name,
        genericName: p.genericName ?? '',
        sku: p.sku,
        manufacturer: p.manufacturer,
        rack: (p as any).rack
          ? ((p as any).rack.shelfNumber
              ? `${(p as any).rack.code}-${(p as any).rack.shelfNumber}`
              : (p as any).rack.code)
          : null,
        mrp: p.mrp.toString(),
        unitOfMeasure: p.unitOfMeasure,
        totalStock,
        stockOnHand: totalStock,
        batchCount: p.batches.length,
        earliestExpiry,
        matchReason,
      }
    })
    .sort((a, b) => {
      const aSameGeneric = generic && a.genericName.toLowerCase() === generic.toLowerCase() ? 1 : 0
      const bSameGeneric = generic && b.genericName.toLowerCase() === generic.toLowerCase() ? 1 : 0
      if (aSameGeneric !== bSameGeneric) return bSameGeneric - aSameGeneric
      return b.totalStock - a.totalStock
    })
}

export async function executeBulkProductAction(
  action: 'ACTIVATE' | 'DEACTIVATE' | 'SET_RACK',
  productIds: string[],
  metadata?: { rack?: string }
): Promise<{ count: number }> {
  if (productIds.length === 0) return { count: 0 }

  if (action === 'ACTIVATE') {
    const res = await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { isActive: true },
    })
    return { count: res.count }
  }

  if (action === 'DEACTIVATE') {
    const res = await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { isActive: false },
    })
    return { count: res.count }
  }

  if (action === 'SET_RACK') {
    let resolvedRackId: string | null = null
    const rackStr = metadata?.rack?.trim()
    if (rackStr) {
      const trimmed = rackStr.toUpperCase()
      const parts = trimmed.split('-')
      const code = parts[0] || trimmed
      const shelfNumber = parts[1] || 'S1'
      const defaultBranch = await prisma.branch.findFirst({ select: { id: true } })
      const branchId = defaultBranch?.id ?? 'default-branch'
      const rackRec = await prisma.rack.upsert({
        where: {
          branchId_code_shelfNumber: {
            branchId,
            code,
            shelfNumber,
          },
        },
        create: {
          branchId,
          code,
          shelfNumber,
          description: trimmed,
        },
        update: {},
      })
      resolvedRackId = rackRec.id
    }
    const res = await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { rackId: resolvedRackId },
    })
    return { count: res.count }
  }

  return { count: 0 }
}
