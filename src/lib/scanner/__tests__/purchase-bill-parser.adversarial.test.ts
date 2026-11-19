/** @jest-environment node */

import {
  GSTIN_REGEX,
  DRUG_LICENSE_REGEX,
  parsePharmaDate,
  parseInvoiceLineItems,
  parsePharmaInvoiceText,
  reconcileFinancials,
  type ExtractedLineItem,
} from '@/lib/scanner/pharma-invoice-heuristics'
import {
  extractDigitalPdfText,
  parsePurchaseBill,
} from '@/lib/scanner/purchase-bill-parser'

describe('Adversarial Stress Testing & Boundary Verification (Milestone M1)', () => {
  // ─────────────────────────────────────────────────────────────
  // 1. Corrupted PDF Streams & Malformed Buffers
  // ─────────────────────────────────────────────────────────────
  describe('Corrupted PDF Streams & Buffer Fault Tolerance', () => {
    it('safely handles an empty buffer without throwing', async () => {
      const emptyBuf = Buffer.alloc(0)
      const res = await extractDigitalPdfText(emptyBuf)
      expect(res).toBeDefined()
      expect(res.text).toBe('')
      expect(res.pageCount).toBe(1)
    })

    it('safely handles non-PDF garbage buffer declared as PDF', async () => {
      const garbage = Buffer.from('NOT A PDF FILE AT ALL - RANDOM BYTES \x00\xFF\xFE\x12\x34\x56')
      const res = await extractDigitalPdfText(garbage)
      expect(res).toBeDefined()
      expect(res.text).toBe('')
    })

    it('safely handles corrupted flate stream without crashing zlib', async () => {
      const corruptedStreamPdf = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Length 20 /Filter /FlateDecode >>\nstream\n' +
          'CORRUPTED_NON_ZLIB_STREAM_BYTES_HERE\n' +
          'endstream\nendobj\n%%EOF'
      )
      // Must not throw unhandled zlib exception
      await expect(extractDigitalPdfText(corruptedStreamPdf)).resolves.not.toThrow()
      const res = await extractDigitalPdfText(corruptedStreamPdf)
      expect(res.text).toBeDefined()
    })

    it('handles truncated PDF header without EOF marker', async () => {
      const truncated = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\n')
      const res = await extractDigitalPdfText(truncated)
      expect(res.pageCount).toBe(1)
    })

    it('parsePurchaseBill safely processes corrupted buffer via fallbacks without crashing', async () => {
      const corruptedBuf = Buffer.from('%PDF-1.4\nCorrupted stream data\x00\x01\x02')
      const response = await parsePurchaseBill(corruptedBuf, 'application/pdf', {
        filename: 'corrupted-invoice.pdf',
        forceTier: 'digital_pdf',
      })

      expect(response).toBeDefined()
      expect(response.success).toBe(true)
      expect(response.extractedData).toBeDefined()
      expect(response.extractedData.items).toBeInstanceOf(Array)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 2. Truncated Text Blocks, Bizarre Whitespace & Multi-Page
  // ─────────────────────────────────────────────────────────────
  describe('Truncated Text Blocks & Bizarre Whitespace Handling', () => {
    it('handles empty string and pure whitespace without throwing', () => {
      expect(() => parsePharmaInvoiceText('')).not.toThrow()
      const emptyResult = parsePharmaInvoiceText('')
      expect(emptyResult.items).toEqual([])
      expect(emptyResult.financials.isReconciled).toBe(false)
      expect(emptyResult.overallConfidence).toBe(0.0)

      const whitespaceResult = parsePharmaInvoiceText('   \n\t\t\r\n   \u00A0 \u2003  \n')
      expect(whitespaceResult.items).toEqual([])
      expect(whitespaceResult.financials.isReconciled).toBe(false)
      expect(whitespaceResult.overallConfidence).toBe(0.0)
    })

    it('handles mixed carriage returns, tabs, and non-breaking spaces in line items', () => {
      const rawText = `
TAX INVOICE\r
DISTRIBUTOR: ADVANCED HEALTHCARE LLP\tINV NO: AH-2026-999\r\n
GSTIN: 29AABCM8921F1ZT\t\tD.L. NO: 20B/KA-B21/48911\t\tDATE: 12/10/2026\r\n
--------------------------------------------------------------------------------\r\n
ITEM DESCRIPTION\t\tPACK\tHSN\tBATCH\tEXPIRY\tQTY\tFREE\tRATE\tMRP\tDISC%\tGST%\tTOTAL\r\n
AZITHROMYCIN 500MG\t\t3'S\t3004\tAZI99\t08/28\t20\t2\t120.00\t180.00\t5.00\t12%\t2500.00\r\n
--------------------------------------------------------------------------------\r\n
SUB-TOTAL: 2500.00\r\n
TOTAL TAX: 300.00\r\n
GRAND TOTAL: 2800.00\r\n
`
      const parsed = parsePharmaInvoiceText(rawText)
      expect(parsed.supplier.gstin).toBe('29AABCM8921F1ZT')
      expect(parsed.items.length).toBe(1)
      expect(parsed.items[0].batchNumber).toBe('AZI99')
      expect(parsed.items[0].expiryDate).toBe('2028-08-31')
      expect(parsed.items[0].billedQuantity).toBe(20)
      expect(parsed.items[0].freeQuantity).toBe(2)
    })

    it('correctly parses line items across multiple pages when intermediate SUB-TOTAL occurs', () => {
      // In multi-page bills, Page 1 often has "SUB-TOTAL C/F" or similar totals
      const multiPageText = `
TAX INVOICE
MAHAVEER PHARMA AGENCIES PVT LTD           INV: MP-101
GSTIN: 29AABCM8921F1ZT                     DATE: 10/10/2026
--------------------------------------------------------------------------------
ITEM DESCRIPTION        PACK   HSN   BATCH   EXPIRY   QTY  FREE   RATE     MRP   DISC% GST%
AUGMENTIN 625 DUO       10'S   3004  BAT01   08/28     50     0  150.00  200.00  0.00  12%
SUB-TOTAL PAGE 1: 7500.00
--------------------------------- PAGE 2 ---------------------------------------
PAN 40 TABLETS          15'S   3004  BAT02   11/27     40     0  100.00  140.00  0.00  12%
GRAND TOTAL: 11500.00
`
      const parsed = parsePharmaInvoiceText(multiPageText)
      // Intermediate SUB-TOTAL continues loop, correctly capturing Page 2 line items
      expect(parsed.items.length).toBe(2)
      expect(parsed.items[0].batchNumber).toBe('BAT01')
      expect(parsed.items[1].batchNumber).toBe('BAT02')
      expect(parsed.items[1].rawDescription).toContain('PAN 40 TABLETS')
      expect(parsed.items[1].billedQuantity).toBe(40)
      expect(parsed.items[1].unitCost).toBe(100.0)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 3. Statutory GSTIN, Drug License & Case Variations
  // ─────────────────────────────────────────────────────────────
  describe('Statutory Tax Identifiers & Case Insensitivity', () => {
    it('accepts valid 15-character statutory GSTINs with mixed or lowercase characters', () => {
      expect('29aabcm8921f1zt').toMatch(GSTIN_REGEX)
      expect('27AABCV1234D1Z2').toMatch(GSTIN_REGEX)

      const text = 'Supplier gstin: 29aabcm8921f1zt Invoice'
      const parsed = parsePharmaInvoiceText(text)
      expect(parsed.supplier.gstin).toBe('29AABCM8921F1ZT') // Normalized to uppercase
    })

    it('rejects structurally invalid GSTINs', () => {
      // Missing 14th 'Z' character (Indian GSTIN rule: 14th char is almost always 'Z')
      expect('29AABCM8921F1AT').not.toMatch(GSTIN_REGEX)

      // Invalid length
      expect('29AABCM8921F1Z').not.toMatch(GSTIN_REGEX)
      expect('29AABCM8921F1ZT99').not.toMatch(GSTIN_REGEX)

      // Invalid state code (must start with 2 digits)
      expect('XXAABCM8921F1ZT').not.toMatch(GSTIN_REGEX)
    })

    it('observes that GSTIN_REGEX is format-only and does not verify Mod 36 checksum', () => {
      // Valid format but invalid checksum character '9' instead of 'T'
      const invalidChecksumGstin = '29AABCM8921F1Z9'
      // GSTIN_REGEX accepts it because it matches the structural 15-char regex
      expect(invalidChecksumGstin).toMatch(GSTIN_REGEX)
    })

    it('handles mixed-case and varied Drug License formats', () => {
      const variations = [
        'd.l. no: 20b/ka-b21/48911',
        'Lic. No. 20B/MH-TZ2/10293',
        'FORM 20B: 20B/DL-1234',
        'D/L: 20B/TN-CH1/5555',
      ]
      for (const v of variations) {
        const match = v.match(DRUG_LICENSE_REGEX)
        expect(match).not.toBeNull()
      }
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 4. Exotic Expiry Formats & Calendar Boundary Cases
  // ─────────────────────────────────────────────────────────────
  describe('Exotic Expiry Formats & Calendar Boundary Cases (parsePharmaDate)', () => {
    it('accurately resolves leap year February 02/28 and 02/2028 to 29th', () => {
      expect(parsePharmaDate('02/28')).toBe('2028-02-29')
      expect(parsePharmaDate('02/2028')).toBe('2028-02-29')
      expect(parsePharmaDate('02-28')).toBe('2028-02-29')
      expect(parsePharmaDate('FEB 2028')).toBe('2028-02-29')
      expect(parsePharmaDate('FEB-28')).toBe('2028-02-29')
    })

    it('accurately resolves non-leap year February 02/26 and 02/2026 to 28th', () => {
      expect(parsePharmaDate('02/26')).toBe('2026-02-28')
      expect(parsePharmaDate('02/2026')).toBe('2026-02-28')
      expect(parsePharmaDate('FEB-26')).toBe('2026-02-28')
      expect(parsePharmaDate('FEB 2026')).toBe('2026-02-28')
    })

    it('accurately resolves 31-MAR-2028 and other 3-letter month formats', () => {
      expect(parsePharmaDate('31-MAR-2028')).toBe('2028-03-31')
      expect(parsePharmaDate('MAR-2028')).toBe('2028-03-31')
      expect(parsePharmaDate('MAR 2028')).toBe('2028-03-31')
      expect(parsePharmaDate('31/03/2028')).toBe('2028-03-31')
    })

    it('accurately resolves 30-day months (e.g. April, June, Sept, Nov)', () => {
      expect(parsePharmaDate('04/28')).toBe('2028-04-30')
      expect(parsePharmaDate('06/2027')).toBe('2027-06-30')
      expect(parsePharmaDate('09/2028')).toBe('2028-09-30')
      expect(parsePharmaDate('11/2028')).toBe('2028-11-30')
    })

    it('safely rejects out-of-range months and years', () => {
      expect(parsePharmaDate('00/28')).toBeNull()
      expect(parsePharmaDate('13/28')).toBeNull()
      expect(parsePharmaDate('05/1990')).toBeNull() // Year < 2020
      expect(parsePharmaDate('05/2055')).toBeNull() // Year > 2045
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 5. Adversarial Line Item Boundary Conditions & Heuristic Bugs
  // ─────────────────────────────────────────────────────────────
  describe('Adversarial Line Item Boundaries & Financial Calculations', () => {
    it('handles 0% GST (tax-exempt medications)', () => {
      const line = "ORS ORAL SALTS 10'S 3004 ORS12 05/28 50 0 20.00 30.00 0.00 0% 1000.00"
      const items = parseInvoiceLineItems([
        'ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP DISC% GST% TOTAL',
        line,
      ])
      expect(items.length).toBe(1)
      expect(items[0].taxPercent).toBe(0)
      expect(items[0].taxAmount).toBe(0)
      expect(items[0].totalAmount).toBe(1000.0)
    })

    it('handles 28% luxury/device GST slab when discount is numeric', () => {
      const line = "SPECIAL DEVICE 1'S 9018 DEV99 10/28 10 0 1000.00 1500.00 0.00 28% 12800.00"
      const items = parseInvoiceLineItems([
        'ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP DISC% GST% TOTAL',
        line,
      ])
      expect(items.length).toBe(1)
      expect(items[0].taxPercent).toBe(28)
      expect(items[0].taxAmount).toBe(2800.0)
      expect(items[0].totalAmount).toBe(12800.0)
    })

    it('correctly resolves distinct discount % and tax % without collision when both use % signs', () => {
      // When a bill writes "5% 12%" or "0% 28%", both percentages are cleanly extracted in sequence
      const lineWithCollidingPercentages = "MEDICINE A 10'S 3004 B01 08/28 40 4 100.00 150.00 5% 12% 4256.00"
      const items = parseInvoiceLineItems([
        'ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP DISC% GST% TOTAL',
        lineWithCollidingPercentages,
      ])
      expect(items.length).toBe(1)
      expect(items[0].discountPercent).toBe(5)
      expect(items[0].taxPercent).toBe(12)
      expect(items[0].taxAmount).toBe(456.0)
      expect(items[0].totalAmount).toBe(4256.0)
    })

    it('handles 100% discount boundary condition without negative amount', () => {
      const line = "PROMO MED 10'S 3004 PR01 08/28 10 0 100.00 150.00 100.00 12% 0.00"
      const items = parseInvoiceLineItems([
        'ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP DISC% GST% TOTAL',
        line,
      ])
      expect(items.length).toBe(1)
      expect(items[0].discountPercent).toBe(100)
      expect(items[0].taxAmount).toBe(0)
      expect(items[0].totalAmount).toBe(0)
    })

    it('accurately parses 0 billed quantity with promotional free items', () => {
      // Promotional sample: 0 billed + 5 free
      const line = "PROMOTIONAL SAMPLE 10'S 3004 SAM01 08/28 0 5 0.00 0.00 0.00 0% 0.00"
      const items = parseInvoiceLineItems([
        'ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP DISC% GST% TOTAL',
        line,
      ])
      expect(items.length).toBe(1)
      expect(items[0].billedQuantity).toBe(0)
      expect(items[0].freeQuantity).toBe(5)
      expect(items[0].totalAmount).toBe(0)
    })

    it('accurately parses scheme syntax "50+5" without losing unitCost or MRP', () => {
      const line = "AUGMENTIN 625 10'S 3004 AUG01 08/28 50+5 140.00 200.00 12%"
      const items = parseInvoiceLineItems([
        'ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP DISC% GST% TOTAL',
        line,
      ])
      expect(items.length).toBe(1)
      expect(items[0].billedQuantity).toBe(50)
      expect(items[0].freeQuantity).toBe(5)
      expect(items[0].unitCost).toBe(140.0)
      expect(items[0].mrp).toBe(200.0)
      expect(items[0].taxPercent).toBe(12)
      expect(items[0].taxAmount).toBe(840.0)
      expect(items[0].totalAmount).toBe(7840.0)
    })

    it('does not confuse combination medicine dosage with free goods scheme', () => {
      const line = "ACECLOFENAC + PARACETAMOL 100+325 TAB 10'S 3004 B1 08/28 10 0 100.00 150.00 12% 1120.00"
      const items = parseInvoiceLineItems([
        'ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP DISC% GST% TOTAL',
        line,
      ])
      expect(items.length).toBe(1)
      expect(items[0].billedQuantity).toBe(10)
      expect(items[0].freeQuantity).toBe(0)
      expect(items[0].unitCost).toBe(100.0)
      expect(items[0].mrp).toBe(150.0)
      expect(items[0].taxPercent).toBe(12)
      expect(items[0].discountPercent).toBe(0)
      expect(items[0].totalAmount).toBe(1120.0)
    })

    it('correctly parses standard 6-column row omitting discount column without phantom discount injection', () => {
      const line = "AUGMENTIN 625 DUO 10'S 3004 BAT01 08/28 10 0 100.00 140.00 12% 1120.00"
      const items = parseInvoiceLineItems([
        'ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP GST% TOTAL',
        line,
      ])
      expect(items.length).toBe(1)
      expect(items[0].billedQuantity).toBe(10)
      expect(items[0].freeQuantity).toBe(0)
      expect(items[0].unitCost).toBe(100.0)
      expect(items[0].mrp).toBe(140.0)
      expect(items[0].discountPercent).toBe(0)
      expect(items[0].taxPercent).toBe(12)
      expect(items[0].taxAmount).toBe(120.0)
      expect(items[0].totalAmount).toBe(1120.0)

      const fullInvoiceText = `
        MAHAVEER PHARMA AGENCIES
        INVOICE NO: INV-6COL-001  DATE: 01/10/2026
        ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP GST% TOTAL
        ${line}
        SUBTOTAL: 1000.00
        TOTAL GST: 120.00
        GRAND TOTAL: 1120.00
      `
      const parsed = parsePharmaInvoiceText(fullInvoiceText)
      expect(parsed.items.length).toBe(1)
      expect(parsed.items[0].discountPercent).toBe(0)
      expect(parsed.items[0].totalAmount).toBe(1120.0)
      expect(parsed.financials.isReconciled).toBe(true)
      expect(parsed.financials.reconciliationVariance).toBe(0)
    })

    it('DEMONSTRATES LIMITATION: negative rates have minus sign stripped by sanitization', () => {
      const line = "CREDIT RETURN 10'S 3004 CR01 08/28 10 0 -100.00 -140.00 0.00 12% -1120.00"
      const items = parseInvoiceLineItems([
        'ITEM DESCRIPTION PACK HSN BATCH EXPIRY QTY FREE RATE MRP DISC% GST% TOTAL',
        line,
      ])
      expect(items.length).toBe(1)
      // Sanitizer replaces [^\d\.] which strips '-', making -100.00 into 100
      expect(items[0].unitCost).toBe(100)
    })

    it('reconciles financials with zero tax and large numbers without precision errors', () => {
      const mockItems: ExtractedLineItem[] = [
        {
          id: 'item-1',
          rawDescription: 'HIGH VALUE ONCOLOGY DRUG',
          matchConfidence: 0.95,
          isNewProduct: false,
          batchNumber: 'ONCO-01',
          expiryDate: '2028-12-31',
          billedQuantity: 100,
          freeQuantity: 0,
          unitCost: 25000.5,
          mrp: 32000.0,
          discountPercent: 5.0,
          taxPercent: 5.0,
          taxAmount: 118752.38,
          totalAmount: 2493799.88,
        },
      ]

      const text = `
SUB-TOTAL: 2375047.50
TOTAL TAX: 118752.38
GRAND TOTAL: 2493799.88
`
      const financials = reconcileFinancials(mockItems, text)
      expect(financials.isReconciled).toBe(true)
      expect(financials.reconciliationVariance).toBeLessThanOrEqual(1.0)
    })
  })
})
