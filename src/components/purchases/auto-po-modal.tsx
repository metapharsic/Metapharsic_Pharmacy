'use client'

import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileText,
  Building2,
  Boxes,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'

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
import type { AutoPoSummary, LowStockCandidate } from '@/lib/purchases/auto-po-service'
import { formatCurrency } from '@/lib/utils/currency'

interface SupplierOption {
  id: string
  name: string
}

interface EditableCandidate extends LowStockCandidate {
  selected: boolean
  orderQuantity: number
  supplierId: string
  unitCost: number
}

interface AutoPoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId?: string
  onSuccess?: () => void
}

export function AutoPoModal({ open, onOpenChange, branchId, onSuccess }: AutoPoModalProps) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [candidates, setCandidates] = useState<EditableCandidate[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [createdOrders, setCreatedOrders] = useState<AutoPoSummary[] | null>(null)

  // Fetch low-stock preview and suppliers
  const loadCandidates = async () => {
    setLoading(true)
    setCreatedOrders(null)
    try {
      const branchParam = branchId && branchId !== 'all' ? `?branchId=${branchId}` : ''
      const [resCandidates, resSuppliers] = await Promise.all([
        fetch(`/api/purchases/auto-generate${branchParam}`),
        fetch('/api/suppliers'),
      ])

      const dataCandidates = await resCandidates.json()
      const dataSuppliers = await resSuppliers.json()

      if (dataSuppliers.success && Array.isArray(dataSuppliers.data)) {
        setSuppliers(dataSuppliers.data as SupplierOption[])
      }

      if (dataCandidates.success && dataCandidates.data?.candidates) {
        const rawCandidates = dataCandidates.data.candidates as LowStockCandidate[]
        const editable: EditableCandidate[] = rawCandidates.map((c) => ({
          ...c,
          selected: !c.hasPendingPo, // Auto-select if no duplicate open PO
          orderQuantity: c.suggestedQuantity,
          supplierId: c.suggestedSupplierId ?? (dataSuppliers.data?.[0]?.id || ''),
          unitCost: c.estimatedUnitCost,
        }))
        setCandidates(editable)
      } else {
        toast.error('Failed to load low-stock items')
      }
    } catch {
      toast.error('Error fetching low-stock inventory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      void loadCandidates()
    }
  }, [open, branchId])

  // Summary metrics for selected items
  const stats = useMemo(() => {
    const selected = candidates.filter((c) => c.selected && !c.hasPendingPo)
    const totalUnits = selected.reduce((sum, c) => sum + c.orderQuantity, 0)
    const uniqueSuppliers = new Set(selected.map((c) => c.supplierId).filter(Boolean)).size
    const estTotalCost = selected.reduce(
      (sum, c) => sum + c.orderQuantity * c.unitCost * (1 + c.taxPercent / 100),
      0
    )

    return {
      selectedCount: selected.length,
      totalUnits,
      uniqueSuppliers,
      estTotalCost,
      pendingCount: candidates.filter((c) => c.hasPendingPo).length,
    }
  }, [candidates])

  const toggleSelectAll = (checked: boolean) => {
    setCandidates((prev) =>
      prev.map((c) => ({
        ...c,
        selected: c.hasPendingPo ? false : checked,
      }))
    )
  }

  const updateItem = (productId: string, updates: Partial<EditableCandidate>) => {
    setCandidates((prev) =>
      prev.map((c) => (c.productId === productId ? { ...c, ...updates } : c))
    )
  }

  const handleGenerate = async () => {
    const selected = candidates.filter((c) => c.selected && !c.hasPendingPo)
    if (selected.length === 0) {
      toast.error('Please select at least one low-stock product to reorder.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        branchId: branchId && branchId !== 'all' ? branchId : undefined,
        items: selected.map((c) => ({
          productId: c.productId,
          branchId: c.branchId,
          supplierId: c.supplierId,
          orderedQuantity: c.orderQuantity,
          unitCost: c.unitCost,
        })),
      }

      const res = await fetch('/api/purchases/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (json.success) {
        toast.success(json.message || 'Draft Purchase Orders generated successfully!')
        setCreatedOrders(json.data as AutoPoSummary[])
        if (onSuccess) onSuccess()
      } else {
        toast.error(json.error?.message || 'Failed to generate purchase orders.')
      }
    } catch {
      toast.error('An error occurred while generating purchase orders.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                Automated Purchase Order Generation
              </DialogTitle>
              <DialogDescription>
                Detects inventory at or below reorder levels, groups items by supplier, and drafts consolidated POs.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Success View */}
        {createdOrders ? (
          <div className="space-y-5 py-4 flex-1 overflow-y-auto">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-900 dark:text-emerald-100 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-base">
                  Successfully Generated {createdOrders.length} Draft Purchase Order(s)
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The orders have been drafted and are ready for manager review and dispatch to suppliers.
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {createdOrders.map((po) => (
                <div
                  key={po.purchaseId}
                  className="rounded-lg border p-4 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-primary/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-primary">{po.purchaseNumber}</span>
                      <Badge variant="outline">{po.status}</Badge>
                      <span className="text-xs text-muted-foreground">· {po.branchName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{po.supplierName}</span>
                      <span className="text-muted-foreground">({po.itemCount} items · {po.totalQuantity} units)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Total (incl. GST)</div>
                      <div className="text-base font-bold">{formatCurrency(po.totalAmount)}</div>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/purchases/${po.purchaseId}`} target="_blank">
                        View PO <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Candidate Selection View */
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-lg border">
              <div>
                <div className="text-xs text-muted-foreground">Low-Stock Items</div>
                <div className="text-lg font-bold flex items-center gap-1.5">
                  <Boxes className="h-4 w-4 text-amber-500" />
                  {candidates.length}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">To Reorder</div>
                <div className="text-lg font-bold text-primary">
                  {stats.selectedCount} <span className="text-xs font-normal text-muted-foreground">({stats.totalUnits} units)</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Consolidated POs</div>
                <div className="text-lg font-bold">
                  {stats.uniqueSuppliers} <span className="text-xs font-normal text-muted-foreground">suppliers</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Estimated Total</div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(stats.estTotalCost)}
                </div>
              </div>
            </div>

            {/* Candidate Table */}
            <div className="flex-1 overflow-y-auto border rounded-lg">
              {loading ? (
                <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Scanning inventory levels across branches…</span>
                </div>
              ) : candidates.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-center p-6 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                  <p className="font-medium text-foreground">All products are healthy</p>
                  <p className="text-xs mt-1">No items are currently at or below their reorder level.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={candidates.length > 0 && candidates.filter(c => !c.hasPendingPo).every((c) => c.selected)}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                        />
                      </TableHead>
                      <TableHead>Product / SKU</TableHead>
                      <TableHead className="text-right">Stock / Reorder</TableHead>
                      <TableHead className="w-24 text-right">Order Qty</TableHead>
                      <TableHead className="w-48">Supplier</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Est. Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((c) => {
                      const itemTotal = c.orderQuantity * c.unitCost * (1 + c.taxPercent / 100)
                      return (
                        <TableRow
                          key={`${c.branchId}:${c.productId}`}
                          className={c.hasPendingPo ? 'opacity-60 bg-muted/20' : undefined}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              className="rounded border-gray-300"
                              disabled={c.hasPendingPo}
                              checked={c.selected}
                              onChange={(e) => updateItem(c.productId, { selected: e.target.checked })}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{c.productName}</div>
                            <div className="text-xs text-muted-foreground">
                              {c.sku} {c.unitOfMeasure ? `· ${c.unitOfMeasure}` : ''}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            <span className="text-destructive font-semibold">{c.availableQuantity}</span>
                            <span className="text-muted-foreground"> / {c.reorderLevel}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={1}
                              disabled={c.hasPendingPo}
                              className="h-8 w-20 text-right font-mono text-sm"
                              value={c.orderQuantity}
                              onChange={(e) =>
                                updateItem(c.productId, { orderQuantity: Math.max(1, parseInt(e.target.value) || 1) })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={c.supplierId}
                              disabled={c.hasPendingPo}
                              onValueChange={(val) => updateItem(c.productId, { supplierId: val })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select supplier" />
                              </SelectTrigger>
                              <SelectContent>
                                {suppliers.map((s) => (
                                  <SelectItem key={s.id} value={s.id} className="text-xs">
                                    {s.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(c.unitCost)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-sm">
                            {formatCurrency(itemTotal)}
                          </TableCell>
                          <TableCell>
                            {c.hasPendingPo ? (
                              <Badge variant="secondary" className="text-[10px] whitespace-nowrap bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20">
                                In {c.pendingPoNumber}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                                Ready
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadCandidates()}
            disabled={loading || submitting}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Stock
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {createdOrders ? 'Done' : 'Cancel'}
            </Button>
            {!createdOrders && (
              <Button
                onClick={handleGenerate}
                disabled={submitting || stats.selectedCount === 0}
                className="gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating POs…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Draft POs ({stats.uniqueSuppliers} Supplier{stats.uniqueSuppliers === 1 ? '' : 's'})
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
