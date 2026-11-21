import * as fs from 'fs'
import { runDeterministicOcr } from '../src/lib/scanner/deterministic-ocr-client'
import { reconstructInvoiceFromBoxes } from '../src/lib/scanner/spatial-table-reconstructor'

async function main() {
  console.log('Testing Zero-LLM Deterministic Pipeline on invoice_pic/1.jpeg...')
  const imgBuffer = fs.readFileSync('invoice_pic/1.jpeg')
  const t0 = Date.now()

  const ocrResult = await runDeterministicOcr(imgBuffer, 'invoice', '1.jpeg')
  console.log(`OCR execution completed in ${Date.now() - t0} ms. Total boxes: ${ocrResult.totalBoxes}`)

  if (!ocrResult.success || ocrResult.pages.length === 0) {
    console.error('OCR failed:', ocrResult.error)
    process.exit(1)
  }

  const allBoxes = ocrResult.pages.flatMap((p) => p.boxes)
  const reconstructed = reconstructInvoiceFromBoxes(allBoxes)

  console.log('\n--- ZERO-LLM RECONSTRUCTED INVOICE ---')
  console.log('Supplier:', reconstructed.supplier.rawName, '(GSTIN:', reconstructed.supplier.gstin, ')')
  console.log('Invoice #:', reconstructed.invoice.invoiceNumber, '(Date:', reconstructed.invoice.invoiceDate, ')')
  console.log('Items Count:', reconstructed.items.length)
  console.log('Financials:', reconstructed.financials)
  console.log('Validation Errors:', reconstructed.validationErrors)
}

main().catch(console.error)
