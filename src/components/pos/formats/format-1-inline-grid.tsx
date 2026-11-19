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
  Minus,
  Package,
  Pill,
  Plus,
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
import { computeItemPricing, computeSaleTotals, round2 } from '@/lib/sales/pricing'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/currency'
import type { PosBatchItem, PosProductRow } from '../pos-client'
import { computeCartTotals, type BillingFormatComponentProps } from './billing-types'
import { TouchscreenScanDispenserModal } from '../touchscreen-scan-dispenser-modal'
import { BarcodeScannerModal } from '@/components/scanner/barcode-scanner-modal'
import { useI18n } from '@/lib/i18n/i18n-context'

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
  onSetCutTabs,
  onRemoveItem,
  onFinalizeBill,
  onOpenSalesPatterns,
}: BillingFormatComponentProps) {
  const { isAr, isPureArabic, formatPrice, translateDrug, translateGeneric, translateUnit } = useI18n()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<PosProductRow | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<PosBatchItem | null>(null)
  const [unitMode, setUnitMode] = useState<'STRIP' | 'TABLET'>('STRIP')
  const [tabsCut, setTabsCut] = useState<number>(1)
  const [quantity, setQuantity] = useState<string>('1')
  const [discountPercent, setDiscountPercent] = useState<string>('0')
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [substitutesOpen, setSubstitutesOpen] = useState<boolean>(false)
  const [substitutes, setSubstitutes] = useState<any[]>([])
  const [loadingSubstitutes, setLoadingSubstitutes] = useState<boolean>(false)

  // In-row Hardware scanner modals
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false)
  const [stripScannerOpen, setStripScannerOpen] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const qtyInputRef = useRef<HTMLInputElement>(null)
  const discInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Live Unit Rate calculation for Row 01
  const effectiveUnitRate = useMemo(() => {
    if (!selectedProduct) return 0
    if (unitMode === 'TABLET' && selectedProduct.tabsPerStrip && selectedProduct.tabsPerStrip > 1) {
      return round2(selectedProduct.mrp / selectedProduct.tabsPerStrip)
    }
    return selectedProduct.mrp
  }, [selectedProduct, unitMode])

  // Live Net calculation for Row 01
  const effectiveNet = useMemo(() => {
    if (!selectedProduct) return 0
    const qty = unitMode === 'TABLET' ? tabsCut : (parseFloat(quantity) || 1)
    const disc = parseFloat(discountPercent) || 0
    return round2(qty * effectiveUnitRate * (1 - disc / 100))
  }, [selectedProduct, unitMode, tabsCut, quantity, effectiveUnitRate, discountPercent])

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Filter brand matches based on searchTerm
  const brandMatches = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return []
    return products.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q)
      const matchGeneric = p.genericName?.toLowerCase().includes(q)
      const matchComposition = p.composition?.toLowerCase().includes(q)
      const matchSku = p.sku.toLowerCase().includes(q)
      return matchName || matchGeneric || matchComposition || matchSku
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
    setUnitMode('STRIP')
    setTabsCut(1)
    setQuantity('1')
    setDiscountPercent('0')

    // Advance focus to Qty cell!
    setTimeout(() => {
      qtyInputRef.current?.focus()
      qtyInputRef.current?.select()
    }, 50)
  }, [products])

  // Handle hardware / camera scanner injection directly into Row 01
  const handleApplyCutStripScan = useCallback(
    (item: {
      productId?: string
      productName?: string
      tabsCut?: number
      tabsPerStrip?: number
      batchNumber?: string
      expiryDate?: string
    }) => {
      const matched = products.find(
        (p) =>
          (item.productId && p.id === item.productId) ||
          p.name.toLowerCase() === (item.productName || '').toLowerCase()
      )
      if (matched) {
        const cut = item.tabsCut && item.tabsCut > 0 ? item.tabsCut : 1
        setSelectedProduct(matched)
        setSearchTerm(matched.name)
        setUnitMode('TABLET')
        setTabsCut(cut)
        setQuantity(String(cut))
        if (item.batchNumber) {
          const b = matched.batches?.find((bt) => bt.batchNumber === item.batchNumber)
          if (b) setSelectedBatch(b)
        }
      }
      setStripScannerOpen(false)
    },
    [products]
  )

  const handleApplyBarcodeScan = useCallback(
    (barcode: string) => {
      const term = barcode.trim().toLowerCase()
      const matched = products.find(
        (p) => p.barcode?.toLowerCase() === term || p.sku.toLowerCase() === term
      )
      if (matched) {
        handleSelectItem({ type: 'brand', item: matched })
      }
      setBarcodeScannerOpen(false)
    },
    [products, handleSelectItem]
  )

  // Commit current row into the cart and reset for next row
  const handleCommitRow = useCallback(() => {
    if (!selectedProduct) return

    const qtyNum = unitMode === 'TABLET' ? Math.max(1, tabsCut) : Math.max(1, parseFloat(quantity) || 1)
    const discNum = Math.max(0, parseFloat(discountPercent) || 0)

    onAddToCart(
      selectedProduct,
      selectedBatch ?? undefined,
      qtyNum,
      discNum,
      0,
      unitMode,
      unitMode === 'TABLET' ? qtyNum : undefined
    )

    // Reset row state and return focus to search cell for next line
    setSelectedProduct(null)
    setSelectedBatch(null)
    setSearchTerm('')
    setUnitMode('STRIP')
    setTabsCut(1)
    setQuantity('1')
    setDiscountPercent('0')
    setSubstitutesOpen(false)
    setSelectedIndex(0)

    setTimeout(() => {
      searchInputRef.current?.focus()
    }, 50)
  }, [selectedProduct, selectedBatch, quantity, discountPercent, unitMode, tabsCut, onAddToCart])

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
    if (e.key === 'Enter') {
      e.preventDefault()
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
          <button
            type="button"
            onClick={() => setBarcodeScannerOpen(true)}
            className="rounded bg-muted px-1.5 py-0.5 border hover:bg-muted/80 flex items-center gap-1 text-foreground"
          >
            <Barcode className="h-3 w-3" /> F8: Barcode
          </button>
          <button
            type="button"
            onClick={() => setStripScannerOpen(true)}
            className="rounded bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold px-1.5 py-0.5 border border-teal-500/30 hover:bg-teal-500/20 flex items-center gap-1"
          >
            <Scissors className="h-3 w-3" /> {isAr ? 'F9: قارئ الأشرطة' : 'F9: Strip Counter'}
          </button>
          {onOpenSalesPatterns && (
            <button
              type="button"
              onClick={onOpenSalesPatterns}
              className="rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold px-1.5 py-0.5 border border-amber-500/30 hover:bg-amber-500/20 flex items-center gap-1"
            >
              <Zap className="h-3 w-3" /> {isAr ? 'أنماط المبيعات' : 'Sales Patterns'}
            </button>
          )}
          <span className="rounded bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold px-1.5 py-0.5 border border-teal-500/30">
            {isAr ? 'F4 / End: إنهاء وصرف الفاتورة' : 'F4 / End: Finalize Bill'}
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
                <th className="py-2.5 px-3 w-[30%] min-w-[220px]">
                  {isAr ? 'اسم الصنف والدواء (التجاري / العلمي)' : 'Item Name (Search Salt / Brand)'}
                </th>
                <th className="py-2.5 px-3 w-[10%]">{isAr ? 'التشغيلة' : 'Batch'}</th>
                <th className="py-2.5 px-3 w-[9%]">{isAr ? 'الصلاحية' : 'Expiry'}</th>
                <th className="py-2.5 px-3 w-[25%] min-w-[200px] text-center font-bold text-foreground">
                  {isAr ? 'الكمية والوحدة (شريط / قرص)' : 'Qty & Unit (Strip / Tablet)'}
                </th>
                <th className="py-2.5 px-3 w-[10%] text-right">{isAr ? 'سعر الجمهور' : 'MRP (₹)'}</th>
                <th className="py-2.5 px-3 w-[7%] text-right">{isAr ? 'خصم%' : 'Disc%'}</th>
                <th className="py-2.5 px-3 w-[11%] text-right">{isAr ? 'الصافي' : 'Net (₹)'}</th>
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
                      </div>
                      <div className="text-[10px] text-muted-foreground ml-5 font-normal truncate mt-0.5">
                        {line.composition || line.categoryName || 'General Medicine'}
                      </div>
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-foreground">
                      {line.batchNumber || 'AUTO'}
                    </td>
                    <td className="py-2 px-3 font-mono text-muted-foreground">
                      {formatExpDate(line.expiryDate)}
                    </td>

                    {/* SAME COLUMN: Strip vs. Tablet indicator, Cut Stepper & Pack denominator */}
                    <td className="py-2 px-3 text-center">
                      {line.isTabletSale ? (
                        <div className="inline-flex flex-col items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-1.5 text-xs text-amber-950 dark:text-amber-100 shadow-2xs">
                          <div className="flex items-center justify-between w-full gap-2">
                            <Badge
                              variant="outline"
                              className="border-amber-500/50 bg-amber-500/20 px-1.5 py-0 text-[10px] font-bold text-amber-900 dark:text-amber-200"
                            >
                              ✂️ CUT TABLET
                            </Badge>
                            <button
                              type="button"
                              onClick={() => onToggleUnit?.(line.productId)}
                              className="text-[10px] font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 hover:underline transition-colors"
                              title="Convert back to Full Strip"
                            >
                              (⇄ Full Strip)
                            </button>
                          </div>

                          <div className="flex items-center gap-1 bg-background/90 rounded-md px-2 py-0.5 border border-amber-500/30">
                            <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">Cut:</span>
                            <button
                              type="button"
                              onClick={() => {
                                const cur = line.tabsCut || line.quantity || 1
                                if (cur > 1) onSetCutTabs?.(line.productId, cur - 1)
                              }}
                              className="h-4 w-4 rounded flex items-center justify-center bg-muted hover:bg-amber-500/20 font-bold text-xs text-muted-foreground transition-colors"
                              title="Decrease cut tablet count"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={(line.tabsPerStrip || 10) * 10}
                              value={line.tabsCut || line.quantity}
                              onChange={(e) =>
                                onSetCutTabs?.(line.productId, Math.max(1, parseInt(e.target.value) || 1))
                              }
                              className="w-8 text-center font-mono font-bold text-xs bg-transparent border-0 p-0 focus:outline-none text-foreground"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const cur = line.tabsCut || line.quantity || 1
                                onSetCutTabs?.(line.productId, cur + 1)
                              }}
                              className="h-4 w-4 rounded flex items-center justify-center bg-muted hover:bg-amber-500/20 font-bold text-xs text-muted-foreground transition-colors"
                              title="Increase cut tablet count"
                            >
                              +
                            </button>
                            <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                              of {line.tabsPerStrip || 10} tabs
                            </span>
                          </div>

                          <div className="text-[9px] text-muted-foreground font-mono">
                            Line: {line.tabsCut || line.quantity} tabs @ ₹{line.mrp.toFixed(2)}/tab
                          </div>
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-1.5 text-xs text-emerald-950 dark:text-emerald-100 shadow-2xs">
                          <div className="flex items-center justify-between w-full gap-2">
                            <Badge
                              variant="outline"
                              className="border-emerald-500/50 bg-emerald-500/20 px-1.5 py-0 text-[10px] font-bold text-emerald-800 dark:text-emerald-300"
                            >
                              📦 FULL STRIP
                            </Badge>
                            <button
                              type="button"
                              onClick={() => onToggleUnit?.(line.productId, 1)}
                              className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 hover:underline transition-colors flex items-center gap-0.5"
                              title="Click to bill loose cut tablets from this strip"
                            >
                              ✂️ Cut Tabs?
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              value={line.quantity}
                              onChange={(e) =>
                                onSetQuantity(line.productId, Math.max(1, parseInt(e.target.value) || 1))
                              }
                              className="w-12 rounded border border-emerald-500/40 bg-background px-1.5 py-0.5 text-center font-mono text-xs font-bold text-foreground focus:border-emerald-500 focus:outline-none"
                            />
                            <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300 font-mono">
                              Strips
                            </span>
                          </div>

                          <div className="text-[9px] text-muted-foreground font-mono">
                            Pack: {line.tabsPerStrip || 10} tabs/strip @ ₹{line.mrp.toFixed(2)}/strip
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="py-2 px-3 text-right font-mono text-foreground">
                      <div className="font-bold">₹{line.mrp.toFixed(2)}</div>
                      <div className="text-[9px] text-muted-foreground font-normal">
                        {line.isTabletSale ? 'per tab' : 'per strip'}
                      </div>
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
                      ₹{pricing.totalAmount.toFixed(2)}
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
                    <div className="relative">
                      <Input
                        ref={searchInputRef}
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value)
                          setSelectedIndex(0)
                        }}
                        onKeyDown={handleSearchKeyDown}
                        placeholder={isAr ? 'ابحث بالاسم التجاري، العلمي أو امسح الباركود...' : 'Type brand, salt or scan barcode (e.g. dolo)...'}
                        className="h-8 border-primary/60 bg-background text-xs font-medium focus-visible:ring-1 focus-visible:ring-primary shadow-xs pr-14"
                      />
                      <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setStripScannerOpen(true)}
                          className="h-5 w-5 rounded flex items-center justify-center text-teal-600 dark:text-teal-400 hover:bg-teal-500/10 transition-colors"
                          title="Camera AI Optical Strip Counter (F9)"
                        >
                          <Scissors className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setBarcodeScannerOpen(true)}
                          className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                          title="Scan Barcode (F8)"
                        >
                          <Barcode className="h-3.5 w-3.5" />
                        </button>
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

                {/* Cell 4: SAME COLUMN — Segmented Switch & Cut Stepper */}
                <td className="py-2.5 px-3 text-center">
                  <div className="flex flex-col items-center gap-1.5">
                    {/* Segmented Unit Selector */}
                    <div className="inline-flex rounded-lg border border-border/80 bg-muted/50 p-0.5 text-xs shadow-2xs">
                      <button
                        type="button"
                        onClick={() => {
                          setUnitMode('STRIP')
                          setQuantity('1')
                        }}
                        className={cn(
                          'px-2 py-0.5 rounded-md font-bold text-[11px] transition-all flex items-center gap-1',
                          unitMode === 'STRIP'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                        title="Bill Full Strip (Default)"
                      >
                        📦 Strip
                        {selectedProduct?.tabsPerStrip ? ` (${selectedProduct.tabsPerStrip}T)` : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUnitMode('TABLET')
                          if (!tabsCut || tabsCut <= 0) setTabsCut(1)
                        }}
                        className={cn(
                          'px-2 py-0.5 rounded-md font-bold text-[11px] transition-all flex items-center gap-1',
                          unitMode === 'TABLET'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                        title="Bill Cut / Loose Tablets"
                      >
                        ✂️ Cut Tab
                      </button>
                    </div>

                    {/* Quantity or Cut Stepper depending on Unit */}
                    {unitMode === 'TABLET' ? (
                      <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/40 rounded-md px-2 py-0.5">
                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">Cut:</span>
                        <button
                          type="button"
                          onClick={() => setTabsCut((c) => Math.max(1, c - 1))}
                          className="h-4 w-4 rounded flex items-center justify-center bg-background border border-amber-500/30 hover:bg-muted font-bold text-xs"
                          title="Decrease cut tablet count"
                        >
                          -
                        </button>
                        <Input
                          ref={qtyInputRef}
                          type="number"
                          min="1"
                          max={(selectedProduct?.tabsPerStrip || 10) * 10}
                          value={tabsCut}
                          onChange={(e) => setTabsCut(Math.max(1, parseInt(e.target.value) || 1))}
                          onKeyDown={handleQtyKeyDown}
                          className="h-6 w-9 border-0 bg-transparent text-center font-mono text-xs font-bold text-foreground focus-visible:ring-0 p-0"
                        />
                        <button
                          type="button"
                          onClick={() => setTabsCut((c) => c + 1)}
                          className="h-4 w-4 rounded flex items-center justify-center bg-background border border-amber-500/30 hover:bg-muted font-bold text-xs"
                          title="Increase cut tablet count"
                        >
                          +
                        </button>
                        <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                          of {selectedProduct?.tabsPerStrip || 10} tabs
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Input
                          ref={qtyInputRef}
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          onKeyDown={handleQtyKeyDown}
                          className="h-6 w-12 border-emerald-500/40 bg-background text-center font-mono text-xs font-bold text-foreground focus-visible:border-emerald-500 shadow-2xs px-1"
                        />
                        <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300 font-mono">
                          Strips
                        </span>
                        {selectedProduct?.tabsPerStrip && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({selectedProduct.tabsPerStrip} tabs/st)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </td>

                {/* Cell 5: Unit MRP */}
                <td className="py-2.5 px-3 text-right font-mono text-xs font-bold text-foreground">
                  {selectedProduct ? (
                    <div>
                      <div>₹{effectiveUnitRate.toFixed(2)}</div>
                      <div className="text-[9px] text-muted-foreground font-normal">
                        {unitMode === 'TABLET' ? 'per tab' : 'per strip'}
                      </div>
                    </div>
                  ) : (
                    '-'
                  )}
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
                  {selectedProduct ? (
                    <div>
                      <div>₹{effectiveNet.toFixed(2)}</div>
                      <div className="text-[9px] text-muted-foreground font-normal">
                        {unitMode === 'TABLET' ? `${tabsCut} tabs` : `${quantity} strips`}
                      </div>
                    </div>
                  ) : (
                    '-'
                  )}
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
                {isAr ? 'عدد البنود' : 'Line Items'}
              </span>
              <div className="font-mono text-lg font-bold text-foreground">{cart.length}</div>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {isAr ? 'إجمالي الوحدات' : 'Total Units'}
              </span>
              <div className="font-mono text-lg font-bold text-foreground">
                {cart.reduce((acc, c) => acc + c.quantity, 0)}
              </div>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {isAr ? 'المجموع قبل الضريبة' : 'Pre-Tax Subtotal'}
              </span>
              <div className="font-mono text-lg font-semibold text-foreground">
                {formatPrice(billTotals.subtotal)}
              </div>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {isAr ? 'إجمالي الضريبة' : 'Total Tax'}
              </span>
              <div className="font-mono text-lg font-semibold text-muted-foreground">
                {formatPrice(billTotals.taxAmount)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {isAr ? 'صافي المبلغ المستحق' : 'Net Payable Amount'}
              </span>
              <div className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatPrice(billTotals.totalAmount)}
              </div>
            </div>

            <Button
              size="lg"
              disabled={cart.length === 0}
              onClick={onFinalizeBill}
              className="h-11 px-6 font-bold shadow-md gap-2 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
            >
              <span>{isAr ? 'إتمام وصرف الفاتورة' : 'Complete Sale'}</span>
              <kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px] font-normal">
                F8 / Ctrl+↵
              </kbd>
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Hardware Modals (Camera AI Optical Strip Counter & Barcode) ─── */}
      <TouchscreenScanDispenserModal
        open={stripScannerOpen}
        onOpenChange={setStripScannerOpen}
        onApplyToCart={handleApplyCutStripScan}
        branchId={branchId || undefined}
      />
      <BarcodeScannerModal
        open={barcodeScannerOpen}
        onOpenChange={setBarcodeScannerOpen}
        branchId={branchId}
        onProductScanned={(data) => {
          if (data.product) {
            handleSelectItem({ type: 'brand', item: data.product })
            setBarcodeScannerOpen(false)
          }
        }}
      />
    </div>
  )
}
