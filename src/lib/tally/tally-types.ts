// ─────────────────────────────────────────────────────────────
// Tally ERP / TallyPrime Integration Types & Defaults
// ─────────────────────────────────────────────────────────────

export interface TallyConfig {
  serverUrl: string
  companyName: string
  autoSyncSales: boolean
  autoSyncPurchases: boolean
  cashLedger: string
  bankLedger: string
  salesLedger: string
  purchaseLedger: string
  cgstOutputLedger: string
  sgstOutputLedger: string
  igstOutputLedger: string
  cgstInputLedger: string
  sgstInputLedger: string
  igstInputLedger: string
  roundOffLedger: string
  discountLedger: string
  defaultGodown: string
}

export const DEFAULT_TALLY_CONFIG: TallyConfig = {
  serverUrl: 'http://localhost:9000',
  companyName: 'PharmaCare Pharmacy',
  autoSyncSales: false,
  autoSyncPurchases: false,
  cashLedger: 'Cash',
  bankLedger: 'Bank Account',
  salesLedger: 'Sales - Medicines',
  purchaseLedger: 'Purchases - Medicines',
  cgstOutputLedger: 'Output CGST',
  sgstOutputLedger: 'Output SGST',
  igstOutputLedger: 'Output IGST',
  cgstInputLedger: 'Input CGST',
  sgstInputLedger: 'Input SGST',
  igstInputLedger: 'Input IGST',
  roundOffLedger: 'Round Off',
  discountLedger: 'Discount Allowed',
  defaultGodown: 'Main Location',
}

export type TallyExportType =
  | 'sales'
  | 'purchases'
  | 'debit_notes'
  | 'customers'
  | 'suppliers'
  | 'stock_items'
  | 'units'
  | 'price_lists'
  | 'batch_summary'
  | 'company_setup'
  | 'daybook'
  | 'gstr1'

export type TallyExportFormat = 'xml' | 'csv' | 'json'

export interface TallyExportQuery {
  type: TallyExportType
  format?: TallyExportFormat
  startDate?: string
  endDate?: string
  branchId?: string
  preview?: boolean
}

export interface TallyExportSummary {
  exportType: TallyExportType
  voucherCount: number
  totalAmount: number
  dateRange: {
    startDate?: string
    endDate?: string
  }
  generatedAt: string
}

export interface TallyPreviewResponse {
  success: boolean
  summary: TallyExportSummary
  filename?: string
  xmlPreview: string
  fullXmlLength: number
  csvPreview?: string
  gstr1Summary?: Gstr1ReportSummary
  batchSummaryItems?: BatchSummaryItem[]
}

// ─────────────────────────────────────────────────────────────
// Live Tally Push & Server Communication Types
// ─────────────────────────────────────────────────────────────

export interface TallyServerStatus {
  online: boolean
  url: string
  latencyMs?: number
  message?: string
  checkedAt: string
}

export interface TallyPushResult {
  success: boolean
  status: 'SYNCED' | 'FAILED' | 'OFFLINE'
  createdCount: number
  alteredCount: number
  errorCount: number
  voucherNumber?: string
  errorMessage?: string
  rawResponse?: string
  durationMs: number
}

export type TallySyncEntityType = 'SALE' | 'PURCHASE' | 'CUSTOMER' | 'PRODUCT'

export type TallySyncStatus = 'SYNCED' | 'FAILED' | 'PENDING' | 'OFFLINE'

export interface TallySyncLogEntry {
  id: string
  entityType: TallySyncEntityType
  entityId: string
  referenceNumber: string
  entityName?: string
  amount?: number
  status: TallySyncStatus
  message: string
  attempts: number
  lastAttemptAt: string
  createdAt: string
}

// ─────────────────────────────────────────────────────────────
// GSTR-1 Reporting & Export Types
// ─────────────────────────────────────────────────────────────

export interface Gstr1B2bLine {
  customerGstin: string
  customerName: string
  invoiceNumber: string
  invoiceDate: string
  invoiceValue: number
  placeOfSupply: string
  reverseCharge: 'N' | 'Y'
  invoiceType: 'Regular'
  taxRate: number
  taxableValue: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  cessAmount: number
}

