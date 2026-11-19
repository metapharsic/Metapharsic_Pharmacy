/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

import {
  BillConfirmationDialog,
  BillMetadataForm,
  BillSummaryFooter,
  computeBillTotals,
  computeLineItemAmounts,
  DocumentPreviewPane,
  DocumentUploadZone,
  isShortExpiryDate,
  LineItemRowEditor,
  LineItemsReviewTable,
  PurchaseBillScannerView,
  ScanningProgressCard,
  type MasterBranch,
  type MasterProduct,
  type MasterSupplier,
  type ReviewBillData,
  type ReviewBillItem,
} from '../index'

// ─── Mocks ───────────────────────────────────────────────────

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/purchases/scan',
}))

const mockToast = {
  toast: jest.fn(),
  success: jest.fn(),
  error: jest.fn(),
}
jest.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => mockToast,
}))

// Mock URL object methods in jsdom
if (!global.URL.createObjectURL) {
  global.URL.createObjectURL = jest.fn(() => 'blob:mock-preview-url')
}
if (!global.URL.revokeObjectURL) {
  global.URL.revokeObjectURL = jest.fn()
}

// ─── Fixtures ────────────────────────────────────────────────

const MOCK_SUPPLIERS: MasterSupplier[] = [
  {
    id: 'supp-mahaveer',
    name: 'MAHAVEER PHARMA AGENCIES PVT LTD',
    gstin: '29AABCM8921F1ZT',
    dlNumber: '20B/KA-B21/48911',
  },
  {
    id: 'supp-vardhaman',
    name: 'VARDHAMAN MEDISALES',
    gstin: '27AABCV5544R1Z8',
    dlNumber: '20B/MH-TZ2/33120',
  },
]

const MOCK_PRODUCTS: MasterProduct[] = [
  {
    id: 'prod-aug-625',
    name: 'Augmentin 625 Duo Tablet',
    sku: 'AUG-625-TAB',
    mrp: 204.5,
    ptr: 147.24,
    costPrice: 147.24,
    unitOfMeasure: "10'S",
    gstRate: 12,
  },
  {
    id: 'prod-pcm-650',
    name: 'Dolo 650 Tablet',
    sku: 'DOLO-650',
    mrp: 33.6,
    ptr: 24.5,
    costPrice: 24.5,
    unitOfMeasure: "15'S",
    gstRate: 12,
  },
]

const MOCK_BRANCHES: MasterBranch[] = [
  { id: 'branch-main', name: 'Main Pharmacy Branch', isHeadOffice: true },
  { id: 'branch-south', name: 'South City Branch', isHeadOffice: false },
]

const createSampleBillData = (overrides?: Partial<ReviewBillData>): ReviewBillData => ({
  supplierName: 'MAHAVEER PHARMA AGENCIES PVT LTD',
  supplierId: 'supp-mahaveer',
  supplierGstin: '29AABCM8921F1ZT',
  supplierDlNumber: '20B/KA-B21/48911',
  supplierConfidence: 1.0,
  isNewSupplier: false,
  invoiceNumber: 'INV-2026-8891',
  invoiceDate: '2026-11-03',
  branchId: 'branch-main',
  items: [
    {
      id: 'item-1',
      productId: 'prod-aug-625',
      productName: 'Augmentin 625 Duo Tablet',
      sku: 'AUG-625-TAB',
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
      matchConfidence: 0.98,
      isNewProduct: false,
      isShortExpiry: false,
    },
  ],
  subtotal: 7214.76,
  taxAmount: 865.77,
  discountAmount: 147.24,
  roundOff: 0.0,
  totalAmount: 8080.53,
  rawExtractedTotal: 8080.53,
  isReconciled: true,
  reconciliationVariance: 0.0,
  confidence: 0.96,
  ...overrides,
})

