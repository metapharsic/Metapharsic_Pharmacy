/**
 * Deterministic Mock Invoices & Wholesale Bill Fixtures
 *
 * Provides realistic Indian pharmaceutical wholesale invoice text and structured
 * fixtures for testing and zero-network CI execution.
 * Models invoices compliant with Drugs & Cosmetics Rules 1945 and CGST/SGST Acts 2017.
 */

import { jsPDF } from 'jspdf'

export interface MockInvoiceItem {
  rawDescription: string
  matchedProductId?: string
  matchedProductName?: string
  packSize: string
  hsnCode: string
  batchNumber: string
  expiryDate: string // YYYY-MM-DD
  billedQuantity: number
  freeQuantity: number
  unitCost: number // PTR
  mrp: number
  discountPercent: number
  taxPercent: number
  taxAmount: number
  totalAmount: number
}

export interface MockInvoiceFixture {
  id: string
  name: string
  rawText: string
  supplier: {
    name: string
    gstin: string
    dlNumber: string
    address: string
    phone?: string
  }
  invoice: {
    invoiceNumber: string
    invoiceDate: string // YYYY-MM-DD
    dueDate: string // YYYY-MM-DD
  }
  items: MockInvoiceItem[]
  financials: {
    subtotal: number
    taxAmount: number
    discountAmount: number
    roundOff: number
    totalAmount: number
    isReconciled: boolean
    reconciliationVariance: number
  }
}

// ─────────────────────────────────────────────────────────────
// Raw Invoices Layouts (Marg ERP / Busy / Tally Style)
// ─────────────────────────────────────────────────────────────

export const RAW_INVOICE_MAHAVEER = `
========================================================================================================
                               TAX INVOICE / CASH-CREDIT MEMO
DISTRIBUTOR: MAHAVEER PHARMA AGENCIES PVT LTD                       INV NO: MP/24-25/08492
ADDRESS: 14/B, DRUG MARKET, RING ROAD, BENGALURU-560002             DATE:   24/10/2026
GSTIN: 29AABCM8921F1ZT      D.L. NO: 20B/KA-B21/48911, 21B/KA-B21/48912     DUE DATE: 23/11/2026
BUYER: METAPHARSIC PHARMACY (MAIN BRANCH)
========================================================================================================
S#  PRODUCT DESCRIPTION        PACK   HSN   BATCH   EXPIRY   QTY  FREE   RATE     MRP    DISC% GST%   AMOUNT
--------------------------------------------------------------------------------------------------------
01  AUGMENTIN 625 DUO TAB      10'S   3004  26D044  08/28     50     5  147.24  204.50   2.00  12%  7214.76
02  PAN 40 TABLETS             15'S   3004  PN8901  11/27    100    10  110.00  165.00   0.00  12% 11000.00
03  INSULATARD HM 100IU        10ML   3004  IN7822  03/28     20     0  280.00  385.00   0.00   5%  5600.00
--------------------------------------------------------------------------------------------------------
SUB-TOTAL: 23814.76
CGST (6%): 1092.89 | SGST (6%): 1092.89 | CGST (2.5%): 140.00 | SGST (2.5%): 140.00
TOTAL TAX: 2465.78
CASH DISCOUNT: 144.29
ROUND OFF: -0.25
GRAND TOTAL: 26136.00
========================================================================================================
`

export const RAW_INVOICE_VARDHAMAN = `
========================================================================================================
                                      TAX INVOICE
VARDHAMAN MEDISALES PVT LTD                                         INVOICE NO: VM/2026/9912
G-4, APEX HEALTH PARK, S.V. ROAD, MUMBAI-400050                      DATE: 01/11/2026
GSTIN: 27AABCV1234D1Z2       D.L. NO: 20B/MH-TZ2/10293              DUE:  01/12/2026
--------------------------------------------------------------------------------------------------------
ITEM DESCRIPTION               PACK   HSN   BATCH   EXPIRY   QTY  FREE   PTR      MRP    CD%  GST%   TOTAL
--------------------------------------------------------------------------------------------------------
AZITHRAL 500 TABLET            5'S    3004  AZ551   06/28     40     4   92.50  132.00   5%   12%  3515.00
TELMA 40MG TAB                 15'S   3004  TL4019  10/27     60     0  138.00  195.00   0%   12%  8280.00
--------------------------------------------------------------------------------------------------------
TAXABLE AMOUNT: 11795.00
TOTAL TAX: 1415.40
DISCOUNT: 0.00
ROUND OFF: -0.40
NET PAYABLE: 13210.00
========================================================================================================
`

