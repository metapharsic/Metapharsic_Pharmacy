/**
 * Entity Resolution & Fuzzy Catalog Matching Service
 *
 * Implements hierarchical matching:
 * - Supplier: GSTIN (100%) -> DL Number (95%) -> Trigram Name Similarity (>=85%)
 * - Product: Clean Dosage/Pack -> Barcode/SKU -> Trigram Brand Similarity (>=85%)
 */

import type { ExtractedLineItem, ExtractedSupplier, ParsedInvoiceData } from './pharma-invoice-heuristics'
import { runInventoryAutoloader } from './inventory-autoloader-client'

export interface SupplierCatalogItem {
  id: string
  name: string
  gstin?: string | null
  dlNumber?: string | null
  isActive?: boolean
}

export interface ProductCatalogItem {
  id: string
  name: string
  genericName?: string | null
  sku?: string | null
  barcode?: string | null
  mrp?: number | null
  ptr?: number | null
  isActive?: boolean
}

// ─────────────────────────────────────────────────────────────
// Medicine & Supplier Name Cleaners
// ─────────────────────────────────────────────────────────────

/**
 * Strips dosage form, packaging, and pharmacopeial tags to extract the core brand name.
 * e.g. "AUGMENTIN 625 DUO TAB 10'S" -> "AUGMENTIN 625 DUO"
 * e.g. "CALPOL 650 TABLETS IP" -> "CALPOL 650"
 */
export function cleanMedicineName(raw: string): string {
  if (!raw) return ''
  let cleaned = raw.toUpperCase()

  // 1. Strip pharmacopeia tags: IP, BP, USP
  cleaned = cleaned.replace(/\b(IP|BP|USP)\b/g, ' ')

  // 2. Strip packaging units: 10'S, 15'S, 10X10, 100ML, 15 TAB, etc.
  cleaned = cleaned.replace(/\b(\d+\s*['xX\*]\s*\d+|\d+\s*[']?[sS]|\d+\s*ML|\d+\s*GM|\d+\s*MG|\d+\s*VIAL|\d+\s*AMP|\d+\s*TAB|\d+\s*CAP|\d+\s*STRIP)\b/g, ' ')

  // 3. Strip dosage form tags
  const DOSAGE_REGEX = /\b(TAB|TABLET|TABLETS|CAP|CAPSULE|CAPSULES|SYP|SYRUP|INJ|INJECTION|OINT|OINTMENT|GEL|DROPS|SUSP|SUSPENSION|SOL|SOLUTION|CREAM|RESPULES|ROTACAPS|LOTION|POWDER)\b/g
  cleaned = cleaned.replace(DOSAGE_REGEX, ' ')

  // 4. Clean punctuation and excess whitespace
  cleaned = cleaned.replace(/[\(\)\[\]\{\}\#\*\_\+\=]/g, ' ')
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  return cleaned
}

/**
 * Normalizes supplier company names by removing corporate suffixes for fuzzy matching.
 * e.g. "MAHAVEER PHARMA AGENCIES PVT LTD" -> "MAHAVEER PHARMA"
 */
export function cleanSupplierName(raw: string): string {
  if (!raw) return ''
  let cleaned = raw.toUpperCase()

  const SUFFIX_REGEX = /\b(PVT|LTD|PRIVATE|LIMITED|LLP|AGENCIES|DISTRIBUTORS|DISTRIBUTOR|ENTERPRISES|TRADERS|PHARMACEUTICALS|HEALTHCARE|MEDISALES|MEDICO|DRUG HOUSE|AGENCY)\b/g
  cleaned = cleaned.replace(SUFFIX_REGEX, ' ')
  cleaned = cleaned.replace(/[\.,\-\/\&\(\)]/g, ' ')
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  return cleaned
}

// ─────────────────────────────────────────────────────────────
// Trigram Similarity Algorithm
// ─────────────────────────────────────────────────────────────

/**
 * Calculates character trigrams for a string.
 */
function getTrigrams(str: string): Set<string> {
  const s = `  ${str.toLowerCase()} `
  const trigrams = new Set<string>()
  for (let i = 0; i < s.length - 2; i++) {
    trigrams.add(s.slice(i, i + 3))
  }
  return trigrams
}

/**
 * Computes Trigram (Dice coefficient) similarity between two strings (0.0 to 1.0).
 */
export function calculateTrigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0.0
  const normA = a.trim().toLowerCase()
  const normB = b.trim().toLowerCase()

  if (normA === normB) return 1.0

  if (normA.length < 3 || normB.length < 3) {
    // Bigram fallback for short names
    return calculateBigramSimilarity(normA, normB)
  }

  const triA = getTrigrams(normA)
  const triB = getTrigrams(normB)

  let intersection = 0
  for (const t of triA) {
    if (triB.has(t)) intersection++
  }

  const score = (2.0 * intersection) / (triA.size + triB.size)
  return Math.round((score + Number.EPSILON) * 100) / 100
}

function calculateBigramSimilarity(a: string, b: string): number {
  const getBigrams = (s: string) => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
    return set
  }
  const biA = getBigrams(a)
  const biB = getBigrams(b)
  if (biA.size === 0 || biB.size === 0) return 0.0

  let inter = 0
  for (const bg of biA) {
    if (biB.has(bg)) inter++
  }
  return Math.round(((2.0 * inter) / (biA.size + biB.size) + Number.EPSILON) * 100) / 100
}

