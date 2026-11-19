import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { createWorker } from 'tesseract.js'

import { requirePermission } from '@/lib/auth/auth-helpers'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { analyzeScannedStrip } from '@/lib/scanner/auto-inventory-service'
import { processPharmaOcrText } from '@/lib/scanner/pharma-ocr-engine'
import type { PackagingSurfaceType } from '@/lib/scanner/strip-scanner-types'

// Cached server-side Tesseract worker for high-speed local fallback
let cachedServerWorker: any = null
let workerInitializing = false

async function getServerOcrWorker() {
  if (cachedServerWorker) return cachedServerWorker
  if (workerInitializing) {
    while (workerInitializing) {
      await new Promise((r) => setTimeout(r, 40))
    }
    if (cachedServerWorker) return cachedServerWorker
  }

  workerInitializing = true
  try {
    const worker = await createWorker('eng')
    cachedServerWorker = worker
    return worker
  } finally {
    workerInitializing = false
  }
}

function isJunkText(text: string): boolean {
  if (!text || text.trim().length < 2) return true
  const lettersOnly = text.replace(/[^a-zA-Z]/g, '')
  if (lettersOnly.length < 2) return true
  const symbolCount = text.replace(/[a-zA-Z0-9\s\-_]/g, '').length
  return symbolCount / text.length > 0.4
}

interface GeminiPharmaFields {
  brandName?: string
  genericComposition?: string
  batchNumber?: string
  manufacturingDate?: string | null
  expiryDate?: string | null
  mrp?: number | null
  packSize?: string
  tabsPerStrip?: number
  drugSchedule?: 'NONE' | 'H' | 'H1' | 'X'
  manufacturer?: string | null
}

async function extractPharmaFieldsViaGemini(imageBuffer: Buffer): Promise<GeminiPharmaFields | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const base64Data = imageBuffer.toString('base64')
  const model = 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const prompt = `You are a high-precision pharmaceutical vision inspector.
Examine this medicine packaging strip or carton carefully.
Read all printed and stamped/debossed ink on the strip directly (including dot-matrix debossing, red medicine stripes, batch codes, and price).
Extract the medicine details strictly as valid JSON with no markdown wrapping:
{
  "brandName": "Exact brand name on strip (e.g. Betamox-CV, Augmentin 625 Duo, Dolo 650)",
  "genericComposition": "Salt composition with strength (e.g. Amoxicillin & Potassium Clavulanate Tablets IP)",
  "batchNumber": "Batch or Lot number",
  "manufacturingDate": "YYYY-MM-DD or MM/YYYY or null",
  "expiryDate": "YYYY-MM-DD or MM/YYYY",
  "mrp": 204.50,
  "tabsPerStrip": 10,
  "drugSchedule": "H1" or "H" or "NONE",
  "manufacturer": "Company name if visible"
}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: 'image/png', data: base64Data } },
            ],
          },
        ],
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    const textOut = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!textOut) return null

    const cleaned = textOut.replace(/```json/gi, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned) as GeminiPharmaFields

    // Format dates to ISO
    if (parsed.expiryDate && parsed.expiryDate.includes('/')) {
      const parts = parsed.expiryDate.split('/')
      if (parts.length === 2) {
        const m = parseInt(parts[0], 10)
        let y = parseInt(parts[1], 10)
        if (y < 100) y += 2000
        const lastDay = new Date(y, m, 0).getDate()
        parsed.expiryDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      }
    }

    if (parsed.manufacturingDate && parsed.manufacturingDate.includes('/')) {
      const parts = parsed.manufacturingDate.split('/')
      if (parts.length === 2) {
        const m = parseInt(parts[0], 10)
        let y = parseInt(parts[1], 10)
        if (y < 100) y += 2000
        const lastDay = new Date(y, m, 0).getDate()
        parsed.manufacturingDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      }
    }

    // Clean MRP
    if (typeof parsed.mrp === 'string') {
      const num = parseFloat((parsed.mrp as string).replace(/[^0-9.]/g, ''))
      parsed.mrp = isNaN(num) ? null : num
    }

    return parsed
  } catch (err) {
    console.warn('[Gemini Vision Extract Error]', err)
    return null
  }
}

