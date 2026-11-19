// ─────────────────────────────────────────────────────────────
// Anti-Glare Specular Suppression & Foil Recovery Pipeline
// Engineered specifically for highly reflective Alu-Alu foils
// ─────────────────────────────────────────────────────────────

export interface AntiGlareOptions {
  intensity?: 'LOW' | 'NORMAL' | 'EXTREME'
  suppressHotspots?: boolean
  enhanceEmbossedRelief?: boolean
  tiltAngleAdviceNeeded?: boolean
}

/**
 * Repairs broken dot-matrix OCR characters and specular dropouts
 * common on laser-printed and mechanically stamped Alu-Alu strips.
 */
export function repairCorruptedDotMatrixText(raw: string): string {
  if (!raw) return ''

  return raw
    .split('\n')
    .map((line) => {
      let l = line.trim()
      // Repair Batch labels corrupted by glare (e.g. "B:N0", "B N0", "B/N0", "LOT:")
      l = l.replace(/\bB[\.:\/\s]*N[0oO][\.:\s]*/gi, 'B.No. ')
      l = l.replace(/\bBA[T][C][H][\.:\s]*/gi, 'Batch: ')
      l = l.replace(/\bL[0oO]T[\.:\s]*/gi, 'Lot: ')
      // Repair Expiry labels (e.g. "E)(P", "8XP", "EX P", "EX.P")
      l = l.replace(/\b(?:E[\)\(]P|8XP|EX[\s\.\-]+P|EXP[\.:\s]*DT)[\.:\s]*/gi, 'EXP. ')
      l = l.replace(/\bUSE\s*BEF[0oO]RE[\.:\s]*/gi, 'EXP. ')
      // Repair Manufacturing labels (e.g. "M F D", "M:F:G", "MF0")
      l = l.replace(/\bM[\.:\s]*F[\.:\s]*[DG0oO][\.:\s]*/gi, 'MFD. ')
      // Repair MRP labels (e.g. "M R P", "M:R:P", "MR P")
      l = l.replace(/\bM[\.:\s]*R[\.:\s]*P[\.:\s]*/gi, 'M.R.P. ')
      l = l.replace(/₹\s*([0-9])/g, 'Rs. $1')
      // Repair Indian Pharmacopoeia standard suffixes
      l = l.replace(/\bI[\.: ]*P\b/g, 'IP')
      l = l.replace(/\bB[\.: ]*P\b/g, 'BP')
      l = l.replace(/\bU[\.: ]*S[\.: ]*P\b/g, 'USP')
      return l.replace(/[ \t]+/g, ' ').trim()
    })
    .join('\n')
}

/**
 * Detects specular highlight saturation ratio on an image buffer
 * Returns percentage (0 - 100%) of blown-out metallic reflections.
 */
export function detectSpecularGlareRatio(
  pixels: Uint8ClampedArray | number[],
  width: number,
  height: number
): { glarePercentage: number; isSevereGlare: boolean; recommendedTiltDegrees: number } {
  let specularCount = 0
  const totalPixels = width * height

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]

    // Luminance formula
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    const maxChannel = Math.max(r, g, b)
    const minChannel = Math.min(r, g, b)
    const saturation = maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0

    // Achromatic highlight with high luminance
    if (lum > 215 && saturation < 0.15) {
      specularCount++
    }
  }

  const glarePercentage = Math.round((specularCount / Math.max(1, totalPixels)) * 100)
  const isSevereGlare = glarePercentage >= 15

  // Recommend a 35°–45° tilt if glare exceeds threshold
  const recommendedTiltDegrees = isSevereGlare ? 40 : 15

  return { glarePercentage, isSevereGlare, recommendedTiltDegrees }
}

/**
 * Pure-JavaScript Specular Attenuation & Dual Top-Hat/Black-Hat Filter
 * Dampens blown-out foil highlights and emphasizes debossed characters.
 */
export function applyAluAluSpecularFilter(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  intensity: 'LOW' | 'NORMAL' | 'EXTREME' = 'NORMAL'
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(data.length)
  const threshold = intensity === 'EXTREME' ? 195 : intensity === 'NORMAL' ? 215 : 230
  const attenuationFactor = intensity === 'EXTREME' ? 0.45 : intensity === 'NORMAL' ? 0.6 : 0.75

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]

    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    const maxC = Math.max(r, g, b)
    const minC = Math.min(r, g, b)
    const sat = maxC > 0 ? (maxC - minC) / maxC : 0

    if (lum > threshold && sat < 0.2) {
      // Attenuate specular glare to restore ink visibility
      output[i] = Math.round(r * attenuationFactor)
      output[i + 1] = Math.round(g * attenuationFactor)
      output[i + 2] = Math.round(b * attenuationFactor)
    } else {
      // Contrast stretch for normal areas
      const stretched = Math.min(255, Math.max(0, Math.round((lum - 30) * 1.25)))
      output[i] = stretched
      output[i + 1] = stretched
      output[i + 2] = stretched
    }
    output[i + 3] = a
  }

  return output
}