// ─────────────────────────────────────────────────────────────
// Supplier Resolution
// ─────────────────────────────────────────────────────────────

/**
 * Resolves extracted supplier metadata against active database suppliers:
 * 1. Exact GSTIN match (100% confidence)
 * 2. Drug License number match (95% confidence)
 * 3. Trigram Name Similarity (>=85% confidence)
 */
export function matchSupplier(
  extracted: { rawName: string; gstin?: string; dlNumber?: string },
  suppliers: SupplierCatalogItem[]
): ExtractedSupplier {
  const rawGstin = extracted.gstin?.trim().toUpperCase()
  const rawDl = extracted.dlNumber?.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const cleanExtractedName = cleanSupplierName(extracted.rawName)

  // Tier 1: GSTIN Match (100%)
  if (rawGstin) {
    const gstinMatch = suppliers.find(
      (s) => s.gstin && s.gstin.trim().toUpperCase() === rawGstin
    )
    if (gstinMatch) {
      return {
        rawName: extracted.rawName,
        matchedSupplierId: gstinMatch.id,
        gstin: gstinMatch.gstin || extracted.gstin,
        dlNumber: gstinMatch.dlNumber || extracted.dlNumber,
        matchConfidence: 1.0,
        isNew: false,
      }
    }
  }

  // Tier 2: Drug License Match (95%)
  if (rawDl && rawDl.length >= 5) {
    const dlMatch = suppliers.find((s) => {
      if (!s.dlNumber) return false
      const normDbDl = s.dlNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
      return normDbDl.includes(rawDl) || rawDl.includes(normDbDl)
    })
    if (dlMatch) {
      return {
        rawName: extracted.rawName,
        matchedSupplierId: dlMatch.id,
        gstin: dlMatch.gstin || extracted.gstin,
        dlNumber: dlMatch.dlNumber || extracted.dlNumber,
        matchConfidence: 0.95,
        isNew: false,
      }
    }
  }

  // Tier 3: Trigram Name Similarity (>=85%)
  let bestSupplier: SupplierCatalogItem | null = null
  let bestScore = 0.0

  for (const s of suppliers) {
    const cleanDbName = cleanSupplierName(s.name)
    const score = calculateTrigramSimilarity(cleanExtractedName, cleanDbName)
    if (score > bestScore) {
      bestScore = score
      bestSupplier = s
    }
  }

  if (bestSupplier && bestScore >= 0.85) {
    return {
      rawName: extracted.rawName,
      matchedSupplierId: bestSupplier.id,
      gstin: bestSupplier.gstin || extracted.gstin,
      dlNumber: bestSupplier.dlNumber || extracted.dlNumber,
      matchConfidence: bestScore,
      isNew: false,
    }
  }

  // Fallback: New Unrecognized Supplier
  return {
    rawName: extracted.rawName,
    matchedSupplierId: undefined,
    gstin: extracted.gstin,
    dlNumber: extracted.dlNumber,
    matchConfidence: bestScore >= 0.5 ? bestScore : 0.0,
    isNew: true,
  }
}

// ─────────────────────────────────────────────────────────────
// Product Resolution
// ─────────────────────────────────────────────────────────────

/**
 * Resolves an extracted line item against active catalog products:
 * 1. Barcode / SKU Match (100% confidence)
 * 2. Exact Cleaned Name Match (98% confidence)
 * 3. Trigram Similarity Match (>=85% auto-select)
 */
