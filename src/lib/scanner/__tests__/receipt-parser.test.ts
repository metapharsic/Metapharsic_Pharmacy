import { describe, it, expect } from 'vitest'
import { parseThermalReceipt } from '../receipt-parser'
import type { OcrBoundingBox } from '../deterministic-ocr-client'

describe('Zero-LLM Thermal Expense Receipt Parser', () => {
  it('extracts merchant header, GSTIN, date, and anchors on bottom totals and payment method', () => {
    const mockThermalBoxes: OcrBoundingBox[] = [
      { text: 'METRO PHARMA PHARMACY', confidence: 0.98, box: [50, 20, 250, 35], page: 1 },
      { text: '123 MG ROAD, BANGALORE', confidence: 0.95, box: [50, 40, 260, 55], page: 1 },
      { text: 'GSTIN: 29AAAAA0000A1Z5', confidence: 0.99, box: [50, 60, 270, 75], page: 1 },
      { text: 'TEL: 9876543210', confidence: 0.97, box: [50, 80, 200, 95], page: 1 },
      { text: 'BILL NO: RT-45019', confidence: 0.96, box: [50, 110, 220, 125], page: 1 },
      { text: 'DATE: 15/11/2026 14:32', confidence: 0.96, box: [50, 130, 240, 145], page: 1 },
      // Line items
      { text: 'PRINTER PAPER ROLL', confidence: 0.95, box: [50, 180, 200, 195], page: 1 },
      { text: '250.00', confidence: 0.98, box: [230, 180, 280, 195], page: 1 },
      { text: 'STATIONERY PACK', confidence: 0.95, box: [50, 200, 180, 215], page: 1 },
      { text: '150.00', confidence: 0.98, box: [230, 200, 280, 215], page: 1 },
      // Bottom Anchors
      { text: 'CGST 2.5% : 10.00', confidence: 0.94, box: [50, 250, 200, 265], page: 1 },
      { text: 'SGST 2.5% : 10.00', confidence: 0.94, box: [50, 270, 200, 285], page: 1 },
      { text: 'GRAND TOTAL: 420.00', confidence: 0.99, box: [50, 300, 250, 320], page: 1 },
      { text: 'PAID VIA: UPI GPAY', confidence: 0.98, box: [50, 330, 230, 345], page: 1 },
    ]

    const result = parseThermalReceipt(mockThermalBoxes)

    expect(result.success).toBe(true)
    expect(result.merchant.name).toBe('METRO PHARMA PHARMACY')
    expect(result.merchant.gstin).toBe('29AAAAA0000A1Z5')
    expect(result.receipt.receiptNumber).toBe('RT-45019')
    expect(result.financials.grandTotal).toBe(420.0)
    expect(result.financials.paymentMethod).toBe('UPI')
    expect(result.voucherPayload.amount).toBe(420.0)
    expect(result.voucherPayload.voucherType).toBe('PAYMENT')
  })
})
