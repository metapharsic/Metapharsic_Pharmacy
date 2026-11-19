// ─────────────────────────────────────────────────────────────
// Auto-Inventory Ingestion & Product Matching Service
// Connects AI Strip Scanner with transactional PostgreSQL
// ─────────────────────────────────────────────────────────────
import prisma from '@/lib/db/prisma'
import { processPharmaOcrText } from '@/lib/scanner/pharma-ocr-engine'
import type {
  CommitInventoryScanInput,
  CommitInventoryScanResult,
  MatchedCatalogProduct,
  PackagingSurfaceType,
  StripScanAnalysisResult,
} from '@/lib/scanner/strip-scanner-types'

/**
 * Analyzes optical strip scan and resolves catalog matches against PostgreSQL
 */
export async function analyzeScannedStrip(
  rawText: string,
  surfaceType: PackagingSurfaceType = 'ALU_ALU'
): Promise<StripScanAnalysisResult> {
  const { entity, confidence } = processPharmaOcrText(rawText, surfaceType)
  const scanId = `SCAN-${Date.now().toString().slice(-8)}`

  let matchedProduct: MatchedCatalogProduct | null = null

  // 1. Match by Barcode if extracted
  if (entity.barcode) {
    const productByBarcode = await prisma.product.findFirst({
      where: {
        OR: [
          { barcode: entity.barcode },
          { barcodes: { some: { barcode: entity.barcode } } },
        ],
      },
      include: {
        batches: { where: { status: 'ACTIVE' }, orderBy: { expiryDate: 'asc' } },
        inventory: true,
        rack: true,
      },
    })

    if (productByBarcode) {
      const stock = productByBarcode.batches.reduce(
        (acc, b) => acc + Math.max(0, b.quantity - b.reservedQuantity - b.soldQuantity),
        0
      )
      matchedProduct = {
        id: productByBarcode.id,
        name: productByBarcode.name,
        genericName: productByBarcode.genericName,
        sku: productByBarcode.sku,
        barcode: productByBarcode.barcode,
        mrp: productByBarcode.mrp.toString(),
        costPrice: productByBarcode.costPrice ? productByBarcode.costPrice.toString() : null,
        rack: productByBarcode.rack
          ? (productByBarcode.rack.shelfNumber
              ? `${productByBarcode.rack.code}-${productByBarcode.rack.shelfNumber}`
              : productByBarcode.rack.code)
          : null,
        unitOfMeasure: productByBarcode.unitOfMeasure,
        currentStock: stock,
        existingBatches: productByBarcode.batches.map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          expiryDate: b.expiryDate.toISOString(),
          quantity: Math.max(0, b.quantity - b.reservedQuantity - b.soldQuantity),
        })),
        matchConfidence: 98,
        matchReason: 'EXACT_BARCODE',
      }
    }
  }

  // 2. Match by Brand Name if not yet matched (Strict prefix or exact match, min 3 chars)
  const NOISE_WORDS = ['FOCUS', 'ALU', 'HARDWARE', 'RATE', 'SWITCH', '1080P', '4K', 'SIMULATOR', 'EXTRACTED', 'METADATA', 'CONFIDENCE']
  const cleanBrand = entity.brandName
    ? entity.brandName.split(/[\s\-_]+/)[0].replace(/[^a-zA-Z0-9]/g, '')
    : ''

  if (!matchedProduct && cleanBrand.length >= 3 && !NOISE_WORDS.includes(cleanBrand.toUpperCase())) {
    const productByName = await prisma.product.findFirst({
      where: {
        OR: [
          { name: { equals: entity.brandName!, mode: 'insensitive' } },
          { name: { startsWith: cleanBrand, mode: 'insensitive' } },
        ],
      },
      include: {
        batches: { where: { status: 'ACTIVE' }, orderBy: { expiryDate: 'asc' } },
        rack: true,
      },
    })

    if (productByName) {
      const stock = productByName.batches.reduce(
        (acc, b) => acc + Math.max(0, b.quantity - b.reservedQuantity - b.soldQuantity),
        0
      )
      matchedProduct = {
        id: productByName.id,
        name: productByName.name,
        genericName: productByName.genericName,
        sku: productByName.sku,
        barcode: productByName.barcode,
        mrp: productByName.mrp.toString(),
        costPrice: productByName.costPrice ? productByName.costPrice.toString() : null,
        rack: productByName.rack
          ? (productByName.rack.shelfNumber
              ? `${productByName.rack.code}-${productByName.rack.shelfNumber}`
              : productByName.rack.code)
          : null,
        unitOfMeasure: productByName.unitOfMeasure,
        currentStock: stock,
        existingBatches: productByName.batches.map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          expiryDate: b.expiryDate.toISOString(),
          quantity: Math.max(0, b.quantity - b.reservedQuantity - b.soldQuantity),
        })),
        matchConfidence: 88,
        matchReason: 'BRAND_NAME',
      }
    }
  }

  // 3. Match by Generic Salt Equivalent (e.g. Amoxicillin + Clavulanic Acid)
  // If brand is new (like Betamox-CV), identify therapeutic category from catalog
  if (!matchedProduct && entity.genericComposition && entity.genericComposition.length >= 5) {
    const saltTokens = entity.genericComposition
      .split(/[\+\&\/]|and/i)
      .map((t) => t.trim().split(/\s+/)[0])
      .filter((t) => t.length >= 4)

    if (saltTokens.length > 0) {
      const productBySalt = await prisma.product.findFirst({
        where: {
          genericName: { contains: saltTokens[0], mode: 'insensitive' },
        },
        include: {
          batches: { where: { status: 'ACTIVE' }, orderBy: { expiryDate: 'asc' } },
          rack: true,
        },
      })

      if (productBySalt) {
        const stock = productBySalt.batches.reduce(
          (acc, b) => acc + Math.max(0, b.quantity - b.reservedQuantity - b.soldQuantity),
          0
        )
        matchedProduct = {
          id: productBySalt.id,
          name: productBySalt.name,
          genericName: productBySalt.genericName,
          sku: productBySalt.sku,
          barcode: productBySalt.barcode,
          mrp: productBySalt.mrp.toString(),
          costPrice: productBySalt.costPrice ? productBySalt.costPrice.toString() : null,
          rack: productBySalt.rack
            ? (productBySalt.rack.shelfNumber
                ? `${productBySalt.rack.code}-${productBySalt.rack.shelfNumber}`
                : productBySalt.rack.code)
            : null,
          unitOfMeasure: productBySalt.unitOfMeasure,
          currentStock: stock,
          existingBatches: productBySalt.batches.map((b) => ({
            id: b.id,
            batchNumber: b.batchNumber,
            expiryDate: b.expiryDate.toISOString(),
            quantity: Math.max(0, b.quantity - b.reservedQuantity - b.soldQuantity),
          })),
          matchConfidence: 75,
          matchReason: 'GENERIC_SALT',
        }
      }
    }
  }

  // Determine recommended action
  let recommendedAction: 'UPDATE_EXISTING_BATCH' | 'ADD_NEW_BATCH' | 'CREATE_NEW_PRODUCT' =
    'CREATE_NEW_PRODUCT'

  if (matchedProduct) {
    const hasBatch =
      entity.batchNumber &&
      matchedProduct.existingBatches.some(
        (b) => b.batchNumber.toLowerCase() === entity.batchNumber?.toLowerCase()
      )
    recommendedAction = hasBatch ? 'UPDATE_EXISTING_BATCH' : 'ADD_NEW_BATCH'
  }

  const defaultCost = entity.mrp ? Math.round(entity.mrp * 0.72 * 100) / 100 : 50

  return {
    scanId,
    surfaceType,
    entity,
    confidence,
    matchedProduct,
    suggestions: {
      recommendedAction,
      recommendedQuantity: 10, // Standard 10 strips box pack
      estimatedPurchaseCost: defaultCost,
    },
  }
}

