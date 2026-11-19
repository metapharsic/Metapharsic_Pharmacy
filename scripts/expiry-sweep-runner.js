#!/usr/bin/env node
/**
 * Standalone High-Throughput Batch Expiry Sweep Process Runner
 * Spawns persistent worker threads across CPU cores to process due batch expirations.
 * Emits real-time progress events over IPC and stdout.
 */
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const { Worker } = require('node:worker_threads')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({ log: ['error'] })

function parseArgs() {
  const args = process.argv.slice(2)
  const parsed = {
    jobId: null,
    branchId: null,
    chunkSize: 50,
    concurrency: Math.min(os.cpus().length || 2, 8),
    asOfDate: new Date(),
    dryRun: false,
    initiatedById: null,
    json: false,
  }

  for (const arg of args) {
    if (arg.startsWith('--jobId=')) parsed.jobId = arg.split('=')[1]
    if (arg.startsWith('--branchId=')) parsed.branchId = arg.split('=')[1]
    if (arg.startsWith('--chunkSize=')) parsed.chunkSize = parseInt(arg.split('=')[1], 10) || 50
    if (arg.startsWith('--concurrency=')) parsed.concurrency = parseInt(arg.split('=')[1], 10) || 4
    if (arg.startsWith('--asOfDate=')) parsed.asOfDate = new Date(arg.split('=')[1])
    if (arg.startsWith('--dryRun=')) parsed.dryRun = arg.split('=')[1] === 'true'
    if (arg.startsWith('--initiatedById=')) parsed.initiatedById = arg.split('=')[1]
    if (arg === '--json') parsed.json = true
  }

  return parsed
}

function chunkArray(items, chunkSize) {
  const chunks = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}

