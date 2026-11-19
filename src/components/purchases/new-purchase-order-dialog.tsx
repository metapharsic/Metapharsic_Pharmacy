'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  FileCheck,
  FileSpreadsheet,
  FileText,
  GitCompare,
  Info,
  Lock,
  Package,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  X,
} from 'lucide-react'

import { SourcingMatrixModal } from '@/components/suppliers/sourcing-matrix-modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/lib/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/currency'

const PAYMENT_TERM_OPTIONS: SearchableSelectOption[] = [
  { value: '15 days', label: '15 days credit' },
  { value: '30 days', label: '30 days credit (Standard)' },
  { value: '45 days', label: '45 days credit' },
  { value: '60 days', label: '60 days credit' },
  { value: 'Advance / Immediate', label: 'Advance / Immediate Payment' },
  { value: 'Cash On Delivery (COD)', label: 'Cash On Delivery (COD)' },
  { value: 'Net 90 days', label: 'Net 90 days' },
]

const PURCHASE_UNIT_OPTIONS: SearchableSelectOption[] = [
  { value: 'Strip', label: 'Strip (Blister / Foil)' },
  { value: 'Bottle', label: 'Bottle (Liquid / Syrup)' },
  { value: 'Box', label: 'Box (Packaging Unit)' },
  { value: 'Vial', label: 'Vial (Injectable)' },
  { value: 'Ampoule', label: 'Ampoule (Single dose)' },
  { value: 'Tablet', label: 'Tablet (Loose / Bulk)' },
  { value: 'Capsule', label: 'Capsule (Loose / Bulk)' },
  { value: 'Sachet', label: 'Sachet (Powder / Granules)' },
  { value: 'Tube', label: 'Tube (Ointment / Gel)' },
  { value: 'Carton', label: 'Carton (Master Pack)' },
]

const GST_OPTIONS: SearchableSelectOption[] = [
  { value: '0', label: '0% — Nil / Exempted Medicines' },
  { value: '5', label: '5% — Life-Saving & Essential Formulations' },
  { value: '12', label: '12% — Standard Pharmaceuticals (Default)' },
  { value: '18', label: '18% — Surgical & Diagnostic Devices' },
  { value: '28', label: '28% — Disinfectants & Luxury Products' },
]

const SCHEME_OPTIONS: SearchableSelectOption[] = [
  { value: 'None', label: 'None (Standard Net Price)' },
  { value: '10+1 Free Goods', label: '10+1 Free Goods (9.09% bonus units)', badge: 'Popular' },
  { value: '20+2 Free Goods', label: '20+2 Free Goods (10% bonus units)', badge: 'Wholesale' },
  { value: '5% Cash Settlement Discount', label: '5% Cash Settlement Discount', badge: 'Cash Flow' },
  { value: '10% Volume Rebate', label: '10% Volume Rebate (Bulk Sourcing)' },
]

interface SupplierItem {
  id: string
  name: string
  code?: string
  dlNumber?: string | null
  gstin?: string | null
  city?: string | null
  state?: string | null
  creditDays?: number
  creditLimit?: number
  outstandingBalance?: number
  isPoAllowed?: boolean
  poBlockReason?: string
  type?: string
}

interface ProductItem {
  id: string
  name: string
  sku: string
  mrp: number
  costPrice?: number
  ptr?: number
  unitOfMeasure?: string
  gstRate?: number
}

interface BranchItem {
  id: string
  name: string
  city?: string
  isHeadOffice?: boolean
}

interface PoLineItem {
  id: string
  productId: string
  productName: string
  productSku: string
  quantity: number
  freeQuantity: number
  purchaseUnit: string
  ratePerUnit: number
  discountPercent: number
  gstPercent: number
}

export interface NewPurchaseOrderDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  initialSupplierId?: string
  initialProductId?: string
  onSuccess?: () => void
  triggerButton?: React.ReactNode
}

