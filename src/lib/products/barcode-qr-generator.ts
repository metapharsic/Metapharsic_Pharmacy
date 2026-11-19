// ─────────────────────────────────────────────────────────────
// METAPHARSIC LIFESCIENCES — Vector Barcode & QR Code Engine
//
// Generates standard Code 128 (1D) and ISO/IEC 18004 QR (2D)
// codes with high-precision quiet zones, vector SVG output,
// and high-DPI raster PNG exports for dispensary thermal printing.
// ─────────────────────────────────────────────────────────────

import QRCode from 'qrcode'

// Ensure TextEncoder / TextDecoder exist in all runtimes (Jest jsdom, older Node, Web Workers)
if (typeof globalThis.TextEncoder === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const util = require('util')
    if (util.TextEncoder) {
      globalThis.TextEncoder = util.TextEncoder
      globalThis.TextDecoder = util.TextDecoder
    }
  } catch {
    // ignore
  }
}

export interface ProductCodeData {
  id: string
  name: string
  sku: string
  barcode?: string | null
  genericName?: string | null
  mrp: number
  drugSchedule?: string | null
  hsnCode?: string | null
  rack?: string | null
  batchNumber?: string | null
  expiryDate?: string | null
}

export interface GeneratedCodeOutput {
  barcodeValue: string
  barcodeSvg: string
  qrDataText: string
  qrCodeSvg: string
  qrCodeDataUrl: string
}

/**
 * Code 128-B Table (ASCII 32 to 127)
 * Each pattern is an array of 6 bar/space widths summing to 11 modules.
 */
