// ─────────────────────────────────────────────────────────────
// Reporting Worker Bridge (Node.js Worker Thread Dispatcher)
// ─────────────────────────────────────────────────────────────
import { existsSync } from 'fs'
import path from 'path'
import { Worker } from 'worker_threads'

/**
 * Resolves the reporting worker script path across development, Next.js build runtime,
 * and test environments.
 */
export function getReportingWorkerPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'src/lib/reports/workers/reporting-analytics.worker.js'),
    path.resolve(__dirname, 'workers/reporting-analytics.worker.js'),
    path.resolve(__dirname, 'reporting-analytics.worker.js'),
    path.resolve(process.cwd(), '.next/server/reporting-analytics.worker.js'),
    path.resolve(process.cwd(), '.next/server/chunks/reporting-analytics.worker.js'),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return candidates[0]
}

function isDecimalLike(val: any): boolean {
  return (
    val !== null &&
    typeof val === 'object' &&
    (typeof val.toNumber === 'function' ||
      (typeof val.d !== 'undefined' && typeof val.s !== 'undefined' && typeof val.e !== 'undefined'))
  )
}

function toDecimalNumber(val: any, fallback = 0): number {
  if (val == null) return fallback
  if (typeof val === 'number') return isNaN(val) ? fallback : val
  if (typeof val === 'object' && typeof val.toNumber === 'function') {
    const num = val.toNumber()
    return isNaN(num) ? fallback : num
  }
  const parsed = Number(val)
  return isNaN(parsed) ? fallback : parsed
}

/**
 * Deep sanitization converting Prisma Decimals and Dates to numbers and primitive strings/timestamps
 * to guarantee immunity against Node.js worker_threads DataCloneError.
 */
export function sanitizePayload<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (isDecimalLike(value)) return toDecimalNumber(value) as unknown as T
  if (value instanceof Date) return value.toISOString() as unknown as T
  if (typeof value === 'bigint') return Number(value) as unknown as T
  if (Array.isArray(value)) return value.map((item) => sanitizePayload(item)) as unknown as T
  if (typeof value === 'object') {
    const copy: Record<string, any> = {}
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      copy[k] = sanitizePayload(v)
    }
    return copy as T
  }
  return value
}

let fallbackWorker: any = null
function getFallbackWorker() {
  if (!fallbackWorker) {
    try {
      const p = getReportingWorkerPath()
      fallbackWorker = require(p)
    } catch {
      fallbackWorker = require('./workers/reporting-analytics.worker.js')
    }
  }
  return fallbackWorker
}

export function runReportingWorker<TInput, TOutput>(
  command:
    | 'COMPUTE_SALES_FINANCIALS'
    | 'COMPUTE_GROSS_PROFIT'
    | 'AUDIT_SCHEDULE_H_COMPLIANCE'
    | 'AGGREGATE_DOCTOR_REFERRALS',
  payload: TInput
): Promise<TOutput> {
  const sanitized = sanitizePayload(payload)

  // If running in an environment without Worker support, fallback synchronously
  if (typeof Worker === 'undefined') {
    return Promise.resolve(runSynchronousFallback<TInput, TOutput>(command, sanitized))
  }

  const workerPath = getReportingWorkerPath()
  if (!existsSync(workerPath)) {
    return Promise.resolve(runSynchronousFallback<TInput, TOutput>(command, sanitized))
  }

  return new Promise<TOutput>((resolve, reject) => {
    try {
      const worker = new Worker(workerPath)
      const taskId = `rep_${Date.now()}_${Math.random().toString(36).substring(7)}`

      const timeout = setTimeout(() => {
        void worker.terminate()
        try {
          resolve(runSynchronousFallback<TInput, TOutput>(command, sanitized))
        } catch (err) {
          reject(err)
        }
      }, 5000)

      worker.on(
        'message',
        (msg: { id: string; success: boolean; data?: TOutput; error?: string }) => {
          if (msg.id === taskId) {
            clearTimeout(timeout)
            void worker.terminate()
            if (msg.success && msg.data !== undefined) {
              resolve(msg.data)
            } else {
              try {
                resolve(runSynchronousFallback<TInput, TOutput>(command, sanitized))
              } catch {
                reject(new Error(msg.error || 'Worker execution error'))
              }
            }
          }
        }
      )

      worker.on('error', (err) => {
        clearTimeout(timeout)
        void worker.terminate()
        try {
          resolve(runSynchronousFallback<TInput, TOutput>(command, sanitized))
        } catch {
          reject(err)
        }
      })

      worker.postMessage({ id: taskId, command, payload: sanitized })
    } catch {
      resolve(runSynchronousFallback<TInput, TOutput>(command, sanitized))
    }
  })
}

export function runSynchronousFallback<TInput, TOutput>(command: string, payload: TInput): TOutput {
  const workerModule = getFallbackWorker()
  switch (command) {
    case 'COMPUTE_SALES_FINANCIALS':
      return workerModule.computeSalesFinancials(payload) as TOutput
    case 'COMPUTE_GROSS_PROFIT':
      return workerModule.computeGrossProfit(payload) as TOutput
    case 'AUDIT_SCHEDULE_H_COMPLIANCE':
      return workerModule.auditScheduleHCompliance(payload) as TOutput
    case 'AGGREGATE_DOCTOR_REFERRALS':
      return workerModule.aggregateDoctorReferrals(payload) as TOutput
    default:
      throw new Error(`Unknown command in fallback: ${command}`)
  }
}