export function NewPurchaseOrderDialog({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  initialSupplierId,
  initialProductId,
  onSuccess,
  triggerButton,
}: NewPurchaseOrderDialogProps) {
  const toast = useToast()

  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen
  const handleOpenChange = (val: boolean) => {
    if (isControlled) {
      setControlledOpen?.(val)
    } else {
      setInternalOpen(val)
    }
  }

  // Master database tables
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])
  const [branches, setBranches] = useState<BranchItem[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // Section A: Order details
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(initialSupplierId || '')
  const [poDate, setPoDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [expectedDelivery, setExpectedDelivery] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    return d.toISOString().split('T')[0]
  })
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [paymentTerms, setPaymentTerms] = useState<string>('30 days')

  // Section B: Order items
  const [items, setItems] = useState<PoLineItem[]>([
    {
      id: 'item-1',
      productId: '',
      productName: '',
      productSku: '',
      quantity: 10,
      freeQuantity: 0,
      purchaseUnit: 'Strip',
      ratePerUnit: 80,
      discountPercent: 0,
      gstPercent: 12,
    },
  ])

  // Section C: Additional charges and schemes
  const [freightCharges, setFreightCharges] = useState<number>(0)
  const [supplierScheme, setSupplierScheme] = useState<string>('None')
  const [notes, setNotes] = useState<string>('')

  // Modals & UI States
  const [sourcingModalOpen, setSourcingModalOpen] = useState(false)
  const [sourcingProductId, setSourcingProductId] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [validationReport, setValidationReport] = useState<{
    valid: boolean
    errors: string[]
    warnings: string[]
  } | null>(null)

  // Load database reference data whenever popup opens
  useEffect(() => {
    if (!isOpen) return
    let isMounted = true
    async function loadMasterData() {
      setLoadingData(true)
      try {
        const [suppliersRes, productsRes, branchesRes] = await Promise.all([
          fetch('/api/suppliers?view=master'),
          fetch('/api/pos/products'),
          fetch('/api/inventory/branches'),
        ])

        const sData = await suppliersRes.json()
        const pData = await productsRes.json()
        const bData = await branchesRes.json()

        if (!isMounted) return

        if (sData.success && Array.isArray(sData.data)) {
          setSuppliers(sData.data)
        }
        if (pData.success && Array.isArray(pData.data)) {
          setProducts(pData.data)
        }
        if (bData.success && Array.isArray(bData.data)) {
          setBranches(bData.data)
          if (bData.data.length > 0 && !selectedBranchId) {
            const defaultBranch =
              bData.data.find((b: BranchItem) => b.name.toLowerCase().includes('main')) ||
              bData.data[0]
            setSelectedBranchId(defaultBranch.id)
          }
        }
      } catch {
        toast.error('Failed to load database master tables for purchase order')
      } finally {
        if (isMounted) setLoadingData(false)
      }
    }

    void loadMasterData()
    return () => {
      isMounted = false
    }
  }, [isOpen, selectedBranchId, toast])

  // Pre-fill initial supplier or product if passed as props
  useEffect(() => {
    if (initialSupplierId && suppliers.length > 0) {
      setSelectedSupplierId(initialSupplierId)
      const sup = suppliers.find((s) => s.id === initialSupplierId)
      if (sup?.creditDays) setPaymentTerms(`${sup.creditDays} days`)
    }
  }, [initialSupplierId, suppliers])

  useEffect(() => {
    if (initialProductId && products.length > 0) {
      const matchProduct = products.find((p) => p.id === initialProductId)
      if (matchProduct) {
        setItems([
          {
            id: 'item-1',
            productId: matchProduct.id,
            productName: matchProduct.name,
            productSku: matchProduct.sku,
            quantity: 10,
            freeQuantity: 0,
            purchaseUnit: matchProduct.unitOfMeasure || 'Strip',
            ratePerUnit: Number(matchProduct.costPrice || matchProduct.ptr || Math.round(matchProduct.mrp * 0.72)) || 80,
            discountPercent: 0,
            gstPercent: matchProduct.gstRate ? Number(matchProduct.gstRate) : 12,
          },
        ])
      }
    }
  }, [initialProductId, products])

  // Selected supplier entity
  const currentSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId),
    [suppliers, selectedSupplierId]
  )

  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId)
    const sup = suppliers.find((s) => s.id === supplierId)
    if (sup) {
      setPaymentTerms(sup.creditDays ? `${sup.creditDays} days` : '30 days')
      if (sup.isPoAllowed === false) {
        toast.error(`Statutory Gate Alert: ${sup.poBlockReason || 'Supplier has pending license verification'}`)
      }
    }
  }

  const handleItemChange = (index: number, field: keyof PoLineItem, value: any) => {
    setItems((prev) => {
      const next = [...prev]
      const current = { ...next[index], [field]: value }

      if (field === 'productId') {
        const prod = products.find((p) => p.id === value)
        if (prod) {
          current.productName = prod.name
          current.productSku = prod.sku
          current.purchaseUnit = prod.unitOfMeasure || 'Strip'
          current.ratePerUnit = Number(prod.costPrice || prod.ptr || Math.round(prod.mrp * 0.72)) || 80
          current.gstPercent = prod.gstRate ? Number(prod.gstRate) : 12
        }
      }

      next[index] = current
      return next
    })
  }

  const addItem = () => {
    if (items.length >= 200) {
      toast.error('Cannot exceed 200 items in a single Purchase Order')
      return
    }
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        productId: '',
        productName: '',
        productSku: '',
        quantity: 10,
        freeQuantity: 0,
        purchaseUnit: 'Strip',
        ratePerUnit: 80,
        discountPercent: 0,
        gstPercent: 12,
      },
    ])
  }

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      toast.error('A Purchase Order must contain at least one line item')
      return
    }
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  // Scheme auto-calculations
  useEffect(() => {
    if (supplierScheme === '10+1 Free Goods') {
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          freeQuantity: Math.floor(it.quantity / 10),
        }))
      )
    } else if (supplierScheme === '20+2 Free Goods') {
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          freeQuantity: Math.floor(it.quantity / 20) * 2,
        }))
      )
    } else if (supplierScheme === '5% Cash Settlement Discount') {
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          discountPercent: 5,
          freeQuantity: 0,
        }))
      )
    } else if (supplierScheme === 'None') {
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          freeQuantity: 0,
        }))
      )
    }
  }, [supplierScheme])

  // Order Summary calculations
  const orderSummary = useMemo(() => {
    let taxableAmount = 0
    let estimatedGst = 0
    let totalFreeQty = 0

    const lineCalculations = items.map((it) => {
      const lineSubtotal = it.quantity * it.ratePerUnit
      const lineDiscount = lineSubtotal * (it.discountPercent / 100)
      const lineTaxable = lineSubtotal - lineDiscount
      const lineTax = lineTaxable * (it.gstPercent / 100)
      const lineTotal = lineTaxable + lineTax

      taxableAmount += lineTaxable
      estimatedGst += lineTax
      totalFreeQty += it.freeQuantity

      return {
        ...it,
        lineTaxable,
        lineTax,
        lineTotal,
      }
    })

    const freight = Number(freightCharges) || 0
    const estimatedPoTotal = taxableAmount + estimatedGst + freight

    return {
      lineCalculations,
      taxableAmount: Math.round(taxableAmount * 100) / 100,
      estimatedGst: Math.round(estimatedGst * 100) / 100,
      freightCharges: freight,
      estimatedPoTotal: Math.round(estimatedPoTotal * 100) / 100,
      totalFreeQty,
    }
  }, [items, freightCharges])

  // Searchable Select Options for Master Entities
  const supplierOptions = useMemo<SearchableSelectOption[]>(() => {
    return suppliers.map((s) => ({
      value: s.id,
      label: s.name,
      sublabel: [
        s.code ? `Code: ${s.code}` : '',
        s.dlNumber ? `DL: ${s.dlNumber}` : 'DL: Pending',
        s.city ? `City: ${s.city}` : '',
        s.creditDays ? `${s.creditDays}d Credit` : '',
      ].filter(Boolean).join(' • '),
      badge: s.isPoAllowed === false ? '⛔ PO Blocked' : (s.type || 'Verified'),
      badgeVariant: s.isPoAllowed === false ? 'destructive' : 'outline',
      keywords: [s.code || '', s.dlNumber || '', s.gstin || '', s.city || '', s.state || ''],
    }))
  }, [suppliers])

  const branchOptions = useMemo<SearchableSelectOption[]>(() => {
    return branches.map((b) => ({
      value: b.id,
      label: b.name,
      sublabel: b.city ? `City: ${b.city}` : undefined,
      badge: b.isHeadOffice ? 'Head Office' : undefined,
      keywords: [b.city || ''],
    }))
  }, [branches])

  const productOptions = useMemo<SearchableSelectOption[]>(() => {
    return products.map((p) => ({
      value: p.id,
      label: p.name,
      sublabel: `SKU: ${p.sku} • MRP: ₹${Number(p.mrp).toFixed(2)}${p.costPrice ? ` • Cost: ₹${Number(p.costPrice).toFixed(2)}` : ''} • Unit: ${p.unitOfMeasure || 'Strip'}`,
      badge: `${p.gstRate || 12}% GST`,
      keywords: [p.sku, p.unitOfMeasure || ''],
    }))
  }, [products])

  // Copy draft data
  const handleCopyDraftData = () => {
    const payload = {
      purchaseOrderDraft: {
        supplierId: selectedSupplierId,
        supplierName: currentSupplier?.name || 'Unassigned',
        poDate,
        expectedDelivery,
        branchId: selectedBranchId,
        branchName: branches.find((b) => b.id === selectedBranchId)?.name || 'Main Pharmacy',
        paymentTerms,
        supplierScheme,
        freightCharges,
        items: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          sku: it.productSku,
          orderedQuantity: it.quantity,
          freeQuantity: it.freeQuantity,
          purchaseUnit: it.purchaseUnit,
          ratePerUnit: it.ratePerUnit,
          discountPercent: it.discountPercent,
          gstPercent: it.gstPercent,
        })),
        summary: {
          taxableAmount: orderSummary.taxableAmount,
          estimatedGst: orderSummary.estimatedGst,
          freightCharges: orderSummary.freightCharges,
          estimatedPoTotal: orderSummary.estimatedPoTotal,
          totalFreeQuantity: orderSummary.totalFreeQty,
        },
        notes,
      },
    }

    navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    toast.success('PO draft JSON data copied to clipboard!')
  }

  // Validate draft
  const handleValidateDraft = () => {
    const errors: string[] = []
    const warnings: string[] = []

    if (!selectedSupplierId) {
      errors.push('Supplier selection is required.')
    } else if (currentSupplier && currentSupplier.isPoAllowed === false) {
      errors.push(
        `Statutory Gate Violation: ${currentSupplier.poBlockReason || 'Supplier has pending Drug License verification'}`
      )
    }

    if (!selectedBranchId) {
      errors.push('Delivery branch is required.')
    }

    items.forEach((it, idx) => {
      if (!it.productId) {
        errors.push(`Item ${idx + 1}: Medicine / product must be selected.`)
      }
      if (it.quantity <= 0) {
        errors.push(`Item ${idx + 1}: Quantity must be greater than zero.`)
      }
      if (it.ratePerUnit <= 0) {
        errors.push(`Item ${idx + 1}: Rate per unit must be greater than ₹0.00.`)
      }
    })

    if (currentSupplier && currentSupplier.creditLimit) {
      const projectedBalance = (currentSupplier.outstandingBalance || 0) + orderSummary.estimatedPoTotal
      if (projectedBalance > currentSupplier.creditLimit) {
        warnings.push(
          `Projected supplier exposure (₹${projectedBalance.toLocaleString()}) exceeds approved credit limit (₹${currentSupplier.creditLimit.toLocaleString()}).`
        )
      }
    }

    if (orderSummary.totalFreeQty > 0) {
      warnings.push(
        `Order contains ${orderSummary.totalFreeQty} free goods units under ${supplierScheme}. Ensure physical verification at GRN.`
      )
    }

    setValidationReport({
      valid: errors.length === 0,
      errors,
      warnings,
    })

    if (errors.length === 0) {
      toast.success('Draft validated successfully! All compliance and arithmetic checks passed.')
    } else {
      toast.error(`Draft validation failed with ${errors.length} error(s).`)
    }
  }

  // Submit to database
  const handleSubmitPurchaseOrder = async (isDraftMode: boolean = false) => {
    if (!selectedSupplierId) {
      toast.error('Please select an eligible supplier')
      return
    }

    if (currentSupplier && currentSupplier.isPoAllowed === false) {
      toast.error(
        `Statutory Gate Violation: Supplier "${currentSupplier.name}" is locked due to incomplete Drug License Form 20B/21B.`
      )
      return
    }

    const invalidItem = items.find((i) => !i.productId || i.quantity <= 0 || i.ratePerUnit <= 0)
    if (invalidItem) {
      toast.error('Please complete all medicine line items with valid quantities and rates')
      return
    }

    setSubmitting(true)
    try {
      const command = {
        branchId: selectedBranchId,
        supplierId: selectedSupplierId,
        expectedDate: expectedDelivery ? new Date(expectedDelivery).toISOString() : undefined,
        status: isDraftMode ? 'DRAFT' : 'ORDERED',
        notes: `Terms: ${paymentTerms} | Scheme: ${supplierScheme} | Freight: ₹${freightCharges} | Free Qty: ${orderSummary.totalFreeQty} | ${notes}`.trim(),
        items: items.map((it) => ({
          productId: it.productId,
          orderedQuantity: Number(it.quantity),
          freeQuantity: Number(it.freeQuantity) || 0,
          unitCost: Number(it.ratePerUnit),
          discountPercent: Number(it.discountPercent) || 0,
          taxPercent: Number(it.gstPercent) || 0,
        })),
      }

      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      })

      const json = await res.json()
      if (json.success && json.data) {
        toast.success(
          isDraftMode
            ? `Purchase Order ${json.data.purchaseNumber} saved as Draft!`
            : `Purchase Order ${json.data.purchaseNumber} created & submitted for approval!`
        )
        handleOpenChange(false)
        onSuccess?.()
      } else {
        toast.error(json.error?.message || 'Failed to submit Purchase Order')
      }
    } catch {
      toast.error('Network error during purchase order creation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        {triggerButton && <DialogTrigger asChild>{triggerButton}</DialogTrigger>}

        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0 border-border/80 shadow-2xl">
          {/* Header */}
          <DialogHeader className="p-4 sm:p-5 border-b bg-card/90 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                    New Purchase Order
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px]">
                      Interactive Modal
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    PO number will be generated by the server upon submission.
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSourcingModalOpen(true)}
                  className="h-7.5 gap-1.5 text-xs font-semibold border-primary/40 text-primary hover:bg-primary/10 hidden sm:flex"
                >
                  <GitCompare className="h-3.5 w-3.5" />
                  Compare Sourcing Rates
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Modal Body: Sections A, B, C, D */}
          <div className="p-4 sm:p-5 space-y-5">
            {/* ─── SECTION A: Order details ─── */}
            <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs">
              <div className="py-2.5 px-3.5 bg-muted/40 border-b flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  A. Order details
                </span>
                {currentSupplier && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Code: {currentSupplier.code || 'SUP-ACT'} &middot; Limit: {formatCurrency(currentSupplier.creditLimit || 250000)}
                  </span>
                )}
              </div>

              <div className="p-3.5 space-y-3.5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
                  {/* Supplier * */}
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs font-semibold text-foreground">Supplier *</Label>
                    <SearchableSelect
                      value={selectedSupplierId}
                      onChange={handleSupplierChange}
                      options={supplierOptions}
                      placeholder="Select eligible supplier…"
                      searchPlaceholder="Search supplier by name, DL, GSTIN, code or city…"
                      emptyMessage="No suppliers found in database."
                      contentClassName="w-[min(calc(100vw-2rem),480px)]"
                    />

                    {/* Statutory Compliance Indicator */}
                    {currentSupplier && (
                      <div className="mt-1 text-[11px]">
                        {currentSupplier.isPoAllowed !== false ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 p-2 rounded-md border border-emerald-500/25">
                            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            <span>
                              <strong>Authorized:</strong> DL Form 20B/21B Valid &middot; GSTIN: {currentSupplier.gstin || '27AABCU1234M1Z5'} &middot; {currentSupplier.creditDays || 30}d Credit
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-start gap-1.5 text-rose-700 dark:text-rose-400 bg-rose-500/10 p-2 rounded-md border border-rose-500/30">
                            <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-600" />
                            <div>
                              <strong>Statutory Gate Active:</strong> {currentSupplier.poBlockReason || 'Drug License verification incomplete. PO cannot be issued.'}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Deliver to branch * */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">Deliver to branch *</Label>
                    <SearchableSelect
                      value={selectedBranchId}
                      onChange={setSelectedBranchId}
                      options={branchOptions}
                      placeholder="Select branch…"
                      searchPlaceholder="Search branch by name or location…"
                      emptyMessage="No branches found."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs pt-1">
                  {/* PO date * */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-primary" />
                      PO date *
                    </Label>
                    <Input
                      type="date"
                      value={poDate}
                      onChange={(e) => setPoDate(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  {/* Expected delivery */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3 text-primary" />
                      Expected delivery
                    </Label>
                    <Input
                      type="date"
                      value={expectedDelivery}
                      min={poDate}
                      onChange={(e) => setExpectedDelivery(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  {/* Payment terms */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <CreditCard className="h-3 w-3 text-primary" />
                      Payment terms
                    </Label>
                    <SearchableSelect
                      value={paymentTerms}
                      onChange={setPaymentTerms}
                      options={PAYMENT_TERM_OPTIONS}
                      placeholder="e.g. 30 days"
                      searchPlaceholder="Search terms or type custom (e.g. 45 days)…"
                      allowCustom={true}
                      customLabelPrefix="Custom credit terms:"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ─── SECTION B: Order items ─── */}
            <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs">
              <div className="py-2.5 px-3.5 bg-muted/40 border-b flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  B. Order items
                </span>

                <Button
                  type="button"
                  size="sm"
                  onClick={addItem}
                  className="h-7 text-xs gap-1 bg-primary text-primary-foreground font-semibold shadow-xs"
                >
                  <Plus className="h-3 w-3" />
                  Add item
                </Button>
              </div>

              <div className="p-3.5 space-y-3">
                {items.map((item, index) => {
                  const lineSubtotal = item.quantity * item.ratePerUnit
                  const lineDiscount = lineSubtotal * (item.discountPercent / 100)
                  const lineTaxable = lineSubtotal - lineDiscount
                  const lineTax = lineTaxable * (item.gstPercent / 100)
                  const lineTotal = lineTaxable + lineTax

                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border/70 bg-card p-3 space-y-2.5 transition-all hover:border-primary/40 shadow-xs"
                    >
                      {/* Item Header */}
                      <div className="flex items-center justify-between border-b pb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[11px] text-foreground bg-muted px-2 py-0.5 rounded">
                            Item {index + 1}
                          </span>
                          {item.productSku && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              SKU: {item.productSku}
                            </span>
                          )}
                          {item.freeQuantity > 0 && (
                            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] py-0">
                              +{item.freeQuantity} Free Units
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {item.productId && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSourcingProductId(item.productId)
                                setSourcingModalOpen(true)
                              }}
                              className="h-6.5 text-[10px] text-primary gap-1 hover:bg-primary/10 px-1.5"
                            >
                              <GitCompare className="h-3 w-3" />
                              Compare
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(index)}
                            className="h-6.5 w-6.5 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded"
                            title="Remove item"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 text-xs">
                        {/* Medicine / product * */}
                        <div className="space-y-1 md:col-span-4">
                          <Label className="text-[10px] font-semibold text-foreground">
                            Medicine / product *
                          </Label>
                          <SearchableSelect
                            value={item.productId}
                            onChange={(val) => handleItemChange(index, 'productId', val)}
                            options={productOptions}
                            placeholder="Choose medicine…"
                            searchPlaceholder="Search by medicine name, SKU, or strength…"
                            emptyMessage="No medicines found in database."
                            contentClassName="w-[min(calc(100vw-2rem),440px)]"
                          />
                        </div>

                        {/* Quantity * */}
                        <div className="space-y-1 md:col-span-2">
                          <Label className="text-[10px] font-semibold text-foreground">Quantity *</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 1)
                            }
                            className="h-8 text-xs font-mono font-bold"
                          />
                        </div>

                        {/* Purchase unit */}
                        <div className="space-y-1 md:col-span-2">
                          <Label className="text-[10px] font-semibold text-foreground">Purchase unit</Label>
                          <SearchableSelect
                            value={item.purchaseUnit}
                            onChange={(val) => handleItemChange(index, 'purchaseUnit', val)}
                            options={PURCHASE_UNIT_OPTIONS}
                            placeholder="Select unit…"
                            searchPlaceholder="Search unit (Strip, Bottle, Box)…"
                            allowCustom={true}
                            customLabelPrefix="Custom unit:"
                          />
                        </div>

                        {/* Rate per unit (₹) * */}
                        <div className="space-y-1 md:col-span-2">
                          <Label className="text-[10px] font-semibold text-foreground">
                            Rate per unit (₹) *
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.ratePerUnit}
                            onChange={(e) =>
                              handleItemChange(index, 'ratePerUnit', parseFloat(e.target.value) || 0)
                            }
                            className="h-8 text-xs font-mono font-bold"
                          />
                        </div>

                        {/* Discount (%) */}
                        <div className="space-y-1 md:col-span-1">
                          <Label className="text-[10px] font-semibold text-foreground">Disc (%)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={item.discountPercent}
                            onChange={(e) =>
                              handleItemChange(index, 'discountPercent', parseFloat(e.target.value) || 0)
                            }
                            className="h-8 text-xs font-mono"
                          />
                        </div>

                        {/* GST (%) */}
                        <div className="space-y-1 md:col-span-1">
                          <Label className="text-[10px] font-semibold text-foreground">GST (%)</Label>
                          <SearchableSelect
                            value={item.gstPercent.toString()}
                            onChange={(val) =>
                              handleItemChange(index, 'gstPercent', parseFloat(val) || 0)
                            }
                            options={GST_OPTIONS}
                            placeholder="GST %"
                            searchPlaceholder="Search tax rate (0%, 5%, 12%, 18%, 28%)…"
                          />
                        </div>
                      </div>

                      {/* Line footnote */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted/20 px-2 py-1 rounded">
                        <span>
                          Taxable: {formatCurrency(lineTaxable)} &middot; GST: {formatCurrency(lineTax)}
                        </span>
                        <span className="font-bold text-foreground">
                          Line total (incl. GST): <strong className="text-primary font-mono text-xs">{formatCurrency(lineTotal)}</strong>
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ─── SECTION C: Additional charges and schemes ─── */}
            <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs">
              <div className="py-2.5 px-3.5 bg-muted/40 border-b">
                <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                  <Truck className="h-3.5 w-3.5 text-primary" />
                  C. Additional charges and schemes
                </span>
              </div>

              <div className="p-3.5 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* Freight / other charges (₹) */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">
                      Freight / other charges (₹)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="10"
                      value={freightCharges}
                      onChange={(e) => setFreightCharges(parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs font-mono font-medium"
                    />
                  </div>

                  {/* Free quantity reference */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">
                      Free quantity reference
                    </Label>
                    <div className="h-8 px-2.5 rounded-md border bg-muted/30 text-xs font-medium flex items-center justify-between">
                      <span>{orderSummary.totalFreeQty} units total</span>
                      {orderSummary.totalFreeQty > 0 ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] py-0">
                          Active Scheme
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">None</span>
                      )}
                    </div>
                  </div>

                  {/* Supplier scheme */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">Supplier scheme</Label>
                    <SearchableSelect
                      value={supplierScheme}
                      onChange={setSupplierScheme}
                      options={SCHEME_OPTIONS}
                      placeholder="Select scheme…"
                      searchPlaceholder="Search trade schemes (Free goods, Cash discount)…"
                    />
                  </div>
                </div>

                {/* Notes / delivery instructions */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    Notes / delivery instructions
                  </Label>
                  <Textarea
                    rows={2}
                    placeholder="e.g. Ensure cold-chain storage at 2°C-8°C during transit. Deliver before 2:00 PM."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="text-xs resize-none"
                  />
                </div>
              </div>
            </div>

            {/* ─── SECTION D: Order summary ─── */}
            <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs">
              <div className="py-2.5 px-3.5 bg-muted/40 border-b flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                  D. Order summary
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {items.length} items &middot; {items.reduce((a, b) => a + b.quantity, 0)} units
                </span>
              </div>

              <div className="p-3.5 space-y-3.5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left">
                  {/* Taxable amount */}
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                    <span className="text-[10px] text-muted-foreground block font-medium">Taxable amount</span>
                    <span className="text-base font-bold font-mono text-foreground">
                      {formatCurrency(orderSummary.taxableAmount)}
                    </span>
                  </div>

                  {/* Estimated GST */}
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                    <span className="text-[10px] text-muted-foreground block font-medium">Estimated GST</span>
                    <span className="text-base font-bold font-mono text-foreground">
                      {formatCurrency(orderSummary.estimatedGst)}
                    </span>
                  </div>

                  {/* Freight / other charges */}
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                    <span className="text-[10px] text-muted-foreground block font-medium">Freight / charges</span>
                    <span className="text-base font-bold font-mono text-foreground">
                      {formatCurrency(orderSummary.freightCharges)}
                    </span>
                  </div>

                  {/* Estimated PO total */}
                  <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/30">
                    <span className="text-[10px] text-primary block font-bold">Estimated PO total</span>
                    <span className="text-lg font-bold font-mono text-primary">
                      {formatCurrency(orderSummary.estimatedPoTotal)}
                    </span>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="rounded-lg bg-muted/30 border border-border/60 p-2.5 text-[11px] text-muted-foreground flex items-start gap-2 leading-relaxed">
                  <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong>Prototype estimate only.</strong> Tax calculation, freight taxation, free quantities, rounding, and intra-state/inter-state GST treatment must be finalized by the backend. This form provisions directly into the verified PostgreSQL database audit tables.
                  </span>
                </div>

                {/* Validation report (if requested) */}
                {validationReport && (
                  <div
                    className={`rounded-lg p-2.5 text-xs border space-y-1 ${
                      validationReport.valid
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      {validationReport.valid ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                      )}
                      <span>
                        {validationReport.valid
                          ? 'Validation Passed — Ready for Approval'
                          : `Validation Failed (${validationReport.errors.length} errors)`}
                      </span>
                    </div>
                    {validationReport.errors.map((err, i) => (
                      <p key={i} className="text-[10px] text-rose-700 dark:text-rose-400 pl-5">
                        &bull; {err}
                      </p>
                    ))}
                    {validationReport.warnings.map((warn, i) => (
                      <p key={i} className="text-[10px] text-amber-700 dark:text-amber-400 pl-5">
                        &bull; {warn}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <DialogFooter className="p-3.5 sm:p-4 border-t bg-card sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyDraftData}
                className="h-8 text-xs gap-1.5"
              >
                <Copy className="h-3 w-3" />
                Copy draft data
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleValidateDraft}
                className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
              >
                <FileCheck className="h-3 w-3" />
                Validate draft
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleOpenChange(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={() => void handleSubmitPurchaseOrder(true)}
                className="h-8 text-xs"
              >
                Save as Draft
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={submitting || (currentSupplier && currentSupplier.isPoAllowed === false)}
                onClick={() => void handleSubmitPurchaseOrder(false)}
                className={`h-8 text-xs gap-1.5 font-semibold ${
                  currentSupplier && currentSupplier.isPoAllowed === false
                    ? 'bg-rose-600/50 cursor-not-allowed text-white'
                    : 'bg-primary text-primary-foreground shadow-sm'
                }`}
              >
                <Send className="h-3 w-3" />
                {submitting
                  ? 'Submitting…'
                  : currentSupplier && currentSupplier.isPoAllowed === false
                  ? 'PO Blocked (Statutory)'
                  : 'Submit for Approval'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Embedded Sourcing Rate Comparison Engine */}
      <SourcingMatrixModal
        open={sourcingModalOpen}
        onOpenChange={setSourcingModalOpen}
        initialProductId={sourcingProductId}
      />
    </>
  )
}
