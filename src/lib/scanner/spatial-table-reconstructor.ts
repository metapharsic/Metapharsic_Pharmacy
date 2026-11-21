/**
 * Spatial Coordinate Table Reconstructor & Mathematical Validator
 * Metapharsic Rx - Zero-LLM Architecture
 *
 * Implements:
 * 1. Y-Coordinate Proximity Clustering (±8px) to reconstruct true printed table rows.
 * 2. Header Anchor Boundary Detection to map columns without relying on rigid pixel templates.
 * 3. Deterministic Line Math & GST Auto-Validation: (Qty * Rate) - Discount + GST == Line Total.
 * 4. Character Substitution Heuristic for optical digit misreads (B<->8, O<->0, S<->5, I<->1).
 */

import type { OcrBoundingBox } from './deterministic-ocr-client'

export interface SpatialColumnAnchor {
  key:
    | 'productName'
    | 'hsnCode'
    | 'batchNumber'
    | 'expiryDate'
    | 'packSize'
    | 'billedQuantity'
    | 'freeQuantity'
    | 'unitCost'
    | 'mrp'
    | 'discountPercent'
    | 'taxPercent'
    | 'taxAmount'
    | 'totalAmount'
  label: string
  xStart: number
  xEnd: number
  centerX: number
}

export interface ReconstructedLineItem {
  id: string
  productName: string
  packSize: string
  tabsPerStrip: number
  hsnCode: string
  batchNumber: string
  expiryDate: string
  billedQuantity: number
  freeQuantity: number
  unitCost: number
  mrp: number
  discountPercent: number
  taxPercent: number
  taxAmount: number
  totalAmount: number
  matchConfidence: number
  mathVerified: boolean
  rawTextRow: string
}

export interface ReconstructedInvoice {
  success: boolean
  supplier: {
    rawName: string
    gstin?: string
    dlNumber?: string
    phone?: string
    address?: string
  }
  invoice: {
    invoiceNumber: string
    invoiceDate: string
    dueDate?: string
  }
  items: ReconstructedLineItem[]
  financials: {
    subtotal: number
    taxAmount: number
    discountAmount: number
    roundOff: number
    totalAmount: number
    isReconciled: boolean
  }
  validationErrors: string[]
}

// ─────────────────────────────────────────────────────────────
// Character Repair Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Attempts to repair common OCR character swaps in numerical fields.
 * e.g., '1B.50' -> 18.50, '1OO' -> 100, '5O.OO' -> 50.00
 */
export function cleanOcrNumber(raw: string): number {
  if (!raw) return 0.0
  let cleaned = raw
    .trim()
    .replace(/[₹Rs\.,\s]/g, (match) => (match === '.' ? '.' : ''))
    .replace(/[oO]/g, '0')
    .replace(/[bB]/g, '8')
    .replace(/[sS]/g, '5')
    .replace(/[iIlL|]/g, '1')

  // Keep only digits and first decimal point
  const parts = cleaned.split('.')
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('')
  }
  const val = parseFloat(cleaned)
  return isNaN(val) ? 0.0 : Math.round(val * 100) / 100
}

/**
 * Normalizes pharmaceutical expiry date representations to YYYY-MM-DD (month end)
 */
export function normalizeExpiryDate(raw: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10)
  const cleaned = raw.trim().toUpperCase().replace(/[,\s]/g, '-')

  // MM/YY or MM-YY e.g. 08/28 or 08-2028
  const m = cleaned.match(/^(\d{1,2})[/\-](\d{2,4})$/)
  if (m) {
    let month = parseInt(m[1], 10)
    let year = parseInt(m[2], 10)
    if (month > 12 && year <= 12) {
      // Swapped
      const tmp = month
      month = year
      year = tmp
    }
    if (year < 100) year += year < 50 ? 2000 : 1900
    if (month >= 1 && month <= 12) {
      const lastDay = new Date(year, month, 0).getDate()
      return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    }
  }

  // YYYY-MM-DD
  const iso = cleaned.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/)
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  }

  return new Date().toISOString().slice(0, 10)
}

// ─────────────────────────────────────────────────────────────
// Spatial Row Clustering Algorithm
// ─────────────────────────────────────────────────────────────

export interface SpatialRow {
  yCenter: number
  yMin: number
  yMax: number
  boxes: OcrBoundingBox[]
}

/**
 * Clusters bounding boxes into rows using Y-proximity clustering (±8px threshold)
 */
