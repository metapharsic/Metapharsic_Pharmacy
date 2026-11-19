'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pill,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Percent,
  Calculator,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { ReviewBillItem } from './types'

export interface StripTabletPricingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ReviewBillItem[]
  onSavePricing: (updatedItems: ReviewBillItem[]) => void
}

/**
 * Extracts default tablets per strip from packSize string (e.g., '10X10 Alu Alu' -> 10, '10X15' -> 15, '10 Tablets' -> 10)
 */
function extractTabsFromPack(pack?: string): number {
  if (!pack) return 10
  const match = pack.match(/(\d+)\s*(?:x|\*|\/)\s*(\d+)/i)
  if (match) {
    const p2 = parseInt(match[2], 10)
    if (p2 > 0 && p2 <= 30) return p2
    const p1 = parseInt(match[1], 10)
    if (p1 > 0 && p1 <= 30) return p1
  }
  const singleMatch = pack.match(/(\d+)\s*(?:tab|cap|s\b|unit)/i)
  if (singleMatch) {
    const val = parseInt(singleMatch[1], 10)
    if (val > 0 && val <= 50) return val
  }
  return 10
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100
}

export function StripTabletPricingDialog({
  open,
  onOpenChange,
  items,
  onSavePricing,
}: StripTabletPricingDialogProps) {
  const [pricingItems, setPricingItems] = useState<ReviewBillItem[]>([])

  // Initialize or re-sync items when opened
  useEffect(() => {
    if (open && items.length > 0) {
      const initialized = items.map((it) => {
        const tabs = it.tabsPerStrip && it.tabsPerStrip > 0 ? it.tabsPerStrip : extractTabsFromPack(it.packSize)
        const stripPrice = it.stripSellingPrice && it.stripSellingPrice > 0 ? it.stripSellingPrice : it.mrp || round2(it.unitCost * 1.25)
        const tabCost = it.tabletCost && it.tabletCost > 0 ? it.tabletCost : round2(it.unitCost / tabs)
        const tabPrice = it.tabletSellingPrice && it.tabletSellingPrice > 0 ? it.tabletSellingPrice : round2(stripPrice / tabs)

        return {
          ...it,
          tabsPerStrip: tabs,
          stripSellingPrice: stripPrice,
          tabletCost: tabCost,
          tabletSellingPrice: tabPrice,
        }
      })
      setPricingItems(initialized)
    }
  }, [open, items])

  const handleTabsChange = (index: number, newTabs: number) => {
    setPricingItems((prev) => {
      const next = [...prev]
      const current = next[index]
      const tabs = Math.max(1, newTabs)
      const tabCost = round2(current.unitCost / tabs)
      const tabPrice = round2((current.stripSellingPrice || current.mrp) / tabs)

      next[index] = {
        ...current,
        tabsPerStrip: tabs,
        tabletCost: tabCost,
        tabletSellingPrice: tabPrice,
      }
      return next
    })
  }

  const handleStripPriceChange = (index: number, newStripPrice: number) => {
    setPricingItems((prev) => {
      const next = [...prev]
      const current = next[index]
      const stripPrice = Math.max(0, newStripPrice)
      const tabs = current.tabsPerStrip || 10
      const tabPrice = round2(stripPrice / tabs)

      next[index] = {
        ...current,
        stripSellingPrice: stripPrice,
        tabletSellingPrice: tabPrice,
      }
      return next
    })
  }

  const handleTabletPriceChange = (index: number, newTabPrice: number) => {
    setPricingItems((prev) => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        tabletSellingPrice: Math.max(0, newTabPrice),
      }
      return next
    })
  }

  // Bulk actions
  const applyMatchMrp = () => {
    setPricingItems((prev) =>
      prev.map((it) => {
        const tabs = it.tabsPerStrip || 10
        const stripPrice = it.mrp
        return {
          ...it,
          stripSellingPrice: stripPrice,
          tabletSellingPrice: round2(stripPrice / tabs),
        }
      })
    )
  }

  const applyRoundToNearestRupee = () => {
    setPricingItems((prev) =>
      prev.map((it) => ({
        ...it,
        tabletSellingPrice: Math.ceil(it.tabletSellingPrice || 1),
      }))
    )
  }

  const applyLooseTabletMarkup = (markupPercent: number) => {
    setPricingItems((prev) =>
      prev.map((it) => {
        const tabs = it.tabsPerStrip || 10
        const baseTab = (it.stripSellingPrice || it.mrp) / tabs
        const markedUp = round2(baseTab * (1 + markupPercent / 100))
        return {
          ...it,
          tabletSellingPrice: markedUp,
        }
      })
    )
  }

  const handleConfirm = () => {
    onSavePricing(pricingItems)
    onOpenChange(false)
  }

  const totalCalculatedRevenue = useMemo(() => {
    return pricingItems.reduce(
      (acc, it) => acc + (it.stripSellingPrice || it.mrp) * (it.billedQuantity + (it.freeQuantity || 0)),
      0
    )
  }, [pricingItems])

  const totalCost = useMemo(() => {
    return pricingItems.reduce((acc, it) => acc + it.unitCost * it.billedQuantity, 0)
  }, [pricingItems])

  const overallGrossMargin = totalCost > 0 ? round2(((totalCalculatedRevenue - totalCost) / totalCost) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-6 max-h-[90vh] flex flex-col">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border/60">
          <div className="flex items-center gap-2 text-primary">
            <Pill className="h-5 w-5" />
            <DialogTitle className="text-lg font-bold">
              Set Sales Price: Full Strip &amp; 1-Tablet Unit Cost
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure retail selling prices and tablet fractional pricing for each scanned medicine.
            These values automatically link to POS touchscreen dispensing and profit intelligence.
          </DialogDescription>
        </DialogHeader>

        {/* Bulk Action Controls */}
        <div className="my-2 p-3 rounded-lg bg-muted/40 border border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Quick Pricing Shortcuts:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyMatchMrp}
              className="h-7 text-[11px] px-2.5"
            >
              Match Scanned MRP
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyRoundToNearestRupee}
              className="h-7 text-[11px] px-2.5"
            >
              Round Tab to Nearest ₹1
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyLooseTabletMarkup(10)}
              className="h-7 text-[11px] px-2.5 text-emerald-600 dark:text-emerald-400"
            >
              +10% Loose Tab Premium
            </Button>
          </div>
        </div>

        {/* Pricing Matrix Table */}
        <div className="flex-1 overflow-auto rounded-md border border-border/80">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10 text-[11px]">
              <TableRow>
                <TableHead className="w-[200px]">Medicine Description</TableHead>
                <TableHead className="w-[85px] text-center">Tabs/Strip</TableHead>
                <TableHead className="w-[100px] text-right">Cost (PTR)</TableHead>
                <TableHead className="w-[100px] text-right">Scanned MRP</TableHead>
                <TableHead className="w-[120px] text-right">Strip Sales Price</TableHead>
                <TableHead className="w-[100px] text-right">1-Tab Cost</TableHead>
                <TableHead className="w-[120px] text-right">1-Tab Sales Price</TableHead>
                <TableHead className="w-[85px] text-center">Tab Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {pricingItems.map((item, idx) => {
                const tabCost = item.tabletCost || round2(item.unitCost / (item.tabsPerStrip || 10))
                const tabPrice = item.tabletSellingPrice || round2((item.stripSellingPrice || item.mrp) / (item.tabsPerStrip || 10))
                const tabMargin = tabCost > 0 ? round2(((tabPrice - tabCost) / tabCost) * 100) : 0
                const stripMargin = item.unitCost > 0 ? round2((((item.stripSellingPrice || item.mrp) - item.unitCost) / item.unitCost) * 100) : 0

                return (
                  <TableRow key={item.id || idx} className="hover:bg-muted/20">
                    <TableCell className="py-2">
                      <div className="font-semibold text-foreground leading-tight truncate max-w-[200px]" title={item.productName}>
                        {item.productName}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5 mt-0.5">
                        <span>Batch: {item.batchNumber || 'N/A'}</span>
                        <span>•</span>
                        <span>Pack: {item.packSize || '10s'}</span>
                      </div>
                    </TableCell>

                    {/* Tablets per strip */}
                    <TableCell className="py-2 text-center">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={item.tabsPerStrip || 10}
                        onChange={(e) => handleTabsChange(idx, parseInt(e.target.value, 10) || 1)}
                        className="h-7 w-16 text-center font-mono text-xs mx-auto px-1"
                      />
                    </TableCell>

                    {/* Purchase Cost (PTR) */}
                    <TableCell className="py-2 text-right font-mono text-muted-foreground">
                      ₹{item.unitCost.toFixed(2)}
                    </TableCell>

                    {/* Scanned MRP */}
                    <TableCell className="py-2 text-right font-mono text-muted-foreground">
                      ₹{item.mrp.toFixed(2)}
                    </TableCell>

                    {/* Strip Sales Price */}
                    <TableCell className="py-2 text-right">
                      <div className="flex flex-col items-end">
                        <div className="relative w-24">
                          <span className="absolute left-1.5 top-1.5 text-[10px] text-muted-foreground">₹</span>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={item.stripSellingPrice ?? item.mrp}
                            onChange={(e) => handleStripPriceChange(idx, parseFloat(e.target.value) || 0)}
                            className="h-7 w-24 text-right font-mono text-xs pl-4 pr-1.5 font-semibold text-foreground"
                          />
                        </div>
                        <span className="text-[9px] text-muted-foreground mt-0.5 font-mono">
                          +{stripMargin.toFixed(1)}% margin
                        </span>
                      </div>
                    </TableCell>

                    {/* 1-Tablet Cost Basis */}
                    <TableCell className="py-2 text-right font-mono text-xs text-muted-foreground">
                      ₹{tabCost.toFixed(2)}
                    </TableCell>

                    {/* 1-Tablet Sales Price */}
                    <TableCell className="py-2 text-right">
                      <div className="relative w-24 ml-auto">
                        <span className="absolute left-1.5 top-1.5 text-[10px] text-muted-foreground">₹</span>
                        <Input
                          type="number"
                          step="0.05"
                          min={0}
                          value={item.tabletSellingPrice ?? tabPrice}
                          onChange={(e) => handleTabletPriceChange(idx, parseFloat(e.target.value) || 0)}
                          className="h-7 w-24 text-right font-mono text-xs pl-4 pr-1.5 font-bold text-primary"
                        />
                      </div>
                    </TableCell>

                    {/* Tablet Margin % Badge */}
                    <TableCell className="py-2 text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-mono px-1.5 py-0.5',
                          tabMargin >= 20
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                            : tabMargin > 0
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                        )}
                      >
                        +{tabMargin.toFixed(0)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {/* Summary Footer */}
        <div className="pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-muted-foreground">
            <div>
              Total Products: <strong className="text-foreground">{pricingItems.length}</strong>
            </div>
            <div>
              Est. Batch Revenue: <strong className="font-mono text-foreground">₹{totalCalculatedRevenue.toFixed(2)}</strong>
            </div>
            <div>
              Gross Return: <strong className="font-mono text-emerald-600 dark:text-emerald-400">+{overallGrossMargin}%</strong>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Apply Pricing &amp; Proceed</span>
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