export const RAW_INVOICE_DISCREPANT = `
========================================================================================================
                                      TAX INVOICE
DISCREPANT PHARMA DISTRIBUTORS                                      BILL NO: DP-9988
GSTIN: 07AABCD1111E1Z5       DL: 20B/DL-01/1234                     DATE: 15/09/2026
--------------------------------------------------------------------------------------------------------
PRODUCT DESCRIPTION            PACK   HSN   BATCH   EXPIRY   QTY  FREE   RATE     MRP    DISC% GST%   AMOUNT
--------------------------------------------------------------------------------------------------------
PARACETAMOL 650MG TAB          10'S   3004  PARA01  04/28     10     0   20.00   35.00   0%   12%   200.00
--------------------------------------------------------------------------------------------------------
SUB-TOTAL: 200.00
TOTAL TAX: 24.00
GRAND TOTAL: 500.00
========================================================================================================
`

// ─────────────────────────────────────────────────────────────
// Structured Fixtures
// ─────────────────────────────────────────────────────────────

export const MOCK_INVOICE_MAHAVEER: MockInvoiceFixture = {
  id: 'fixture-mahaveer-01',
  name: 'Mahaveer Pharma Agencies Bill',
  rawText: RAW_INVOICE_MAHAVEER.trim(),
  supplier: {
    name: 'MAHAVEER PHARMA AGENCIES PVT LTD',
    gstin: '29AABCM8921F1ZT',
    dlNumber: '20B/KA-B21/48911',
    address: '14/B, Drug Market, Ring Road, Bengaluru-560002',
    phone: '+91 80 2671 9901',
  },
  invoice: {
    invoiceNumber: 'MP/24-25/08492',
    invoiceDate: '2026-10-24',
    dueDate: '2026-11-23',
  },
  items: [
    {
      rawDescription: "AUGMENTIN 625 DUO TAB 10'S",
      matchedProductName: 'Augmentin 625 Duo Tablet',
      packSize: "10'S",
      hsnCode: '3004',
      batchNumber: '26D044',
      expiryDate: '2028-08-31',
      billedQuantity: 50,
      freeQuantity: 5,
      unitCost: 147.24,
      mrp: 204.5,
      discountPercent: 2.0,
      taxPercent: 12.0,
      taxAmount: 865.77,
      totalAmount: 8080.53,
    },
    {
      rawDescription: "PAN 40 TABLETS 15'S",
      matchedProductName: 'Pan 40 Tablet',
      packSize: "15'S",
      hsnCode: '3004',
      batchNumber: 'PN8901',
      expiryDate: '2027-11-30',
      billedQuantity: 100,
      freeQuantity: 10,
      unitCost: 110.0,
      mrp: 165.0,
      discountPercent: 0.0,
      taxPercent: 12.0,
      taxAmount: 1320.0,
      totalAmount: 12320.0,
    },
    {
      rawDescription: 'INSULATARD HM 100IU 10ML',
      matchedProductName: 'Insulatard HM 100IU Injection',
      packSize: '10ML',
      hsnCode: '3004',
      batchNumber: 'IN7822',
      expiryDate: '2028-03-31',
      billedQuantity: 20,
      freeQuantity: 0,
      unitCost: 280.0,
      mrp: 385.0,
      discountPercent: 0.0,
      taxPercent: 5.0,
      taxAmount: 280.0,
      totalAmount: 5880.0,
    },
  ],
  financials: {
    subtotal: 23814.76,
    taxAmount: 2465.78,
    discountAmount: 144.29,
    roundOff: -0.25,
    totalAmount: 26136.0,
    isReconciled: true,
    reconciliationVariance: 0.0,
  },
}