export function matchProduct(
  item: ExtractedLineItem,
  products: ProductCatalogItem[]
): ExtractedLineItem {
  const cleanedItemName = cleanMedicineName(item.rawDescription)

  // Tier 1: Barcode / SKU Match
  const skuCandidate = item.rawDescription.match(/\b([A-Z0-9\-]{6,15})\b/)
  if (skuCandidate) {
    const sku = skuCandidate[1].toUpperCase()
    const skuMatch = products.find(
      (p) => (p.sku && p.sku.toUpperCase() === sku) || (p.barcode && p.barcode === sku)
    )
    if (skuMatch) {
      return {
        ...item,
        matchedProductId: skuMatch.id,
        matchedProductName: skuMatch.name,
        matchConfidence: 1.0,
        isNewProduct: false,
      }
    }
  }

  // Tier 2: Exact Cleaned Name Match
  const exactMatch = products.find(
    (p) => cleanMedicineName(p.name) === cleanedItemName
  )
  if (exactMatch) {
    return {
      ...item,
      matchedProductId: exactMatch.id,
      matchedProductName: exactMatch.name,
      matchConfidence: 0.98,
      isNewProduct: false,
    }
  }

  // Tier 3: Trigram Similarity Match
  let bestProduct: ProductCatalogItem | null = null
  let bestScore = 0.0

  for (const p of products) {
    const cleanDbName = cleanMedicineName(p.name)
    const score = calculateTrigramSimilarity(cleanedItemName, cleanDbName)
    if (score > bestScore) {
      bestScore = score
      bestProduct = p
    }
  }

  if (bestProduct && bestScore >= 0.85) {
    return {
      ...item,
      matchedProductId: bestProduct.id,
      matchedProductName: bestProduct.name,
      matchConfidence: bestScore,
      isNewProduct: false,
    }
  }

  // Medium Confidence Suggestion or New Product
  return {
    ...item,
    matchedProductId: bestScore >= 0.65 && bestProduct ? bestProduct.id : undefined,
    matchedProductName: bestScore >= 0.65 && bestProduct ? bestProduct.name : undefined,
    matchConfidence: bestScore,
    isNewProduct: bestScore < 0.85,
  }
}

// ─────────────────────────────────────────────────────────────
// Database Entity Matcher
// ─────────────────────────────────────────────────────────────

export interface EntityMatcherPrismaClient {
  supplier: {
    findMany: (args: unknown) => Promise<SupplierCatalogItem[]>
  }
  product: {
    findMany: (args: unknown) => Promise<ProductCatalogItem[]>
  }
}

/**
 * Enriches parsed invoice data by querying active suppliers and products from Prisma.
 */
export async function resolveBillEntitiesWithDatabase(
  billData: ParsedInvoiceData,
  prismaClient?: EntityMatcherPrismaClient | null
): Promise<ParsedInvoiceData> {
  let client = prismaClient
  if (!client) {
    if (process.env.NODE_ENV === 'test') {
      return billData
    }
    try {
      // Dynamic import to avoid SSR/build-time circular issues
      const dbModule = await import('@/lib/db/prisma')
      client = dbModule.default as unknown as EntityMatcherPrismaClient
    } catch {
      // Prisma not available in this context; return as is
      return billData
    }
  }

  try {
    const rawClient = client as Record<string, any>
    const [suppliers, products, recentPurchaseItems] = await Promise.all([
      client.supplier.findMany({
        where: { isActive: true },
        select: { id: true, name: true, gstin: true, dlNumber: true },
      }),
      rawClient.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          genericName: true,
          sku: true,
          barcode: true,
          mrp: true,
          ptr: true,
          costPrice: true,
          gstRate: true,
          packSize: true,
          tabsPerStrip: true,
        },
        take: 1000,
      }),
      rawClient.purchaseItem
        ? rawClient.purchaseItem.findMany({
            take: 300,
            orderBy: { createdAt: 'desc' },
            select: {
              productId: true,
              unitCost: true,
              ptr: true,
              mrp: true,
              taxPercent: true,
            },
          })
        : Promise.resolve([]),
    ])

    const resolvedSupplier = matchSupplier(billData.supplier, suppliers)

    // Run 5-thread Multi-Threaded Inventory Auto-Loader & Historical Invoicing Matcher
    const autoloaderResult = await runInventoryAutoloader({
      rawItems: billData.items as unknown as Array<Record<string, unknown>>,
      catalogProducts: (products || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        mrp: p.mrp ? Number(p.mrp) : null,
        ptr: p.ptr ? Number(p.ptr) : null,
        costPrice: p.costPrice ? Number(p.costPrice) : null,
        gstRate: p.gstRate ? Number(p.gstRate) : null,
        packSize: p.packSize,
        tabsPerStrip: p.tabsPerStrip,
      })),
      purchaseHistory: (recentPurchaseItems || []).map((pi: any) => ({
        productId: pi.productId,
        unitCost: pi.unitCost ? Number(pi.unitCost) : null,
        ptr: pi.ptr ? Number(pi.ptr) : null,
        mrp: pi.mrp ? Number(pi.mrp) : null,
        taxPercent: pi.taxPercent ? Number(pi.taxPercent) : null,
      })),
      financials: billData.financials as unknown as Record<string, unknown>,
    })

    return {
      ...billData,
      supplier: resolvedSupplier,
      items: autoloaderResult.items,
      financials: autoloaderResult.financials || billData.financials,
    }
  } catch (error) {
    // If database query fails, preserve parsed data without throwing
    return billData
  }
}
