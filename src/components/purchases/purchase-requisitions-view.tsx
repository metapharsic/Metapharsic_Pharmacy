'use client'

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  GitCompare,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { SourcingMatrixModal } from '@/components/suppliers/sourcing-matrix-modal'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/lib/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'

interface PurchaseRequisition {
  id: string
  prNumber: string
  branchId: string
  productId: string
  productName: string
  sku: string
  unitOfMeasure: string
  requiredQuantity: number
  estimatedUnitCost: number
  totalEstimatedCost: number
  requiredByDate: string
  reason: string
  priority: 'NORMAL' | 'URGENT' | 'EMERGENCY'
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CONVERTED'
  requestedById: string
  convertedPoId?: string | null
  notes?: string | null
  createdAt: string
}

interface ReorderSuggestion {
  productId: string
  productName: string
  sku: string
  unitOfMeasure: string
  availableQuantity: number
  minStockLevel: number
  reorderLevel: number
  averageDailySales: number
  targetDays: number
  targetStock: number
  pendingPoQuantity: number
  netDeficit: number
  suggestedOrder: number
  costPrice: number
  estimatedOrderCost: number
  urgency: 'CRITICAL' | 'URGENT' | 'NORMAL'
  preferredSupplierId?: string | null
  preferredSupplierName?: string | null
}

interface SupplierOption {
  id: string
  name: string
}

