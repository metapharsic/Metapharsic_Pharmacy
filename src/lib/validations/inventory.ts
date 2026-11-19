import { z } from 'zod'

// ─── Enums ────────────────────────────────────────────────────

export const MovementTypeEnum = z.enum([
  'IN',
  'OUT',
  'ADJUSTMENT',
  'RETURN_IN',
  'RETURN_OUT',
  'TRANSFER',
  'WRITE_OFF',
])

export const AdjustmentTypeEnum = z.enum([
  'PHYSICAL_COUNT',
  'DAMAGE',
  'THEFT',
  'EXPIRY',
  'CORRECTION',
  'OPENING_STOCK',
])

export const AdjustmentStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED'])

export const StockStatusEnum = z.enum(['in_stock', 'low_stock', 'out_of_stock', 'overstock'])

// ─── Query Schemas ────────────────────────────────────────────

export const inventoryListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  branchId: z.string().optional(),
  productId: z.string().optional(),
  categoryId: z.string().optional(),
  status: StockStatusEnum.optional(),
  sortBy: z.enum(['product', 'totalQuantity', 'availableQuantity', 'updatedAt']).default('product'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const movementListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  branchId: z.string().optional(),
  productId: z.string().optional(),
  supplierId: z.string().optional(),
  categoryId: z.string().optional(),
  rack: z.string().optional(),
  box: z.string().optional(),
  type: MovementTypeEnum.optional(),
  fefoStatus: z.enum(['all', 'near_expiry', 'expired']).optional(),
  deadStockOnly: z.coerce.boolean().optional(),
})

export const recordMovementSchema = z.object({
  branchId: z.string().min(1, 'Branch is required'),
  productId: z.string().min(1, 'Product is required'),
  batchId: z.string().optional(),
  type: MovementTypeEnum,
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .refine((q) => q !== 0, 'Quantity cannot be zero'),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  fromRack: z.string().optional(),
  fromShelf: z.string().optional(),
  fromBox: z.string().optional(),
  toRack: z.string().optional(),
  toShelf: z.string().optional(),
  toBox: z.string().optional(),
  reason: z.string().min(2, 'Reason is required').max(500),
  notes: z.string().max(2000).optional(),
})

export type RecordMovementInput = z.infer<typeof recordMovementSchema>


export const adjustmentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  branchId: z.string().optional(),
  productId: z.string().optional(),
  supplierId: z.string().optional(),
  status: AdjustmentStatusEnum.optional(),
  adjustmentType: AdjustmentTypeEnum.optional(),
})

// ─── Create Adjustment ────────────────────────────────────────

export const createAdjustmentSchema = z.object({
  branchId: z.string().min(1, 'Branch is required'),
  productId: z.string().min(1, 'Product is required'),
  batchId: z.string().optional(),
  adjustmentType: AdjustmentTypeEnum,
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .refine((q) => q !== 0, 'Quantity cannot be zero'),
  reason: z.string().min(2, 'Reason is required (minimum 2 characters)').max(500),
  notes: z.string().max(2000).optional(),
})

export const updateAdjustmentSchema = z.object({
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .refine((q) => q !== 0, 'Quantity cannot be zero')
    .optional(),
  batchId: z.string().nullable().optional(),
  adjustmentType: AdjustmentTypeEnum.optional(),
  reason: z.string().min(2, 'Reason is required (minimum 2 characters)').max(500).optional(),
  notes: z.string().max(2000).optional(),
})

export type UpdateAdjustmentInput = z.infer<typeof updateAdjustmentSchema>

export const cumulativeAdjustmentItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  batchId: z.string().optional(),
  adjustmentType: AdjustmentTypeEnum,
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .refine((q) => q !== 0, 'Quantity cannot be zero'),
  reason: z.string().min(2, 'Reason is required').max(500),
  notes: z.string().max(2000).optional(),
})

export const cumulativeAdjustmentSchema = z.object({
  branchId: z.string().min(1, 'Branch is required'),
  items: z.array(cumulativeAdjustmentItemSchema).min(1, 'At least one item is required'),
})

export type CumulativeAdjustmentInput = z.infer<typeof cumulativeAdjustmentSchema>
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>
