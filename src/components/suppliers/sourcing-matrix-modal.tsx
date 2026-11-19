'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  ExternalLink,
  GitCompare,
  Package,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Truck,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/currency'

interface SourcingSupplier {
  supplierId: string
  supplierName: string
  supplierCode: string
  supplierType: string
  complianceStatus: 'VERIFIED' | 'PENDING' | 'EXPIRED' | 'BLOCKED'
  isPoAllowed: boolean
  poBlockReason?: string
  ratePerStrip: number
  discountPercent: number
  freeGoodsBonus: string
  effectivePurchaseCost: number
  deliveryTime: string
  deliveryDaysScore: number
  deliveryReliability: number
  creditTerms: string
  moq: number
  isRecommended: boolean
  recommendationReason: string
  matchScore: number
}

interface SourcingData {
  productId: string
  productName: string
  sku: string
  strength: string
  suppliers: SourcingSupplier[]
}

interface SourcingMatrixModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialProductId?: string
}

export function SourcingMatrixModal({
  open,
  onOpenChange,
  initialProductId,
}: SourcingMatrixModalProps) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SourcingData | null>(null)
  const [availableProducts, setAvailableProducts] = useState<
    Array<{ id: string; name: string; sku: string }>
  >([])
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductId || '')

  // Load available products for selector
  useEffect(() => {
    if (!open) return
    async function loadProducts() {
      try {
        const res = await fetch('/api/products?limit=15')
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setAvailableProducts(
            json.data.map((p: any) => ({ id: p.id, name: p.name, sku: p.sku }))
          )
          if (!selectedProductId && json.data.length > 0) {
            setSelectedProductId(json.data[0].id)
          }
        }
      } catch {
        // fallback
      }
    }
    void loadProducts()
  }, [open, selectedProductId])

  // Load sourcing matrix when product changes
  useEffect(() => {
    if (!open) return
    async function fetchMatrix() {
      setLoading(true)
      try {
        const url = selectedProductId
          ? `/api/suppliers/sourcing-matrix?productId=${selectedProductId}`
          : '/api/suppliers/sourcing-matrix'
        const res = await fetch(url)
        const json = await res.json()
        if (json.success && json.data) {
          setData(json.data)
        }
      } catch {
        toast.error('Failed to load supplier sourcing matrix')
      } finally {
        setLoading(false)
      }
    }
    void fetchMatrix()
  }, [open, selectedProductId, toast])

  const recommendedSupplier = data?.suppliers.find((s) => s.isRecommended)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <GitCompare className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  Multi-Vendor Sourcing & Rate Comparison Engine
                  <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px]">
                    Decision Intelligence
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Compares landed costs, free-goods bonus schemes, delivery speeds, and enforces Drug License statutory compliance before PO issuance.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Medicine Selector Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-3 rounded-lg border">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Select Formulary Medicine:</span>
          </div>

          <div className="w-full sm:w-80">
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Choose product to source…" />
              </SelectTrigger>
              <SelectContent>
                {availableProducts.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name} ({p.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* System Recommendation Banner */}
        {recommendedSupplier && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <div className="h-9 w-9 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    Recommended Primary Supplier: {recommendedSupplier.supplierName}
                  </span>
                  <Badge className="bg-emerald-600 text-white text-[10px] py-0">
                    Sourcing Score: {recommendedSupplier.matchScore}/100
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {recommendedSupplier.recommendationReason}
                </p>
                <div className="flex items-center gap-3 text-[11px] font-mono mt-1 text-foreground font-medium">
                  <span>Effective Landed Cost: <strong className="text-emerald-600">{formatCurrency(recommendedSupplier.effectivePurchaseCost)}</strong>/strip</span>
                  <span>•</span>
                  <span>Delivery: <strong>{recommendedSupplier.deliveryTime}</strong></span>
                  <span>•</span>
                  <span>Reliability: <strong>{recommendedSupplier.deliveryReliability}%</strong></span>
                </div>
              </div>
            </div>

            <Button asChild size="sm" className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shrink-0 shadow-sm">
              <Link href={`/purchases/new?supplierId=${recommendedSupplier.supplierId}&productId=${data?.productId}`}>
                <Sparkles className="h-3.5 w-3.5" />
                Generate PO to Winner
              </Link>
            </Button>
          </div>
        )}

        {/* Multi-Vendor Comparison Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>All Authorized Suppliers for {data?.productName || 'Medicine'}</span>
            <span className="text-[11px] font-normal">Pricing sorted by Effective Purchase Cost</span>
          </div>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 text-muted-foreground font-semibold border-b text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3 text-left">Supplier & Code</th>
                  <th className="py-2.5 px-2 text-left">Type</th>
                  <th className="py-2.5 px-2 text-right">Negotiated Rate</th>
                  <th className="py-2.5 px-2 text-left">Scheme / Bonus</th>
                  <th className="py-2.5 px-2 text-right font-bold text-foreground">Effective Cost</th>
                  <th className="py-2.5 px-2 text-left">Delivery Speed</th>
                  <th className="py-2.5 px-2 text-center">Reliability</th>
                  <th className="py-2.5 px-2 text-left">Compliance & PO Gate</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y text-[11px]">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      Evaluating supplier price contracts, delivery speeds, and compliance credentials…
                    </td>
                  </tr>
                ) : !data || data.suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      No supplier mapping data found for this medicine.
                    </td>
                  </tr>
                ) : (
                  data.suppliers.map((s) => (
                    <tr
                      key={s.supplierId}
                      className={`hover:bg-muted/30 transition-colors ${
                        s.isRecommended ? 'bg-emerald-500/5' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          {s.supplierName}
                          {s.isRecommended && (
                            <Badge className="bg-emerald-600 text-white text-[9px] py-0 px-1 font-semibold">
                              Best Choice
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground block">
                          {s.supplierCode}
                        </span>
                      </td>

                      <td className="py-2.5 px-2">
                        <Badge variant="outline" className="text-[10px] py-0 font-medium">
                          {s.supplierType}
                        </Badge>
                      </td>

                      <td className="py-2.5 px-2 text-right font-mono font-semibold">
                        {formatCurrency(s.ratePerStrip)}
                        {s.discountPercent > 0 && (
                          <span className="text-[10px] text-emerald-600 block">
                            -{s.discountPercent}% disc
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-2 font-medium text-primary">
                        {s.freeGoodsBonus}
                      </td>

                      <td className="py-2.5 px-2 text-right font-mono font-bold text-foreground text-xs">
                        {formatCurrency(s.effectivePurchaseCost)}
                      </td>

                      <td className="py-2.5 px-2">
                        <span className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                          <Truck className="h-3 w-3 text-muted-foreground shrink-0" />
                          {s.deliveryTime}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center font-mono font-semibold">
                        <span
                          className={
                            s.deliveryReliability >= 95 ? 'text-emerald-600' : 'text-amber-600'
                          }
                        >
                          {s.deliveryReliability}%
                        </span>
                      </td>

                      <td className="py-2.5 px-2">
                        {s.isPoAllowed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                            Verified DL
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600">
                              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                              PO Blocked
                            </span>
                            <span className="text-[9px] text-rose-600/90 block leading-tight max-w-[140px]">
                              {s.poBlockReason || 'Compliance unverified'}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        {s.isPoAllowed ? (
                          <Button asChild size="sm" variant={s.isRecommended ? 'default' : 'outline'} className="h-7 text-[10px] gap-1 px-2 font-semibold">
                            <Link href={`/purchases/new?supplierId=${s.supplierId}&productId=${data?.productId}`}>
                              Order Now
                            </Link>
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" disabled className="h-7 text-[10px] text-muted-foreground">
                            Ineligible
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Regulatory Governance Note */}
        <div className="text-[11px] text-muted-foreground bg-muted/20 p-2.5 rounded-lg border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <span>
              <strong>Statutory Sourcing Rule:</strong> System prohibits automatic procurement selection purely on low price. Sourcing decisions mandate current Drug License (Form 20B/21B) verification, delivery reliability, and minimum margin safeguards.
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-6 text-xs shrink-0">
            Close Matrix
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
