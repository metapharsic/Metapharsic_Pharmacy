import path from 'path'
import { Worker } from 'worker_threads'

export interface IngestionThreadResult {
  threads: Array<{
    threadId: string
    name: string
    pid: number
    status: 'COMPLETED' | 'RUNNING' | 'FAILED'
    progressPercent: number
    itemsScanned: number
    discrepanciesCount: number
    executionDurationMs: number
    memoryUsageMb: number
    summary: Record<string, any>
  }>
  supplier: {
    rawName: string
    matchedSupplierId?: string | null
    matchConfidence: number
    isNew: boolean
    gstin?: string | null
    pan?: string | null
    dlNumber?: string | null
    phone?: string | null
    email?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    pincode?: string | null
  }
  invoice: {
    invoiceNumber: string
    invoiceDate: string
    dueDate?: string
  }
  items: Array<{
    id: string
    rawDescription: string
    matchedProductName?: string | null
    matchedProductId?: string | null
    matchConfidence: number
    isNewProduct: boolean
    packSize: string
    hsnCode: string
    batchNumber: string
    expiryDate: string
    billedQuantity: number
    freeQuantity: number
    unitCost: number
    mrp: number
    ptr: number
    discountPercent: number
    taxPercent: number
    taxAmount: number
    totalAmount: number
  }>
  financials: {
    subtotal: number
    discountAmount: number
    taxAmount: number
    roundOff: number
    totalAmount: number
    isReconciled: boolean
    reconciliationVariance: number
  }
  paymentTerms: {
    paymentMethod: 'CASH' | 'UPI' | 'CREDIT' | 'CARD' | 'NETBANKING' | 'CHEQUE'
    creditDays: number
    dueDate: string
    paymentReference?: string | null
    upiVpa?: string | null
    bankName?: string | null
    bankAccount?: string | null
    bankIfsc?: string | null
  }
  integrityHash: string
  merkleRoot: string
  overallConfidence: number
}

export interface IngestionWorkerPayload {
  rawText: string
  parsedTableRows?: any[]
  structuredSupplier?: any
  structuredInvoice?: any
  structuredItems?: any[]
  structuredPaymentTerms?: any
  structuredFinancials?: any
  existingSuppliers?: any[]
}

export function runInvoiceIngestionWorker(payload: IngestionWorkerPayload): Promise<IngestionThreadResult> {
  return new Promise((resolve, reject) => {
    try {
      const workerPath = path.resolve(process.cwd(), 'src/lib/scanner/workers/invoice-ingestion.worker.js')
      const worker = new Worker(workerPath)
      const taskId = `inv_${Date.now()}_${Math.random().toString(36).substring(7)}`

      const timeout = setTimeout(() => {
        void worker.terminate()
        try {
          // Fallback in-process execution
          const workerMod = require('./workers/invoice-ingestion.worker.js')
          resolve(workerMod.runAllInvoiceIngestionThreads(payload))
        } catch (err) {
          reject(err)
        }
      }, 10000)

      worker.on(
        'message',
        (msg: { id: string; success: boolean; data?: IngestionThreadResult; error?: string }) => {
          if (msg.id === taskId) {
            clearTimeout(timeout)
            void worker.terminate()
            if (msg.success && msg.data) {
              resolve(msg.data)
            } else {
              // Fallback
              const workerMod = require('./workers/invoice-ingestion.worker.js')
              resolve(workerMod.runAllInvoiceIngestionThreads(payload))
            }
          }
        }
      )

      worker.on('error', () => {
        clearTimeout(timeout)
        void worker.terminate()
        const workerMod = require('./workers/invoice-ingestion.worker.js')
        resolve(workerMod.runAllInvoiceIngestionThreads(payload))
      })

      worker.postMessage({
        id: taskId,
        command: 'RUN_ALL_INVOICE_INGESTION_THREADS',
        payload,
      })
    } catch {
      // In-process fallback
      const workerMod = require('./workers/invoice-ingestion.worker.js')
      resolve(workerMod.runAllInvoiceIngestionThreads(payload))
    }
  })
}