export interface Gstr1B2cLine {
  type: 'OE' // Other Outward Supplies
  placeOfSupply: string
  taxRate: number
  taxableValue: number
  cessAmount: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
}

export interface Gstr1HsnLine {
  hsnCode: string
  description: string
  uqc: string
  totalQuantity: number
  totalValue: number
  taxableValue: number
  integratedTaxAmount: number
  centralTaxAmount: number
  stateTaxAmount: number
  cessAmount: number
}

export interface Gstr1ReportSummary {
  period: { startDate?: string; endDate?: string }
  totalInvoices: number
  b2bInvoicesCount: number
  b2bTaxableValue: number
  b2cInvoicesCount: number
  b2cTaxableValue: number
  totalTaxableValue: number
  totalCgst: number
  totalSgst: number
  totalIgst: number
  totalTax: number
  totalInvoiceValue: number
  hsnCount: number
}

// ─────────────────────────────────────────────────────────────
// Pharma Accounting & Tally Foundation Types
// ─────────────────────────────────────────────────────────────

export interface DebitNoteForTally {
  id: string
  returnNumber: string
  invoiceNumber?: string | null
  returnDate: Date | string
  reason: string
  subtotal?: number | string | { toString(): string }
  taxAmount?: number | string | { toString(): string }
  cgstAmount?: number | string | { toString(): string } | null
  sgstAmount?: number | string | { toString(): string } | null
  igstAmount?: number | string | { toString(): string } | null
  totalAmount: number | string | { toString(): string }
  supplier: {
    id: string
    name: string
    gstin?: string | null
    state?: string | null
    phone?: string | null
    address?: string | null
  }
  items: {
    id: string
    quantity: number
    unitCost: number | string | { toString(): string }
    totalAmount: number | string | { toString(): string }
    taxAmount?: number | string | { toString(): string } | null
    product: {
      name: string
      sku?: string | null
      hsnCode?: string | null
      unitOfMeasure?: string | null
    }
    batchNumber?: string | null
    expiryDate?: Date | string | null
    manufacturingDate?: Date | string | null
    isExpired?: boolean
  }[]
}

export interface UnitForTally {
  name: string
  formalName?: string
  symbol?: string
  isSimple: boolean
  decimalPlaces?: number
  baseUnit?: string
  additionalUnit?: string
  conversion?: number
}

export interface PriceRuleForTally {
  productName: string
  priceLevel: 'Retailer' | 'Stockist' | 'Wholesaler' | 'Consumer' | string
  rate: number
  unitOfMeasure?: string
  discountPercent?: number
}

export interface PriceListForTally {
  effectiveDate: Date | string
  rules: PriceRuleForTally[]
}

export interface CompanySetupForTally {
  companyName: string
  legalName?: string | null
  stateName: string
  gstin: string
  dlNumber?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  registrationType?: 'Regular' | 'Composition'
  maintainBatchWise?: boolean
  trackExpiryDates?: boolean
  trackMfgDates?: boolean
  financialYearStart?: Date | string
}

export interface BatchSummaryItem {
  id: string
  productId: string
  productName: string
  genericName?: string | null
  sku?: string | null
  unitOfMeasure?: string | null
  hsnCode?: string | null
  batchNumber: string
  manufacturingDate?: Date | string | null
  expiryDate: Date | string
  quantity: number
  availableQuantity: number
  mrp: number
  purchasePrice: number
  status: 'ACTIVE' | 'EXPIRED' | 'BLOCKED' | 'DISPOSED' | 'EXHAUSTED'
  daysToExpiry: number
  isExpired: boolean
  isNearExpiry: boolean
  expiryStatus?: 'ACTIVE' | 'NEAR_EXPIRY' | 'EXPIRED'
  currentStock?: number
  unit?: string | null
  costPrice?: number
  sellingPrice?: number
  branchName?: string
}
