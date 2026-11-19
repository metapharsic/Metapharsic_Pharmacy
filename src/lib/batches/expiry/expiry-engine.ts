import type { BatchStatus, PrismaClient } from '@prisma/client'

import type { ChunkProcessResult, DueBatchItem } from './expiry-types'

/**
 * Enterprise CAS processor for batch expiration chunks.
 * Uses atomic Compare-And-Swap (where: { id, status: currentStatus }) to eliminate race conditions
 * with concurrent sales, dispensations, or quarantines.
 */
export async function processDueBatchChunk(
  batches: DueBatchItem[],
  prismaClient: PrismaClient,
  options: {
    workerId?: number
    chunkIndex?: number
    dryRun?: boolean
    initiatedById?: string | null
  } = {}
): Promise<ChunkProcessResult> {
  const startTime = Date.now()
  const { workerId = 0, chunkIndex = 0, dryRun = false, initiatedById = null } = options

  const result: ChunkProcessResult = {
    workerId,
    chunkIndex,
    totalInChunk: batches.length,
    expiredCount: 0,
    skippedCount: 0,
    errorCount: 0,
    errors: [],
    durationMs: 0,
  }

  if (batches.length === 0) {
    result.durationMs = Date.now() - startTime
    return result
  }

  if (dryRun) {
    result.expiredCount = batches.length
    result.durationMs = Date.now() - startTime
    return result
  }

  // Process batches using individual or batched CAS updates with audit logging
  for (const batch of batches) {
    try {
      // Execute CAS status transition and audit log atomically per batch
      const updated = await prismaClient.$transaction(async (tx) => {
        // Compare-And-Swap: only update if status matches expected pre-condition
        const updateResult = await tx.batch.updateMany({
          where: {
            id: batch.id,
            status: batch.status,
          },
          data: {
            status: 'EXPIRED' as BatchStatus,
          },
        })

        if (updateResult.count === 0) {
          // Concurrently modified or already transitioned
          return false
        }

        // Create immutable audit trail
        await tx.batchStatusLog.create({
          data: {
            batchId: batch.id,
            fromStatus: batch.status,
            toStatus: 'EXPIRED' as BatchStatus,
            reason: 'Batch expired',
            changedById: initiatedById,
          },
        })

        return true
      })

      if (updated) {
        result.expiredCount += 1
      } else {
        result.skippedCount += 1
      }
    } catch (err) {
      result.errorCount += 1
      result.errors.push({
        batchId: batch.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  result.durationMs = Date.now() - startTime
  return result
}

/**
 * Split an array of items into evenly distributed chunks
 */
export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) chunkSize = 50
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}