/**
 * Atomically commits the scanned medicine into PostgreSQL Inventory & Batches
 */
export async function commitScannedInventory(
  input: CommitInventoryScanInput,
  userId: string
): Promise<CommitInventoryScanResult> {
  const branch = await prisma.branch.findFirst({
    where: input.branchId ? { id: input.branchId } : { isActive: true },
    select: { id: true },
  })
  const branchId = branch?.id ?? 'default-branch'

  // Default expiry date fallback if invalid
  const targetExpiry = input.expiryDate
    ? new Date(input.expiryDate)
    : new Date(Date.now() + 365 * 2 * 24 * 60 * 60 * 1000)

  const targetMfg = input.manufacturingDate ? new Date(input.manufacturingDate) : null
  const purchasePrice = input.purchasePrice ?? Math.round(input.mrp * 0.72 * 100) / 100

  return await prisma.$transaction(async (tx) => {
    let targetProductId = input.productId

    // 1. Create product if new
    if (!targetProductId || input.isNewProduct) {
      const generatedSku = input.sku?.trim() || `SKU-${Date.now().toString().slice(-6)}`

      const defaultCategory = await tx.category.findFirst({
        where: { isActive: true },
        select: { id: true },
      })

      let resolvedRackId: string | null = null
      const rackCode = input.rack?.trim().toUpperCase() || 'RECEIVING'
      const existingRack = await tx.rack.findFirst({
        where: { branchId, code: rackCode },
      })
      if (existingRack) {
        resolvedRackId = existingRack.id
      } else {
        const newRack = await tx.rack.create({
          data: {
            branchId,
            code: rackCode,
            shelfNumber: '1',
            description: `Auto-created rack for ${rackCode}`,
          },
        })
        resolvedRackId = newRack.id
      }

      const createdProduct = await tx.product.create({
        data: {
          name: input.productName.trim(),
          genericName: input.genericName?.trim() || null,
          sku: generatedSku,
          barcode: input.barcode?.trim() || null,
          manufacturer: input.manufacturer?.trim() || null,
          rackId: resolvedRackId,
          drugSchedule: (input.drugSchedule as any) || 'NONE',
          unitOfMeasure: input.unitOfMeasure || 'Strip',
          tabsPerStrip: input.tabsPerStrip || 10,
          mrp: input.mrp,
          costPrice: purchasePrice,
          createdById: userId,
          categories: defaultCategory
            ? {
                create: [{ categoryId: defaultCategory.id }],
              }
            : undefined,
        },
      })
      targetProductId = createdProduct.id
    }

    // 2. Fetch or create inventory record for branch
    const inventory = await tx.inventory.upsert({
      where: {
        productId_branchId: {
          productId: targetProductId,
          branchId,
        },
      },
      create: {
        productId: targetProductId,
        branchId,
        totalQuantity: input.quantityToAdd,
        availableQuantity: input.quantityToAdd,
      },
      update: {
        totalQuantity: { increment: input.quantityToAdd },
        availableQuantity: { increment: input.quantityToAdd },
      },
    })

    const previousStock = inventory.totalQuantity - input.quantityToAdd

    // 3. Upsert batch record
    const batch = await tx.batch.upsert({
      where: {
        productId_batchNumber: {
          productId: targetProductId,
          batchNumber: input.batchNumber.trim().toUpperCase(),
        },
      },
      create: {
        productId: targetProductId,
        batchNumber: input.batchNumber.trim().toUpperCase(),
        expiryDate: targetExpiry,
        manufacturingDate: targetMfg,
        purchasePrice,
        mrp: input.mrp,
        quantity: input.quantityToAdd,
        status: 'ACTIVE',
        branchId,
      },
      update: {
        quantity: { increment: input.quantityToAdd },
        expiryDate: targetExpiry,
        mrp: input.mrp,
        purchasePrice,
      },
    })

    // 4. Record Inventory Movement log
    const movement = await tx.inventoryMovement.create({
      data: {
        inventoryId: inventory.id,
        type: 'IN',
        quantity: input.quantityToAdd,
        quantityBefore: previousStock,
        quantityAfter: inventory.totalQuantity,
        referenceType: 'AI_STRIP_SCAN',
        referenceId: batch.id,
        batchId: batch.id,
        notes: input.notes || `AI Strip Scanner Auto-Ingest: ${input.quantityToAdd} units`,
        createdById: userId,
      },
    })

    return {
      productId: targetProductId,
      productName: input.productName,
      sku: input.sku || targetProductId,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      previousStock,
      addedQuantity: input.quantityToAdd,
      newTotalStock: inventory.totalQuantity,
      inventoryMovementId: movement.id,
      createdAt: movement.createdAt.toISOString(),
      message: `Successfully ingested ${input.quantityToAdd} ${input.unitOfMeasure || 'units'} of ${input.productName} (Batch ${batch.batchNumber}) into inventory`,
    }
  })
}
