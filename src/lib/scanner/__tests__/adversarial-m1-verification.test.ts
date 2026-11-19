/** @jest-environment node */

import {
  cleanMedicineName,
  cleanSupplierName,
  calculateTrigramSimilarity,
  matchSupplier,
  matchProduct,
  type SupplierCatalogItem,
  type ProductCatalogItem,
} from '@/lib/scanner/entity-matcher'
import { generateMockPdfBuffer } from '@/lib/scanner/mock-bill-fixtures'
import {
  reconcileFinancials,
  parsePharmaInvoiceText,
  type ExtractedLineItem,
} from '@/lib/scanner/pharma-invoice-heuristics'
import {
  parsePurchaseBill,
  parseWithMockEngine,
} from '@/lib/scanner/purchase-bill-parser'

describe('Adversarial Verification Suite: Milestone M1 (Challenger 2)', () => {
  // ─────────────────────────────────────────────────────────────
  // 1. Extreme String Variations in Supplier Entity Resolution
  // ─────────────────────────────────────────────────────────────
  describe('Adversarial Entity Resolution: Supplier Variations', () => {
    const catalogSuppliers: SupplierCatalogItem[] = [
      {
        id: 'sup-mahaveer',
        name: 'Mahaveer Pharma Agencies Pvt Ltd',
        gstin: '29AABCM8921F1ZT',
        dlNumber: '20B/KA-B21/48911',
      },
      {
        id: 'sup-apollo',
        name: 'Apollo Medical Agencies & Distributors LLP',
        gstin: '33AABCA4567E1Z8',
        dlNumber: '20B/TN-01/9922',
      },
      {
        id: 'sup-sun',
        name: 'Sun-Pharma Medisales India Private Limited',
        gstin: '27AABCS9999M1Z1',
        dlNumber: '20B/MH-MUM/55441',
      },
      {
        id: 'sup-care-cure',
        name: 'Care / Cure Healthcare Enterprises',
        gstin: '24AABCC1122D1Z3',
        dlNumber: '20B/GJ-AHM/77112',
      },
    ]

    it('cleans and normalizes supplier names with special symbols (&, /, -, dots, parentheses)', () => {
      expect(cleanSupplierName('APOLLO MEDICAL AGENCIES & DISTRIBUTORS LLP')).toBe('APOLLO MEDICAL')
      expect(cleanSupplierName('CARE / CURE HEALTHCARE ENTERPRISES')).toBe('CARE CURE')
      expect(cleanSupplierName('SUN-PHARMA MEDISALES INDIA PRIVATE LIMITED')).toBe('SUN PHARMA INDIA')
      expect(cleanSupplierName('M/S. MAHAVEER PHARMA (AGENCIES) PVT. LTD.')).toBe('M S MAHAVEER PHARMA')
    })

    it('resolves suppliers accurately despite extreme punctuation and corporate noise', () => {
      // Test variant 1: With "&", "LLP", spaces
      const match1 = matchSupplier(
        { rawName: 'Apollo Medical & Dist.' },
        catalogSuppliers
      )
      // Even without GSTIN, does it match or maintain safe confidence?
      if (match1.matchedSupplierId) {
        expect(match1.matchedSupplierId).toBe('sup-apollo')
      }

      // Test variant 2: With GSTIN match despite distorted raw name
      const match2 = matchSupplier(
        {
          rawName: 'RANDOM SCRAMBLED DISTRIBUTOR NAME',
          gstin: '29AABCM8921F1ZT',
        },
        catalogSuppliers
      )
      expect(match2.matchedSupplierId).toBe('sup-mahaveer')
      expect(match2.matchConfidence).toBe(1.0)
      expect(match2.isNew).toBe(false)

      // Test variant 3: With Drug License Form 20B match
      const match3 = matchSupplier(
        {
          rawName: 'Unrecognized Care Cure Trading',
          dlNumber: '20B/GJ-AHM/77112',
        },
        catalogSuppliers
      )
      expect(match3.matchedSupplierId).toBe('sup-care-cure')
      expect(match3.matchConfidence).toBe(0.95)
      expect(match3.isNew).toBe(false)
    })

    it('does NOT falsely match truncated/unrelated suppliers above 85% threshold', () => {
      const unrelated = matchSupplier(
        { rawName: 'Random Unregistered Local Chemist' },
        catalogSuppliers
      )
      expect(unrelated.isNew).toBe(true)
      expect(unrelated.matchedSupplierId).toBeUndefined()
      expect(unrelated.matchConfidence).toBeLessThan(0.85)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 2. Medicine Name Disambiguation & Strength Collision Stress Test
  // ─────────────────────────────────────────────────────────────
  describe('Adversarial Entity Resolution: Similar Medicine Names & Strengths', () => {
    const catalogProducts: ProductCatalogItem[] = [
      {
        id: 'prod-aug-625',
        name: 'Augmentin 625 Duo Tablet',
        sku: 'AUG-625-TAB',
        mrp: 204.5,
      },
      {
        id: 'prod-aug-375',
        name: 'Augmentin 375 Tablet',
        sku: 'AUG-375-TAB',
        mrp: 140.0,
      },
      {
        id: 'prod-aug-1g',
        name: 'Augmentin 1g Tablet',
        sku: 'AUG-1G-TAB',
        mrp: 320.0,
      },
      {
        id: 'prod-aug-dds',
        name: 'Augmentin DDS Syrup',
        sku: 'AUG-DDS-SYP',
        mrp: 175.0,
      },
      {
        id: 'prod-calpol-650',
        name: 'Calpol 650 Tablet',
        sku: 'CAL-650-TAB',
        mrp: 35.0,
      },
      {
        id: 'prod-calpol-500',
        name: 'Calpol 500 Tablet',
        sku: 'CAL-500-TAB',
        mrp: 25.0,
      },
      {
        id: 'prod-calpol-250',
        name: 'Calpol 250 Pead Suspension',
        sku: 'CAL-250-SYP',
        mrp: 45.0,
      },
    ]

    function makeItem(rawDescription: string): ExtractedLineItem {
      return {
        id: 'item-test',
        rawDescription,
        matchConfidence: 0.0,
        isNewProduct: true,
        batchNumber: 'TESTB1',
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
    }

    it('empirically verifies trigram scores between strength variants', () => {
      const clean625 = cleanMedicineName('Augmentin 625 Duo Tablet')
      const clean375 = cleanMedicineName('Augmentin 375 Tablet')
      const clean1g = cleanMedicineName('Augmentin 1g Tablet')
      const cleanDds = cleanMedicineName('Augmentin DDS Syrup')

      const score625vs375 = calculateTrigramSimilarity(clean625, clean375)
      const score625vs1g = calculateTrigramSimilarity(clean625, clean1g)
      const score625vsDds = calculateTrigramSimilarity(clean625, cleanDds)

      // Log empirical values
      // Augmented brand name similarity should NOT cross 0.85 auto-select threshold
      // to avoid dangerous dosage cross-matching
      expect(score625vs375).toBeLessThan(0.85)
      expect(score625vs1g).toBeLessThan(0.85)
      expect(score625vsDds).toBeLessThan(0.85)
    })

    it('matches exact dosage variants to their respective catalog entries without cross-contamination', () => {
      // 1. Augmentin 625 Duo
      const match625 = matchProduct(makeItem("AUGMENTIN 625 DUO TAB 10'S"), catalogProducts)
      expect(match625.matchedProductId).toBe('prod-aug-625')
      expect(match625.matchConfidence).toBeGreaterThanOrEqual(0.85)
      expect(match625.isNewProduct).toBe(false)

      // 2. Augmentin 375
      const match375 = matchProduct(makeItem("AUGMENTIN 375 TABLETS 10'S"), catalogProducts)
      expect(match375.matchedProductId).toBe('prod-aug-375')
      expect(match375.matchConfidence).toBeGreaterThanOrEqual(0.85)
      expect(match375.isNewProduct).toBe(false)

      // 3. Augmentin DDS
      const matchDds = matchProduct(makeItem('AUGMENTIN DDS SYRUP 30ML'), catalogProducts)
      expect(matchDds.matchedProductId).toBe('prod-aug-dds')
      expect(matchDds.matchConfidence).toBeGreaterThanOrEqual(0.85)
      expect(matchDds.isNewProduct).toBe(false)
    })

    it('matches Calpol 650 vs Calpol 500 vs Calpol 250 without strength cross-matching', () => {
      const match650 = matchProduct(makeItem("CALPOL 650 TABLETS 15'S IP"), catalogProducts)
      expect(match650.matchedProductId).toBe('prod-calpol-650')
      expect(match650.isNewProduct).toBe(false)

      const match500 = matchProduct(makeItem("CALPOL 500 TABLETS 15'S"), catalogProducts)
      expect(match500.matchedProductId).toBe('prod-calpol-500')
      expect(match500.isNewProduct).toBe(false)

      // In catalog, the product is named 'Calpol 250 Pead Suspension'.
      // When invoice description is 'CALPOL 250 SUSPENSION 60ML', cleaned name is 'CALPOL 250' vs 'CALPOL 250 PEAD'.
      // Trigram score is in the suggestion range (0.65 <= score < 0.85).
      // The matcher suggests 'prod-calpol-250' but prudently flags isNewProduct: true for manual confirmation.
      const match250 = matchProduct(makeItem('CALPOL 250 SUSPENSION 60ML'), catalogProducts)
      expect(match250.matchedProductId).toBe('prod-calpol-250')
      expect(match250.matchConfidence).toBeGreaterThanOrEqual(0.65)
      expect(match250.matchConfidence).toBeLessThan(0.85)
      expect(match250.isNewProduct).toBe(true)

      // If invoice description matches the catalog name including 'Pead'
      const match250Pead = matchProduct(makeItem('CALPOL 250 PEAD SUSPENSION 60ML'), catalogProducts)
      expect(match250Pead.matchedProductId).toBe('prod-calpol-250')
      expect(match250Pead.matchConfidence).toBeGreaterThanOrEqual(0.85)
      expect(match250Pead.isNewProduct).toBe(false)
    })

    it('CRITICAL ADVERSARIAL: When catalog lacks Augmentin 375, does NOT auto-bind to Augmentin 625 Duo', () => {
      // Catalog only has Augmentin 625 Duo
      const limitedCatalog: ProductCatalogItem[] = [
        {
          id: 'prod-aug-625',
          name: 'Augmentin 625 Duo Tablet',
          sku: 'AUG-625-TAB',
        },
      ]

      const billItem375 = makeItem("AUGMENTIN 375 TABLETS 10'S")
      const result = matchProduct(billItem375, limitedCatalog)

      // MUST NOT be auto-selected (isNewProduct must be true, confidence must be < 0.85)
      expect(result.isNewProduct).toBe(true)
      expect(result.matchConfidence).toBeLessThan(0.85)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 3. Mathematical Cross-Reconciliation & Rounding Tolerance Stress Test
  // ─────────────────────────────────────────────────────────────
  describe('Adversarial Math Cross-Reconciliation (reconcileFinancials)', () => {
    function makeLine(
      qty: number,
      unitCost: number,
      discountPercent: number,
      taxPercent: number
    ): ExtractedLineItem {
      const taxable = Math.round(qty * unitCost * (1 - discountPercent / 100) * 100) / 100
      const taxAmount = Math.round(taxable * (taxPercent / 100) * 100) / 100
      const totalAmount = Math.round((taxable + taxAmount) * 100) / 100
      return {
        id: 'line-1',
        rawDescription: 'TEST ITEM',
        batchNumber: 'B1',
        expiryDate: '2028-08-31',
        billedQuantity: qty,
        freeQuantity: 0,
        unitCost,
        mrp: unitCost * 1.3,
        discountPercent,
        taxPercent,
        taxAmount,
        totalAmount,
        matchConfidence: 0.9,
        isNewProduct: false,
      }
    }

    it('reconciles perfectly when variance is 0.00', () => {
      // Item: Qty 10 @ 100.00, Tax 12% = 1000 + 120 = 1120.00
      const items = [makeLine(10, 100.0, 0, 12)]
      const text = `
        SUB-TOTAL: 1000.00
        TOTAL TAX: 120.00
        GRAND TOTAL: 1120.00
      `
      const result = reconcileFinancials(items, text)
      expect(result.isReconciled).toBe(true)
      expect(result.reconciliationVariance).toBe(0.0)
      expect(result.totalAmount).toBe(1120.0)
    })

    it('reconciles when variance is exactly Rs 0.49 (rounding off cents)', () => {
      const items = [makeLine(10, 100.0, 0, 12)] // computed = 1120.00
      const text = `
        SUB-TOTAL: 1000.00
        TOTAL TAX: 120.00
        GRAND TOTAL: 1120.49
      `
      const result = reconcileFinancials(items, text)
      expect(result.isReconciled).toBe(true)
      expect(result.reconciliationVariance).toBe(0.49)
    })

    it('reconciles on upper boundary: variance exactly Rs 1.00', () => {
      const items = [makeLine(10, 100.0, 0, 12)] // computed = 1120.00
      const text = `
        SUB-TOTAL: 1000.00
        TOTAL TAX: 120.00
        GRAND TOTAL: 1121.00
      `
      const result = reconcileFinancials(items, text)
      expect(result.isReconciled).toBe(true)
      expect(result.reconciliationVariance).toBe(1.0)
    })

    it('FLAGS DISCREPANCY on boundary violation: variance Rs 1.01', () => {
      const items = [makeLine(10, 100.0, 0, 12)] // computed = 1120.00
      const text = `
        SUB-TOTAL: 1000.00
        TOTAL TAX: 120.00
        GRAND TOTAL: 1121.01
      `
      const result = reconcileFinancials(items, text)
      expect(result.isReconciled).toBe(false)
      expect(result.reconciliationVariance).toBe(1.01)
    })

    it('FLAGS DISCREPANCY on massive variance (e.g. counterfeit / fraudulent bill total)', () => {
      const items = [makeLine(10, 100.0, 0, 12)] // computed = 1120.00
      const text = `
        SUB-TOTAL: 1000.00
        TOTAL TAX: 120.00
        GRAND TOTAL: 5000.00
      `
      const result = reconcileFinancials(items, text)
      expect(result.isReconciled).toBe(false)
      expect(result.reconciliationVariance).toBe(3880.0)
    })

    it('accurately incorporates explicit ROUND OFF and CASH DISCOUNT fields', () => {
      // Subtotal: 1000.00, Tax: 120.00, Discount: 20.00, Round Off: -0.20
      // Net: 1000 + 120 - 20 - 0.20 = 1099.80
      const items = [makeLine(10, 100.0, 0, 12)]
      const text = `
        SUB-TOTAL: 1000.00
        TOTAL TAX: 120.00
        CASH DISC: 20.00
        ROUND OFF: -0.20
        GRAND TOTAL: 1099.80
      `
      const result = reconcileFinancials(items, text)
      expect(result.isReconciled).toBe(true)
      expect(result.reconciliationVariance).toBe(0.0)
      expect(result.discountAmount).toBe(20.0)
      expect(result.roundOff).toBe(-0.2)
      expect(result.totalAmount).toBe(1099.8)
    })

    it('handles multi-item multi-tax rate reconciliation (5% insulin + 12% tablet + 18% topical)', () => {
      const item5 = makeLine(10, 200.0, 0, 5) // 2000 + 100 = 2100
      const item12 = makeLine(5, 100.0, 0, 12) // 500 + 60 = 560
      const item18 = makeLine(2, 50.0, 0, 18) // 100 + 18 = 118
      // Total = 2100 + 560 + 118 = 2778.00
      const items = [item5, item12, item18]
      const text = `
        SUB-TOTAL: 2600.00
        TOTAL TAX: 178.00
        GRAND TOTAL: 2778.00
      `
      const result = reconcileFinancials(items, text)
      expect(result.isReconciled).toBe(true)
      expect(result.reconciliationVariance).toBe(0.0)
      expect(result.subtotal).toBe(2600.0)
      expect(result.taxAmount).toBe(178.0)
      expect(result.totalAmount).toBe(2778.0)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 4. Mode Isolation & Credential Leakage Verification
  // ─────────────────────────────────────────────────────────────
  describe('Mode Isolation & Credential Safety in Scan Pipeline', () => {
    it('executes deterministic mock engine without leaking internal environment variables', () => {
      const mockResult = parseWithMockEngine('test-bill.pdf', 'mahaveer')
      expect(mockResult.success).toBe(true)
      expect(mockResult.extractionMethod).toBe('DETERMINISTIC_MOCK')

      const serialized = JSON.stringify(mockResult)
      // Assert no secret environment leakage
      expect(serialized).not.toContain('GEMINI_API_KEY')
      expect(serialized).not.toContain('DATABASE_URL')
      expect(serialized).not.toContain('NEXTAUTH_SECRET')
      expect(serialized).not.toContain('JWT_SECRET')
    })

    it('executes digital vector PDF extraction in pure-JS mode safely', async () => {
      const pdfBuffer = generateMockPdfBuffer('mahaveer')
      const result = await parsePurchaseBill(pdfBuffer, 'application/pdf', {
        filename: 'mahaveer.pdf',
        forceTier: 'digital_pdf',
      })

      expect(result.success).toBe(true)
      expect(result.extractionMethod).toBe('DIGITAL_PDF')

      const serialized = JSON.stringify(result)
      expect(serialized).not.toContain('GEMINI_API_KEY')
      expect(serialized).not.toContain('DATABASE_URL')
    })

    it('confirms production fallback does NOT emit mock data in test mode when mock=false', async () => {
      // In production mode, an empty buffer or unparseable text returns empty invoice data,
      // never fabricated distributor data.
      const emptyParsed = parsePharmaInvoiceText('')
      expect(emptyParsed.items.length).toBe(0)
      expect(emptyParsed.supplier.rawName).toBe('UNKNOWN PHARMA DISTRIBUTOR')
      expect(emptyParsed.financials.totalAmount).toBe(0)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 5. Financial Edge Cases & Scheme Parsing
  // ─────────────────────────────────────────────────────────────
  describe('Adversarial Financial Edge Cases & Free Goods Scheme', () => {
    it('correctly handles fractional paise rounding without cumulative floating point drift', () => {
      // 3 items with fractional paise line totals
      // Item 1: 33 units @ 14.17 = 467.61, 12% GST = 56.1132 -> 56.11, total = 523.72
      // Item 2: 17 units @ 31.83 = 541.11, 12% GST = 64.9332 -> 64.93, total = 606.04
      // Item 3: 7 units @ 89.91 = 629.37, 5% GST = 31.4685 -> 31.47, total = 660.84
      // Subtotal = 467.61 + 541.11 + 629.37 = 1638.09
      // Tax = 56.11 + 64.93 + 31.47 = 152.51
      // Grand Total = 1638.09 + 152.51 = 1790.60
      const makeLineFractional = (qty: number, rate: number, taxRate: number): ExtractedLineItem => {
        const taxable = Math.round(qty * rate * 100) / 100
        const tax = Math.round(taxable * (taxRate / 100) * 100) / 100
        return {
          id: 'frac-item',
          rawDescription: 'FRACTIONAL MEDICINE',
          batchNumber: 'FRAC01',
          expiryDate: '2028-09-30',
          billedQuantity: qty,
          freeQuantity: 0,
          unitCost: rate,
          mrp: rate * 1.4,
          discountPercent: 0,
          taxPercent: taxRate,
          taxAmount: tax,
          totalAmount: Math.round((taxable + tax) * 100) / 100,
          matchConfidence: 0.9,
          isNewProduct: false,
        }
      }

      const items = [
        makeLineFractional(33, 14.17, 12),
        makeLineFractional(17, 31.83, 12),
        makeLineFractional(7, 89.91, 5),
      ]

      const text = `
        SUB-TOTAL: 1638.09
        TOTAL TAX: 152.51
        GRAND TOTAL: 1790.60
      `
      const result = reconcileFinancials(items, text)
      expect(result.isReconciled).toBe(true)
      expect(result.reconciliationVariance).toBe(0.0)
      expect(result.subtotal).toBe(1638.09)
      expect(result.taxAmount).toBe(152.51)
      expect(result.totalAmount).toBe(1790.6)
    })

    it('handles schemes (free goods) where billedQuantity carries cost and freeQuantity does not inflate subtotal', () => {
      // Line: Qty 50 + 5 Free @ 100.00
      // Taxable = 50 * 100 = 5000.00 (NOT 55 * 100 = 5500.00)
      const lineWithScheme: ExtractedLineItem = {
        id: 'scheme-item',
        rawDescription: 'AUGMENTIN 625 DUO TAB 50+5 FREE',
        batchNumber: 'SCH01',
        expiryDate: '2028-08-31',
        billedQuantity: 50,
        freeQuantity: 5,
        unitCost: 100.0,
        mrp: 150.0,
        discountPercent: 0,
        taxPercent: 12,
        taxAmount: 600.0,
        totalAmount: 5600.0,
        matchConfidence: 0.9,
        isNewProduct: false,
      }

      const text = `
        SUB-TOTAL: 5000.00
        TOTAL TAX: 600.00
        GRAND TOTAL: 5600.00
      `
      const result = reconcileFinancials([lineWithScheme], text)
      expect(result.isReconciled).toBe(true)
      expect(result.reconciliationVariance).toBe(0.0)
      expect(result.subtotal).toBe(5000.0)
      expect(result.totalAmount).toBe(5600.0)
    })
  })
})
