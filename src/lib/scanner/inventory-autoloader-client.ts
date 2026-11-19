/**
 * TypeScript Client for Multi-Threaded Inventory Auto-Loader Worker
 * Metapharsic Lifesciences
 */

import * as path from 'path'
import { Worker } from 'worker_threads'
import type { ExtractedFinancials, ExtractedLineItem } from './pharma-invoice-heuristics'

export interface AutoloaderThreadInfo {
  threadId: string
  name: string
  pid: number
  status: 'COMPLETED' | 'RUNNING' | 'FAILED'
  executionDurationMs: number
  memoryUsageMb: number
  summary: Record<string, unknown>
}

export interface InventoryAutoloaderResult {
  success: boolean
  threads: AutoloaderThreadInfo[]
  items: ExtractedLineItem[]
  financials: ExtractedFinancials
  merkleRoot: string
  error?: { message: string }
}

export interface InventoryAutoloaderPayload {
  rawItems: Array<Record<string, unknown>>
  catalogProducts?: Array<{
    id: string
    name: string
    sku?: string | null
    mrp?: number | null
    ptr?: number | null
    costPrice?: number | null
    gstRate?: number | null
    packSize?: string | null
    tabsPerStrip?: number | null
  }>
  purchaseHistory?: Array<{
    productId?: string | null
    productName?: string | null
    rawDescription?: string | null
    unitCost?: number | null
    ptr?: number | null
    mrp?: number | null
    taxPercent?: number | null
    packSize?: string | null
    tabsPerStrip?: number | null
  }>
  financials?: Record<string, unknown>
}

/**
 * Runs the 5-thread Inventory Auto-Loader Worker
 */
export async function runInventoryAutoloader(
  payload: InventoryAutoloaderPayload
): Promise<InventoryAutoloaderResult> {
  const workerPath = path.resolve(process.cwd(), 'src/lib/scanner/workers/inventory-autoloader.worker.js')

  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(workerPath, { workerData: payload })

      const timeout = setTimeout(() => {
        void worker.terminate()
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
          const { processAutoloaderTask } = require('./workers/inventory-autoloader.worker.js')
          resolve(processAutoloaderTask(payload))
        } catch (e) {
          reject(new Error(`Autoloader worker timed out: ${String(e)}`))
        }
      }, 6000)

      worker.on('message', (res: InventoryAutoloaderResult) => {
        clearTimeout(timeout)
        void worker.terminate()
        if (res.error) {
          reject(new Error(res.error.message))
        } else {
          resolve(res)
        }
      })

      worker.on('error', (err) => {
        clearTimeout(timeout)
        void worker.terminate()
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
          const { processAutoloaderTask } = require('./workers/inventory-autoloader.worker.js')
          resolve(processAutoloaderTask(payload))
        } catch (e) {
          reject(err)
        }
      })
    } catch {
      // In-process fallback
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const { processAutoloaderTask } = require('./workers/inventory-autoloader.worker.js')
        resolve(processAutoloaderTask(payload))
      } catch (err) {
        reject(err)
      }
    }
  })
}

