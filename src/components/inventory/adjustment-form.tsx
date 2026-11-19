'use client'

import { formatRack, formatShelf } from '@/lib/utils/rack'

// ─────────────────────────────────────────────────────────────
// Component — AdjustmentFormDialog
// High-standard stock adjustment dialog:
// - Physical storage location coordinates (Rack > Shelf > Box)
// - Chemist Dead Stock Radar & Expiry Alert integration
// - Batch & Vendor-specific inventory selection
// - Physical Stock Count discrepancy calculator
// - Real-time individual item cost and MRP value calculation
// - Cumulative Multi-Item Sheet: Append multiple items, calculate
//   individual item values and grand cumulative impact
// ─────────────────────────────────────────────────────────────
import {
  AlertTriangle,
  Boxes,
  Building2,
  Calculator,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  HelpCircle,
  Info,
  Layers,
  Package,
  Plus,
  Search,
  Square,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/lib/hooks/use-toast'

export interface VendorBatchItem {
  id: string
  batchNumber: string
  productId: string
  productName: string
  sku: string
  rack?: string | null
  shelf?: string | null
  box?: string | null
  expiryDate: string | Date
  isNearExpiry: boolean
  costPrice: number
  mrp: number
  availableQuantity: number
}

export interface VendorSummary {
  supplierId: string
  supplierName: string
  contactPerson?: string | null
  phone?: string | null
  creditDays: number
  totalSkus: number
  totalAvailableUnits: number
  totalValuationAtCost: number
  totalValuationAtMrp: number
  nearExpiryUnitsCount: number
  batches: VendorBatchItem[]
}

interface AdjustmentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultBranchId?: string | null
  defaultProductId?: string | null
  defaultProductName?: string | null
  defaultSupplierId?: string | null
  initialItems?: AppendedAdjustmentItem[]
  onCreated: (message: string) => void
}

interface BranchOption {
  id: string
  name: string
  code: string | null
}

interface ProductOption {
  id: string
  name: string
  sku: string
}

interface BatchOption {
  id: string
  batchNumber: string
  expiryDate: string
  daysToExpiry: number
  isExpired: boolean
  isNearExpiry: boolean
  quantity: number
  purchasePrice: number
  mrp: number
  supplier?: {
    id: string
    name: string
    phone?: string | null
    email?: string | null
  } | null
}

interface ProductContextData {
  product: {
    id: string
    name: string
    sku: string
    barcode?: string | null
    unitOfMeasure: string
    rack?: string | null
    shelf?: string | null
    box?: string | null
    mrp: number
    costPrice: number
  }
  inventory: {
    availableQuantity: number
    totalQuantity: number
    reservedQuantity: number
  }
  batches: BatchOption[]
  deadStock: {
    daysInactive: number
    status: 'HEALTHY' | 'SLOW_MOVING' | 'DEAD_STOCK' | 'OBSOLETE'
    isDeadStock: boolean
    lastActivityDate: string | null
  }
  recommendations: string[]
}

export interface AppendedAdjustmentItem {
  id: string
  productId: string
  productName: string
  sku: string
  rack?: string | null
  shelf?: string | null
  box?: string | null
  batchId?: string
  batchNumber?: string
  expiryDate?: string
  supplierName?: string
  adjustmentType: string
  quantity: number
  unitCost: number
  unitMrp: number
  itemCostValue: number
  itemMrpValue: number
  reason: string
  notes?: string
}

const ADJUSTMENT_TYPES = [
  { value: 'PHYSICAL_COUNT', label: 'Physical Count Discrepancy' },
  { value: 'EXPIRY', label: 'Near Expiry / Expired Return' },
  { value: 'DAMAGE', label: 'Damaged Goods Write-off' },
  { value: 'THEFT', label: 'Theft / Missing Units' },
  { value: 'CORRECTION', label: 'Inventory Correction' },
  { value: 'OPENING_STOCK', label: 'Opening Stock Entry' },
]

