import { describe, it, expect } from 'vitest'
import {
  clusterBoxesIntoRows,
  detectColumnAnchors,
  reconstructInvoiceFromBoxes,
  cleanOcrNumber,
  normalizeExpiryDate,
} from '../spatial-table-reconstructor'
import type { OcrBoundingBox } from '../deterministic-ocr-client'

describe('Zero-LLM Spatial Table Reconstructor & Math Validator', () => {
  describe('cleanOcrNumber', () => {
    it('repairs character misreads B->8, O->0, S->5, I->1', () => {
      expect(cleanOcrNumber('1B.50')).toBe(18.5)
      expect(cleanOcrNumber('1OO.OO')).toBe(100.0)
      expect(cleanOcrNumber('S0.00')).toBe(50.0)
      expect(cleanOcrNumber('I5.00')).toBe(15.0)
    })
  })

  describe('normalizeExpiryDate', () => {
    it('normalizes MM/YY to last day of month', () => {
      expect(normalizeExpiryDate('08/28')).toBe('2028-08-31')
      expect(normalizeExpiryDate('02/2026')).toBe('2026-02-28')
      expect(normalizeExpiryDate('2027-11-15')).toBe('2027-11-15')
    })
  })

  describe('Row clustering by Y-proximity (±8px)', () => {
    it('clusters boxes on approximately the same Y level into a single row', () => {
      const mockBoxes: OcrBoundingBox[] = [
        { text: 'AUGMENTIN 625', confidence: 0.98, box: [50, 100, 200, 115], page: 1 },
        { text: '3004', confidence: 0.95, box: [220, 103, 270, 116], page: 1 }, // diff Y = 3px
        { text: 'BAT123', confidence: 0.99, box: [290, 98, 350, 114], page: 1 },  // diff Y = 2px
        { text: 'NEXT LINE PRODUCT', confidence: 0.97, box: [50, 140, 210, 155], page: 1 }, // diff Y = 40px
      ]

      const rows = clusterBoxesIntoRows(mockBoxes, 8)
      expect(rows.length).toBe(2)
      expect(rows[0].boxes.length).toBe(3)
      expect(rows[1].boxes.length).toBe(1)
      expect(rows[0].boxes.map((b) => b.text)).toEqual(['AUGMENTIN 625', '3004', 'BAT123'])
    })
  })

  describe('Mathematical Line Item Validation', () => {
    it('validates and auto-heals calculated line totals', () => {
      const mockInvoiceBoxes: OcrBoundingBox[] = [
        // Header
        { text: 'VARDHMAN PHARMA DISTRIBUTORS', confidence: 0.99, box: [100, 20, 400, 40], page: 1 },
        { text: 'GSTIN: 29ABCDE1234F1Z5', confidence: 0.98, box: [100, 45, 300, 60], page: 1 },
        { text: 'INV NO: VP-9876', confidence: 0.97, box: [500, 45, 650, 60], page: 1 },
        // Table Columns Header
        { text: 'PRODUCT', confidence: 0.99, box: [50, 120, 150, 135], page: 1 },
        { text: 'HSN', confidence: 0.99, box: [180, 120, 220, 135], page: 1 },
        { text: 'BATCH', confidence: 0.99, box: [250, 120, 300, 135], page: 1 },
        { text: 'EXP', confidence: 0.99, box: [320, 120, 370, 135], page: 1 },
        { text: 'QTY', confidence: 0.99, box: [400, 120, 430, 135], page: 1 },
        { text: 'RATE', confidence: 0.99, box: [460, 120, 500, 135], page: 1 },
        { text: 'MRP', confidence: 0.99, box: [530, 120, 570, 135], page: 1 },
        { text: 'AMOUNT', confidence: 0.99, box: [600, 120, 660, 135], page: 1 },
        // Row 1: Augmentin 625, HSN 3004, Batch A1, Exp 08/28, Qty 10, Rate 100.00, MRP 150.00, Amount 1120.00 (with 12% GST)
        { text: 'AUGMENTIN 625MG TAB', confidence: 0.99, box: [50, 150, 170, 165], page: 1 },
        { text: '3004', confidence: 0.99, box: [180, 150, 220, 165], page: 1 },
        { text: 'LOT456', confidence: 0.99, box: [250, 150, 300, 165], page: 1 },
        { text: '08/28', confidence: 0.99, box: [320, 150, 370, 165], page: 1 },
        { text: '10', confidence: 0.99, box: [400, 150, 420, 165], page: 1 },
        { text: '100.00', confidence: 0.99, box: [460, 150, 500, 165], page: 1 },
        { text: '150.00', confidence: 0.99, box: [530, 150, 570, 165], page: 1 },
        { text: '1120.00', confidence: 0.99, box: [600, 150, 650, 165], page: 1 },
      ]

      const result = reconstructInvoiceFromBoxes(mockInvoiceBoxes)
      expect(result.success).toBe(true)
      expect(result.supplier.gstin).toBe('29ABCDE1234F1Z5')
      expect(result.invoice.invoiceNumber).toBe('VP-9876')
      expect(result.items.length).toBe(1)
      expect(result.items[0].productName).toBe('AUGMENTIN 625MG TAB')
      expect(result.items[0].batchNumber).toBe('LOT456')
      expect(result.items[0].billedQuantity).toBe(10)
      expect(result.items[0].unitCost).toBe(100.0)
      expect(result.items[0].mathVerified).toBe(true)
      expect(result.financials.isReconciled).toBe(true)
    })
  })
})
