import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { runDeterministicOcr } from '../deterministic-ocr-client'
import { reconstructInvoiceFromBoxes } from '../spatial-table-reconstructor'

describe('Real Wholesale Invoice Zero-LLM Pipeline Test', () => {
  it('extracts text boxes and reconstructs invoice from real invoice image', async () => {
    const invoicePath = path.resolve(process.cwd(), 'invoice_pic/1.jpeg')
    if (!fs.existsSync(invoicePath)) {
      console.warn('invoice_pic/1.jpeg not found, skipping real file test')
      return
    }

    const imgBuffer = fs.readFileSync(invoicePath)
    const ocrResult = await runDeterministicOcr(imgBuffer, 'invoice', '1.jpeg')

    expect(ocrResult.success).toBe(true)
    expect(ocrResult.totalBoxes).toBeGreaterThan(0)
    expect(['PADDLE_OPENCV', 'LOCAL_TESSERACT_SHARP']).toContain(ocrResult.engineUsed)

    const allBoxes = ocrResult.pages.flatMap((p) => p.boxes)
    const invoice = reconstructInvoiceFromBoxes(allBoxes)

    expect(invoice.success).toBe(true)
    expect(invoice.invoice.invoiceNumber).toBeDefined()
    expect(invoice.items.length).toBeGreaterThan(0)
    expect(invoice.financials.totalAmount).toBeGreaterThan(0)
    expect(invoice.items[0].productName).toBeDefined()
  }, 35000)
})
