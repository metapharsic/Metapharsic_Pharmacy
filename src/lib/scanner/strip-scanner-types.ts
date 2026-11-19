// ─────────────────────────────────────────────────────────────
// Types & Contracts — AI Pharma Strip & Packaging Scanner
// Supports Alu-Alu, Blister, Mono Carton, and Box Packs
// ─────────────────────────────────────────────────────────────

export type PackagingSurfaceType = 'ALU_ALU' | 'BLISTER' | 'MONO_CARTON' | 'BOX_PACK'

export interface ExtractedPharmaEntity {
  brandName: string | null
  genericComposition: string | null
  strength: string | null // e.g. "625 mg", "500 mg", "40 mg", "1 g"
  batchNumber: string | null
  expiryDate: string | null // ISO 8601 YYYY-MM-DD
  manufacturingDate: string | null // ISO 8601 YYYY-MM-DD or null
  mrp: number | null
  unitPrice: number | null
  packSize: string | null // e.g. "10 Tablets"
  tabsPerStrip: number | null
  manufacturer: string | null
  drugSchedule: 'NONE' | 'H' | 'H1' | 'X' | 'G'
  barcode: string | null
  hsnCode: string | null
  rawOcrText: string
}

export interface EntityConfidenceScore {
  brandName: number // 0 - 100
  genericComposition: number
  batchNumber: number
  expiryDate: number
  mrp: number
  overall: number
}

export interface MatchedCatalogProduct {
  id: string
  name: string
  genericName: string | null
  sku: string
  barcode: string | null
  mrp: string
  costPrice: string | null
  rack: string | null
  unitOfMeasure: string
  currentStock: number
  existingBatches: {
    id: string
    batchNumber: string
    expiryDate: string
    quantity: number
  }[]
  matchConfidence: number // 0 - 100
  matchReason: 'EXACT_BARCODE' | 'EXACT_SKU' | 'BRAND_NAME' | 'GENERIC_SALT' | 'NONE'
}

export interface StripScanAnalysisResult {
  scanId: string
  surfaceType: PackagingSurfaceType
  entity: ExtractedPharmaEntity
  confidence: EntityConfidenceScore
  matchedProduct: MatchedCatalogProduct | null
  suggestions: {
    recommendedAction: 'UPDATE_EXISTING_BATCH' | 'ADD_NEW_BATCH' | 'CREATE_NEW_PRODUCT'
    recommendedQuantity: number
    estimatedPurchaseCost: number
  }
}

export interface CommitInventoryScanInput {
  productId?: string // if updating existing product
  isNewProduct?: boolean
  // Product details (used if creating new or overriding)
  productName: string
  genericName?: string | null
  sku?: string
  barcode?: string | null
  manufacturer?: string | null
  rack?: string | null
  drugSchedule?: 'NONE' | 'H' | 'H1' | 'X' | 'G'
  unitOfMeasure?: string
  tabsPerStrip?: number
  // Batch & Stock details
  batchNumber: string
  expiryDate: string // YYYY-MM-DD
  manufacturingDate?: string | null
  mrp: number
  purchasePrice?: number
  quantityToAdd: number
  branchId?: string
  notes?: string
}

export interface CommitInventoryScanResult {
  productId: string
  productName: string
  sku: string
  batchId: string
  batchNumber: string
  previousStock: number
  addedQuantity: number
  newTotalStock: number
  inventoryMovementId: string
  createdAt: string
  message: string
}
