'use client'

import { format, isValid, parseISO } from 'date-fns'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Barcode,
  Camera,
  Check,
  CornerDownLeft,
  Info,
  MapPin,
  Pill,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { playBarcodeBeep } from '@/lib/scanner/barcode-sound'
import { computeItemPricing, computeSaleTotals } from '@/lib/sales/pricing'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/currency'
import type { PosBatchItem, PosProductRow } from '../pos2-client'
import { computeCartTotals, type BillingFormatComponentProps } from './billing-types'

function formatExpDate(d: string | Date | null | undefined): string {
  if (!d) return '-'
  try {
    const date = typeof d === 'string' ? parseISO(d) : d
    return isValid(date) ? format(date, 'MM/yyyy') : '-'
  } catch {
    return '-'
  }
}

interface WarningItem {
  id: string
  name: string
  composition?: string
  genericName?: string
  mrp: number
  availableQuantity: number
  rack?: string
  substitutes: any[]
}

export function Format4AccordionWarning({
  products,
  branchId,
  cart,
  onAddToCart,
  onUpdateQuantity,
  onSetQuantity,
  onUpdateDiscount,
  onToggleUnit,
  onRemoveItem,
  onFinalizeBill,
  onOpenScanner,
  onOpenStripCounter,
  onOpenSalesPatterns,
}: BillingFormatComponentProps) {
  const [search, setSearch] = useState('')
  const [warningItem, setWarningItem] = useState<WarningItem | null>(null)
  const [loadingSubs, setLoadingSubs] = useState(false)
  const [focusedSearchIndex, setFocusedSearchIndex] = useState(0)

  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Filter products by search (name, generic, composition, sku, barcode)
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return products.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q)
      const matchGeneric = p.genericName?.toLowerCase().includes(q)
      const matchComposition = p.composition?.toLowerCase().includes(q)
      const matchSku = p.sku.toLowerCase().includes(q)
      const matchBarcode = p.barcode?.toLowerCase().includes(q)
      const matchAdditional = p.additionalBarcodes?.some((b) => b.toLowerCase().includes(q))
      return (
        matchName ||
        matchGeneric ||
        matchComposition ||
        matchSku ||
        matchBarcode ||
        matchAdditional
      )
    })
  }, [products, search])

  // Fetch substitutes when an out of stock product is selected
  const fetchSubstitutesForWarning = useCallback(
    async (product: PosProductRow) => {
      setLoadingSubs(true)
      const generic = product.genericName || product.composition?.split(' ')[0] || ''
      const strengthMatch = (product.name + ' ' + (product.composition || '')).match(
        /\d+\s*(?:mg|ml|g)/i
      )
      const strength = strengthMatch ? strengthMatch[0] : ''

      try {
        const url = `/api/pos/substitutes?genericName=${encodeURIComponent(generic)}&excludeProductId=${product.id}&strength=${encodeURIComponent(strength)}&branchId=${branchId || ''}`
        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json()
        const subs = data.success ? data.data : []
        setWarningItem({
          id: product.id,
          name: product.name,
          composition: product.composition || product.genericName || undefined,
          genericName: product.genericName || undefined,
          mrp: product.mrp,
          availableQuantity: 0,
          rack: product.rack || undefined,
          substitutes: subs,
        })
      } catch {
        setWarningItem({
          id: product.id,
          name: product.name,
          mrp: product.mrp,
          availableQuantity: 0,
          substitutes: [],
        })
      } finally {
        setLoadingSubs(false)
      }
    },
    [branchId]
  )

  // Handle selecting an item from the search autocomplete
  const handleSelectProduct = useCallback(
    (product: PosProductRow) => {
      if (product.availableQuantity <= 0) {
        // Zero stock! Trigger inline accordion warning!
        setSearch('')
        void fetchSubstitutesForWarning(product)
        return
      }

      // Normal stock -> add directly to bill
      const fefo = product.batches && product.batches.length > 0 ? product.batches[0] : undefined
      onAddToCart(product, fefo, 1, 0)
      setSearch('')
      setWarningItem(null)
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    },
    [fetchSubstitutesForWarning, onAddToCart]
  )

  // Swap out-of-stock item with selected substitute (via Alt+1, Alt+2, Alt+3 or click)
  const handleSwapSubstitute = useCallback(
    (sub: any) => {
      const matched = products.find((p) => p.id === sub.id)
      if (matched) {
        const fefo = matched.batches && matched.batches.length > 0 ? matched.batches[0] : undefined
        onAddToCart(matched, fefo, 1, 0)
      } else {
        const synthetic: PosProductRow = {
          id: sub.id,
          name: sub.name,
          genericName: sub.genericName,
          sku: sub.sku || 'SUB',
          barcode: null,
          unitOfMeasure: sub.unitOfMeasure,
          mrp: sub.mrp,
          gstRate: 12,
          cgstRate: 6,
          sgstRate: 6,
          igstRate: 12,
          hsnCode: '3004',
          drugSchedule: 'NONE',
          isPrescriptionRequired: false,
          isGstExempt: false,
          additionalBarcodes: [],
          availableQuantity: sub.availableQuantity,
          rack: sub.rack,
          manufacturer: sub.manufacturer,
          composition: sub.composition,
        }
        onAddToCart(synthetic, undefined, 1, 0)
      }

      // Smoothly dismiss the warning
      setWarningItem(null)
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    },
    [products, onAddToCart]
  )

  // Global Alt+1, Alt+2, Alt+3 Hotkeys for instantaneous substitution swap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!warningItem || warningItem.substitutes.length === 0) return

      if (e.altKey && (e.key === '1' || e.code === 'Digit1')) {
        e.preventDefault()
        if (warningItem.substitutes[0]) handleSwapSubstitute(warningItem.substitutes[0])
      } else if (e.altKey && (e.key === '2' || e.code === 'Digit2')) {
        e.preventDefault()
        if (warningItem.substitutes[1]) handleSwapSubstitute(warningItem.substitutes[1])
      } else if (e.altKey && (e.key === '3' || e.code === 'Digit3')) {
        e.preventDefault()
        if (warningItem.substitutes[2]) handleSwapSubstitute(warningItem.substitutes[2])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [warningItem, handleSwapSubstitute])

  // Handle keys in search input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedSearchIndex((prev) =>
        Math.min(prev + 1, Math.max(0, filteredProducts.length - 1))
      )
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedSearchIndex((prev) => Math.max(0, prev - 1))
      return
    }
    if (e.key === 'F8') {
      e.preventDefault()
      onOpenScanner?.()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const term = search.trim().toLowerCase()
      if (term) {
        const exactBarcode = products.find(
          (p) =>
            p.barcode?.toLowerCase() === term ||
            p.additionalBarcodes?.some((b) => b.toLowerCase() === term)
        )
        if (exactBarcode) {
          playBarcodeBeep()
          handleSelectProduct(exactBarcode)
          return
        }
      }
      if (filteredProducts[focusedSearchIndex]) {
        handleSelectProduct(filteredProducts[focusedSearchIndex])
      }
      return
    }
  }

  // Calculate bill totals
  const billTotals = computeCartTotals(cart)

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden">
      {/* ─── Header Info ────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b bg-card px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
          </span>
          <span className="font-bold text-foreground uppercase tracking-wider">
            Format 4: Inline Accordion Row (Expand-on-Warning)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="inline-flex items-center gap-1 rounded bg-primary/10 hover:bg-primary/20 text-primary font-bold px-1.5 py-0.5 border border-primary/30 transition-colors text-[11px] font-mono"
              title="Open Barcode Scanner (F8)"
            >
              <Barcode className="h-3 w-3" />
              <span>F8: Barcode</span>
            </button>
          )}
          <div className="text-[11px] font-mono text-muted-foreground hidden sm:inline">
            Contextual warning drawer expands on zero stock · Instant Alt+1 / Alt+2 / Alt+3 substitute swap
          </div>
        </div>
      </div>

      {/* ─── Main Table with Expandable Accordion Drawer ─────── */}
      <div className="flex-1 overflow-y-auto p-4 relative">
        <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-visible">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/70 bg-muted/30 font-semibold text-muted-foreground">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 w-[35%]">Item Name</th>
                <th className="py-2.5 px-3 w-[15%]">Batch</th>
                <th className="py-2.5 px-3 w-[10%]">Expiry</th>
                <th className="py-2.5 px-3 w-[8%] text-right">Qty</th>
                <th className="py-2.5 px-3 w-[10%] text-right">Rate (₹)</th>
                <th className="py-2.5 px-3 w-[8%] text-right">Disc%</th>
                <th className="py-2.5 px-3 w-[12%] text-right">Total (₹)</th>
                <th className="py-2.5 px-3 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {/* Added Bill Rows */}
              {cart.map((line, idx) => {
                const pricing = computeItemPricing({
                  mrp: line.mrp,
                  quantity: line.quantity,
                  discountPercent: line.discountPercent,
                  gstRate: line.gstRate,
                  cgstRate: line.cgstRate,
                  sgstRate: line.sgstRate,
                  igstRate: line.igstRate,
                  isGstExempt: line.isGstExempt,
                  taxInclusive: true,
                })

                return (
                  <tr key={line.productId} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-3 text-center font-mono text-muted-foreground font-semibold">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="py-2 px-3 font-semibold text-foreground">
                      <div className="flex items-center gap-1.5">
                        <Pill className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{line.name}</span>
                        {(line.unitOfMeasure === 'Strip' || line.unitOfMeasure === 'STRIP' || line.tabsPerStrip || line.isTabletSale) && (
                          <button
                            type="button"
                            onClick={() => onToggleUnit?.(line.productId)}
                            className={cn(
                              'ml-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold transition-all border',
                              line.isTabletSale
                                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                                : 'bg-muted/60 text-muted-foreground border-border hover:bg-muted'
                            )}
                            title="Click to toggle between Full Strip and 1-Tablet loose pricing"
                          >
                            {line.isTabletSale ? '⚡ 1 Tab' : 'Strip'}
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground ml-5 font-normal truncate">
                        {line.composition || line.genericName || 'General Medicine'}
                        {line.isTabletSale && line.tabsPerStrip && (
                          <span className="ml-2 font-mono text-[9px] text-amber-600 dark:text-amber-400">
                            (Pro-rated {line.tabsPerStrip} tabs/strip)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 font-mono text-foreground font-medium">
                      {line.batchNumber || 'AUTO'}
                    </td>
                    <td className="py-2 px-3 font-mono text-muted-foreground">
                      {formatExpDate(line.expiryDate)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) =>
                          onSetQuantity(line.productId, Math.max(1, parseInt(e.target.value) || 1))
                        }
                        className="w-12 rounded border border-border/80 bg-background px-1 py-0.5 text-right font-mono text-xs font-bold text-foreground focus:border-primary focus:outline-none"
                      />
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-foreground">
                      {line.mrp.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                      {line.discountPercent}%
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                      {pricing.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onRemoveItem(line.productId)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}

              {/* ─── INLINE ACCORDION DRAWER (ZERO STOCK WARNING) ─── */}
              {warningItem && (
                <>
                  <tr className="bg-amber-500/10 border-t-2 border-amber-500/50">
                    <td className="py-2 px-3 text-center font-mono font-bold text-amber-600">
                      {String(cart.length + 1).padStart(2, '0')}
                    </td>
                    <td className="py-2 px-3 font-bold text-amber-900 dark:text-amber-200">
                      {warningItem.name}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-destructive" colSpan={6}>
                      ── ZERO STOCK ──────────────────────────────────────────────
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => setWarningItem(null)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Contextual Substitute Drawer */}
                  <tr className="bg-amber-500/5 border-b-2 border-amber-500/30">
                    <td className="p-0" colSpan={9}>
                      <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                          <span>
                            ⚠️ &ldquo;{warningItem.name}&rdquo; is Out of Stock in this branch.
                          </span>
                        </div>

                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                            <Zap className="h-3.5 w-3.5 text-teal-600" />
                            Recommended Substitutes (Composition:{' '}
                            <span className="text-foreground">
                              {warningItem.composition || warningItem.genericName || 'Same Formula'}
                            </span>
                            ):
                          </div>

                          {loadingSubs ? (
                            <div className="text-xs text-muted-foreground py-2">
                              Fetching in-stock equivalent formulas...
                            </div>
                          ) : warningItem.substitutes.length === 0 ? (
                            <div className="text-xs text-muted-foreground italic py-1">
                              No active substitutes currently in stock for this formula.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                              {warningItem.substitutes.slice(0, 3).map((sub, sIdx) => {
                                const hotkeyNum = sIdx + 1
                                return (
                                  <div
                                    key={sub.id}
                                    onClick={() => handleSwapSubstitute(sub)}
                                    className="flex flex-col justify-between rounded-xl border border-teal-500/40 bg-card p-3 shadow-xs hover:border-teal-500 hover:shadow-md cursor-pointer transition-all group"
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <div className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                                        [{hotkeyNum}] {sub.name}
                                      </div>
                                      <Badge
                                        variant="outline"
                                        className="font-mono text-[9px] bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30 font-bold"
                                      >
                                        Alt+{hotkeyNum}
                                      </Badge>
                                    </div>

                                    <div className="mt-2 space-y-1 text-[11px] font-mono text-muted-foreground">
                                      <div className="flex items-center justify-between">
                                        <span>Stock:</span>
                                        <strong className="text-emerald-600 dark:text-emerald-400">
                                          {sub.availableQuantity} {sub.unitOfMeasure}s
                                        </strong>
                                      </div>
                                      {sub.rack && (
                                        <div className="flex items-center justify-between">
                                          <span>Rack:</span>
                                          <strong className="text-foreground">{sub.rack}</strong>
                                        </div>
                                      )}
                                      <div className="flex items-center justify-between">
                                        <span>MRP:</span>
                                        <strong className="text-foreground">
                                          {formatCurrency(sub.mrp)}
                                        </strong>
                                      </div>
                                    </div>

                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="mt-3 h-7 w-full text-xs font-bold gap-1 bg-teal-600 text-white hover:bg-teal-700"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleSwapSubstitute(sub)
                                      }}
                                    >
                                      <span>Swap Item</span>
                                      <kbd className="rounded bg-white/20 px-1 py-0.2 text-[10px]">
                                        Alt+{hotkeyNum}
                                      </kbd>
                                    </Button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                </>
              )}

              {/* Active Next Item Row */}
              <tr className="bg-primary/[0.02] border-t-2 border-primary/40 relative">
                <td className="py-2.5 px-3 text-center font-mono font-bold text-primary">
                  {String(cart.length + 1).padStart(2, '0')}
                </td>

                <td className="py-2.5 px-3 relative" colSpan={8}>
                  <div className="relative">
                    <div className="relative flex items-center">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      type="text"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value)
                        setFocusedSearchIndex(0)
                      }}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Type brand, salt or scan barcode (e.g. Dolo, Augmentin)..."
                      className="h-8 border-primary/60 bg-background pl-8 pr-8 text-xs font-medium focus-visible:ring-1 focus-visible:ring-primary shadow-2xs"
                    />
                    {onOpenScanner && (
                      <button
                        type="button"
                        onClick={onOpenScanner}
                        tabIndex={-1}
                        className="absolute right-2 p-1 text-muted-foreground hover:text-primary transition-colors"
                        title="Scan Barcode with Camera / USB (F8)"
                      >
                        <Barcode className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                    {/* Autocomplete Dropdown */}
                    {search.trim().length > 0 && filteredProducts.length > 0 && (
                      <div className="absolute left-0 top-full z-50 mt-1 w-full max-w-xl rounded-xl border border-border/90 bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <div className="border-b bg-muted/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Select Product
                        </div>
                        <div className="max-h-56 overflow-y-auto divide-y divide-border/40">
                          {filteredProducts.map((p, idx) => {
                            const isFocused = focusedSearchIndex === idx
                            const isOos = p.availableQuantity <= 0

                            return (
                              <div
                                key={p.id}
                                onClick={() => handleSelectProduct(p)}
                                className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors text-xs ${
                                  isFocused
                                    ? 'bg-primary/15 text-foreground font-semibold border-l-4 border-primary pl-2'
                                    : 'hover:bg-muted/40'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate">{p.name}</span>
                                    <span className="text-[10px] text-muted-foreground font-normal">
                                      | {p.manufacturer || 'Pharma'}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5">
                                    {p.composition || p.genericName}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0 ml-2">
                                  {isOos ? (
                                    <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                                      Stock: 0 (Trigger Warning)
                                    </Badge>
                                  ) : (
                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                      Stock: {p.availableQuantity}
                                    </span>
                                  )}
                                  <span className="font-mono font-bold text-foreground">
                                    {formatCurrency(p.mrp)}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Bottom Bill Footer ─────────────────────────────── */}
      <div className="border-t bg-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-muted-foreground">
            Billed Items: <strong className="text-foreground">{cart.length}</strong>
          </span>
          <span className="text-muted-foreground">
            Subtotal: <strong className="text-foreground">{formatCurrency(billTotals.subtotal)}</strong>
          </span>
          <span className="text-muted-foreground">
            Payable:{' '}
            <strong className="text-emerald-600 dark:text-emerald-400 text-base font-bold">
              {formatCurrency(billTotals.totalAmount)}
            </strong>
          </span>
        </div>

        <Button
          disabled={cart.length === 0}
          onClick={onFinalizeBill}
          className="h-9 px-6 font-bold shadow-xs bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
        >
          Checkout Bill (F8)
        </Button>
      </div>
    </div>
  )
}
