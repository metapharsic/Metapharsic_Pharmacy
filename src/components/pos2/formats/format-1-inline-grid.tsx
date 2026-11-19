'use client'

import { formatRack } from '@/lib/utils/rack'

import { format, isValid, parseISO } from 'date-fns'
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Barcode,
  Camera,
  Check,
  CornerDownLeft,
  Info,
  Keyboard,
  MapPin,
  Package,
  Pill,
  Scissors,
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

export function Format1InlineGrid({
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
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<PosProductRow | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<PosBatchItem | null>(null)
  const [quantity, setQuantity] = useState<string>('1')
  const [discountPercent, setDiscountPercent] = useState<string>('0')
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [substitutesOpen, setSubstitutesOpen] = useState<boolean>(false)
  const [substitutes, setSubstitutes] = useState<any[]>([])
  const [loadingSubstitutes, setLoadingSubstitutes] = useState<boolean>(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const qtyInputRef = useRef<HTMLInputElement>(null)
  const discInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Filter brand matches based on searchTerm (name, generic, composition, sku, barcode)
  const brandMatches = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
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
  }, [products, searchTerm])

  // Current highlighted item in dropdown
  const currentHighlightedProduct = brandMatches[selectedIndex] || null

  // Fetch substitutes whenever highlighted item is Out of Stock or F2 pressed
  const shouldShowSubstitutes = useMemo(() => {
    if (substitutesOpen) return true
    if (!currentHighlightedProduct) return false
    return currentHighlightedProduct.availableQuantity <= 0
  }, [substitutesOpen, currentHighlightedProduct])

  useEffect(() => {
    const target = currentHighlightedProduct || brandMatches[0]
    if (!target) {
      setSubstitutes([])
      return
    }

    // Extract generic molecule
    const generic = target.genericName || (target.composition?.split(' ')[0] ?? '')
    if (!generic) return

    let cancelled = false
    setLoadingSubstitutes(true)

    // Extract strength (e.g. "650mg", "500mg", "120mg")
    const strengthMatch = (target.name + ' ' + (target.composition || '')).match(/\d+\s*(?:mg|ml|g)/i)
    const strength = strengthMatch ? strengthMatch[0] : ''

    const url = `/api/pos/substitutes?genericName=${encodeURIComponent(generic)}&excludeProductId=${target.id}&strength=${encodeURIComponent(strength)}&branchId=${branchId || ''}`

    fetch(url, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success) {
          setSubstitutes(data.data || [])
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingSubstitutes(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentHighlightedProduct, branchId])

  // Combined list for keyboard navigation: Brand matches + (if visible) Substitutes
  const combinedNavItems = useMemo(() => {
    const items: Array<{ type: 'brand' | 'substitute'; item: any }> = []
    brandMatches.forEach((p) => items.push({ type: 'brand', item: p }))
    if (shouldShowSubstitutes) {
      substitutes.forEach((s) => items.push({ type: 'substitute', item: s }))
    }
    return items
  }, [brandMatches, shouldShowSubstitutes, substitutes])

  // Auto-clamp selected index
  useEffect(() => {
    if (selectedIndex >= combinedNavItems.length) {
      setSelectedIndex(Math.max(0, combinedNavItems.length - 1))
    }
  }, [combinedNavItems.length, selectedIndex])

  // Select an item from the sub-panel (either brand match or substitute)
  const handleSelectItem = useCallback((itemObj: { type: 'brand' | 'substitute'; item: any }) => {
    let prod: PosProductRow | null = null

    if (itemObj.type === 'brand') {
      prod = itemObj.item as PosProductRow
    } else {
      // Find full product from products list or synthesize row
      const sub = itemObj.item
      const matched = products.find((p) => p.id === sub.id)
      if (matched) {
        prod = matched
      } else {
        prod = {
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
      }
    }

    if (!prod) return

    setSelectedProduct(prod)
    setSearchTerm(prod.name)

    // Select earliest expiring active batch (FEFO)
    const fefo = prod.batches && prod.batches.length > 0 ? prod.batches[0] : null
    setSelectedBatch(fefo)
    setQuantity('1')
    setDiscountPercent('0')

    // Advance focus to Qty cell!
    setTimeout(() => {
      qtyInputRef.current?.focus()
      qtyInputRef.current?.select()
    }, 50)
  }, [products])

  // Commit current row into the cart and reset for next row
  const handleCommitRow = useCallback(() => {
    if (!selectedProduct) return

    const qtyNum = Math.max(1, parseFloat(quantity) || 1)
    const discNum = Math.max(0, parseFloat(discountPercent) || 0)

    onAddToCart(selectedProduct, selectedBatch ?? undefined, qtyNum, discNum, 0)

    // Reset row state and return focus to search cell for next line
    setSelectedProduct(null)
    setSelectedBatch(null)
    setSearchTerm('')
    setQuantity('1')
    setDiscountPercent('0')
    setSubstitutesOpen(false)
    setSelectedIndex(0)

    setTimeout(() => {
      searchInputRef.current?.focus()
    }, 50)
  }, [selectedProduct, selectedBatch, quantity, discountPercent, onAddToCart])

  // Handle keyboard shortcuts inside Search cell
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, combinedNavItems.length - 1)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(0, prev - 1))
      return
    }
    if (e.key === 'F2') {
      e.preventDefault()
      setSubstitutesOpen((prev) => !prev)
      return
    }
    if (e.key === 'F8') {
      e.preventDefault()
      onOpenScanner?.()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const term = searchTerm.trim().toLowerCase()
      if (term) {
        // Instant exact barcode resolution
        const exactBarcode = products.find(
          (p) =>
            p.barcode?.toLowerCase() === term ||
            p.additionalBarcodes?.some((b) => b.toLowerCase() === term)
        )
        if (exactBarcode) {
          playBarcodeBeep()
          handleSelectItem({ type: 'brand', item: exactBarcode })
          return
        }
      }
      if (combinedNavItems[selectedIndex]) {
        handleSelectItem(combinedNavItems[selectedIndex])
      }
      return
    }
    if (e.key === 'Escape') {
      setSearchTerm('')
      setSelectedProduct(null)
      setSubstitutesOpen(false)
      return
    }
  }

  // Handle key navigation across Qty -> Disc% cells
  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      discInputRef.current?.focus()
      discInputRef.current?.select()
    }
    if (e.key === 'Escape') {
      searchInputRef.current?.focus()
    }
  }

  const handleDiscKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCommitRow()
    }
  }

  // Computed totals for active bill
  const billTotals = computeCartTotals(cart)

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden">
      {/* ─── Keyboard Hotkey Helper Banner ──────────────────── */}
      <div className="flex flex-wrap items-center justify-between border-b bg-card px-4 py-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold text-foreground">
            <Keyboard className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            Classic Inline Grid:
          </span>
          <span className="text-muted-foreground hidden sm:inline">
            Pure keyboard row-entry. No popups required.
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5 border">↓ / ↑ Navigate</span>
          <span className="rounded bg-muted px-1.5 py-0.5 border">Enter: Next Cell</span>
          <span className="rounded bg-muted px-1.5 py-0.5 border">F2: Substitutes</span>
          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="inline-flex items-center gap-1 rounded bg-primary/10 hover:bg-primary/20 text-primary font-bold px-1.5 py-0.5 border border-primary/30 transition-colors"
              title="Open Barcode Scanner (F8)"
            >
              <Barcode className="h-3 w-3" />
              <span>F8: Barcode</span>
            </button>
          )}
          {onOpenStripCounter && (
            <button
              type="button"
              onClick={onOpenStripCounter}
              className="inline-flex items-center gap-1 rounded bg-teal-500/15 hover:bg-teal-500/25 text-teal-800 dark:text-teal-200 font-bold px-1.5 py-0.5 border border-teal-500/40 transition-colors"
              title="Open AI Strip Counter / Phone Camera Vision (F9)"
            >
              <Scissors className="h-3 w-3 text-teal-600 dark:text-teal-400" />
              <span>F9: Strip Counter</span>
            </button>
          )}
          {onOpenSalesPatterns && (
            <button
              type="button"
              onClick={onOpenSalesPatterns}
              className="inline-flex items-center gap-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 font-bold px-1.5 py-0.5 border border-amber-500/40 transition-colors"
              title="Load Pre-configured 1-Tablet Sales Patterns & Acute Combos"
            >
              <Zap className="h-3 w-3 text-amber-600 dark:text-amber-400 fill-amber-500/20" />
              <span>⚡ Sales Patterns</span>
            </button>
          )}
          <span className="rounded bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold px-1.5 py-0.5 border border-teal-500/30">
            F4 / End: Finalize Bill
          </span>
        </div>
      </div>

      {/* ─── Main Accounting Table ───────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 relative">
        <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-visible">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 font-semibold text-muted-foreground">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 w-[40%] min-w-[280px]">
                  Item Name (Search Salt / Brand)
                </th>
                <th className="py-2.5 px-3 w-[12%]">Batch</th>
                <th className="py-2.5 px-3 w-[11%]">Expiry</th>
                <th className="py-2.5 px-3 w-[11%] text-right">Qty</th>
                <th className="py-2.5 px-3 w-[11%] text-right">MRP (₹)</th>
                <th className="py-2.5 px-3 w-[11%] text-right">Disc%</th>
                <th className="py-2.5 px-3 w-[14%] text-right">Net (₹)</th>
                <th className="py-2.5 px-3 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {/* Already Committed Lines in Cart */}
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
                        <span className="truncate">{line.name}</span>
                        {line.drugSchedule !== 'NONE' && (
                          <Badge variant="destructive" className="px-1 py-0 text-[9px] font-bold">
                            Rx
                          </Badge>
                        )}
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
                        {line.composition || line.categoryName || 'General Medicine'}
                        {line.isTabletSale && line.tabsPerStrip && (
                          <span className="ml-2 font-mono text-[9px] text-amber-600 dark:text-amber-400">
                            (Pro-rated {line.tabsPerStrip} tabs/strip)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-foreground">
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
                        className="w-14 rounded border border-border/80 bg-background px-1.5 py-0.5 text-right font-mono text-xs font-bold text-foreground focus:border-primary focus:outline-none"
                      />
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-foreground">
                      {line.mrp.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={line.discountPercent}
                        onChange={(e) =>
                          onUpdateDiscount(line.productId, Math.max(0, parseFloat(e.target.value) || 0))
                        }
                        className="w-14 rounded border border-border/80 bg-background px-1.5 py-0.5 text-right font-mono text-xs font-bold text-foreground focus:border-primary focus:outline-none"
                      />
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                      {pricing.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onRemoveItem(line.productId)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Delete line"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}

              {/* Active Editable Entry Row (User types here) */}
              <tr className="bg-primary/[0.02] border-t-2 border-primary/40 relative">
                <td className="py-2.5 px-3 text-center font-mono font-bold text-primary">
                  {String(cart.length + 1).padStart(2, '0')}
                </td>

                {/* Cell 1: Search & Intelligent Floating Sub-Panel */}
                <td className="py-2.5 px-3 relative">
                  <div className="relative">
                    <div className="relative flex items-center">
                    <Input
                      ref={searchInputRef}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value)
                        setSelectedIndex(0)
                      }}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Type brand, salt or scan barcode (e.g. dolo)..."
                      className="h-8 border-primary/60 bg-background pr-14 text-xs font-medium focus-visible:ring-1 focus-visible:ring-primary shadow-xs"
                    />
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                      {onOpenStripCounter && (
                        <button
                          type="button"
                          onClick={onOpenStripCounter}
                          tabIndex={-1}
                          className="p-1 text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-200 transition-colors"
                          title="Count cut tablets with Camera / Mobile AI (F9)"
                        >
                          <Scissors className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {onOpenScanner && (
                        <button
                          type="button"
                          onClick={onOpenScanner}
                          tabIndex={-1}
                          className="p-1 text-muted-foreground hover:text-primary transition-colors"
                          title="Scan Barcode with Camera / USB (F8)"
                        >
                          <Barcode className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                    {/* ─── INTELLIGENT SUB-PANEL (BRAND MATCHES + SUBSTITUTES) ─── */}
                    {searchTerm.trim().length > 0 && combinedNavItems.length > 0 && (
                      <div
                        ref={dropdownRef}
                        className="absolute left-0 top-full z-50 mt-1 w-[560px] rounded-xl border border-border/90 bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                      >
                        {/* Section 1: Brand Matches Header */}
                        <div className="flex items-center justify-between border-b bg-muted/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-primary" />
                            [BRAND MATCHES]
                          </span>
                          <span className="font-normal font-mono">
                            Press ↓ / ↑ to navigate · Enter to pick
                          </span>
                        </div>

                        {/* Brand Matches List */}
                        <div className="max-h-48 overflow-y-auto divide-y divide-border/40">
                          {brandMatches.map((prod, idx) => {
                            const isSelected = selectedIndex === idx
                            const isOos = prod.availableQuantity <= 0
                            return (
                              <div
                                key={prod.id}
                                onClick={() => handleSelectItem({ type: 'brand', item: prod })}
                                className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors text-xs ${
                                  isSelected
                                    ? 'bg-primary/15 text-foreground font-semibold border-l-4 border-primary pl-2'
                                    : 'hover:bg-muted/40'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate">{prod.name}</span>
                                    <span className="text-[10px] text-muted-foreground font-normal">
                                      | {prod.manufacturer || 'Pharma'}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                    <span>{prod.genericName || prod.composition || 'General'}</span>
                                    {prod.rack && (
                                      <span className="font-mono bg-amber-500/10 text-amber-700 dark:text-amber-300 px-1 rounded">
                                        Rack: {formatRack(prod.rack)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="text-right ml-3 shrink-0 flex items-center gap-3">
                                  {isOos ? (
                                    <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                                      Stock: 0 (OOS) ❌
                                    </Badge>
                                  ) : (
                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                      Stock: {prod.availableQuantity} {prod.unitOfMeasure}s
                                    </span>
                                  )}
                                  <span className="font-mono font-bold text-foreground">
                                    {formatCurrency(prod.mrp)}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Section 2: Substitutes (Appended automatically if OOS or F2) */}
                        {shouldShowSubstitutes && (
                          <div className="border-t-2 border-primary/50 bg-teal-500/[0.04]">
                            <div className="flex items-center justify-between bg-teal-500/15 px-3 py-1.5 text-[10px] font-bold text-teal-800 dark:text-teal-300">
                              <span className="flex items-center gap-1">
                                <Zap className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                                [SUBSTITUTES FOR:{' '}
                                {currentHighlightedProduct?.genericName ||
                                  currentHighlightedProduct?.name ||
                                  'Generic Molecule'}
                                ]
                              </span>
                              <span className="font-normal font-mono text-[9px]">
                                {currentHighlightedProduct?.availableQuantity <= 0
                                  ? '⚠️ Auto-suggested because requested item is Out of Stock'
                                  : 'Triggered via F2 shortcut'}
                              </span>
                            </div>

                            {loadingSubstitutes ? (
                              <div className="p-3 text-center text-xs text-muted-foreground">
                                Finding in-stock generic equivalents...
                              </div>
                            ) : substitutes.length === 0 ? (
                              <div className="p-3 text-center text-xs text-muted-foreground italic">
                                No alternative brands with current stock found in this branch.
                              </div>
                            ) : (
                              <div className="max-h-44 overflow-y-auto divide-y divide-border/30">
                                {substitutes.map((sub, sIdx) => {
                                  const navIndex = brandMatches.length + sIdx
                                  const isSelected = selectedIndex === navIndex
                                  return (
                                    <div
                                      key={sub.id}
                                      onClick={() =>
                                        handleSelectItem({ type: 'substitute', item: sub })
                                      }
                                      className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors text-xs ${
                                        isSelected
                                          ? 'bg-teal-500/20 text-foreground font-semibold border-l-4 border-teal-600 pl-2'
                                          : 'hover:bg-teal-500/10'
                                      }`}
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 text-foreground font-medium">
                                          <span>• {sub.name}</span>
                                          <span className="text-[10px] text-muted-foreground font-normal">
                                            | {sub.manufacturer}
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                          <span>Same Formula: {sub.composition || sub.genericName}</span>
                                          {sub.rack && (
                                            <span className="font-mono bg-amber-500/10 text-amber-700 dark:text-amber-300 px-1 rounded">
                                              Rack: {formatRack(sub.rack)}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="text-right ml-3 shrink-0 flex items-center gap-3">
                                        <Badge
                                          variant="secondary"
                                          className="font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                                        >
                                          Stock: {sub.availableQuantity} {sub.unitOfMeasure}s
                                        </Badge>
                                        <span className="font-mono font-bold text-foreground">
                                          {formatCurrency(sub.mrp)}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </td>

                {/* Cell 2: Auto-populated Batch */}
                <td className="py-2.5 px-3 font-mono text-xs font-semibold text-foreground">
                  {selectedBatch ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 border">
                      {selectedBatch.batchNumber}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">FEFO Auto</span>
                  )}
                </td>

                {/* Cell 3: Auto-populated Expiry */}
                <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">
                  {selectedBatch ? formatExpDate(selectedBatch.expiryDate) : '-'}
                </td>

                {/* Cell 4: Quantity Input */}
                <td className="py-2.5 px-3 text-right">
                  <Input
                    ref={qtyInputRef}
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    onKeyDown={handleQtyKeyDown}
                    disabled={!selectedProduct}
                    className="h-8 w-16 border-border/80 bg-background text-right font-mono text-xs font-bold text-foreground focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary ml-auto shadow-xs"
                  />
                </td>

                {/* Cell 5: Unit MRP */}
                <td className="py-2.5 px-3 text-right font-mono text-xs font-bold text-foreground">
                  {selectedProduct ? selectedProduct.mrp.toFixed(2) : '-'}
                </td>

                {/* Cell 7: Discount % */}
                <td className="py-2.5 px-3 text-right">
                  <Input
                    ref={discInputRef}
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    onKeyDown={handleDiscKeyDown}
                    disabled={!selectedProduct}
                    className="h-8 w-14 border-border/80 bg-background text-right font-mono text-xs font-bold text-foreground focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary ml-auto shadow-xs"
                  />
                </td>

                {/* Cell 8: Net Amount */}
                <td className="py-2.5 px-3 text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedProduct
                    ? (
                        parseFloat(quantity || '1') *
                        selectedProduct.mrp *
                        (1 - (parseFloat(discountPercent || '0') || 0) / 100)
                      ).toFixed(2)
                    : '-'}
                </td>

                {/* Cell 9: Quick Add Action */}
                <td className="py-2.5 px-3 text-center">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!selectedProduct}
                    onClick={handleCommitRow}
                    className="h-7 w-7 p-0 rounded-md bg-primary text-primary-foreground shadow-xs"
                    title="Commit line to bill (Enter)"
                  >
                    <CornerDownLeft className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Bottom Accounting Summary & Action Bar ─────────── */}
      <div className="border-t bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Line Items
              </span>
              <div className="font-mono text-lg font-bold text-foreground">{cart.length}</div>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total Units
              </span>
              <div className="font-mono text-lg font-bold text-foreground">
                {cart.reduce((acc, c) => acc + c.quantity, 0)}
              </div>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pre-Tax Subtotal
              </span>
              <div className="font-mono text-lg font-semibold text-foreground">
                {formatCurrency(billTotals.subtotal)}
              </div>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total GST
              </span>
              <div className="font-mono text-lg font-semibold text-muted-foreground">
                {formatCurrency(billTotals.taxAmount)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Net Payable Amount
              </span>
              <div className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(billTotals.totalAmount)}
              </div>
            </div>

            <Button
              size="lg"
              disabled={cart.length === 0}
              onClick={onFinalizeBill}
              className="h-11 px-6 font-bold shadow-md gap-2 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
            >
              <span>Complete Sale</span>
              <kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px] font-normal">
                F8 / Ctrl+↵
              </kbd>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