function resolveWorkerScriptPath() {
  const candidates = [
    path.resolve(__dirname, '../src/lib/batches/expiry/expiry-worker.js'),
    path.resolve(process.cwd(), 'src/lib/batches/expiry/expiry-worker.js'),
    path.resolve(__dirname, 'expiry-worker.js'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return path.resolve(__dirname, '../src/lib/batches/expiry/expiry-worker.js')
}

class ScriptWorkerPool {
  constructor(scriptPath, timeoutMs = 60000) {
    this.scriptPath = scriptPath
    this.timeoutMs = timeoutMs
    this.workers = []
  }

  async init(concurrency) {
    const initPromises = []
    for (let i = 1; i <= concurrency; i++) {
      const workerId = i
      const p = new Promise((resolve, reject) => {
        let settled = false
        let worker
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
            reject(new Error(`Worker ${workerId} initialization timed out`))
          }
        }, 15000)

        const onMessage = (msg) => {
          if (msg && msg.type === 'WORKER_READY' && !settled) {
            settled = true
            clearTimeout(timer)
            worker.off('message', onMessage)
            worker.off('error', onError)
            resolve()
          }
        }

        const onError = (err) => {
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

  executeChunk(workerEntry, payload) {
    return new Promise((resolve, reject) => {
      let timer = null
      let done = false

      const cleanup = () => {
        if (timer) clearTimeout(timer)
        workerEntry.busy = false
      }

      timer = setTimeout(() => {
        if (!done) {
          done = true
          cleanup()
          reject(new Error(`Worker ${workerEntry.id} timed out processing chunk ${payload.chunkIndex}`))
        }
      }, this.timeoutMs)

      const onMessage = (msg) => {
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

      const onError = (err) => {
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
      workerEntry.worker.postMessage({ type: 'PROCESS_CHUNK', payload })
    })
  }

  async processAllChunks(chunks, config, onProgress) {
    const results = []
    let nextIdx = 0
    let chunksCompleted = 0
    let totalExpired = 0
    let totalSkipped = 0
    let totalFailed = 0
    const sweepStartTime = Date.now()

    const dispatchNext = async (workerEntry) => {
      while (nextIdx < chunks.length) {
        const chunkIndex = nextIdx++
        const chunk = chunks[chunkIndex]

        const payload = {
          workerId: workerEntry.id,
          chunkIndex,
          batches: chunk,
          dryRun: config.dryRun,
          initiatedById: config.initiatedById,
        }

        try {
          const res = await this.executeChunk(workerEntry, payload)
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
            errors: [{ batchId: 'CHUNK_FAIL', error: err.message || String(err) }],
            durationMs: 0,
          })
        }

        if (onProgress) {
          const elapsedMs = Math.max(1, Date.now() - sweepStartTime)
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
    }

    await Promise.all(this.workers.map((w) => dispatchNext(w)))
    return results
  }

  async terminate() {
    const terms = this.workers.map((w) => {
      return new Promise((resolve) => {
        try {
          w.worker.postMessage({ type: 'TERMINATE' })
          const timeout = setTimeout(() => {
            w.worker.terminate().catch(() => {}).finally(() => resolve())
          }, 2000)
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

async function main() {
  const options = parseArgs()
  const startTime = Date.now()

  if (!options.json) {
    console.log(`[ExpiryRunner:PID ${process.pid}] Starting batch expiry sweep...`)
    console.log(`  Concurrency : ${options.concurrency} threads`)
    console.log(`  Chunk Size  : ${options.chunkSize}`)
    console.log(`  Dry Run     : ${options.dryRun}`)
    if (options.branchId) console.log(`  Branch Scope: ${options.branchId}`)
  }

  try {
    const where = {
      expiryDate: { lt: options.asOfDate },
      status: { in: ['ACTIVE', 'BLOCKED'] },
      ...(options.branchId ? { branchId: options.branchId } : {}),
    }

    const dueBatches = await prisma.batch.findMany({
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
    })

    const totalDue = dueBatches.length
    if (!options.json) {
      console.log(`[ExpiryRunner:PID ${process.pid}] Found ${totalDue} due batches.`)
    }

    if (totalDue === 0) {
      const emptyResult = {
        success: true,
        totalDue: 0,
        expiredCount: 0,
        skippedCount: 0,
        errorCount: 0,
        durationMs: Date.now() - startTime,
        modeUsed: 'spawn',
        workersUsed: 0,
        chunksCount: 0,
        throughput: 0,
      }

      if (process.send) {
        process.send({ type: 'SWEEP_COMPLETE', result: emptyResult })
      }
      if (options.json) {
        console.log(JSON.stringify(emptyResult))
      }
      await prisma.$disconnect()
      process.exit(0)
    }

    const chunks = chunkArray(dueBatches, options.chunkSize)
    const workerScriptPath = resolveWorkerScriptPath()
    const concurrency = Math.min(chunks.length, options.concurrency)

    const pool = new ScriptWorkerPool(workerScriptPath)
    await pool.init(concurrency)

    const results = await pool.processAllChunks(chunks, options, (progress) => {
      if (process.send) {
        process.send({ type: 'SWEEP_PROGRESS', progress })
      }
      if (!options.json && progress.chunksCompleted % 2 === 0) {
        process.stdout.write(
          `\r  Progress: ${progress.percentComplete}% (${progress.chunksCompleted}/${progress.totalChunks} chunks) — ${progress.batchesExpired} expired, ${progress.currentThroughput} b/s`
        )
      }
    })

    await pool.terminate()

    let expiredCount = 0
    let skippedCount = 0
    let errorCount = 0
    const errors = []
    const uniqueWorkers = new Set()

    for (const r of results) {
      expiredCount += r.expiredCount
      skippedCount += r.skippedCount
      errorCount += r.errorCount
      uniqueWorkers.add(r.workerId)
      if (r.errors && r.errors.length > 0) errors.push(...r.errors)
    }

    const durationMs = Date.now() - startTime
    const throughput = durationMs > 0 ? (expiredCount + skippedCount) / (durationMs / 1000) : 0

    const finalResult = {
      success: errorCount === 0,
      totalDue,
      expiredCount,
      skippedCount,
      errorCount,
      durationMs,
      modeUsed: 'spawn',
      workersUsed: uniqueWorkers.size,
      chunksCount: chunks.length,
      throughput: Math.round(throughput * 10) / 10,
      ...(errors.length > 0 ? { errors } : {}),
    }

    if (!options.json) {
      console.log(`\n[ExpiryRunner:PID ${process.pid}] Completed in ${finalResult.durationMs}ms:`)
      console.log(`  Total Due     : ${finalResult.totalDue}`)
      console.log(`  Expired       : ${finalResult.expiredCount}`)
      console.log(`  Skipped (CAS) : ${finalResult.skippedCount}`)
      console.log(`  Errors        : ${finalResult.errorCount}`)
      console.log(`  Workers Used  : ${finalResult.workersUsed}`)
      console.log(`  Throughput    : ${finalResult.throughput} batches/sec`)
    } else {
      console.log(JSON.stringify(finalResult))
    }

    if (process.send) {
      process.send({ type: 'SWEEP_COMPLETE', result: finalResult })
    }

    await prisma.$disconnect()
    process.exit(errorCount === 0 ? 0 : 1)
  } catch (err) {
    console.error(`\n[ExpiryRunner:PID ${process.pid}] Fatal error:`, err)
    if (process.send) {
      process.send({
        type: 'SWEEP_ERROR',
        error: err instanceof Error ? err.message : String(err),
      })
    }
    await prisma.$disconnect().catch(() => {})
    process.exit(1)
  }
}

main()
