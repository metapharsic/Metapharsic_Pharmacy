// ─────────────────────────────────────────────────────────────
// PharmaVision™ AI Strip & Blister Cavity Detection Engine
// Marg ERP & Tally Vision style tablet counting algorithm
// ─────────────────────────────────────────────────────────────

export type CavityState = 'FILLED' | 'CUT'

export interface DetectedCavity {
  id: number
  x: number // percentage 0 - 100
  y: number // percentage 0 - 100
  radius: number // percentage
  state: CavityState
  confidence: number // 0 - 1
  label: string
}

export interface StripAnalysisResult {
  totalCapacity: number
  cutCount: number
  filledCount: number
  confidence: number
  gridRows: number
  gridCols: number
  detectedDrugName?: string
  suggestedPackSize: number
  cavities: DetectedCavity[]
  summary: string
  processedAt: string
}

export interface DemoStripSample {
  id: string
  name: string
  composition: string
  totalCapacity: number
  cutCount: number
  filledCount: number
  gridRows: number
  gridCols: number
  stripColor: string
  pillColor: string
  foilPattern: 'silver' | 'alu-alu' | 'blister-pv' | 'golden'
  description: string
  cavities: DetectedCavity[]
}

/**
 * Pre-calibrated pharmaceutical blister strip test samples
 * for instant testing without an active camera feed.
 */
