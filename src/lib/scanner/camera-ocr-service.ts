// ─────────────────────────────────────────────────────────────
// Real-Time Optical AI Camera OCR Service
// Extracts packaging text, dot-matrix debossing, and barcodes from camera frames
// ─────────────────────────────────────────────────────────────

import { applyAluAluSpecularFilter, repairCorruptedDotMatrixText } from './anti-glare-pipeline'
import type { PackagingSurfaceType, StripScanAnalysisResult } from './strip-scanner-types'

export interface CameraOcrResult {
  rawText: string
  confidence: number
  barcode?: string
  processingTimeMs: number
  serverAnalysis?: StripScanAnalysisResult
  snapshotThumbnail?: string
}

// Cached worker instance to avoid re-initializing Tesseract on every snapshot
let cachedWorker: any = null
let workerInitializing = false

async function getOcrWorker() {
  if (cachedWorker) return cachedWorker
  if (workerInitializing) {
    while (workerInitializing) {
      await new Promise((r) => setTimeout(r, 40))
    }
    if (cachedWorker) return cachedWorker
  }

  workerInitializing = true
  try {
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('eng')
    cachedWorker = worker
    return worker
  } finally {
    workerInitializing = false
  }
}

/**
 * Pre-processes an HTML5 Canvas to eliminate metallic foil specular glare,
 * enhance dot-matrix ink debossing, and stretch contrast for optical character recognition.
 */
export function preProcessCanvasForPharmaOcr(
  sourceCanvas: HTMLCanvasElement,
  surfaceType: PackagingSurfaceType = 'ALU_ALU'
): HTMLCanvasElement {
  const processedCanvas = document.createElement('canvas')
  processedCanvas.width = sourceCanvas.width
  processedCanvas.height = sourceCanvas.height
  const ctx = processedCanvas.getContext('2d', { willReadFrequently: true })

  if (!ctx) return sourceCanvas

  ctx.drawImage(sourceCanvas, 0, 0)

  try {
    const imgData = ctx.getImageData(0, 0, processedCanvas.width, processedCanvas.height)
    const filteredPixels = applyAluAluSpecularFilter(
      imgData.data,
      processedCanvas.width,
      processedCanvas.height,
      surfaceType === 'ALU_ALU' ? 'EXTREME' : 'NORMAL'
    )
    imgData.data.set(filteredPixels)
    ctx.putImageData(imgData, 0, 0)
  } catch (err) {
    console.warn('[OCR Pre-process] Fallback to raw canvas:', err)
  }

  return processedCanvas
}

/**
 * Captures a clean snapshot thumbnail from an active video element
 */
export function captureCameraThumbnail(video: HTMLVideoElement): string {
  try {
    const w = 320
    const h = Math.round((video.videoHeight / (video.videoWidth || 1)) * 320) || 180
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, w, h)
      return canvas.toDataURL('image/jpeg', 0.8)
    }
  } catch {
    // Ignore thumbnail error
  }
  return ''
}

/**
 * Performs full optical character recognition and barcode detection from an active video element.
 * Prioritizes high-precision server-side multi-pass processing via libvips / sharp,
 * with instantaneous client-side fallback.
 */
