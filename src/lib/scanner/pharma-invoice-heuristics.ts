/**
 * Indian Pharmaceutical Wholesale Invoice Domain Heuristics & Tabular Parser
 *
 * Implements statutory regex matching, pharmaceutical expiry date normalization,
 * multi-column tabular layout parsing, and mathematical cross-reconciliation.
 * Designed for invoices under the Drugs and Cosmetics Act (1940) and GST Acts (2017).
 */

export interface ExtractedSupplier {
  rawName: string
  matchedSupplierId?: string
  gstin?: string
  dlNumber?: string
  matchConfidence: number // 0.0 - 1.0
  isNew: boolean
}

export interface ExtractedLineItem {
  id: string
  rawDescription: string
  matchedProductId?: string
  matchedProductName?: string
  productName?: string
  matchConfidence: number
  isNewProduct: boolean
  packSize?: string
  tabsPerStrip?: number
  stripSellingPrice?: number
  tabletCost?: number
  tabletSellingPrice?: number
  ptr?: number
  hsnCode?: string
  batchNumber: string
  expiryDate: string // ISO YYYY-MM-DD (normalized to month-end)
  billedQuantity: number
  freeQuantity: number
  unitCost: number // PTR
  mrp: number
  discountPercent: number
  taxPercent: number
  taxAmount: number
  totalAmount: number
}

export interface ExtractedFinancials {
  subtotal: number
  taxAmount: number
  discountAmount: number
  roundOff: number
  totalAmount: number
  isReconciled: boolean
  reconciliationVariance: number
}

export interface ParsedInvoiceData {
  supplier: ExtractedSupplier
  invoice: {
    invoiceNumber: string
    invoiceDate: string // YYYY-MM-DD
    dueDate?: string // YYYY-MM-DD
  }
  items: ExtractedLineItem[]
  financials: ExtractedFinancials
  overallConfidence: number
}

// ─────────────────────────────────────────────────────────────
// Statutory Domain Regex Patterns
// ─────────────────────────────────────────────────────────────

/**
 * 15-character statutory GSTIN regex (Standard Indian Goods & Services Tax Identification Number)
 * Format: 2 digits (State) + 5 letters (PAN Entity) + 4 digits + 1 letter + 1 char + 'Z' + 1 check char
 */
export const GSTIN_REGEX = /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/i

/**
 * Drug License Form 20B / Form 21B wholesale license regex
 * Matches forms like: "20B/KA-B21/48911", "DL NO: 20B/MH-TZ2/10293", "Lic. No. 20B & 21B: 12345/6789"
 */
export const DRUG_LICENSE_REGEX = /(?:DL|D\.?\s*L\.?|D\/L|L\.No|Lic\.?\s*No\.?|Form\s*2[01]B?)(?:\s*NO\.?)?[\s\:\.\-]+([A-Za-z0-9\/\-\,\s]{5,45})/i
export const DL_20B_21B_REGEX = /\b(?:20B|21B)[\s\/\:\-]*([A-Za-z0-9\/\-_]+)/gi

/**
 * Invoice / Bill Number patterns
 */
export const INVOICE_NUMBER_REGEX = /(?:INV|INVOICE|BILL|MEMO|CASH\s*MEMO|TAX\s*INVOICE)[\s\.\:\#\-\/No]+([A-Za-z0-9\/\-_]{3,30})/i

/**
 * Invoice & Due Date patterns
 */
export const INVOICE_DATE_REGEX = /(?:DATE|DT|INVOICE\s*DATE|BILL\s*DATE|BILL\s*DT)[\s\:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2})/i
export const DUE_DATE_REGEX = /(?:DUE\s*DATE|DUE\s*DT|PAYMENT\s*DUE)[\s\:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2})/i

/**
 * Packaging size pattern (e.g. 10'S, 15'S, 10X10, 100ML, 10 TAB)
 */
export const PACK_SIZE_REGEX = /\b(\d+\s*['xX\*]\s*\d+|\d+\s*[']?[sS]|\d+\s*ML|\d+\s*GM|\d+\s*MG|\d+\s*VIAL|\d+\s*AMP|\d+\s*TAB|\d+\s*CAP)\b/i

