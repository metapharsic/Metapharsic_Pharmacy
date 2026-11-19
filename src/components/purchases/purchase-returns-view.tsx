'use client'

// ─────────────────────────────────────────────────────────────
// Component — PurchaseReturnsView
// Complete overview dashboard for vendor purchase returns & debit notes.
// ─────────────────────────────────────────────────────────────
import {
  AlertTriangle,
  Clock,
  FileText,
  Plus,
  Receipt,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import {
  PurchaseReturnsTable,
  type PurchaseReturnRow,
} from '@/components/purchases/purchase-returns-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ROUTES } from '@/lib/constants/routes'
import { useToast } from '@/lib/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/currency'

interface PurchaseReturnsViewProps {
  returns: PurchaseReturnRow[]
  stats: {
    totalReturns: number
    totalDebitAmount: number
    pendingReturnsCount: number
  }
  canCreate: boolean
  onRefresh?: () => void
}

export function PurchaseReturnsView({
  returns,
  stats,
  canCreate,
  onRefresh,
}: PurchaseReturnsViewProps) {
  const toast = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [purchases, setPurchases] = useState<any[]>([])
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('')
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null)
  const [returnReason, setReturnReason] = useState('DAMAGED_AT_DOCK')
  const [customReasonNotes, setCustomReasonNotes] = useState('')
  const [returnQty, setReturnQty] = useState('10')
  const [submitting, setSubmitting] = useState(false)

  // Load received purchases for selection
  useEffect(() => {
    if (!modalOpen) return
    async function loadPurchases() {
      try {
        const res = await fetch('/api/purchases?limit=50')
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setPurchases(json.data)
        }
      } catch {
        // Ignore
      }
    }
    void loadPurchases()
  }, [modalOpen])

  // Fetch purchase detail when selected
  useEffect(() => {
    if (!selectedPurchaseId) {
      setSelectedPurchase(null)
      return
    }
    async function loadDetail() {
      try {
        const res = await fetch(`/api/purchases/${selectedPurchaseId}`)
        const json = await res.json()
        if (json.success && json.data) {
          setSelectedPurchase(json.data)
        }
      } catch {
        // Ignore
      }
    }
    void loadDetail()
  }, [selectedPurchaseId])

  const handleCreateReturn = async () => {
    if (!selectedPurchase) {
      toast.error('Please select an original Purchase Order')
      return
    }
    if (!selectedPurchase.items || selectedPurchase.items.length === 0) {
      toast.error('Selected purchase order has no line items to return')
      return
    }

    const firstItem = selectedPurchase.items[0]
    const qty = parseInt(returnQty, 10) || 1

    setSubmitting(true)
    try {
      const res = await fetch('/api/purchase-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId: selectedPurchase.id,
          supplierId: selectedPurchase.supplier?.id || selectedPurchase.supplierId,
          returnNumber: `RTV-${Date.now().toString().slice(-6)}`,
          returnDate: new Date().toISOString(),
          reason: `${returnReason}: ${customReasonNotes || 'Quality / condition issue at dock'}`,
          notes: `Chemist initiated return note. Debit Note requested from supplier ledger.`,
          items: [
            {
              purchaseItemId: firstItem.id,
              quantity: Math.min(qty, firstItem.quantity || qty),
              unitCost: Number(firstItem.unitCost) || 50,
              reason: returnReason,
            },
          ],
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success(
          `Purchase Return ${json.data.returnNumber || 'RTV'} and Debit Note generated successfully!`
        )
        setModalOpen(false)
        setSelectedPurchaseId('')
        onRefresh?.()
      } else {
        toast.error(json.error?.message || 'Failed to create return')
      }
    } catch {
      toast.error('Failed to create purchase return')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Purchase Returns & Debit Notes (RTV)</h1>
            <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10">
              Stock Reversal & Ledgers
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs mt-0.5">
            Manage damaged goods, dockside rejections, supplier returns, and debit memos against Accounts Payable.
          </p>
        </div>
        {canCreate && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setModalOpen(true)}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
            >
              <RotateCcw className="h-4 w-4" />
              Quick Purchase Return & Debit Note
            </Button>
            <Button asChild variant="outline">
              <Link href={ROUTES.PURCHASE_RETURNS_NEW} className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Advanced Form
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60 bg-card/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Returns Logged</CardTitle>
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{stats.totalReturns}</div>
            <p className="text-xs text-muted-foreground">Returns to vendors logged</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Debit Memo Amount</CardTitle>
            <Receipt className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-emerald-600">
              {formatCurrency(stats.totalDebitAmount)}
            </div>
            <p className="text-xs text-muted-foreground">Total debited to supplier ledgers</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Dispatch</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {stats.pendingReturnsCount}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting vendor pickup/credit note</p>
          </CardContent>
        </Card>
      </div>

      <PurchaseReturnsTable data={returns} />

      {/* ─── Quick Return Modal ─── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <RotateCcw className="h-5 w-5 text-amber-600" />
              Issue Purchase Return & Debit Note
            </DialogTitle>
            <DialogDescription className="text-xs">
              Reverses inventory quantities and issues an automated debit note against the supplier&apos;s payable ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Original Purchase Order (PO)</Label>
              <Select value={selectedPurchaseId} onValueChange={setSelectedPurchaseId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select Purchase Order…" />
                </SelectTrigger>
                <SelectContent>
                  {purchases.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.purchaseNumber} — {po.supplier?.name || 'Distributor'} ({formatCurrency(Number(po.totalAmount) || 0)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPurchase && (
              <div className="rounded-md bg-muted/40 p-2.5 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supplier:</span>
                  <span className="font-semibold">{selectedPurchase.supplier?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PO Items Available:</span>
                  <span className="font-semibold">{selectedPurchase.items?.length || 0} line items</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Return Reason Category</Label>
              <Select value={returnReason} onValueChange={setReturnReason}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAMAGED_AT_DOCK">Damaged during transit / dock delivery</SelectItem>
                  <SelectItem value="QC_REJECTED">Quality inspection / packaging seal failed</SelectItem>
                  <SelectItem value="NEAR_EXPIRY_REVERSAL">Near expiry (&lt; 6 months shelf life)</SelectItem>
                  <SelectItem value="EXCESS_DELIVERY">Excess delivery beyond PO contracted qty</SelectItem>
                  <SelectItem value="SUPPLIER_RECALL">Manufacturer / regulatory drug recall</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Quantity to Return</Label>
                <Input
                  type="number"
                  min="1"
                  value={returnQty}
                  onChange={(e) => setReturnQty(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Debit Note Action</Label>
                <div className="h-8 flex items-center px-2.5 rounded-md border border-border/60 bg-muted/20 text-[11px] font-semibold text-emerald-600">
                  Auto-offset against AP
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Reason Notes / Chemist Remarks</Label>
              <Input
                value={customReasonNotes}
                onChange={(e) => setCustomReasonNotes(e.target.value)}
                placeholder="e.g. Broken ampoules found in outer carton during QC check"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateReturn}
              disabled={submitting || !selectedPurchaseId}
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {submitting ? 'Issuing Return…' : 'Issue Debit Note & Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
