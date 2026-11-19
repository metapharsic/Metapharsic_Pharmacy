import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
import type { Prisma } from '@prisma/client'

import prisma from '@/lib/db/prisma'

import { chunkArray, processDueBatchChunk } from './expiry-engine'
import type {
  BatchExpiryOptions,
  BatchExpirySweepResult,
  ChunkProcessResult,
  DueBatchItem,
  ExpirySweepProgress,
  WorkerTaskPayload,
} from './expiry-types'

const DEFAULT_CHUNK_SIZE = 50
const DEFAULT_TIMEOUT_MS = 60000

function resolveWorkerScriptPath(): string {
  const candidates = [
    path.resolve(__dirname, 'expiry-worker.js'),
    path.resolve(process.cwd(), 'src', 'lib', 'batches', 'expiry', 'expiry-worker.js'),
    path.resolve(process.cwd(), '.next', 'server', 'expiry-worker.js'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  // Fallback to relative file
  return path.resolve(__dirname, 'expiry-worker.js')
}

/**
 * High-performance Worker Thread Pool
 * Maintains warm worker threads with persistent PrismaClient instances.
 * Dynamically feeds chunks via IPC messages and reports real-time progress.
 */
class ExpiryWorkerPool {
  private workers: Array<{
    id: number
    worker: Worker
    busy: boolean
    currentChunkIndex?: number
  }> = []
  private scriptPath: string
  private timeoutMs: number

  constructor(scriptPath: string, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.scriptPath = scriptPath
    this.timeoutMs = timeoutMs
  }

  async init(concurrency: number): Promise<void> {
    const initPromises: Promise<void>[] = []

    for (let i = 1; i <= concurrency; i++) {
      const workerId = i
      const p = new Promise<void>((resolve, reject) => {
        let settled = false
        let worker: Worker

        try {
          worker = new Worker(this.scriptPath, {
            workerData: { workerId, isPoolWorker: true },
          })
        } catch (err) {
          return reject(err)
        }

        const timer = setTimeout(() => {
          if (!settled) {
            settled = true
            worker.terminate().catch(() => {})
            reject(new Error(`Worker ${workerId} initialization timed out after 15000ms`))
          }
        }, 15000)

        const onMessage = (msg: any) => {
          if (msg && msg.type === 'WORKER_READY' && !settled) {
            settled = true
            clearTimeout(timer)
            worker.off('message', onMessage)
            worker.off('error', onError)
            resolve()
          }
        }

        const onError = (err: any) => {
          if (!settled) {
            settled = true
            clearTimeout(timer)
            worker.off('message', onMessage)
            worker.off('error', onError)
            reject(err)
          }
        }

        worker.on('message', onMessage)
        worker.on('error', onError)

        this.workers.push({ id: workerId, worker, busy: false })
      })
      initPromises.push(p)
    }

    await Promise.all(initPromises)
  }

  private executeChunkOnWorker(
    workerEntry: { id: number; worker: Worker; busy: boolean; currentChunkIndex?: number },
    payload: WorkerTaskPayload
  ): Promise<ChunkProcessResult> {
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | null = null
      let done = false

      const cleanup = () => {
        if (timer) clearTimeout(timer)
        workerEntry.busy = false
        workerEntry.currentChunkIndex = undefined
      }

      timer = setTimeout(() => {
        if (!done) {
          done = true
          cleanup()
          reject(new Error(`Worker ${workerEntry.id} timed out processing chunk ${payload.chunkIndex}`))
        }
      }, this.timeoutMs)

      const onMessage = (msg: any) => {
        if (msg && msg.type === 'CHUNK_COMPLETE' && msg.result?.chunkIndex === payload.chunkIndex) {
          if (!done) {
            done = true
            cleanup()
            workerEntry.worker.off('message', onMessage)
            workerEntry.worker.off('error', onError)
            resolve(msg.result)
          }
        } else if (msg && msg.type === 'ERROR' && msg.chunkIndex === payload.chunkIndex) {
          if (!done) {
            done = true
            cleanup()
            workerEntry.worker.off('message', onMessage)
            workerEntry.worker.off('error', onError)
            reject(new Error(msg.error))
          }
        }
      }

      const onError = (err: any) => {
        if (!done) {
          done = true
          cleanup()
          workerEntry.worker.off('message', onMessage)
          workerEntry.worker.off('error', onError)
          reject(err)
        }
      }

      workerEntry.worker.on('message', onMessage)
      workerEntry.worker.on('error', onError)

      workerEntry.busy = true
      workerEntry.currentChunkIndex = payload.chunkIndex
      workerEntry.worker.postMessage({ type: 'PROCESS_CHUNK', payload })
    })
  }

  async processAllChunks(
    chunks: DueBatchItem[][],
    config: {
      dryRun: boolean
      initiatedById: string | null
      onProgress?: (progress: ExpirySweepProgress) => void
    }
  ): Promise<ChunkProcessResult[]> {
    const results: ChunkProcessResult[] = []
    const totalChunks = chunks.length
    let nextChunkIdx = 0
    let chunksCompleted = 0
    let totalExpired = 0
    let totalSkipped = 0
    let totalFailed = 0
    const sweepStartTime = Date.now()

    const dispatchNext = async (workerEntry: (typeof this.workers)[0]): Promise<void> => {
      while (nextChunkIdx < totalChunks) {
        const chunkIndex = nextChunkIdx++
        const chunk = chunks[chunkIndex]

        const payload: WorkerTaskPayload = {
          workerId: workerEntry.id,
          chunkIndex,
          batches: chunk,
          dryRun: config.dryRun,
          initiatedById: config.initiatedById,
        }

        try {
          const res = await this.executeChunkOnWorker(workerEntry, payload)
          results.push(res)
          chunksCompleted++
          totalExpired += res.expiredCount
          totalSkipped += res.skippedCount
          totalFailed += res.errorCount
        } catch (err) {
          chunksCompleted++
          totalFailed += chunk.length
          results.push({
            workerId: workerEntry.id,
            chunkIndex,
            totalInChunk: chunk.length,
            expiredCount: 0,
            skippedCount: 0,
            errorCount: chunk.length,
            errors: [
              {
                batchId: 'CHUNK_FAIL',
                error: err instanceof Error ? err.message : String(err),
              },
            ],
            durationMs: 0,
          })
        }

        if (config.onProgress) {
          const elapsedMs = Math.max(1, Date.now() - sweepStartTime)
          const throughput = (totalExpired + totalSkipped) / (elapsedMs / 1000)
          config.onProgress({
            chunksCompleted,
            totalChunks,
            batchesExpired: totalExpired,
            batchesSkipped: totalSkipped,
            batchesFailed: totalFailed,
            percentComplete: Math.round((chunksCompleted / totalChunks) * 100),
            elapsedMs,
            currentThroughput: Math.round(throughput * 10) / 10,
          })
        }
      }
    }

    const workerDispatches = this.workers.map((w) => dispatchNext(w))
    await Promise.all(workerDispatches)
    return results
  }

  async terminate(): Promise<void> {
    const terms = this.workers.map((w) => {
      return new Promise<void>((resolve) => {
        try {
          w.worker.postMessage({ type: 'TERMINATE' })
          const timeout = setTimeout(() => {
            w.worker.terminate().catch(() => {}).finally(() => resolve())
          }, 3000)
          w.worker.on('exit', () => {
            clearTimeout(timeout)
            resolve()
          })
        } catch {
          resolve()
        }
      })
    })
    await Promise.all(terms)
    this.workers = []
  }
}

