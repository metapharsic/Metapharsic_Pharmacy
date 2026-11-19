/**
 * TypeScript Bridge for PaddleOCR & OpenCV Invoice Extraction
 * Invokes the local multi-threaded Python engine or falls back gracefully
 */

import { spawn } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

export interface PaddleOcrInvoiceResult {
  success: boolean
  supplier: {
    name: string
    gstin?: string
    dlNumber?: string
    pan?: string
    phone?: string
    matchConfidence: number
    isNew: boolean
  }
  invoice: {
    invoiceNumber: string
    invoiceDate: string
    dueDate?: string
  }
  items: Array<{
    id: string
    productName: string
    genericName?: string
    packSize: string
    tabsPerStrip: number
    hsnCode: string
    batchNumber: string
    expiryDate: string
    billedQuantity: number
    freeQuantity: number
    unitCost: number
    mrp: number
    ptr: number
    stripSellingPrice: number
    tabletCost: number
    tabletSellingPrice: number
    discountPercent: number
    taxPercent: number
    taxAmount: number
    totalAmount: number
    matchConfidence: number
    isNewProduct: boolean
  }>
  financials: {
    subtotal: number
    taxAmount: number
    discountAmount: number
    roundOff: number
    totalAmount: number
    isReconciled: boolean
    reconciliationVariance: number
  }
  pageCount?: number
  error?: string
}

/**
 * Executes multi-threaded PaddleOCR + OpenCV invoice extraction via Python script
 */
export async function runPaddleOcrExtraction(
  buffer: Buffer,
  filename: string
): Promise<PaddleOcrInvoiceResult | null> {
  // In test environment, skip external Python spawn to avoid test timeouts
  if (process.env.NODE_ENV === 'test') {
    return null
  }

  // Write buffer to temporary file for Python ingestion
  const tmpDir = os.tmpdir()
  const ext = path.extname(filename) || '.pdf'
  const tmpPath = path.join(tmpDir, `paddle_invoice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`)

  try {
    await fs.promises.writeFile(tmpPath, buffer)
    const scriptPath = path.resolve(process.cwd(), 'scripts/paddleocr_invoice_service.py')

    return await new Promise<PaddleOcrInvoiceResult | null>((resolve) => {
      let settled = false
      const safeResolve = (res: PaddleOcrInvoiceResult | null) => {
        if (!settled) {
          settled = true
          void fs.promises.unlink(tmpPath).catch(() => {})
          resolve(res)
        }
      }

      const pyProcess = spawn('python', [scriptPath, '--input', tmpPath], {
        windowsHide: true,
        timeout: 15000, // 15s maximum timeout for CPU inference
        env: {
          ...process.env,
          PYTHONWARNINGS: 'ignore',
          TF_CPP_MIN_LOG_LEVEL: '3',
          PADDLE_DISABLE_STATIC_MODEL: '1',
          PADDLE_DISABLE_MKLDNN: '1',
        },
      })

      // Hard safety timer at 16s in case spawn timeout hangs
      const killTimer = setTimeout(() => {
        try {
          pyProcess.kill('SIGKILL')
        } catch {}
        safeResolve(null)
      }, 16000)

      let stdoutData = ''
      let stderrData = ''

      pyProcess.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString()
      })

      pyProcess.stderr.on('data', (chunk) => {
        stderrData += chunk.toString()
      })

      pyProcess.on('error', () => {
        clearTimeout(killTimer)
        safeResolve(null)
      })

      pyProcess.on('close', (code) => {
        clearTimeout(killTimer)
        if (code !== 0) {
          // Gracefully fall back to Gemini Vision / Tesseract / Heuristic without terminal error
          return safeResolve(null)
        }

        try {
          // Parse JSON from stdout (ignoring any paddle logging warnings)
          const jsonStart = stdoutData.indexOf('{')
          const jsonEnd = stdoutData.lastIndexOf('}')
          if (jsonStart !== -1 && jsonEnd !== -1) {
            const rawJson = stdoutData.slice(jsonStart, jsonEnd + 1)
            const parsed = JSON.parse(rawJson) as PaddleOcrInvoiceResult
            if (parsed.success && Array.isArray(parsed.items) && parsed.items.length > 0) {
              return safeResolve(parsed)
            }
          }
          safeResolve(null)
        } catch (err) {
          safeResolve(null)
        }
      })
    })
  } catch (err) {
    void fs.promises.unlink(tmpPath).catch(() => {})
    return null
  }
}