export const MOCK_INVOICE_VARDHAMAN: MockInvoiceFixture = {
  id: 'fixture-vardhaman-02',
  name: 'Vardhaman Medisales Bill',
  rawText: RAW_INVOICE_VARDHAMAN.trim(),
  supplier: {
    name: 'VARDHAMAN MEDISALES PVT LTD',
    gstin: '27AABCV1234D1Z2',
    dlNumber: '20B/MH-TZ2/10293',
    address: 'G-4, Apex Health Park, S.V. Road, Mumbai-400050',
    phone: '+91 22 2844 1100',
  },
  invoice: {
    invoiceNumber: 'VM/2026/9912',
    invoiceDate: '2026-11-01',
    dueDate: '2026-12-01',
  },
  items: [
    {
      rawDescription: "AZITHRAL 500 TABLET 5'S",
      matchedProductName: 'Azithral 500 Tablet',
      packSize: "5'S",
      hsnCode: '3004',
      batchNumber: 'AZ551',
      expiryDate: '2028-06-30',
      billedQuantity: 40,
      freeQuantity: 4,
      unitCost: 92.5,
      mrp: 132.0,
      discountPercent: 5.0,
      taxPercent: 12.0,
      taxAmount: 421.8,
      totalAmount: 3936.8,
    },
    {
      rawDescription: "TELMA 40MG TAB 15'S",
      matchedProductName: 'Telma 40 Tablet',
      packSize: "15'S",
      hsnCode: '3004',
      batchNumber: 'TL4019',
      expiryDate: '2027-10-31',
      billedQuantity: 60,
      freeQuantity: 0,
      unitCost: 138.0,
      mrp: 195.0,
      discountPercent: 0.0,
      taxPercent: 12.0,
      taxAmount: 993.6,
      totalAmount: 9273.6,
    },
  ],
  financials: {
    subtotal: 11795.0,
    taxAmount: 1415.4,
    discountAmount: 0.0,
    roundOff: -0.4,
    totalAmount: 13210.0,
    isReconciled: true,
    reconciliationVariance: 0.0,
  },
}

export const MOCK_INVOICE_DISCREPANT: MockInvoiceFixture = {
  id: 'fixture-discrepant-03',
  name: 'Discrepant Pharma Distributors Bill',
  rawText: RAW_INVOICE_DISCREPANT.trim(),
  supplier: {
    name: 'DISCREPANT PHARMA DISTRIBUTORS',
    gstin: '07AABCD1111E1Z5',
    dlNumber: '20B/DL-01/1234',
    address: '77, Industrial Area, Okhla Phase 2, New Delhi-110020',
  },
  invoice: {
    invoiceNumber: 'DP-9988',
    invoiceDate: '2026-09-15',
    dueDate: '2026-10-15',
  },
  items: [
    {
      rawDescription: "PARACETAMOL 650MG TAB 10'S",
      matchedProductName: 'Paracetamol 650mg Tablet',
      packSize: "10'S",
      hsnCode: '3004',
      batchNumber: 'PARA01',
      expiryDate: '2028-04-30',
      billedQuantity: 10,
      freeQuantity: 0,
      unitCost: 20.0,
      mrp: 35.0,
      discountPercent: 0.0,
      taxPercent: 12.0,
      taxAmount: 24.0,
      totalAmount: 224.0,
    },
  ],
  financials: {
    subtotal: 200.0,
    taxAmount: 24.0,
    discountAmount: 0.0,
    roundOff: 0.0,
    totalAmount: 500.0, // Intentional mismatch (Computed: 224.00, Extracted: 500.00)
    isReconciled: false,
    reconciliationVariance: 276.0,
  },
}

