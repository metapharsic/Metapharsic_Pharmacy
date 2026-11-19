import { fork } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import type {
  BatchExpiryOptions,
  BatchExpirySweepResult,
  SpawnedJobStatus,
} from './expiry-types'

// In-memory registry of background spawned expiry jobs with TTL
const jobRegistry = new Map<string, SpawnedJobStatus>()
const MAX_REGISTRY_SIZE = 100

function pruneOldJobs() {
  if (jobRegistry.size > MAX_REGISTRY_SIZE) {
    const sorted = Array.from(jobRegistry.entries()).sort(
      (a, b) => new Date(a[1].startedAt).getTime() - new Date(b[1].startedAt).getTime()
    )
    for (let i = 0; i < sorted.length - MAX_REGISTRY_SIZE; i++) {
      jobRegistry.delete(sorted[i][0])
    }
  }
}

export interface SpawnExecutionHandle {
  jobId: string
  pid: number
  promise: Promise<BatchExpirySweepResult>
  cancel: () => boolean
}

function resolveRunnerScriptPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'scripts', 'expiry-sweep-runner.js'),
    path.resolve(__dirname, '../../../../scripts/expiry-sweep-runner.js'),
    path.resolve(__dirname, 'scripts/expiry-sweep-runner.js'),
  ]

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c
    }
  }

  return path.resolve(process.cwd(), 'scripts', 'expiry-sweep-runner.js')
}

/**
 * Spawns an isolated background Node.js process to execute the multi-threaded
 * batch expiry sweep, completely decoupled from HTTP request lifecycles.
 */
export function spawnExpirySweepProcess(
  options: BatchExpiryOptions = {}
): SpawnExecutionHandle {
  pruneOldJobs()
  const jobId = `expiry-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
  const runnerScript = resolveRunnerScriptPath()

  const childArgs = [
    `--jobId=${jobId}`,
    `--chunkSize=${options.chunkSize ?? 50}`,
    `--concurrency=${options.concurrency ?? 4}`,
    `--dryRun=${!!options.dryRun}`,
    ...(options.branchId ? [`--branchId=${options.branchId}`] : []),
    ...(options.asOfDate ? [`--asOfDate=${new Date(options.asOfDate).toISOString()}`] : []),
    ...(options.initiatedById ? [`--initiatedById=${options.initiatedById}`] : []),
  ]

  const child = fork(runnerScript, childArgs, {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    detached: false,
    env: {
      ...process.env,
      EXPIRY_JOB_ID: jobId,
    },
  })

  const pid = child.pid || 0

  const jobRecord: SpawnedJobStatus = {
    jobId,
    pid,
    status: 'RUNNING',
    startedAt: new Date().toISOString(),
  }
  jobRegistry.set(jobId, jobRecord)

  // Stream child stdout/stderr in non-production
  child.stdout?.on('data', (data) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[ExpiryProcess:${pid}] ${data.toString().trim()}`)
    }
  })

  child.stderr?.on('data', (data) => {
    console.error(`[ExpiryProcess:${pid}:ERR] ${data.toString().trim()}`)
  })

  const promise = new Promise<BatchExpirySweepResult>((resolve, reject) => {
    let finalResult: BatchExpirySweepResult | undefined = undefined

    child.on('message', (msg: any) => {
      if (msg && msg.type === 'SWEEP_COMPLETE') {
        finalResult = {
          ...msg.result,
          pid,
          jobId,
          modeUsed: 'spawn',
        }
        jobRecord.status = 'COMPLETED'
        jobRecord.result = finalResult
        jobRecord.completedAt = new Date().toISOString()
      }
    })

    child.on('error', (err) => {
      jobRecord.status = 'FAILED'
      jobRecord.error = err.message
      jobRecord.completedAt = new Date().toISOString()
      reject(err)
    })

    child.on('exit', (code) => {
      jobRecord.completedAt = new Date().toISOString()
      if (code === 0 && finalResult) {
        jobRecord.status = 'COMPLETED'
        jobRecord.result = finalResult
        resolve(finalResult)
      } else {
        jobRecord.status = 'FAILED'
        const errMsg = finalResult?.errors?.[0]?.error || `Process exited with code ${code}`
        jobRecord.error = errMsg
        reject(new Error(`Spawned expiry sweep process failed: ${errMsg}`))
      }
    })
  })

  const cancel = (): boolean => {
    if (jobRecord.status === 'RUNNING' && child.pid) {
      try {
        child.kill('SIGTERM')
        jobRecord.status = 'FAILED'
        jobRecord.error = 'Cancelled by user request'
        jobRecord.completedAt = new Date().toISOString()
        return true
      } catch {
        return false
      }
    }
    return false
  }

  return {
    jobId,
    pid,
    promise,
    cancel,
  }
}

/**
 * Retrieve status of a spawned job
 */
export function getSpawnedJobStatus(jobId: string): SpawnedJobStatus | undefined {
  return jobRegistry.get(jobId)
}

/**
 * List all active/recent spawned jobs
 */
export function listSpawnedJobs(): SpawnedJobStatus[] {
  return Array.from(jobRegistry.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )
}