/**
 * Enterprise Multi-Threaded Expiry Sweep Orchestrator
 * Slices batches into chunks and coordinates parallel Worker threads to execute CAS updates
 * and audit logs across available CPU cores.
 */
export async function runMultiThreadedExpirySweep(
  options: BatchExpiryOptions = {}
): Promise<BatchExpirySweepResult> {
  const startTime = Date.now()

  const asOfDate = options.asOfDate ? new Date(options.asOfDate) : new Date()
  const chunkSize = Math.max(1, options.chunkSize ?? DEFAULT_CHUNK_SIZE)
  const maxConcurrency = Math.max(1, options.concurrency ?? Math.min(os.cpus().length || 2, 8))
  const dryRun = !!options.dryRun
  const branchId = options.branchId ?? null
  const initiatedById = options.initiatedById ?? null
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  // 1. Discover all batches currently due for expiry
  const where: Prisma.BatchWhereInput = {
    expiryDate: { lt: asOfDate },
    status: { in: ['ACTIVE', 'BLOCKED'] },
    ...(branchId ? { branchId } : {}),
  }

  const dueBatches = (await prisma.batch.findMany({
    where,
    select: {
      id: true,
      batchNumber: true,
      status: true,
      expiryDate: true,
      productId: true,
      branchId: true,
    },
    orderBy: { expiryDate: 'asc' },
  })) as DueBatchItem[]

  const totalDue = dueBatches.length

  if (totalDue === 0) {
    return {
      success: true,
      totalDue: 0,
      expiredCount: 0,
      skippedCount: 0,
      errorCount: 0,
      durationMs: Date.now() - startTime,
      modeUsed: 'worker',
      workersUsed: 0,
      chunksCount: 0,
      throughput: 0,
    }
  }

  // 2. Partition into chunks
  const chunks = chunkArray(dueBatches, chunkSize)
  const chunksCount = chunks.length

  // If sync mode is explicitly requested, run synchronously
  if (options.mode === 'sync') {
    return runSyncChunks(chunks, totalDue, startTime, dryRun, initiatedById, options.onProgress)
  }

  // 3. Coordinate multi-threaded Worker pool
  const workerScriptPath = resolveWorkerScriptPath()
  const effectiveConcurrency = Math.min(chunksCount, maxConcurrency)
  let pool: ExpiryWorkerPool | null = null

  try {
    pool = new ExpiryWorkerPool(workerScriptPath, timeoutMs)
    await pool.init(effectiveConcurrency)

    const chunkResults = await pool.processAllChunks(chunks, {
      dryRun,
      initiatedById,
      onProgress: options.onProgress,
    })

    await pool.terminate()
    return aggregateResults(chunkResults, totalDue, startTime, 'worker', chunksCount)
  } catch (err) {
    if (pool) {
      await pool.terminate().catch(() => {})
    }
    console.warn(
      '[ExpiryOrchestrator] Worker pool encountered issue, falling back to resilient sync chunks:',
      err instanceof Error ? err.message : err
    )
    return runSyncChunks(chunks, totalDue, startTime, dryRun, initiatedById, options.onProgress)
  }
}