export const MOCK_INVOICE_HYPER_PHARMA: MockInvoiceFixture = {
  id: 'fixture-hyper-pharma',
  name: 'HYPER PHARMA (Wholesale Invoice HYP6621)',
  rawText: `HYPER PHARMA GST INVOICE HYP6621`,
  supplier: {
    name: 'HYPER PHARMA',
    gstin: '36PATPA1744D1Z1',
    dlNumber: 'TS/HYD/2021-85726',
    address: 'Shop 17-1-205/17/123, Ground Floor, B-Block, Saidabad, Hyderabad - 500059',
    phone: '9985589599',
  },
  invoice: {
    invoiceNumber: 'HYP6621',
    invoiceDate: '2026-10-29',
    dueDate: '2026-11-28',
  },
  items: [
    { rawDescription: 'A TO Z SYP (REVON)', packSize: '200ml Syrup', hsnCode: '3004', batchNumber: '25C', expiryDate: '2027-03-31', billedQuantity: 1, freeQuantity: 0, unitCost: 156.61, mrp: 164.44, discountPercent: 0, taxPercent: 5, taxAmount: 7.83, totalAmount: 164.44 },
    { rawDescription: 'AMBROLITE DROPS', packSize: '15ml Drops', hsnCode: '3004', batchNumber: '6KI', expiryDate: '2027-03-31', billedQuantity: 1, freeQuantity: 0, unitCost: 110.63, mrp: 116.16, discountPercent: 0, taxPercent: 5, taxAmount: 5.53, totalAmount: 116.16 },
    { rawDescription: 'AMBROLITE DROPS', packSize: '15ml Drops', hsnCode: '3004', batchNumber: 'MD', expiryDate: '2028-03-31', billedQuantity: 2, freeQuantity: 0, unitCost: 37.14, mrp: 39.00, discountPercent: 0, taxPercent: 5, taxAmount: 3.71, totalAmount: 77.99 },
    { rawDescription: 'ATARAX SYP', packSize: '100ml Syrup', hsnCode: '3004', batchNumber: '02C', expiryDate: '2029-04-30', billedQuantity: 1, freeQuantity: 0, unitCost: 115.10, mrp: 120.86, discountPercent: 0, taxPercent: 5, taxAmount: 5.76, totalAmount: 120.86 },
    { rawDescription: 'AUGPEN DROPS', packSize: '10ml Drops', hsnCode: '3004', batchNumber: 'DC', expiryDate: '2029-04-30', billedQuantity: 1, freeQuantity: 0, unitCost: 91.12, mrp: 95.68, discountPercent: 0, taxPercent: 5, taxAmount: 4.56, totalAmount: 95.68 },
    { rawDescription: 'BANDY PLUS SYP', packSize: '10ml Suspension', hsnCode: '3004', batchNumber: '205', expiryDate: '2027-10-31', billedQuantity: 2, freeQuantity: 0, unitCost: 35.42, mrp: 37.19, discountPercent: 0, taxPercent: 5, taxAmount: 3.54, totalAmount: 74.38 },
    { rawDescription: 'CALDIMAX P SYP', packSize: '200ml Syrup', hsnCode: '3004', batchNumber: 'MA', expiryDate: '2028-05-31', billedQuantity: 2, freeQuantity: 0, unitCost: 146.29, mrp: 153.61, discountPercent: 0, taxPercent: 5, taxAmount: 14.63, totalAmount: 307.21 },
    { rawDescription: 'CLAVAM BID FORTE SYP', packSize: '30ml Dry Syrup', hsnCode: '3004', batchNumber: 'CBF', expiryDate: '2028-06-30', billedQuantity: 1, freeQuantity: 0, unitCost: 185.36, mrp: 194.63, discountPercent: 0, taxPercent: 5, taxAmount: 9.27, totalAmount: 194.63 },
    { rawDescription: 'CLAVAM DRY SYP', packSize: '30ml Dry Syrup', hsnCode: '3004', batchNumber: 'CDS', expiryDate: '2028-08-31', billedQuantity: 2, freeQuantity: 0, unitCost: 114.14, mrp: 119.85, discountPercent: 0, taxPercent: 5, taxAmount: 11.41, totalAmount: 239.69 },
    { rawDescription: 'CLAVAM FORTE DRY SYP', packSize: '30ml Dry Syrup', hsnCode: '3004', batchNumber: 'CFD', expiryDate: '2028-09-30', billedQuantity: 2, freeQuantity: 0, unitCost: 54.18, mrp: 56.89, discountPercent: 0, taxPercent: 5, taxAmount: 5.42, totalAmount: 113.78 },
    { rawDescription: 'COLIC AID DROPS', packSize: '15ml Drops', hsnCode: '3004', batchNumber: 'CAD', expiryDate: '2027-11-30', billedQuantity: 1, freeQuantity: 0, unitCost: 158.51, mrp: 166.44, discountPercent: 0, taxPercent: 5, taxAmount: 7.93, totalAmount: 166.44 },
    { rawDescription: 'ERIKID SYP', packSize: '60ml Syrup', hsnCode: '3004', batchNumber: 'ERK', expiryDate: '2028-01-31', billedQuantity: 2, freeQuantity: 0, unitCost: 60.30, mrp: 63.32, discountPercent: 0, taxPercent: 5, taxAmount: 6.03, totalAmount: 126.63 },
    { rawDescription: 'KIDPRED SYP', packSize: '60ml Syrup', hsnCode: '3004', batchNumber: 'KID', expiryDate: '2028-03-31', billedQuantity: 3, freeQuantity: 0, unitCost: 45.51, mrp: 47.79, discountPercent: 0, taxPercent: 5, taxAmount: 6.83, totalAmount: 143.36 },
    { rawDescription: 'LIVO-UP SYP', packSize: '200ml Syrup', hsnCode: '3004', batchNumber: 'LIV', expiryDate: '2028-04-30', billedQuantity: 2, freeQuantity: 0, unitCost: 73.22, mrp: 76.88, discountPercent: 0, taxPercent: 5, taxAmount: 7.32, totalAmount: 153.76 },
    { rawDescription: 'METROGYL SYP', packSize: '60ml Syrup', hsnCode: '3004', batchNumber: 'MET', expiryDate: '2028-07-31', billedQuantity: 2, freeQuantity: 0, unitCost: 62.74, mrp: 65.88, discountPercent: 0, taxPercent: 5, taxAmount: 6.27, totalAmount: 131.75 },
    { rawDescription: 'MEFTAL P SYP', packSize: '60ml Suspension', hsnCode: '3004', batchNumber: 'MEF', expiryDate: '2028-08-31', billedQuantity: 3, freeQuantity: 0, unitCost: 14.88, mrp: 15.62, discountPercent: 0, taxPercent: 5, taxAmount: 2.23, totalAmount: 46.87 },
    { rawDescription: 'MUCINAC PLUS SYP', packSize: '100ml Syrup', hsnCode: '3004', batchNumber: 'MUC', expiryDate: '2028-09-30', billedQuantity: 2, freeQuantity: 0, unitCost: 32.06, mrp: 33.66, discountPercent: 0, taxPercent: 5, taxAmount: 3.21, totalAmount: 67.33 },
    { rawDescription: 'THEX 250MG INJ', packSize: '1 Vial', hsnCode: '3004', batchNumber: 'THX', expiryDate: '2028-10-31', billedQuantity: 4, freeQuantity: 0, unitCost: 84.86, mrp: 89.10, discountPercent: 0, taxPercent: 5, taxAmount: 16.97, totalAmount: 356.41 },
  ],
  financials: {
    subtotal: 2441.91,
    taxAmount: 122.09,
    discountAmount: 0.0,
    roundOff: 0.0,
    totalAmount: 2564.0,
    isReconciled: true,
    reconciliationVariance: 0.0,
  },
}

