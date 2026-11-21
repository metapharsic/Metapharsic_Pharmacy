import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { runDeterministicOcr } from '@/lib/scanner/deterministic-ocr-client'
import { parsePrescriptionDocument } from '@/lib/scanner/prescription-parser'

export const dynamic = 'force-dynamic'

/**
 * POST /api/prescriptions/scan
 * Zero-LLM Prescription (Rx) OCR with Dosage Pattern Extraction and PostgreSQL Fuzzy Catalog Matching.
 */
export async function POST(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.PRESCRIPTIONS_CREATE)

    const contentType = req.headers.get('content-type') || ''
    let fileBuffer: Buffer
    let filename = 'prescription.png'
    let branchId: string | undefined

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
      branchId = (formData.get('branchId') as string) || undefined
    } else {
      const body = (await req.json()) as { imageBase64?: string; filename?: string; branchId?: string }
      if (!body.imageBase64) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PAYLOAD', message: 'imageBase64 required' } },
          { status: 400 }
        )
      }
      filename = body.filename || 'prescription.png'
      fileBuffer = Buffer.from(body.imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
      branchId = body.branchId
    }

    const t0 = Date.now()
    const ocrResult = await runDeterministicOcr(fileBuffer, 'prescription', filename)

    if (!ocrResult.success || ocrResult.pages.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'OCR_FAILED',
            message: ocrResult.error || 'Failed to extract prescription lines',
          },
        },
        { status: 422 }
      )
    }

    const allBoxes = ocrResult.pages.flatMap((p) => p.boxes)
    const rxResult = await parsePrescriptionDocument(allBoxes, branchId)
    const processingTimeMs = Date.now() - t0

    return NextResponse.json({
      success: rxResult.success,
      extractionMethod: 'ZERO_LLM_RX_FUZZY_MATCHER',
      processingTimeMs,
      data: rxResult,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message } }, { status })
  }
}
