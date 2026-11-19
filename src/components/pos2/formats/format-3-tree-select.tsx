'use client'

import { format, isValid, parseISO } from 'date-fns'
import {
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  Barcode,
  Camera,
  Folder,
  FolderOpen,
  GitBranch,
  GitFork,
  Pill,
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

interface TreeNode {
  id: string
  label: string
  sublabel?: string
  brandGroup?: string
  manufacturer?: string
  batchNumber?: string
  stock: number
  mrp: number
  isOos: boolean
  isParent?: boolean
  product?: PosProductRow
  substitute?: any
  children?: TreeNode[]
}

export function Format3TreeSelect({
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
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [substitutesMap, setSubstitutesMap] = useState<Record<string, any[]>>({})
  const [focusedIndex, setFocusedIndex] = useState(0)

  const searchRef = useRef<HTMLInputElement>(null)
  const treeContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Fetch generic substitutes for any OOS products in products list
  useEffect(() => {
    const oosProducts = products.filter((p) => p.availableQuantity <= 0)
    if (oosProducts.length === 0) return

    oosProducts.forEach((p) => {
      const generic = p.genericName || p.composition?.split(' ')[0]
      if (!generic || substitutesMap[p.id]) return

      const strengthMatch = (p.name + ' ' + (p.composition || '')).match(/\d+\s*(?:mg|ml|g)/i)
      const strength = strengthMatch ? strengthMatch[0] : ''

      const url = `/api/pos/substitutes?genericName=${encodeURIComponent(generic)}&excludeProductId=${p.id}&strength=${encodeURIComponent(strength)}&branchId=${branchId || ''}`

      fetch(url, { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setSubstitutesMap((prev) => ({ ...prev, [p.id]: data.data || [] }))
          }
        })
        .catch(() => {})
    })
  }, [products, branchId, substitutesMap])

  // Group matching products into Brand -> Variants tree
  const treeData = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []

    // Filter matching products by name, generic, composition, sku, and barcode
    const filtered = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.genericName?.toLowerCase().includes(q) ||
        p.composition?.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.additionalBarcodes?.some((b) => b.toLowerCase().includes(q))
    )

    // Group by Brand prefix (e.g. "DOLO", "AUGMENTIN", "CALPOL", "PAN")
    const brandMap = new Map<string, PosProductRow[]>()
    filtered.forEach((p) => {
      const brandKey = p.name.split(' ')[0].toUpperCase()
      const list = brandMap.get(brandKey) || []
      list.push(p)
      brandMap.set(brandKey, list)
    })

    const nodes: TreeNode[] = []

    brandMap.forEach((brandProds, brandName) => {
      const manufacturer = brandProds[0]?.manufacturer || 'Pharma'
      const parentNode: TreeNode = {
        id: `brand-${brandName}`,
        label: `${brandName} (${manufacturer})`,
        isParent: true,
        stock: brandProds.reduce((sum, p) => sum + p.availableQuantity, 0),
        mrp: 0,
        isOos: brandProds.every((p) => p.availableQuantity <= 0),
        children: [],
      }

      brandProds.forEach((p) => {
        const fefoBatch = p.batches && p.batches.length > 0 ? p.batches[0] : null
        const isOos = p.availableQuantity <= 0
        const subList = substitutesMap[p.id] || []

        const childNode: TreeNode = {
          id: p.id,
          label: p.name,
          sublabel: p.composition || p.genericName || undefined,
          batchNumber: fefoBatch?.batchNumber ?? 'AUTO',
          stock: p.availableQuantity,
          mrp: p.mrp,
          isOos,
          product: p,
          children: isOos && subList.length > 0
            ? subList.map((sub) => ({
                id: `sub-${sub.id}`,
                label: sub.name,
                sublabel: `Similar Formula: ${sub.composition || sub.genericName} (${sub.manufacturer})`,
                batchNumber: sub.batch?.batchNumber ?? 'AUTO',
                stock: sub.availableQuantity,
                mrp: sub.mrp,
                isOos: false,
                substitute: sub,
              }))
            : undefined,
        }

        parentNode.children!.push(childNode)
      })

      nodes.push(parentNode)
    })

    return nodes
  }, [products, search, substitutesMap])

  // Flattened selectable items for keyboard navigation
  const flatSelectables = useMemo(() => {
    const list: TreeNode[] = []
    treeData.forEach((brandNode) => {
      if (!collapsedGroups[brandNode.id]) {
        brandNode.children?.forEach((child) => {
          list.push(child)
          if (child.children) {
            child.children.forEach((sub) => list.push(sub))
          }
        })
      }
    })
    return list
  }, [treeData, collapsedGroups])

  // Handle selecting a leaf node
  const handleSelectLeaf = useCallback(
    (node: TreeNode) => {
      if (node.isParent) return

      if (node.product) {
        if (node.isOos) return // Can't select zero stock directly
        const fefo = node.product.batches && node.product.batches.length > 0 ? node.product.batches[0] : undefined
        onAddToCart(node.product, fefo, 1, 0)
      } else if (node.substitute) {
        const sub = node.substitute
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
      }

      setSearch('')
      setFocusedIndex(0)
      setTimeout(() => {
        searchRef.current?.focus()
      }, 50)
    },
    [products, onAddToCart]
  )

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((prev) => Math.min(prev + 1, Math.max(0, flatSelectables.length - 1)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((prev) => Math.max(0, prev - 1))
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
          onAddToCart(exactBarcode, undefined, 1, 0)
          setSearch('')
          setFocusedIndex(0)
          return
        }
      }
      if (flatSelectables[focusedIndex]) {
        handleSelectLeaf(flatSelectables[focusedIndex])
      }
      return
    }
    if (e.key === 'Escape') {
      setSearch('')
      return
    }
  }

  // Toggle collapsing brand
  const toggleCollapse = (brandId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [brandId]: !prev[brandId] }))
  }

  // Calculate bill totals
  const billTotals = computeCartTotals(cart)

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden">
      {/* ─── Top Info Bar ───────────────────────────────────── */}
      <div className="flex items-center justify-between border-b bg-card px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <GitBranch className="h-3.5 w-3.5" />
          </span>
          <span className="font-bold text-foreground uppercase tracking-wider">
            Format 3: Nested Tree-Select ComboBox
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
            Brand → Dosage/Strength → Generic Substitutes hierarchy
          </div>
        </div>
      </div>

      {/* ─── Main Content Grid ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 relative">
        <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-visible">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/70 bg-muted/30 font-semibold text-muted-foreground">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 w-[45%]">Item Name (Tree ComboBox)</th>
                <th className="py-2.5 px-3 w-[15%]">Batch</th>
                <th className="py-2.5 px-3 w-[10%] text-right">Stock</th>
                <th className="py-2.5 px-3 w-[10%] text-right">Qty</th>
                <th className="py-2.5 px-3 w-[10%] text-right">MRP (₹)</th>
                <th className="py-2.5 px-3 w-[10%] text-right">Total (₹)</th>
                <th className="py-2.5 px-3 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {/* Existing Cart Items */}
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
                    <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                      {line.availableQuantity}
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

              {/* Active Row with Tree Select ComboBox */}
              <tr className="bg-primary/[0.02] border-t-2 border-primary/40 relative">
                <td className="py-2.5 px-3 text-center font-mono font-bold text-primary">
                  {String(cart.length + 1).padStart(2, '0')}
                </td>

                {/* Tree Search ComboBox Cell */}
                <td className="py-2.5 px-3 relative" colSpan={7}>
                  <div className="relative">
                    <div className="relative flex items-center">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        ref={searchRef}
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="Type brand, salt or scan barcode (e.g. dolo)..."
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

                    {/* ─── NESTED TREE DROPDOWN OVERLAY ─── */}
                    {search.trim().length > 0 && treeData.length > 0 && (
                      <div
                        ref={treeContainerRef}
                        className="absolute left-0 top-full z-50 mt-1 w-full max-w-2xl rounded-xl border border-border/90 bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                      >
                        <div className="border-b bg-muted/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <GitFork className="h-3 w-3 text-primary" />
                            Hierarchical Brand Variants & Salts
                          </span>
                          <span className="font-mono text-[9px]">Click node or press Enter to pick</span>
                        </div>

                        <div className="max-h-72 overflow-y-auto p-2 space-y-2">
                          {treeData.map((brand) => {
                            const isCollapsed = collapsedGroups[brand.id]
                            return (
                              <div key={brand.id} className="rounded-lg border border-border/60 bg-background/50 overflow-hidden">
                                {/* Parent Brand Header Node */}
                                <div
                                  onClick={() => toggleCollapse(brand.id)}
                                  className="flex items-center justify-between px-3 py-1.5 bg-muted/40 cursor-pointer hover:bg-muted/70 transition-colors font-bold text-xs"
                                >
                                  <div className="flex items-center gap-1.5 text-foreground">
                                    {isCollapsed ? (
                                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                    ) : (
                                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                    <span>▼ {brand.label}</span>
                                  </div>
                                  <Badge variant="outline" className="text-[10px] font-mono">
                                    {brand.children?.length} variants
                                  </Badge>
                                </div>

                                {/* Child Nodes */}
                                {!isCollapsed && (
                                  <div className="p-1 space-y-1">
                                    {brand.children?.map((child, cIdx) => {
                                      const isLeafFocused = flatSelectables[focusedIndex]?.id === child.id

                                      return (
                                        <div key={child.id} className="space-y-1">
                                          <div
                                            onClick={() => handleSelectLeaf(child)}
                                            className={`flex items-center justify-between px-3 py-1.5 rounded text-xs transition-all ${
                                              child.isOos
                                                ? 'bg-muted/30 text-muted-foreground opacity-75'
                                                : isLeafFocused
                                                ? 'bg-primary/15 text-foreground font-semibold border border-primary/50'
                                                : 'hover:bg-muted/50 cursor-pointer'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 pl-2">
                                              <span className="text-muted-foreground font-mono">├─</span>
                                              <span className="font-medium text-foreground">{child.label}</span>
                                              {child.isOos && (
                                                <Badge variant="destructive" className="px-1 py-0 text-[9px]">
                                                  Out of Stock
                                                </Badge>
                                              )}
                                            </div>

                                            <div className="flex items-center gap-4 font-mono text-xs">
                                              <span className="text-muted-foreground">
                                                Batch: {child.batchNumber}
                                              </span>
                                              <span
                                                className={
                                                  child.isOos
                                                    ? 'text-destructive font-bold'
                                                    : 'text-emerald-600 dark:text-emerald-400 font-bold'
                                                }
                                              >
                                                Stock: {child.stock}
                                              </span>
                                              <span className="font-bold text-foreground">
                                                {formatCurrency(child.mrp)}
                                              </span>
                                            </div>
                                          </div>

                                          {/* Nested Generic Substitutes if Out of Stock */}
                                          {child.children && child.children.length > 0 && (
                                            <div className="ml-6 pl-3 border-l-2 border-dashed border-teal-500/50 py-1 space-y-1 bg-teal-500/[0.03] rounded-r">
                                              <div className="text-[10px] font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1">
                                                <Zap className="h-3 w-3 text-teal-600" />
                                                ↳ Similar Formula (Generic Equivalents):
                                              </div>

                                              {child.children.map((sub) => {
                                                const isSubFocused = flatSelectables[focusedIndex]?.id === sub.id
                                                return (
                                                  <div
                                                    key={sub.id}
                                                    onClick={() => handleSelectLeaf(sub)}
                                                    className={`flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer transition-all ${
                                                      isSubFocused
                                                        ? 'bg-teal-500/20 text-foreground font-semibold border border-teal-500/50'
                                                        : 'hover:bg-teal-500/10'
                                                    }`}
                                                  >
                                                    <div className="flex items-center gap-1.5">
                                                      <span className="text-teal-600 font-bold">•</span>
                                                      <span className="font-medium text-foreground">{sub.label}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 font-mono text-xs">
                                                      <span className="text-muted-foreground">
                                                        {sub.batchNumber}
                                                      </span>
                                                      <Badge
                                                        variant="secondary"
                                                        className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono text-[10px]"
                                                      >
                                                        Stock: {sub.stock}
                                                      </Badge>
                                                      <span className="font-bold text-foreground">
                                                        {formatCurrency(sub.mrp)}
                                                      </span>
                                                    </div>
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
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
          className="h-9 px-6 font-bold shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          Checkout Bill (F8)
        </Button>
      </div>
    </div>
  )
}
