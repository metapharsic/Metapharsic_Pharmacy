import { parsePharmaDate, parseGs1DataMatrix, processPharmaOcrText } from '@/lib/scanner/pharma-ocr-engine'

describe('Pharma OCR & Neural Entity Recognition Engine', () => {
  describe('parsePharmaDate', () => {
    it('parses "08/2028" format to end of month', () => {
      expect(parsePharmaDate('08/2028')).toBe('2028-08-31')
    })

    it('parses "08/28" 2-digit year format', () => {
      expect(parsePharmaDate('08/28')).toBe('2028-08-31')
    })

    it('parses named month format "MAR 2028"', () => {
      expect(parsePharmaDate('MAR 2028')).toBe('2028-03-31')
    })

    it('returns null on invalid input', () => {
      expect(parsePharmaDate('invalid')).toBeNull()
    })
  })

  describe('parseGs1DataMatrix', () => {
    it('decodes GTIN, batch, and expiry from GS1 string', () => {
      const gs1 = '(01)08901234567890(17)280831(10)LOT1234'
      const res = parseGs1DataMatrix(gs1)
      expect(res.gtin).toBe('08901234567890')
      expect(res.batch).toBe('LOT1234')
      expect(res.expiry).toBe('2028-08-31')
    })
  })

  describe('processPharmaOcrText', () => {
    it('extracts metadata from an Alu-Alu strip text', () => {
      const raw = `AUGMENTIN 625 DUO
Amoxicillin and Potassium Clavulanate Tablets IP
B.No. 26D044
MFD. 09/2025
EXP. 08/2028
M.R.P. Rs. 204.50
10 Tablets
SCHEDULE H1 PRESCRIPTION DRUG - CAUTION
GlaxoSmithKline Pharmaceuticals Ltd.`

      const { entity, confidence } = processPharmaOcrText(raw, 'ALU_ALU')

      expect(entity.brandName).toBe('AUGMENTIN 625 DUO')
      expect(entity.genericComposition).toContain('Amoxicillin')
      expect(entity.batchNumber).toBe('26D044')
      expect(entity.expiryDate).toBe('2028-08-31')
      expect(entity.mrp).toBe(204.5)
      expect(entity.tabsPerStrip).toBe(10)
      expect(entity.drugSchedule).toBe('H1')
      expect(confidence.overall).toBeGreaterThanOrEqual(80)
    })

    it('extracts metadata from a Blister pack text', () => {
      const raw = `CALPOL 650
Paracetamol Tablets IP 650 mg
Batch: CP-9921
EXP: 03/2028
MRP ₹ 34.00
15 Tablets`

      const { entity, confidence } = processPharmaOcrText(raw, 'BLISTER')

      expect(entity.brandName).toBe('CALPOL 650')
      expect(entity.batchNumber).toBe('CP-9921')
      expect(entity.expiryDate).toBe('2028-03-31')
      expect(entity.mrp).toBe(34.0)
      expect(entity.tabsPerStrip).toBe(15)
      expect(confidence.overall).toBeGreaterThanOrEqual(80)
    })
  })
})