export async function recognizeMedicineStripFromCamera(
  video: HTMLVideoElement,
  surfaceType: PackagingSurfaceType = 'ALU_ALU',
  zoomMacro = 1.0
): Promise<CameraOcrResult> {
  const startTime = performance.now()

  // 1. Capture uncompressed full-resolution frame from video to Canvas
  const width = video.videoWidth || 1280
  const height = video.videoHeight || 720
  const rawCanvas = document.createElement('canvas')
  rawCanvas.width = width
  rawCanvas.height = height
  const ctx = rawCanvas.getContext('2d', { willReadFrequently: true })

  if (!ctx) {
    throw new Error('Could not create offscreen canvas context for camera snapshot.')
  }

  ctx.drawImage(video, 0, 0, width, height)

  const snapshotThumbnail = captureCameraThumbnail(video)

  // 2. Scan for physical 1D/2D barcodes (GS1 DataMatrix, EAN-13, Code 128)
  let detectedBarcode: string | undefined = undefined
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const detector = new (window as any).BarcodeDetector({
        formats: ['ean_13', 'data_matrix', 'code_128', 'qr_code', 'upc_a'],
      })
      const barcodes = await detector.detect(rawCanvas)
      if (barcodes && barcodes.length > 0) {
        detectedBarcode = barcodes[0].rawValue
      }
    } catch (bcErr) {
      console.warn('[OCR BarcodeDetector]', bcErr)
    }
  }

  // 3. Compute Target Region of Interest (ROI) with optional digital macro zoom
  const zoomFactor = Math.max(1.0, Math.min(3.0, zoomMacro))
  const roiW = (width * 0.76) / zoomFactor
  const roiH = (height * 0.65) / zoomFactor
  const roiX = (width - roiW) / 2
  const roiY = (height - roiH) / 2

  const roiCanvas = document.createElement('canvas')
  roiCanvas.width = Math.round(roiW * 1.5)
  roiCanvas.height = Math.round(roiH * 1.5)
  const roiCtx = roiCanvas.getContext('2d', { willReadFrequently: true })
  if (roiCtx) {
    roiCtx.imageSmoothingEnabled = true
    roiCtx.imageSmoothingQuality = 'high'
    roiCtx.drawImage(rawCanvas, roiX, roiY, roiW, roiH, 0, 0, roiCanvas.width, roiCanvas.height)
  }

  const base64Data = rawCanvas.toDataURL('image/jpeg', 0.92)

  // 4. Primary: Try high-precision Server-Side Vision OCR Route
  try {
    const serverRes = await fetch('/api/inventory/scan/camera-frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64Data,
        surfaceType,
        cropRoi: { x: roiX, y: roiY, width: roiW, height: roiH },
      }),
    })

    if (serverRes.ok) {
      const json = await serverRes.json()
      if (json.success && json.data) {
        const data = json.data
        let finalRawText = (data.rawText || '').trim()

        if (detectedBarcode && !finalRawText.includes(detectedBarcode)) {
          finalRawText = `BARCODE: ${detectedBarcode}\n` + finalRawText
        }

        const processingTimeMs = Math.round(performance.now() - startTime)

        return {
          rawText: finalRawText,
          confidence: data.ocrConfidence || data.confidence?.overall || 85,
          barcode: detectedBarcode,
          processingTimeMs,
          serverAnalysis: data,
          snapshotThumbnail,
        }
      }
    }
  } catch (serverErr) {
    console.warn('[Server Vision OCR Fallback to Client]', serverErr)
  }

  // 5. Secondary Client-Side Optical Character Recognition Fallback
  const ocrCanvas = preProcessCanvasForPharmaOcr(roiCanvas, surfaceType)

  let rawText = ''
  let confidence = 0

  try {
    const worker = await getOcrWorker()
    const result = await worker.recognize(ocrCanvas)
    rawText = result.data.text || ''
    confidence = Math.round(result.data.confidence || 0)
  } catch (ocrErr: any) {
    console.warn('[Client Tesseract Error]', ocrErr)
    const Tesseract = await import('tesseract.js')
    const fallbackRes = await Tesseract.recognize(ocrCanvas, 'eng')
    rawText = fallbackRes.data.text || ''
    confidence = Math.round(fallbackRes.data.confidence || 0)
  }

  // Clean and repair dot-matrix debossed labels
  const repairedText = repairCorruptedDotMatrixText(rawText)

  let finalText = repairedText
  if (detectedBarcode && !finalText.includes(detectedBarcode)) {
    finalText = `BARCODE: ${detectedBarcode}\n` + finalText
  }

  const processingTimeMs = Math.round(performance.now() - startTime)

  return {
    rawText: finalText.trim(),
    confidence,
    barcode: detectedBarcode,
    processingTimeMs,
    snapshotThumbnail,
  }
}
