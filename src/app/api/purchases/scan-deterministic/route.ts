import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { runDeterministicOcr } from '@/lib/scanner/deterministic-ocr-client'
import { reconstructInvoiceFromBoxes } from '@/lib/scanner/spatial-table-reconstructor'
import { parsePurchaseBill } from '@/lib/scanner/purchase-bill-parser'

export const dynamic = 'force-dynamic'

/**
 * POST /api/purchases/scan-deterministic
 * Zero-LLM spatial table extraction for wholesale purchase bills.
 */
export async function POST(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.PURCHASES_CREATE)

    const contentType = req.headers.get('content-type') || ''
    let fileBuffer: Buffer
    let filename = 'invoice.png'

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      if (!file) {
        return NextResponse.json(
          { success: false, error: { code: 'NO_FILE', message: 'No file uploaded' } },
          { status: 400 }
        )
      }
      filename = file.name
      fileBuffer = Buffer.from(await file.arrayBuffer())
    } else {
      const body = (await req.json()) as { imageBase64?: string; filename?: string }
      if (!body.imageBase64) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PAYLOAD', message: 'imageBase64 required' } },
          { status: 400 }
        )
      }
      filename = body.filename || 'invoice.png'
      fileBuffer = Buffer.from(body.imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    }

    const t0 = Date.now()
    const ocrResult = await runDeterministicOcr(fileBuffer, 'invoice', filename)

    if (!ocrResult.success || ocrResult.pages.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'OCR_FAILED',
            message: ocrResult.error || 'Failed to extract text from document',
          },
        },
        { status: 422 }
      )
    }

    const allBoxes = ocrResult.pages.flatMap((p) => p.boxes)
    const reconstructed = reconstructInvoiceFromBoxes(allBoxes)
    const processingTimeMs = Date.now() - t0

    // Automatic AI Vision Cascade: If deterministic spatial clustering yields fewer than 3 items
    // or zero financial totals (typical on crumpled, skewed, or mobile phone camera photos), seamlessly upgrade to Gemini Vision
    if (reconstructed.items.length < 3 || reconstructed.financials.totalAmount <= 0) {
      try {
        const mimeType = filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
        const aiFallback = await parsePurchaseBill(fileBuffer, mimeType, { filename })
        if (aiFallback.success && aiFallback.extractedData?.items?.length > 0) {
          return NextResponse.json({
            ...aiFallback,
            extractionMethod: 'HYBRID_AI_VISION_CASCADE',
            processingTimeMs: Date.now() - t0,
          })
        }
      } catch (cascadeErr) {
        console.warn('[DeterministicScan] AI cascade fallback error:', cascadeErr)
      }
    }

    return NextResponse.json({
      success: reconstructed.success,
      confidence: 0.95,
      extractionMethod: 'ZERO_LLM_DETERMINISTIC_GRID',
      processingTimeMs,
      pageCount: ocrResult.pageCount,
      totalBoxesExtracted: allBoxes.length,
      extractedData: {
        supplier: {
          rawName: reconstructed.supplier.rawName,
          gstin: reconstructed.supplier.gstin,
          dlNumber: reconstructed.supplier.dlNumber,
          phone: reconstructed.supplier.phone,
        },
        invoice: {
          invoiceNumber: reconstructed.invoice.invoiceNumber,
          invoiceDate: reconstructed.invoice.invoiceDate,
        },
        items: reconstructed.items,
        financials: reconstructed.financials,
      },
      data: reconstructed,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message } }, { status })
  }
}