export const DEMO_STRIP_SAMPLES: DemoStripSample[] = [
  {
    id: 'dolo-650-3cut',
    name: 'Dolo 650mg Strip (10s)',
    composition: 'Paracetamol 650mg',
    totalCapacity: 10,
    cutCount: 3,
    filledCount: 7,
    gridRows: 2,
    gridCols: 5,
    stripColor: '#1e3a8a',
    pillColor: '#ffffff',
    foilPattern: 'silver',
    description: '10-tablet strip with 3 tablets cut from top left corner (Retail loose sale)',
    cavities: [
      { id: 1, x: 18, y: 30, radius: 8, state: 'CUT', confidence: 0.98, label: 'Cut #1' },
      { id: 2, x: 34, y: 30, radius: 8, state: 'CUT', confidence: 0.97, label: 'Cut #2' },
      { id: 3, x: 50, y: 30, radius: 8, state: 'CUT', confidence: 0.96, label: 'Cut #3' },
      { id: 4, x: 66, y: 30, radius: 8, state: 'FILLED', confidence: 0.99, label: 'Pill #4' },
      { id: 5, x: 82, y: 30, radius: 8, state: 'FILLED', confidence: 0.99, label: 'Pill #5' },
      { id: 6, x: 18, y: 70, radius: 8, state: 'FILLED', confidence: 0.98, label: 'Pill #6' },
      { id: 7, x: 34, y: 70, radius: 8, state: 'FILLED', confidence: 0.98, label: 'Pill #7' },
      { id: 8, x: 50, y: 70, radius: 8, state: 'FILLED', confidence: 0.99, label: 'Pill #8' },
      { id: 9, x: 66, y: 70, radius: 8, state: 'FILLED', confidence: 0.99, label: 'Pill #9' },
      { id: 10, x: 82, y: 70, radius: 8, state: 'FILLED', confidence: 0.99, label: 'Pill #10' },
    ],
  },
  {
    id: 'calpol-500-5cut',
    name: 'Calpol 500mg Strip (10s)',
    composition: 'Paracetamol 500mg',
    totalCapacity: 10,
    cutCount: 5,
    filledCount: 5,
    gridRows: 2,
    gridCols: 5,
    stripColor: '#047857',
    pillColor: '#f8fafc',
    foilPattern: 'alu-alu',
    description: 'Half strip remaining: entire top row of 5 tablets cut and dispensed',
    cavities: [
      { id: 1, x: 18, y: 30, radius: 8, state: 'CUT', confidence: 0.99, label: 'Cut #1' },
      { id: 2, x: 34, y: 30, radius: 8, state: 'CUT', confidence: 0.98, label: 'Cut #2' },
      { id: 3, x: 50, y: 30, radius: 8, state: 'CUT', confidence: 0.99, label: 'Cut #3' },
      { id: 4, x: 66, y: 30, radius: 8, state: 'CUT', confidence: 0.97, label: 'Cut #4' },
      { id: 5, x: 82, y: 30, radius: 8, state: 'CUT', confidence: 0.98, label: 'Cut #5' },
      { id: 6, x: 18, y: 70, radius: 8, state: 'FILLED', confidence: 0.99, label: 'Pill #6' },
      { id: 7, x: 34, y: 70, radius: 8, state: 'FILLED', confidence: 0.99, label: 'Pill #7' },
      { id: 8, x: 50, y: 70, radius: 8, state: 'FILLED', confidence: 0.98, label: 'Pill #8' },
      { id: 9, x: 66, y: 70, radius: 8, state: 'FILLED', confidence: 0.99, label: 'Pill #9' },
      { id: 10, x: 82, y: 70, radius: 8, state: 'FILLED', confidence: 0.99, label: 'Pill #10' },
    ],
  },
  {
    id: 'azee-500-2cut',
    name: 'Azee 500mg Strip (6s)',
    composition: 'Azithromycin 500mg',
    totalCapacity: 6,
    cutCount: 2,
    filledCount: 4,
    gridRows: 2,
    gridCols: 3,
    stripColor: '#b45309',
    pillColor: '#fef08a',
    foilPattern: 'blister-pv',
    description: '6-tablet antibiotic strip with 2 tablets cut for a 2-day dose',
    cavities: [
      { id: 1, x: 25, y: 30, radius: 10, state: 'CUT', confidence: 0.97, label: 'Cut #1' },
      { id: 2, x: 50, y: 30, radius: 10, state: 'CUT', confidence: 0.98, label: 'Cut #2' },
      { id: 3, x: 75, y: 30, radius: 10, state: 'FILLED', confidence: 0.99, label: 'Pill #3' },
      { id: 4, x: 25, y: 70, radius: 10, state: 'FILLED', confidence: 0.99, label: 'Pill #4' },
      { id: 5, x: 50, y: 70, radius: 10, state: 'FILLED', confidence: 0.98, label: 'Pill #5' },
      { id: 6, x: 75, y: 70, radius: 10, state: 'FILLED', confidence: 0.99, label: 'Pill #6' },
    ],
  },
  {
    id: 'pan-40-4cut',
    name: 'Pan 40 Gastro-Resistant Strip (15s)',
    composition: 'Pantoprazole 40mg',
    totalCapacity: 15,
    cutCount: 4,
    filledCount: 11,
    gridRows: 3,
    gridCols: 5,
    stripColor: '#6d28d9',
    pillColor: '#fde047',
    foilPattern: 'alu-alu',
    description: '15-tablet strip with 4 loose tablets cut from lower edge',
    cavities: [
      { id: 1, x: 18, y: 22, radius: 7, state: 'FILLED', confidence: 0.99, label: 'Pill #1' },
      { id: 2, x: 34, y: 22, radius: 7, state: 'FILLED', confidence: 0.98, label: 'Pill #2' },
      { id: 3, x: 50, y: 22, radius: 7, state: 'FILLED', confidence: 0.99, label: 'Pill #3' },
      { id: 4, x: 66, y: 22, radius: 7, state: 'FILLED', confidence: 0.98, label: 'Pill #4' },
      { id: 5, x: 82, y: 22, radius: 7, state: 'FILLED', confidence: 0.99, label: 'Pill #5' },
      { id: 6, x: 18, y: 50, radius: 7, state: 'FILLED', confidence: 0.98, label: 'Pill #6' },
      { id: 7, x: 34, y: 50, radius: 7, state: 'FILLED', confidence: 0.99, label: 'Pill #7' },
      { id: 8, x: 50, y: 50, radius: 7, state: 'FILLED', confidence: 0.98, label: 'Pill #8' },
      { id: 9, x: 66, y: 50, radius: 7, state: 'FILLED', confidence: 0.99, label: 'Pill #9' },
      { id: 10, x: 82, y: 50, radius: 7, state: 'FILLED', confidence: 0.99, label: 'Pill #10' },
      { id: 11, x: 18, y: 78, radius: 7, state: 'FILLED', confidence: 0.98, label: 'Pill #11' },
      { id: 12, x: 34, y: 78, radius: 7, state: 'CUT', confidence: 0.97, label: 'Cut #12' },
      { id: 13, x: 50, y: 78, radius: 7, state: 'CUT', confidence: 0.98, label: 'Cut #13' },
      { id: 14, x: 66, y: 78, radius: 7, state: 'CUT', confidence: 0.96, label: 'Cut #14' },
      { id: 15, x: 82, y: 78, radius: 7, state: 'CUT', confidence: 0.97, label: 'Cut #15' },
    ],
  },
]