export function PurchaseRequisitionsView() {
  const toast = useToast()

  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedPrIds, setSelectedPrIds] = useState<string[]>([])

  // Sourcing Matrix Modal State
  const [sourcingModalOpen, setSourcingModalOpen] = useState(false)
  const [sourcingProductId, setSourcingProductId] = useState<string | undefined>()

  // Auto-Reorder Suggestions Drawer/Modal State
  const [suggestionModalOpen, setSuggestionModalOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [targetDays, setTargetDays] = useState('15')

  // Create Manual PR Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [productsList, setProductsList] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [manualQty, setManualQty] = useState('50')
  const [manualPriority, setManualPriority] = useState<'NORMAL' | 'URGENT' | 'EMERGENCY'>('NORMAL')
  const [manualReason, setManualReason] = useState('LOW_STOCK')
  const [manualRequiredDate, setManualRequiredDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  )
  const [manualNotes, setManualNotes] = useState('')
  const [submittingPr, setSubmittingPr] = useState(false)

  // PO Consolidation Modal State
  const [consolidateModalOpen, setConsolidateModalOpen] = useState(false)
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [consolidating, setConsolidating] = useState(false)

  // Load Requisitions
  const loadRequisitions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (priorityFilter !== 'all') params.set('priority', priorityFilter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/purchases/requisitions?${params.toString()}`)
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setRequisitions(json.data)
      }
    } catch {
      toast.error('Failed to load purchase requisitions')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, priorityFilter, search, toast])

  useEffect(() => {
    void loadRequisitions()
  }, [loadRequisitions])

  // Load Suppliers list for consolidation
  useEffect(() => {
    async function fetchSuppliers() {
      try {
        const res = await fetch('/api/suppliers?limit=50')
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setSuppliers(json.data.map((s: any) => ({ id: s.id, name: s.name })))
        }
      } catch {
        // Ignore
      }
    }
    void fetchSuppliers()
  }, [])

  // Load Product Autocomplete
  useEffect(() => {
    if (!productSearch || productSearch.length < 2) return
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(productSearch)}&limit=10`)
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setProductsList(json.data)
        }
      } catch {
        // Ignore
      }
    }, 250)
    return () => clearTimeout(t)
  }, [productSearch])

  // Load Auto-Reorder Replenishment Suggestions
  const loadAutoSuggestions = async () => {
    setSuggestionsLoading(true)
    setSuggestionModalOpen(true)
    try {
      const res = await fetch(`/api/purchases/requisitions/suggestions?targetDays=${targetDays}`)
      const json = await res.json()
      if (json.success && json.data?.suggestions) {
        setSuggestions(json.data.suggestions)
      }
    } catch {
      toast.error('Failed to calculate reorder suggestions')
    } finally {
      setSuggestionsLoading(false)
    }
  }

  // Create PR from Suggestion
  const handleCreatePrFromSuggestion = async (s: ReorderSuggestion) => {
    try {
      const res = await fetch('/api/purchases/requisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: 'main-branch',
          productId: s.productId,
          requiredQuantity: s.suggestedOrder,
          requiredByDate: new Date(Date.now() + 5 * 86400000).toISOString(),
          reason: `Auto Reorder: ADS ${s.averageDailySales.toFixed(1)}/day, Deficit ${s.netDeficit} units`,
          priority: s.urgency === 'CRITICAL' ? 'EMERGENCY' : s.urgency === 'URGENT' ? 'URGENT' : 'NORMAL',
          notes: `Target ${s.targetDays} days stock (${s.targetStock} units)`,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Purchase Requisition generated: ${json.data.prNumber}`)
        setSuggestions((prev) => prev.filter((item) => item.productId !== s.productId))
        void loadRequisitions()
      } else {
        toast.error(json.error?.message || 'Failed to create requisition')
      }
    } catch {
      toast.error('Failed to create requisition')
    }
  }

  // Generate All Requisitions from Suggestions
  const [generatingAll, setGeneratingAll] = useState(false)
  const handleGenerateAllFromSuggestions = async () => {
    if (suggestions.length === 0) return
    setGeneratingAll(true)
    let createdCount = 0
    try {
      for (const s of suggestions) {
        await fetch('/api/purchases/requisitions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branchId: 'default-branch',
            productId: s.productId,
            requiredQuantity: s.suggestedOrder,
            requiredByDate: new Date(Date.now() + 5 * 86400000).toISOString(),
            reason: `Auto Reorder: ADS ${s.averageDailySales.toFixed(1)}/day, Deficit ${s.netDeficit} units`,
            priority: s.urgency === 'CRITICAL' ? 'EMERGENCY' : s.urgency === 'URGENT' ? 'URGENT' : 'NORMAL',
            notes: `Target ${s.targetDays} days buffer (${s.targetStock} units)`,
          }),
        })
        createdCount++
      }
      toast.success(`Generated ${createdCount} Purchase Requisitions in 1 click!`)
      setSuggestions([])
      setSuggestionModalOpen(false)
      void loadRequisitions()
    } catch {
      toast.error('Failed to create some requisitions')
    } finally {
      setGeneratingAll(false)
    }
  }

  // Approve PR
  const handleApprovePr = async (prId: string) => {
    try {
      const res = await fetch(`/api/purchases/requisitions/${prId}/approve`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        toast.success('Purchase Requisition approved!')
        void loadRequisitions()
      } else {
        toast.error(json.error?.message || 'Approval failed')
      }
    } catch {
      toast.error('Failed to approve requisition')
    }
  }

  // Submit Manual PR
  const handleCreateManualPr = async () => {
    if (!selectedProduct) {
      toast.error('Please select a medicine first')
      return
    }
    const qty = parseInt(manualQty, 10)
    if (isNaN(qty) || qty <= 0) {
      toast.error('Quantity must be greater than 0')
      return
    }

    setSubmittingPr(true)
    try {
      const res = await fetch('/api/purchases/requisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: 'main-branch',
          productId: selectedProduct.id,
          requiredQuantity: qty,
          requiredByDate: new Date(manualRequiredDate).toISOString(),
          reason: manualReason,
          priority: manualPriority,
          notes: manualNotes,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Requisition ${json.data.prNumber} created`)
        setCreateModalOpen(false)
        setSelectedProduct(null)
        setProductSearch('')
        setManualNotes('')
        void loadRequisitions()
      } else {
        toast.error(json.error?.message || 'Failed to submit requisition')
      }
    } catch {
      toast.error('Failed to submit requisition')
    } finally {
      setSubmittingPr(false)
    }
  }

  // Consolidate Approved PRs to Formal PO
  const handleConsolidateToPo = async () => {
    if (selectedPrIds.length === 0) {
      toast.error('Select at least one PR to consolidate')
      return
    }
    if (!selectedSupplierId) {
      toast.error('Please choose a supplier for the purchase order')
      return
    }

    setConsolidating(true)
    try {
      const res = await fetch('/api/purchases/requisitions/consolidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prIds: selectedPrIds,
          supplierId: selectedSupplierId,
          branchId: 'main-branch',
          notes: 'Consolidated replenishment from internal requisitions',
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(
          `Official Purchase Order created: ${json.data.purchaseNumber} (${json.data.itemCount} items)`
        )
        setConsolidateModalOpen(false)
        setSelectedPrIds([])
        void loadRequisitions()
      } else {
        toast.error(json.error?.message || 'Consolidation failed')
      }
    } catch {
      toast.error('Consolidation failed')
    } finally {
      setConsolidating(false)
    }
  }

  const toggleSelectPr = (id: string) => {
    setSelectedPrIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const selectAllSelectable = () => {
    const selectable = requisitions
      .filter((r) => r.status === 'APPROVED' || r.status === 'SUBMITTED')
      .map((r) => r.id)
    if (selectedPrIds.length === selectable.length) {
      setSelectedPrIds([])
    } else {
      setSelectedPrIds(selectable)
    }
  }

  return (
    <div className="space-y-4">
      {/* Action Bar & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PR # or medicine…"
              className="pl-8"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="CONVERTED">Converted to PO</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>

          {/* Priority Filter */}
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="NORMAL">Normal</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
              <SelectItem value="EMERGENCY">Emergency</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" size="icon" onClick={() => void loadRequisitions()} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Auto Reorder AI Drawer Button */}
          <Button
            onClick={loadAutoSuggestions}
            variant="outline"
            className="gap-1.5 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
          >
            <Sparkles className="h-4 w-4" />
            Auto-Reorder Engine
          </Button>

          {/* Consolidate to PO Button */}
          {selectedPrIds.length > 0 && (
            <Button
              onClick={() => setConsolidateModalOpen(true)}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Layers className="h-4 w-4" />
              Consolidate to PO ({selectedPrIds.length})
            </Button>
          )}

          {/* New PR Button */}
          <Button onClick={() => setCreateModalOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Raise Requisition
          </Button>
        </div>
      </div>

      {/* PR Table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={
                      selectedPrIds.length > 0 &&
                      selectedPrIds.length ===
                        requisitions.filter((r) => r.status === 'APPROVED' || r.status === 'SUBMITTED').length
                    }
                    onChange={selectAllSelectable}
                    className="rounded border-border"
                  />
                </TableHead>
                <TableHead>PR Number</TableHead>
                <TableHead>Medicine / Item</TableHead>
                <TableHead className="text-right">Req Qty</TableHead>
                <TableHead className="text-right">Est. Unit Cost</TableHead>
                <TableHead className="text-right">Est. Total</TableHead>
                <TableHead>Required By</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                    Loading purchase requisitions…
                  </TableCell>
                </TableRow>
              ) : requisitions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Layers className="h-8 w-8 text-muted-foreground/40" />
                      <p>No purchase requisitions found.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadAutoSuggestions}
                        className="gap-1"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        Calculate Reorder Needs
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                requisitions.map((pr) => {
                  const isSelectable = pr.status === 'APPROVED' || pr.status === 'SUBMITTED'
                  const isSelected = selectedPrIds.includes(pr.id)

                  return (
                    <TableRow
                      key={pr.id}
                      className={isSelected ? 'bg-primary/5 hover:bg-primary/10' : undefined}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          disabled={!isSelectable}
                          checked={isSelected}
                          onChange={() => toggleSelectPr(pr.id)}
                          className="rounded border-border"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold">
                        {pr.prNumber}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{pr.productName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          SKU: {pr.sku || 'N/A'} &middot; Unit: {pr.unitOfMeasure}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {pr.requiredQuantity} {pr.unitOfMeasure}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {formatCurrency(pr.estimatedUnitCost)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(pr.totalEstimatedCost)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(pr.requiredByDate)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            pr.priority === 'EMERGENCY'
                              ? 'destructive'
                              : pr.priority === 'URGENT'
                              ? 'warning'
                              : 'secondary'
                          }
                          className="text-[10px]"
                        >
                          {pr.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            pr.status === 'CONVERTED'
                              ? 'success'
                              : pr.status === 'APPROVED'
                              ? 'info'
                              : pr.status === 'SUBMITTED'
                              ? 'outline'
                              : 'secondary'
                          }
                          className="text-[10px]"
                        >
                          {pr.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-primary gap-1 px-2 hover:bg-primary/10"
                            title="Compare Multi-Vendor Rates & Delivery for this medicine"
                            onClick={() => {
                              setSourcingProductId(pr.productId)
                              setSourcingModalOpen(true)
                            }}
                          >
                            <GitCompare className="h-3 w-3" />
                            <span className="hidden xl:inline text-[11px]">Sourcing</span>
                          </Button>

                          {pr.status === 'SUBMITTED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => void handleApprovePr(pr.id)}
                            >
                              Approve
                            </Button>
                          )}
                          {pr.status === 'APPROVED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-blue-500/30 text-blue-600 hover:bg-blue-500/10 gap-1"
                              onClick={() => {
                                setSelectedPrIds([pr.id])
                                setConsolidateModalOpen(true)
                              }}
                            >
                              <Layers className="h-3 w-3" />
                              Convert to PO
                            </Button>
                          )}
                          {pr.status === 'CONVERTED' && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              PO Generated
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ─── Modal 1: Auto-Reorder Replenishment Suggestions ─── */}
      <Dialog open={suggestionModalOpen} onOpenChange={setSuggestionModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  Auto-Reorder Replenishment Engine
                </DialogTitle>
                <DialogDescription>
                  Calculates stock replenishment using 30-day Average Daily Sales (ADS), current available stock, and open POs.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 pr-6">
                <Label className="text-xs">Buffer Days:</Label>
                <Select
                  value={targetDays}
                  onValueChange={(v) => {
                    setTargetDays(v)
                    void loadAutoSuggestions()
                  }}
                >
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 Days</SelectItem>
                    <SelectItem value="15">15 Days</SelectItem>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="45">45 Days</SelectItem>
                  </SelectContent>
                </Select>
                {suggestions.length > 0 && (
                  <Button
                    size="sm"
                    onClick={handleGenerateAllFromSuggestions}
                    disabled={generatingAll}
                    className="h-8 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white font-medium"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {generatingAll ? 'Generating…' : `Raise All PRs (${suggestions.length})`}
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2">
            {suggestionsLoading ? (
              <div className="py-16 text-center text-muted-foreground animate-pulse">
                Analyzing inventory levels, daily sales velocity, and supplier lead times…
              </div>
            ) : suggestions.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500/70" />
                <p className="mt-2 text-sm font-semibold text-foreground">
                  All inventory levels are optimal!
                </p>
                <p className="text-xs text-muted-foreground">
                  No medicines currently satisfy replenishment reorder triggers for {targetDays} days buffer.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Medicine</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">ADS / Day</TableHead>
                    <TableHead className="text-right">Target Stock</TableHead>
                    <TableHead className="text-right">Open PO</TableHead>
                    <TableHead className="text-right">Net Deficit</TableHead>
                    <TableHead className="text-right font-bold">Suggested Order</TableHead>
                    <TableHead>Urgency</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions.map((s) => (
                    <TableRow key={s.productId}>
                      <TableCell>
                        <div className="font-semibold text-foreground">{s.productName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Min: {s.minStockLevel} &middot; Reorder Level: {s.reorderLevel}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        <span className={s.availableQuantity === 0 ? 'text-rose-600 font-bold' : ''}>
                          {s.availableQuantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {s.averageDailySales.toFixed(1)} /d
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {s.targetStock}
                      </TableCell>
                      <TableCell className="text-right text-xs text-blue-600 dark:text-blue-400">
                        {s.pendingPoQuantity}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                        {s.netDeficit}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-bold text-foreground">
                        {s.suggestedOrder} {s.unitOfMeasure}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            s.urgency === 'CRITICAL'
                              ? 'destructive'
                              : s.urgency === 'URGENT'
                              ? 'warning'
                              : 'secondary'
                          }
                          className="text-[10px]"
                        >
                          {s.urgency}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => {
                              setSourcingProductId(s.productId)
                              setSourcingModalOpen(true)
                            }}
                          >
                            <GitCompare className="h-3 w-3" />
                            Sourcing
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => void handleCreatePrFromSuggestion(s)}
                          >
                            Raise PR <ArrowRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Modal 2: Raise Manual Purchase Requisition ─── */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Raise Purchase Requisition (PR)</DialogTitle>
            <DialogDescription>
              Create an internal stock requirement before supplier order placement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            {/* Search Medicine */}
            <div className="space-y-1.5">
              <Label className="text-xs">Search Medicine / Product *</Label>
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Type 2+ letters to search…"
              />
              {productsList.length > 0 && !selectedProduct && (
                <div className="max-h-36 overflow-y-auto rounded-md border border-border/80 bg-popover shadow-md divide-y divide-border/40">
                  {productsList.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedProduct(p)
                        setProductsList([])
                        setProductSearch(p.name)
                      }}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-muted/50"
                    >
                      <div className="font-semibold text-foreground">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        SKU: {p.sku} &middot; MRP: {formatCurrency(p.mrp)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedProduct && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-300">
                  Selected: <span className="font-semibold">{selectedProduct.name}</span> ({selectedProduct.unitOfMeasure})
                </div>
              )}
            </div>

            {/* Quantity & Urgency */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Required Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  value={manualQty}
                  onChange={(e) => setManualQty(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <Select
                  value={manualPriority}
                  onValueChange={(v: any) => setManualPriority(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                    <SelectItem value="EMERGENCY">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Required By Date & Reason */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Required By Date *</Label>
                <Input
                  type="date"
                  value={manualRequiredDate}
                  onChange={(e) => setManualRequiredDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Requisition Reason</Label>
                <Select value={manualReason} onValueChange={setManualReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW_STOCK">Low Stock</SelectItem>
                    <SelectItem value="STOCKOUT">Stockout / Emergency</SelectItem>
                    <SelectItem value="SPECIAL_ORDER">Patient Special Order</SelectItem>
                    <SelectItem value="NEW_PRODUCT">New Product Introduction</SelectItem>
                    <SelectItem value="SEASONAL_BUFFER">Seasonal Buffer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs">Notes / Justification</Label>
              <Input
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder="Doctor prescription requirement, bulk festival buffer, etc."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreateManualPr()}
              disabled={submittingPr || !selectedProduct}
            >
              {submittingPr ? 'Submitting…' : 'Submit Requisition'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal 3: Consolidate Selected PRs to PO ─── */}
      <Dialog open={consolidateModalOpen} onOpenChange={setConsolidateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-500" />
              Consolidate PRs into Purchase Order
            </DialogTitle>
            <DialogDescription>
              Combine {selectedPrIds.length} approved requisitions into a single authorized PO to leverage supplier discounts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Select Supplier Distributor *</Label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Supplier…" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs space-y-1">
              <div className="flex justify-between font-medium">
                <span>Selected Items:</span>
                <span>{selectedPrIds.length}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Consolidating items into one order prevents multiple invoices and delivers optimal freight efficiency.
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConsolidateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleConsolidateToPo()}
              disabled={consolidating || !selectedSupplierId}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {consolidating ? 'Generating PO…' : 'Generate Purchase Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sourcing Recommendation Matrix Modal */}
      <SourcingMatrixModal
        open={sourcingModalOpen}
        onOpenChange={setSourcingModalOpen}
        initialProductId={sourcingProductId}
      />
    </div>
  )
}