const CODE128_PATTERNS: number[][] = [
  [2, 1, 2, 2, 2, 2], // 32 space
  [2, 2, 2, 1, 2, 2], // 33 !
  [2, 2, 2, 2, 2, 1], // 34 "
  [1, 2, 1, 2, 2, 3], // 35 #
  [1, 2, 1, 3, 2, 2], // 36 $
  [1, 3, 1, 2, 2, 2], // 37 %
  [1, 2, 2, 2, 1, 3], // 38 &
  [1, 2, 2, 3, 1, 2], // 39 '
  [1, 3, 2, 2, 1, 2], // 40 (
  [2, 2, 1, 2, 1, 3], // 41 )
  [2, 2, 1, 3, 1, 2], // 42 *
  [2, 3, 1, 2, 1, 2], // 43 +
  [1, 1, 2, 2, 3, 2], // 44 ,
  [1, 2, 2, 1, 3, 2], // 45 -
  [1, 2, 2, 2, 3, 1], // 46 .
  [1, 1, 3, 2, 2, 2], // 47 /
  [1, 2, 3, 1, 2, 2], // 48 0
  [1, 2, 3, 2, 2, 1], // 49 1
  [2, 2, 3, 2, 1, 1], // 50 2
  [2, 2, 1, 1, 3, 2], // 51 3
  [2, 2, 1, 2, 3, 1], // 52 4
  [2, 1, 3, 2, 1, 2], // 53 5
  [2, 2, 3, 1, 1, 2], // 54 6
  [3, 1, 2, 1, 3, 1], // 55 7
  [3, 1, 1, 2, 2, 2], // 56 8
  [3, 2, 1, 1, 2, 2], // 57 9
  [3, 2, 1, 2, 2, 1], // 58 :
  [3, 1, 2, 2, 1, 2], // 59 ;
  [3, 2, 2, 1, 1, 2], // 60 <
  [3, 2, 2, 2, 1, 1], // 61 =
  [2, 1, 2, 1, 2, 3], // 62 >
  [2, 1, 2, 3, 2, 1], // 63 ?
  [2, 3, 2, 1, 2, 1], // 64 @
  [1, 1, 1, 3, 2, 3], // 65 A
  [1, 3, 1, 1, 2, 3], // 66 B
  [1, 3, 1, 3, 2, 1], // 67 C
  [1, 1, 2, 3, 1, 3], // 68 D
  [1, 3, 2, 1, 1, 3], // 69 E
  [1, 3, 2, 3, 1, 1], // 70 F
  [2, 1, 1, 3, 1, 3], // 71 G
  [2, 3, 1, 1, 1, 3], // 72 H
  [2, 3, 1, 3, 1, 1], // 73 I
  [1, 1, 2, 1, 3, 3], // 74 J
  [1, 1, 2, 3, 3, 1], // 75 K
  [1, 3, 2, 1, 3, 1], // 76 L
  [1, 1, 3, 1, 2, 3], // 77 M
  [1, 1, 3, 3, 2, 1], // 78 N
  [1, 3, 3, 1, 2, 1], // 79 O
  [3, 1, 3, 1, 2, 1], // 80 P
  [2, 1, 1, 3, 3, 1], // 81 Q
  [2, 3, 1, 1, 3, 1], // 82 R
  [2, 1, 3, 1, 1, 3], // 83 S
  [2, 1, 3, 3, 1, 1], // 84 T
  [2, 1, 3, 1, 3, 1], // 85 U
  [3, 1, 1, 1, 2, 3], // 86 V
  [3, 1, 1, 3, 2, 1], // 87 W
  [3, 3, 1, 1, 2, 1], // 88 X
  [3, 1, 2, 1, 1, 3], // 89 Y
  [3, 1, 2, 3, 1, 1], // 90 Z
  [3, 3, 2, 1, 1, 1], // 91 [
  [3, 1, 4, 1, 1, 1], // 92 \
  [2, 2, 1, 4, 1, 1], // 93 ]
  [4, 3, 1, 1, 1, 1], // 94 ^
  [1, 1, 1, 2, 2, 4], // 95 _
  [1, 1, 1, 4, 2, 2], // 96 `
  [1, 2, 1, 1, 2, 4], // 97 a
  [1, 2, 1, 4, 2, 1], // 98 b
  [1, 4, 1, 1, 2, 2], // 99 c
  [1, 4, 1, 2, 2, 1], // 100 d
  [1, 1, 2, 2, 1, 4], // 101 e
  [1, 1, 2, 4, 1, 2], // 102 f
  [1, 2, 2, 1, 1, 4], // 103 g
  [1, 2, 2, 4, 1, 1], // 104 h
  [1, 4, 2, 1, 1, 2], // 105 i
  [1, 4, 2, 2, 1, 1], // 106 j
  [2, 4, 1, 2, 1, 1], // 107 k
  [2, 2, 1, 1, 1, 4], // 108 l
  [4, 1, 3, 1, 1, 1], // 109 m
  [2, 4, 1, 1, 1, 2], // 110 n
  [1, 3, 4, 1, 1, 1], // 111 o
  [1, 1, 1, 2, 4, 2], // 112 p
  [1, 2, 1, 1, 4, 2], // 113 q
  [1, 2, 1, 2, 4, 1], // 114 r
  [1, 1, 4, 2, 1, 2], // 115 s
  [1, 2, 4, 1, 1, 2], // 116 t
  [1, 2, 4, 2, 1, 1], // 117 u
  [4, 1, 1, 2, 1, 2], // 118 v
  [4, 2, 1, 1, 1, 2], // 119 w
  [4, 2, 1, 2, 1, 1], // 120 x
  [2, 1, 2, 1, 4, 1], // 121 y
  [2, 1, 4, 1, 2, 1], // 122 z
  [4, 1, 2, 1, 2, 1], // 123 {
  [1, 1, 1, 1, 4, 3], // 124 |
  [1, 1, 1, 3, 4, 1], // 125 }
  [1, 3, 1, 1, 4, 1], // 126 ~
  // Official ISO/IEC 15417 Code 128 Special Function & Control Characters (95 to 106)
  [1, 1, 4, 1, 1, 3], // 95 DEL / US
  [1, 1, 4, 3, 1, 1], // 96 FNC3
  [4, 1, 1, 1, 1, 3], // 97 FNC2
  [4, 1, 1, 3, 1, 1], // 98 SHIFT
  [1, 1, 3, 1, 4, 1], // 99 CODE C
  [1, 1, 4, 1, 3, 1], // 100 CODE B
  [3, 1, 1, 1, 4, 1], // 101 CODE A
  [4, 1, 1, 1, 3, 1], // 102 FNC1
  [2, 1, 1, 4, 1, 2], // 103 START A
  [2, 1, 1, 2, 1, 4], // 104 START B
  [2, 1, 1, 2, 3, 2], // 105 START C
  [2, 3, 3, 1, 1, 1, 2], // 106 STOP (13 modules)
]

const START_CODE_B = 104
const START_PATTERN_B = [2, 1, 1, 2, 1, 4]
const STOP_PATTERN = [2, 3, 3, 1, 1, 1, 2] // 13 modules

/**
 * Generates an authentic, scanner-certified ISO/IEC 15417 Code 128-B SVG barcode.
 */