/**
 * Core Computer Vision Analyzer that segments loose tablets, blister cut fragments,
 * and intact blister strips from raw RGB/RGBA pixel buffers.
 * Works uniformly in Node.js (via sharp) and Browser (via HTML5 Canvas).
 */
export function analyzeRawPixelBuffer(
  rawBuffer: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  channels: number = 4,
  options?: {
    expectedCapacity?: number
    gridCols?: number
    gridRows?: number
    sensitivity?: number
    mode?: 'auto' | 'cut' | 'remaining'
  }
): StripAnalysisResult {
  const capacity = options?.expectedCapacity ?? 10
  const sensitivity = options?.sensitivity ?? 0.5
  const mode = options?.mode ?? 'auto'

  if (!rawBuffer || width <= 0 || height <= 0) {
    return {
      totalCapacity: capacity,
      cutCount: 0,
      filledCount: capacity,
      confidence: 0.9,
      gridRows: 2,
      gridCols: 5,
      suggestedPackSize: capacity,
      cavities: [],
      summary: 'No active video frame to analyze. Place blister strip under camera.',
      processedAt: new Date().toISOString(),
    }
  }

  // 1. Grayscale luminance calculation & statistics
  const gray = new Float32Array(width * height)
  let minLum = 255
  let maxLum = 0
  let sumLum = 0

  for (let i = 0; i < width * height; i++) {
    const idx = i * channels
    const r = rawBuffer[idx]
    const g = rawBuffer[idx + 1]
    const b = rawBuffer[idx + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    gray[i] = lum
    if (lum < minLum) minLum = lum
    if (lum > maxLum) maxLum = lum
    sumLum += lum
  }
  const avgLum = sumLum / (width * height)

  // Standard deviation
  let sumSq = 0
  for (let i = 0; i < width * height; i++) {
    const d = gray[i] - avgLum
    sumSq += d * d
  }
  const stdDev = Math.sqrt(sumSq / (width * height))

  // 2. Foreground segmentation
  // Blister foils and medicine tablets are brighter than the retail table/mat
  const fgThreshold = avgLum + stdDev * (0.35 - (sensitivity - 0.5) * 0.4)
  const mask = new Uint8Array(width * height)

  for (let i = 0; i < width * height; i++) {
    const idx = i * channels
    const r = rawBuffer[idx]
    const b = rawBuffer[idx + 2]
    const lum = gray[i]
    // White/silver foil or bright pill body vs darker table
    const isFoil = lum > fgThreshold || (lum > 135 && Math.abs(r - b) < 65)
    mask[i] = isFoil ? 1 : 0
  }

  // 3. Connected Component Labeling (Blob Detection)
  const labels = new Int32Array(width * height)
  let currentLabel = 0
  interface BlobInfo {
    minX: number
    maxX: number
    minY: number
    maxY: number
    width: number
    height: number
    centerX: number
    centerY: number
    area: number
    aspect: number
    isWide: boolean
  }
  const blobs: BlobInfo[] = []

  // Step down sampling for fast segmentation
  const step = Math.max(1, Math.floor(width / 320))
  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const idx = y * width + x
      if (mask[idx] === 1 && labels[idx] === 0) {
        currentLabel++
        const queue: number[] = [idx]
        labels[idx] = currentLabel
        let minX = x
        let maxX = x
        let minY = y
        let maxY = y
        let count = 0
        let sumX = 0
        let sumY = 0

        let head = 0
        while (head < queue.length) {
          const curr = queue[head++]
          count++
          const px = curr % width
          const py = Math.floor(curr / width)
          sumX += px
          sumY += py

          if (px < minX) minX = px
          if (px > maxX) maxX = px
          if (py < minY) minY = py
          if (py > maxY) maxY = py

          const neighbors = [
            curr - step,
            curr + step,
            curr - width * step,
            curr + width * step,
          ]
          for (const n of neighbors) {
            if (n >= 0 && n < width * height && mask[n] === 1 && labels[n] === 0) {
              labels[n] = currentLabel
              queue.push(n)
            }
          }
        }

        const bWidth = maxX - minX + 1
        const bHeight = maxY - minY + 1
        const minDim = Math.min(width, height)
        // Discard speckles and screen-spanning borders
        const minArea = (minDim * minDim * 0.003) / (step * step)
        const maxArea = (width * height * 0.85) / (step * step)

        if (count >= minArea && count <= maxArea && bWidth >= minDim * 0.04 && bHeight >= minDim * 0.04) {
          blobs.push({
            minX,
            maxX,
            minY,
            maxY,
            width: bWidth,
            height: bHeight,
            centerX: sumX / count,
            centerY: sumY / count,
            area: count,
            aspect: Math.max(bWidth, bHeight) / Math.max(1, Math.min(bWidth, bHeight)),
            isWide: bWidth >= bHeight,
          })
        }
      }
    }
  }

  // 4. Extract individual pill cavities from detected blister fragments
  const cavities: DetectedCavity[] = []
  let cavityId = 1

  // Sort blobs left-to-right, top-to-bottom for natural ordering
  blobs.sort((a, b) => a.minY - b.minY || a.minX - b.minX)

  for (const blob of blobs) {
    // Determine number of tablets contained within this fragment
    let tabletsInBlob = 1
    if (blob.aspect >= 1.45 && blob.aspect < 2.45) {
      tabletsInBlob = 2
    } else if (blob.aspect >= 2.45 && blob.aspect < 3.55) {
      tabletsInBlob = 3
    } else if (blob.aspect >= 3.55 && blob.aspect < 4.65) {
      tabletsInBlob = 4
    } else if (blob.aspect >= 4.65) {
      tabletsInBlob = Math.min(5, Math.round(blob.aspect))
    }

    const radius = Math.min(
      9.5,
      Math.max(6, Math.round((Math.min(blob.width, blob.height) / width) * 45))
    )

    if (tabletsInBlob === 1) {
      cavities.push({
        id: cavityId++,
        x: Math.round((blob.centerX / width) * 100),
        y: Math.round((blob.centerY / height) * 100),
        radius,
        state: 'CUT',
        confidence: 0.97,
        label: `Tablet #${cavityId - 1}`,
      })
    } else {
      const isHorizontal = blob.isWide
      for (let t = 0; t < tabletsInBlob; t++) {
        const fraction = (t + 0.5) / tabletsInBlob
        const cx = isHorizontal
          ? blob.minX + fraction * blob.width
          : blob.centerX
        const cy = isHorizontal
          ? blob.centerY
          : blob.minY + fraction * blob.height

        cavities.push({
          id: cavityId++,
          x: Math.round((cx / width) * 100),
          y: Math.round((cy / height) * 100),
          radius,
          state: 'CUT',
          confidence: 0.95,
          label: `Tablet #${cavityId - 1}`,
        })
      }
    }
  }

  const detectedCount = cavities.length
  let cutCount = 0
  let filledCount = 0

  if (detectedCount === 0) {
    cutCount = 0
    filledCount = capacity
  } else if (mode === 'cut' || (mode === 'auto' && detectedCount <= Math.floor(capacity / 2))) {
    // Loose cut pieces being sold
    cutCount = detectedCount
    filledCount = Math.max(0, capacity - cutCount)
    cavities.forEach((c, idx) => {
      c.state = 'CUT'
      c.label = `Cut #${idx + 1}`
    })
  } else {
    // Remaining strip being shown
    filledCount = Math.min(capacity, detectedCount)
    cutCount = Math.max(0, capacity - filledCount)
    cavities.forEach((c, idx) => {
      c.state = 'FILLED'
      c.label = `Pill #${idx + 1}`
    })
  }

  return {
    totalCapacity: capacity,
    cutCount,
    filledCount,
    confidence: detectedCount > 0 ? 0.96 : 0.8,
    gridRows: 2,
    gridCols: 5,
    suggestedPackSize: capacity,
    cavities,
    summary:
      detectedCount > 0
        ? `Vision AI detected ${detectedCount} tablet(s) on camera (${cutCount} to dispense, ${filledCount} remaining in pack).`
        : `No blister strip detected in view. Place tablets under camera or set count manually.`,
    processedAt: new Date().toISOString(),
  }
}

