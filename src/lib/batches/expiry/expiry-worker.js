/**
 * Enterprise Batch Expiry Worker Thread
 * Runs in an isolated OS thread via node:worker_threads.
 * Manages its own PrismaClient instance and processes batch chunks concurrently.
 * Supports persistent pool worker lifecycle with message-based chunk scheduling.
 */
const { isMainThread, parentPort, workerData } = require('node:worker_threads')
const { PrismaClient } = require('@prisma/client')

if (isMainThread) {
  throw new Error('expiry-worker.js must be executed as a Worker thread, not in main thread.')
}

let prisma = null

function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: ['error'],
    })
  }
  return prisma
}

async function processChunk(payload) {
  const { workerId, chunkIndex, batches, dryRun, initiatedById } = payload
  const startTime = Date.now()
  const db = getPrisma()

  const result = {
    workerId: workerId || 0,
    chunkIndex: chunkIndex || 0,
    totalInChunk: batches.length,
    expiredCount: 0,
    skippedCount: 0,
    errorCount: 0,
    errors: [],
    durationMs: 0,
  }

  if (dryRun) {
    result.expiredCount = batches.length
    result.durationMs = Date.now() - startTime
    return result
  }

  for (const batch of batches) {
    try {
      const updated = await db.$transaction(async (tx) => {
        const updateResult = await tx.batch.updateMany({
          where: {
            id: batch.id,
            status: batch.status,
          },
          data: {
            status: 'EXPIRED',
          },
        })

        if (updateResult.count === 0) {
          return false
        }

        await tx.batchStatusLog.create({
          data: {
            batchId: batch.id,
            fromStatus: batch.status,
            toStatus: 'EXPIRED',
            reason: 'Batch expired (multi-threaded sweep)',
            changedById: initiatedById || null,
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

async function cleanup() {
  if (prisma) {
    try {
      await prisma.$disconnect()
    } catch {
      // Ignore disconnect errors during termination
    }
    prisma = null
  }
}

// Lifecycle coordinator
async function run() {
  if (!parentPort) return

  // 1. Single-task mode (if workerData.batches was provided)
  if (workerData && Array.isArray(workerData.batches)) {
    try {
      const result = await processChunk(workerData)
      parentPort.postMessage({ type: 'CHUNK_COMPLETE', result })
    } catch (err) {
      parentPort.postMessage({
        type: 'ERROR',
        workerId: workerData.workerId,
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      await cleanup()
    }
    return
  }

  // 2. Persistent Pool Worker Mode
  const workerId = workerData?.workerId || 0

  // Signal pool that worker thread and Prisma client are initialized
  try {
    getPrisma()
    parentPort.postMessage({ type: 'WORKER_READY', workerId })
  } catch (err) {
    parentPort.postMessage({
      type: 'ERROR',
      workerId,
      error: `Failed to initialize database client in worker: ${err.message}`,
    })
    return
  }

  // Listen for dispatched chunk processing commands from the orchestrator pool
  parentPort.on('message', async (message) => {
    if (!message || typeof message !== 'object') return

    if (message.type === 'PROCESS_CHUNK') {
      try {
        const result = await processChunk(message.payload)
        parentPort.postMessage({ type: 'CHUNK_COMPLETE', result })
      } catch (err) {
        parentPort.postMessage({
          type: 'ERROR',
          workerId: message.payload?.workerId ?? workerId,
          chunkIndex: message.payload?.chunkIndex,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    } else if (message.type === 'TERMINATE') {
      await cleanup()
      process.exit(0)
    }
  })
}

run().catch(async (err) => {
  if (parentPort) {
    parentPort.postMessage({
      type: 'ERROR',
      workerId: workerData?.workerId || 0,
      error: err instanceof Error ? err.message : String(err),
    })
  }
  await cleanup()
  process.exit(1)
})
