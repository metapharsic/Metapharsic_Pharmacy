/**
 * Thermal Expense Receipt & Voucher Parser
 * Metapharsic Rx - Zero-LLM Architecture
 *
 * Designed specifically for single-column thermal slips (58mm / 80mm):
 * - Top lines: Merchant Header, Address, Phone, 15-char GSTIN.
 * - Mid lines: Date/Time, Receipt / Bill #.
 * - Bottom anchor scanner: GRAND TOTAL, NET AMOUNT, CASH, UPI, TAX.
 * - Pre-populates accounting Voucher for 1-click expense logging.
 */

import type { OcrBoundingBox } from './deterministic-ocr-client'
import { cleanOcrNumber, normalizeExpiryDate } from './spatial-table-reconstructor'

export interface ExpenseReceiptResult {
  success: boolean
  merchant: {
    name: string
    address?: string
    phone?: string
    gstin?: string
  }
  receipt: {
    receiptNumber: string
    date: string
    time?: string
  }
  financials: {
    subtotal: number
    cgstAmount: number
    sgstAmount: number
    totalTax: number
    discountAmount: number
    grandTotal: number
    paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'UNKNOWN'
  }
  items: Array<{
    description: string
    quantity: number
    amount: number
  }>
  voucherPayload: {
    voucherType: 'PAYMENT'
    narration: string
    amount: number
    date: string
  }
  rawLines: string[]
}

export function parseThermalReceipt(boxes: OcrBoundingBox[]): ExpenseReceiptResult {
  // 1. Sort strictly top-to-bottom by vertical coordinate (single column assumption)
  const sortedBoxes = [...boxes].sort((a, b) => a.box[1] - b.box[1])

  // Group tokens on the same horizontal line (within 6px)
  const lines: string[] = []
  let currentY = -1
  let currentLineTokens: string[] = []

  for (const b of sortedBoxes) {
    const yCenter = (b.box[1] + b.box[3]) / 2
    if (currentY === -1 || Math.abs(yCenter - currentY) <= 6) {
      currentLineTokens.push(b.text)
      currentY = yCenter
    } else {
      if (currentLineTokens.length > 0) {
        lines.push(currentLineTokens.join(' ').trim())
      }
      currentLineTokens = [b.text]
      currentY = yCenter
    }
  }
  if (currentLineTokens.length > 0) {
    lines.push(currentLineTokens.join(' ').trim())
  }

  const fullText = lines.join('\n')

  // 2. Merchant Header (Top 1–5 lines)
  let merchantName = 'Expense Merchant'
  let merchantAddress = ''
  let merchantPhone = ''

  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const l = lines[i].trim()
    if (l.length >= 3 && !/RECEIPT|BILL|TAX|INVOICE|WELCOME|THANK|ORDER/i.test(l)) {
      merchantName = l
      if (lines[i + 1] && !/GSTIN|DATE|PH/i.test(lines[i + 1])) {
        merchantAddress = lines[i + 1]
      }
      break
    }
  }

  // GSTIN
  let gstin: string | undefined
  const gstinMatch = fullText.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i)
  if (gstinMatch) gstin = gstinMatch[1].toUpperCase()

  // Phone
  const phoneMatch = fullText.match(/(?:PH|MOB|TEL)[\s.:#\-]+(?:\+91[\s-]*)?([6-9]\d{9})\b/i)
  if (phoneMatch) merchantPhone = phoneMatch[1]

  // Receipt / Bill No.
  let receiptNumber = `RCPT-${Date.now().toString().slice(-6)}`
  const rcptMatch = fullText.match(/(?:BILL|RCPT|RECEIPT|ORDER|SLIP|INV)(?:\s*(?:NO|NUMBER))?[\s.:#\-]+([A-Z0-9\-_]+)/i)
  if (rcptMatch) receiptNumber = rcptMatch[1].trim()

  // Date & Time
  let date = new Date().toISOString().slice(0, 10)
  const dateMatch = fullText.match(/\b(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})\b/)
  if (dateMatch) date = normalizeExpiryDate(dateMatch[1])

  let time: string | undefined
  const timeMatch = fullText.match(/\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\b/i)
  if (timeMatch) time = timeMatch[1].toUpperCase()

  // 3. Anchor Bottom Scan for Totals & Payment Method
  let grandTotal = 0.0
  let subtotal = 0.0
  let cgstAmount = 0.0
  let sgstAmount = 0.0
  let discountAmount = 0.0
  let paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'UNKNOWN' = 'UNKNOWN'

  // Scan lines from bottom upwards
  for (let idx = lines.length - 1; idx >= 0; idx--) {
    const line = lines[idx].trim()

    // Payment Method detection
    if (/UPI|GPAY|PHONEPE|PAYTM|BHIM/i.test(line)) paymentMethod = 'UPI'
    else if (/CASH/i.test(line) && paymentMethod === 'UNKNOWN') paymentMethod = 'CASH'
    else if (/CARD|VISA|MASTERCARD|RUPAY|POS\s*TRANSACTION/i.test(line)) paymentMethod = 'CARD'

    // Grand Total Anchor
    if (
      grandTotal === 0 &&
      /\b(GRAND\s*TOTAL|NET\s*TOTAL|NET\s*AMOUNT|TOTAL\s*DUE|AMOUNT\s*PAYABLE|PAID|TOTAL)\b/i.test(line)
    ) {
      const matchNum = line.match(/(?:TOTAL|NET|AMT|PAID|₹|Rs\.?)[\s:]*([0-9,]+(?:\.[0-9]{2})?)/i)
      if (matchNum) {
        grandTotal = cleanOcrNumber(matchNum[1])
      } else {
        // Look in next adjacent line for amount
        if (lines[idx + 1]) {
          const nextNum = lines[idx + 1].match(/([0-9,]+(?:\.[0-9]{2})?)/)
          if (nextNum) grandTotal = cleanOcrNumber(nextNum[1])
        }
      }
    }

    // Taxes
    if (cgstAmount === 0 && /\bCGST\b/i.test(line)) {
      const cMatch = line.match(/([0-9]+(?:\.[0-9]{2})?)/)
      if (cMatch) cgstAmount = cleanOcrNumber(cMatch[1])
    }
    if (sgstAmount === 0 && /\bSGST\b/i.test(line)) {
      const sMatch = line.match(/([0-9]+(?:\.[0-9]{2})?)/)
      if (sMatch) sgstAmount = cleanOcrNumber(sMatch[1])
    }
  }

  // Default subtotal
  subtotal = grandTotal > 0 ? grandTotal - (cgstAmount + sgstAmount) : 0

  return {
    success: grandTotal > 0 || merchantName !== 'Expense Merchant',
    merchant: {
      name: merchantName,
      address: merchantAddress,
      phone: merchantPhone,
      gstin,
    },
    receipt: {
      receiptNumber,
      date,
      time,
    },
    financials: {
      subtotal: Math.max(0, Math.round(subtotal * 100) / 100),
      cgstAmount,
      sgstAmount,
      totalTax: Math.round((cgstAmount + sgstAmount) * 100) / 100,
      discountAmount,
      grandTotal,
      paymentMethod,
    },
    items: [],
    voucherPayload: {
      voucherType: 'PAYMENT',
      narration: `Expense reimbursement for ${merchantName} (Bill #${receiptNumber}) on ${date}`,
      amount: grandTotal,
      date,
    },
    rawLines: lines,
  }
}