// POST /api/inventory/scan/camera-frame
export async function POST(req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.INVENTORY_READ)

    const body = (await req.json()) as {
      imageBase64: string
      surfaceType?: PackagingSurfaceType
      cropRoi?: { x: number; y: number; width: number; height: number }
    }

    if (!body.imageBase64) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'imageBase64 is required' } },
        { status: 400 }
      )
    }

    const surfaceType = body.surfaceType || 'ALU_ALU'

    // Decode base64 buffer
    const base64Data = body.imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    // 1. Inspect image dimensions with sharp
    const image = sharp(buffer)
    const metadata = await image.metadata()
    const origW = metadata.width || 1280
    const origH = metadata.height || 720

    // 2. Center Region of Interest (ROI) if not explicitly supplied
    let roiLeft = Math.floor(origW * 0.10)
    let roiTop = Math.floor(origH * 0.12)
    let roiWidth = Math.floor(origW * 0.80)
    let roiHeight = Math.floor(origH * 0.72)

    if (body.cropRoi && body.cropRoi.width > 50 && body.cropRoi.height > 50) {
      roiLeft = Math.max(0, Math.min(origW - 50, Math.floor(body.cropRoi.x)))
      roiTop = Math.max(0, Math.min(origH - 50, Math.floor(body.cropRoi.y)))
      roiWidth = Math.min(origW - roiLeft, Math.floor(body.cropRoi.width))
      roiHeight = Math.min(origH - roiTop, Math.floor(body.cropRoi.height))
    }

    const roiBuffer = await sharp(buffer)
      .extract({ left: roiLeft, top: roiTop, width: roiWidth, height: roiHeight })
      .resize(Math.min(2400, roiWidth * 2), Math.min(1600, roiHeight * 2), { kernel: 'lanczos3' })
      .png()
      .toBuffer()

    // 3. PRIORITY 1: High-Intelligence AI Vision via Gemini 2.5 Flash
    if (process.env.GEMINI_API_KEY) {
      const geminiRes = await extractPharmaFieldsViaGemini(roiBuffer)
      if (geminiRes && geminiRes.brandName && !isJunkText(geminiRes.brandName)) {
        const visionText = [
          geminiRes.brandName,
          geminiRes.genericComposition || '',
          geminiRes.batchNumber ? `B.No. ${geminiRes.batchNumber}` : '',
          geminiRes.expiryDate ? `EXP. ${geminiRes.expiryDate}` : '',
          geminiRes.manufacturingDate ? `MFD. ${geminiRes.manufacturingDate}` : '',
          geminiRes.mrp ? `M.R.P. Rs. ${geminiRes.mrp}` : '',
          `${geminiRes.tabsPerStrip || 10} Tablets`,
          geminiRes.drugSchedule && geminiRes.drugSchedule !== 'NONE'
            ? `SCHEDULE ${geminiRes.drugSchedule} PRESCRIPTION DRUG`
            : '',
          geminiRes.manufacturer || '',
        ]
          .filter(Boolean)
          .join('\n')

        const catalogAnalysis = await analyzeScannedStrip(visionText, surfaceType)

        // Synthesize SKU
        const brandCode = geminiRes.brandName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'MED'
        const numMatch = (geminiRes.brandName + (geminiRes.genericComposition || '')).match(/\b(\d{2,4})\b/)
        const strengthNum = numMatch ? numMatch[1] : 'GEN'
        const synthesizedSku = `${brandCode}-${strengthNum}-TAB-${geminiRes.tabsPerStrip || 10}`

        return NextResponse.json({
          success: true,
          data: {
            rawText: visionText,
            entity: {
              ...catalogAnalysis.entity,
              name: geminiRes.brandName,
              brandName: geminiRes.brandName,
              genericComposition: geminiRes.genericComposition || catalogAnalysis.entity.genericComposition,
              strength: strengthNum ? `${strengthNum} mg` : catalogAnalysis.entity.strength,
              batchNumber: geminiRes.batchNumber || catalogAnalysis.entity.batchNumber,
              expiryDate: geminiRes.expiryDate || catalogAnalysis.entity.expiryDate,
              manufacturingDate: geminiRes.manufacturingDate || catalogAnalysis.entity.manufacturingDate,
              mrp: geminiRes.mrp ?? catalogAnalysis.entity.mrp ?? 100,
              tabsPerStrip: geminiRes.tabsPerStrip || 10,
              packSize: `${geminiRes.tabsPerStrip || 10} Tablets`,
              drugSchedule: (geminiRes.drugSchedule as any) || catalogAnalysis.entity.drugSchedule || 'NONE',
              manufacturer: geminiRes.manufacturer || catalogAnalysis.entity.manufacturer,
              sku: synthesizedSku,
            },
            confidence: {
              brandName: 98,
              genericComposition: 95,
              batchNumber: 95,
              expiryDate: 96,
              mrp: 95,
              overall: 96,
            },
            matchedProduct: catalogAnalysis.matchedProduct,
            suggestions: catalogAnalysis.suggestions,
            ocrConfidence: 96,
            engine: 'GEMINI_AI_VISION',
          },
        })
      }
    }

    // 4. PRIORITY 2: Fallback Local Optical Character Recognition
    const enhancedBuffer = await sharp(roiBuffer)
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1.5, m1: 2.0, m2: 1.0 })
      .png()
      .toBuffer()

    const worker = await getServerOcrWorker()
    let combinedText = ''
    let totalConfidence = 0

    try {
      await worker.setParameters({ tessedit_pageseg_mode: '6' })
      const resA = await worker.recognize(enhancedBuffer)
      if (resA?.data?.text) {
        combinedText = resA.data.text
        totalConfidence = resA.data.confidence || 0
      }
    } catch {
      await worker.setParameters({ tessedit_pageseg_mode: '3' })
      const resA2 = await worker.recognize(enhancedBuffer)
      if (resA2?.data?.text) {
        combinedText = resA2.data.text
      }
    }

    const { entity, confidence } = processPharmaOcrText(combinedText, surfaceType)

    // JUNK GUARD: If extracted brand name is junk, reject rather than polluting inventory with garbage
    if (isJunkText(entity.brandName || '')) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'LOW_CONTRAST',
          message:
            'Could not extract sharp text from camera. Please hold the strip steady inside the green box, tilt 35° away from glare, or use the "Upload Photo" tab.',
        },
      })
    }

    const catalogAnalysis = await analyzeScannedStrip(combinedText, surfaceType)

    return NextResponse.json({
      success: true,
      data: {
        rawText: combinedText.trim(),
        entity: catalogAnalysis.entity || entity,
        confidence: catalogAnalysis.confidence || confidence,
        matchedProduct: catalogAnalysis.matchedProduct,
        suggestions: catalogAnalysis.suggestions,
        ocrConfidence: Math.round(totalConfidence),
        engine: 'LOCAL_OPTICAL_OCR',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : message.startsWith('Forbidden') ? 403 : 500
    console.error('[POST /api/inventory/scan/camera-frame] Error:', err)
    return NextResponse.json({ success: false, error: { code: 'ERROR', message } }, { status })
  }
}
