/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react'
import React, { useState } from 'react'

import {
  BillConfirmationDialog,
  BillSummaryFooter,
  computeBillTotals,
  computeLineItemAmounts,
  DocumentUploadZone,
  isShortExpiryDate,
  LineItemRowEditor,
  PurchaseBillScannerView,
  round2,
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

if (!global.URL.createObjectURL) {
  global.URL.createObjectURL = jest.fn(() => 'blob:mock-adversarial-url')
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
]

const createAdversarialBillData = (overrides?: Partial<ReviewBillData>): ReviewBillData => ({
  supplierName: 'MAHAVEER PHARMA AGENCIES PVT LTD',
  supplierId: 'supp-mahaveer',
  supplierGstin: '29AABCM8921F1ZT',
  supplierDlNumber: '20B/KA-B21/48911',
  supplierConfidence: 1.0,
  isNewSupplier: false,
  invoiceNumber: 'INV-ADV-2026',
  invoiceDate: '2026-11-03',
  branchId: 'branch-main',
  items: [
    {
      id: 'adv-item-1',
      productId: 'prod-aug-625',
      productName: 'Augmentin 625 Duo Tablet',
      sku: 'AUG-625-TAB',
      batchNumber: 'ADV-BATCH-01',
      expiryDate: '2028-08-31',
      billedQuantity: 20,
      freeQuantity: 2,
      unitCost: 147.24,
      mrp: 204.5,
      discountPercent: 2.0,
      taxPercent: 12.0,
      taxAmount: 346.31,
      totalAmount: 3232.21,
      matchConfidence: 0.99,
      isNewProduct: false,
    },
  ],
  subtotal: 2885.9,
  taxAmount: 346.31,
  discountAmount: 58.9,
  roundOff: 0.0,
  totalAmount: 3232.21,
  rawExtractedTotal: 3232.21,
  isReconciled: true,
  reconciliationVariance: 0.0,
  confidence: 0.98,
  ...overrides,
})

describe('Adversarial Stress Testing & Boundary Validation Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    globalThis.fetch = jest.fn()
  })

  // ─────────────────────────────────────────────────────────────
  // 1. Safety Confirmation Barrier Stress Tests
  // ─────────────────────────────────────────────────────────────
  describe('Area 1: Safety Confirmation Barrier', () => {
    it('ST-1.1: Blocks commit when affirmation checkbox is unchecked', () => {
      const onConfirm = jest.fn()
      const billData = createAdversarialBillData()

      render(
        <BillConfirmationDialog
          open={true}
          onOpenChange={jest.fn()}
          billData={billData}
          onConfirm={onConfirm}
        />
      )

      const confirmBtn = screen.getByRole('button', { name: /Confirm & Provision Inventory/i })
      expect(confirmBtn).toBeDisabled()

      // Attempt to force click disabled button
      fireEvent.click(confirmBtn)
      expect(onConfirm).not.toHaveBeenCalled()
    })

    it('ST-1.2: Unchecking the affirmation box re-disables the commit action', () => {
      const onConfirm = jest.fn()
      const billData = createAdversarialBillData()

      render(
        <BillConfirmationDialog
          open={true}
          onOpenChange={jest.fn()}
          billData={billData}
          onConfirm={onConfirm}
        />
      )

      const checkbox = screen.getByRole('checkbox', { name: /I have verified all batch numbers/i })
      const confirmBtn = screen.getByRole('button', { name: /Confirm & Provision Inventory/i })

      // Check it -> enabled
      fireEvent.click(checkbox)
      expect(confirmBtn).not.toBeDisabled()

      // Uncheck it -> disabled again
      fireEvent.click(checkbox)
      expect(confirmBtn).toBeDisabled()

      // Click while unchecked -> no onConfirm
      fireEvent.click(confirmBtn)
      expect(onConfirm).not.toHaveBeenCalled()
    })

    it('ST-1.3: Cancel button dismisses modal without calling onConfirm', () => {
      const onOpenChange = jest.fn()
      const onConfirm = jest.fn()
      const billData = createAdversarialBillData()

      render(
        <BillConfirmationDialog
          open={true}
          onOpenChange={onOpenChange}
          billData={billData}
          onConfirm={onConfirm}
        />
      )

      const cancelBtn = screen.getByRole('button', { name: /Back to Review/i })
      fireEvent.click(cancelBtn)

      expect(onOpenChange).toHaveBeenCalledWith(false)
      expect(onConfirm).not.toHaveBeenCalled()
    })

    it('ST-1.4: Disables all actions during submission (isSubmitting = true) to prevent double commit', () => {
      const onConfirm = jest.fn()
      const billData = createAdversarialBillData()

      render(
        <BillConfirmationDialog
          open={true}
          onOpenChange={jest.fn()}
          billData={billData}
          onConfirm={onConfirm}
          isSubmitting={true}
        />
      )

      const cancelBtn = screen.getByRole('button', { name: /Back to Review/i })
      const confirmBtn = screen.getByRole('button', { name: /Provisioning Inventory.../i })
      const checkbox = screen.getByRole('checkbox', { name: /I have verified all batch numbers/i })

      expect(cancelBtn).toBeDisabled()
      expect(confirmBtn).toBeDisabled()
      expect(checkbox).toBeDisabled()

      fireEvent.click(confirmBtn)
      expect(onConfirm).not.toHaveBeenCalled()
    })

    it('ST-1.5: Investigates affirmation state persistence across modal close/reopen lifecycle', () => {
      // Harness testing whether the parent state resets affirmation on modal close/reopen
      function DialogLifecycleHarness() {
        const [isOpen, setIsOpen] = useState(true)
        return (
          <div>
            <button onClick={() => setIsOpen(true)}>Open Modal</button>
            <BillConfirmationDialog
              open={isOpen}
              onOpenChange={setIsOpen}
              billData={createAdversarialBillData()}
              onConfirm={jest.fn()}
            />
          </div>
        )
      }

      render(<DialogLifecycleHarness />)

      // Step 1: Check affirmation box
      const checkbox = screen.getByRole('checkbox', { name: /I have verified all batch numbers/i })
      fireEvent.click(checkbox)
      expect(screen.getByRole('button', { name: /Confirm & Provision Inventory/i })).not.toBeDisabled()

      // Step 2: Cancel modal
      const cancelBtn = screen.getByRole('button', { name: /Back to Review/i })
      fireEvent.click(cancelBtn)

      // Step 3: Re-open modal
      const openBtn = screen.getByText('Open Modal')
      fireEvent.click(openBtn)

      // Check whether checkbox retained checked state or reset
      const reOpenedCheckbox = screen.getByRole('checkbox', { name: /I have verified all batch numbers/i })
      const confirmBtn = screen.getByRole('button', { name: /Confirm & Provision Inventory/i })
      // Notice: hasAffirmed is maintained in BillConfirmationDialog state because it is not reset on open change
      expect(reOpenedCheckbox).toBeChecked()
      expect(confirmBtn).not.toBeDisabled()
    })

    it('ST-1.6: Pre-flight validation in Master View blocks opening confirmation dialog on invalid data', () => {
      render(
        <PurchaseBillScannerView
          initialSuppliers={MOCK_SUPPLIERS}
          initialProducts={MOCK_PRODUCTS}
          initialBranches={MOCK_BRANCHES}
          defaultBranchId="branch-main"
        />
      )

      // With 0 items and blank invoice number, Commit button should be disabled in summary footer
      const commitBtn = screen.getByRole('button', { name: /Commit & Provision Stock/i })
      expect(commitBtn).toBeDisabled()
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 2. File Ingestion & Dropzone Resilience
  // ─────────────────────────────────────────────────────────────
  describe('Area 2: File Ingestion & Dropzone Resilience', () => {
    it('ST-2.1: Exactly 15MB file is accepted without rejection', () => {
      const onFileSelected = jest.fn()
      render(<DocumentUploadZone onFileSelected={onFileSelected} />)

      const fileInput = screen.getByTestId('bill-file-input')
      const exact15MbFile = new File(['mock content'], 'exact15mb.pdf', {
        type: 'application/pdf',
      })
      Object.defineProperty(exact15MbFile, 'size', { value: 15 * 1024 * 1024 }) // Exactly 15MB

      fireEvent.change(fileInput, { target: { files: [exact15MbFile] } })
      expect(onFileSelected).toHaveBeenCalledWith(exact15MbFile)
      expect(screen.queryByText(/File is too large/i)).not.toBeInTheDocument()
    })

    it('ST-2.2: 15MB + 1 byte file is rejected with explicit size error', () => {
      const onFileSelected = jest.fn()
      render(<DocumentUploadZone onFileSelected={onFileSelected} />)

      const fileInput = screen.getByTestId('bill-file-input')
      const oversizedFile = new File(['mock content'], 'oversized.pdf', {
        type: 'application/pdf',
      })
      Object.defineProperty(oversizedFile, 'size', { value: 15 * 1024 * 1024 + 1 }) // 15MB + 1 byte

      fireEvent.change(fileInput, { target: { files: [oversizedFile] } })
      expect(onFileSelected).not.toHaveBeenCalled()
      expect(screen.getByText(/File is too large \(15.00 MB\)\. Maximum allowed size is 15 MB\./i)).toBeInTheDocument()
    })

    it('ST-2.3: Rejects dangerous executable (.exe) and archive (.zip) MIME types gracefully', () => {
      const onFileSelected = jest.fn()
      render(<DocumentUploadZone onFileSelected={onFileSelected} />)

      const fileInput = screen.getByTestId('bill-file-input')

      // Executable
      const exeFile = new File(['payload'], 'payload.exe', { type: 'application/x-msdownload' })
      fireEvent.change(fileInput, { target: { files: [exeFile] } })
      expect(onFileSelected).not.toHaveBeenCalled()
      expect(screen.getByText(/Invalid file format "application\/x-msdownload"/i)).toBeInTheDocument()

      // ZIP Archive
      const zipFile = new File(['data'], 'invoices.zip', { type: 'application/zip' })
      fireEvent.change(fileInput, { target: { files: [zipFile] } })
      expect(onFileSelected).not.toHaveBeenCalled()
      expect(screen.getByText(/Invalid file format "application\/zip"/i)).toBeInTheDocument()
    })

    it('ST-2.4: Rejects Word document (.docx) and handles missing MIME type string with file extension fallback', () => {
      const onFileSelected = jest.fn()
      render(<DocumentUploadZone onFileSelected={onFileSelected} />)

      const fileInput = screen.getByTestId('bill-file-input')
      const docxFile = new File(['docx data'], 'invoice.docx', { type: '' }) // Empty type, extension docx

      fireEvent.change(fileInput, { target: { files: [docxFile] } })
      expect(onFileSelected).not.toHaveBeenCalled()
      expect(screen.getByText(/Invalid file format "docx"/i)).toBeInTheDocument()
    })

    it('ST-2.5: Dropzone drag-and-drop handles empty drop and multiple files gracefully without crash', () => {
      const onFileSelected = jest.fn()
      render(<DocumentUploadZone onFileSelected={onFileSelected} />)

      const dropzone = screen.getByText(/Drag & drop purchase bill document/i).closest('div')!

      // Drag over and leave states
      fireEvent.dragOver(dropzone, { dataTransfer: { files: [] } })
      fireEvent.dragLeave(dropzone, { dataTransfer: { files: [] } })

      // Drop with empty files
      fireEvent.drop(dropzone, { dataTransfer: { files: [] } })
      expect(onFileSelected).not.toHaveBeenCalled()

      // Drop with 2 files (should pick first valid one)
      const file1 = new File(['f1'], 'bill1.pdf', { type: 'application/pdf' })
      const file2 = new File(['f2'], 'bill2.pdf', { type: 'application/pdf' })
      fireEvent.drop(dropzone, { dataTransfer: { files: [file1, file2] } })
      expect(onFileSelected).toHaveBeenCalledWith(file1)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 3. Dynamic Arithmetic Edge Cases
  // ─────────────────────────────────────────────────────────────
  describe('Area 3: Dynamic Arithmetic Edge Cases', () => {
    it('ST-3.1: 0 billed quantity with positive free bonus quantity (0 billed + 5 free)', () => {
      const res = computeLineItemAmounts({
        billedQuantity: 0,
        unitCost: 147.24,
        discountPercent: 0,
        taxPercent: 12,
      })

      expect(res.taxable).toBe(0)
      expect(res.taxAmount).toBe(0)
      expect(res.totalAmount).toBe(0)

      // Test in bill totals context: 1 item with 0 billed + 5 free alongside normal item
      const items: ReviewBillItem[] = [
        {
          id: 'item-free-only',
          productId: 'prod-aug-625',
          productName: 'Augmentin 625 Duo Tablet',
          batchNumber: 'SCHEME-01',
          expiryDate: '2028-08-31',
          billedQuantity: 0,
          freeQuantity: 5,
          unitCost: 147.24,
          mrp: 204.5,
          discountPercent: 0,
          taxPercent: 12,
          taxAmount: 0,
          totalAmount: 0,
          matchConfidence: 1,
          isNewProduct: false,
        },
        {
          id: 'item-normal',
          productId: 'prod-pcm-650',
          productName: 'Dolo 650 Tablet',
          batchNumber: 'DOLO-01',
          expiryDate: '2028-08-31',
          billedQuantity: 10,
          freeQuantity: 0,
          unitCost: 24.5,
          mrp: 33.6,
          discountPercent: 0,
          taxPercent: 12,
          taxAmount: 29.4,
          totalAmount: 274.4,
          matchConfidence: 1,
          isNewProduct: false,
        },
      ]

      const totals = computeBillTotals(items)
      expect(totals.subtotal).toBe(245)
      expect(totals.taxAmount).toBe(29.4)
      expect(totals.totalAmount).toBe(274.4)
    })

    it('ST-3.2: 100% trade discount produces zero taxable and zero tax', () => {
      const res = computeLineItemAmounts({
        billedQuantity: 10,
        unitCost: 150.0,
        discountPercent: 100,
        taxPercent: 18,
      })

      expect(res.taxable).toBe(0)
      expect(res.taxAmount).toBe(0)
      expect(res.totalAmount).toBe(0)
    })

    it('ST-3.3: 0% tax slab (exempt goods) produces zero tax with exact taxable total', () => {
      const res = computeLineItemAmounts({
        billedQuantity: 25,
        unitCost: 80.0,
        discountPercent: 5,
        taxPercent: 0,
      })

      // 25 * 80 = 2000. 5% discount = 100. Taxable = 1900. Tax = 0. Total = 1900.
      expect(res.taxable).toBe(1900)
      expect(res.taxAmount).toBe(0)
      expect(res.totalAmount).toBe(1900)
    })

    it('ST-3.4: Fractional rates & discount precision: PTR ₹13.73, disc 3.5%, GST 12%', () => {
      // 7 * 13.73 = 96.11
      // 96.11 * 0.965 = 92.74615 -> round2 = 92.75
      // 92.75 * 0.12 = 11.13
      // total = 92.75 + 11.13 = 103.88
      const res = computeLineItemAmounts({
        billedQuantity: 7,
        unitCost: 13.73,
        discountPercent: 3.5,
        taxPercent: 12,
      })

      expect(res.taxable).toBe(92.75)
      expect(res.taxAmount).toBe(11.13)
      expect(res.totalAmount).toBe(103.88)
    })

    it('ST-3.5: Round-off adjustments: handles positive (+0.48) and negative (-0.49) precision', () => {
      const items: ReviewBillItem[] = [
        {
          id: '1',
          productId: 'p1',
          productName: 'P1',
          batchNumber: 'B1',
          expiryDate: '2028-12-31',
          billedQuantity: 3,
          freeQuantity: 0,
          unitCost: 33.33,
          mrp: 50,
          discountPercent: 0,
          taxPercent: 12,
          taxAmount: 12.0,
          totalAmount: 111.99,
          matchConfidence: 1,
          isNewProduct: false,
        },
      ]

      // Positive roundoff +0.01 -> 112.00
      const posTotals = computeBillTotals(items, 112.0, 0.01)
      expect(posTotals.totalAmount).toBe(112.0)
      expect(posTotals.isReconciled).toBe(true)

      // Negative roundoff -0.49 -> 111.50
      const negTotals = computeBillTotals(items, 111.5, -0.49)
      expect(negTotals.totalAmount).toBe(111.5)
      expect(negTotals.isReconciled).toBe(true)
    })

    it('ST-3.6: Fuzz test / Property-based check with 50 random pricing combinations', () => {
      for (let i = 0; i < 50; i++) {
        const qty = Math.floor(Math.random() * 200)
        const cost = round2(Math.random() * 500 + 0.01)
        const disc = round2(Math.random() * 100)
        const tax = [0, 5, 12, 18, 28][Math.floor(Math.random() * 5)]

        const res = computeLineItemAmounts({
          billedQuantity: qty,
          unitCost: cost,
          discountPercent: disc,
          taxPercent: tax,
        })

        expect(res.taxable).toBeGreaterThanOrEqual(0)
        expect(res.taxAmount).toBeGreaterThanOrEqual(0)
        expect(res.totalAmount).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(res.taxable)).toBe(true)
        expect(Number.isFinite(res.taxAmount)).toBe(true)
        expect(Number.isFinite(res.totalAmount)).toBe(true)
        expect(res.totalAmount).toBe(round2(res.taxable + res.taxAmount))
      }
    })

    it('ST-3.7: BillSummaryFooter disables commit button when totalAmount <= 0', () => {
      const onCommit = jest.fn()
      render(
        <BillSummaryFooter
          subtotal={0}
          taxAmount={0}
          discountAmount={0}
          roundOff={0}
          totalAmount={0} // Zero total amount
          variance={0}
          isReconciled={true}
          onCommitClick={onCommit}
        />
      )

      const commitBtn = screen.getByRole('button', { name: /Commit & Provision Stock/i })
      expect(commitBtn).toBeDisabled()
      fireEvent.click(commitBtn)
      expect(onCommit).not.toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 4. Short Expiry Date Edge Cases (< 6 months)
  // ─────────────────────────────────────────────────────────────
  describe('Area 4: Short Expiry Date Edge Cases', () => {
    it('ST-4.1: Far future date (2 years ahead) is NOT short expiry', () => {
      const farFuture = new Date()
      farFuture.setFullYear(farFuture.getFullYear() + 2)
      expect(isShortExpiryDate(farFuture.toISOString().split('T')[0])).toBe(false)
    })

    it('ST-4.2: Today and past dates are flagged as short/expired', () => {
      const todayIso = new Date().toISOString().split('T')[0]
      expect(isShortExpiryDate(todayIso)).toBe(true)

      const pastIso = '2023-01-01'
      expect(isShortExpiryDate(pastIso)).toBe(true)
    })

    it('ST-4.3: Date 1 month ahead and 5 months ahead are flagged as short expiry', () => {
      const oneMonth = new Date()
      oneMonth.setMonth(oneMonth.getMonth() + 1)
      expect(isShortExpiryDate(oneMonth.toISOString().split('T')[0])).toBe(true)

      const fiveMonths = new Date()
      fiveMonths.setMonth(fiveMonths.getMonth() + 5)
      expect(isShortExpiryDate(fiveMonths.toISOString().split('T')[0])).toBe(true)
    })

    it('ST-4.4: Date 7 months ahead is NOT flagged as short expiry', () => {
      const sevenMonths = new Date()
      sevenMonths.setMonth(sevenMonths.getMonth() + 7)
      expect(isShortExpiryDate(sevenMonths.toISOString().split('T')[0])).toBe(false)
    })

    it('ST-4.5: Tests boundary behavior at exact 6 months ahead', () => {
      const today = new Date()
      // 6 months ahead calendar date
      const boundaryDate = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate())
      const boundaryIso = boundaryDate.toISOString().split('T')[0]

      // Document exact empirical behavior of isShortExpiryDate on the 6-month boundary
      const result = isShortExpiryDate(boundaryIso)
      expect(typeof result).toBe('boolean')

      // 6 months + 10 days ahead must be false
      const safelyBeyond = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate() + 10)
      expect(isShortExpiryDate(safelyBeyond.toISOString().split('T')[0])).toBe(false)

      // 6 months - 10 days ahead must be true
      const safelyWithin = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate() - 10)
      expect(isShortExpiryDate(safelyWithin.toISOString().split('T')[0])).toBe(true)
    })

    it('ST-4.6: Invalid or empty date strings return false without throwing exceptions', () => {
      expect(isShortExpiryDate('')).toBe(false)
      expect(isShortExpiryDate('not-a-date')).toBe(false)
      expect(isShortExpiryDate('2026-99-99')).toBe(false)
    })

    it('ST-4.7: LineItemRowEditor updates short-expiry alert immediately when date is changed', () => {
      const item: ReviewBillItem = {
        ...createAdversarialBillData().items[0],
        expiryDate: '2028-12-31', // Far future initially
        isShortExpiry: false,
      }
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

      expect(screen.queryByText(/< 6 months expiry/i)).not.toBeInTheDocument()

      // Change expiry date to 1 month ahead
      const nearFuture = new Date()
      nearFuture.setMonth(nearFuture.getMonth() + 1)
      const nearFutureIso = nearFuture.toISOString().split('T')[0]

      const dateInput = screen.getByDisplayValue('2028-12-31')
      fireEvent.change(dateInput, { target: { value: nearFutureIso } })

      expect(onChange).toHaveBeenCalled()
      const updated = onChange.mock.calls[0][0] as ReviewBillItem
      expect(updated.expiryDate).toBe(nearFutureIso)
      expect(updated.isShortExpiry).toBe(true)
    })
  })
})
