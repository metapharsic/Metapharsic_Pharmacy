/** @jest-environment node */
/**
 * Unit Tests for Universal PDF Invoice Generator
 * Metapharsic Pharmacy Management System
 */

import {
  computeGstSlabs,
  generateInvoicePdfBuffer,
  generateInvoicePdfDoc,
  numberToWordsINR,
  parseNum,
  round2,
} from '@/lib/pdf/invoice-pdf-generator'

describe('Universal Invoice PDF Generator', () => {
  const sampleSale = {
    id: 'sale-test-123',
    invoiceNumber: 'INV-2026-9876',
    saleDate: '2026-11-02T10:30:00.000Z',
    subtotal: 1500,
    discountAmount: 100,
    discountPercent: 6.67,
    taxAmount: 168,
    cgstAmount: 84,
    sgstAmount: 84,
    igstAmount: 0,
    totalAmount: 1568,
    amountPaid: 1568,
    cashTendered: 2000,
    changeAmount: 432,
    paymentStatus: 'PAID',
    customer: {
      name: 'Rahul Sharma',
      phone: '+91 98765 11223',
    },
    doctor: {
      name: 'P. K. Verma',
      regNumber: 'MCI-48291',
    },
    createdBy: {
      name: 'Anil Kumar (Cashier)',
    },
    branch: {
      name: 'Metapharsic Koramangala Central',
      address: '80 Feet Road, 4th Block, Koramangala',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560034',
      phone: '+91 80 4123 4567',
      gstin: '29ABCDE1234F1Z5',
      dlNumber: 'KA-B1-20B-1234 / KA-B1-21B-5678',
      regPharmacist: 'R.Ph. Sneha Patel (Reg. No: 98124)',
    },
    items: [
      {
        productName: 'Augmentin 625 Duo',
        genericName: 'Amoxicillin & Potassium Clavulanate',
        hsnCode: '3004',
        batchNumber: 'AUG-491',
        expiryDate: '2027-08-31',
        quantity: 2,
        unitPrice: 200,
        mrp: 220,
        discountAmount: 20,
        discountPercent: 5,
        taxPercent: 12,
        cgstPercent: 6,
        sgstPercent: 6,
        igstPercent: 0,
        cgstAmount: 22.8,
        sgstAmount: 22.8,
        taxAmount: 45.6,
        totalAmount: 425.6,
      },
      {
        productName: 'Electral ORS Powder 21.8g',
        composition: 'Oral Rehydration Salts IP',
        hsnCode: '3004',
        batchNumber: 'ELC-102',
        expiryDate: '2026-12-31',
        quantity: 5,
        unitPrice: 22,
        mrp: 24,
        discountAmount: 0,
        taxPercent: 5,
        cgstPercent: 2.5,
        sgstPercent: 2.5,
        igstPercent: 0,
        cgstAmount: 2.75,
        sgstAmount: 2.75,
        taxAmount: 5.5,
        totalAmount: 115.5,
      },
      {
        productName: 'Dettol Antiseptic Liquid 100ml',
        hsnCode: '3808',
        batchNumber: 'DTL-882',
        expiryDate: '2028-04-30',
        quantity: 1,
        unitPrice: 80,
        mrp: 85,
        discountAmount: 0,
        taxPercent: 18,
        cgstPercent: 9,
        sgstPercent: 9,
        igstPercent: 0,
        cgstAmount: 7.2,
        sgstAmount: 7.2,
        taxAmount: 14.4,
        totalAmount: 94.4,
      },
      {
        productName: 'Free Life-saving ORS Sample',
        hsnCode: '3004',
        batchNumber: 'FRE-001',
        expiryDate: '2027-01-01',
        quantity: 1,
        unitPrice: 0,
        mrp: 0,
        discountAmount: 0,
        taxPercent: 0,
        cgstPercent: 0,
        sgstPercent: 0,
        igstPercent: 0,
        taxAmount: 0,
        totalAmount: 0,
      },
    ],
    payments: [{ method: 'CASH', amount: 1568 }],
  }

  describe('generateInvoicePdfBuffer', () => {
    it('generates a valid A4 binary PDF buffer with %PDF- header', () => {
      const buffer = generateInvoicePdfBuffer(sampleSale, { format: 'a4' })

      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.length).toBeGreaterThan(1000)

      // PDF specification magic bytes
      const header = buffer.subarray(0, 5).toString('ascii')
      expect(header).toBe('%PDF-')
    })

    it('generates a valid 80mm continuous thermal slip PDF buffer', () => {
      const buffer = generateInvoicePdfBuffer(sampleSale, { format: 'thermal80' })

      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.length).toBeGreaterThan(1000)

      const header = buffer.subarray(0, 5).toString('ascii')
      expect(header).toBe('%PDF-')
    })

    it('handles sales with minimal/missing optional fields cleanly', () => {
      const minimalSale = {
        invoiceNumber: 'MIN-001',
        saleDate: new Date(),
        subtotal: 100,
        taxAmount: 12,
        totalAmount: 112,
        items: [
          {
            productName: 'Generic Paracetamol 500mg',
            quantity: 10,
            unitPrice: 10,
            totalAmount: 112,
          },
        ],
      }

      const bufferA4 = generateInvoicePdfBuffer(minimalSale, { format: 'a4' })
      expect(bufferA4.subarray(0, 5).toString('ascii')).toBe('%PDF-')

      const bufferThermal = generateInvoicePdfBuffer(minimalSale, { format: 'thermal80' })
      expect(bufferThermal.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    })

    it('creates a jsPDF document with custom options overrides', () => {
      const customOptions = {
        pharmacyName: 'CUSTOM SUPER PHARMACY',
        gstin: '29ZZZZZ9999Z9Z9',
        dlNumber: 'DL-CUSTOM-999',
        address: 'MG Road, Bangalore',
        phone: '+91 99999 88888',
      }

      const doc = generateInvoicePdfDoc(sampleSale, customOptions)
      expect(doc).toBeDefined()
      expect(Math.round(doc.internal.pageSize.getWidth())).toBe(210) // A4 width
    })
  })

  describe('Dynamic GST Multi-Slab Matrix Calculation', () => {
    it('aggregates multiple tax slabs (0%, 5%, 12%, 18%) accurately', () => {
      const slabs = computeGstSlabs(sampleSale.items)

      expect(slabs.length).toBe(4)

      const slab0 = slabs.find((s) => s.slab === 0)
      const slab5 = slabs.find((s) => s.slab === 5)
      const slab12 = slabs.find((s) => s.slab === 12)
      const slab18 = slabs.find((s) => s.slab === 18)

      expect(slab0).toBeDefined()
      expect(slab0?.slabLabel).toBe('Exempt (0%)')

      expect(slab5).toBeDefined()
      expect(slab5?.cgstRate).toBe(2.5)
      expect(slab5?.sgstRate).toBe(2.5)
      expect(slab5?.totalTax).toBe(5.5)

      expect(slab12).toBeDefined()
      expect(slab12?.cgstRate).toBe(6)
      expect(slab12?.sgstRate).toBe(6)
      expect(slab12?.totalTax).toBe(45.6)

      expect(slab18).toBeDefined()
      expect(slab18?.cgstRate).toBe(9)
      expect(slab18?.sgstRate).toBe(9)
      expect(slab18?.totalTax).toBe(14.4)
    })

    it('falls back gracefully to overall sale tax when items have no per-item tax', () => {
      const legacyItems = [
        { productName: 'Medicine A', quantity: 1, unitPrice: 500, totalAmount: 500 },
        { productName: 'Medicine B', quantity: 1, unitPrice: 500, totalAmount: 500 },
      ]

      const slabs = computeGstSlabs(legacyItems, {
        subtotal: 1000,
        discountAmount: 0,
        taxAmount: 120,
        cgstAmount: 60,
        sgstAmount: 60,
      })

      expect(slabs.length).toBe(1)
      expect(slabs[0].slab).toBe(12)
      expect(slabs[0].taxableAmount).toBe(1000)
      expect(slabs[0].cgstAmount).toBe(60)
      expect(slabs[0].sgstAmount).toBe(60)
      expect(slabs[0].totalTax).toBe(120)
    })
  })

  describe('numberToWordsINR', () => {
    it('converts zero amount', () => {
      expect(numberToWordsINR(0)).toBe('Rupees Zero Only')
    })

    it('converts integers to Indian words format', () => {
      expect(numberToWordsINR(150)).toBe('Rupees One Hundred Fifty Only')
      expect(numberToWordsINR(1250)).toBe('Rupees One Thousand Two Hundred Fifty Only')
      expect(numberToWordsINR(100000)).toBe('Rupees One Lakh Only')
    })

    it('converts rupees and paise correctly', () => {
      expect(numberToWordsINR(150.5)).toBe('Rupees One Hundred Fifty and Fifty Paise Only')
      expect(numberToWordsINR(425.6)).toBe('Rupees Four Hundred Twenty Five and Sixty Paise Only')
    })
  })

  describe('parseNum and round2', () => {
    it('parses null, undefined, strings, numbers, and object with toString', () => {
      expect(parseNum(null)).toBe(0)
      expect(parseNum(undefined)).toBe(0)
      expect(parseNum('123.45')).toBe(123.45)
      expect(parseNum('invalid')).toBe(0)
      expect(parseNum({ toString: () => '99.50' })).toBe(99.5)
      expect(round2(10.256)).toBe(10.26)
    })
  })
})