/**
 * Pro-rata pricing calculation for cut tablet strips and fractional dispensing.
 */
export interface ProRataPricing {
  stripMrp: number
  tabsPerStrip: number
  dispenseCount: number
  pricePerTab: number
  lineTotal: number
  gstRate: number
  taxableAmount: number
  taxAmount: number
}

export function calculateProRataPricing(
  stripMrp: number,
  tabsPerStrip: number,
  dispenseCount: number,
  gstRate: number = 12
): ProRataPricing {
  const safeTabsPerStrip = Math.max(1, tabsPerStrip || 10)
  const safeCount = Math.max(1, dispenseCount || 1)
  const pricePerTab = Math.round((stripMrp / safeTabsPerStrip) * 100) / 100
  const lineTotal = Math.round(safeCount * pricePerTab * 100) / 100
  const taxableAmount = Math.round((lineTotal / (1 + gstRate / 100)) * 100) / 100
  const taxAmount = Math.round((lineTotal - taxableAmount) * 100) / 100

  return {
    stripMrp,
    tabsPerStrip: safeTabsPerStrip,
    dispenseCount: safeCount,
    pricePerTab,
    lineTotal,
    gstRate,
    taxableAmount,
    taxAmount,
  }
}

/**
 * Computer vision analyzer that accepts browser ImageData or Canvas frames.
 */
export function analyzeStripImageFrame(
  imageData: ImageData | null,
  options?: {
    expectedCapacity?: number
    gridCols?: number
    gridRows?: number
    sensitivity?: number
    mode?: 'auto' | 'cut' | 'remaining'
  }
): StripAnalysisResult {
  const capacity = options?.expectedCapacity ?? 10

  if (!imageData || !imageData.data || imageData.width <= 0 || imageData.height <= 0) {
    return {
      totalCapacity: capacity,
      cutCount: 0,
      filledCount: capacity,
      confidence: 0.9,
      gridRows: 2,
      gridCols: 5,
      suggestedPackSize: capacity,
      cavities: [],
      summary: 'No camera frame provided. Ready for strip scan.',
      processedAt: new Date().toISOString(),
    }
  }

  return analyzeRawPixelBuffer(
    imageData.data,
    imageData.width,
    imageData.height,
    4,
    options
  )
}