export function AdjustmentFormDialog({
  open,
  onOpenChange,
  defaultBranchId,
  defaultProductId,
  defaultProductName,
  defaultSupplierId,
  initialItems,
  onCreated,
}: AdjustmentFormDialogProps) {
  const toast = useToast()

  const [workflowMode, setWorkflowMode] = useState<'SINGLE' | 'CUMULATIVE'>('SINGLE')

  const [branches, setBranches] = useState<BranchOption[]>([])
  const [vendors, setVendors] = useState<VendorSummary[]>([])
  const [loadingVendors, setLoadingVendors] = useState(false)
  const [selectedVendorId, setSelectedVendorId] = useState<string>(defaultSupplierId ?? 'all')
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([])
  const [vendorItemSearch, setVendorItemSearch] = useState('')
  const [vendorBulkType, setVendorBulkType] = useState<string>('PHYSICAL_COUNT')
  const [vendorBulkReason, setVendorBulkReason] = useState<string>('')
  const [showVendorQuickAdd, setShowVendorQuickAdd] = useState<boolean>(true)

  const [products, setProducts] = useState<ProductOption[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('')

  const [branchId, setBranchId] = useState<string>(defaultBranchId ?? '')
  const [productId, setProductId] = useState<string>(defaultProductId ?? '')
  const [batchId, setBatchId] = useState<string>('none')
  const [adjustmentType, setAdjustmentType] = useState<string>('PHYSICAL_COUNT')
  const [inputMode, setInputMode] = useState<'DELTA' | 'PHYSICAL_COUNT'>('PHYSICAL_COUNT')
  const [physicalCount, setPhysicalCount] = useState<string>('')
  const [quantity, setQuantity] = useState<string>('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cumulative Appended Items List
  const [appendedItems, setAppendedItems] = useState<AppendedAdjustmentItem[]>([])

  // Product Context & Chemist Assistance
  const [contextData, setContextData] = useState<ProductContextData | null>(null)
  const [loadingContext, setLoadingContext] = useState(false)

  // Reset state on open
  useEffect(() => {
    if (open) {
      setBranchId(defaultBranchId ?? '')
      setProductId(defaultProductId ?? '')
      setSelectedVendorId(defaultSupplierId ?? 'all')
      setBatchId('none')
      setAdjustmentType('PHYSICAL_COUNT')
      setInputMode('PHYSICAL_COUNT')
      setPhysicalCount('')
      setQuantity('')
      setReason('')
      setNotes('')
      setError(null)
      setContextData(null)
      setSelectedBatchIds([])
      setVendorItemSearch('')
      setVendorBulkType('PHYSICAL_COUNT')
      setVendorBulkReason('')
      setShowVendorQuickAdd(true)

      if (initialItems && initialItems.length > 0) {
        setAppendedItems(initialItems)
        setWorkflowMode('CUMULATIVE')
      } else if (defaultSupplierId) {
        setAppendedItems([])
        setWorkflowMode('CUMULATIVE')
      } else {
        setAppendedItems([])
        setWorkflowMode('SINGLE')
      }

      if (defaultProductId && defaultProductName) {
        setProducts((prev) => {
          if (prev.some((p) => p.id === defaultProductId)) return prev
          return [{ id: defaultProductId, name: defaultProductName, sku: '' }, ...prev]
        })
      }
    }
  }, [open, defaultBranchId, defaultProductId, defaultProductName, defaultSupplierId, initialItems])

  // Load branches
  useEffect(() => {
    fetch('/api/inventory/branches')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setBranches(d.data as BranchOption[])
      })
      .catch(() => undefined)
  }, [])

  // Load vendor stock with batches
  useEffect(() => {
    if (!open) return
    setLoadingVendors(true)
    const params = new URLSearchParams()
    if (branchId && branchId !== 'all') params.set('branchId', branchId)

    fetch(`/api/inventory/vendor-stock?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) {
          setVendors(d.data as VendorSummary[])
        }
      })
      .catch(() => undefined)
      .finally(() => setLoadingVendors(false))
  }, [open, branchId])

  // Load products list with debounce
  useEffect(() => {
    if (!open) return
    const params = new URLSearchParams()
    params.set('page', '1')
    params.set('limit', '100')
    params.set('isActive', 'true')
    if (debouncedProductSearch) params.set('search', debouncedProductSearch)
    fetch(`/api/products?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setProducts((d.data as ProductOption[]) ?? [])
      })
      .catch(() => undefined)
  }, [open, debouncedProductSearch])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedProductSearch(productSearch), 350)
    return () => clearTimeout(t)
  }, [productSearch])

  // Fetch product context (storage coordinates, batches, vendor, dead stock)
  useEffect(() => {
    if (!open || !productId) {
      setContextData(null)
      return
    }

    setLoadingContext(true)
    const params = new URLSearchParams()
    params.set('productId', productId)
    if (branchId) params.set('branchId', branchId)

    fetch(`/api/inventory/adjustments/context?${params.toString()}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setContextData(res.data as ProductContextData)
          if (res.data.deadStock?.isDeadStock && !reason) {
            setReason(`Dead stock reconciliation (${res.data.deadStock.daysInactive}d inactive)`)
          }
        }
      })
      .catch(() => undefined)
      .finally(() => setLoadingContext(false))
  }, [open, productId, branchId])

  // Handle Physical Count auto-calculation of delta
  useEffect(() => {
    if (inputMode === 'PHYSICAL_COUNT' && contextData) {
      const currentSystemStock = contextData.inventory?.availableQuantity ?? 0
      if (physicalCount.trim() !== '') {
        const parsedPhysical = Number(physicalCount)
        if (Number.isFinite(parsedPhysical)) {
          const delta = parsedPhysical - currentSystemStock
          setQuantity(String(delta))
        }
      }
    }
  }, [inputMode, physicalCount, contextData])

  // Selected batch
  const selectedBatch = useMemo(() => {
    if (!contextData || batchId === 'none') return null
    return contextData.batches.find((b) => b.id === batchId) ?? null
  }, [contextData, batchId])

  // Financial impact calculation for the active input item
  const parsedDelta = Number(quantity)
  const isDeltaValid = Number.isFinite(parsedDelta) && parsedDelta !== 0

  const currentItemValues = useMemo(() => {
    if (!contextData || !isDeltaValid) return null
    const unitCost = selectedBatch
      ? selectedBatch.purchasePrice
      : contextData.product.costPrice || contextData.product.mrp * 0.7
    const unitMrp = selectedBatch ? selectedBatch.mrp : contextData.product.mrp

    const itemCostValue = Math.round(parsedDelta * unitCost * 100) / 100
    const itemMrpValue = Math.round(parsedDelta * unitMrp * 100) / 100

    return {
      unitCost,
      unitMrp,
      itemCostValue,
      itemMrpValue,
      isAutoApproved: Math.abs(parsedDelta) <= 10,
    }
  }, [contextData, selectedBatch, parsedDelta, isDeltaValid])

  // Cumulative totals across all appended items
  const cumulativeSummary = useMemo(() => {
    let totalQty = 0
    let totalCost = 0
    let totalMrp = 0

    for (const item of appendedItems) {
      totalQty += item.quantity
      totalCost += item.itemCostValue
      totalMrp += item.itemMrpValue
    }

    return {
      itemCount: appendedItems.length,
      netQuantity: totalQty,
      netCostImpact: Math.round(totalCost * 100) / 100,
      netMrpImpact: Math.round(totalMrp * 100) / 100,
      isAutoApproved: Math.abs(totalQty) <= 10,
    }
  }, [appendedItems])

  // Append current medicine to cumulative sheet
  function handleAppendItem() {
    setError(null)
    if (!contextData) {
      setError('Please select a medicine before appending.')
      return
    }
    if (!isDeltaValid) {
      setError('Quantity delta must be a non-zero number.')
      return
    }
    if (!reason.trim()) {
      setError('A valid audit reason is required.')
      return
    }

    const unitCost = selectedBatch
      ? selectedBatch.purchasePrice
      : contextData.product.costPrice || contextData.product.mrp * 0.7
    const unitMrp = selectedBatch ? selectedBatch.mrp : contextData.product.mrp

    const newItem: AppendedAdjustmentItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      productId: contextData.product.id,
      productName: contextData.product.name,
      sku: contextData.product.sku,
      rack: contextData.product.rack,
      shelf: contextData.product.shelf,
      box: contextData.product.box,
      batchId: batchId !== 'none' ? batchId : undefined,
      batchNumber: selectedBatch?.batchNumber,
      expiryDate: selectedBatch?.expiryDate,
      supplierName: selectedBatch?.supplier?.name,
      adjustmentType,
      quantity: parsedDelta,
      unitCost,
      unitMrp,
      itemCostValue: Math.round(parsedDelta * unitCost * 100) / 100,
      itemMrpValue: Math.round(parsedDelta * unitMrp * 100) / 100,
      reason: reason.trim(),
      notes: notes.trim() || undefined,
    }

    setAppendedItems((prev) => [...prev, newItem])
    toast.success(`Appended ${newItem.productName} to cumulative sheet`)

    // Clear item-specific inputs for the next entry
    setProductId('')
    setContextData(null)
    setBatchId('none')
    setPhysicalCount('')
    setQuantity('')
    setReason('')
    setNotes('')
  }

  // Delete item from cumulative sheet
  function handleRemoveAppendedItem(id: string) {
    setAppendedItems((prev) => prev.filter((i) => i.id !== id))
  }

  // Update single item directly in cumulative sheet
  function handleUpdateAppendedItem(id: string, updates: Partial<AppendedAdjustmentItem>) {
    setAppendedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const updated = { ...item, ...updates }
        if (updates.quantity !== undefined) {
          updated.itemCostValue = Math.round(updates.quantity * updated.unitCost * 100) / 100
          updated.itemMrpValue = Math.round(updates.quantity * updated.unitMrp * 100) / 100
        }
        return updated
      })
    )
  }

  // Selected vendor object
  const selectedVendor = useMemo(() => {
    if (selectedVendorId === 'all') return null
    return vendors.find((v) => v.supplierId === selectedVendorId) ?? null
  }, [vendors, selectedVendorId])

  // Filter vendor's batches by search
  const vendorFilteredBatches = useMemo(() => {
    if (!selectedVendor) return []
    if (!vendorItemSearch.trim()) return selectedVendor.batches
    const q = vendorItemSearch.toLowerCase()
    return selectedVendor.batches.filter(
      (b) =>
        b.productName.toLowerCase().includes(q) ||
        b.batchNumber.toLowerCase().includes(q) ||
        b.sku.toLowerCase().includes(q) ||
        (b.box && b.box.toLowerCase().includes(q))
    )
  }, [selectedVendor, vendorItemSearch])

  // Toggle single batch in vendor bulk-add checklist
  function handleToggleBatchSelection(bId: string) {
    setSelectedBatchIds((prev) =>
      prev.includes(bId) ? prev.filter((id) => id !== bId) : [...prev, bId]
    )
  }

  function handleSelectAllVendorBatches() {
    if (!selectedVendor) return
    setSelectedBatchIds(vendorFilteredBatches.map((b) => b.id))
  }

  function handleSelectNearExpiryVendorBatches() {
    if (!selectedVendor) return
    setSelectedBatchIds(vendorFilteredBatches.filter((b) => b.isNearExpiry).map((b) => b.id))
  }

  function handleClearBatchSelection() {
    setSelectedBatchIds([])
  }

  // Append checked vendor batches into cumulative adjustment sheet
  function handleAppendSelectedVendorBatches() {
    if (!selectedVendor || selectedBatchIds.length === 0) return

    const batchesToAppend = selectedVendor.batches.filter((b) => selectedBatchIds.includes(b.id))
    const newItems: AppendedAdjustmentItem[] = []

    for (const b of batchesToAppend) {
      if (appendedItems.some((item) => item.batchId === b.id)) continue

      const defaultDelta = b.isNearExpiry ? -b.availableQuantity : -1
      const defaultType = b.isNearExpiry ? 'EXPIRY' : vendorBulkType || 'PHYSICAL_COUNT'
      const itemCostVal = Math.round(defaultDelta * b.costPrice * 100) / 100
      const itemMrpVal = Math.round(defaultDelta * b.mrp * 100) / 100

      newItems.push({
        id: `vend_${b.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        productId: b.productId,
        productName: b.productName,
        sku: b.sku,
        rack: b.rack,
        shelf: b.shelf,
        box: b.box,
        batchId: b.id,
        batchNumber: b.batchNumber,
        expiryDate: typeof b.expiryDate === 'string' ? b.expiryDate : new Date(b.expiryDate).toISOString(),
        supplierName: selectedVendor.supplierName,
        adjustmentType: defaultType,
        quantity: defaultDelta,
        unitCost: b.costPrice,
        unitMrp: b.mrp,
        itemCostValue: itemCostVal,
        itemMrpValue: itemMrpVal,
        reason:
          vendorBulkReason.trim() ||
          (b.isNearExpiry
            ? `Near-expiry return candidate (${selectedVendor.supplierName})`
            : `Vendor audit reconciliation (${selectedVendor.supplierName})`),
        notes: `Vendor: ${selectedVendor.supplierName}`,
      })
    }

    if (newItems.length > 0) {
      setAppendedItems((prev) => [...prev, ...newItems])
      setSelectedBatchIds([])
      toast.success(`Appended ${newItems.length} item(s) from ${selectedVendor.supplierName}`)
      setWorkflowMode('CUMULATIVE')
    } else {
      toast.error('Selected items are already in the cumulative sheet')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!branchId) {
      setError('Please select a branch.')
      return
    }

    // Single item submission
    if (workflowMode === 'SINGLE') {
      if (!productId) {
        setError('Please select a medicine.')
        return
      }
      if (!isDeltaValid) {
        setError('Quantity delta must be a non-zero number.')
        return
      }
      if (!reason.trim()) {
        setError('A valid audit reason is required.')
        return
      }

      setSubmitting(true)
      try {
        const res = await fetch('/api/inventory/adjustments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branchId,
            productId,
            batchId: batchId !== 'none' ? batchId : undefined,
            adjustmentType,
            quantity: parsedDelta,
            reason: reason.trim(),
            notes: notes.trim() || undefined,
          }),
        })

        const json = (await res.json()) as {
          success: boolean
          message?: string
          error?: { message?: string }
        }

        if (res.ok && json.success) {
          toast.success(json.message ?? 'Stock adjustment saved successfully.')
          onCreated(json.message ?? 'Stock adjustment saved.')
          onOpenChange(false)
        } else {
          setError(json.error?.message ?? 'Failed to create adjustment.')
        }
      } catch {
        setError('Network error while processing adjustment.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Cumulative multi-item submission
    if (workflowMode === 'CUMULATIVE') {
      if (appendedItems.length === 0) {
        setError('Please append at least one medicine item to the cumulative sheet.')
        return
      }

      setSubmitting(true)
      try {
        const payload = {
          branchId,
          items: appendedItems.map((item) => ({
            productId: item.productId,
            batchId: item.batchId,
            adjustmentType: item.adjustmentType,
            quantity: item.quantity,
            reason: item.reason,
            notes: item.notes,
          })),
        }

        const res = await fetch('/api/inventory/adjustments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const json = (await res.json()) as {
          success: boolean
          message?: string
          error?: { message?: string }
        }

        if (res.ok && json.success) {
          toast.success(json.message ?? 'Cumulative stock adjustments committed successfully.')
          onCreated(json.message ?? 'Cumulative adjustments saved.')
          onOpenChange(false)
        } else {
          setError(json.error?.message ?? 'Failed to commit cumulative adjustments.')
        }
      } catch {
        setError('Network error while committing cumulative adjustments.')
      } finally {
        setSubmitting(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <Boxes className="h-5 w-5 text-primary" />
                Stock Adjustment &amp; Chemist Audit
              </DialogTitle>

              {/* Mode Toggle: Single vs Cumulative */}
              <Tabs
                value={workflowMode}
                onValueChange={(v) => setWorkflowMode(v as 'SINGLE' | 'CUMULATIVE')}
                className="w-auto"
              >
                <TabsList className="h-8">
                  <TabsTrigger value="SINGLE" className="text-xs">
                    Single Item
                  </TabsTrigger>
                  <TabsTrigger value="CUMULATIVE" className="text-xs">
                    <Plus className="h-3 w-3 mr-1 text-primary" />
                    Cumulative Multi-Item ({appendedItems.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <DialogDescription>
              {workflowMode === 'SINGLE'
                ? 'Reconcile physical discrepancies or write-offs for an individual medicine.'
                : 'Append multiple medicines into a cumulative audit sheet with individual item valuations and grand total impact.'}
            </DialogDescription>
          </DialogHeader>

          {/* Branch & Vendor Scope Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="branch" className="text-xs font-semibold">
                Branch Location *
              </Label>
              <Select value={branchId} onValueChange={setBranchId} disabled={branches.length === 0}>
                <SelectTrigger id="branch" className="h-9">
                  <SelectValue placeholder="Select pharmacy branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} {b.code ? `(${b.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vendor" className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  Vendor / Supplier Scope
                </span>
                {selectedVendor && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                    {selectedVendor.batches.length} batches
                  </Badge>
                )}
              </Label>
              <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                <SelectTrigger id="vendor" className="h-9">
                  <SelectValue placeholder="All Vendors / Direct Catalog" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors / Direct Catalog</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.supplierId} value={v.supplierId}>
                      {v.supplierName} ({v.batches.length} batches)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vendor Quick-Add & Bulk Append Panel (when vendor is selected) */}
          {selectedVendor && (
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="font-bold text-xs text-foreground">
                    Vendor Inventory: {selectedVendor.supplierName}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedVendor.batches.length} batches
                  </Badge>
                  {selectedVendor.nearExpiryUnitsCount > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      {selectedVendor.nearExpiryUnitsCount} near-expiry units
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={handleSelectAllVendorBatches}
                  >
                    Select All ({vendorFilteredBatches.length})
                  </Button>
                  {selectedVendor.batches.some((b) => b.isNearExpiry) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2 text-rose-600 border-rose-300 hover:bg-rose-50"
                      onClick={handleSelectNearExpiryVendorBatches}
                    >
                      Near-Expiry Only
                    </Button>
                  )}
                  {selectedBatchIds.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-muted-foreground"
                      onClick={handleClearBatchSelection}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Vendor metadata details */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 flex-wrap gap-2">
                <span>
                  Total Units in Stock: <strong className="text-foreground">{selectedVendor.totalAvailableUnits}</strong> · Total Valuation: <strong className="text-foreground">₹{selectedVendor.totalValuationAtCost.toFixed(2)}</strong>
                </span>
                {selectedVendor.phone && <span>Contact: {selectedVendor.phone}</span>}
              </div>

              {/* Search within vendor medicines */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={`Search ${selectedVendor.supplierName} medicines, batches, SKU, or rack...`}
                  value={vendorItemSearch}
                  onChange={(e) => setVendorItemSearch(e.target.value)}
                  className="h-7 pl-8 text-xs bg-background"
                />
              </div>

              {/* Batch checklist table */}
              <div className="border rounded bg-background divide-y max-h-44 overflow-y-auto">
                {vendorFilteredBatches.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground italic">
                    No batches matching &quot;{vendorItemSearch}&quot; for this vendor.
                  </div>
                ) : (
                  vendorFilteredBatches.map((b) => {
                    const isSelected = selectedBatchIds.includes(b.id)
                    const isAlreadyAppended = appendedItems.some((i) => i.batchId === b.id)
                    const loc = [
                      b.rack ? `Rack ${formatRack(b.rack)}` : null,
                      b.shelf ? b.shelf : null,
                      b.box ? `Box ${b.box}` : null,
                    ]
                      .filter(Boolean)
                      .join(' › ')

                    return (
                      <div
                        key={b.id}
                        onClick={() => !isAlreadyAppended && handleToggleBatchSelection(b.id)}
                        className={`p-2 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                          isAlreadyAppended
                            ? 'opacity-40 bg-muted/40 cursor-not-allowed'
                            : isSelected
                              ? 'bg-primary/10 border-l-2 border-l-primary'
                              : 'hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center gap-2 max-w-[320px]">
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <div>
                            <div className="font-medium text-foreground flex items-center gap-1.5">
                              <span>{b.productName}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">({b.sku})</span>
                              {b.isNearExpiry && (
                                <span className="text-[9px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1 py-0.2 rounded border border-rose-300">
                                  Near Expiry
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                              <span className="font-mono">Batch: {b.batchNumber}</span>
                              {loc && <span>Storage: {loc}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs font-mono text-right">
                          <div>
                            <span className="font-semibold text-foreground">Stock: {b.availableQuantity}</span>
                            <div className="text-[10px] text-muted-foreground">
                              Cost: ₹{b.costPrice.toFixed(2)} · MRP: ₹{b.mrp.toFixed(2)}
                            </div>
                          </div>
                          {isAlreadyAppended && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1 text-emerald-600">
                              Added
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Append selected vendor batches button */}
              <div className="flex items-center justify-between pt-1">
                <div className="text-xs text-muted-foreground">
                  {selectedBatchIds.length} batch(es) selected from {selectedVendor.supplierName}
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={selectedBatchIds.length === 0}
                  onClick={handleAppendSelectedVendorBatches}
                  className="h-7 text-xs bg-primary text-primary-foreground font-semibold gap-1.5 shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Append {selectedBatchIds.length} Selected to Cumulative Sheet
                </Button>
              </div>
            </div>
          )}

          {/* Appended Items Cumulative Sheet (when in CUMULATIVE mode) */}
          {workflowMode === 'CUMULATIVE' && (
            <div className="rounded-lg border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="font-bold text-xs">Appended Medicines in Cumulative Sheet</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {appendedItems.length} items
                  </Badge>
                </div>

                {/* Cumulative Totals Preview */}
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="text-muted-foreground">Net Delta: {cumulativeSummary.netQuantity}</span>
                  <span
                    className={
                      cumulativeSummary.netCostImpact >= 0
                        ? 'font-bold text-emerald-600'
                        : 'font-bold text-rose-600'
                    }
                  >
                    {cumulativeSummary.netCostImpact >= 0 ? '+' : ''}₹
                    {cumulativeSummary.netCostImpact.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    (Cost)
                  </span>
                  <span className="text-muted-foreground">
                    MRP: {cumulativeSummary.netMrpImpact >= 0 ? '+' : ''}₹
                    {cumulativeSummary.netMrpImpact.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {appendedItems.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground italic bg-muted/20 rounded">
                  No medicines appended yet. Select a vendor above or pick an individual medicine below to append.
                </div>
              ) : (
                <div className="divide-y max-h-56 overflow-y-auto pr-1">
                  {appendedItems.map((item, idx) => {
                    const loc = [
                      item.rack ? `Rack ${formatRack(item.rack)}` : null,
                      item.shelf ? item.shelf : null,
                      item.box ? `Box ${item.box}` : null,
                    ]
                      .filter(Boolean)
                      .join(' › ')

                    return (
                      <div
                        key={item.id}
                        className="py-2.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5 max-w-[240px]">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <span>{idx + 1}.</span>
                            <span className="truncate" title={item.productName}>{item.productName}</span>
                            <span className="text-muted-foreground font-mono text-[10px]">({item.sku})</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            {loc && <span>Storage: {loc}</span>}
                            {item.batchNumber && <span>Batch: {item.batchNumber}</span>}
                            {item.supplierName && <span>Vendor: {item.supplierName}</span>}
                          </div>
                        </div>

                        {/* Interactive Delta Quantity & Individual Item Valuation */}
                        <div className="flex items-center gap-3 text-xs font-mono">
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              className="h-7 w-16 text-center text-xs font-bold font-mono px-1 bg-background"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0
                                handleUpdateAppendedItem(item.id, { quantity: val })
                              }}
                            />
                            <span className="text-[10px] text-muted-foreground">units</span>
                          </div>

                          <div className="text-right min-w-[90px]">
                            <div
                              className={
                                item.itemCostValue >= 0 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'
                              }
                            >
                              {item.itemCostValue >= 0 ? '+' : ''}₹{item.itemCostValue.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              MRP: {item.itemMrpValue >= 0 ? '+' : ''}₹{item.itemMrpValue.toFixed(2)}
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-rose-600"
                            onClick={() => handleRemoveAppendedItem(item.id)}
                            title="Remove from cumulative sheet"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Medicine Entry Section */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-foreground">
              <span>{workflowMode === 'CUMULATIVE' ? 'Add Medicine to Cumulative Sheet:' : 'Select Medicine to Adjust:'}</span>
              {contextData && (
                <span className="text-muted-foreground font-normal">
                  Book Stock: <span className="font-bold text-foreground">{contextData.inventory?.availableQuantity ?? 0}</span> {contextData.product.unitOfMeasure}
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="product" className="text-xs font-semibold">
                Medicine / Product *
              </Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger id="product" className="h-9">
                  <SelectValue placeholder="Select medicine..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <div className="p-2 sticky top-0 bg-popover z-10 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search medicines..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="h-8 pl-8 text-xs"
                      />
                    </div>
                  </div>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-medium">{p.name}</span>
                      {p.sku && <span className="text-muted-foreground ml-1.5 text-xs">({p.sku})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Storage Coordinates & Vendor Info for the selected medicine */}
            {contextData && (
              <div className="rounded border bg-background p-2.5 space-y-2 text-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Storage Location:</span>
                    {contextData.product.rack || contextData.product.shelf || contextData.product.box ? (
                      <span className="inline-flex items-center gap-1 bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded text-[11px]">
                        {contextData.product.rack ? `Rack ${formatRack(contextData.product.rack)}` : ''}
                        {contextData.product.shelf ? ` › ${formatShelf(contextData.product.shelf)}` : ''}
                        {contextData.product.box ? ` › Box ${contextData.product.box}` : ''}
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-400/30 text-[10px]">
                        Unassigned Location
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                    <span>Cost: ₹{contextData.product.costPrice?.toFixed(2)}</span>
                    <span>MRP: ₹{contextData.product.mrp?.toFixed(2)}</span>
                  </div>
                </div>

                {/* Dead stock radar alert */}
                {contextData.deadStock?.isDeadStock && (
                  <div className="flex items-start gap-1.5 p-1.5 rounded bg-amber-500/10 text-amber-900 dark:text-amber-200 text-[11px]">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Dead stock: Inactive for {contextData.deadStock.daysInactive} days. Check shelf box {contextData.product.box || 'storage'}.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Batch & Vendor Dropdown */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="batch" className="text-xs font-semibold">
                  Batch &amp; Vendor (FEFO)
                </Label>
                {selectedBatch?.supplier && (
                  <span className="text-[11px] text-primary font-medium flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Vendor: {selectedBatch.supplier.name}
                  </span>
                )}
              </div>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger id="batch" className="h-9">
                  <SelectValue placeholder="All Batches / Product Aggregate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Apply to Overall Product (Auto FEFO)</SelectItem>
                  {contextData?.batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{b.batchNumber}</span>
                        <span className="text-muted-foreground text-xs">
                          (Exp: {new Date(b.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })})
                        </span>
                        <span className="text-xs font-semibold">Qty: {b.quantity}</span>
                        {b.isNearExpiry && (
                          <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1 rounded">
                            Near Expiry
                          </span>
                        )}
                        {b.supplier && (
                          <span className="text-xs text-muted-foreground">· {b.supplier.name}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Adjustment Type & Stock Calculation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="type" className="text-xs font-semibold">
                  Adjustment Type *
                </Label>
                <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                  <SelectTrigger id="type" className="h-9">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ADJUSTMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Stock-Take Calculation Mode</Label>
                <Tabs
                  value={inputMode}
                  onValueChange={(v) => setInputMode(v as 'DELTA' | 'PHYSICAL_COUNT')}
                  className="w-full"
                >
                  <TabsList className="grid grid-cols-2 h-9 w-full">
                    <TabsTrigger value="PHYSICAL_COUNT" className="text-xs">
                      <Calculator className="h-3.5 w-3.5 mr-1" />
                      Physical Count
                    </TabsTrigger>
                    <TabsTrigger value="DELTA" className="text-xs">
                      Direct Delta (±)
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* Physical Count Discrepancy Helper */}
            {inputMode === 'PHYSICAL_COUNT' ? (
              <div className="rounded border bg-blue-50/50 dark:bg-blue-950/20 p-2.5 space-y-1.5 border-blue-200 dark:border-blue-900/40">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-blue-900 dark:text-blue-300">
                    Physical Count in Storage Rack / Box:
                  </span>
                  <span className="text-muted-foreground">
                    System: {contextData?.inventory?.availableQuantity ?? 0}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <Label htmlFor="physicalCount" className="text-[11px] text-muted-foreground">
                      Actual Count Found
                    </Label>
                    <Input
                      id="physicalCount"
                      type="number"
                      step="1"
                      min="0"
                      placeholder="e.g. 15"
                      value={physicalCount}
                      onChange={(e) => setPhysicalCount(e.target.value)}
                      className="h-8 bg-background font-mono text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Calculated Delta (±)</Label>
                    <div
                      className={`h-8 rounded border flex items-center px-2.5 font-mono font-bold text-xs ${
                        parsedDelta > 0
                          ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300'
                          : parsedDelta < 0
                            ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/20 border-rose-300'
                            : 'text-muted-foreground bg-muted/40'
                      }`}
                    >
                      {parsedDelta > 0 ? `+${parsedDelta}` : parsedDelta || '0'} units
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="quantity" className="text-xs font-semibold">
                  Adjustment Delta Quantity (±) *
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  step="1"
                  placeholder="+5 to add, -3 to write off"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-9 font-mono font-bold"
                />
              </div>
            )}

            {/* Individual Item Financial Value Preview */}
            {currentItemValues && (
              <div className="flex items-center justify-between p-2 rounded bg-card border text-xs font-mono">
                <span className="text-muted-foreground font-sans">Individual Item Value:</span>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      currentItemValues.itemCostValue >= 0
                        ? 'font-bold text-emerald-600'
                        : 'font-bold text-rose-600'
                    }
                  >
                    {currentItemValues.itemCostValue >= 0 ? '+' : ''}₹
                    {currentItemValues.itemCostValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Cost)
                  </span>
                  <span className="text-muted-foreground">
                    MRP: {currentItemValues.itemMrpValue >= 0 ? '+' : ''}₹
                    {currentItemValues.itemMrpValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {/* Reason & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="reason" className="text-xs font-semibold">
                  Audit Reason *
                </Label>
                <Input
                  id="reason"
                  placeholder="e.g. Shelf audit discrepancy in Box 02"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes" className="text-xs font-semibold">
                  Chemist Notes / Vendor RMA (Optional)
                </Label>
                <Input
                  id="notes"
                  placeholder="Optional remarks or RMA ref..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Append Button (in CUMULATIVE mode) */}
            {workflowMode === 'CUMULATIVE' && (
              <div className="pt-1 flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAppendItem}
                  disabled={!productId || !isDeltaValid}
                  className="h-8 text-xs font-semibold gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  Append Medicine to Sheet
                </Button>
              </div>
            )}
          </div>

          {error && (
            <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
              {error}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                submitting ||
                !branchId ||
                (workflowMode === 'SINGLE' && (!productId || !isDeltaValid)) ||
                (workflowMode === 'CUMULATIVE' && appendedItems.length === 0)
              }
              className="bg-primary hover:bg-primary/90"
            >
              {submitting
                ? 'Processing...'
                : workflowMode === 'CUMULATIVE'
                  ? `Commit Cumulative Adjustments (${appendedItems.length} items)`
                  : 'Commit Stock Adjustment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
