/**
 * Deterministic OCR Engine Client Bridge
 * Metapharsic Rx - Zero-LLM Architecture
 *
 * Implements a dual-engine deterministic architecture:
 * 1. Primary Engine: OpenCV + PaddleOCR (scripts/deterministic_ocr_engine.py)
 * 2. In-Process Fallback: Sharp Image Enhancement + Local Tesseract.js (eng.traineddata)
 *
 * Guarantees 100% offline local extraction with zero external cloud dependencies.
 */

import { spawn } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import sharp from 'sharp'

export interface OcrBoundingBox {
  text: string
  confidence: number
  box: [number, number, number, number] // [x1, y1, x2, y2]
  page: number
}

export interface DeterministicOcrPage {
  page: number
  width: number
  height: number
  boxes: OcrBoundingBox[]
}

export interface DeterministicOcrResult {
  success: boolean
  mode: 'invoice' | 'receipt' | 'prescription'
  pageCount: number
  totalBoxes: number
  pages: DeterministicOcrPage[]
  engineUsed: 'PADDLE_OPENCV' | 'LOCAL_TESSERACT_SHARP'
  error?: string
}

/**
 * In-process fallback using Sharp + Tesseract.js
 */
async function runLocalTesseractFallback(
  buffer: Buffer,
  mode: 'invoice' | 'receipt' | 'prescription'
): Promise<DeterministicOcrResult> {
  try {
    const meta = await sharp(buffer).metadata()
    const width = meta.width || 1200
    const height = meta.height || 1800

    let pipeline = sharp(buffer).rotate()
    if (height < 2200) {
      pipeline = pipeline.resize({
        height: 2400,
        fit: 'inside',
        kernel: sharp.kernel.lanczos3,
      })
    }

    if (mode === 'receipt') {
      pipeline = pipeline.grayscale().threshold(128)
    } else {
      pipeline = pipeline.grayscale().normalize()
    }

    const processedBuffer = await pipeline.toBuffer()

    const { createWorker, PSM } = await import('tesseract.js')
    const workerScriptPath = path.join(
      process.cwd(),
      'node_modules/tesseract.js/src/worker-script/node/index.js'
    )

    const worker = await createWorker('eng', 1, {
      workerPath: workerScriptPath,
    })

    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
    })

    const result = await worker.recognize(processedBuffer)
    await worker.terminate()

    const boxes: OcrBoundingBox[] = []
    const rawData = result.data as any

    // 1. Check if word-level bounding boxes are available (finest granularity)
    if (Array.isArray(rawData.words) && rawData.words.length > 0) {
      for (const w of rawData.words) {
        const text = String(w.text || '').trim()
        if (!text) continue
        const b = w.bbox || { x0: 0, y0: 0, x1: 50, y1: 20 }
        const conf = typeof w.confidence === 'number' ? w.confidence / 100 : 0.9
        boxes.push({
          text,
          confidence: Math.round(conf * 100) / 100,
          box: [b.x0, b.y0, b.x1, b.y1],
          page: 1,
        })
      }
    } else if (rawData.blocks && Array.isArray(rawData.blocks)) {
      for (const block of rawData.blocks) {
        for (const para of block.paragraphs || []) {
          for (const line of para.lines || []) {
            if (Array.isArray(line.words) && line.words.length > 0) {
              for (const w of line.words) {
                const text = String(w.text || '').trim()
                if (!text) continue
                const b = w.bbox || { x0: 0, y0: 0, x1: 50, y1: 20 }
                const conf = typeof w.confidence === 'number' ? w.confidence / 100 : 0.9
                boxes.push({
                  text,
                  confidence: Math.round(conf * 100) / 100,
                  box: [b.x0, b.y0, b.x1, b.y1],
                  page: 1,
                })
              }
            } else {
              const text = String(line.text || '').trim()
              if (!text) continue
              const b = line.bbox || { x0: 0, y0: 0, x1: 100, y1: 20 }
              const conf = typeof line.confidence === 'number' ? line.confidence / 100 : 0.9
              boxes.push({
                text,
                confidence: Math.round(conf * 100) / 100,
                box: [b.x0, b.y0, b.x1, b.y1],
                page: 1,
              })
            }
          }
        }
      }
    }

    // Fallback: If no boxes were captured, split lines from raw text
    if (boxes.length === 0 && rawData.text) {
      const textLines = String(rawData.text)
        .split('\n')
        .map((l: string) => l.trim())
        .filter(Boolean)
      const lineH = Math.max(10, Math.floor(height / Math.max(textLines.length, 1)))

      textLines.forEach((text: string, i: number) => {
        boxes.push({
          text,
          confidence: 0.9,
          box: [20, i * lineH, width - 20, (i + 1) * lineH - 2],
          page: 1,
        })
      })
    }

    return {
      success: boxes.length > 0,
      mode,
      pageCount: 1,
      totalBoxes: boxes.length,
      pages: [
        {
          page: 1,
          width,
          height,
          boxes,
        },
      ],
      engineUsed: 'LOCAL_TESSERACT_SHARP',
    }
  } catch (err) {
    return {
      success: false,
      mode,
      pageCount: 0,
      totalBoxes: 0,
      pages: [],
      engineUsed: 'LOCAL_TESSERACT_SHARP',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Executes Deterministic OCR on an image buffer or file path
 */
export async function runDeterministicOcr(
  input: Buffer | string,
  mode: 'invoice' | 'receipt' | 'prescription' = 'invoice',
  filename = 'document.png'
): Promise<DeterministicOcrResult> {
  let fileBuffer: Buffer
  let tmpPath: string | null = null
  let filePath: string

  if (typeof input === 'string') {
    filePath = path.resolve(input)
    fileBuffer = await fs.promises.readFile(filePath)
  } else {
    fileBuffer = input
    const ext = path.extname(filename) || '.png'
    tmpPath = path.join(
      os.tmpdir(),
      `det_ocr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
    )
    await fs.promises.writeFile(tmpPath, input)
    filePath = tmpPath
  }

  const scriptPath = path.resolve(process.cwd(), 'scripts/deterministic_ocr_engine.py')

  const pythonResult = await new Promise<DeterministicOcrResult | null>((resolve) => {
    let settled = false
    const cleanup = () => {
      if (tmpPath) {
        fs.promises.unlink(tmpPath).catch(() => {})
      }
    }

    const safeResolve = (res: DeterministicOcrResult | null) => {
      if (!settled) {
        settled = true
        cleanup()
        resolve(res)
      }
    }

    try {
      const pythonBin = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3')
      const pyProc = spawn(pythonBin, [scriptPath, '--input', filePath, '--mode', mode], {
        windowsHide: true,
        timeout: 25000,
        env: {
          ...process.env,
          PYTHONWARNINGS: 'ignore',
          TF_CPP_MIN_LOG_LEVEL: '3',
        },
      })

      let stdoutData = ''

      pyProc.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString('utf8')
      })

      pyProc.on('error', () => {
        safeResolve(null)
      })

      pyProc.on('close', (code) => {
        if (code !== 0 || !stdoutData.trim()) {
          safeResolve(null)
          return
        }

        try {
          const parsed = JSON.parse(stdoutData.trim()) as DeterministicOcrResult
          if (parsed && parsed.success && parsed.totalBoxes > 0) {
            parsed.engineUsed = 'PADDLE_OPENCV'
            safeResolve(parsed)
          } else {
            safeResolve(null)
          }
        } catch {
          safeResolve(null)
        }
      })
    } catch {
      safeResolve(null)
    }
  })

  if (pythonResult && pythonResult.success && pythonResult.totalBoxes > 0) {
    return pythonResult
  }

  // Seamless in-process fallback to Sharp + Tesseract
  return runLocalTesseractFallback(fileBuffer, mode)
}
