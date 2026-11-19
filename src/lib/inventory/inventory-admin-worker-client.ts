/**
 * Multi-Threaded Inventory Admin Worker Client
 * Metapharsic Lifesciences
 */

import * as path from 'path'
import { Worker } from 'worker_threads'

export interface InventoryThreadInfo {
  threadId: string
  name: string
  pid: number
  status: 'COMPLETED' | 'RUNNING' | 'FAILED'
  executionDurationMs: number
  memoryUsageMb: number
  summary: Record<string, unknown>
}

export interface InventoryAdminWorkerResult {
  success: boolean
  operation: 'MODIFY_ITEM' | 'DELETE_ITEM'
  merkleRoot: string
  threads: InventoryThreadInfo[]
  preparedItem: Record<string, unknown>
  rackSync: Record<string, unknown>
  auditTrail: Record<string, unknown>
  error?: { message: string }
}

export interface InventoryAdminWorkerPayload {
  operation: 'MODIFY_ITEM' | 'DELETE_ITEM'
  operatorUser: {
    id: string
    name?: string
    roles?: string[]
    role?: string
  }
  itemData: {
    id?: string
    productId?: string
    name?: string
    packSize?: string
    tabsPerStrip?: number
    mrp?: number
    ptr?: number
    costPrice?: number
    availableQuantity?: number
    minStockLevel?: number
    reorderLevel?: number
    isActive?: boolean
  }
  currentStock?: number
  rackDetails?: {
    rackId?: string | null
    shelf?: string | null
    box?: string | null
  }
}

/**
 * Runs the 5-thread Admin Inventory Worker
 */
export async function runInventoryAdminWorker(
  payload: InventoryAdminWorkerPayload
): Promise<InventoryAdminWorkerResult> {
  const workerPath = path.resolve(__dirname, 'workers/inventory-admin-operations.worker.js')

  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(workerPath)

      const timer = setTimeout(() => {
        void worker.terminate()
        // Graceful fallback to in-process execution if worker times out
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
          const { processInventoryTask } = require('./workers/inventory-admin-operations.worker.js')
          resolve(processInventoryTask(payload))
        } catch (e) {
          reject(new Error(`Worker timed out: ${String(e)}`))
        }
      }, 5000)

      worker.on('message', (res: InventoryAdminWorkerResult) => {
        clearTimeout(timer)
        void worker.terminate()
        if (res.error) {
          reject(new Error(res.error.message))
        } else {
          resolve(res)
        }
      })

      worker.on('error', (err) => {
        clearTimeout(timer)
        void worker.terminate()
        // In-process fallback
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
          const { processInventoryTask } = require('./workers/inventory-admin-operations.worker.js')
          resolve(processInventoryTask(payload))
        } catch {
          reject(err)
        }
      })

      worker.postMessage(payload)
    } catch {
      // In-process execution fallback
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const { processInventoryTask } = require('./workers/inventory-admin-operations.worker.js')
        resolve(processInventoryTask(payload))
      } catch (err) {
        reject(err)
      }
    }
  })
}

