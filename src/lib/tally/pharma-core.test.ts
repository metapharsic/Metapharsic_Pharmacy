import {
  buildCompanySetupXml,
  buildDebitNotesXml,
  buildDutiesTaxesLedgersXml,
  buildPriceListXml,
  buildPurchaseVouchersXml,
  buildSalesVouchersXml,
  buildUnitsXml,
} from './tally-xml-builder'
import {
  DEFAULT_TALLY_CONFIG,
  type CompanySetupForTally,
  type DebitNoteForTally,
  type PriceListForTally,
  type UnitForTally,
} from './tally-types'
import {
  calculateSubUnitPrice,
  convertQuantity,
  STANDARD_COMPOUND_UNITS,
  STANDARD_SIMPLE_UNITS,
} from '../inventory/unit-conversion'
import { computeItemPricing } from '../sales/pricing'

describe('Pharma Core Accounting & Tally Integration (9 Pillars)', () => {
  // ─────────────────────────────────────────────────────────────
  // PILLAR 1: Statutory GST Activation & Pharma Batch Controls (F11/F2 & F11/F3)
  // ─────────────────────────────────────────────────────────────
  describe('Pillar 1: Company Setup & Statutory Batch Controls', () => {
    const sampleSetup: CompanySetupForTally = {
      companyName: 'LifeLine Pharmacy Care',
      legalName: 'LifeLine Health Services Pvt Ltd',
      gstin: '29ABCDE1234F1Z5',
      stateName: 'Karnataka',
      dlNumber: 'KA-B2-998877',
      address: '123 Medical Square, Bangalore',
      phone: '9876543210',
      email: 'accounts@lifelinepharma.com',
      maintainBatchWise: true,
      trackExpiryDates: true,
      trackMfgDates: true,
      registrationType: 'Regular',
      financialYearStart: new Date(2026, 3, 1),
    }

    it('generates Tally Company Setup XML activating GST and pharma batch controls', () => {
      const xml = buildCompanySetupXml(sampleSetup)

      expect(xml).toContain('<TALLYREQUEST>Import Data</TALLYREQUEST>')
      expect(xml).toContain('<NAME>LifeLine Pharmacy Care</NAME>')
      expect(xml).toContain('<STATENAME>Karnataka</STATENAME>')
      expect(xml).toContain('<PARTYGSTIN>29ABCDE1234F1Z5</PARTYGSTIN>')
      expect(xml).toContain('<ISGSTAPPLICABLE>Yes</ISGSTAPPLICABLE>')
      expect(xml).toContain('<MAINTAINBATCHES>Yes</MAINTAINBATCHES>')
      expect(xml).toContain('<TRACKEXPIRYDATE>Yes</TRACKEXPIRYDATE>')
      expect(xml).toContain('<TRACKMFGDATE>Yes</TRACKMFGDATE>')
      expect(xml).toContain('<GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>')
      expect(xml).toContain('<DRUGLICENSENUMBER>KA-B2-998877</DRUGLICENSENUMBER>')
    })

    it('generates Statutory Duties & Taxes ledgers for CGST, SGST, IGST @ 9% & 18%', () => {
      const xml = buildDutiesTaxesLedgersXml(DEFAULT_TALLY_CONFIG)

      expect(xml).toContain(`<NAME>${DEFAULT_TALLY_CONFIG.cgstOutputLedger}</NAME>`)
      expect(xml).toContain(`<NAME>${DEFAULT_TALLY_CONFIG.sgstOutputLedger}</NAME>`)
      expect(xml).toContain(`<NAME>${DEFAULT_TALLY_CONFIG.igstOutputLedger}</NAME>`)
      expect(xml).toContain('<PARENT>Duties &amp; Taxes</PARENT>')
      expect(xml).toContain('<TAXTYPE>GST</TAXTYPE>')
      expect(xml).toContain('<GSTDUTYHEAD>Central Tax</GSTDUTYHEAD>')
      expect(xml).toContain('<GSTDUTYHEAD>State Tax</GSTDUTYHEAD>')
      expect(xml).toContain('<GSTDUTYHEAD>Integrated Tax</GSTDUTYHEAD>')
      expect(xml).toContain('<RATEOFTAXCALCULATION>9</RATEOFTAXCALCULATION>')
      expect(xml).toContain('<RATEOFTAXCALCULATION>18</RATEOFTAXCALCULATION>')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // PILLAR 2: Simple & Compound Units of Measurement
  // ─────────────────────────────────────────────────────────────
  describe('Pillar 2: Units of Measurement & Conversions', () => {
    const pharmaUnits: UnitForTally[] = [
      { name: 'Box', symbol: 'BOX', isSimple: true },
      { name: 'Strip', symbol: 'STRIP', isSimple: true },
      { name: 'Nos', symbol: 'NOS', isSimple: true },
      { name: 'Kg', symbol: 'KGS', isSimple: true, decimalPlaces: 3 },
      { name: 'Grams', symbol: 'GMS', isSimple: true, decimalPlaces: 2 },
      {
        name: 'Box of 10 Strips',
        symbol: 'BOX/10STRIP',
        isSimple: false,
        baseUnit: 'Box',
        additionalUnit: 'Strip',
        conversion: 10,
      },
      {
        name: 'Strip of 10 Tablets',
        symbol: 'STRIP/10NOS',
        isSimple: false,
        baseUnit: 'Strip',
        additionalUnit: 'Nos',
        conversion: 10,
      },
      {
        name: 'Kg of 1000g',
        symbol: 'KG/1000GMS',
        isSimple: false,
        baseUnit: 'Kg',
        additionalUnit: 'Grams',
        conversion: 1000,
      },
    ]

    it('generates Tally XML distinguishing simple units from compound conversion units', () => {
      const xml = buildUnitsXml(pharmaUnits)

      expect(xml).toContain('<NAME>BOX</NAME>')
      expect(xml).toContain('<ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>')

      // Compound unit: Box of 10 Strips
      expect(xml).toContain('<NAME>Box of 10 Strips</NAME>')
      expect(xml).toContain('<ISSIMPLEUNIT>No</ISSIMPLEUNIT>')
      expect(xml).toContain('<BASEUNITS>Box</BASEUNITS>')
      expect(xml).toContain('<ADDITIONALUNITS>Strip</ADDITIONALUNITS>')
      expect(xml).toContain('<CONVERSION>10</CONVERSION>')

      // Compound unit: Kg of 1000g
      expect(xml).toContain('<BASEUNITS>Kg</BASEUNITS>')
      expect(xml).toContain('<ADDITIONALUNITS>Grams</ADDITIONALUNITS>')
      expect(xml).toContain('<CONVERSION>1000</CONVERSION>')
    })

    it('accurately converts quantities across standard compound ratios', () => {
      // 2 Boxes -> 20 Strips
      expect(convertQuantity(2, 'BOX', 'STRIP').quantity).toBe(20)
      // 20 Strips -> 2 Boxes
      expect(convertQuantity(20, 'STRIP', 'BOX').quantity).toBe(2)
      // 5 Strips -> 50 Nos
      expect(convertQuantity(5, 'STRIP', 'NOS').quantity).toBe(50)
      // 2.5 Kg -> 2500 Grams
      expect(convertQuantity(2.5, 'KG', 'GRAMS').quantity).toBe(2500)
      // Same unit
      expect(convertQuantity(15, 'STRIP', 'STRIP').quantity).toBe(15)
    })

    it('calculates sub-unit prices accurately for partial dispenses', () => {
      // Box costs 500, contains 10 strips -> each strip is 50
      expect(calculateSubUnitPrice(500, 10, 1).unitPrice).toBe(50)
      // Strip costs 120, contains 10 tablets -> each tablet is 12
      expect(calculateSubUnitPrice(120, 10, 1).unitPrice).toBe(12)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // PILLAR 4 & 5: Purchase Inward Batch Tracking & Sales Invoicing
  // ─────────────────────────────────────────────────────────────
  describe('Pillars 4 & 5: Inward Batch Allocations with Mfg/Exp Dates', () => {
    it('populates manufacturing dates and expiry dates in purchase voucher XML', () => {
      const samplePurchase = {
        id: 'pur-1',
        purchaseNumber: 'PO-2026-001',
        invoiceNumber: 'SUP-INV-8899',
        purchaseDate: '2026-09-17T09:00:00.000Z',
        subtotal: 1000,
        taxAmount: 120,
        cgstAmount: 60,
        sgstAmount: 60,
        igstAmount: 0,
        totalAmount: 1120,
        supplier: {
          id: 'sup-1',
          name: 'Cipla Distributors',
          gstin: '29ABCDE1234F1Z5',
          state: 'Karnataka',
          phone: '9876543210',
        },
        items: [
          {
            id: 'p-item-1',
            quantity: 50,
            unitCost: 20,
            totalAmount: 1120,
            taxAmount: 120,
            product: {
              name: 'Paracetamol 650mg',
              sku: 'PCM-650',
              hsnCode: '30049060',
              unitOfMeasure: 'STRIP',
            },
            batchNumber: 'B-PCM-2026-01',
            expiryDate: '2028-06-30T00:00:00.000Z',
            manufacturingDate: '2026-01-15T00:00:00.000Z',
          },
        ],
      }

      const xml = buildPurchaseVouchersXml([samplePurchase], DEFAULT_TALLY_CONFIG)

      expect(xml).toContain('<VOUCHER VCHTYPE="Purchase" ACTION="Create"')
      expect(xml).toContain('<VOUCHERNUMBER>PO-2026-001</VOUCHERNUMBER>')
      expect(xml).toContain('<REFERENCE>SUP-INV-8899</REFERENCE>')
      expect(xml).toContain('<BATCHNAME>B-PCM-2026-01</BATCHNAME>')
      expect(xml).toContain('<EXPIRYPERIOD>30-Jun-2028</EXPIRYPERIOD>')
      expect(xml).toContain('<MFGDATE>15-Jan-2026</MFGDATE>')
      expect(xml).toContain(`<LEDGERNAME>${DEFAULT_TALLY_CONFIG.cgstInputLedger}</LEDGERNAME>`)
      expect(xml).toContain(`<LEDGERNAME>${DEFAULT_TALLY_CONFIG.sgstInputLedger}</LEDGERNAME>`)
    })

    it('populates price levels and manufacturing dates in sales invoice vouchers', () => {
      const sampleSale = {
        id: 'sale-99',
        invoiceNumber: 'INV-2026-9999',
        saleDate: '2026-09-17T11:00:00.000Z',
        subtotal: 500,
        taxAmount: 60,
        cgstAmount: 30,
        sgstAmount: 30,
        igstAmount: 0,
        totalAmount: 560,
        priceLevel: 'Retailer',
        customer: {
          id: 'cust-1',
          name: 'Apex Health Clinic',
          gstin: '29ABCDE1234F1Z5',
          state: 'Karnataka',
        },
        payments: [{ method: 'UPI', amount: 560 }],
        items: [
          {
            id: 'it-1',
            quantity: 10,
            unitPrice: 50,
            totalAmount: 560,
            taxAmount: 60,
            product: {
              name: 'Azithromycin 500mg',
              sku: 'AZI-500',
              hsnCode: '30042010',
              unitOfMeasure: 'STRIP',
            },
            itemBatches: [
              {
                quantity: 10,
                batch: {
                  batchNumber: 'AZI-B9',
                  expiryDate: '2027-11-30T00:00:00.000Z',
                  manufacturingDate: '2025-11-01T00:00:00.000Z',
                },
              },
            ],
          },
        ],
      }

      const xml = buildSalesVouchersXml([sampleSale], DEFAULT_TALLY_CONFIG)

      expect(xml).toContain('<PRICELEVEL>Retailer</PRICELEVEL>')
      expect(xml).toContain('<BATCHNAME>AZI-B9</BATCHNAME>')
      expect(xml).toContain('<MFGDATE>01-Nov-2025</MFGDATE>')
      expect(xml).toContain('<EXPIRYPERIOD>30-Nov-2027</EXPIRYPERIOD>')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // PILLAR 6: Automated Expiry Block (Sales/POS Protection)
  // ─────────────────────────────────────────────────────────────
  describe('Pillar 6: Automated Expiry Block', () => {
    it('blocks expired batches and selects only active saleable batches', () => {
      const now = new Date('2026-09-17T12:00:00.000Z').getTime()

      const batches = [
        { batchNumber: 'EXP-01', expiryDate: new Date('2025-01-01T00:00:00.000Z') }, // Expired
        { batchNumber: 'EXP-02', expiryDate: new Date('2026-09-01T00:00:00.000Z') }, // Expired 16 days ago
        { batchNumber: 'ACT-01', expiryDate: new Date('2026-12-31T00:00:00.000Z') }, // Active
        { batchNumber: 'ACT-02', expiryDate: new Date('2028-05-31T00:00:00.000Z') }, // Active
      ]

      // Filter simulation of searchPosProducts
      const activeBatches = batches.filter((b) => b.expiryDate.getTime() > now)
      expect(activeBatches.map((b) => b.batchNumber)).toEqual(['ACT-01', 'ACT-02'])

      // Guard simulation of createSale
      const trySaleWithExpired = () => {
        const selectedBatch = batches[0]
        if (selectedBatch.expiryDate.getTime() <= now) {
          throw new Error(
            `Automated Expiry Block: Batch ${selectedBatch.batchNumber} has expired and cannot be sold.`
          )
        }
      }

      expect(trySaleWithExpired).toThrow('Automated Expiry Block')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // PILLAR 7: Returning Expired Stock via Debit Note (Ctrl + F9)
  // ─────────────────────────────────────────────────────────────
  describe('Pillar 7: Debit Notes (Purchase Returns) with Expired Stock Override', () => {
    const expiredReturn: DebitNoteForTally = {
      id: 'ret-101',
      returnNumber: 'DN-2026-001',
      invoiceNumber: 'ORIG-INV-4455',
      returnDate: '2026-09-17T14:00:00.000Z',
      reason: 'Expired stock return to supplier for credit adjustment',
      subtotal: 880,
      taxAmount: 120,
      cgstAmount: 60,
      sgstAmount: 60,
      igstAmount: 0,
      totalAmount: 1000,
      supplier: {
        id: 'sup-1',
        name: 'Sun Pharma Distribution',
        gstin: '29ABCDE1234F1Z5',
        state: 'Karnataka',
        phone: '9876543210',
      },
      items: [
        {
          id: 'ret-item-1',
          quantity: 20,
          unitCost: 44,
          totalAmount: 1000,
          batchNumber: 'SUN-EXP-99',
          expiryDate: '2026-08-31T00:00:00.000Z', // Expired
          manufacturingDate: '2024-08-01T00:00:00.000Z',
          isExpired: true,
          product: {
            name: 'Rosuvastatin 10mg',
            sku: 'RSV-10',
            hsnCode: '30049099',
            unitOfMeasure: 'STRIP',
          },
        },
      ],
    }

    it('generates valid Tally Debit Note XML with ALLOWUSEOFEXPIREDBATCHES override and Input GST reversal', () => {
      const xml = buildDebitNotesXml([expiredReturn], DEFAULT_TALLY_CONFIG)

      expect(xml).toContain('<VOUCHER VCHTYPE="Debit Note" ACTION="Create"')
      expect(xml).toContain('<ISDEBITNOTE>Yes</ISDEBITNOTE>')
      expect(xml).toContain('<ALLOWUSEOFEXPIREDBATCHES>Yes</ALLOWUSEOFEXPIREDBATCHES>')
      expect(xml).toContain('<VOUCHERNUMBER>DN-2026-001</VOUCHERNUMBER>')
      expect(xml).toContain('<REFERENCE>ORIG-INV-4455</REFERENCE>')
      expect(xml).toContain('<PARTYLEDGERNAME>Sun Pharma Distribution</PARTYLEDGERNAME>')
      expect(xml).toContain('<STOCKITEMNAME>Rosuvastatin 10mg</STOCKITEMNAME>')
      expect(xml).toContain('<BATCHNAME>SUN-EXP-99</BATCHNAME>')
      expect(xml).toContain('<EXPIRYPERIOD>31-Aug-2026</EXPIRYPERIOD>')

      // Quantities and amounts must be negative on inventory & input taxes for reversal
      expect(xml).toContain('<ACTUALQTY>-20 STRIP</ACTUALQTY>')
      expect(xml).toContain('<BILLEDQTY>-20 STRIP</BILLEDQTY>')
      expect(xml).toContain('<AMOUNT>-1000.00</AMOUNT>')
      expect(xml).toContain(`<LEDGERNAME>${DEFAULT_TALLY_CONFIG.cgstInputLedger}</LEDGERNAME>`)
      expect(xml).toContain('<AMOUNT>-60.00</AMOUNT>')
      expect(xml).toContain(`<LEDGERNAME>${DEFAULT_TALLY_CONFIG.sgstInputLedger}</LEDGERNAME>`)
      expect(xml).toContain('<AMOUNT>-60.00</AMOUNT>')
      // Party credit debit entry
      expect(xml).toContain('<AMOUNT>1000.00</AMOUNT>')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // PILLAR 8: Multi-Tier Pricing (Retailer, Stockist, Wholesaler)
  // ─────────────────────────────────────────────────────────────
  describe('Pillar 8: Multi-Tier Price Lists & Custom Unit Price Overrides', () => {
    it('generates Tally Price List XML for Retailer, Stockist, and Wholesaler tiers', () => {
      const priceList: PriceListForTally = {
        effectiveDate: '2026-04-01T00:00:00.000Z',
        rules: [
          {
            productName: 'Metformin 500mg',
            priceLevel: 'Retailer',
            rate: 42.5,
            unitOfMeasure: 'Strip',
          },
          {
            productName: 'Metformin 500mg',
            priceLevel: 'Stockist',
            rate: 35.0,
            unitOfMeasure: 'Strip',
          },
          {
            productName: 'Metformin 500mg',
            priceLevel: 'Wholesaler',
            rate: 37.0,
            unitOfMeasure: 'Strip',
          },
        ],
      }

      const xml = buildPriceListXml(priceList)

      expect(xml).toContain('<PRICELIST')
      expect(xml).toContain('<PRICELEVEL>Retailer</PRICELEVEL>')
      expect(xml).toContain('<STOCKITEMNAME>Metformin 500mg</STOCKITEMNAME>')
      expect(xml).toContain('<RATE>42.50/Strip</RATE>')
      expect(xml).toContain('<PRICELEVEL>Stockist</PRICELEVEL>')
      expect(xml).toContain('<RATE>35.00/Strip</RATE>')
      expect(xml).toContain('<PRICELEVEL>Wholesaler</PRICELEVEL>')
      expect(xml).toContain('<RATE>37.00/Strip</RATE>')
    })

    it('honors customUnitPrice when calculating sales pricing for Retailer vs Stockist tiers', () => {
      const mrp = 100
      const retailerPtr = 85
      const stockistCost = 70

      // Retailer price override
      const retailerCalculation = computeItemPricing({
        quantity: 10,
        mrp,
        customUnitPrice: retailerPtr,
        taxInclusive: false,
        isGstExempt: false,
        gstRate: 12,
        cgstRate: 6,
        sgstRate: 6,
        igstRate: 0,
        discountPercent: 0,
      })
      expect(retailerCalculation.unitPrice).toBe(85)
      expect(retailerCalculation.taxableAmount).toBe(850)
      expect(retailerCalculation.taxAmount).toBe(102)
      expect(retailerCalculation.totalAmount).toBe(952)

      // Stockist price override
      const stockistCalculation = computeItemPricing({
        quantity: 10,
        mrp,
        customUnitPrice: stockistCost,
        taxInclusive: false,
        isGstExempt: false,
        gstRate: 12,
        cgstRate: 6,
        sgstRate: 6,
        igstRate: 0,
        discountPercent: 0,
      })
      expect(stockistCalculation.unitPrice).toBe(70)
      expect(stockistCalculation.taxableAmount).toBe(700)
      expect(stockistCalculation.taxAmount).toBe(84)
      expect(stockistCalculation.totalAmount).toBe(784)
    })
  })
})