/**
 * Month mappings for pharma expiry resolution
 */
const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
}

// ─────────────────────────────────────────────────────────────
// Expiry Date Normalizer
// ─────────────────────────────────────────────────────────────

/**
 * Normalizes pharmaceutical expiry date string to ISO format (YYYY-MM-DD).
 * Standard Indian pharmaceutical practice: products expire on the LAST calendar day
 * of the printed expiry month.
 *
 * Supports:
 * - "08/28", "08/2028", "08-28", "08-2028"
 * - "NOV-27", "NOV/2027", "MAR 2028", "AUG 28"
 * - "15/04/2028" (full dates)
 * - Leap year resolution (e.g. 02/2028 -> 2028-02-29, 02/2026 -> 2026-02-28)
 */
export function parsePharmaDate(raw: string | undefined | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim().toUpperCase()

  // Case 1: Full ISO date (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  // Case 2: Full Date DD/MM/YYYY or DD-MM-YYYY
  const fullDateMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
  if (fullDateMatch) {
    const day = parseInt(fullDateMatch[1], 10)
    const month = parseInt(fullDateMatch[2], 10)
    let year = parseInt(fullDateMatch[3], 10)
    if (year < 100) year += year < 50 ? 2000 : 1900

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  // Case 3: Named month with year, e.g. "NOV-27", "NOV/2027", "MAR 2028", "AUG 28"
  const namedMatch = trimmed.match(/\b([A-Z]{3,9})[\s\/\-\.]+(\d{2,4})\b/i)
  if (namedMatch) {
    const monthStr = namedMatch[1].toLowerCase().slice(0, 3)
    let year = parseInt(namedMatch[2], 10)
    if (year < 100) year += year < 50 ? 2000 : 1900

    const monthNum = MONTH_MAP[monthStr]
    if (monthNum && year >= 2020 && year <= 2045) {
      // Month-end calculation: day 0 of month + 1 is the last day of month
      const lastDay = new Date(year, monthNum, 0).getDate()
      return `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    }
  }

  // Case 4: Numerical month/year, e.g. "08/28", "08/2028", "11-27", "03-2028"
  const numMatch = trimmed.match(/\b(0?[1-9]|1[0-2])[\/\-\.](20\d{2}|\d{2})\b/)
  if (numMatch) {
    const monthNum = parseInt(numMatch[1], 10)
    let year = parseInt(numMatch[2], 10)
    if (year < 100) year += year < 50 ? 2000 : 1900

    if (year >= 2020 && year <= 2045) {
      const lastDay = new Date(year, monthNum, 0).getDate()
      return `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    }
  }

  // Case 5: Inverted numerical year/month, e.g. "2028/08", "2028-08"
  const invMatch = trimmed.match(/\b(20\d{2})[\/\-\.](0?[1-9]|1[0-2])\b/)
  if (invMatch) {
    const year = parseInt(invMatch[1], 10)
    const monthNum = parseInt(invMatch[2], 10)
    const lastDay = new Date(year, monthNum, 0).getDate()
    return `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  }

  return null
}

/**
 * Normalizes general invoice dates (e.g. DD/MM/YYYY) to ISO YYYY-MM-DD
 */
export function normalizeInvoiceDate(raw: string | undefined | null): string {
  if (!raw) return new Date().toISOString().slice(0, 10)
  const trimmed = raw.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
  if (ddmmyyyy) {
    const d = parseInt(ddmmyyyy[1], 10)
    const m = parseInt(ddmmyyyy[2], 10)
    let y = parseInt(ddmmyyyy[3], 10)
    if (y < 100) y += y < 50 ? 2000 : 1900
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  const parsed = new Date(trimmed)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return new Date().toISOString().slice(0, 10)
}

// ─────────────────────────────────────────────────────────────
// Tabular Line Items Extraction
// ─────────────────────────────────────────────────────────────

/**
 * Cleans numerical strings, removing commas, currency signs, etc.
 */
function parseNum(str: string | undefined | null, defaultValue = 0): number {
  if (!str) return defaultValue
  const cleaned = str.replace(/[^\d\.\-]/g, '')
  const val = parseFloat(cleaned)
  return isNaN(val) ? defaultValue : val
}

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100
}

/**
 * Extracts line items from OCR/stream lines of an Indian wholesale pharma bill.
 */
export function parseInvoiceLineItems(lines: string[]): ExtractedLineItem[] {
  const items: ExtractedLineItem[] = []

  // Step 1: Locate header row (table header containing columns)
  let tableStartIndex = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase()
    const hasProductCol = line.includes('ITEM') || line.includes('PRODUCT') || line.includes('DESCRIPTION') || line.includes('PARTICULARS')
    const hasBatchCol = line.includes('BATCH') || line.includes('B.NO') || line.includes('LOT')
    const hasQtyCol = line.includes('QTY') || line.includes('QUANTITY')
    const hasRateCol = line.includes('RATE') || line.includes('PTR') || line.includes('PRICE') || line.includes('MRP')

    if ((hasProductCol && hasBatchCol) || (hasProductCol && hasQtyCol && hasRateCol)) {
      tableStartIndex = i
      break
    }
  }

  const startIdx = tableStartIndex !== -1 ? tableStartIndex + 1 : 0

  for (let i = startIdx; i < lines.length; i++) {
    const rawLine = lines[i].trim()
    if (!rawLine) continue

    const upper = rawLine.toUpperCase()

    // Skip intermediate section subtotals, tax summaries, and page markers across multi-page invoices
    if (
      upper.startsWith('SUB-TOTAL') ||
      upper.startsWith('SUB TOTAL') ||
      upper.startsWith('SUBTOTAL') ||
      upper.startsWith('PAGE TOTAL') ||
      upper.includes('PAGE') ||
      upper.startsWith('TOTAL TAX') ||
      upper.startsWith('TAXABLE AMOUNT') ||
      upper.startsWith('CGST') ||
      upper.startsWith('SGST') ||
      upper.startsWith('IGST') ||
      upper.includes('CONTINUED')
    ) {
      continue
    }

    // Skip repeated table headers on subsequent pages
    if (
      (upper.includes('ITEM') || upper.includes('PRODUCT') || upper.includes('DESCRIPTION') || upper.includes('PARTICULARS')) &&
      (upper.includes('BATCH') || upper.includes('B.NO') || upper.includes('LOT') || upper.includes('QTY')) &&
      (upper.includes('RATE') || upper.includes('MRP') || upper.includes('EXPIRY'))
    ) {
      continue
    }

    // Break only on true terminal document summaries (grand totals, bank details, terms)
    if (
      upper.startsWith('GRAND TOTAL') ||
      upper.startsWith('NET PAYABLE') ||
      upper.startsWith('NET AMOUNT') ||
      upper.startsWith('TOTAL AMOUNT') ||
      upper.startsWith('AMOUNT CHARGEABLE') ||
      upper.startsWith('BANK DETAILS') ||
      upper.startsWith('TERMS & CONDITIONS') ||
      upper.startsWith('TERMS AND CONDITIONS') ||
      upper.startsWith('FOR ') ||
      upper.startsWith('AUTHORIZED SIGNATORY') ||
      upper.startsWith('AUTHORISED SIGNATORY')
    ) {
      break
    }

    // Skip separator lines
    if (/^[=\-\_\+]+$/.test(rawLine)) continue

    // A candidate line usually contains numbers (qty, rate, mrp) and an expiry or batch token
    // Regex matching tabular line:
    // S# (optional) | Product Name | Pack | HSN | Batch | Expiry | Qty | Free | Rate | MRP | Disc% | GST% | Amount
    const tokens = rawLine.split(/\s{2,}|\t|\|/).map((t) => t.trim()).filter(Boolean)

    // Fallback: If not separated by multi-spaces, split by single space if structured
    const words = rawLine.split(/\s+/).filter(Boolean)

    const parsedItem = tryParseItemFromLine(rawLine, tokens, words, items.length + 1)
    if (parsedItem) {
      items.push(parsedItem)
    }
  }

  return items
}

/**
 * Parses a single text line into a structured ExtractedLineItem using heuristic pattern matching.
 */
function tryParseItemFromLine(
  rawLine: string,
  tokens: string[],
  words: string[],
  index: number
): ExtractedLineItem | null {
  // Guard against invoice headers, metadata, customer/doctor and payment lines
  const trimmed = rawLine.trim()
  if (
    /^(?:INVOICE|BILL|MEMO|TAX\s*INVOICE|PAYMENT|DUE|TERMS|DISPENSARY|BANK|BRANCH|CUSTOMER|PATIENT|DOCTOR|DELIVERY|TRANSPORT|VEHICLE|PO\s*NO)/i.test(
      trimmed
    ) ||
    /(?:INVOICE\s*DATE|PAYMENT\s*TERMS|CREDIT\s*DAYS|DUE\s*DATE|GSTIN|DL\s*NO|DRUG\s*LIC|PAN\s*NO|A\/C|IFSC|PHONE|EMAIL|ADDRESS)/i.test(
      rawLine
    )
  ) {
    return null
  }

  // Look for pharmaceutical expiry format: MM/YY, MM/YYYY, MMM-YY, etc.
  const expiryMatch = rawLine.match(/\b(0?[1-9]|1[0-2])[\/\-\.](20\d{2}|\d{2})\b|\b([A-Z]{3})[\/\-\.](\d{2,4})\b/i)
  if (!expiryMatch) {
    return null
  }

  const rawExpiry = expiryMatch[0]
  const normalizedExpiry = parsePharmaDate(rawExpiry)
  if (!normalizedExpiry) return null

  // Pack size extraction (e.g. 10'S, 15'S, 10ML, 100ML)
  const packMatch = rawLine.match(PACK_SIZE_REGEX)
  const packSize = packMatch ? packMatch[0].toUpperCase() : undefined

  // HSN code extraction (typically 4 digits starting with 30, e.g. 3004)
  const hsnMatch = rawLine.match(/\b(300[1-6]|3004\d{0,4})\b/)
  const hsnCode = hsnMatch ? hsnMatch[0] : '3004'

  // Look for Batch number: alphanumeric token of 3-12 characters, often preceding or succeeding expiry
  const expiryIndex = rawLine.indexOf(rawExpiry)
  const beforeExpiry = rawLine.slice(0, expiryIndex).trim()
  const afterExpiry = rawLine.slice(expiryIndex + rawExpiry.length).trim()

  const beforeWords = beforeExpiry.split(/\s+/).filter(Boolean)
  const afterWords = afterExpiry.split(/\s+/).filter(Boolean)

  const MEDICINE_KEYWORDS = new Set([
    'TAB', 'TABS', 'TABLET', 'TABLETS', 'CAP', 'CAPS', 'CAPSULE', 'CAPSULES',
    'SYP', 'SYRUP', 'INJ', 'INJECTION', 'OINT', 'OINTMENT', 'GEL', 'DROPS',
    'DROP', 'DROBT', 'SUSP', 'SUSPENSION', 'SOL', 'SOLUTION', 'CREAM',
    'RESPULES', 'ROTACAPS', 'LOTION', 'POWDER', 'MG', 'GM', 'ML', 'MCG',
    'PLUS', 'FORTE', 'DUO', 'TRIO', 'DS', 'SF', 'RD', 'CV', 'DM', 'H',
  ])

  // Batch is often the token immediately before or after expiry (preferring alphanumeric with digits)
  let batchNumber = ''
  if (beforeWords.length > 0) {
    const candidate = beforeWords[beforeWords.length - 1].toUpperCase()
    if (
      candidate !== hsnCode &&
      !PACK_SIZE_REGEX.test(candidate) &&
      !MEDICINE_KEYWORDS.has(candidate) &&
      /^[A-Za-z0-9\-_]{2,15}$/.test(candidate)
    ) {
      batchNumber = candidate
      beforeWords.pop()
    }
  }

  if (!batchNumber && afterWords.length > 0) {
    const candidate = afterWords[0].toUpperCase()
    if (!MEDICINE_KEYWORDS.has(candidate) && /^[A-Za-z0-9\-_]{2,15}$/.test(candidate)) {
      batchNumber = candidate
      afterWords.shift()
    }
  }

  // Look for any alphanumeric token with mixed letters & digits anywhere in words
  if (!batchNumber) {
    const candidate = words.find(
      (w) =>
        /^(?=[A-Za-z0-9]{3,15}$)(?=.*[A-Za-z])(?=.*[0-9]).*$/.test(w) &&
        w !== hsnCode &&
        !MEDICINE_KEYWORDS.has(w.toUpperCase())
    )
    if (candidate) {
      batchNumber = candidate.toUpperCase()
    }
  }

  if (!batchNumber) {
    batchNumber = `BATCH-${index}`
  }

  // Numbers parsing from afterExpiry (quantities, rates, taxes, totals)
  const numbersInAfter = afterWords
    .map((w) => w.replace(/[^\d\.]/g, ''))
    .filter((w) => w.length > 0)
    .map(Number)
    .filter((n) => !isNaN(n))

  let billedQuantity = 1
  let freeQuantity = 0
  let unitCost = 0
  let mrp = 0
  let discountPercent = 0
  let taxPercent = 12

  // Look for explicit free qty or scheme (e.g. 50+5) strictly in afterExpiry
  // to prevent matching combination medicine strengths (e.g. 100+325) in product description
  const schemeMatch = afterExpiry.match(/(\d+)\s*\+\s*(\d+)/)
  if (schemeMatch) {
    billedQuantity = parseInt(schemeMatch[1], 10)
    freeQuantity = parseInt(schemeMatch[2], 10)

    // Strip scheme token from afterExpiry so remaining numeric tokens represent unitCost, MRP, discount, tax
    const remainingAfterScheme = afterExpiry.replace(schemeMatch[0], ' ')
    const numbersAfterScheme = remainingAfterScheme
      .split(/\s+/)
      .map((w) => w.replace(/[^\d\.]/g, ''))
      .filter((w) => w.length > 0)
      .map(Number)
      .filter((n) => !isNaN(n))

    if (numbersAfterScheme.length >= 2) {
      unitCost = numbersAfterScheme[0] || 0
      mrp = numbersAfterScheme[1] || round2(unitCost * 1.35)
      if (numbersAfterScheme.length >= 5) {
        discountPercent = numbersAfterScheme[2] || 0
        taxPercent = numbersAfterScheme[3] || 12
      } else if (numbersAfterScheme.length === 4) {
        if (numbersAfterScheme[3] > 28 || ![0, 5, 12, 18, 28].includes(numbersAfterScheme[3])) {
          taxPercent = numbersAfterScheme[2] || 12
          discountPercent = 0
        } else {
          discountPercent = numbersAfterScheme[2] || 0
          taxPercent = numbersAfterScheme[3] || 12
        }
      } else if (numbersAfterScheme.length === 3) {
        taxPercent = numbersAfterScheme[2] || 12
      }
    } else if (numbersAfterScheme.length === 1) {
      unitCost = numbersAfterScheme[0] || 0
      mrp = round2(unitCost * 1.35)
    }
  } else if (numbersInAfter.length >= 2) {
    // If standard table columns: Qty, Free, Rate, MRP, ...
    // Preserve 0 for free promotional items (do not coerce 0 to 1 via || 1)
    const parsedBilled = Math.floor(numbersInAfter[0])
    billedQuantity = !isNaN(parsedBilled) ? Math.max(0, parsedBilled) : 1

    if (numbersInAfter.length >= 4) {
      const parsedFree = Math.floor(numbersInAfter[1])
      freeQuantity = !isNaN(parsedFree) ? Math.max(0, parsedFree) : 0
      unitCost = numbersInAfter[2] || 0
      mrp = numbersInAfter[3] || 0
      if (numbersInAfter.length >= 7) {
        discountPercent = numbersInAfter[4] || 0
        taxPercent = numbersInAfter[5] || 12
      } else if (numbersInAfter.length === 6) {
        // If column 5 is > 28 or not a valid GST slab, it is the line total, and column 4 is GST%
        if (numbersInAfter[5] > 28 || ![0, 5, 12, 18, 28].includes(numbersInAfter[5])) {
          taxPercent = numbersInAfter[4] || 12
          discountPercent = 0
        } else {
          discountPercent = numbersInAfter[4] || 0
          taxPercent = numbersInAfter[5] || 12
        }
      } else if (numbersInAfter.length === 5) {
        taxPercent = numbersInAfter[4] || 12
      }
    } else {
      unitCost = numbersInAfter[1] || 0
      mrp = numbersInAfter[2] || round2(unitCost * 1.35)
    }
  }

  // Disambiguate Discount % and GST % without collision, scoped to afterExpiry
  const pctMatches = Array.from(afterExpiry.matchAll(/(\d+(?:\.\d+)?)\s*%/g))
  if (pctMatches.length >= 2) {
    // Standard wholesale format: discount precedes GST (e.g. Rate MRP Disc% GST%)
    discountPercent = parseFloat(pctMatches[0][1])
    taxPercent = parseFloat(pctMatches[pctMatches.length - 1][1])
  } else if (pctMatches.length === 1) {
    const val = parseFloat(pctMatches[0][1])
    const idx = afterExpiry.indexOf(pctMatches[0][0])
    const beforePct = afterExpiry.slice(0, idx).toUpperCase()
    if (beforePct.includes('DISC') || beforePct.includes('CD') || beforePct.includes('TD')) {
      discountPercent = val
    } else if ([0, 5, 12, 18, 28].includes(val)) {
      taxPercent = val
      if (numbersInAfter.length < 7) {
        discountPercent = 0
      }
    } else {
      discountPercent = val
    }
  }

  // Product description is the remaining text in beforeExpiry
  let rawDescription = beforeWords.join(' ').trim()

  // Clean leading noise: serial numbers, OCR artifacts (le, Hh, 1|, 3|__-, etc.)
  rawDescription = rawDescription.replace(/^[0-9\.\-\|\<\~\*\_\"\:\s\=\>\+\(\)\#\[\]]+/, '').trim()
  rawDescription = rawDescription.replace(/^(?:le|Hh|ll|II|I\s*[;:])/i, '').trim()
  rawDescription = rawDescription.replace(/^[0-9\.\-\|\<\~\*\_\"\:\s\=\>\+\(\)\#\[\]]+/, '').trim()

  // Clean trailing noise: brackets, stray symbols, rate/tax column bleed
  rawDescription = rawDescription.replace(/[\*\[\(].*$/, '').trim()
  rawDescription = rawDescription.replace(/\s*[\=\-\.\:\_]+\s*N[0-9].*$/, '').trim()
  rawDescription = rawDescription.replace(/\s*\|\s*.*$/, '').trim()
  rawDescription = rawDescription.replace(/[\s\-_*#]+$/, '').trim()

  // Discard pure numeric, barcode, or punctuation noise lines (must have at least 3 alphabet characters for a legitimate medicine name)
  const alphabetCount = rawDescription.replace(/[^A-Za-z]/g, '').length
  if (alphabetCount < 3) {
    return null
  }

  // Ensure MRP >= unitCost
  if (mrp === 0 || mrp < unitCost) {
    mrp = round2(unitCost > 0 ? unitCost * 1.35 : 100)
  }

  // Financial calculations for the line
  const lineTaxable = round2(billedQuantity * unitCost * (1 - discountPercent / 100))
  const lineTax = round2(lineTaxable * (taxPercent / 100))
  const lineTotal = round2(lineTaxable + lineTax)

  return {
    id: `item-${index}`,
    rawDescription,
    matchedProductName: undefined,
    matchConfidence: 0.85,
    isNewProduct: true,
    packSize,
    hsnCode,
    batchNumber,
    expiryDate: normalizedExpiry,
    billedQuantity,
    freeQuantity,
    unitCost,
    mrp,
    discountPercent,
    taxPercent,
    taxAmount: lineTax,
    totalAmount: lineTotal,
  }
}

// ─────────────────────────────────────────────────────────────
// Header & Statutory Extraction
// ─────────────────────────────────────────────────────────────

/**
 * Extracts header metadata (supplier name, GSTIN, Drug License, invoice number, dates)
 */
export function parseInvoiceHeader(text: string): {
  supplier: ExtractedSupplier
  invoice: {
    invoiceNumber: string
    invoiceDate: string
    dueDate?: string
  }
} {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  // 1. GSTIN
  const gstinMatch = text.match(GSTIN_REGEX)
  const gstin = gstinMatch ? gstinMatch[0].toUpperCase() : undefined

  // 2. Drug License
  const dlMatch = text.match(DRUG_LICENSE_REGEX)
  let dlNumber: string | undefined = undefined
  if (dlMatch && dlMatch[1]) {
    dlNumber = dlMatch[1].trim()
  } else {
    // Secondary match: 20B/21B tokens
    const dlParts = Array.from(text.matchAll(DL_20B_21B_REGEX))
    if (dlParts.length > 0) {
      dlNumber = dlParts.map((p) => p[0].trim()).join(', ')
    }
  }

  // 3. Supplier Name: Scan initial 8 lines, skipping generic invoice banners
  let rawName = 'UNKNOWN PHARMA DISTRIBUTOR'
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const line = lines[i]
    const upper = line.toUpperCase()
    if (
      upper.includes('TAX INVOICE') ||
      upper.includes('CASH MEMO') ||
      upper.includes('ORIGINAL FOR RECIPIENT') ||
      upper.includes('BILL OF SUPPLY') ||
      upper.includes('CREDIT MEMO') ||
      /^[=\-\_\+]+$/.test(line)
    ) {
      continue
    }

    // Match patterns like "DISTRIBUTOR: MAHAVEER PHARMA..." or plain company line
    const distMatch = line.match(/(?:DISTRIBUTOR|M\/S|SUPPLIER)[\s\:\.\-]+([A-Za-z0-9\s\.\,\(\)\&]{4,60})/i)
    if (distMatch) {
      rawName = distMatch[1].trim()
      break
    } else if (upper.includes('PHARMA') || upper.includes('MEDISALES') || upper.includes('DRUGS') || upper.includes('AGENCIES') || upper.includes('ENTERPRISES') || upper.includes('HEALTHCARE')) {
      rawName = line.split(/\s{2,}|\t|\|/)[0].trim()
      break
    }
  }

  // 4. Invoice Number
  const invMatch = text.match(INVOICE_NUMBER_REGEX)
  const invoiceNumber = invMatch ? invMatch[1].trim() : `INV-${Date.now().toString().slice(-6)}`

  // 5. Invoice Date
  const dateMatch = text.match(INVOICE_DATE_REGEX)
  const invoiceDate = normalizeInvoiceDate(dateMatch ? dateMatch[1] : undefined)

  // 6. Due Date
  const dueMatch = text.match(DUE_DATE_REGEX)
  const dueDate = dueMatch ? normalizeInvoiceDate(dueMatch[1]) : undefined

  return {
    supplier: {
      rawName,
      gstin,
      dlNumber,
      matchConfidence: gstin ? 1.0 : dlNumber ? 0.95 : 0.6,
      isNew: true,
    },
    invoice: {
      invoiceNumber,
      invoiceDate,
      dueDate,
    },
  }
}

// ─────────────────────────────────────────────────────────────
// Financials & Mathematical Cross-Reconciliation
// ─────────────────────────────────────────────────────────────

/**
 * Performs mathematical cross-reconciliation:
 * Taxable + Tax - Discount ± RoundOff == Extracted Grand Total
 */
export function reconcileFinancials(
  items: ExtractedLineItem[],
  text: string
): ExtractedFinancials {
  // Extract printed totals from invoice footer if available
  const subtotalMatch = text.match(/(?:SUB\-TOTAL|SUB\s*TOTAL|TAXABLE\s*AMOUNT)[\s\:\.\=Rs]+([\d\,\.]+)/i)
  const taxMatch = text.match(/(?:TOTAL\s*TAX|TAX\s*AMOUNT|GST\s*TOTAL)[\s\:\.\=Rs]+([\d\,\.]+)/i)
  const discMatch = text.match(/(?:CASH\s*DISC|DISCOUNT|TOTAL\s*DISCOUNT)[\s\:\.\=Rs]+([\d\,\.]+)/i)
  const roundOffMatch = text.match(/(?:ROUND\s*OFF|R\/O)[\s\:\.\=Rs]+([\+\-\d\,\.]+)/i)
  const grandTotalMatch = text.match(/(?:GRAND\s*TOTAL|NET\s*PAYABLE|TOTAL\s*AMOUNT|NET\s*AMOUNT)[\s\:\.\=Rs]+([\d\,\.]+)/i)

  const extractedSubtotal = subtotalMatch ? parseNum(subtotalMatch[1]) : 0
  const extractedTax = taxMatch ? parseNum(taxMatch[1]) : 0
  const extractedDiscount = discMatch ? parseNum(discMatch[1]) : 0
  const extractedRoundOff = roundOffMatch ? parseNum(roundOffMatch[1]) : 0
  const extractedGrandTotal = grandTotalMatch ? parseNum(grandTotalMatch[1]) : 0

  // Line item rollups
  let computedSubtotal = 0
  let computedTax = 0

  for (const item of items) {
    const taxable = round2(item.billedQuantity * item.unitCost * (1 - item.discountPercent / 100))
    const tax = round2(taxable * (item.taxPercent / 100))
    computedSubtotal += taxable
    computedTax += tax
  }

  computedSubtotal = round2(computedSubtotal)
  computedTax = round2(computedTax)

  const discountAmount = extractedDiscount > 0 ? extractedDiscount : 0
  const roundOff = extractedRoundOff

  // Mathematical cross-reconciliation
  const computedGrandTotal = round2(computedSubtotal + computedTax - discountAmount + roundOff)
  const effectiveGrandTotal = extractedGrandTotal > 0 ? extractedGrandTotal : computedGrandTotal

  const reconciliationVariance = round2(Math.abs(computedGrandTotal - effectiveGrandTotal))
  // Reconciled only if there are items and variance is within Rs. 1.00 (standard rounding tolerance)
  const isReconciled = items.length > 0 && reconciliationVariance <= 1.0

  return {
    subtotal: extractedSubtotal > 0 ? extractedSubtotal : computedSubtotal,
    taxAmount: extractedTax > 0 ? extractedTax : computedTax,
    discountAmount,
    roundOff,
    totalAmount: effectiveGrandTotal,
    isReconciled,
    reconciliationVariance,
  }
}

// ─────────────────────────────────────────────────────────────
// Master Heuristics Parser
// ─────────────────────────────────────────────────────────────

/**
 * Parses raw extracted bill text into fully-structured pharmaceutical invoice data
 * with statutory header regex, tabular items, and math cross-reconciliation.
 */
export function parsePharmaInvoiceText(text: string): ParsedInvoiceData {
  const trimmed = text ? text.trim() : ''
  if (!trimmed) {
    const { supplier, invoice } = parseInvoiceHeader('')
    return {
      supplier: {
        ...supplier,
        matchConfidence: 0.0,
      },
      invoice,
      items: [],
      financials: {
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        roundOff: 0,
        totalAmount: 0,
        isReconciled: false,
        reconciliationVariance: 0,
      },
      overallConfidence: 0.0,
    }
  }

  const lines = text.split(/\r?\n/)
  const { supplier, invoice } = parseInvoiceHeader(text)
  const items = parseInvoiceLineItems(lines)
  const financials = reconcileFinancials(items, text)

  // Overall confidence calculation
  let score = 0.2 // baseline for text presence
  if (supplier.gstin) score += 0.25
  if (supplier.dlNumber) score += 0.15
  if (invoice.invoiceNumber && !invoice.invoiceNumber.startsWith('INV-')) score += 0.1
  if (items.length > 0) score += 0.15
  if (financials.isReconciled) score += 0.15

  const overallConfidence = round2(Math.min(1.0, score))

  return {
    supplier,
    invoice,
    items,
    financials,
    overallConfidence,
  }
}