describe('Purchase Bill Scanner UI Component Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    globalThis.fetch = jest.fn()
  })

  // ─────────────────────────────────────────────────────────────
  // 1. Math and Expiry Helpers
  // ─────────────────────────────────────────────────────────────
  describe('Mathematical & Domain Utility Helpers', () => {
    it('calculates line taxable, tax, and total amount accurately', () => {
      // 50 * 147.24 = 7362.00. 2% discount = 147.24. Taxable = 7214.76.
      // 12% GST = 865.7712 -> 865.77. Total = 8080.53.
      const res = computeLineItemAmounts({
        billedQuantity: 50,
        unitCost: 147.24,
        discountPercent: 2,
        taxPercent: 12,
      })

      expect(res.taxable).toBe(7214.76)
      expect(res.taxAmount).toBe(865.77)
      expect(res.totalAmount).toBe(8080.53)
    })

    it('handles zero discount and zero tax slabs', () => {
      const res = computeLineItemAmounts({
        billedQuantity: 10,
        unitCost: 100,
        discountPercent: 0,
        taxPercent: 0,
      })

      expect(res.taxable).toBe(1000)
      expect(res.taxAmount).toBe(0)
      expect(res.totalAmount).toBe(1000)
    })

    it('computes bill totals and detects reconciliation variance', () => {
      const items: ReviewBillItem[] = [
        {
          id: '1',
          productId: 'p1',
          productName: 'P1',
          batchNumber: 'B1',
          expiryDate: '2028-12-31',
          billedQuantity: 10,
          freeQuantity: 1,
          unitCost: 100,
          mrp: 120,
          discountPercent: 0,
          taxPercent: 12,
          taxAmount: 120,
          totalAmount: 1120,
          matchConfidence: 1,
          isNewProduct: false,
        },
      ]

      // Target matches computed total
      const matchTotals = computeBillTotals(items, 1120, 0)
      expect(matchTotals.totalAmount).toBe(1120)
      expect(matchTotals.variance).toBe(0)
      expect(matchTotals.isReconciled).toBe(true)

      // Target differs by Rs. 50 (unreconciled)
      const mismatchTotals = computeBillTotals(items, 1170, 0)
      expect(mismatchTotals.variance).toBe(50)
      expect(mismatchTotals.isReconciled).toBe(false)
    })

    it('identifies short-expiry medicines less than 6 months away', () => {
      const pastDate = '2024-01-01'
      expect(isShortExpiryDate(pastDate)).toBe(true)

      const futureDate = '2030-12-31'
      expect(isShortExpiryDate(futureDate)).toBe(false)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 2. DocumentUploadZone Component
  // ─────────────────────────────────────────────────────────────
  describe('DocumentUploadZone', () => {
    it('renders drag-and-drop dropzone with file format hints', () => {
      render(<DocumentUploadZone onFileSelected={jest.fn()} />)
      expect(screen.getByText(/Drag & drop purchase bill document/i)).toBeInTheDocument()
      expect(screen.getByText(/PDF/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Browse Files/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Capture Photo/i })).toBeInTheDocument()
    })

    it('invokes onFileSelected when a valid PDF file is selected via input', () => {
      const onFileSelected = jest.fn()
      render(<DocumentUploadZone onFileSelected={onFileSelected} />)

      const fileInput = screen.getByTestId('bill-file-input')
      const file = new File(['%PDF-1.4 mock content'], 'invoice.pdf', {
        type: 'application/pdf',
      })

      fireEvent.change(fileInput, { target: { files: [file] } })
      expect(onFileSelected).toHaveBeenCalledWith(file)
    })

    it('rejects unsupported file formats and displays error alert', () => {
      const onFileSelected = jest.fn()
      render(<DocumentUploadZone onFileSelected={onFileSelected} />)

      const fileInput = screen.getByTestId('bill-file-input')
      const invalidFile = new File(['malicious'], 'script.exe', {
        type: 'application/x-msdownload',
      })

      fireEvent.change(fileInput, { target: { files: [invalidFile] } })
      expect(onFileSelected).not.toHaveBeenCalled()
      expect(screen.getByText(/Invalid file format/i)).toBeInTheDocument()
    })

    it('rejects oversized files exceeding 15MB limit', () => {
      const onFileSelected = jest.fn()
      render(<DocumentUploadZone onFileSelected={onFileSelected} />)

      const fileInput = screen.getByTestId('bill-file-input')
      const oversizedFile = new File([''], 'huge.pdf', { type: 'application/pdf' })
      Object.defineProperty(oversizedFile, 'size', { value: 16 * 1024 * 1024 }) // 16MB

      fireEvent.change(fileInput, { target: { files: [oversizedFile] } })
      expect(onFileSelected).not.toHaveBeenCalled()
      expect(screen.getByText(/File is too large/i)).toBeInTheDocument()
    })

    it('displays summary and replace/clear actions when a file is selected', () => {
      const onClear = jest.fn()
      const file = new File(['data'], 'mahaveer-bill.pdf', { type: 'application/pdf' })

      render(
        <DocumentUploadZone
          onFileSelected={jest.fn()}
          selectedFile={file}
          onClearFile={onClear}
        />
      )

      expect(screen.getByText('mahaveer-bill.pdf')).toBeInTheDocument()
      expect(screen.getByText(/Ready for OCR parsing/i)).toBeInTheDocument()

      const clearBtn = screen.getByRole('button', { name: /Remove file/i })
      fireEvent.click(clearBtn)
      expect(onClear).toHaveBeenCalledTimes(1)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 3. ScanningProgressCard Component
  // ─────────────────────────────────────────────────────────────
  describe('ScanningProgressCard', () => {
    it('renders progress bar and stage indicators during extraction', () => {
      render(
        <ScanningProgressCard
          currentStage="extracting"
          progressPercent={70}
          overallConfidence={0.94}
        />
      )

      expect(screen.getByText(/Automated Bill Extraction Pipeline/i)).toBeInTheDocument()
      expect(screen.getByText('70%')).toBeInTheDocument()
      expect(screen.getByText('Pharma Entity Parsing')).toBeInTheDocument()
      expect(screen.getByText('OCR Recognition')).toBeInTheDocument()
    })

    it('displays completion header and confidence badge when ready', () => {
      render(
        <ScanningProgressCard
          currentStage="ready"
          progressPercent={100}
          overallConfidence={0.96}
        />
      )

      expect(screen.getByText(/Extraction & Verification Complete/i)).toBeInTheDocument()
      expect(screen.getByText(/96% Confidence/i)).toBeInTheDocument()
    })

    it('renders error message and retry action when scanning fails', () => {
      const onRetry = jest.fn()
      render(
        <ScanningProgressCard
          currentStage="error"
          progressPercent={40}
          errorMessage="OCR worker timeout on blurred document"
          onRetry={onRetry}
        />
      )

      expect(screen.getByText('OCR worker timeout on blurred document')).toBeInTheDocument()
      const retryBtn = screen.getByRole('button', { name: /Retry Scan/i })
      fireEvent.click(retryBtn)
      expect(onRetry).toHaveBeenCalledTimes(1)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 4. DocumentPreviewPane Component
  // ─────────────────────────────────────────────────────────────
  describe('DocumentPreviewPane', () => {
    it('renders empty state when no fileUrl is provided', () => {
      render(<DocumentPreviewPane />)
      expect(screen.getByText(/No document loaded/i)).toBeInTheDocument()
    })

    it('renders PDF iframe and zoom controls when fileUrl is present', () => {
      render(
        <DocumentPreviewPane
          fileUrl="blob:mock-pdf"
          fileName="distributor-bill.pdf"
          mimeType="application/pdf"
          pageCount={3}
        />
      )

      expect(screen.getByText('distributor-bill.pdf')).toBeInTheDocument()
      expect(screen.getByText('100%')).toBeInTheDocument()
      expect(screen.getByText('1 / 3')).toBeInTheDocument()

      // Zoom In
      const zoomInBtn = screen.getByRole('button', { name: /Zoom in/i })
      fireEvent.click(zoomInBtn)
      expect(screen.getByText('125%')).toBeInTheDocument()

      // Zoom Out
      const zoomOutBtn = screen.getByRole('button', { name: /Zoom out/i })
      fireEvent.click(zoomOutBtn)
      expect(screen.getByText('100%')).toBeInTheDocument()

      // Multi-page navigation
      const nextBtn = screen.getByRole('button', { name: /Next page/i })
      fireEvent.click(nextBtn)
      expect(screen.getByText('2 / 3')).toBeInTheDocument()

      const prevBtn = screen.getByRole('button', { name: /Previous page/i })
      fireEvent.click(prevBtn)
      expect(screen.getByText('1 / 3')).toBeInTheDocument()
    })

    it('rotates document view by 90 degrees clockwise on rotate click', () => {
      render(
        <DocumentPreviewPane
          fileUrl="blob:mock-img"
          fileName="bill-photo.jpg"
          mimeType="image/jpeg"
        />
      )

      const rotateBtn = screen.getByRole('button', { name: /Rotate 90 degrees clockwise/i })
      fireEvent.click(rotateBtn)
      // Expect rotate button click does not error and resets cleanly
      const resetBtn = screen.getByRole('button', { name: /Reset zoom and rotation/i })
      fireEvent.click(resetBtn)
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 5. BillMetadataForm Component
  // ─────────────────────────────────────────────────────────────
  describe('BillMetadataForm', () => {
    it('pre-fills distributor and invoice fields', () => {
      const billData = createSampleBillData()
      render(
        <BillMetadataForm
          billData={billData}
          onChange={jest.fn()}
          suppliers={MOCK_SUPPLIERS}
          branches={MOCK_BRANCHES}
        />
      )

      expect(screen.getByText(/Distributor & Invoice Metadata/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('INV-2026-8891')).toBeInTheDocument()
      expect(screen.getByDisplayValue('2026-11-03')).toBeInTheDocument()
      expect(screen.getByDisplayValue('20B/KA-B21/48911')).toBeInTheDocument()
    })

    it('calls onChange when invoice number is edited', () => {
      const billData = createSampleBillData()
      const onChange = jest.fn()

      render(
        <BillMetadataForm
          billData={billData}
          onChange={onChange}
          suppliers={MOCK_SUPPLIERS}
          branches={MOCK_BRANCHES}
        />
      )

      const invInput = screen.getByDisplayValue('INV-2026-8891')
      fireEvent.change(invInput, { target: { value: 'INV-NEW-999' } })
      expect(onChange).toHaveBeenCalledWith({ invoiceNumber: 'INV-NEW-999' })
    })

    it('surfaces new distributor warning badge when isNewSupplier is true', () => {
      const billData = createSampleBillData({
        supplierId: undefined,
        supplierName: 'UNREGISTERED DISTRIBUTOR AGENCIES',
        isNewSupplier: true,
      })

      render(
        <BillMetadataForm
          billData={billData}
          onChange={jest.fn()}
          suppliers={MOCK_SUPPLIERS}
          branches={MOCK_BRANCHES}
        />
      )

      expect(screen.getByText(/New Distributor Detected/i)).toBeInTheDocument()
      expect(screen.getByText(/This distributor is not in your master records/i)).toBeInTheDocument()
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 6. LineItemRowEditor & LineItemsReviewTable
  // ─────────────────────────────────────────────────────────────
  describe('LineItemRowEditor & Review Table', () => {
    it('renders extracted line items with quantities, rates, and line totals', () => {
      const items = createSampleBillData().items
      render(
        <LineItemsReviewTable
          items={items}
          products={MOCK_PRODUCTS}
          onChangeItems={jest.fn()}
        />
      )

      expect(screen.getByText(/Extracted Line Items \(1\)/i)).toBeInTheDocument()
      expect(screen.getByDisplayValue('26D044')).toBeInTheDocument()
      expect(screen.getByDisplayValue('50')).toBeInTheDocument()
      expect(screen.getByDisplayValue('5')).toBeInTheDocument() // Free quantity
      expect(screen.getByText('₹8080.53')).toBeInTheDocument()
    })

    it('recalculates line total dynamically when billed quantity is changed', () => {
      const item = createSampleBillData().items[0]
      const onChange = jest.fn()

      render(
        <table>
          <tbody>
            <LineItemRowEditor
              item={item}
              index={0}
              products={MOCK_PRODUCTS}
              onChange={onChange}
              onDelete={jest.fn()}
            />
          </tbody>
        </table>
      )

      const qtyInput = screen.getByDisplayValue('50')
      fireEvent.change(qtyInput, { target: { value: '100' } })

      expect(onChange).toHaveBeenCalled()
      const updated = onChange.mock.calls[0][0] as ReviewBillItem
      expect(updated.billedQuantity).toBe(100)
      // 100 * 147.24 = 14724. 2% disc = 294.48. Taxable = 14429.52. 12% GST = 1731.54. Total = 16161.06
      expect(updated.totalAmount).toBe(16161.06)
    })

    it('displays short-expiry alert for batch expiring in under 6 months', () => {
      const nearExpiryDate = new Date()
      nearExpiryDate.setDate(nearExpiryDate.getDate() + 30) // 1 month ahead
      const shortExpIso = nearExpiryDate.toISOString().split('T')[0]

      const item = {
        ...createSampleBillData().items[0],
        expiryDate: shortExpIso,
        isShortExpiry: true,
      }

      render(
        <table>
          <tbody>
            <LineItemRowEditor
              item={item}
              index={0}
              products={MOCK_PRODUCTS}
              onChange={jest.fn()}
              onDelete={jest.fn()}
            />
          </tbody>
        </table>
      )

      expect(screen.getByText(/< 6 months expiry/i)).toBeInTheDocument()
    })

    it('allows adding a new line item and deleting an existing one', () => {
      const items = createSampleBillData().items
      const onChangeItems = jest.fn()

      render(
        <LineItemsReviewTable
          items={items}
          products={MOCK_PRODUCTS}
          onChangeItems={onChangeItems}
        />
      )

      // Add Item
      const addBtn = screen.getByRole('button', { name: /Add Line Item/i })
      fireEvent.click(addBtn)
      expect(onChangeItems).toHaveBeenCalled()
      expect(onChangeItems.mock.calls[0][0].length).toBe(2)

      // Delete Item
      const deleteBtn = screen.getByRole('button', { name: /Delete line item/i })
      fireEvent.click(deleteBtn)
      expect(onChangeItems).toHaveBeenCalledWith([])
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 7. BillSummaryFooter Component
  // ─────────────────────────────────────────────────────────────
  describe('BillSummaryFooter', () => {
    it('displays financial breakdown and reconciled badge when math matches', () => {
      render(
        <BillSummaryFooter
          subtotal={7214.76}
          taxAmount={865.77}
          discountAmount={147.24}
          roundOff={0}
          totalAmount={8080.53}
          extractedTotal={8080.53}
          variance={0}
          isReconciled={true}
          onCommitClick={jest.fn()}
        />
      )

      expect(screen.getByText('₹7214.76')).toBeInTheDocument()
      expect(screen.getByText('+₹865.77')).toBeInTheDocument()
      expect(screen.getByText('-₹147.24')).toBeInTheDocument()
      expect(screen.getAllByText('₹8080.53').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/Invoice Totals Reconciled/i)).toBeInTheDocument()
      expect(screen.getByText(/Math Verified/i)).toBeInTheDocument()
    })

    it('surfaces amber warning alert when variance exceeds statutory tolerance', () => {
      render(
        <BillSummaryFooter
          subtotal={7214.76}
          taxAmount={865.77}
          discountAmount={147.24}
          roundOff={0}
          totalAmount={8080.53}
          extractedTotal={8500.0}
          variance={419.47}
          isReconciled={false}
          onCommitClick={jest.fn()}
        />
      )

      expect(screen.getByText(/Invoice Arithmetic Discrepancy Detected/i)).toBeInTheDocument()
      expect(screen.getByText(/Variance: ₹419.47/i)).toBeInTheDocument()
    })

    it('triggers onCommitClick when Commit button is clicked', () => {
      const onCommit = jest.fn()
      render(
        <BillSummaryFooter
          subtotal={7214.76}
          taxAmount={865.77}
          discountAmount={147.24}
          roundOff={0}
          totalAmount={8080.53}
          extractedTotal={8080.53}
          variance={0}
          isReconciled={true}
          onCommitClick={onCommit}
        />
      )

      const commitBtn = screen.getByRole('button', { name: /Commit & Provision Stock/i })
      fireEvent.click(commitBtn)
      expect(onCommit).toHaveBeenCalledTimes(1)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 8. BillConfirmationDialog Component
  // ─────────────────────────────────────────────────────────────
  describe('BillConfirmationDialog', () => {
    it('renders quantitative summary (supplier, invoice, items, units, amount)', () => {
      const billData = createSampleBillData()
      render(
        <BillConfirmationDialog
          open={true}
          onOpenChange={jest.fn()}
          billData={billData}
          branchName="Main Pharmacy Branch"
          onConfirm={jest.fn()}
        />
      )

      expect(screen.getByText(/Confirm Purchase Ingestion & Live Stock Provisioning/i)).toBeInTheDocument()
      expect(screen.getByText('MAHAVEER PHARMA AGENCIES PVT LTD')).toBeInTheDocument()
      expect(screen.getByText('INV-2026-8891')).toBeInTheDocument()
      expect(screen.getByText('₹8080.53')).toBeInTheDocument()
      expect(screen.getByText('55')).toBeInTheDocument() // 50 + 5 free
      expect(screen.getByText(/Strict Confirmation Safety Rule/i)).toBeInTheDocument()
    })

    it('enforces non-bypassable barrier: confirm button is disabled until checkbox is checked', () => {
      const onConfirm = jest.fn()
      const billData = createSampleBillData()

      render(
        <BillConfirmationDialog
          open={true}
          onOpenChange={jest.fn()}
          billData={billData}
          branchName="Main Pharmacy Branch"
          onConfirm={onConfirm}
        />
      )

      const confirmBtn = screen.getByRole('button', { name: /Confirm & Provision Inventory/i })
      expect(confirmBtn).toBeDisabled()

      // Click Affirmation Checkbox
      const checkbox = screen.getByRole('checkbox', { name: /I have verified all batch numbers/i })
      fireEvent.click(checkbox)

      expect(confirmBtn).not.toBeDisabled()
      fireEvent.click(confirmBtn)
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 9. PurchaseBillScannerView Master Coordinator
  // ─────────────────────────────────────────────────────────────
  describe('PurchaseBillScannerView Master View', () => {
    it('renders dual-view workspace with upload zone, preview pane, and review table', () => {
      render(
        <PurchaseBillScannerView
          initialSuppliers={MOCK_SUPPLIERS}
          initialProducts={MOCK_PRODUCTS}
          initialBranches={MOCK_BRANCHES}
          defaultBranchId="branch-main"
        />
      )

      expect(screen.getByText(/Purchase Bill Scanner & Ingestion/i)).toBeInTheDocument()
      expect(screen.getByText(/Drag & drop purchase bill document/i)).toBeInTheDocument()
      expect(screen.getByText(/Distributor & Invoice Metadata/i)).toBeInTheDocument()
      expect(screen.getByText(/Extracted Line Items \(0\)/i)).toBeInTheDocument()
    })

    it('executes end-to-end scan response ingestion and populates review state', async () => {
      const mockScanResponse = {
        success: true,
        confidence: 0.95,
        document: {
          filename: 'distributor-invoice.pdf',
          mimeType: 'application/pdf',
          pageCount: 1,
        },
        extractedData: {
          supplier: {
            rawName: 'MAHAVEER PHARMA AGENCIES PVT LTD',
            matchedSupplierId: 'supp-mahaveer',
            gstin: '29AABCM8921F1ZT',
            dlNumber: '20B/KA-B21/48911',
            matchConfidence: 1.0,
            isNew: false,
          },
          invoice: {
            invoiceNumber: 'INV-2026-9912',
            invoiceDate: '2026-11-03',
          },
          items: [
            {
              id: 'item-1',
              rawDescription: 'AUGMENTIN 625 DUO TAB',
              matchedProductId: 'prod-aug-625',
              matchedProductName: 'Augmentin 625 Duo Tablet',
              matchConfidence: 0.98,
              isNewProduct: false,
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
          ],
          financials: {
            subtotal: 7214.76,
            taxAmount: 865.77,
            discountAmount: 147.24,
            roundOff: 0.0,
            totalAmount: 8080.53,
            isReconciled: true,
            reconciliationVariance: 0.0,
          },
        },
      }

      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockScanResponse,
      })
      globalThis.fetch = fetchMock

      render(
        <PurchaseBillScannerView
          initialSuppliers={MOCK_SUPPLIERS}
          initialProducts={MOCK_PRODUCTS}
          initialBranches={MOCK_BRANCHES}
          defaultBranchId="branch-main"
        />
      )

      const fileInput = screen.getByTestId('bill-file-input')
      const file = new File(['mock content'], 'distributor-invoice.pdf', {
        type: 'application/pdf',
      })

      fireEvent.change(fileInput, { target: { files: [file] } })

      // Wait for scan pipeline completion
      await waitFor(() => {
        expect(screen.getByDisplayValue('INV-2026-9912')).toBeInTheDocument()
      })

      expect(screen.getByDisplayValue('26D044')).toBeInTheDocument()
      expect(screen.getAllByText('₹8080.53').length).toBeGreaterThanOrEqual(1)
    })
  })
})
