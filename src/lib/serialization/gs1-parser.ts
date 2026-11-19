/**
 * Metapharsic Rx — GS1 2D DataMatrix Barcode Parser & Serialization Engine
 * Compliant with:
 * - GS1 General Specifications Application Identifiers (AI)
 * - SFDA Tatmeen (Saudi Food and Drug Authority Track and Trace - رصد)
 * - NHRA Munsha'at (Bahrain National Health Regulatory Authority - منشآت)
 * - Oman MoH Pharmaceutical Traceability
 * - CDSCO / Indian Pharmaceutical Barcoding
 *
 * Supported Application Identifiers:
 * - (01) GTIN / Global Trade Item Number (14 digits fixed)
 * - (17) Expiration Date (YYMMDD 6 digits fixed)
 * - (10) Batch / Lot Number (1-20 alphanumeric characters, variable)
 * - (21) Serial Number (1-20 alphanumeric characters, variable)
 * - (7003) Expiration Date & Time (10 digits)
 * - (240) Additional Product Identification
 */

export interface Gs1ParsedData {
  isGs1: boolean
  rawString: string
  gtin?: string
  gtin13?: string // EAN-13 without leading zero if present
  expiryDate?: Date
  expiryDateString?: string // YYYY-MM-DD
  expiryRaw?: string // YYMMDD
  isExpired?: boolean
  daysUntilExpiry?: number
  batchNumber?: string
  serialNumber?: string
  additionalIdentifiers?: Record<string, string>
  format: 'PARENTHESES' | 'RAW_FNC1' | 'CONCATENATED' | 'PLAIN_BARCODE'
  checksumValid?: boolean
  tatmeenPayload?: {
    gtin: string
    sn: string
    bn: string
    xd: string
  }
  munshaatPayload?: {
    gtin: string
    serial: string
    lot: string
    expiry: string
  }
}

/**
 * Validates GTIN-14 check digit using GS1 Modulo 10 algorithm.
 * Weight factors alternating 3 and 1 from right to left.
 */
export function validateGtinCheckDigit(gtin: string): boolean {
  if (!/^\d{14}$/.test(gtin)) return false
  const digits = gtin.split('').map(Number)
  const checkDigit = digits[13]

  let sum = 0
  for (let i = 0; i < 13; i++) {
    // For 14-digit GTIN, position 0 has weight 3, pos 1 weight 1, etc.
    const weight = i % 2 === 0 ? 3 : 1
    sum += digits[i] * weight
  }

  const calculatedCheck = (10 - (sum % 10)) % 10
  return calculatedCheck === checkDigit
}

/**
 * Calculates GTIN-14 check digit for a 13-digit prefix.
 */
export function calculateGtinCheckDigit(prefix13: string): number {
  const digits = prefix13.padStart(13, '0').split('').map(Number)
  let sum = 0
  for (let i = 0; i < 13; i++) {
    const weight = i % 2 === 0 ? 3 : 1
    sum += digits[i] * weight
  }
  return (10 - (sum % 10)) % 10
}

/**
 * Parses a GS1 YYMMDD expiration date into a valid JavaScript Date.
 * YY >= 50 is interpreted as 19YY; YY < 50 as 20YY.
 * If DD is 00, it represents the last day of the month per GS1 standard.
 */
export function parseGs1Date(yymmdd: string): { date: Date; dateString: string } | null {
  if (!/^\d{6}$/.test(yymmdd)) return null

  const yy = parseInt(yymmdd.substring(0, 2), 10)
  const mm = parseInt(yymmdd.substring(2, 4), 10)
  let dd = parseInt(yymmdd.substring(4, 6), 10)

  const fullYear = yy < 50 ? 2000 + yy : 1900 + yy

  if (mm < 1 || mm > 12) return null

  // If day is 00, GS1 standard dictates expiry is the last day of that month
  if (dd === 0) {
    const lastDayOfMonth = new Date(Date.UTC(fullYear, mm, 0)).getUTCDate()
    dd = lastDayOfMonth
  }

  const date = new Date(Date.UTC(fullYear, mm - 1, dd, 23, 59, 59))
  const dateString = `${fullYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`

  return { date, dateString }
}

/**
 * Primary GS1 2D DataMatrix Parser
 * Automatically identifies and parses both human-readable "(01)...(17)..." and raw scanner FNC1 strings.
 */