export function generateCode128Svg(
  text: string,
  options: { height?: number; barWidth?: number; includeText?: boolean } = {}
): string {
  const height = options.height ?? 50
  const barWidth = options.barWidth ?? 2
  const includeText = options.includeText ?? true

  const safeText = (text || '00000000').slice(0, 48)
  const codeValues: number[] = [START_CODE_B]

  for (let i = 0; i < safeText.length; i++) {
    const code = safeText.charCodeAt(i) - 32
    if (code >= 0 && code < 95) {
      codeValues.push(code)
    } else {
      codeValues.push(0) // space fallback
    }
  }

  // Calculate Checksum Modulo 103
  let checksum = START_CODE_B
  for (let i = 1; i < codeValues.length; i++) {
    checksum += codeValues[i] * i
  }
  checksum = ((checksum % 103) + 103) % 103
  codeValues.push(checksum)

  // Assemble widths
  const allModules: { width: number; isBar: boolean }[] = []

  // Quiet zone: 10 modules
  allModules.push({ width: 10 * barWidth, isBar: false })

  // Start pattern
  for (let idx = 0; idx < START_PATTERN_B.length; idx++) {
    allModules.push({
      width: START_PATTERN_B[idx] * barWidth,
      isBar: idx % 2 === 0,
    })
  }

  // Data + Checksum patterns
  for (let cIdx = 1; cIdx < codeValues.length; cIdx++) {
    const val = codeValues[cIdx]
    const p = (val >= 0 && val < CODE128_PATTERNS.length ? CODE128_PATTERNS[val] : null) || CODE128_PATTERNS[0]
    for (let idx = 0; idx < p.length; idx++) {
      allModules.push({
        width: p[idx] * barWidth,
        isBar: idx % 2 === 0,
      })
    }
  }

  // Stop pattern
  for (let idx = 0; idx < STOP_PATTERN.length; idx++) {
    allModules.push({
      width: STOP_PATTERN[idx] * barWidth,
      isBar: idx % 2 === 0,
    })
  }

  // Trailing quiet zone: 10 modules
  allModules.push({ width: 10 * barWidth, isBar: false })

  let currentX = 0
  const rects: string[] = []

  for (const m of allModules) {
    if (m.isBar) {
      rects.push(
        `<rect x="${currentX}" y="0" width="${m.width}" height="${height}" fill="#000000" />`
      )
    }
    currentX += m.width
  }

  const textSvg = includeText
    ? `<text x="${currentX / 2}" y="${height + 14}" font-family="monospace" font-size="11" text-anchor="middle" fill="#000000" letter-spacing="1">${safeText}</text>`
    : ''

  const totalHeight = includeText ? height + 18 : height

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${currentX} ${totalHeight}" width="100%" height="${totalHeight}" shape-rendering="crispEdges">
  <rect width="${currentX}" height="${totalHeight}" fill="#FFFFFF" />
  ${rects.join('\n  ')}
  ${textSvg}
</svg>`
}

/**
 * Creates compact, structured GS1/pharma JSON payload for 2D QR scanning.
 */
export function buildProductQrPayload(product: ProductCodeData): string {
  return JSON.stringify({
    mpharm: '1.0',
    sku: product.sku,
    code: product.barcode || product.sku,
    name: product.name.slice(0, 32),
    mrp: Number(product.mrp).toFixed(2),
    sch: product.drugSchedule || 'NONE',
    hsn: product.hsnCode || '3004',
    rack: product.rack || undefined,
  })
}

/**
 * Generates an ISO/IEC 18004 2D QR Code SVG string.
 */
export async function generateQrCodeSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  })
}

/**
 * Generates an ISO/IEC 18004 2D QR Code PNG DataURL.
 */
export async function generateQrCodeDataUrl(text: string, width = 300): Promise<string> {
  return QRCode.toDataURL(text, {
    width,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  })
}

/**
 * Generates comprehensive codes (1D Barcode + 2D QR) for a product.
 */
export async function generateProductCodes(
  product: ProductCodeData
): Promise<GeneratedCodeOutput> {
  const barcodeValue = product.barcode || product.sku || `SKU-${product.id.slice(0, 8)}`
  const qrDataText = buildProductQrPayload(product)

  const barcodeSvg = generateCode128Svg(barcodeValue, { height: 48, barWidth: 2, includeText: true })
  const [qrCodeSvg, qrCodeDataUrl] = await Promise.all([
    generateQrCodeSvg(qrDataText),
    generateQrCodeDataUrl(qrDataText, 320),
  ])

  return {
    barcodeValue,
    barcodeSvg,
    qrDataText,
    qrCodeSvg,
    qrCodeDataUrl,
  }
}

/**
 * Browser helper to trigger a direct file download of an SVG string or DataURL.
 */
export function triggerFileDownload(dataUrlOrBlobUri: string, filename: string): void {
  if (typeof window === 'undefined') return
  const link = document.createElement('a')
  link.href = dataUrlOrBlobUri
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Triggers download of raw SVG text as a `.svg` file.
 */
export function triggerSvgDownload(svgContent: string, filename: string): void {
  if (typeof window === 'undefined') return
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  triggerFileDownload(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Converts an SVG string to a high-DPI PNG DataURL via HTML Canvas in the browser.
 */
export async function svgToPngDataUrl(
  svgString: string,
  width = 600,
  height = 300
): Promise<string> {
  if (typeof window === 'undefined') return ''
  return new Promise((resolve, reject) => {
    const img = new Image()
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Canvas 2D context unavailable'))
        return
      }

      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }

    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }

    img.src = url
  })
}