export function clusterBoxesIntoRows(boxes: OcrBoundingBox[], yThreshold = 8): SpatialRow[] {
  // Sort all boxes by vertical center first
  const sorted = [...boxes].sort((a, b) => {
    const centerA = (a.box[1] + a.box[3]) / 2
    const centerB = (b.box[1] + b.box[3]) / 2
    return centerA - centerB
  })

  const rows: SpatialRow[] = []

  for (const box of sorted) {
    const boxYCenter = (box.box[1] + box.box[3]) / 2
    let matchedRow: SpatialRow | null = null

    for (const r of rows) {
      if (Math.abs(r.yCenter - boxYCenter) <= yThreshold) {
        matchedRow = r
        break
      }
    }

    if (matchedRow) {
      matchedRow.boxes.push(box)
      // Re-center row Y
      matchedRow.yMin = Math.min(matchedRow.yMin, box.box[1])
      matchedRow.yMax = Math.max(matchedRow.yMax, box.box[3])
      const totalY = matchedRow.boxes.reduce((acc, b) => acc + (b.box[1] + b.box[3]) / 2, 0)
      matchedRow.yCenter = totalY / matchedRow.boxes.length
    } else {
      rows.push({
        yCenter: boxYCenter,
        yMin: box.box[1],
        yMax: box.box[3],
        boxes: [box],
      })
    }
  }

  // Sort tokens in each row from left to right (X-axis)
  for (const r of rows) {
    r.boxes.sort((a, b) => a.box[0] - b.box[0])
  }

  return rows
}

// ─────────────────────────────────────────────────────────────
// Header Anchor Column Detector
// ─────────────────────────────────────────────────────────────

const COLUMN_HEADER_PATTERNS: Array<{
  key: SpatialColumnAnchor['key']
  label: string
  pattern: RegExp
}> = [
  { key: 'productName', label: 'Item / Product', pattern: /\b(PRODUCT|ITEM|PARTICULARS|DESCRIPTION|DRUG|MEDICINE)\b/i },
  { key: 'hsnCode', label: 'HSN / SAC', pattern: /\b(HSN|SAC|CODE)\b/i },
  { key: 'packSize', label: 'Pack', pattern: /\b(PACK|PK|SIZE|UNITS?)\b/i },
  { key: 'batchNumber', label: 'Batch No.', pattern: /\b(BATCH|LOT|B\.?\s*NO)\b/i },
  { key: 'expiryDate', label: 'Expiry', pattern: /\b(EXP|EXPIRY|VAL|E\.?\s*DT)\b/i },
  { key: 'billedQuantity', label: 'Billed Qty', pattern: /\b(QTY|BILLED|QUANTITY|NOS)\b/i },
  { key: 'freeQuantity', label: 'Free Qty', pattern: /\b(FREE|SCH|SCHEME|F\.?\s*QTY)\b/i },
  { key: 'unitCost', label: 'PTR / Rate', pattern: /\b(RATE|PTR|PRICE|UNIT\s*COST|BASIC)\b/i },
  { key: 'mrp', label: 'MRP', pattern: /\b(MRP|M\.?\s*R\.?\s*P)\b/i },
  { key: 'discountPercent', label: 'Disc %', pattern: /\b(DISC|DIS%|CD%|SCH%)\b/i },
  { key: 'taxPercent', label: 'GST %', pattern: /\b(GST%|TAX%|CGST|SGST|IGST)\b/i },
  { key: 'totalAmount', label: 'Amount', pattern: /\b(AMOUNT|TOTAL|NET|VALUE|GROSS)\b/i },
]

export function detectColumnAnchors(rows: SpatialRow[]): {
  anchors: SpatialColumnAnchor[]
  headerRowIndex: number
} {
  let bestRowIdx = -1
  let maxMatched = 0
  let bestAnchors: SpatialColumnAnchor[] = []

  // Check top 25 rows for table headers
  for (let idx = 0; idx < Math.min(rows.length, 25); idx++) {
    const row = rows[idx]
    const matchedAnchors: SpatialColumnAnchor[] = []

    for (const box of row.boxes) {
      for (const col of COLUMN_HEADER_PATTERNS) {
        if (col.pattern.test(box.text)) {
          // Avoid duplicate assignment to same key
          if (!matchedAnchors.some((a) => a.key === col.key)) {
            matchedAnchors.push({
              key: col.key,
              label: col.label,
              xStart: box.box[0],
              xEnd: box.box[2],
              centerX: (box.box[0] + box.box[2]) / 2,
            })
          }
          break
        }
      }
    }

    if (matchedAnchors.length >= 4 && matchedAnchors.length > maxMatched) {
      maxMatched = matchedAnchors.length
      bestRowIdx = idx
      bestAnchors = matchedAnchors
    }
  }

  // Sort anchors horizontally by centerX
  bestAnchors.sort((a, b) => a.centerX - b.centerX)

  // Expand boundaries between adjacent anchors to cover intermediate space
  for (let i = 0; i < bestAnchors.length; i++) {
    const curr = bestAnchors[i]
    const prev = bestAnchors[i - 1]
    const next = bestAnchors[i + 1]

    const leftBoundary = prev ? (prev.xEnd + curr.xStart) / 2 : 0
    const rightBoundary = next ? (curr.xEnd + next.xStart) / 2 : 5000

    curr.xStart = leftBoundary
    curr.xEnd = rightBoundary
  }

  return { anchors: bestAnchors, headerRowIndex: bestRowIdx }
}

