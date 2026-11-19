'use client'

import {
  Award,
  CheckCircle2,
  Clock,
  DollarSign,
  FileCheck,
  GitCompare,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

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

interface SupplierQuotation {
  id: string
  rfqNumber: string
  supplierId: string
  supplierName: string
  productId: string
  productName: string
  paidQuantity: number
  freeQuantity: number
  basicRate: number
  discountPercent: number
  taxPercent: number
  freightCharges: number
  totalNetPayable: number
  effectiveLandedCost: number
  remainingShelfLifeMonths: number
  leadTimeDays: number
  creditDays: number
  paymentTerms: string
  returnPolicy: string
  commercialRiskScore: number
  riskRating: 'LOW' | 'MODERATE' | 'HIGH'
  isRecommended: boolean
  status: string
  createdAt: string
}

export function SupplierQuotationsMatrix() {
  const toast = useToast()

  const [quotations, setQuotations] = useState<SupplierQuotation[]>([])
  const [loading, setLoading] = useState(false)
  const [searchRfq, setSearchRfq] = useState('')

  // Create Quotation Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [rfqNumber, setRfqNumber] = useState(`RFQ-${Date.now().toString().slice(-6)}`)
  const [paidQty, setPaidQty] = useState('100')
  const [freeQty, setFreeQty] = useState('10')
  const [basicRate, setBasicRate] = useState('80')
  const [discountPercent, setDiscountPercent] = useState('5')
  const [taxPercent, setTaxPercent] = useState('12')
  const [freightCharges, setFreightCharges] = useState('0')
  const [shelfLifeMonths, setShelfLifeMonths] = useState('24')
  const [leadTimeDays, setLeadTimeDays] = useState('2')
  const [creditDays, setCreditDays] = useState('30')
  const [paymentTerms, setPaymentTerms] = useState('30 Days Net')
  const [returnPolicy, setReturnPolicy] = useState('100% expiry return accepted')
  const [submitting, setSubmitting] = useState(false)

  // Load Quotes
  const loadQuotes = useCallback(async () => {
    setLoading(true)
    try {
      const url = searchRfq
        ? `/api/purchases/quotations?rfqNumber=${encodeURIComponent(searchRfq)}`
        : '/api/purchases/quotations'
      const res = await fetch(url)
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setQuotations(json.data)
      }
    } catch {
      toast.error('Failed to load supplier quotations')
    } finally {
      setLoading(false)
    }
  }, [searchRfq, toast])

  useEffect(() => {
    void loadQuotes()
  }, [loadQuotes])

  // Load master data for modal
  useEffect(() => {
    async function loadMasters() {
      try {
        const [supRes, prodRes] = await Promise.all([
          fetch('/api/suppliers?limit=50'),
          fetch('/api/products?limit=50'),
        ])
        const [supJson, prodJson] = await Promise.all([supRes.json(), prodRes.json()])
        if (supJson.success) setSuppliers(supJson.data)
        if (prodJson.success) setProducts(prodJson.data)
      } catch {
        // Ignore
      }
    }
    void loadMasters()
  }, [])

  // Handle Create Quote
  const handleCreateQuotation = async () => {
    if (!selectedSupplierId || !selectedProductId) {
      toast.error('Please select both a supplier and medicine')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/purchases/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfqNumber,
          supplierId: selectedSupplierId,
          productId: selectedProductId,
          paidQuantity: parseInt(paidQty, 10),
          freeQuantity: parseInt(freeQty, 10) || 0,
          basicRate: parseFloat(basicRate),
          discountPercent: parseFloat(discountPercent) || 0,
          taxPercent: parseFloat(taxPercent) || 12,
          freightCharges: parseFloat(freightCharges) || 0,
          remainingShelfLifeMonths: parseInt(shelfLifeMonths, 10) || 24,
          leadTimeDays: parseInt(leadTimeDays, 10) || 2,
          creditDays: parseInt(creditDays, 10) || 30,
          paymentTerms,
          returnPolicy,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success('Supplier quotation recorded and evaluated')
        setCreateModalOpen(false)
        void loadQuotes()
      } else {
        toast.error(json.error?.message || 'Failed to record quote')
      }
    } catch {
      toast.error('Failed to record quote')
    } finally {
      setSubmitting(false)
    }
  }

  const [awardingQuoteId, setAwardingQuoteId] = useState<string | null>(null)

  const handleAwardQuote = async (q: SupplierQuotation) => {
    setAwardingQuoteId(q.id)
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: 'default-branch',
          supplierId: q.supplierId,
          expectedDate: new Date(Date.now() + q.leadTimeDays * 86400000).toISOString(),
          notes: `Awarded from RFQ Quote ${q.rfqNumber}: Landed Cost ${formatCurrency(q.effectiveLandedCost)}/unit (${q.paidQuantity} paid + ${q.freeQuantity} free scheme, terms: ${q.paymentTerms})`,
          items: [
            {
              productId: q.productId,
              orderedQuantity: q.paidQuantity,
              unitCost: q.basicRate,
              discountPercent: q.discountPercent,
              taxPercent: q.taxPercent,
            },
          ],
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(
          `Contract Awarded! Purchase Order ${json.data.purchaseNumber} generated for ${q.supplierName}.`
        )
      } else {
        toast.error(json.error?.message || 'Failed to award quotation into PO')
      }
    } catch {
      toast.error('Failed to award quotation into PO')
    } finally {
      setAwardingQuoteId(null)
    }
  }

  // Find lowest landed cost to mark best deal
  const lowestCost = quotations.length > 0 ? Math.min(...quotations.map((q) => q.effectiveLandedCost)) : 0

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchRfq}
              onChange={(e) => setSearchRfq(e.target.value)}
              placeholder="Search RFQ Number…"
              className="pl-8"
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => void loadQuotes()} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <Button onClick={() => setCreateModalOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Log Supplier Quote
        </Button>
      </div>

      {/* Quotation Comparison Matrix Card */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <GitCompare className="h-4 w-4 text-primary" />
                Multi-Supplier Quotation Matrix & Landed Cost Engine
              </CardTitle>
              <CardDescription>
                Evaluates effective cost per unit accounting for basic rate, trade discount, GST, freight, and free scheme units (e.g. 10+1 free), cross-checked against shelf-life risk and credit terms.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>RFQ / Quote</TableHead>
                <TableHead>Supplier & Medicine</TableHead>
                <TableHead className="text-right">Scheme / Qty</TableHead>
                <TableHead className="text-right">Basic Rate</TableHead>
                <TableHead className="text-right">Disc % & GST</TableHead>
                <TableHead className="text-right">Net Payable</TableHead>
                <TableHead className="text-right font-bold text-foreground">
                  Effective Landed / Unit
                </TableHead>
                <TableHead>Shelf Life & Lead</TableHead>
                <TableHead>Credit Terms</TableHead>
                <TableHead className="text-center">Commercial Risk</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                    Analyzing supplier quotations…
                  </TableCell>
                </TableRow>
              ) : quotations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <GitCompare className="h-8 w-8 text-muted-foreground/40" />
                      <p>No supplier quotations recorded yet.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCreateModalOpen(true)}
                        className="gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Log First Quotation
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                quotations.map((q) => {
                  const isBestDeal = q.effectiveLandedCost === lowestCost && quotations.length > 1
                  const totalUnits = q.paidQuantity + q.freeQuantity

                  return (
                    <TableRow
                      key={q.id}
                      className={isBestDeal ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : undefined}
                    >
                      <TableCell className="font-mono text-xs font-semibold">
                        <div className="flex items-center gap-1.5">
                          {q.rfqNumber}
                          {isBestDeal && (
                            <Badge className="bg-emerald-600 text-[9px] px-1 py-0 text-white">
                              Best Landed Rate
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-foreground">{q.supplierName}</div>
                        <div className="text-[11px] text-muted-foreground">{q.productName}</div>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <span className="font-semibold">{q.paidQuantity}</span> paid
                        {q.freeQuantity > 0 && (
                          <span className="ml-1 text-emerald-600 dark:text-emerald-400 font-bold">
                            +{q.freeQuantity} Free
                          </span>
                        )}
                        <div className="text-[10px] text-muted-foreground">
                          Total: {totalUnits} units
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {formatCurrency(q.basicRate)}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <div>{q.discountPercent}% off</div>
                        <div className="text-[10px] text-muted-foreground">+{q.taxPercent}% GST</div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {formatCurrency(q.totalNetPayable)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-mono text-sm font-bold text-foreground">
                          {formatCurrency(q.effectiveLandedCost)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">per unit landed</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{q.remainingShelfLifeMonths}m expiry</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Lead: {q.leadTimeDays} days
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{q.creditDays} Days Credit</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                          {q.paymentTerms}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            q.riskRating === 'LOW'
                              ? 'success'
                              : q.riskRating === 'MODERATE'
                              ? 'warning'
                              : 'destructive'
                          }
                          className="text-[10px]"
                        >
                          {q.riskRating} ({q.commercialRiskScore}/100)
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          disabled={awardingQuoteId === q.id}
                          onClick={() => void handleAwardQuote(q)}
                          className={`h-7 text-xs gap-1 font-semibold ${
                            isBestDeal
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-primary'
                          }`}
                        >
                          {awardingQuoteId === q.id ? (
                            'Awarding…'
                          ) : (
                            <>
                              <Award className="h-3 w-3" />
                              Award & Order
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Log Quotation Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Supplier Quotation (RFQ)</DialogTitle>
            <DialogDescription>
              Record supplier rates, free quantity schemes, expiry conditions, and credit terms for algorithmic landed cost comparison.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {/* RFQ Reference & Supplier */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">RFQ Reference Number *</Label>
                <Input value={rfqNumber} onChange={(e) => setRfqNumber(e.target.value)} />
              </div>
              <div className="space-y-1">
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
            </div>

            {/* Medicine / Product */}
            <div className="space-y-1">
              <Label className="text-xs">Medicine / Product *</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Medicine…" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.unitOfMeasure})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Paid Qty & Free Scheme Quantity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Paid Order Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  value={paidQty}
                  onChange={(e) => setPaidQty(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Free Scheme Quantity (e.g. 10+2 free)</Label>
                <Input
                  type="number"
                  min="0"
                  value={freeQty}
                  onChange={(e) => setFreeQty(e.target.value)}
                />
              </div>
            </div>

            {/* Basic Rate, Discount & GST */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Basic Unit Rate (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={basicRate}
                  onChange={(e) => setBasicRate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Trade Discount %</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">GST Rate %</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(e.target.value)}
                />
              </div>
            </div>

            {/* Shelf-Life, Lead Time & Credit Terms */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Min Shelf Life (Months)</Label>
                <Input
                  type="number"
                  min="1"
                  value={shelfLifeMonths}
                  onChange={(e) => setShelfLifeMonths(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Delivery Lead Time (Days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Credit Period (Days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={creditDays}
                  onChange={(e) => setCreditDays(e.target.value)}
                />
              </div>
            </div>

            {/* Payment & Return Policy */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Payment Terms</Label>
                <Input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="30 Days Net, Immediate RTGS, etc."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Return & Expiry Replacement Policy</Label>
                <Input
                  value={returnPolicy}
                  onChange={(e) => setReturnPolicy(e.target.value)}
                  placeholder="Full credit or 1-to-1 replacement"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateQuotation()} disabled={submitting}>
              {submitting ? 'Evaluating…' : 'Record & Compare Quote'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
