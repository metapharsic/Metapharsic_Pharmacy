'use client'

// ─────────────────────────────────────────────────────────────
// Component — SalesPatternModal
// Chemist Sales Patterns & 1-Tablet Auto-Billing Hub:
// - Single tablet OTC quick dispensing
// - Multi-tablet acute symptom combos
// - Custom loose tablet dispenser
// - Real-time strip-to-tablet price & profit calculation
// - Instant 1-click auto-billing with FEFO stock deduction
// ─────────────────────────────────────────────────────────────
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Layers,
  Loader2,
  Pill,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'

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
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/lib/hooks/use-toast'
import { round2 } from '@/lib/sales/pricing'
import type { ResolvedSalesPattern } from '@/lib/sales/sales-pattern-service'
import { addPosCartItem, clearPosCart, type PosCartLine } from '@/lib/stores/pos-cart-store'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/currency'

interface SalesPatternModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId?: string | null
  initialProductId?: string | null
  onSaleCompleted?: (sale: any) => void
}

export function SalesPatternModal({
  open,
  onOpenChange,
  branchId,
  initialProductId,
  onSaleCompleted,
}: SalesPatternModalProps) {
  const router = useRouter()
  const toast = useToast()

  const [patterns, setPatterns] = useState<ResolvedSalesPattern[]>([])
  const [loading, setLoading] = useState(false)
  const [billingPatternId, setBillingPatternId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets')

  // Payment & Customer state for auto-billing
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CASH')
  const [customerName, setCustomerName] = useState('Walk-in Patient')
  const [customerPhone, setCustomerPhone] = useState('')

  // Custom 1-Tablet Builder State
  const [customSearch, setCustomSearch] = useState('')
  const [customProducts, setCustomProducts] = useState<any[]>([])
  const [searchingCustom, setSearchingCustom] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [customQuantity, setCustomQuantity] = useState<number>(1)

  // Success Confirmation State
  const [lastBilledSale, setLastBilledSale] = useState<any | null>(null)

  // Load Patterns from API
  const loadPatterns = useCallback(async () => {
    setLoading(true)
    try {
      const url = `/api/sales/patterns${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''}`
      const res = await fetch(url)
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setPatterns(json.data)
      } else {
        toast.error('Failed to load patterns', json.error?.message)
      }
    } catch {
      toast.error('Network error loading sales patterns')
    } finally {
      setLoading(false)
    }
  }, [branchId, toast])

  useEffect(() => {
    if (open) {
      void loadPatterns()
      setLastBilledSale(null)
    }
  }, [open, loadPatterns])

  // Custom product search
  useEffect(() => {
    if (!customSearch.trim() || activeTab !== 'custom') {
      setCustomProducts([])
      return
    }

    const t = setTimeout(async () => {
      setSearchingCustom(true)
      try {
        const res = await fetch(
          `/api/pos/products?search=${encodeURIComponent(customSearch.trim())}${
            branchId ? `&branchId=${encodeURIComponent(branchId)}` : ''
          }&limit=8`
        )
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setCustomProducts(json.data)
        }
      } catch {
        // silent
      } finally {
        setSearchingCustom(false)
      }
    }, 250)

    return () => clearTimeout(t)
  }, [customSearch, branchId, activeTab])

  // Execute Auto-Bill for a preset pattern
  const handleAutoBillPreset = async (pattern: ResolvedSalesPattern) => {
    setBillingPatternId(pattern.id)
    try {
      const res = await fetch('/api/sales/patterns/auto-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          patternId: pattern.id,
          paymentMethod,
          customerName,
          customerPhone: customerPhone || undefined,
          notes: pattern.defaultNotes,
        }),
      })

      const json = await res.json()
      if (json.success && json.data) {
        setLastBilledSale(json.data)
        toast.success(
          `Bill Generated: ${json.data.invoiceNumber}`,
          `Total: ${formatCurrency(json.data.totalAmount)} · Stock deducted`
        )
        onSaleCompleted?.(json.data)
        void loadPatterns()
      } else {
        toast.error('Auto-bill failed', json.error?.message)
      }
    } catch {
      toast.error('Network error executing auto-bill')
    } finally {
      setBillingPatternId(null)
    }
  }

  // Load preset pattern items into active POS Cart
  const handleLoadToPosCart = (pattern: ResolvedSalesPattern) => {
    for (const it of pattern.items) {
      const cartLine: PosCartLine = {
        productId: it.productId,
        sku: it.sku,
        barcode: null,
        name: `${it.productName} (${it.quantity} Tab${it.quantity > 1 ? 's' : ''})`,
        unitOfMeasure: 'Tablet',
        mrp: it.tabletUnitPrice,
        gstRate: 12,
        cgstRate: 6,
        sgstRate: 6,
        igstRate: 0,
        hsnCode: null,
        drugSchedule: 'OTC',
        isPrescriptionRequired: false,
        isGstExempt: false,
        quantity: it.quantity,
        discountPercent: 0,
        availableQuantity: it.availableStock,
        batchNumber: it.batchNumber || undefined,
        expiryDate: it.expiryDate || undefined,
      }
      addPosCartItem(cartLine)
    }

    toast.success(
      `Loaded '${pattern.title}' to POS Cart`,
      `${pattern.items.length} item(s) ready for checkout`
    )
    onOpenChange(false)
    router.push('/pos')
  }

  // Execute Auto-Bill for Custom Tablet Item
  const handleAutoBillCustom = async () => {
    if (!selectedProduct) return
    setBillingPatternId('custom')

    try {
      const res = await fetch('/api/sales/patterns/auto-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          patternId: 'custom-tablet-sale',
          paymentMethod,
          customerName,
          customerPhone: customerPhone || undefined,
          notes: `Custom 1-Tablet Dispense: ${selectedProduct.name}`,
          items: [
            {
              productId: selectedProduct.id,
              quantity: customQuantity,
              unit: 'TABLET',
              isTabletSale: true,
            },
          ],
        }),
      })

      const json = await res.json()
      if (json.success && json.data) {
        setLastBilledSale(json.data)
        toast.success(
          `Bill Generated: ${json.data.invoiceNumber}`,
          `Total: ${formatCurrency(json.data.totalAmount)} · 1-Tablet stock deducted`
        )
        onSaleCompleted?.(json.data)
        void loadPatterns()
      } else {
        toast.error('Custom tablet billing failed', json.error?.message)
      }
    } catch {
      toast.error('Network error executing custom billing')
    } finally {
      setBillingPatternId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b bg-gradient-to-r from-card via-background to-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Zap className="h-5 w-5 fill-amber-500/20 text-amber-500" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>Chemist Sales Patterns &amp; 1-Tablet Auto-Billing</span>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                    Live FEFO Stock Sync
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Dispense single tablets or symptom combos with automatic strip-to-tablet pricing, FEFO stock deduction, and instant billing.
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={loadPatterns}
              disabled={loading}
              className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              <span>Refresh</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Global Bill Settings Toolbar: Customer Name & Payment Mode */}
        <div className="px-5 py-2.5 bg-muted/40 border-b flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Label className="text-[11px] font-semibold text-muted-foreground">Patient / Buyer:</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Walk-in Patient"
              className="h-7 w-36 text-xs bg-background"
            />
            <Input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Mobile (Optional)"
              className="h-7 w-32 text-xs bg-background"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-[11px] font-semibold text-muted-foreground">Payment Mode:</Label>
            <Select value={paymentMethod} onValueChange={(val: any) => setPaymentMethod(val)}>
              <SelectTrigger className="h-7 w-28 text-xs bg-background font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">💵 Cash</SelectItem>
                <SelectItem value="UPI">📱 UPI / QR</SelectItem>
                <SelectItem value="CARD">💳 Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Success Banner if a sale was just completed */}
        {lastBilledSale && (
          <div className="mx-5 my-3 p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100 flex items-center justify-between animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold text-xs flex items-center gap-2">
                  <span>Bill Generated: {lastBilledSale.invoiceNumber}</span>
                  <Badge variant="success" className="text-[10px]">
                    {lastBilledSale.paymentStatus || 'PAID'}
                  </Badge>
                </div>
                <div className="text-[11px] text-emerald-800 dark:text-emerald-200 mt-0.5">
                  Amount: <strong className="font-mono">{formatCurrency(lastBilledSale.totalAmount)}</strong> · Customer: {lastBilledSale.customer?.name || 'Walk-in'} · Stock deducted accurately
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/sales/${lastBilledSale.id}`)}
                className="h-7 text-xs bg-background border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
              >
                <span>View Details</span>
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Main Content Tabs */}
        <div className="flex-1 overflow-y-auto p-5">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full space-y-4">
            <TabsList className="grid grid-cols-2 w-full max-w-sm">
              <TabsTrigger value="presets" className="text-xs font-semibold">
                Preset Symptom Patterns
              </TabsTrigger>
              <TabsTrigger value="custom" className="text-xs font-semibold">
                Custom 1-Tablet Dispenser
              </TabsTrigger>
            </TabsList>

            {/* ─── TAB 1: PRESET PATTERNS ────────────────────────── */}
            <TabsContent value="presets" className="space-y-3.5 mt-0 focus-visible:outline-none">
              {loading && patterns.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                  <p className="text-xs text-muted-foreground font-medium">Resolving inventory batches and tablet prices...</p>
                </div>
              ) : patterns.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  No sales patterns configured for this branch.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {patterns.map((pattern) => {
                    const isBillingThis = billingPatternId === pattern.id
                    const hasProfit = (pattern as any).totalProfit != null

                    return (
                      <div
                        key={pattern.id}
                        className={cn(
                          'p-4 rounded-xl border transition-all flex flex-col justify-between bg-card hover:border-primary/50 shadow-xs',
                          !pattern.canAutoBill && 'opacity-85 border-amber-500/30 bg-muted/20'
                        )}
                      >
                        <div className="space-y-2.5">
                          {/* Header badge & title */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <Badge variant="secondary" className="text-[10px] font-bold">
                                  {pattern.badge}
                                </Badge>
                                {!pattern.canAutoBill && (
                                  <Badge variant="destructive" className="text-[10px]">
                                    Out of Stock
                                  </Badge>
                                )}
                              </div>
                              <h4 className="font-bold text-xs text-foreground mt-1">{pattern.title}</h4>
                            </div>

                            <div className="text-right">
                              <span className="font-mono text-sm font-extrabold text-foreground">
                                {formatCurrency(pattern.totalBillAmount)}
                              </span>
                              {hasProfit && (
                                <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                                  <span>Profit: {formatCurrency((pattern as any).totalProfit)}</span>
                                  <span>({(pattern as any).profitPct}%)</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <p className="text-[11px] text-muted-foreground leading-relaxed">{pattern.description}</p>

                          {/* Items Breakdown list */}
                          <div className="p-2 rounded-lg bg-muted/40 border border-border/60 divide-y divide-border/40 text-[11px]">
                            {pattern.items.map((it) => (
                              <div key={it.productId} className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-semibold text-foreground truncate flex items-center gap-1">
                                    <Pill className="h-3 w-3 text-primary shrink-0" />
                                    <span>{it.productName}</span>
                                    <span className="font-mono text-[10px] text-muted-foreground">({it.quantity} Tab)</span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                    <span>Strip: {formatCurrency(it.stripMrp)} ({it.tabsPerStrip} tabs)</span>
                                    <span>·</span>
                                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                      Rate: {formatCurrency(it.tabletUnitPrice)}/tab
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className="font-mono font-bold text-foreground">
                                    {formatCurrency(it.lineTotal)}
                                  </span>
                                  <div className="text-[10px]">
                                    {it.isAvailable ? (
                                      <span className="text-muted-foreground">Stock: {it.availableStock}</span>
                                    ) : (
                                      <span className="text-destructive font-semibold">OOS</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {pattern.stockWarning && (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              <span>{pattern.stockWarning}</span>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="pt-3 mt-3 border-t border-border/60 flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!pattern.canAutoBill}
                            onClick={() => handleLoadToPosCart(pattern)}
                            className="h-7 text-[11px] gap-1 px-2.5"
                            title="Load items to POS Cart for manual billing"
                          >
                            <ShoppingCart className="h-3 w-3" />
                            <span>Load to POS</span>
                          </Button>

                          <Button
                            size="sm"
                            disabled={!pattern.canAutoBill || isBillingThis}
                            onClick={() => handleAutoBillPreset(pattern)}
                            className="h-7 text-[11px] gap-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                          >
                            {isBillingThis ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Zap className="h-3 w-3 fill-white" />
                            )}
                            <span>⚡ Auto-Bill Now</span>
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            {/* ─── TAB 2: CUSTOM 1-TABLET BUILDER ───────────────── */}
            <TabsContent value="custom" className="space-y-4 mt-0 focus-visible:outline-none">
              <div className="p-4 rounded-xl border bg-card space-y-4">
                <div>
                  <h4 className="font-bold text-xs text-foreground">Custom 1-Tablet Dispensing</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Select any medicine strip from your inventory to dispense 1 or more loose tablets with automatic per-tablet price &amp; cost division.
                  </p>
                </div>

                {/* Medicine Search Box */}
                <div className="space-y-1.5 relative">
                  <Label className="text-xs font-semibold">Search Medicine in Branch Inventory:</Label>
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                    <Input
                      value={customSearch}
                      onChange={(e) => setCustomSearch(e.target.value)}
                      placeholder="Type medicine name (e.g. Paracetamol, Dolo, Amoxicillin)..."
                      className="pl-9 text-xs h-8 bg-background"
                    />
                  </div>

                  {/* Dropdown Results */}
                  {customProducts.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border bg-card shadow-xl max-h-48 overflow-y-auto divide-y">
                      {customProducts.map((p) => {
                        const tabs = p.tabsPerStrip && p.tabsPerStrip > 1 ? p.tabsPerStrip : 10
                        const tabRate = round2(Number(p.mrp) / tabs)
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedProduct(p)
                              setCustomSearch(p.name)
                              setCustomProducts([])
                            }}
                            className="p-2.5 hover:bg-muted/50 cursor-pointer flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-semibold text-foreground">{p.name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                Strip MRP: {formatCurrency(p.mrp)} ({tabs} tabs/strip) · Stock: {p.availableQuantity}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(tabRate)}/tab
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Selected Product Economics Preview */}
                {selectedProduct && (
                  <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/[0.03] space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                          <Pill className="h-4 w-4 text-primary" />
                          <span>{selectedProduct.name}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          SKU: {selectedProduct.sku} · Available Stock: {selectedProduct.availableQuantity} strips
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-semibold">Qty (Tabs):</Label>
                        <Input
                          type="number"
                          min="1"
                          max="999"
                          value={customQuantity}
                          onChange={(e) => setCustomQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-7 w-16 text-center font-bold text-xs bg-background"
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Pricing Math Card */}
                    {(() => {
                      const tabs = selectedProduct.tabsPerStrip && selectedProduct.tabsPerStrip > 1 ? selectedProduct.tabsPerStrip : 10
                      const tabRate = round2(Number(selectedProduct.mrp) / tabs)
                      const lineTotal = round2(tabRate * customQuantity)

                      return (
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2 rounded-lg bg-background border">
                            <div className="text-[10px] text-muted-foreground">Per Tablet Rate</div>
                            <div className="font-mono font-bold text-foreground mt-0.5">
                              {formatCurrency(tabRate)}
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-background border">
                            <div className="text-[10px] text-muted-foreground">Tablets Dispensed</div>
                            <div className="font-mono font-bold text-primary mt-0.5">
                              {customQuantity} Tab(s)
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-background border">
                            <div className="text-[10px] text-muted-foreground">Total Bill Amount</div>
                            <div className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                              {formatCurrency(lineTotal)}
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        disabled={billingPatternId === 'custom' || selectedProduct.availableQuantity <= 0}
                        onClick={handleAutoBillCustom}
                        className="h-8 gap-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
                      >
                        {billingPatternId === 'custom' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Zap className="h-3.5 w-3.5 fill-white" />
                        )}
                        <span>⚡ Generate 1-Tablet Bill</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-muted/20 flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Automatic integer stock deduction · Zero schema mutations · Instant invoice sync</span>
          </div>

          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
