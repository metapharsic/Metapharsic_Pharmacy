import { z } from 'zod'

// ─── Expiry Detection query schemas ──────────────────────────

export const ExpirySeverityEnum = z.enum(['CRITICAL', 'WARNING', 'INFO'])

const baseExpiryQuery = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  productId: z.string().optional(),
  branchId: z.string().optional(),
} as const

/** /api/expiry/expiring — ACTIVE batches within the 90-day window. */
export const expiringBatchesQuerySchema = z.object({
  ...baseExpiryQuery,
  severity: ExpirySeverityEnum.optional(),
})

/** /api/expiry/expired — batches already in EXPIRED status. */
export const expiredBatchesQuerySchema = z.object(baseExpiryQuery)

/** /api/batches/expire — sweep configuration schema */
export const batchExpirySweepSchema = z.object({
  mode: z.enum(['auto', 'worker', 'spawn', 'sync']).default('worker'),
  branchId: z.string().optional(),
  chunkSize: z.coerce.number().int().positive().max(500).default(50),
  concurrency: z.coerce.number().int().positive().max(16).default(4),
  asOfDate: z.string().optional(),
  dryRun: z.boolean().default(false),
})

export type ExpiringBatchesQueryInput = z.infer<typeof expiringBatchesQuerySchema>
export type ExpiredBatchesQueryInput = z.infer<typeof expiredBatchesQuerySchema>
export type BatchExpirySweepInput = z.infer<typeof batchExpirySweepSchema>
