import { DEFAULT_TALLY_CONFIG } from './tally-types'
import {
  buildCustomerLedgersXml,
  buildDayBookXml,
  buildPurchaseVouchersXml,
  buildSalesVouchersXml,
  buildStockItemsXml,
  buildSupplierLedgersXml,
  escapeXml,
  formatTallyDate,
  formatTallyDisplayDate,
  type CustomerForTally,
  type ProductForTally,
  type PurchaseForTally,
  type SaleForTally,
  type SupplierForTally,
} from './tally-xml-builder'

describe('tally-xml-builder', () => {
  describe('helpers', () => {
    it('escapes special XML characters correctly', () => {
      expect(escapeXml('Medicines & Drugs <500mg> "Special" \'Batch\'')).toBe(
        'Medicines &amp; Drugs &lt;500mg&gt; &quot;Special&quot; &apos;Batch&apos;'
      )
      expect(escapeXml(null)).toBe('')
      expect(escapeXml(undefined)).toBe('')
    })

    it('formats dates in Tally YYYYMMDD format', () => {
      expect(formatTallyDate('2026-09-17T10:00:00.000Z')).toBe('20260917')
      expect(formatTallyDate(new Date(2026, 8, 17))).toBe('20260917')
    })

    it('formats display dates in Tally DD-MMM-YYYY format', () => {
      expect(formatTallyDisplayDate('2026-09-17T10:00:00.000Z')).toBe('17-Sep-2026')
    })
  })

  describe('buildSalesVouchersXml', () => {
    const sampleSale: SaleForTally = {
      id: 'sale-1',
      invoiceNumber: 'INV-2026-0001',
      saleDate: '2026-09-17T08:30:00.000Z',
      subtotal: 100,
      taxAmount: 12,
      cgstAmount: 6,
      sgstAmount: 6,
      igstAmount: 0,
      totalAmount: 112,
      customer: {
        id: 'cust-1',
        name: 'Rahul Sharma',
        gstin: '29ABCDE1234F1Z5',
        state: 'Karnataka',
        phone: '9876543210',
      },
      payments: [{ method: 'CASH', amount: 112 }],
      items: [
        {
          id: 'item-1',
          quantity: 2,
          unitPrice: 50,
          totalAmount: 112,
          taxAmount: 12,
          product: {
            name: 'Amoxicillin 500mg',
            sku: 'AMX-500',
            hsnCode: '30041010',
            unitOfMeasure: 'STRIP',
          },
          itemBatches: [
            {
              quantity: 2,
              batch: {
                batchNumber: 'B-2026-01',
                expiryDate: '2027-12-31T00:00:00.000Z',
              },
            },
          ],
        },
      ],
    }

    it('generates a valid Tally Sales Voucher XML', () => {
      const xml = buildSalesVouchersXml([sampleSale], DEFAULT_TALLY_CONFIG)

      expect(xml).toContain('<ENVELOPE>')
      expect(xml).toContain('<TALLYREQUEST>Import Data</TALLYREQUEST>')
      expect(xml).toContain('<VOUCHER VCHTYPE="Sales" ACTION="Create"')
      expect(xml).toContain('<VOUCHERNUMBER>INV-2026-0001</VOUCHERNUMBER>')
      expect(xml).toContain('<PARTYLEDGERNAME>Rahul Sharma</PARTYLEDGERNAME>')
      expect(xml).toContain('<PARTYGSTIN>29ABCDE1234F1Z5</PARTYGSTIN>')
      expect(xml).toContain('<STOCKITEMNAME>Amoxicillin 500mg</STOCKITEMNAME>')
      expect(xml).toContain('<BATCHNAME>B-2026-01</BATCHNAME>')
      expect(xml).toContain('<EXPIRYPERIOD>31-Dec-2027</EXPIRYPERIOD>')
      expect(xml).toContain(`<LEDGERNAME>${DEFAULT_TALLY_CONFIG.cgstOutputLedger}</LEDGERNAME>`)
      expect(xml).toContain(`<LEDGERNAME>${DEFAULT_TALLY_CONFIG.sgstOutputLedger}</LEDGERNAME>`)
      expect(xml).toContain('<AMOUNT>112.00</AMOUNT>')
    })

    it('falls back to cash ledger when sale has no registered customer', () => {
      const cashSale: SaleForTally = {
        ...sampleSale,
        customer: null,
      }
      const xml = buildSalesVouchersXml([cashSale], DEFAULT_TALLY_CONFIG)
      expect(xml).toContain(`<PARTYLEDGERNAME>${DEFAULT_TALLY_CONFIG.cashLedger}</PARTYLEDGERNAME>`)
      expect(xml).toContain('<BASICBUYERNAME>Cash Customer</BASICBUYERNAME>')
    })
  })

  describe('buildPurchaseVouchersXml', () => {
    const samplePurchase: PurchaseForTally = {
      id: 'purch-1',
      purchaseNumber: 'PO-2026-001',
      invoiceNumber: 'SUP-INV-999',
      purchaseDate: '2026-09-17T09:00:00.000Z',
      subtotal: 500,
      taxAmount: 60,
      cgstAmount: 30,
      sgstAmount: 30,
      igstAmount: 0,
      totalAmount: 560,
      supplier: {
        id: 'supp-1',
        name: 'Apollo Med Pharma',
        gstin: '29XYZ1234A1Z9',
        state: 'Karnataka',
      },
      items: [
        {
          id: 'pitem-1',
          quantity: 10,
          unitCost: 50,
          totalAmount: 560,
          product: {
            name: 'Paracetamol 650mg',
            unitOfMeasure: 'STRIP',
          },
          batchNumber: 'BATCH-AP-01',
          expiryDate: '2028-06-30T00:00:00.000Z',
        },
      ],
    }

    it('generates a valid Tally Purchase Voucher XML', () => {
      const xml = buildPurchaseVouchersXml([samplePurchase], DEFAULT_TALLY_CONFIG)

      expect(xml).toContain('<VOUCHER VCHTYPE="Purchase" ACTION="Create"')
      expect(xml).toContain('<VOUCHERNUMBER>PO-2026-001</VOUCHERNUMBER>')
      expect(xml).toContain('<REFERENCE>SUP-INV-999</REFERENCE>')
      expect(xml).toContain('<PARTYLEDGERNAME>Apollo Med Pharma</PARTYLEDGERNAME>')
      expect(xml).toContain('<STOCKITEMNAME>Paracetamol 650mg</STOCKITEMNAME>')
      expect(xml).toContain('<BATCHNAME>BATCH-AP-01</BATCHNAME>')
      expect(xml).toContain(`<LEDGERNAME>${DEFAULT_TALLY_CONFIG.cgstInputLedger}</LEDGERNAME>`)
      expect(xml).toContain('<AMOUNT>-560.00</AMOUNT>')
    })
  })

  describe('masters builders', () => {
    it('builds Customer Ledgers XML under Sundry Debtors', () => {
      const customers: CustomerForTally[] = [
        {
          id: 'c1',
          name: 'Priya Clinic',
          gstin: '29AAAAA0000A1Z5',
          state: 'Karnataka',
          city: 'Bangalore',
          phone: '9988776655',
        },
      ]
      const xml = buildCustomerLedgersXml(customers)
      expect(xml).toContain('<LEDGER NAME="Priya Clinic" ACTION="Create">')
      expect(xml).toContain('<PARENT>Sundry Debtors</PARENT>')
      expect(xml).toContain('<PARTYGSTIN>29AAAAA0000A1Z5</PARTYGSTIN>')
    })

    it('builds Supplier Ledgers XML under Sundry Creditors', () => {
      const suppliers: SupplierForTally[] = [
        {
          id: 's1',
          name: 'Cipla Distributors',
          gstin: '29BBBBB1111B1Z2',
          pan: 'BBBBB1111B',
          state: 'Karnataka',
          phone: '9123456780',
        },
      ]
      const xml = buildSupplierLedgersXml(suppliers)
      expect(xml).toContain('<LEDGER NAME="Cipla Distributors" ACTION="Create">')
      expect(xml).toContain('<PARENT>Sundry Creditors</PARENT>')
      expect(xml).toContain('<PANNUMBER>BBBBB1111B</PANNUMBER>')
    })

    it('builds Stock Items XML with batch tracking enabled', () => {
      const products: ProductForTally[] = [
        {
          id: 'p1',
          name: 'Cetirizine 10mg',
          sku: 'CET-10',
          hsnCode: '30049099',
          unitOfMeasure: 'TAB',
          gstRate: 12,
        },
      ]
      const xml = buildStockItemsXml(products)
      expect(xml).toContain('<STOCKITEM NAME="Cetirizine 10mg" ACTION="Create">')
      expect(xml).toContain('<BASEUNITS>TAB</BASEUNITS>')
      expect(xml).toContain('<HSNCODE>30049099</HSNCODE>')
      expect(xml).toContain('<ISBATCHWISEON>Yes</ISBATCHWISEON>')
    })

    it('builds combined Day Book XML', () => {
      const xml = buildDayBookXml([], [], DEFAULT_TALLY_CONFIG)
      expect(xml).toContain('<ENVELOPE>')
      expect(xml).toContain('<BODY>')
    })
  })
})