/**
 * In-process chunked fallback processor
 */
async function runSyncChunks(
  chunks: DueBatchItem[][],
  totalDue: number,
  startTime: number,
  dryRun: boolean,
  initiatedById: string | null,
  onProgress?: (progress: ExpirySweepProgress) => void
): Promise<BatchExpirySweepResult> {
  const chunkResults: ChunkProcessResult[] = []
  let chunksCompleted = 0
  let totalExpired = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const result = await processDueBatchChunk(chunk, prisma, {
      workerId: 0,
      chunkIndex: i,
      dryRun,
      initiatedById,
    })
    chunkResults.push(result)
    chunksCompleted++
    totalExpired += result.expiredCount
    totalSkipped += result.skippedCount
    totalFailed += result.errorCount

    if (onProgress) {
      const elapsedMs = Math.max(1, Date.now() - startTime)
      const throughput = (totalExpired + totalSkipped) / (elapsedMs / 1000)
      onProgress({
        chunksCompleted,
        totalChunks: chunks.length,
        batchesExpired: totalExpired,
        batchesSkipped: totalSkipped,
        batchesFailed: totalFailed,
        percentComplete: Math.round((chunksCompleted / chunks.length) * 100),
        elapsedMs,
        currentThroughput: Math.round(throughput * 10) / 10,
      })
    }
  }

  return aggregateResults(chunkResults, totalDue, startTime, 'sync', chunks.length)
}

/**
 * Aggregate chunk metrics into final sweep result
 */
function aggregateResults(
  chunkResults: ChunkProcessResult[],
  totalDue: number,
  startTime: number,
  modeUsed: 'worker' | 'sync',
  chunksCount: number
): BatchExpirySweepResult {
  let expiredCount = 0
  let skippedCount = 0
  let errorCount = 0
  const errors: Array<{ batchId?: string; error: string }> = []
  const uniqueWorkers = new Set<number>()

  for (const res of chunkResults) {
    expiredCount += res.expiredCount
    skippedCount += res.skippedCount
    errorCount += res.errorCount
    uniqueWorkers.add(res.workerId)
    if (res.errors && res.errors.length > 0) {
      errors.push(...res.errors)
    }
  }

  const durationMs = Date.now() - startTime
  const throughput = durationMs > 0 ? (expiredCount + skippedCount) / (durationMs / 1000) : 0

  return {
    success: errorCount === 0,
    totalDue,
    expiredCount,
    skippedCount,
    errorCount,
    durationMs,
    modeUsed,
    workersUsed: uniqueWorkers.size,
    chunksCount,
    throughput: Math.round(throughput * 10) / 10,
    ...(errors.length > 0 ? { errors } : {}),
  }
}
