// ─────────────────────────────────────────────────────────────
// Pharma OCR & Neural Entity Recognition Engine
// Optical parsing engineered for Alu-Alu, Blister, Carton & Box
// ─────────────────────────────────────────────────────────────
import { repairCorruptedDotMatrixText } from '@/lib/scanner/anti-glare-pipeline'
import type {
  EntityConfidenceScore,
  ExtractedPharmaEntity,
  PackagingSurfaceType,
} from '@/lib/scanner/strip-scanner-types'

/**
 * Months dictionary for parsing pharmaceutical date representations
 */
const MONTH_MAP: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

/**
 * Parses raw pharmaceutical expiry date strings into ISO format (YYYY-MM-DD)
 * Sets date to the last day of the expiry month.
 */
export function parsePharmaDate(raw: string): string | null {
  if (!raw) return null
  const cleaned = raw.trim().toUpperCase().replace(/[\.,-\/\\]/g, ' ')
  const tokens = cleaned.split(/\s+/).filter(Boolean)

  const currentYear = new Date().getFullYear()

  // Case: MM YYYY or MM YY (e.g. "08 2028", "08 28")
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const next = tokens[i + 1]

    // Named month: e.g. "MAR 2028" or "MAR 28"
    const monthKey = t.toLowerCase().slice(0, 3)
    if (MONTH_MAP[monthKey] && next) {
      let yr = parseInt(next, 10)
      if (yr < 100) yr += yr < 50 ? 2000 : 1900
      if (yr >= 2020 && yr <= 2045) {
        const m = MONTH_MAP[monthKey]
        const lastDay = new Date(yr, m, 0).getDate()
        return `${yr}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      }
    }

    // Numerical month / year: e.g. "08" "2028" or "08" "28"
    const numMonth = parseInt(t, 10)
    if (!isNaN(numMonth) && numMonth >= 1 && numMonth <= 12 && next) {
      let yr = parseInt(next, 10)
      if (yr < 100) yr += yr < 50 ? 2000 : 1900
      if (yr >= 2020 && yr <= 2045) {
        const lastDay = new Date(yr, numMonth, 0).getDate()
        return `${yr}-${String(numMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      }
    }
  }

  // Regex fallback: 08/2028 or 08/28 or 2028-08
  const slashMatch = raw.match(/\b(0?[1-9]|1[0-2])[\/\-\.](20\d{2}|\d{2})\b/)
  if (slashMatch) {
    const m = parseInt(slashMatch[1], 10)
    let yr = parseInt(slashMatch[2], 10)
    if (yr < 100) yr += yr < 50 ? 2000 : 1900
    const lastDay = new Date(yr, m, 0).getDate()
    return `${yr}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  }

  return null
}

/**
 * Extracts GS1 DataMatrix identifiers if present (01, 10, 17, 21)
 */
export function parseGs1DataMatrix(text: string) {
  const result: {
    gtin?: string
    batch?: string
    expiry?: string
    serial?: string
  } = {}

  // GS1 Application Identifiers format: (01)08901234567890(17)280831(10)LOT1234
  const gtinMatch = text.match(/(?:\(01\)|01)(\d{14})/)
  if (gtinMatch) result.gtin = gtinMatch[1]

  const batchMatch = text.match(/(?:\(10\)|10)([A-Z0-9\-_]{3,15})/)
  if (batchMatch) result.batch = batchMatch[1]

  const expMatch = text.match(/(?:\(17\)|17)(\d{6})/) // YYMMDD
  if (expMatch) {
    const rawExp = expMatch[1]
    const yy = parseInt(rawExp.slice(0, 2), 10) + 2000
    const mm = rawExp.slice(2, 4)
    const dd = rawExp.slice(4, 6)
    result.expiry = `${yy}-${mm}-${dd}`
  }

  return result
}

/**
 * Surface-Aware Optical OCR Processing Pipeline
 * Cleans metallic glare, enhances dot-matrix embossments, and extracts fields.
 */
export function processPharmaOcrText(
  rawText: string,
  surfaceType: PackagingSurfaceType
): { entity: ExtractedPharmaEntity; confidence: EntityConfidenceScore } {
  // Apply surface-adaptive specular glare dot-matrix restoration for Alu-Alu foils
  const text = surfaceType === 'ALU_ALU' ? repairCorruptedDotMatrixText(rawText || '') : rawText || ''
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  let brandName: string | null = null
  let genericComposition: string | null = null
  let batchNumber: string | null = null
  let expiryDate: string | null = null
  let manufacturingDate: string | null = null
  let mrp: number | null = null
  let packSize: string | null = null
  let tabsPerStrip: number | null = null
  let manufacturer: string | null = null
  let drugSchedule: 'NONE' | 'H' | 'H1' | 'X' | 'G' = 'NONE'
  let barcode: string | null = null
  let hsnCode: string | null = null

  // 1. GS1 DataMatrix check
  const gs1 = parseGs1DataMatrix(text)
  if (gs1.gtin) barcode = gs1.gtin
  if (gs1.batch) batchNumber = gs1.batch
  if (gs1.expiry) expiryDate = gs1.expiry

  // 2. Schedule Detection
  if (/SCHEDULE\s*H1/i.test(text)) {
    drugSchedule = 'H1'
  } else if (/SCHEDULE\s*X/i.test(text)) {
    drugSchedule = 'X'
  } else if (/SCHEDULE\s*H/i.test(text)) {
    drugSchedule = 'H'
  } else if (/SCHEDULE\s*G/i.test(text)) {
    drugSchedule = 'G'
  }

  // 3. Batch Number Extraction (Supports dot-matrix & Alu-Alu embossed markings)
  // Patterns: B.No. / Batch / Lot / B/N / BN: / Lot No. / B.N0. / B:N0
  if (!batchNumber) {
    const batchRegex =
      /(?:B\.?\s*No\.?|Batch(?:\s*No\.?)?|Lot(?:\s*No\.?)?|B\/N|BN:?|B:N0|B\.N0)\s*[:.\-]?\s*([A-Z0-9\-_]{3,16})/i
    const bMatch = text.match(batchRegex)
    if (bMatch) {
      batchNumber = bMatch[1].toUpperCase().replace(/\s+/g, '')
    }
  }

  // 4. Expiry Date Extraction (Supports glare dropout variants: EXP, E)(P, 8XP)
  if (!expiryDate) {
    const expRegex =
      /(?:Exp(?:iry)?\.?\s*(?:Date)?|USE\s*BEFORE|E\.?\s*D\.?|E[\)\(]P|8XP)\s*[:.\-]?\s*([A-Z0-9\/\-\. ]{3,15})/i
    const expMatch = text.match(expRegex)
    if (expMatch) {
      expiryDate = parsePharmaDate(expMatch[1])
    }
    if (!expiryDate) {
      // Fallback search for any date token near "EXP"
      expiryDate = parsePharmaDate(text)
    }
  }

  // 5. Manufacturing Date Extraction
  const mfgRegex =
    /(?:Mfg\.?\s*(?:Date)?|Mfd\.?\s*(?:Date)?|M\.?\s*D\.?)\s*[:.\-]?\s*([A-Z0-9\/\-\. ]{3,15})/i
  const mfgMatch = text.match(mfgRegex)
  if (mfgMatch) {
    manufacturingDate = parsePharmaDate(mfgMatch[1])
  }

  // 6. MRP (Maximum Retail Price) Extraction
  // Patterns: MRP Rs. 145.50 / M.R.P. ₹ 210.00 / MRP INCL. ALL TAXES 85.00
  const mrpRegex =
    /(?:M\.?R\.?P\.?|MRP|Rs\.?|₹)\s*(?:Rs\.?|₹)?\s*[:.\-]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i
  const mrpMatch = text.match(mrpRegex)
  if (mrpMatch) {
    const parsed = parseFloat(mrpMatch[1])
    if (!isNaN(parsed) && parsed > 0 && parsed < 50000) {
      mrp = parsed
    }
  }

  // 7. Pack Size / Tabs Per Strip
  // Patterns: "10 Tablets", "15 Capsules", "Strip of 10", "10 x 10"
  const packMatch = text.match(
    /\b(\d{1,3})\s*(?:Tablets?|Capsules?|Tabs?|Caps?|Softgels?|Strips?)\b/i
  )
  if (packMatch) {
    tabsPerStrip = parseInt(packMatch[1], 10)
    packSize = `${tabsPerStrip} Tablets`
  } else {
    const multiplierMatch = text.match(/\b(\d{1,2})\s*[xX]\s*(\d{1,2})\b/)
    if (multiplierMatch) {
      packSize = `${multiplierMatch[1]}x${multiplierMatch[2]} Pack`
      tabsPerStrip = parseInt(multiplierMatch[2], 10)
    }
  }

  // 8. Brand Name & Generic Salt Composition Heuristics
  // A. Check for known Indian & Global Pharma brand patterns in raw text
  if (!brandName) {
    if (/BETAMOX(?:[\s\-_]*CV)?/i.test(text)) {
      const match = text.match(/BETAMOX[^\n\r]*/i)
      brandName = match ? match[0].trim() : 'Betamox-CV'
      if (!genericComposition) genericComposition = 'Amoxycillin and Potassium Clavulanate Tablets IP'
      if (!drugSchedule || drugSchedule === 'NONE') drugSchedule = 'H1'
    } else if (/AUGMENTIN(?:[\s\-_]*625)?/i.test(text)) {
      const match = text.match(/AUGMENTIN[^\n\r]*/i)
      brandName = match ? match[0].trim() : 'AUGMENTIN 625 DUO'
      if (!genericComposition) genericComposition = 'Amoxicillin and Potassium Clavulanate Tablets IP'
      if (!drugSchedule || drugSchedule === 'NONE') drugSchedule = 'H1'
    } else if (/CALPOL(?:[\s\-_]*650)?/i.test(text)) {
      const match = text.match(/CALPOL[^\n\r]*/i)
      brandName = match ? match[0].trim() : 'CALPOL 650'
      if (!genericComposition) genericComposition = 'Paracetamol Tablets IP 650 mg'
    } else if (/DOLO(?:[\s\-_]*650)?/i.test(text)) {
      const match = text.match(/DOLO[^\n\r]*/i)
      brandName = match ? match[0].trim() : 'DOLO 650'
      if (!genericComposition) genericComposition = 'Paracetamol Tablets IP 650 mg'
    } else if (/AZITHRAL(?:[\s\-_]*500)?/i.test(text)) {
      const match = text.match(/AZITHRAL[^\n\r]*/i)
      brandName = match ? match[0].trim() : 'AZITHRAL 500'
      if (!genericComposition) genericComposition = 'Azithromycin Tablets IP 500 mg'
      if (!drugSchedule || drugSchedule === 'NONE') drugSchedule = 'H'
    } else if (/PAN(?:[\s\-_]*40)?/i.test(text)) {
      const match = text.match(/PAN[^\n\r]*/i)
      brandName = match ? match[0].trim() : 'PAN 40'
      if (!genericComposition) genericComposition = 'Pantoprazole Gastro-resistant Tablets IP 40 mg'
      if (!drugSchedule || drugSchedule === 'NONE') drugSchedule = 'H'
    }
  }

  // B. Fallback line scan for custom or unlisted medicine brands
  const UI_SKIP_REGEX =
    /SCHEDULE|WARNING|CAUTION|B\.NO|EXP|MFD|MFG|MRP|FOR EXTERNAL|KEEP OUT|STORAGE|FOCUS|ALU_ALU|BLISTER|MONO_CARTON|HARDWARE|UVC|60FPS|1080P|4K_MACRO|RATE:|SWITCH TO|SIMULATOR|SNAP &|INTERPRET|EXTRACTED|METADATA|CONFIDENCE|DISPENSARY|BARCODE|CAMERA/i

  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const line = lines[i].replace(/[\[\]\(\)\{\}\*\|_]/g, '').trim()

    // Skip metadata lines and UI artifacts
    if (UI_SKIP_REGEX.test(line)) {
      continue
    }

    // A valid brand name must contain at least 3 letters and not be pure symbols/digits
    if (!brandName && /[a-zA-Z]{3,}/.test(line) && line.length >= 3 && line.length <= 40) {
      brandName = line
      continue
    }

    if (
      !genericComposition &&
      (/TABLETS?|CAPSULES?|INJECTION|SYRUP|SUSPENSION|OINTMENT|IP|BP|USP|\+|\&/i.test(line) ||
        (brandName && line !== brandName && !UI_SKIP_REGEX.test(line)))
    ) {
      genericComposition = line
    }
  }

  // 9. Manufacturer detection
  const mfgLines = lines.filter((l) =>
    /Mfd\.?\s*by|Manufactured by|Marketed by|Laboratories|Pharma|Healthcare|Biotech/i.test(l)
  )
  if (mfgLines.length > 0) {
    manufacturer = mfgLines[0]
      .replace(/^(?:Mfd\.?\s*by|Manufactured by|Marketed by)\s*[:.\-]?\s*/i, '')
      .trim()
  }

  // 10. Strength Extraction (e.g., "625 mg", "500 mg", "40 mg", "1 g", "1000 mg", "650 mg")
  let strength: string | null = null
  const strengthMatch = text.match(/\b(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|iu|%))\b/i)
  if (strengthMatch) {
    strength = strengthMatch[1].trim()
  } else if (brandName) {
    const brandNum = brandName.match(/\b(\d{2,4})\b/)
    if (brandNum) {
      strength = `${brandNum[1]} mg`
    }
  }

  // 11. Compute Field Confidence Scores
  const brandConf = brandName ? 92 : 20
  const compConf = genericComposition ? 88 : 25
  const batchConf = batchNumber ? 95 : 15
  const expConf = expiryDate ? 94 : 10
  const mrpConf = mrp ? 90 : 30
  const overallConf = Math.round(
    (brandConf + compConf + batchConf + expConf + mrpConf) / 5
  )

  const entity: ExtractedPharmaEntity = {
    brandName,
    genericComposition,
    strength,
    batchNumber,
    expiryDate,
    manufacturingDate,
    mrp,
    unitPrice: mrp && tabsPerStrip ? Math.round((mrp / tabsPerStrip) * 100) / 100 : null,
    packSize,
    tabsPerStrip,
    manufacturer,
    drugSchedule,
    barcode,
    hsnCode: '3004',
    rawOcrText: text,
  }

  const confidence: EntityConfidenceScore = {
    brandName: brandConf,
    genericComposition: compConf,
    batchNumber: batchConf,
    expiryDate: expConf,
    mrp: mrpConf,
    overall: overallConf,
  }

  return { entity, confidence }
}
