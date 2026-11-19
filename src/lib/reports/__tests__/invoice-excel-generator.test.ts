import {
  buildSaleInvoiceWorkbookConfig,
  buildPurchaseBillWorkbookConfig,
  buildBillReviewWorkbookConfig,
  numberToWordsINR,
  DEFAULT_PHARMACY_INFO,
} from '../invoice-excel-generator'

describe('Invoice & Pharmacy Excel Generator Engine', () => {
  describe('numberToWordsINR', () => {
    it('correctly translates numbers to Indian Rupee words', () => {
      expect(numberToWordsINR(0)).toBe('Rupees Zero Only')
      expect(numberToWordsINR(500)).toBe('Rupees Five Hundred Only')
      expect(numberToWordsINR(2564)).toBe('Rupees Two Thousand Five Hundred Sixty Four Only')
      expect(numberToWordsINR(100000)).toBe('Rupees One Lakh Only')
      expect(numberToWordsINR(150.5)).toBe('Rupees One Hundred Fifty and Fifty Paise Only')
    })
  })

  describe('buildSaleInvoiceWorkbookConfig', () => {
    it('generates multi-tab workbook with Tax Invoice and GST summary', () => {
      const mockSale = {
        invoiceNumber: 'INV-2026-001',
        saleDate: '2026-11-06T14:30:00.000Z',
        subtotal: 1000.0,
        discountAmount: 50.0,
        taxAmount: 50.0,
        totalAmount: 1000.0,
        amountPaid: 1000.0,
        payments: [{ method: 'UPI', reference: 'UPI-REF-99' }],
        customer: { name: 'John Doe', phone: '9876543210' },
        doctor: { name: 'Dr. Sharma', regNumber: 'MCI-12345' },
        items: [
          {
            productName: 'Amoxicillin 500mg',
            hsnCode: '3004',
            batchNumber: 'BAT-AMX-01',
            expiryDate: '2028-12-31',
            quantity: 2,
            freeQuantity: 0,
            unitPrice: 250.0,
            mrp: 300.0,
            discountPercent: 5,
            taxPercent: 5,
            totalAmount: 500.0,
          },
          {
            productName: 'Paracetamol 650mg',
            hsnCode: '3004',
            batchNumber: 'BAT-PCM-02',
            expiryDate: '2027-06-30',
            quantity: 5,
            freeQuantity: 1,
            unitPrice: 100.0,
            mrp: 120.0,
            discountPercent: 0,
            taxPercent: 12,
            totalAmount: 560.0,
          },
        ],
      }

      const config = buildSaleInvoiceWorkbookConfig(mockSale)

      expect(config.filename).toContain('INV-2026-001')
      expect(config.sheets).toHaveLength(2)

      // Tab 1: Tax Invoice
      const invoiceSheet = config.sheets[0]
      expect(invoiceSheet.sheetName).toBe('Tax Invoice')
      expect(invoiceSheet.headers).toContain('Medicine / Product Description')
      expect(invoiceSheet.headers).toContain('Taxable Value (₹)')
      expect(invoiceSheet.headers).toContain('CGST %')
      expect(invoiceSheet.headers).toContain('SGST %')
      expect(invoiceSheet.data).toHaveLength(2)
      expect(invoiceSheet.data[0][1]).toBe('Amoxicillin 500mg')
      expect(invoiceSheet.data[1][1]).toBe('Paracetamol 650mg')

      // Metadata check
      expect(invoiceSheet.metadata?.['GSTIN / UIN']).toBe(DEFAULT_PHARMACY_INFO.gstin)
      expect(invoiceSheet.metadata?.['Drug License']).toBe(DEFAULT_PHARMACY_INFO.dlNumber)
      expect(invoiceSheet.metadata?.['Invoice Number']).toBe('INV-2026-001')

      // Tab 2: GST Summary
      const gstSheet = config.sheets[1]
      expect(gstSheet.sheetName).toBe('GST Tax Summary')
      expect(gstSheet.headers).toContain('HSN Code')
      expect(gstSheet.headers).toContain('CGST Amount (₹)')
      expect(gstSheet.headers).toContain('SGST Amount (₹)')
    })
  })

  describe('buildPurchaseBillWorkbookConfig', () => {
    it('generates 2-tab purchase workbook with line items and ITC breakdown', () => {
      const mockPurchase = {
        purchaseNumber: 'PO-2026-88',
        invoiceNumber: 'BILL-HYP-6621',
        invoiceDate: '2026-10-29',
        supplier: {
          name: 'Hyper Pharma Distributor',
          gstin: '36ABCDE1234F1Z5',
          dlNumber: '20B/21B-TS-9988',
          phone: '9985589599',
        },
        status: 'RECEIVED',
        subtotal: 2441.91,
        discountAmount: 0.0,
        taxAmount: 122.09,
        roundOff: 0.0,
        totalAmount: 2564.0,
        amountPaid: 2564.0,
        balanceDue: 0.0,
        items: [
          {
            product: { name: 'A TO Z SYP (REVON)', sku: 'SKU-001' },
            batchNumber: '25C',
            expiryDate: '2027-03-31',
            orderedQuantity: 1,
            receivedQuantity: 1,
            freeQuantity: 0,
            unitCost: 156.61,
            mrp: 164.44,
            taxPercent: 5,
            taxAmount: 7.83,
            totalAmount: 164.44,
          },
          {
            product: { name: 'AMBROLITE DROPS', sku: 'SKU-002' },
            batchNumber: '6KI',
            expiryDate: '2027-03-31',
            orderedQuantity: 1,
            receivedQuantity: 1,
            freeQuantity: 0,
            unitCost: 110.63,
            mrp: 116.16,
            taxPercent: 5,
            taxAmount: 5.53,
            totalAmount: 116.16,
          },
        ],
      }

      const config = buildPurchaseBillWorkbookConfig(mockPurchase)

      expect(config.filename).toContain('BILL-HYP-6621')
      expect(config.sheets).toHaveLength(2)

      const billSheet = config.sheets[0]
      expect(billSheet.sheetName).toBe('Purchase Invoice')
      expect(billSheet.metadata?.['Distributor / Supplier']).toBe('Hyper Pharma Distributor')
      expect(billSheet.metadata?.['Supplier GSTIN']).toBe('36ABCDE1234F1Z5')
      expect(billSheet.data).toHaveLength(2)
      expect(billSheet.data[0][1]).toBe('A TO Z SYP (REVON)')
      expect(billSheet.data[1][1]).toBe('AMBROLITE DROPS')

      const itcSheet = config.sheets[1]
      expect(itcSheet.sheetName).toBe('HSN GST Breakup')
      expect(itcSheet.headers).toContain('HSN Code')
      expect(itcSheet.headers).toContain('Tax Amount (₹)')
    })
  })

  describe('buildBillReviewWorkbookConfig', () => {
    it('generates audited spreadsheet for OCR review items', () => {
      const mockBillData = {
        invoiceNumber: 'OCR-INV-99',
        supplierName: 'Mahaveer Healthcare',
        supplierGstin: '36MAHA1234F1Z0',
        items: [
          {
            productName: 'Augpen 625 Duo',
            batchNumber: 'AUG88',
            expiryDate: '2028-06-30',
            billedQuantity: 10,
            freeQuantity: 1,
            unitCost: 120.0,
            mrp: 160.0,
            discountPercent: 2,
            taxPercent: 12,
            totalAmount: 1317.12,
            isNewProduct: false,
          },
        ],
        isReconciled: true,
      }

      const config = buildBillReviewWorkbookConfig(mockBillData)

      expect(config.filename).toContain('OCR-INV-99')
      expect(config.sheets[0].sheetName).toBe('Scanned Bill Review')
      expect(config.sheets[0].data[0][1]).toBe('Augpen 625 Duo')
      expect(config.sheets[0].data[0][2]).toBe('AUG88')
    })
  })
})