export const MOCK_INVOICE_FIXTURES: MockInvoiceFixture[] = [
  MOCK_INVOICE_HYPER_PHARMA,
  MOCK_INVOICE_MAHAVEER,
  MOCK_INVOICE_VARDHAMAN,
  MOCK_INVOICE_DISCREPANT,
]

/**
 * Returns a mock invoice fixture by id or index (defaults to Mahaveer)
 */
export function getMockInvoiceFixture(idOrName?: string): MockInvoiceFixture {
  if (!idOrName) return MOCK_INVOICE_MAHAVEER
  const lower = idOrName.toLowerCase()
  if (lower.includes('hyper') || lower.includes('hyp') || lower.includes('whatsapp')) {
    return MOCK_INVOICE_HYPER_PHARMA
  }
  const found = MOCK_INVOICE_FIXTURES.find(
    (f) =>
      f.id.toLowerCase() === lower ||
      f.name.toLowerCase().includes(lower) ||
      f.supplier.name.toLowerCase().includes(lower)
  )
  return found || MOCK_INVOICE_MAHAVEER
}

/**
 * Generates a real vector PDF Buffer using jsPDF containing the exact text of the fixture.
 * Allows the digital PDF stream extractor to test genuine PDF parsing.
 */
export function generateMockPdfBuffer(fixtureName?: string): Buffer {
  const fixture = getMockInvoiceFixture(fixtureName)
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: false })
  
  doc.setFont('courier', 'normal')
  doc.setFontSize(7)
  
  const lines = fixture.rawText.split(/\r?\n/)
  let y = 20
  for (const line of lines) {
    if (y > 800) {
      doc.addPage()
      y = 20
    }
    doc.text(line, 20, y)
    y += 10
  }
  
  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}
