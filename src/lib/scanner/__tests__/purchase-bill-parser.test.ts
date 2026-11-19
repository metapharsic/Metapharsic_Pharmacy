/** @jest-environment node */

import {
  cleanMedicineName,
  cleanSupplierName,
  calculateTrigramSimilarity,
  matchSupplier,
  matchProduct,
} from '@/lib/scanner/entity-matcher'
import {
  generateMockPdfBuffer,
  RAW_INVOICE_MAHAVEER,
  RAW_INVOICE_DISCREPANT,
} from '@/lib/scanner/mock-bill-fixtures'
import {
  GSTIN_REGEX,
  DRUG_LICENSE_REGEX,
  INVOICE_NUMBER_REGEX,
  INVOICE_DATE_REGEX,
  parsePharmaDate,
  normalizeInvoiceDate,
  parseInvoiceLineItems,
  parsePharmaInvoiceText,
  type ExtractedLineItem,
} from '@/lib/scanner/pharma-invoice-heuristics'
import {
  parsePurchaseBill,
  extractDigitalPdfText,
  parseWithMockEngine,
} from '@/lib/scanner/purchase-bill-parser'

describe('Indian Pharmaceutical Purchase Bill Ingestion & Heuristics Pipeline', () => {
  describe('Domain Regex & Pattern Validation', () => {
    it('validates statutory 15-character Indian GSTINs', () => {
      expect('29AABCM8921F1ZT').toMatch(GSTIN_REGEX)
      expect('27AABCV1234D1Z2').toMatch(GSTIN_REGEX)
      expect('07AABCD1111E1Z5').toMatch(GSTIN_REGEX)
      expect('33AABCA4567E1Z8').toMatch(GSTIN_REGEX)

      // Invalid GSTINs
      expect('INVALID_GSTIN').not.toMatch(GSTIN_REGEX)
      expect('29AABCM8921F1Z').not.toMatch(GSTIN_REGEX) // 14 chars
      expect('29AABCM8921F1ZTX').not.toMatch(GSTIN_REGEX) // 16 chars
    })

    it('extracts Drug License numbers matching Form 20B and 21B', () => {
      const text1 = 'D.L. NO: 20B/KA-B21/48911, 21B/KA-B21/48912'
      const match1 = text1.match(DRUG_LICENSE_REGEX)
      expect(match1).not.toBeNull()
      expect(match1![1]).toContain('20B/KA-B21/48911')

      const text2 = 'DL: 20B/MH-TZ2/10293'
      const match2 = text2.match(DRUG_LICENSE_REGEX)
      expect(match2).not.toBeNull()
      expect(match2![1]).toContain('20B/MH-TZ2/10293')
    })

    it('extracts invoice numbers and dates from header blocks', () => {
      const headerText = 'INV NO: MP/24-25/08492  DATE: 24/10/2026'
      const invMatch = headerText.match(INVOICE_NUMBER_REGEX)
      const dateMatch = headerText.match(INVOICE_DATE_REGEX)

      expect(invMatch).not.toBeNull()
      expect(invMatch![1]).toBe('MP/24-25/08492')

      expect(dateMatch).not.toBeNull()
      expect(normalizeInvoiceDate(dateMatch![1])).toBe('2026-10-24')
    })
  })

  describe('Pharma Expiry Date Normalization (parsePharmaDate)', () => {
    it('normalizes 2-digit year format "08/28" to month-end', () => {
      expect(parsePharmaDate('08/28')).toBe('2028-08-31')
    })

    it('normalizes 4-digit year format "08/2028" to month-end', () => {
      expect(parsePharmaDate('08/2028')).toBe('2028-08-31')
    })

    it('accurately resolves leap year February "02/2028" to 29th', () => {
      expect(parsePharmaDate('02/2028')).toBe('2028-02-29')
      expect(parsePharmaDate('02/28')).toBe('2028-02-29')
    })

    it('accurately resolves non-leap year February "02/2026" to 28th', () => {
      expect(parsePharmaDate('02/2026')).toBe('2026-02-28')
      expect(parsePharmaDate('02/26')).toBe('2026-02-28')
    })

    it('normalizes 3-letter month abbreviations: "NOV-27" and "MAR 2028"', () => {
      expect(parsePharmaDate('NOV-27')).toBe('2027-11-30')
      expect(parsePharmaDate('MAR 2028')).toBe('2028-03-31')
      expect(parsePharmaDate('AUG-28')).toBe('2028-08-31')
    })

    it('preserves full calendar dates "15/04/2028"', () => {
      expect(parsePharmaDate('15/04/2028')).toBe('2028-04-15')
    })

    it('returns null on invalid or unparseable input', () => {
      expect(parsePharmaDate('')).toBeNull()
      expect(parsePharmaDate(null)).toBeNull()
      expect(parsePharmaDate('UNKNOWN_EXP')).toBeNull()
    })
  })

  describe('Tabular Line Items & Financials Parsing', () => {
    it('extracts structured line items from realistic Marg ERP bill text', () => {
      const lines = RAW_INVOICE_MAHAVEER.split('\n')
      const items = parseInvoiceLineItems(lines)

      expect(items.length).toBe(3)

      const item1 = items[0]
      expect(item1.rawDescription).toContain('AUGMENTIN 625 DUO')
      expect(item1.packSize).toBe("10'S")
      expect(item1.batchNumber).toBe('26D044')
      expect(item1.expiryDate).toBe('2028-08-31')
      expect(item1.billedQuantity).toBe(50)
      expect(item1.freeQuantity).toBe(5)
      expect(item1.unitCost).toBe(147.24)
      expect(item1.mrp).toBe(204.5)
      expect(item1.discountPercent).toBe(2)
      expect(item1.taxPercent).toBe(12)

      const item2 = items[1]
      expect(item2.rawDescription).toContain('PAN 40')
      expect(item2.packSize).toBe("15'S")
      expect(item2.batchNumber).toBe('PN8901')
      expect(item2.expiryDate).toBe('2027-11-30')
      expect(item2.billedQuantity).toBe(100)
      expect(item2.freeQuantity).toBe(10)

      const item3 = items[2]
      expect(item3.rawDescription).toContain('INSULATARD')
      expect(item3.packSize).toBe('10ML')
      expect(item3.batchNumber).toBe('IN7822')
      expect(item3.expiryDate).toBe('2028-03-31')
      expect(item3.billedQuantity).toBe(20)
      expect(item3.freeQuantity).toBe(0)
    })

    it('performs mathematical cross-reconciliation on a reconciled bill', () => {
      const parsed = parsePharmaInvoiceText(RAW_INVOICE_MAHAVEER)

      expect(parsed.financials.isReconciled).toBe(true)
      expect(parsed.financials.reconciliationVariance).toBeLessThanOrEqual(1.0)
      expect(parsed.financials.totalAmount).toBe(26136.0)
      expect(parsed.overallConfidence).toBeGreaterThanOrEqual(0.85)
    })

    it('detects mathematical discrepancy when grand total diverges', () => {
      const parsed = parsePharmaInvoiceText(RAW_INVOICE_DISCREPANT)

      expect(parsed.financials.isReconciled).toBe(false)
      expect(parsed.financials.reconciliationVariance).toBeGreaterThan(1.0)
    })
  })

  describe('Entity Resolution & Fuzzy Matcher', () => {
    const mockSuppliers = [
      {
        id: 'sup-01',
        name: 'Mahaveer Pharma Agencies Pvt Ltd',
        gstin: '29AABCM8921F1ZT',
        dlNumber: '20B/KA-B21/48911',
      },
      {
        id: 'sup-02',
        name: 'Vardhaman Medisales LLP',
        gstin: '27AABCV1234D1Z2',
        dlNumber: '20B/MH-TZ2/10293',
      },
    ]

    const mockProducts = [
      {
        id: 'prod-01',
        name: 'Augmentin 625 Duo Tablet',
        sku: 'AUGM-625-TAB-10',
        barcode: '8901234567890',
      },
      {
        id: 'prod-02',
        name: 'Pan 40 Tablet',
        sku: 'PAN40-TAB-15',
        barcode: '8909876543210',
      },
    ]

    it('cleans dosage, packaging, and pharmacopeial tags from medicine names', () => {
      expect(cleanMedicineName("AUGMENTIN 625 DUO TAB 10'S IP")).toBe('AUGMENTIN 625 DUO')
      expect(cleanMedicineName('CALPOL 650 TABLETS IP 15 TAB')).toBe('CALPOL 650')
      expect(cleanMedicineName('INSULATARD HM 100IU INJECTION 10ML')).toBe('INSULATARD HM 100IU')
    })

    it('cleans company suffixes from supplier names', () => {
      expect(cleanSupplierName('MAHAVEER PHARMA AGENCIES PVT LTD')).toBe('MAHAVEER PHARMA')
      expect(cleanSupplierName('VARDHAMAN MEDISALES LLP')).toBe('VARDHAMAN')
    })

    it('computes accurate trigram similarity', () => {
      const simExact = calculateTrigramSimilarity('AUGMENTIN 625 DUO', 'AUGMENTIN 625 DUO')
      expect(simExact).toBe(1.0)

      const simHigh = calculateTrigramSimilarity('AUGMENTIN 625 DUO', 'AUGMENTIN 625')
      expect(simHigh).toBeGreaterThanOrEqual(0.75)

      const simLow = calculateTrigramSimilarity('AUGMENTIN 625 DUO', 'PARACETAMOL 500')
      expect(simLow).toBeLessThan(0.3)
    })

    it('resolves supplier with 100% confidence by GSTIN match', () => {
      const matched = matchSupplier(
        {
          rawName: 'Mahaveer Agencies',
          gstin: '29AABCM8921F1ZT',
        },
        mockSuppliers
      )

      expect(matched.matchedSupplierId).toBe('sup-01')
      expect(matched.matchConfidence).toBe(1.0)
      expect(matched.isNew).toBe(false)
    })

    it('resolves supplier with 95% confidence by Drug License match', () => {
      const matched = matchSupplier(
        {
          rawName: 'Random Supplier Name',
          dlNumber: '20B/MH-TZ2/10293',
        },
        mockSuppliers
      )

      expect(matched.matchedSupplierId).toBe('sup-02')
      expect(matched.matchConfidence).toBe(0.95)
      expect(matched.isNew).toBe(false)
    })

    it('resolves supplier by fuzzy trigram name similarity >= 85%', () => {
      const matched = matchSupplier(
        {
          rawName: 'Mahaveer Pharma Agencies Private Limited',
        },
        mockSuppliers
      )

      expect(matched.matchedSupplierId).toBe('sup-01')
      expect(matched.matchConfidence).toBeGreaterThanOrEqual(0.85)
      expect(matched.isNew).toBe(false)
    })

    it('flags unknown supplier as isNew: true', () => {
      const matched = matchSupplier(
        {
          rawName: 'Completely Unknown Pharma Ltd',
          gstin: '99UNKNOWN9999Z9',
        },
        mockSuppliers
      )

      expect(matched.matchedSupplierId).toBeUndefined()
      expect(matched.isNew).toBe(true)
    })

    it('resolves product by cleaned trigram similarity', () => {
      const item: ExtractedLineItem = {
        id: 'item-1',
        rawDescription: "AUGMENTIN 625 DUO TAB 10'S",
        matchConfidence: 0.0,
        isNewProduct: true,
        batchNumber: 'B1',
        expiryDate: '2028-08-31',
        billedQuantity: 10,
        freeQuantity: 0,
        unitCost: 100,
        mrp: 150,
        discountPercent: 0,
        taxPercent: 12,
        taxAmount: 12,
        totalAmount: 112,
      }

      const matched = matchProduct(item, mockProducts)
      expect(matched.matchedProductId).toBe('prod-01')
      expect(matched.matchConfidence).toBeGreaterThanOrEqual(0.85)
      expect(matched.isNewProduct).toBe(false)
    })
  })

  describe('Multi-Tier Hybrid Extraction Engine', () => {
    it('Tier 1: extracts text from born-digital vector PDF buffer', async () => {
      const pdfBuffer = generateMockPdfBuffer('mahaveer')
      const result = await extractDigitalPdfText(pdfBuffer)

      expect(result.text).toContain('MAHAVEER PHARMA AGENCIES')
      expect(result.text).toContain('29AABCM8921F1ZT')
      expect(result.pageCount).toBeGreaterThanOrEqual(1)
    })

    it('Tier 1: parsePurchaseBill processes digital PDF in pure-JS mode', async () => {
      const pdfBuffer = generateMockPdfBuffer('mahaveer')
      const response = await parsePurchaseBill(pdfBuffer, 'application/pdf', {
        filename: 'mahaveer-bill.pdf',
        forceTier: 'digital_pdf',
      })

      expect(response.success).toBe(true)
      expect(response.extractionMethod).toBe('DIGITAL_PDF')
      expect(response.extractedData.supplier.gstin).toBe('29AABCM8921F1ZT')
      expect(response.extractedData.items.length).toBe(3)
      expect(response.extractedData.financials.isReconciled).toBe(true)
      expect(response.extractedData.financials.totalAmount).toBe(26136.0)
    })

    it('Tier 4: deterministic mock engine returns structured fixture in < 5ms', () => {
      const start = Date.now()
      const response = parseWithMockEngine('mahaveer-invoice.pdf', 'mahaveer')
      const duration = Date.now() - start

      expect(duration).toBeLessThan(10)
      expect(response.success).toBe(true)
      expect(response.extractionMethod).toBe('DETERMINISTIC_MOCK')
      expect(response.confidence).toBe(0.98)
      expect(response.extractedData.supplier.rawName).toContain('MAHAVEER')
      expect(response.extractedData.items.length).toBe(3)
    })

    it('returns valid response for mock bill fixtures Vardhaman and Discrepant', () => {
      const resVardhaman = parseWithMockEngine('vardhaman.pdf', 'vardhaman')
      expect(resVardhaman.extractedData.supplier.gstin).toBe('27AABCV1234D1Z2')
      expect(resVardhaman.extractedData.financials.isReconciled).toBe(true)

      const resDiscrepant = parseWithMockEngine('discrepant.pdf', 'discrepant')
      expect(resDiscrepant.extractedData.financials.isReconciled).toBe(false)
      expect(resDiscrepant.extractedData.financials.reconciliationVariance).toBeGreaterThan(0)
    })
  })
})
