/**
 * Reference Test Fixtures & Invoice Samples for Purchase Bill Ingestion
 * Conforming to PROJECT.md and IMPLEMENTATION_PLAN.md contracts.
 */

export interface MockInvoiceItem {
  id: string
  rawDescription: string
  matchedProductId?: string
  matchedProductName?: string
  matchConfidence: number
  isNewProduct: boolean
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
  isNearExpiry?: boolean
}

export interface MockInvoiceFixture {
  filename: string
  mimeType: string
  pageCount: number
  rawText: string
  supplier: {
    rawName: string
    matchedSupplierId?: string
    gstin: string
    dlNumber: string
    address?: string
    phone?: string
    matchConfidence: number
    isNew: boolean
  }
  invoice: {
    invoiceNumber: string
    invoiceDate: string
    dueDate?: string
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

/**
 * Fixture 1: Marg ERP Wholesale Distributor Invoice (Born-Digital Vector PDF)
 * Mahaveer Pharma Agencies Pvt Ltd
 */
export const MARG_ERP_MAHAVEER_FIXTURE: MockInvoiceFixture = {
  filename: 'Mahaveer_MP24_08492.pdf',
  mimeType: 'application/pdf',
  pageCount: 1,
  rawText: `
MAHAVEER PHARMA AGENCIES PVT LTD
Wholesale Chemists & Druggists
14/2, 1st Cross, Commercial Street, Bangalore - 560001
GSTIN: 29AABCM8921F1ZT  |  D.L. No.: 20B/KA-B21/48911, 21B/KA-B21/48912
Phone: 080-25589012  |  Email: billing@mahaveerpharma.com

TAX INVOICE
Invoice No: MP/24-25/08492             Date: 24/10/2026
Due Date: 23/11/2026                   Payment Terms: 30 Days

Billed To:
METAPHARSIC PHARMACARE (HAL 2ND STAGE)
GSTIN: 29ABCDE1234F1Z5
DL: KA-B1-20B-112233 / KA-B1-21B-445566

---------------------------------------------------------------------------------------------------------
SNo  Product Description          Pack   HSN    Batch    Exp      Qty  Free   Rate     MRP   Disc%  GST%    Amount
---------------------------------------------------------------------------------------------------------
1    AUGMENTIN 625 DUO TAB 10'S   10'S   3004   26D044   08/28     50     5  147.24  204.50    2.0   12.0   8080.53
2    PAN-D CAPSULE 15'S           15'S   3004   PND881   03/28    100     0   92.50  135.00    3.0   12.0  10049.20
3    TELMA 40 TABLET 15'S         15'S   3004   TL409    12/27     30     0   88.00  122.00    2.5   12.0   2882.88
---------------------------------------------------------------------------------------------------------
Sub Total:        19252.00
Trade Discount:     490.74
Taxable Amount:   18761.26
CGST (6%):         1125.68
SGST (6%):         1125.68
Total GST:         2251.35
Round Off:            0.00
Grand Total:      21012.61
---------------------------------------------------------------------------------------------------------
Bank Details: HDFC Bank, A/C: 50200012345678, IFSC: HDFC0000123
`,
  supplier: {
    rawName: 'MAHAVEER PHARMA AGENCIES PVT LTD',
    matchedSupplierId: 'supplier-mahaveer-01',
    gstin: '29AABCM8921F1ZT',
    dlNumber: '20B/KA-B21/48911',
    address: '14/2, 1st Cross, Commercial Street, Bangalore - 560001',
    phone: '080-25589012',
    matchConfidence: 1.0,
    isNew: false,
  },
  invoice: {
    invoiceNumber: 'MP/24-25/08492',
    invoiceDate: '2026-10-24',
    dueDate: '2026-11-23',
  },
  items: [
    {
      id: 'item-marg-01',
      rawDescription: "AUGMENTIN 625 DUO TAB 10'S",
      matchedProductId: 'prod-augmentin-625',
      matchedProductName: 'Augmentin 625 Duo',
      matchConfidence: 0.96,
      isNewProduct: false,
      packSize: "10'S",
      hsnCode: '3004',
      batchNumber: '26D044',
      expiryDate: '2028-08-31',
      billedQuantity: 50,
      freeQuantity: 5,
      unitCost: 147.24,
      mrp: 204.50,
      discountPercent: 2.0,
      taxPercent: 12.0,
      taxAmount: 865.77,
      totalAmount: 8080.53,
    },
    {
      id: 'item-marg-02',
      rawDescription: "PAN-D CAPSULE 15'S",
      matchedProductId: 'prod-pan-d',
      matchedProductName: 'Pan-D Capsule',
      matchConfidence: 0.94,
      isNewProduct: false,
      packSize: "15'S",
      hsnCode: '3004',
      batchNumber: 'PND881',
      expiryDate: '2028-03-31',
      billedQuantity: 100,
      freeQuantity: 0,
      unitCost: 92.50,
      mrp: 135.00,
      discountPercent: 3.0,
      taxPercent: 12.0,
      taxAmount: 1076.70,
      totalAmount: 10049.20,
    },
    {
      id: 'item-marg-03',
      rawDescription: "TELMA 40 TABLET 15'S",
      matchedProductId: 'prod-telma-40',
      matchedProductName: 'Telma 40mg Tablet',
      matchConfidence: 0.95,
      isNewProduct: false,
      packSize: "15'S",
      hsnCode: '3004',
      batchNumber: 'TL409',
      expiryDate: '2027-12-31',
      billedQuantity: 30,
      freeQuantity: 0,
      unitCost: 88.00,
      mrp: 122.00,
      discountPercent: 2.5,
      taxPercent: 12.0,
      taxAmount: 308.88,
      totalAmount: 2882.88,
    },
  ],
  financials: {
    subtotal: 19252.00,
    discountAmount: 490.74,
    taxAmount: 2251.35,
    roundOff: 0.00,
    totalAmount: 21012.61,
    isReconciled: true,
    reconciliationVariance: 0.00,
  },
}

/**
 * Fixture 2: Smartphone Camera Capture (Printed Paper Bill)
 * Vardhaman Medisales with Bonus Scheme (10+1 free)
 */
export const SMARTPHONE_CAMERA_VARDHAMAN_FIXTURE: MockInvoiceFixture = {
  filename: 'camera_capture_vardhaman_20261102.jpg',
  mimeType: 'image/jpeg',
  pageCount: 1,
  rawText: `
VARDHAMAN MEDISALES DISTRIBUTORS
Survey #45, Peenya Industrial Area, Phase 2, Bangalore
GSTIN: 29AAGFV4419E1Z8  |  DL: 20B/KA-B12/77890
PHONE: +91 9845012345

INVOICE NO: VM-88192
DATE: 02/11/2026

ITEM: CEFTUM 500MG TAB
BATCH: CF500-99
EXP: 11-28
QTY: 20
FREE: 2
RATE: 380.00
MRP: 520.00
DISC: 5.0%
GST: 12.0%

TAXABLE: 7220.00
GST 12%: 866.40
TOTAL: 8086.40
`,
  supplier: {
    rawName: 'VARDHAMAN MEDISALES DISTRIBUTORS',
    matchedSupplierId: 'supplier-vardhaman-02',
    gstin: '29AAGFV4419E1Z8',
    dlNumber: '20B/KA-B12/77890',
    address: 'Survey #45, Peenya Industrial Area, Phase 2, Bangalore',
    phone: '+91 9845012345',
    matchConfidence: 0.98,
    isNew: false,
  },
  invoice: {
    invoiceNumber: 'VM-88192',
    invoiceDate: '2026-11-02',
  },
  items: [
    {
      id: 'item-vm-01',
      rawDescription: 'CEFTUM 500MG TAB',
      matchedProductId: 'prod-ceftum-500',
      matchedProductName: 'Ceftum 500mg Tablet',
      matchConfidence: 0.92,
      isNewProduct: false,
      packSize: "10'S",
      hsnCode: '3004',
      batchNumber: 'CF500-99',
      expiryDate: '2028-11-30',
      billedQuantity: 20,
      freeQuantity: 2,
      unitCost: 380.00,
      mrp: 520.00,
      discountPercent: 5.0,
      taxPercent: 12.0,
      taxAmount: 866.40,
      totalAmount: 8086.40,
    },
  ],
  financials: {
    subtotal: 7600.00,
    discountAmount: 380.00,
    taxAmount: 866.40,
    roundOff: 0.00,
    totalAmount: 8086.40,
    isReconciled: true,
    reconciliationVariance: 0.00,
  },
}

/**
 * Fixture 3: Short-Expiry Alert Bill (< 6 months)
 */
export const SHORT_EXPIRY_FIXTURE: MockInvoiceFixture = {
  filename: 'ShortExpiry_Invoice_9912.pdf',
  mimeType: 'application/pdf',
  pageCount: 1,
  rawText: `
SURYA PHARMA DISTRIBUTORS
GSTIN: 29AAGCS7712Q1ZX  DL: 20B/KA-B01/22331
INVOICE: SP-9912  DATE: 03/11/2026

1. INSULIN GLARGINE 100IU/ML - BATCH: INS-772 - EXP: 01/27 - QTY: 10 - RATE: 450.00 - GST: 5.0%
(Expiring within 3 months!)
`,
  supplier: {
    rawName: 'SURYA PHARMA DISTRIBUTORS',
    matchedSupplierId: 'supplier-surya-03',
    gstin: '29AAGCS7712Q1ZX',
    dlNumber: '20B/KA-B01/22331',
    matchConfidence: 0.95,
    isNew: false,
  },
  invoice: {
    invoiceNumber: 'SP-9912',
    invoiceDate: '2026-11-03',
  },
  items: [
    {
      id: 'item-exp-01',
      rawDescription: 'INSULIN GLARGINE 100IU/ML',
      matchedProductId: 'prod-insulin-glargine',
      matchedProductName: 'Insulin Glargine 100IU/ml Cartridge',
      matchConfidence: 0.91,
      isNewProduct: false,
      packSize: '1X3ML',
      hsnCode: '3004',
      batchNumber: 'INS-772',
      expiryDate: '2027-01-31', // Within 3 months of 2026-11-03!
      billedQuantity: 10,
      freeQuantity: 0,
      unitCost: 450.00,
      mrp: 620.00,
      discountPercent: 0.0,
      taxPercent: 5.0,
      taxAmount: 225.00,
      totalAmount: 4725.00,
      isNearExpiry: true,
    },
  ],
  financials: {
    subtotal: 4500.00,
    discountAmount: 0.00,
    taxAmount: 225.00,
    roundOff: 0.00,
    totalAmount: 4725.00,
    isReconciled: true,
    reconciliationVariance: 0.00,
  },
}

/**
 * Fixture 4: Multi-Slab GST Bill (0%, 5%, 12%, 18%)
 */
export const MULTI_SLAB_GST_FIXTURE: MockInvoiceFixture = {
  filename: 'MultiSlab_GST_Bill_880.pdf',
  mimeType: 'application/pdf',
  pageCount: 1,
  rawText: `
APEX HEALTHCARE WHOLESALE
GSTIN: 29AAHCA9918K1ZZ  DL: 20B/KA-B99/11228
INVOICE: AHW-880  DATE: 03/11/2026

1. ORS ELECTRAL POWDER (0% GST - Exempt) - QTY 50 @ 18.00 = 900.00
2. HUMAN ALBUMIN 20% (5% GST) - QTY 5 @ 2200.00 = 11000.00 + 550.00 GST = 11550.00
3. AZITHROMYCIN 500MG (12% GST) - QTY 20 @ 75.00 = 1500.00 + 180.00 GST = 1680.00
4. STERILLIUM HAND RUB 500ML (18% GST) - QTY 10 @ 250.00 = 2500.00 + 450.00 GST = 2950.00
`,
  supplier: {
    rawName: 'APEX HEALTHCARE WHOLESALE',
    matchedSupplierId: 'supplier-apex-04',
    gstin: '29AAHCA9918K1ZZ',
    dlNumber: '20B/KA-B99/11228',
    matchConfidence: 0.97,
    isNew: false,
  },
  invoice: {
    invoiceNumber: 'AHW-880',
    invoiceDate: '2026-11-03',
  },
  items: [
    {
      id: 'item-multi-01',
      rawDescription: 'ORS ELECTRAL POWDER 21.8G',
      matchedProductId: 'prod-ors-electral',
      matchedProductName: 'Electral ORS Powder 21.8g',
      matchConfidence: 0.95,
      isNewProduct: false,
      packSize: '21.8G',
      hsnCode: '3004',
      batchNumber: 'ORS-901',
      expiryDate: '2028-09-30',
      billedQuantity: 50,
      freeQuantity: 0,
      unitCost: 18.00,
      mrp: 23.50,
      discountPercent: 0.0,
      taxPercent: 0.0,
      taxAmount: 0.00,
      totalAmount: 900.00,
    },
    {
      id: 'item-multi-02',
      rawDescription: 'HUMAN ALBUMIN 20% 100ML',
      matchedProductId: 'prod-albumin-20',
      matchedProductName: 'Human Albumin Infusion 20%',
      matchConfidence: 0.93,
      isNewProduct: false,
      packSize: '100ML',
      hsnCode: '3004',
      batchNumber: 'ALB-552',
      expiryDate: '2028-05-31',
      billedQuantity: 5,
      freeQuantity: 0,
      unitCost: 2200.00,
      mrp: 3100.00,
      discountPercent: 0.0,
      taxPercent: 5.0,
      taxAmount: 550.00,
      totalAmount: 11550.00,
    },
    {
      id: 'item-multi-03',
      rawDescription: 'AZITHROMYCIN 500MG TAB',
      matchedProductId: 'prod-azithro-500',
      matchedProductName: 'Azithromycin 500mg Tablet',
      matchConfidence: 0.96,
      isNewProduct: false,
      packSize: "5'S",
      hsnCode: '3004',
      batchNumber: 'AZI-441',
      expiryDate: '2028-07-31',
      billedQuantity: 20,
      freeQuantity: 0,
      unitCost: 75.00,
      mrp: 115.00,
      discountPercent: 0.0,
      taxPercent: 12.0,
      taxAmount: 180.00,
      totalAmount: 1680.00,
    },
    {
      id: 'item-multi-04',
      rawDescription: 'STERILLIUM HAND RUB 500ML',
      matchedProductId: 'prod-sterillium-500',
      matchedProductName: 'Sterillium Hand Sanitizer 500ml',
      matchConfidence: 0.91,
      isNewProduct: false,
      packSize: '500ML',
      hsnCode: '3808',
      batchNumber: 'STR-118',
      expiryDate: '2028-10-31',
      billedQuantity: 10,
      freeQuantity: 0,
      unitCost: 250.00,
      mrp: 360.00,
      discountPercent: 0.0,
      taxPercent: 18.0,
      taxAmount: 450.00,
      totalAmount: 2950.00,
    },
  ],
  financials: {
    subtotal: 15900.00,
    discountAmount: 0.00,
    taxAmount: 1180.00,
    roundOff: 0.00,
    totalAmount: 17080.00,
    isReconciled: true,
    reconciliationVariance: 0.00,
  },
}

/**
 * Fixture 5: Math Discrepancy Invoice (Unreconciled)
 */
export const UNRECONCILED_MATH_FIXTURE: MockInvoiceFixture = {
  filename: 'Discrepant_Invoice_101.pdf',
  mimeType: 'application/pdf',
  pageCount: 1,
  rawText: 'DISCREPANT INVOICE - Total printed 5000.00 but items sum to 5120.00',
  supplier: {
    rawName: 'RANDOM PHARMA WHOLESALE',
    gstin: '29ABCDE9999F1Z1',
    dlNumber: '20B/KA-B00/99999',
    matchConfidence: 0.85,
    isNew: false,
  },
  invoice: {
    invoiceNumber: 'DISC-101',
    invoiceDate: '2026-11-03',
  },
  items: [
    {
      id: 'item-disc-01',
      rawDescription: 'PARACETAMOL 650MG TAB',
      matchedProductId: 'prod-pcm-650',
      matchedProductName: 'Paracetamol 650mg Tablet',
      matchConfidence: 0.95,
      isNewProduct: false,
      packSize: "15'S",
      hsnCode: '3004',
      batchNumber: 'PCM-10',
      expiryDate: '2028-06-30',
      billedQuantity: 200,
      freeQuantity: 0,
      unitCost: 22.00,
      mrp: 32.00,
      discountPercent: 0.0,
      taxPercent: 12.0,
      taxAmount: 528.00,
      totalAmount: 4928.00,
    },
  ],
  financials: {
    subtotal: 4400.00,
    discountAmount: 0.00,
    taxAmount: 528.00,
    roundOff: 0.00,
    totalAmount: 5120.00, // Extracted invoice says 5000.00! Variance = 120.00
    isReconciled: false,
    reconciliationVariance: 120.00,
  },
}
