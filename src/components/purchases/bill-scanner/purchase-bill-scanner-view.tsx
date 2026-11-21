'use client'

import {
  ArrowLeft,
  Box,
  CalendarCheck2,
  CheckCircle2,
  Columns,
  Eye,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/lib/constants/routes'
import { useToast } from '@/lib/hooks/use-toast'
import { downloadBillReviewExcel } from '@/lib/reports/invoice-excel-generator'
import type { ScanBillResponse } from '@/lib/scanner/purchase-bill-parser'
import {
  playBarcodeScanSound,
  playSuccessCheckoutSound,
  playWarningSound,
} from '@/lib/sound/sound-effects'
import { cn } from '@/lib/utils/cn'

import { BillConfirmationDialog } from './bill-confirmation-dialog'
import { BillMetadataForm } from './bill-metadata-form'
import { BillSummaryFooter } from './bill-summary-footer'
import { DocumentPreviewPane } from './document-preview-pane'
import { DocumentUploadZone } from './document-upload-zone'
import { LineItemsReviewTable } from './line-items-review-table'
import { ScanningProgressCard } from './scanning-progress-card'
import { StripTabletPricingDialog } from './strip-tablet-pricing-dialog'
import {
  computeBillTotals,
  computeLineItemAmounts,
  isShortExpiryDate,
  type MasterBranch,
  type MasterProduct,
  type MasterSupplier,
  type ReviewBillData,
  type ReviewBillItem,
  type ScanStage,
} from './types'

export interface PurchaseBillScannerViewProps {
  initialSuppliers?: MasterSupplier[]
  initialProducts?: MasterProduct[]
  initialBranches?: MasterBranch[]
  defaultBranchId?: string
  className?: string
}

export function PurchaseBillScannerView({
  initialSuppliers = [],
  initialProducts = [],
  initialBranches = [],
  defaultBranchId = '',
  className,
}: PurchaseBillScannerViewProps) {
  const router = useRouter()
  const toast = useToast()

  // Master Data State
  const [suppliers, setSuppliers] = useState<MasterSupplier[]>(initialSuppliers)
  const [products, setProducts] = useState<MasterProduct[]>(initialProducts)
  const [branches, setBranches] = useState<MasterBranch[]>(initialBranches)

  // Document Ingestion & Scan State
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)
  const [scanStage, setScanStage] = useState<ScanStage>('uploading')
  const [scanProgress, setScanProgress] = useState<number>(0)
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [scanErrorMessage, setScanErrorMessage] = useState<string | null>(null)
  const [ocrEngineMode, setOcrEngineMode] = useState<'zero-llm' | 'hybrid'>('zero-llm')

  // Structured Review State
  const [billData, setBillData] = useState<ReviewBillData>({
    supplierName: '',
    supplierConfidence: 0,
    isNewSupplier: false,
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    branchId: defaultBranchId,
    items: [],
    subtotal: 0,
    taxAmount: 0,
    discountAmount: 0,
    roundOff: 0,
    totalAmount: 0,
    isReconciled: true,
    reconciliationVariance: 0,
    confidence: 1.0,
  })

  // Modal Barrier State
  const [confirmationOpen, setConfirmationOpen] = useState<boolean>(false)
  const [pricingDialogOpen, setPricingDialogOpen] = useState<boolean>(false)
  const [isCommitting, setIsCommitting] = useState<boolean>(false)

  // Auto-Provisioning Settings
  const [autoProvisionOnScan, setAutoProvisionOnScan] = useState<boolean>(true)
  const [autoProvisionSummary, setAutoProvisionSummary] = useState<{
    count: number
    purchaseId?: string
  } | null>(null)

  // Layout View Mode (Split, Expanded Full-Width Table, or Expanded Document View)
  const [layoutMode, setLayoutMode] = useState<'split' | 'expanded-table' | 'expanded-doc'>('split')

  // Load master reference tables if not pre-seeded
  useEffect(() => {
    let active = true

    async function fetchMasterTables() {
      try {
        const [suppliersRes, productsRes, branchesRes] = await Promise.all([
          fetch('/api/suppliers?view=master'),
          fetch('/api/products?limit=1000'),
          fetch('/api/inventory/branches'),
        ])

        const sData = (await suppliersRes.json()) as { success?: boolean; data?: MasterSupplier[] }
        const pData = (await productsRes.json()) as { success?: boolean; products?: MasterProduct[]; data?: MasterProduct[] }
        const bData = (await branchesRes.json()) as { success?: boolean; data?: MasterBranch[] }

        if (!active) return

        if (sData.success && Array.isArray(sData.data)) {
          setSuppliers(sData.data)
        }
        const loadedProds = (pData.success && (pData.products || pData.data)) || []
        if (Array.isArray(loadedProds) && loadedProds.length > 0) {
          setProducts(loadedProds)
        }
        if (bData.success && Array.isArray(bData.data)) {
          setBranches(bData.data)
          if (!billData.branchId && bData.data.length > 0) {
            setBillData((prev) => ({ ...prev, branchId: bData.data?.[0]?.id || '' }))
          }
        }
      } catch {
        // Fallback gracefully without blocking UI
      }
    }

    if (suppliers.length === 0 || products.length === 0 || branches.length === 0) {
      void fetchMasterTables()
    }

    return () => {
      active = false
    }
  }, [suppliers.length, products.length, branches.length, billData.branchId])

  // Recalculate bill financial totals whenever items change or roundOff changes
  const updateBillWithItems = useCallback(
    (newItems: ReviewBillItem[], roundOffAdjustment?: number) => {
      setBillData((prev) => {
        const rf = roundOffAdjustment !== undefined ? roundOffAdjustment : prev.roundOff
        const totals = computeBillTotals(newItems, prev.rawExtractedTotal, rf)
        return {
          ...prev,
          items: newItems,
          ...totals,
        }
      })
    },
    []
  )

  // Handle Document Upload & Trigger OCR Scanning Pipeline
  const handleFileSelected = useCallback(
    async (file: File) => {
      setSelectedFile(file)
      setScanErrorMessage(null)
      setIsScanning(true)
      setScanStage('uploading')
      setScanProgress(10)

      // Create local object URL for preview
      const objectUrl = URL.createObjectURL(file)
      setFilePreviewUrl(objectUrl)

      let currentPct = 10
      const startTime = Date.now()
      const progressTimer = setInterval(() => {
        const elapsed = Date.now() - startTime
        if (elapsed < 800) {
          currentPct = Math.min(28, currentPct + 3)
          setScanStage('uploading')
        } else if (elapsed < 2000) {
          currentPct = Math.min(58, currentPct + 2.5)
          setScanStage('ocr')
        } else if (elapsed < 3500) {
          currentPct = Math.min(82, currentPct + 1.8)
          setScanStage('extracting')
        } else {
          currentPct = Math.min(96, currentPct + 0.5)
          setScanStage('matching')
        }
        setScanProgress(Math.round(currentPct))
      }, 100)

      try {
        const formData = new FormData()
        formData.append('file', file)
        if (billData.branchId) {
          formData.append('branchId', billData.branchId)
        }
        formData.append('autoProvision', String(autoProvisionOnScan))

        // API Call: Deterministic Zero-LLM (Local) or Hybrid Multi-Tier OCR
        const endpoint = ocrEngineMode === 'zero-llm' ? '/api/purchases/scan-deterministic' : '/api/purchases/scan'
        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
        })

        const result = (await response.json()) as ScanBillResponse & {
          error?: { message?: string }
        }

        clearInterval(progressTimer)

        if (!response.ok || !result.success) {
          const errMsg =
            typeof result?.error?.message === 'string'
              ? result.error.message
              : 'Failed to extract bill data from uploaded document'
          throw new Error(errMsg)
        }

        // Process Extracted Payload with Auto-Loaded Inventory & Formulation Recovery
        const extracted = result.extractedData
        const rawItems: ReviewBillItem[] = (extracted.items || []).map((it, idx: number) => {
          const rawIt = it as unknown as Record<string, unknown>
          let billedQuantity = Number(it.billedQuantity ?? rawIt.qty ?? rawIt.quantity ?? 0)
          let freeQuantity = Number(it.freeQuantity ?? rawIt.free ?? rawIt.fqty ?? 0)
          let unitCost = Number(it.unitCost ?? (it as unknown as Record<string, unknown>).ptr ?? rawIt.rate ?? rawIt.price ?? 0)
          let mrp = Number(it.mrp ?? rawIt.mrp ?? 0)
          const discountPercent = Number(it.discountPercent ?? rawIt.disc ?? 0)
          const taxPercent = Number(it.taxPercent !== undefined ? it.taxPercent : rawIt.gst ?? rawIt.tax ?? 5)
          const totalAmountExtracted = Number(it.totalAmount ?? rawIt.amount ?? rawIt.total ?? 0)

          // Mathematical formulation recovery: recover unitCost if missing but totalAmount exists
          if (unitCost <= 0 && totalAmountExtracted > 0) {
            const qtyForCost = billedQuantity > 0 ? billedQuantity : 1
            unitCost = Math.round((totalAmountExtracted / (qtyForCost * (1 + taxPercent / 100))) * 100) / 100
          } else if (unitCost <= 0 && mrp > 0) {
            unitCost = Math.round((mrp / 1.25) * 100) / 100
          }

          // If quantity was missing from OCR, derive from totalAmount or safely default to 1
          if (billedQuantity <= 0) {
            if (totalAmountExtracted > 0 && unitCost > 0) {
              billedQuantity = Math.max(1, Math.round(totalAmountExtracted / (unitCost * (1 + taxPercent / 100))))
            } else {
              billedQuantity = 1
            }
          }

          // If MRP is missing, calculate standard retail markup
          if (mrp <= 0 && unitCost > 0) {
            mrp = Math.round(unitCost * 1.25 * 100) / 100
          }

          const { taxAmount, totalAmount } = computeLineItemAmounts({
            billedQuantity,
            unitCost,
            discountPercent,
            taxPercent,
          })

          const effectiveTotal = totalAmountExtracted > 0 ? totalAmountExtracted : totalAmount
          const effectiveName = (it.productName || it.matchedProductName || it.rawDescription || `Medicine-${idx + 1}`).trim()
          const tabsPerStrip = it.tabsPerStrip || 10
          const stripSellingPrice = it.stripSellingPrice || mrp
          const tabletCost = it.tabletCost || (unitCost > 0 ? Math.round((unitCost / tabsPerStrip) * 100) / 100 : 0)
          const tabletSellingPrice = it.tabletSellingPrice || (mrp > 0 ? Math.round((mrp / tabsPerStrip) * 100) / 100 : 0)

          return {
            id: it.id || `item-${idx}-${Date.now()}`,
            rawDescription: it.rawDescription || effectiveName,
            productId: it.matchedProductId || `NEW_PRODUCT_${idx}_${Date.now()}`,
            productName: effectiveName,
            sku: it.packSize || `${tabsPerStrip} Tablets`,
            packSize: it.packSize || `${tabsPerStrip} Tablets`,
            tabsPerStrip,
            stripSellingPrice,
            tabletCost,
            tabletSellingPrice,
            hsnCode: it.hsnCode || '3004',
            matchConfidence: it.matchConfidence || 0.85,
            isNewProduct: Boolean(it.isNewProduct || !it.matchedProductId),
            batchNumber: it.batchNumber || `BAT-${Date.now().toString(36).toUpperCase()}-${idx + 1}`,
            expiryDate: it.expiryDate || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
            billedQuantity,
            freeQuantity,
            unitCost,
            mrp,
            ptr: it.ptr || unitCost,
            discountPercent,
            taxPercent,
            taxAmount,
            totalAmount: effectiveTotal,
            isShortExpiry: isShortExpiryDate(it.expiryDate || ''),
          }
        })

        const extractedTotal = extracted.financials?.totalAmount
        const billTotals = computeBillTotals(
          rawItems,
          typeof extractedTotal === 'number' ? extractedTotal : undefined,
          extracted.financials?.roundOff || 0
        )

        const paymentMethodExtracted = (extracted.paymentTerms?.paymentMethod || 'CREDIT') as
          | 'CASH'
          | 'CARD'
          | 'UPI'
          | 'NETBANKING'
          | 'CHEQUE'
          | 'CREDIT'

        setBillData({
          supplierName: extracted.supplier?.rawName || '',
          supplierId: extracted.supplier?.matchedSupplierId,
          supplierGstin: extracted.supplier?.gstin,
          supplierDlNumber: extracted.supplier?.dlNumber,
          supplierPan: extracted.supplier?.pan || undefined,
          supplierPhone: extracted.supplier?.phone || undefined,
          supplierEmail: extracted.supplier?.email || undefined,
          supplierAddress: extracted.supplier?.address || undefined,
          supplierCity: extracted.supplier?.city || undefined,
          supplierState: extracted.supplier?.state || undefined,
          supplierPincode: extracted.supplier?.pincode || undefined,
          supplierConfidence: extracted.supplier?.matchConfidence || 0,
          isNewSupplier: Boolean(extracted.supplier?.isNew),
          invoiceNumber: extracted.invoice?.invoiceNumber || '',
          invoiceDate: extracted.invoice?.invoiceDate || new Date().toISOString().split('T')[0],
          dueDate: extracted.invoice?.dueDate || extracted.paymentTerms?.dueDate,
          paymentMethod: paymentMethodExtracted,
          paymentReference: extracted.paymentTerms?.paymentReference || undefined,
          creditDays: extracted.paymentTerms?.creditDays ?? 21,
          branchId: billData.branchId || branches[0]?.id || '',
          items: rawItems,
          subtotal: billTotals.subtotal,
          taxAmount: billTotals.taxAmount,
          discountAmount: billTotals.discountAmount,
          roundOff: billTotals.roundOff,
          totalAmount: billTotals.totalAmount,
          rawExtractedTotal: extractedTotal,
          isReconciled: billTotals.isReconciled,
          reconciliationVariance: billTotals.variance,
          confidence: result.confidence || 0.95,
          file,
          fileUrl: objectUrl,
          fileName: file.name,
          mimeType: file.type,
          pageCount: result.document?.pageCount || 1,
          threads: result.threads,
          integrityHash: result.integrityHash,
          merkleRoot: result.merkleRoot,
        })

        setScanStage('ready')
        setScanProgress(100)
        playBarcodeScanSound()

        if ((result as { autoProvisioned?: boolean }).autoProvisioned) {
          const itemCount = extracted.items?.length || 0
          const pId = (result as { provisionResult?: { purchaseId?: string } }).provisionResult?.purchaseId
          setAutoProvisionSummary({ count: itemCount, purchaseId: pId })
          toast.success(`Auto-provisioned ${itemCount} items into inventory! Racks unassigned for chemist design.`)
        } else {
          setAutoProvisionSummary(null)
          toast.success(`Successfully parsed bill: ${extracted.invoice?.invoiceNumber || file.name}`)
        }
      } catch (err: unknown) {
        playWarningSound()
        const msg = err instanceof Error ? err.message : 'Failed to scan and parse document'
        setScanErrorMessage(msg)
        setScanStage('error')
        toast.error(msg)
      } finally {
        setIsScanning(false)
      }
    },
    [billData.branchId, branches, toast, autoProvisionOnScan, ocrEngineMode]
  )

  // Clear or Reset Document
  const handleClearFile = useCallback(() => {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl)
    }
    setSelectedFile(null)
    setFilePreviewUrl(null)
    setScanStage('uploading')
    setScanProgress(0)
    setScanErrorMessage(null)
    setBillData((prev) => ({
      ...prev,
      items: [],
      rawExtractedTotal: undefined,
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      roundOff: 0,
      totalAmount: 0,
      isReconciled: true,
      reconciliationVariance: 0,
    }))
  }, [filePreviewUrl])

  // Feature: Auto-calculate missing PTR and MRP using standard pharmaceutical margins
  const handleAutoCalculateRates = useCallback(() => {
    if (billData.items.length === 0) return
    let fixedCount = 0
    const updated = billData.items.map((it) => {
      let cost = it.unitCost
      let mrp = it.mrp
      const qty = it.billedQuantity > 0 ? it.billedQuantity : 1
      const tax = it.taxPercent || 5

      if (cost <= 0 && it.totalAmount > 0) {
        cost = Math.round((it.totalAmount / (qty * (1 + tax / 100))) * 100) / 100
        fixedCount++
      } else if (cost <= 0 && mrp > 0) {
        cost = Math.round((mrp / 1.25) * 100) / 100
        fixedCount++
      }

      if (mrp <= 0 && cost > 0) {
        mrp = Math.round(cost * 1.25 * 100) / 100
        fixedCount++
      }

      const { taxAmount, totalAmount } = computeLineItemAmounts({
        billedQuantity: qty,
        unitCost: cost,
        discountPercent: it.discountPercent || 0,
        taxPercent: tax,
      })

      const tabs = it.tabsPerStrip || 10
      return {
        ...it,
        unitCost: cost,
        ptr: cost,
        mrp,
        stripSellingPrice: mrp,
        tabletCost: cost > 0 ? Math.round((cost / tabs) * 100) / 100 : 0,
        tabletSellingPrice: mrp > 0 ? Math.round((mrp / tabs) * 100) / 100 : 0,
        taxAmount,
        totalAmount: it.totalAmount > 0 ? it.totalAmount : totalAmount,
      }
    })

    updateBillWithItems(updated)
    toast.success(`Recalculated PTR & MRP values for ${fixedCount || updated.length} items using standard pharma margins!`)
  }, [billData.items, updateBillWithItems, toast])

  // Feature: Standardize all expiries to statutory end-of-month format (YYYY-MM-DD)
  const handleStandardizeExpiries = useCallback(() => {
    if (billData.items.length === 0) return
    const updated = billData.items.map((it) => {
      let exp = it.expiryDate
      if (!exp || exp.length < 7) {
        exp = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0]
      } else {
        const parts = exp.split('-')
        if (parts.length === 2) {
          const year = parseInt(parts[0], 10)
          const month = parseInt(parts[1], 10)
          const lastDay = new Date(year, month, 0).getDate()
          exp = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
        }
      }
      return {
        ...it,
        expiryDate: exp,
        isShortExpiry: isShortExpiryDate(exp),
      }
    })
    updateBillWithItems(updated)
    toast.success('All medicine item expiries standardized to end-of-month format (YYYY-MM-DD)')
  }, [billData.items, updateBillWithItems, toast])

  // Feature: 1-Click Load Hyper Pharma Wholesale Invoice (18 Verified Items)
  const handleLoadSampleHyperPharma = useCallback(async () => {
    setIsScanning(true)
    setScanStage('uploading')
    setScanProgress(15)

    const timer = setInterval(() => {
      setScanProgress((p) => Math.min(95, p + 15))
    }, 100)

    try {
      const fd = new FormData()
      const fakeBlob = new Blob(['HYPER PHARMA HYP6621'], { type: 'text/plain' })
      fd.append('file', fakeBlob, 'hyper-pharma-invoice.pdf')
      if (billData.branchId) {
        fd.append('branchId', billData.branchId)
      }

      const response = await fetch('/api/purchases/scan?mock=true', {
        method: 'POST',
        body: fd,
      })

      clearInterval(timer)
      setScanProgress(100)
      setScanStage('ready')

      const result = await response.json()
      if (result.success && result.extractedData) {
        const extracted = result.extractedData
        const rawItems: ReviewBillItem[] = (extracted.items || []).map((it: any, idx: number) => {
          const qty = it.billedQuantity || 1
          const cost = it.unitCost || 100
          const mrp = it.mrp || Math.round(cost * 1.25 * 100) / 100
          const tax = it.taxPercent || 5
          const { taxAmount, totalAmount } = computeLineItemAmounts({
            billedQuantity: qty,
            unitCost: cost,
            discountPercent: 0,
            taxPercent: tax,
          })
          return {
            id: it.id || `item-${idx + 1}`,
            rawDescription: it.rawDescription,
            productId: it.matchedProductId || `NEW_PRODUCT_${idx}_${Date.now()}`,
            productName: it.rawDescription,
            sku: it.packSize || '10 Tablets',
            packSize: it.packSize || '10 Tablets',
            tabsPerStrip: 10,
            stripSellingPrice: mrp,
            tabletCost: Math.round((cost / 10) * 100) / 100,
            tabletSellingPrice: Math.round((mrp / 10) * 100) / 100,
            hsnCode: it.hsnCode || '3004',
            matchConfidence: 0.98,
            isNewProduct: true,
            batchNumber: it.batchNumber,
            expiryDate: it.expiryDate,
            billedQuantity: qty,
            freeQuantity: it.freeQuantity || 0,
            unitCost: cost,
            mrp,
            ptr: cost,
            discountPercent: 0,
            taxPercent: tax,
            taxAmount,
            totalAmount: it.totalAmount || totalAmount,
            isShortExpiry: isShortExpiryDate(it.expiryDate),
          }
        })

        const billTotals = computeBillTotals(rawItems, extracted.financials?.totalAmount)
        setBillData({
          supplierName: extracted.supplier?.rawName || 'HYPER PHARMA',
          supplierId: extracted.supplier?.matchedSupplierId,
          supplierGstin: extracted.supplier?.gstin || '36PATPA1744D1Z1',
          supplierDlNumber: extracted.supplier?.dlNumber || 'TS/HYD/2021-85726',
          supplierPan: extracted.supplier?.pan || 'PATPA1744D',
          supplierPhone: extracted.supplier?.phone || '9985589599',
          supplierAddress: extracted.supplier?.address || 'Shop 17-1-205/17/123, Saidabad, Hyderabad',
          supplierConfidence: 0.98,
          isNewSupplier: true,
          invoiceNumber: extracted.invoice?.invoiceNumber || 'HYP6621',
          invoiceDate: extracted.invoice?.invoiceDate || '2026-10-29',
          dueDate: extracted.invoice?.dueDate || '2026-11-28',
          paymentMethod: 'CREDIT',
          creditDays: 30,
          branchId: billData.branchId || branches[0]?.id || '',
          items: rawItems,
          ...billTotals,
          reconciliationVariance: billTotals.variance,
          notes: 'Ingested Wholesale Hyper Pharma Invoice (HYP6621) with 18 distinct items',
          confidence: 0.98,
          pageCount: 1,
        })
        toast.success('Successfully loaded Hyper Pharma bill with 18 medicines, batches & rates!')
      }
    } catch {
      clearInterval(timer)
      setScanStage('error')
      toast.error('Failed to load sample invoice')
    } finally {
      setIsScanning(false)
    }
  }, [billData.branchId, branches, toast])

  // Open confirmation barrier modal after client-side pre-flight validation
  const handleCommitClick = () => {
    // Client-side validations
    if (!billData.invoiceNumber.trim()) {
      toast.error('Invoice number is required')
      return
    }
    if (!billData.invoiceDate.trim()) {
      toast.error('Invoice date is required')
      return
    }
    if (!billData.supplierId && !billData.supplierName.trim()) {
      toast.error('Distributor name is required')
      return
    }
    if (billData.items.length === 0) {
      toast.error('At least one line item is required to commit a purchase bill')
      return
    }

    // Check item-level validation: batch and quantities
    for (let i = 0; i < billData.items.length; i++) {
      const it = billData.items[i]
      if (!it.batchNumber.trim()) {
        toast.error(`Item #${i + 1} (${it.productName}) is missing a batch number`)
        return
      }
      if (!it.expiryDate) {
        toast.error(`Item #${i + 1} (${it.productName}) is missing an expiry date`)
        return
      }
      if (it.billedQuantity < 0) {
        toast.error(`Item #${i + 1} has invalid negative billed quantity`)
        return
      }
    }

    // Prompt user to set/confirm strip sales prices and tablet unit costs before final database commit
    setPricingDialogOpen(true)
  }

  const handleSavePricing = useCallback(
    (updatedItems: ReviewBillItem[]) => {
      updateBillWithItems(updatedItems)
      toast.success('Strip sales prices and tablet unit costs configured!')
      setConfirmationOpen(true)
    },
    [updateBillWithItems, toast]
  )

  // Execute Atomic Database Inventory Provisioning via POST /api/purchases/scan/commit
  const handleConfirmCommit = async (options?: {
    adminRiskAccepted?: boolean
    overrideTotal?: number
    overrideReason?: string
  }) => {
    setIsCommitting(true)
    try {
      const isPaidMode = billData.paymentMethod && billData.paymentMethod !== 'CREDIT'
      const finalTotalAmount =
        options?.overrideTotal !== undefined
          ? Math.round(options.overrideTotal * 100) / 100
          : typeof billData.totalAmount === 'number' && billData.totalAmount > 0
            ? Math.round(billData.totalAmount * 100) / 100
            : Math.round(
                (billData.items.reduce((s, it) => s + it.totalAmount, 0) +
                  (billData.roundOff || 0)) *
                  100
              ) / 100

      const payload = {
        branchId: billData.branchId || branches[0]?.id || 'branch-default',
        supplierId: billData.supplierId || undefined,
        newSupplier: !billData.supplierId
          ? {
              name: billData.supplierName || 'Distributor Agency',
              gstin: billData.supplierGstin || undefined,
              pan: billData.supplierPan || undefined,
              dlNumber: billData.supplierDlNumber || undefined,
              phone: billData.supplierPhone || undefined,
              email: billData.supplierEmail || undefined,
              address: billData.supplierAddress || undefined,
              city: billData.supplierCity || undefined,
              state: billData.supplierState || undefined,
              pincode: billData.supplierPincode || undefined,
              creditDays: billData.creditDays ?? 21,
            }
          : undefined,
        supplierDetails: {
          name: billData.supplierName,
          gstin: billData.supplierGstin || undefined,
          pan: billData.supplierPan || undefined,
          dlNumber: billData.supplierDlNumber || undefined,
          phone: billData.supplierPhone || undefined,
          email: billData.supplierEmail || undefined,
          address: billData.supplierAddress || undefined,
          city: billData.supplierCity || undefined,
          state: billData.supplierState || undefined,
          pincode: billData.supplierPincode || undefined,
          creditDays: billData.creditDays ?? 21,
        },
        paymentMethod: billData.paymentMethod || 'CREDIT',
        paymentReference: billData.paymentReference || undefined,
        amountPaid: isPaidMode ? finalTotalAmount : 0,
        creditDays: billData.creditDays ?? 21,
        dueDate: billData.dueDate || undefined,
        invoiceNumber: billData.invoiceNumber,
        invoiceDate: billData.invoiceDate,
        subtotal: billData.subtotal,
        discountAmount: billData.discountAmount,
        taxAmount: billData.taxAmount,
        roundOff: billData.roundOff,
        totalAmount: finalTotalAmount,
        notes: billData.notes || 'Ingested via Multi-Thread Automated Purchase Bill Scanner',
        allowVarianceOverride: Boolean(options?.adminRiskAccepted),
        adminRiskAccepted: Boolean(options?.adminRiskAccepted),
        adminOverrideReason:
          options?.overrideReason ||
          (options?.adminRiskAccepted
            ? 'Authorized by Administrator at own risk'
            : undefined),
        items: billData.items.map((it, idx) => {
          const effectiveName = (it.productName || it.rawDescription || `Medicine-${idx + 1}`).trim()
          const catalogMatch = products.find(
            (p) =>
              (p.id === it.productId && p.name.trim().toLowerCase() === effectiveName.toLowerCase()) ||
              p.name.trim().toLowerCase() === effectiveName.toLowerCase()
          )
          const isNew = Boolean(
            it.isNewProduct ||
            !catalogMatch ||
            !it.productId ||
            it.productId.startsWith('prod-auto-') ||
            it.productId.startsWith('NEW_PRODUCT_') ||
            it.productId.startsWith('item-')
          )
          const effectiveId = !isNew && catalogMatch ? catalogMatch.id : `NEW_PRODUCT_${idx}_${Date.now()}`

          let finalCost = Number(it.unitCost || it.ptr || 0)
          if (finalCost <= 0 && it.totalAmount > 0) {
            const q = it.billedQuantity > 0 ? it.billedQuantity : 1
            const t = it.taxPercent || 0
            finalCost = Math.round((it.totalAmount / (q * (1 + t / 100))) * 100) / 100
          }
          let finalMrp = Number(it.stripSellingPrice ?? it.mrp ?? 0)
          if (finalMrp <= 0 && finalCost > 0) {
            finalMrp = Math.round(finalCost * 1.25 * 100) / 100
          }

          return {
            productId: effectiveId,
            productName: effectiveName,
            packSize: it.packSize || '10 Tablets',
            hsnCode: it.hsnCode,
            isNewProduct: isNew,
            batchNumber: it.batchNumber.trim().toUpperCase(),
            expiryDate: it.expiryDate,
            billedQuantity: it.billedQuantity || 1,
            freeQuantity: it.freeQuantity || 0,
            unitCost: finalCost,
            mrp: finalMrp,
            ptr: finalCost,
            tabsPerStrip: it.tabsPerStrip || 10,
            stripSellingPrice: finalMrp,
            tabletCost: it.tabletCost,
            tabletSellingPrice: it.tabletSellingPrice,
            discountPercent: it.discountPercent || 0,
            taxPercent: it.taxPercent || 0,
            taxAmount: it.taxAmount || 0,
            totalAmount: it.totalAmount,
          }
        }),
      }

      const response = await fetch('/api/purchases/scan/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = (await response.json()) as {
        success?: boolean
        purchaseId?: string
        totalUnitsAdded?: number
        error?: { message?: string }
      }

      if (!response.ok || !result.success) {
        const errMsg =
          typeof result?.error?.message === 'string'
            ? result.error.message
            : 'Database provisioning failed'
        throw new Error(errMsg)
      }

      playSuccessCheckoutSound()
      toast.success(
        `Purchase bill ${billData.invoiceNumber} confirmed! Provisioned ${result.totalUnitsAdded || billData.items.length} units.`
      )
      setConfirmationOpen(false)

      // Navigate to purchases overview or detail
      if (typeof result.purchaseId === 'string' && result.purchaseId) {
        router.push(ROUTES.PURCHASE(result.purchaseId))
      } else {
        router.push(ROUTES.PURCHASES)
      }
    } catch (err: unknown) {
      playWarningSound()
      const msg = err instanceof Error ? err.message : 'Failed to commit purchase bill'
      toast.error(msg)
      // If there is any reconciliation or variance error, keep confirmation dialog open for admin override
      if (msg.includes('Reconciliation') || msg.includes('variance') || msg.includes('tolerance')) {
        setConfirmationOpen(true)
      }
    } finally {
      setIsCommitting(false)
    }
  }

  const currentBranchName = useMemo(() => {
    return (
      branches.find((b) => b.id === billData.branchId)?.name || 'Main Pharmacy Branch'
    )
  }, [branches, billData.branchId])

  return (
    <div className={cn('space-y-4', className)}>
      {/* Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link href={ROUTES.PURCHASES} aria-label="Back to purchases">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-primary" />
              <span>Purchase Bill Scanner &amp; Ingestion</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Automated OCR parsing, split dual-view inspection, fuzzy medicine cataloging, and safe inventory provisioning
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Engine Selector: Zero-LLM Deterministic vs AI/Cloud */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-md border text-xs">
            <Button
              type="button"
              size="sm"
              variant={ocrEngineMode === 'zero-llm' ? 'default' : 'ghost'}
              className="h-7 text-xs px-2.5 gap-1 font-medium"
              onClick={() => setOcrEngineMode('zero-llm')}
              title="Zero-LLM: 100% deterministic local OCR & table reconstruction. Zero cloud token costs."
            >
              <Zap className="h-3 w-3 text-amber-400 fill-amber-400" />
              ⚡ Zero-LLM (Local)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={ocrEngineMode === 'hybrid' ? 'default' : 'ghost'}
              className="h-7 text-xs px-2.5 gap-1 font-medium"
              onClick={() => setOcrEngineMode('hybrid')}
              title="Cloud / Gemini AI multi-tier OCR pipeline"
            >
              <Sparkles className="h-3 w-3" />
              AI Cloud
            </Button>
          </div>

          <Badge variant="outline" className="text-xs font-mono">
            {branches.find((b) => b.id === billData.branchId)?.name || 'Active Branch'}
          </Badge>
          <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Link href={ROUTES.PURCHASES_NEW}>
              <RotateCcw className="h-3.5 w-3.5" />
              Manual PO
            </Link>
          </Button>
        </div>
      </div>

      {/* Top Section: Upload Dropzone & Scanning Feedback */}
      <div className="space-y-3">
        {/* Auto-Provision Configuration Switch */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Label htmlFor="auto-provision-toggle" className="text-sm font-semibold cursor-pointer">
                  Auto-Provision Items into Inventory on Scan
                </Label>
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                  Recommended
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Instantly provisions medicines into inventory catalog using exact extracted names; racks remain unassigned for chemist design.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="auto-provision-toggle"
              checked={autoProvisionOnScan}
              onCheckedChange={(checked) => setAutoProvisionOnScan(Boolean(checked))}
            />
            <Label htmlFor="auto-provision-toggle" className="text-xs text-muted-foreground cursor-pointer select-none">
              {autoProvisionOnScan ? 'Auto-Provision Enabled' : 'Disabled'}
            </Label>
          </div>
        </div>

        <DocumentUploadZone
          onFileSelected={handleFileSelected}
          selectedFile={selectedFile}
          onClearFile={handleClearFile}
          disabled={isScanning}
        />

        {(isScanning || scanStage !== 'uploading') && (
          <ScanningProgressCard
            currentStage={scanStage}
            progressPercent={scanProgress}
            overallConfidence={billData.confidence}
            threads={billData.threads}
            merkleRoot={billData.merkleRoot}
            errorMessage={scanErrorMessage}
            onRetry={() => selectedFile && handleFileSelected(selectedFile)}
          />
        )}

        {/* Auto-Provision Confirmation Banner */}
        {autoProvisionSummary && scanStage === 'ready' && (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-700">
                {autoProvisionSummary.count} item{autoProvisionSummary.count !== 1 ? 's' : ''} auto-provisioned into inventory
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Medicines added with exact extracted names.{' '}
                <Box className="inline h-3 w-3 mr-0.5" />
                Rack assignments are left unassigned — the chemist can design and allocate storage locations later.
              </p>
              {autoProvisionSummary.purchaseId && (
                <Button
                  asChild
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto p-0 text-xs text-emerald-700 hover:text-emerald-900"
                >
                  <Link href={ROUTES.PURCHASE(autoProvisionSummary.purchaseId)}>
                    View Purchase Record →
                  </Link>
                </Button>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-800"
              onClick={() => setAutoProvisionSummary(null)}
              aria-label="Dismiss"
            >
              ×
            </Button>
          </div>
        )}
      </div>

      {/* Workspace View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 border border-border/80">
        <div className="flex items-center gap-2 text-xs">
          <Columns className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground">Workspace Review Mode:</span>
          <span className="text-muted-foreground hidden sm:inline">
            (Switch between Split View and Full Width Table to inspect all 10 medicine fields clearly)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant={layoutMode === 'split' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setLayoutMode('split')}
            className={cn('h-7 text-xs gap-1.5', layoutMode === 'split' && 'font-bold shadow-sm bg-background')}
          >
            <Columns className="h-3 w-3" />
            <span>Split View</span>
          </Button>
          <Button
            type="button"
            variant={layoutMode === 'expanded-table' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setLayoutMode('expanded-table')}
            className={cn(
              'h-7 text-xs gap-1.5',
              layoutMode === 'expanded-table' && 'font-bold shadow-sm bg-primary/10 text-primary border border-primary/20'
            )}
          >
            <Maximize2 className="h-3 w-3" />
            <span>Full Width Table (All Columns Visible)</span>
          </Button>
          <Button
            type="button"
            variant={layoutMode === 'expanded-doc' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setLayoutMode('expanded-doc')}
            className={cn('h-7 text-xs gap-1.5', layoutMode === 'expanded-doc' && 'font-bold shadow-sm bg-background')}
          >
            <Eye className="h-3 w-3" />
            <span>Document Focus</span>
          </Button>
        </div>
      </div>

      {/* Quick Action Tools Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-card border border-border/80 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutoCalculateRates}
            disabled={billData.items.length === 0}
            className="h-7 text-xs gap-1.5 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 cursor-pointer"
            title="Auto-calculate any missing PTR and MRP using standard margins (PTR = Total/Qty/(1+GST), MRP = PTR * 1.25)"
          >
            <Wand2 className="h-3 w-3 text-emerald-600" />
            <span>Auto-Calculate PTR & MRP</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleStandardizeExpiries}
            disabled={billData.items.length === 0}
            className="h-7 text-xs gap-1.5 border-blue-500/30 text-blue-700 hover:bg-blue-500/10 cursor-pointer"
            title="Standardize all item expiry dates to end-of-month format (YYYY-MM-DD)"
          >
            <CalendarCheck2 className="h-3 w-3 text-blue-600" />
            <span>Fix Expiry Dates</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadSampleHyperPharma}
            disabled={isScanning}
            className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
            title="Load sample wholesale invoice (HYPER PHARMA) with 18 medicines to test instant scanning"
          >
            <Sparkles className="h-3 w-3 text-primary" />
            <span>Load Demo Bill (Hyper Pharma)</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Layout Mode Toggles */}
          <div className="flex items-center rounded-md border border-border/80 bg-muted/40 p-0.5">
            <Button
              type="button"
              variant={layoutMode === 'split' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setLayoutMode('split')}
              className="h-6 text-[11px] px-2 font-medium"
              title="Split View (Preview 25% + Review Table 75%)"
            >
              Split View
            </Button>
            <Button
              type="button"
              variant={layoutMode === 'expanded-table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setLayoutMode('expanded-table')}
              className="h-6 text-[11px] px-2 font-medium"
              title="Full-Width Table (100% Review View for 10 Columns)"
            >
              Full Table (100%)
            </Button>
          </div>

          {selectedFile && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleFileSelected(selectedFile)}
              disabled={isScanning}
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Re-Scan Document</span>
            </Button>
          )}
        </div>
      </div>

      {/* Dual-View Review Workspace */}
      <div
        className={cn(
          'grid gap-4 items-start',
          layoutMode === 'split' && 'grid-cols-1 lg:grid-cols-12',
          layoutMode !== 'split' && 'grid-cols-1'
        )}
      >
        {/* Document Preview Pane */}
        {layoutMode !== 'expanded-table' && (
          <div
            className={cn(
              layoutMode === 'split' ? 'lg:col-span-3 h-[680px] lg:sticky lg:top-4' : 'col-span-12 h-[800px]'
            )}
          >
            <DocumentPreviewPane
              fileUrl={filePreviewUrl}
              fileName={billData.fileName || selectedFile?.name}
              mimeType={billData.mimeType || selectedFile?.type}
              pageCount={billData.pageCount || 1}
            />
          </div>
        )}

        {/* Structured Review Form & Line Items Table */}
        {layoutMode !== 'expanded-doc' && (
          <div
            className={cn(
              layoutMode === 'split' ? 'lg:col-span-9 space-y-4' : 'col-span-12 space-y-4'
            )}
          >
            {/* Quick banner in full-width mode allowing instant switch back */}
            {layoutMode === 'expanded-table' && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/60 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>
                    Viewing full review table with all 10 columns: <strong>Medicine, Batch, Expiry, Billed Qty, Free, PTR, MRP, Disc%, GST, Line Total</strong>
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLayoutMode('split')}
                  className="h-6 text-xs gap-1"
                >
                  <Columns className="h-3 w-3" />
                  <span>Restore Side-by-Side</span>
                </Button>
              </div>
            )}

            {/* Metadata Form Header */}
            <BillMetadataForm
              billData={billData}
              onChange={(updated) => setBillData((prev) => ({ ...prev, ...updated }))}
              suppliers={suppliers}
              branches={branches}
              disabled={isScanning || isCommitting}
            />

            {/* Line Items Table */}
            <LineItemsReviewTable
              items={billData.items}
              products={products}
              onChangeItems={(items) => updateBillWithItems(items)}
              onOpenPricing={() => setPricingDialogOpen(true)}
              onExportExcel={() => downloadBillReviewExcel(billData)}
              isExpanded={layoutMode === 'expanded-table'}
              onToggleExpand={() => setLayoutMode((prev) => (prev === 'expanded-table' ? 'split' : 'expanded-table'))}
              disabled={isScanning || isCommitting}
            />

            {/* Financial Summary Footer & Commit Trigger */}
            <BillSummaryFooter
              subtotal={billData.subtotal}
              taxAmount={billData.taxAmount}
              discountAmount={billData.discountAmount}
              roundOff={billData.roundOff}
              totalAmount={billData.totalAmount}
              extractedTotal={billData.rawExtractedTotal}
              variance={billData.reconciliationVariance}
              isReconciled={billData.isReconciled}
              onRoundOffChange={(rf) => updateBillWithItems(billData.items, rf)}
              onTotalAmountChange={(newTotal) =>
                setBillData((prev) => ({ ...prev, totalAmount: newTotal }))
              }
              onCommitClick={handleCommitClick}
              onResetClick={handleClearFile}
              disabled={isScanning}
              committing={isCommitting}
            />
          </div>
        )}
      </div>

      {/* Strip Sales Price & 1-Tablet Cost Setup Prompt */}
      <StripTabletPricingDialog
        open={pricingDialogOpen}
        onOpenChange={setPricingDialogOpen}
        items={billData.items}
        onSavePricing={handleSavePricing}
      />

      {/* Explicit Confirmation Barrier Modal */}
      <BillConfirmationDialog
        open={confirmationOpen}
        onOpenChange={setConfirmationOpen}
        billData={billData}
        branchName={currentBranchName}
        onConfirm={handleConfirmCommit}
        isSubmitting={isCommitting}
      />
    </div>
  )
}
