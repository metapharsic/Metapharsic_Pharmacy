'use client'

import { formatRack } from '@/lib/utils/rack'

import { format, isValid, parseISO } from 'date-fns'
import {
  AlertCircle,
  ArrowRight,
  Check,
  Droplets,
  FlaskConical,
  Info,
  Layers,
  MapPin,
  Pill,
  Search,
  Split,
  Syringe,
  Trash2,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { computeItemPricing, computeSaleTotals } from '@/lib/sales/pricing'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/currency'
import type { PosBatchItem, PosProductRow } from '../pos-client'
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

export function Format2SplitScreen({
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
}: BillingFormatComponentProps) {
  const [search, setSearch] = useState('')
  const [activePane, setActivePane] = useState<'strengths' | 'substitutes'>('strengths')
  const [selectedStrengthIndex, setSelectedStrengthIndex] = useState(0)
  const [selectedSubIndex, setSelectedSubIndex] = useState(0)
  const [substitutes, setSubstitutes] = useState<any[]>([])
  const [loadingSubs, setLoadingSubs] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Brand and strength matches from products list
  const strengthMatches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return products.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q)
      const matchGeneric = p.genericName?.toLowerCase().includes(q)
      const matchComposition = p.composition?.toLowerCase().includes(q)
      return matchName || matchGeneric || matchComposition
    })
  }, [products, search])

  const currentProduct = strengthMatches[selectedStrengthIndex] || strengthMatches[0]

  // Detect generic group
  const genericGroup = useMemo(() => {
    if (currentProduct?.genericName) return currentProduct.genericName
    if (currentProduct?.composition) return currentProduct.composition.split(' ')[0]
    return search ? `Molecules matching "${search}"` : 'Awaiting input...'
  }, [currentProduct, search])

  // Fetch in-stock generic equivalents
  useEffect(() => {
    if (!currentProduct?.genericName && !search.trim()) {
      setSubstitutes([])
      return
    }

    const generic = currentProduct?.genericName || search.trim()
    let cancelled = false
    setLoadingSubs(true)

    const strengthMatch = (currentProduct?.name + ' ' + (currentProduct?.composition || '')).match(
      /\d+\s*(?:mg|ml|g)/i
    )
    const strength = strengthMatch ? strengthMatch[0] : ''

    const url = `/api/pos/substitutes?genericName=${encodeURIComponent(generic)}&excludeProductId=${currentProduct?.id || ''}&strength=${encodeURIComponent(strength)}&branchId=${branchId || ''}`

    fetch(url, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success) {
          setSubstitutes(data.data || [])
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingSubs(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentProduct, search, branchId])

  // If current brand item is OOS, automatically highlight substitute pane
  useEffect(() => {
    if (currentProduct && currentProduct.availableQuantity <= 0 && substitutes.length > 0) {
      setActivePane('substitutes')
    }
  }, [currentProduct, substitutes.length])

  // Handle adding product to cart
  const handleAddProduct = useCallback(
    (prod: PosProductRow) => {
      const fefo = prod.batches && prod.batches.length > 0 ? prod.batches[0] : undefined
      onAddToCart(prod, fefo, 1, 0)
      setSearch('')
      setSelectedStrengthIndex(0)
      setSelectedSubIndex(0)
      setActivePane('strengths')
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    },
    [onAddToCart]
  )

  // Handle adding substitute to cart
  const handleAddSubstitute = useCallback(
    (sub: any) => {
      const matched = products.find((p) => p.id === sub.id)
      if (matched) {
        handleAddProduct(matched)
        return
      }

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
      handleAddProduct(synthetic)
    },
    [products, handleAddProduct]
  )

  // Global keydown within search input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      setActivePane((prev) => (prev === 'strengths' ? 'substitutes' : 'strengths'))
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (activePane === 'strengths') {
        setSelectedStrengthIndex((prev) => Math.min(prev + 1, Math.max(0, strengthMatches.length - 1)))
      } else {
        setSelectedSubIndex((prev) => Math.min(prev + 1, Math.max(0, substitutes.length - 1)))
      }
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (activePane === 'strengths') {
        setSelectedStrengthIndex((prev) => Math.max(0, prev - 1))
      } else {
        setSelectedSubIndex((prev) => Math.max(0, prev - 1))
      }
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (activePane === 'strengths' && strengthMatches[selectedStrengthIndex]) {
        const item = strengthMatches[selectedStrengthIndex]
        if (item.availableQuantity > 0) {
          handleAddProduct(item)
        } else {
          setActivePane('substitutes')
        }
      } else if (activePane === 'substitutes' && substitutes[selectedSubIndex]) {
        handleAddSubstitute(substitutes[selectedSubIndex])
      }
      return
    }
  }

  // Calculate bill totals
  const billTotals = computeCartTotals(cart)

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden">
      {/* ─── Upper 60%: Billing Data Table ───────────────────── */}
      <div className="h-[58%] border-b border-border/80 flex flex-col overflow-hidden bg-card/40">
        <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Split className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Billing Grid (Upper Workspace)
            </span>
            <Badge variant="outline" className="text-[10px] font-mono">
              {cart.length} {cart.length === 1 ? 'item' : 'items'}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span>Press Tab to toggle dock inspection · Enter to add item</span>
          </div>
        </div>

        {/* Scrollable Upper Table */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="rounded-xl border border-border/70 bg-card shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/70 bg-muted/30 font-semibold text-muted-foreground">
                  <th className="py-2 px-3 w-10 text-center">#</th>
                  <th className="py-2 px-3 w-[26%]">Medicine Description</th>
                  <th className="py-2 px-3 w-[12%]">Batch</th>
                  <th className="py-2 px-3 w-[8%]">Exp</th>
                  <th className="py-2 px-3 w-[8%] text-right">Stock</th>
                  <th className="py-2 px-3 w-[24%] text-center font-bold text-foreground">Qty & Pack Unit (Strip / Tab)</th>
                  <th className="py-2 px-3 w-[11%] text-right">MRP (₹)</th>
                  <th className="py-2 px-3 w-[11%] text-right">Total (₹)</th>
                  <th className="py-2 px-3 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {cart.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-muted-foreground text-xs italic">
                      No medicines billed yet. Type medicine name in the search row below to inspect strengths and salt equivalents.
                    </td>
                  </tr>
                )}

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
                        </div>
                        <div className="text-[10px] text-muted-foreground ml-5 font-normal truncate">
                          {line.composition || line.genericName || 'General'}
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono font-medium text-foreground">
                        {line.batchNumber || 'AUTO'}
                      </td>
                      <td className="py-2 px-3 font-mono text-muted-foreground">
                        {formatExpDate(line.expiryDate)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                        {line.availableQuantity}
                      </td>

                      {/* SAME COLUMN: Strip vs Tablet indicator & cut stepper */}
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
                                (⇄ Strip)
                              </button>
                            </div>

                            <div className="flex items-center gap-1 bg-background/90 rounded px-1.5 py-0.5 border border-amber-500/30">
                              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">Cut:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = line.tabsCut || line.quantity || 1
                                  if (cur > 1) onSetCutTabs?.(line.productId, cur - 1)
                                }}
                                className="h-4 w-4 rounded flex items-center justify-center bg-muted hover:bg-amber-500/20 font-bold text-xs text-muted-foreground"
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
                                className="w-8 text-center font-mono font-bold text-xs bg-transparent border-0 p-0 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = line.tabsCut || line.quantity || 1
                                  onSetCutTabs?.(line.productId, cur + 1)
                                }}
                                className="h-4 w-4 rounded flex items-center justify-center bg-muted hover:bg-amber-500/20 font-bold text-xs text-muted-foreground"
                                title="Increase cut tablet count"
                              >
                                +
                              </button>
                              <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                                of {line.tabsPerStrip || 10} tabs
                              </span>
                            </div>
                            <span className="text-[9px] text-muted-foreground font-mono">
                              ₹{line.mrp.toFixed(2)}/tab
                            </span>
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
                                className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 hover:underline transition-colors"
                                title="Click to bill loose cut tablets from this strip"
                              >
                                ✂️ Cut?
                              </button>
                            </div>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="1"
                                value={line.quantity}
                                onChange={(e) =>
                                  onSetQuantity(line.productId, Math.max(1, parseInt(e.target.value) || 1))
                                }
                                className="w-12 rounded border border-emerald-500/40 bg-background px-1 py-0.5 text-center font-mono text-xs font-bold text-foreground focus:border-emerald-500 focus:outline-none"
                              />
                              <span className="text-[10px] font-medium text-emerald-800 dark:text-emerald-300 font-mono">
                                Strips
                              </span>
                            </div>
                            <span className="text-[9px] text-muted-foreground font-mono">
                              Pack: {line.tabsPerStrip || 10} tabs/st
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-2 px-3 text-right font-mono text-foreground">
                        <div className="font-bold">₹{line.mrp.toFixed(2)}</div>
                        <div className="text-[9px] text-muted-foreground font-normal">
                          {line.isTabletSale ? 'per tab' : 'per strip'}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                        ₹{pricing.totalAmount.toFixed(2)}
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

                {/* Active Search Row */}
                <tr className="bg-primary/[0.03] border-t-2 border-primary/40">
                  <td className="py-2 px-3 text-center font-mono font-bold text-primary">
                    {String(cart.length + 1).padStart(2, '0')}
                  </td>
                  <td className="py-2 px-3" colSpan={8}>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        ref={searchInputRef}
                        type="text"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value)
                          setSelectedStrengthIndex(0)
                        }}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="Search medicine or generic salt (e.g. Dolo, Azithral)... [Tab: switch to equivalents]"
                        className="h-8 border-primary/60 bg-background pl-8 text-xs font-medium focus-visible:ring-1 focus-visible:ring-primary shadow-2xs"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── Lower 42%: Anchored Sticky Salt Inspector Dock ──── */}
      <div className="flex-1 flex flex-col bg-card overflow-hidden">
        {/* Dock Header Bar */}
        <div className="flex flex-wrap items-center justify-between border-b bg-muted/70 px-4 py-1.5 text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="gap-1 bg-teal-600 text-[10px] font-bold">
              <Zap className="h-3 w-3" />
              INSPECTION DOCK
            </Badge>
            <span className="font-semibold text-foreground">
              Active Search:{' '}
              <span className="font-bold text-primary font-mono">
                {search ? `"${search}"` : 'None'}
              </span>
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground truncate max-w-sm">
              Generic Group:{' '}
              <strong className="text-foreground font-mono">{genericGroup}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">
              Active Focus:
            </span>
            <Badge
              variant={activePane === 'strengths' ? 'default' : 'outline'}
              className="text-[10px] cursor-pointer"
              onClick={() => setActivePane('strengths')}
            >
              Left Box: Strengths & Forms
            </Badge>
            <Badge
              variant={activePane === 'substitutes' ? 'default' : 'outline'}
              className="text-[10px] cursor-pointer"
              onClick={() => setActivePane('substitutes')}
            >
              Right Box: In-Stock Equivalents
            </Badge>
          </div>
        </div>

        {/* Dock Dual-Box Matrix View */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 overflow-hidden">
          {/* Left Box: Available Strengths & Forms for Requested Brand */}
          <div
            className={`flex flex-col rounded-xl border p-2.5 transition-all overflow-hidden ${
              activePane === 'strengths'
                ? 'border-primary bg-primary/[0.02] ring-1 ring-primary/40 shadow-xs'
                : 'border-border/70 bg-card/60'
            }`}
          >
            <div className="flex items-center justify-between border-b border-border/50 pb-1.5 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Pill className="h-3.5 w-3.5 text-primary" />
                Available Strengths & Forms
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {strengthMatches.length} variations
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {strengthMatches.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">
                  Type a brand name in the table above to view all dosage forms.
                </div>
              ) : (
                strengthMatches.map((item, idx) => {
                  const isSelected = activePane === 'strengths' && selectedStrengthIndex === idx
                  const isOos = item.availableQuantity <= 0

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedStrengthIndex(idx)
                        setActivePane('strengths')
                        if (!isOos) handleAddProduct(item)
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 font-semibold'
                          : 'border-border/50 bg-background hover:border-primary/40 hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1 py-0.5 rounded">
                          [{item.unitOfMeasure.slice(0, 3)}]
                        </span>
                        <span className="truncate font-medium text-foreground">{item.name}</span>
                        {item.rack && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            Rack: {formatRack(item.rack)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        {isOos ? (
                          <Badge variant="destructive" className="px-1.5 py-0 text-[10px] font-bold">
                            Stock: 0 (OOS) ❌
                          </Badge>
                        ) : (
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                            Stock: {item.availableQuantity}
                          </span>
                        )}
                        <span className="font-mono font-bold text-foreground">
                          {formatCurrency(item.mrp)}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Box: In-Stock Equivalents (Same Generic Formula) */}
          <div
            className={`flex flex-col rounded-xl border p-2.5 transition-all overflow-hidden ${
              activePane === 'substitutes'
                ? 'border-teal-500 bg-teal-500/[0.03] ring-1 ring-teal-500/40 shadow-xs'
                : 'border-border/70 bg-card/60'
            }`}
          >
            <div className="flex items-center justify-between border-b border-border/50 pb-1.5 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                In-Stock Equivalents (Same Formula)
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                (Press Tab to jump here)
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {loadingSubs ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Searching live database for salt substitutes...
                </div>
              ) : substitutes.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">
                  No generic equivalents with active branch stock found.
                </div>
              ) : (
                substitutes.map((sub, sIdx) => {
                  const isSelected = activePane === 'substitutes' && selectedSubIndex === sIdx

                  return (
                    <div
                      key={sub.id}
                      onClick={() => {
                        setSelectedSubIndex(sIdx)
                        setActivePane('substitutes')
                        handleAddSubstitute(sub)
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-teal-600 bg-teal-500/15 font-semibold ring-1 ring-teal-600/30'
                          : 'border-border/50 bg-background hover:border-teal-500/40 hover:bg-teal-500/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10px] uppercase font-bold text-teal-700 dark:text-teal-300 bg-teal-500/10 px-1 py-0.5 rounded">
                          [{sub.unitOfMeasure.slice(0, 3)}]
                        </span>
                        <div className="truncate">
                          <span className="font-medium text-foreground">{sub.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-1.5 font-normal">
                            | {sub.manufacturer}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        {sub.rack && (
                          <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1 rounded">
                            Rack: {formatRack(sub.rack)}
                          </span>
                        )}
                        <Badge
                          variant="secondary"
                          className="font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                        >
                          Stock: {sub.availableQuantity}
                        </Badge>
                        <span className="font-mono font-bold text-foreground">
                          {formatCurrency(sub.mrp)}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Action & Total Bar */}
        <div className="border-t bg-muted/40 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs">
            <span className="font-mono text-muted-foreground">
              Total Items: <strong className="text-foreground">{cart.length}</strong>
            </span>
            <span className="text-border/80">|</span>
            <span className="font-mono text-muted-foreground">
              Grand Total: <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">{formatCurrency(billTotals.totalAmount)}</strong>
            </span>
          </div>

          <Button
            size="sm"
            disabled={cart.length === 0}
            onClick={onFinalizeBill}
            className="h-8 px-5 font-bold shadow-xs bg-gradient-to-r from-teal-600 to-emerald-600 text-white"
          >
            Finalize Bill (F8)
          </Button>
        </div>
      </div>
    </div>
  )
}