export function parseGs1DataMatrix(input: string): Gs1ParsedData {
  const raw = input.trim()

  // 1. Check for human-readable format with parentheses: (01)...(17)...(10)...(21)...
  if (raw.includes('(01)') || (raw.startsWith('(') && raw.includes(')'))) {
    return parseParenthesesFormat(raw)
  }

  // 2. Check for FNC1 / GS delimited raw barcode string (containing \x1D or ASCII 29)
  // Also strip common 2D symbology identifiers: "]d2" (DataMatrix), "]Q3" (QR Code)
  let cleaned = raw
  if (cleaned.startsWith(']d2') || cleaned.startsWith(']Q3') || cleaned.startsWith(']C1')) {
    cleaned = cleaned.substring(3)
  }

  if (cleaned.includes('\x1D') || cleaned.includes('\u001d') || cleaned.startsWith('01')) {
    return parseRawGs1String(cleaned, raw)
  }

  // Fallback: not a recognized GS1 2D barcode, treat as standard 1D barcode or SKU
  return {
    isGs1: false,
    rawString: raw,
    format: 'PLAIN_BARCODE',
  }
}

/**
 * Parses Human-Readable Parentheses format:
 * e.g. "(01)06285000000018(17)261231(10)LOT789A(21)SN12345678"
 */
