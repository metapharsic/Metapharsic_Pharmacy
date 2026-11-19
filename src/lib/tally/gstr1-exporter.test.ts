import { generateGstr1Csv, generateGstr1Json, processGstr1Data } from './gstr1-exporter'
import type { SaleForTally } from './tally-xml-builder'

describe('gstr1-exporter', () => {
  const mockSales: SaleForTally[] = [
    {
      id: 'sale-b2b',
      invoiceNumber: 'INV-2026-001',
      saleDate: new Date('2026-09-17T10:00:00Z'),
      customer: {
        id: 'cust-b2b',
        name: 'Apollo Hospital',
        gstin: '29ABCDE1234F1Z5',
        state: '29-Karnataka',
      },
      payments: [{ method: 'BANK', amount: 1120 }],
      subtotal: 1000,
      discountAmount: 0,
      taxAmount: 120,
      cgstAmount: 60,
      sgstAmount: 60,
      igstAmount: 0,
      totalAmount: 1120,
      items: [
        {
          id: 'item-1',
          quantity: 10,
          unitPrice: 100,
          totalAmount: 1120,
          taxAmount: 120,
          product: {
            name: 'Paracetamol 650mg',
            sku: 'PCM-650',
            hsnCode: '30049099',
            unitOfMeasure: 'Strip',
          },
        },
      ],
    },
    {
      id: 'sale-b2c',
      invoiceNumber: 'INV-2026-002',
      saleDate: new Date('2026-09-17T11:00:00Z'),
      customer: null, // Walk-in consumer
      payments: [{ method: 'CASH', amount: 560 }],
      subtotal: 500,
      discountAmount: 0,
      taxAmount: 60,
      cgstAmount: 30,
      sgstAmount: 30,
      igstAmount: 0,
      totalAmount: 560,
      items: [
        {
          id: 'item-2',
          quantity: 5,
          unitPrice: 100,
          totalAmount: 560,
          taxAmount: 60,
          product: {
            name: 'Amoxicillin 500mg',
            sku: 'AMX-500',
            hsnCode: '30049099',
            unitOfMeasure: 'Strip',
          },
        },
      ],
    },
  ]

  it('correctly splits sales into B2B and B2C buckets', () => {
    const { b2bLines, b2cLines, summary } = processGstr1Data(mockSales)

    expect(summary.totalInvoices).toBe(2)
    expect(summary.b2bInvoicesCount).toBe(1)
    expect(summary.b2cInvoicesCount).toBe(1)
    expect(b2bLines).toHaveLength(1)
    expect(b2bLines[0].customerGstin).toBe('29ABCDE1234F1Z5')
    expect(b2bLines[0].taxableValue).toBe(1000)

    expect(b2cLines).toHaveLength(1)
    expect(b2cLines[0].taxableValue).toBe(500)
  })

  it('aggregates HSN summary correctly (Table 12)', () => {
    const { hsnLines } = processGstr1Data(mockSales)

    expect(hsnLines).toHaveLength(1)
    expect(hsnLines[0].hsnCode).toBe('30049099')
    expect(hsnLines[0].totalQuantity).toBe(15) // 10 + 5
    expect(hsnLines[0].taxableValue).toBe(1500) // 1000 + 500
    expect(hsnLines[0].centralTaxAmount).toBe(90) // 60 + 30
    expect(hsnLines[0].stateTaxAmount).toBe(90)
  })

  it('generates non-empty GSTR-1 CSV output', () => {
    const csv = generateGstr1Csv(mockSales)

    expect(csv).toContain('GSTR-1 Table 4: B2B Invoices')
    expect(csv).toContain('29ABCDE1234F1Z5')
    expect(csv).toContain('GSTR-1 Table 7: B2C (Small) Invoices')
    expect(csv).toContain('GSTR-1 Table 12: HSN Summary')
    expect(csv).toContain('30049099')
  })

  it('generates valid GSTR-1 JSON schema for GST offline tool', () => {
    const jsonStr = generateGstr1Json(mockSales, '29ABCDE1234F1Z5')
    const parsed = JSON.parse(jsonStr)

    expect(parsed.gstin).toBe('29ABCDE1234F1Z5')
    expect(parsed.b2b).toHaveLength(1)
    expect(parsed.b2cs).toHaveLength(1)
    expect(parsed.hsn.data).toHaveLength(1)
  })
})