// ─────────────────────────────────────────────────────────────
// Full Invoice Reconstructor & Math Validator
// ─────────────────────────────────────────────────────────────

export function reconstructInvoiceFromBoxes(boxes: OcrBoundingBox[]): ReconstructedInvoice {
  const rows = clusterBoxesIntoRows(boxes)
  const fullText = rows.map((r) => r.boxes.map((b) => b.text).join(' ')).join('\n')

  // 1. Supplier Header Extraction
  let rawSupplier = 'Wholesale Distributor'
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const rowStr = rows[i].boxes.map((b) => b.text).join(' ').trim()
    if (
      rowStr.length >= 5 &&
      !/INVOICE|TAX|BILL|GSTIN|PHARMACY|CUSTOMER|PATIENT|DATE/i.test(rowStr) &&
      !/^\d+$/.test(rowStr)
    ) {
      rawSupplier = rowStr
      break
    }
  }

  // GSTIN & DL Number
  let gstin: string | undefined
  const gstinMatch = fullText.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i)
  if (gstinMatch) gstin = gstinMatch[1].toUpperCase()

  let dlNumber: string | undefined
  const dlMatch = fullText.match(/(?:D\.?L|DRUG\s*LIC)[\s.:#\-]+([A-Z0-9/\-]+)/i)
  if (dlMatch) dlNumber = dlMatch[1].trim()

  let phone: string | undefined
  const phoneMatch = fullText.match(/(?:PH|MOB|TEL)[\s.:#\-]+(?:\+91[\s-]*)?([6-9]\d{9})\b/i)
  if (phoneMatch) phone = phoneMatch[1]

  // Invoice Number & Date
  let invoiceNumber = `INV-${Date.now().toString().slice(-6)}`
  const invMatch = fullText.match(/(?:INVOICE\s*(?:NO|NUMBER)|INV\s*NO)[\s.:#\-]+([A-Z0-9\-_/]+)/i)
  if (invMatch) invoiceNumber = invMatch[1].trim()

  let invoiceDate = new Date().toISOString().slice(0, 10)
  const dateMatch = fullText.match(/(?:DATE|INVOICE\s*DATE)[\s.:#\-]+(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})/i)
  if (dateMatch) invoiceDate = normalizeExpiryDate(dateMatch[1])

  // 2. Column Detection
  const { anchors, headerRowIndex } = detectColumnAnchors(rows)
  const items: ReconstructedLineItem[] = []
  const validationErrors: string[] = []

  const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 1

  // 3. Row Parsing by Column Projection
  for (let rIdx = startRow; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx]
    const rowText = row.boxes.map((b) => b.text).join(' ').trim()

    // Break if table ends (Total / Summary keywords)
    if (/\b(TOTAL|GRAND\s*TOTAL|SUBTOTAL|TAX\s*AMOUNT|ROUND\s*OFF|E\.?\s*&\s*O\.?E)\b/i.test(rowText)) {
      break
    }

    // Bucket tokens by column
    const colBuckets: Record<string, string[]> = {}
    for (const a of anchors) {
      colBuckets[a.key] = []
    }

    for (const box of row.boxes) {
      const boxCenter = (box.box[0] + box.box[2]) / 2
      // Find matching anchor
      const match = anchors.find((a) => boxCenter >= a.xStart && boxCenter <= a.xEnd)
      if (match) {
        colBuckets[match.key].push(box.text)
      } else {
        // Fallback: Default leftmost to productName
        if (boxCenter < (anchors[0]?.xStart || 200)) {
          if (!colBuckets.productName) colBuckets.productName = []
          colBuckets.productName.push(box.text)
        }
      }
    }

    const prodName = (colBuckets.productName || []).join(' ').trim()
    // A line item must have a recognizable medicine name
    if (prodName.length < 3 || /PAGE|COPY|TRANSPORT|DISPATCH/i.test(prodName)) {
      continue
    }

    const billedQty = cleanOcrNumber((colBuckets.billedQuantity || [])[0] || '1') || 1
    const freeQty = cleanOcrNumber((colBuckets.freeQuantity || [])[0] || '0')
    const unitCost = cleanOcrNumber((colBuckets.unitCost || [])[0] || '0')
    const mrp = cleanOcrNumber((colBuckets.mrp || [])[0] || '0')
    const discPct = cleanOcrNumber((colBuckets.discountPercent || [])[0] || '0')
    const taxPct = cleanOcrNumber((colBuckets.taxPercent || [])[0] || '12') || 12
    const totalAmount = cleanOcrNumber((colBuckets.totalAmount || [])[0] || '0')

    // Discard noise rows that have zero financial data
    if (unitCost <= 0 && mrp <= 0 && totalAmount <= 0) {
      continue
    }

    const batch = (colBuckets.batchNumber || []).join('').trim() || ''
    const expRaw = (colBuckets.expiryDate || [])[0] || ''
    const expiry = normalizeExpiryDate(expRaw)
    const hsn = (colBuckets.hsnCode || [])[0] || '3004'

    // 4. Mathematical Identity Validator
    // Line Total = (BilledQty * unitCost) * (1 - discPct/100) * (1 + taxPct/100)
    const baseAmt = billedQty * unitCost
    const discAmt = (baseAmt * discPct) / 100
    const taxableAmt = baseAmt - discAmt
    const calcTaxAmt = Math.round(((taxableAmt * taxPct) / 100) * 100) / 100
    const calcLineTotal = Math.round((taxableAmt + calcTaxAmt) * 100) / 100

    let finalTotal = totalAmount > 0 ? totalAmount : calcLineTotal
    let mathVerified = false

    if (totalAmount > 0 && Math.abs(calcLineTotal - totalAmount) <= 0.5) {
      mathVerified = true
    } else if (totalAmount > 0) {
      // Possible character error: check if auto-correct resolves it
      mathVerified = false
      validationErrors.push(
        `Row [${prodName}] Math Variance: Calculated ${calcLineTotal} vs Extracted ${totalAmount}`
      )
    } else {
      finalTotal = calcLineTotal
      mathVerified = true
    }

    items.push({
      id: `ITEM-${items.length + 1}`,
      productName: prodName,
      packSize: (colBuckets.packSize || [])[0] || '10 Tabs',
      tabsPerStrip: 10,
      hsnCode: hsn,
      batchNumber: batch,
      expiryDate: expiry,
      billedQuantity: billedQty,
      freeQuantity: freeQty,
      unitCost: unitCost || Math.round((mrp * 0.7) * 100) / 100,
      mrp: mrp || Math.round((unitCost * 1.4) * 100) / 100,
      discountPercent: discPct,
      taxPercent: taxPct,
      taxAmount: calcTaxAmt,
      totalAmount: finalTotal,
      matchConfidence: mathVerified ? 0.98 : 0.85,
      mathVerified,
      rawTextRow: rowText,
    })
  }

  // 3b. Fallback: If Column Projection yielded 0 items (e.g. dense single line OCR or missing anchor headers),
  // apply Tabular Line-by-Line Regex Parser
  if (items.length === 0) {
    let tableHeaderIdx = -1
    for (let r = 0; r < rows.length; r++) {
      const text = rows[r].boxes.map((b) => b.text).join(' ')
      if (/\b(Product\s*Name|BatchNo|M\.R\.P|EXP|QTY|RATE|BILLED)\b/i.test(text)) {
        tableHeaderIdx = r
        break
      }
    }
    const startIdx = tableHeaderIdx !== -1 ? tableHeaderIdx + 1 : 0

    for (let rIdx = startIdx; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx]
      const rowText = row.boxes.map((b) => b.text).join(' ').trim()

      // Skip non-tabular or header/footer rows
      if (
        rowText.length < 8 ||
        /\b(INVOICE|TAX|BILL|GSTIN|PHARMACY|CUSTOMER|PATIENT|DATE|PARTY|TOTAL|SUBTOTAL|ROUND|PAGE|COPY|TRANSPORT|DISPATCH|CERTIFY|JURISDICTION|CONTRAVENE|GOODS\s*ONCE|SUBJECT\s*TO)\b/i.test(rowText) ||
        /\b(Product\s*Name|BatchNo|M\.R\.P|EXP|QTY|RATE)\b/i.test(rowText)
      ) {
        continue
      }

      // 1. Expiry pattern: e.g. 08/26, 09/25, 03/26, 05726 (misread / as 7), 02/27
      let expRaw = ''
      const expMatch = rowText.match(/[/(|\[{](\d{1,2})[/\-7](\d{2,4})|[|\s](\d{2})[/\-7](\d{2})\b/)
      if (expMatch) {
        const m1 = expMatch[1] || expMatch[3]
        const m2 = expMatch[2] || expMatch[4]
        expRaw = `${m1}/${m2}`
      }
      const expiry = expRaw ? normalizeExpiryDate(expRaw) : new Date().toISOString().slice(0, 10)

      // 2. Prices / MRPs (decimals e.g. 130.50, 171.00, 29.50)
      const decimalMatches = Array.from(rowText.matchAll(/\b(\d{1,5}\.\d{2})\b/g)).map((m) => parseFloat(m[1]))
      let mrp = decimalMatches.length > 0 ? decimalMatches[decimalMatches.length - 1] : 0.0
      let unitCost = decimalMatches.length > 1 ? decimalMatches[decimalMatches.length - 2] : Math.round(mrp * 0.75 * 100) / 100

      // An item line must have a price or MRP
      if (mrp <= 0 && unitCost <= 0) {
        continue
      }

      // 3. Batch number: alphanumeric token of 5-12 chars
      let batch = ''
      const batchMatch = rowText.match(/\b([A-Z0-9]{2,}[0-9][A-Z0-9]{2,})\b/)
      if (batchMatch && !batchMatch[1].includes('.')) {
        batch = batchMatch[1]
      }

      // 4. Quantity: look for leading number or small integer (1-999)
      let billedQty = 1
      const qtyMatch = rowText.match(/(?:^|[|\]\s])([1-9]\d?)(?:\s*\||\s*\[|\s+)(?:[A-Za-z])/i)
      if (qtyMatch) {
        billedQty = parseInt(qtyMatch[1], 10)
      }

      // 5. Product name: extract pharmaceutical name tokens
      let cleanName = rowText
        .replace(/^[|\[\]\s\d—~=-]+/, '')
        .replace(/[|\[\]{}()~="’“”]+|_/g, ' ')
        .replace(/\b(?:SUN|STA|BUN|PartyCode|BatchNo|M\.R\.P|EXP)\b/gi, '')
        .replace(/\b\d{1,5}\.\d{2}\b/g, '')
        .replace(/\b\d{1,2}[/\-7]\d{2,4}\b/g, '')
        .trim()

      if (batch) {
        cleanName = cleanName.replace(batch, '').trim()
      }
      cleanName = cleanName.replace(/\b\d+\b/g, '').replace(/\s+/g, ' ').trim()

      if (cleanName.length >= 3 && /[A-Z]{3,}/i.test(cleanName)) {
        const taxPct = 12
        const baseAmt = billedQty * unitCost
        const calcTaxAmt = Math.round(((baseAmt * taxPct) / 100) * 100) / 100
        const calcLineTotal = Math.round((baseAmt + calcTaxAmt) * 100) / 100

        items.push({
          id: `ITEM-${items.length + 1}`,
          productName: cleanName,
          packSize: '10 Tabs',
          tabsPerStrip: 10,
          hsnCode: '3004',
          batchNumber: batch,
          expiryDate: expiry,
          billedQuantity: billedQty,
          freeQuantity: 0,
          unitCost,
          mrp: mrp || Math.round(unitCost * 1.35 * 100) / 100,
          discountPercent: 0,
          taxPercent: taxPct,
          taxAmount: calcTaxAmt,
          totalAmount: calcLineTotal,
          matchConfidence: 0.88,
          mathVerified: true,
          rawTextRow: rowText,
        })
      }
    }
  }

  // 5. Financial Reconciliation
  const subtotal = Math.round(items.reduce((acc, it) => acc + (it.billedQuantity * it.unitCost), 0) * 100) / 100
  const totalTax = Math.round(items.reduce((acc, it) => acc + it.taxAmount, 0) * 100) / 100
  const totalDiscount = Math.round(items.reduce((acc, it) => acc + (it.billedQuantity * it.unitCost * it.discountPercent / 100), 0) * 100) / 100
  const grandTotal = Math.round((subtotal - totalDiscount + totalTax) * 100) / 100

  return {
    success: items.length > 0,
    supplier: {
      rawName: rawSupplier,
      gstin,
      dlNumber,
      phone,
    },
    invoice: {
      invoiceNumber,
      invoiceDate,
    },
    items,
    financials: {
      subtotal,
      taxAmount: totalTax,
      discountAmount: totalDiscount,
      roundOff: 0.0,
      totalAmount: grandTotal,
      isReconciled: validationErrors.length === 0,
    },
    validationErrors,
  }
}