function parseParenthesesFormat(raw: string): Gs1ParsedData {
  const aiRegex = /\((\d{2,4})\)([^(]+)/g
  let match: RegExpExecArray | null

  let gtin: string | undefined
  let expiryRaw: string | undefined
  let batchNumber: string | undefined
  let serialNumber: string | undefined
  const additionalIdentifiers: Record<string, string> = {}

  while ((match = aiRegex.exec(raw)) !== null) {
    const ai = match[1]
    const val = match[2].trim()

    switch (ai) {
      case '01':
        gtin = val
        break
      case '17':
        expiryRaw = val
        break
      case '10':
        batchNumber = val
        break
      case '21':
        serialNumber = val
        break
      default:
        additionalIdentifiers[ai] = val
        break
    }
  }

  return assembleGs1Result(raw, 'PARENTHESES', gtin, expiryRaw, batchNumber, serialNumber, additionalIdentifiers)
}

/**
 * Parses Raw GS1 Barcode String with or without ASCII 29 <GS> delimiters:
 * AI 01 is 14 chars fixed
 * AI 17 is 6 chars fixed
 * AI 10 is variable (up to 20 chars), terminated by <GS> or end
 * AI 21 is variable (up to 20 chars), terminated by <GS> or end
 */
function parseRawGs1String(str: string, originalRaw: string): Gs1ParsedData {
  let gtin: string | undefined
  let expiryRaw: string | undefined
  let batchNumber: string | undefined
  let serialNumber: string | undefined
  const additionalIdentifiers: Record<string, string> = {}

  const GS = '\x1D'
  let index = 0
  const len = str.length

  while (index < len) {
    // Skip any stray GS character
    if (str[index] === GS || str[index] === '\u001d') {
      index++
      continue
    }

    const ai2 = str.substring(index, index + 2)

    if (ai2 === '01') {
      // AI 01: GTIN-14 (fixed 14 chars)
      index += 2
      gtin = str.substring(index, index + 14)
      index += 14
    } else if (ai2 === '17') {
      // AI 17: Expiry YYMMDD (fixed 6 chars)
      index += 2
      expiryRaw = str.substring(index, index + 6)
      index += 6
    } else if (ai2 === '10') {
      // AI 10: Batch Number (variable up to 20 chars)
      index += 2
      let nextGs = str.indexOf(GS, index)
      if (nextGs === -1) nextGs = str.indexOf('\u001d', index)

      if (nextGs !== -1) {
        batchNumber = str.substring(index, nextGs)
        index = nextGs + 1
      } else {
        // Look ahead for another AI like "21" if not delimited by GS
        const next21 = str.indexOf('21', index)
        if (next21 !== -1 && !serialNumber && next21 - index <= 20) {
          batchNumber = str.substring(index, next21)
          index = next21
        } else {
          batchNumber = str.substring(index)
          index = len
        }
      }
    } else if (ai2 === '21') {
      // AI 21: Serial Number (variable up to 20 chars)
      index += 2
      let nextGs = str.indexOf(GS, index)
      if (nextGs === -1) nextGs = str.indexOf('\u001d', index)

      if (nextGs !== -1) {
        serialNumber = str.substring(index, nextGs)
        index = nextGs + 1
      } else {
        serialNumber = str.substring(index)
        index = len
      }
    } else {
      // Unknown AI or end of recognized stream
      index++
    }
  }

  const isGs1 = Boolean(gtin || expiryRaw || batchNumber || serialNumber)
  if (!isGs1) {
    return {
      isGs1: false,
      rawString: originalRaw,
      format: 'PLAIN_BARCODE',
    }
  }

  return assembleGs1Result(originalRaw, 'RAW_FNC1', gtin, expiryRaw, batchNumber, serialNumber, additionalIdentifiers)
}

function assembleGs1Result(
  raw: string,
  format: 'PARENTHESES' | 'RAW_FNC1' | 'CONCATENATED',
  gtin?: string,
  expiryRaw?: string,
  batchNumber?: string,
  serialNumber?: string,
  additionalIdentifiers: Record<string, string> = {}
): Gs1ParsedData {
  let expiryDate: Date | undefined
  let expiryDateString: string | undefined
  let isExpired = false
  let daysUntilExpiry: number | undefined

  if (expiryRaw) {
    const parsedDate = parseGs1Date(expiryRaw)
    if (parsedDate) {
      expiryDate = parsedDate.date
      expiryDateString = parsedDate.dateString

      const now = new Date()
      const diffMs = expiryDate.getTime() - now.getTime()
      daysUntilExpiry = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      isExpired = daysUntilExpiry < 0
    }
  }

  // GTIN-13 representation (strip leading zero if 14 digits)
  let gtin13: string | undefined
  if (gtin && gtin.length === 14 && gtin.startsWith('0')) {
    gtin13 = gtin.substring(1)
  }

  const checksumValid = gtin ? validateGtinCheckDigit(gtin) : undefined

  // Build SFDA Tatmeen Dispatch Payload
  let tatmeenPayload: Gs1ParsedData['tatmeenPayload']
  if (gtin && serialNumber && batchNumber && expiryDateString) {
    tatmeenPayload = {
      gtin,
      sn: serialNumber,
      bn: batchNumber,
      xd: expiryDateString,
    }
  }

  // Build NHRA Munsha'at Dispatch Payload
  let munshaatPayload: Gs1ParsedData['munshaatPayload']
  if (gtin && serialNumber && batchNumber && expiryDateString) {
    munshaatPayload = {
      gtin,
      serial: serialNumber,
      lot: batchNumber,
      expiry: expiryDateString,
    }
  }

  return {
    isGs1: true,
    rawString: raw,
    gtin,
    gtin13,
    expiryDate,
    expiryDateString,
    expiryRaw,
    isExpired,
    daysUntilExpiry,
    batchNumber,
    serialNumber,
    additionalIdentifiers,
    format,
    checksumValid,
    tatmeenPayload,
    munshaatPayload,
  }
}

/**
 * Encodes pharmaceutical pack attributes into standard GS1 human-readable string.
 * Example: encodeGs1String({ gtin: '06285000000018', expiryDate: '2026-12-31', batch: 'LOT789A', serial: 'SN12345' })
 */
export function encodeGs1String({
  gtin,
  expiryDate,
  batch,
  serial,
}: {
  gtin: string
  expiryDate: string | Date
  batch: string
  serial?: string
}): { humanReadable: string; rawFnc1: string } {
  const gtinPadded = gtin.padStart(14, '0')

  let yymmdd = '261231'
  if (expiryDate instanceof Date) {
    const yy = String(expiryDate.getUTCFullYear()).slice(-2)
    const mm = String(expiryDate.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(expiryDate.getUTCDate()).padStart(2, '0')
    yymmdd = `${yy}${mm}${dd}`
  } else if (typeof expiryDate === 'string') {
    const parts = expiryDate.split('-')
    if (parts.length === 3) {
      yymmdd = `${parts[0].slice(-2)}${parts[1].padStart(2, '0')}${parts[2].padStart(2, '0')}`
    } else if (expiryDate.length === 6) {
      yymmdd = expiryDate
    }
  }

  const snPart = serial ? `(21)${serial}` : ''
  const humanReadable = `(01)${gtinPadded}(17)${yymmdd}(10)${batch}${snPart}`

  const GS = '\x1D'
  const rawFnc1 = `01${gtinPadded}17${yymmdd}10${batch}${serial ? `${GS}21${serial}` : ''}`

  return { humanReadable, rawFnc1 }
}
