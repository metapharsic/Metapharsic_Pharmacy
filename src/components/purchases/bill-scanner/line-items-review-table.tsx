'use client'

import {
  Package,
  Plus,
  ShoppingCart,
  Pill,
  Maximize2,
  Minimize2,
  FileSpreadsheet,
} from 'lucide-react'
import React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils/cn'

import { LineItemRowEditor } from './line-item-row-editor'
import {
  computeLineItemAmounts,
  type MasterProduct,
  type ReviewBillItem,
} from './types'

export interface LineItemsReviewTableProps {
  items: ReviewBillItem[]
  products: MasterProduct[]
  onChangeItems: (items: ReviewBillItem[]) => void
  onOpenPricing?: () => void
  onExportExcel?: () => void
  isExpanded?: boolean
  onToggleExpand?: () => void
  disabled?: boolean
  className?: string
}

export function LineItemsReviewTable({
  items,
  products,
  onChangeItems,
  onOpenPricing,
  onExportExcel,
  isExpanded = false,
  onToggleExpand,
  disabled = false,
  className,
}: LineItemsReviewTableProps) {
  const handleItemChange = (index: number, updatedItem: ReviewBillItem) => {
    const next = [...items]
    next[index] = updatedItem
    onChangeItems(next)
  }

  const handleItemDelete = (index: number) => {
    const next = items.filter((_, i) => i !== index)
    onChangeItems(next)
  }

  const handleAddItem = () => {
    const defaultProduct = products[0]
    const unitCost = defaultProduct?.ptr || defaultProduct?.costPrice || 100
    const mrp = defaultProduct?.mrp || 120
    const taxPercent = defaultProduct?.gstRate || 5
    const { taxAmount, totalAmount } = computeLineItemAmounts({
      billedQuantity: 1,
      unitCost,
      discountPercent: 0,
      taxPercent,
    })

    const newItem: ReviewBillItem = {
      id: `manual-item-${Date.now()}`,
      productId: `NEW_PRODUCT_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productName: 'New Medicine',
      rawDescription: 'New Medicine',
      sku: defaultProduct?.sku || '10 Tablets',
      batchNumber: '',
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      billedQuantity: 1,
      freeQuantity: 0,
      unitCost,
      mrp,
      ptr: unitCost,
      discountPercent: 0,
      taxPercent,
      taxAmount,
      totalAmount,
      matchConfidence: 1.0,
      isNewProduct: true,
    }

    onChangeItems([...items, newItem])
  }

  const totalBilledUnits = items.reduce((acc, it) => acc + (it.billedQuantity || 0), 0)
  const totalFreeUnits = items.reduce((acc, it) => acc + (it.freeQuantity || 0), 0)
  const totalUsableUnits = totalBilledUnits + totalFreeUnits

  return (
    <Card className={cn('border border-border/80 shadow-sm bg-card overflow-hidden', className)}>
      <CardHeader className="py-3 px-4 border-b border-border/60 bg-muted/30 space-y-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold text-foreground">
              Extracted Line Items ({items.length})
            </CardTitle>
            <div className="flex items-center gap-1.5 ml-2">
              <Badge variant="outline" className="text-xs font-mono font-bold">
                {totalBilledUnits} Billed
              </Badge>
              {totalFreeUnits > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-bold"
                >
                  +{totalFreeUnits} Free Goods
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs font-mono font-bold">
                {totalUsableUnits} Total Units
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onToggleExpand && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onToggleExpand}
                className="h-8 gap-1.5 text-xs font-medium text-foreground hover:bg-muted"
                title={isExpanded ? 'Switch to split side-by-side view' : 'Expand review table to full width'}
              >
                {isExpanded ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5 text-primary" />
                    <span>Split View</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5 text-primary" />
                    <span>Full Width Mode</span>
                  </>
                )}
              </Button>
            )}
            {onExportExcel && items.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onExportExcel}
                disabled={disabled}
                className="h-8 gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 font-medium"
                title="Export extracted invoice line items to Excel (.xlsx)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Export Excel</span>
              </Button>
            )}
            {onOpenPricing && items.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenPricing}
                disabled={disabled}
                className="h-8 gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10 font-medium"
              >
                <Pill className="h-3.5 w-3.5 text-primary" />
                <span>Strip &amp; Tab Pricing</span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              disabled={disabled}
              className="h-8 gap-1 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Line Item</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto w-full table-scroll-container">
          <Table className="min-w-[748px] w-full text-xs">
            <TableHeader className="bg-muted/70 border-b border-border/80 sticky top-0 z-10 backdrop-blur-sm">
              <TableRow className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <TableHead className="w-7 min-w-[28px] text-center px-0.5 py-2">#</TableHead>
                <TableHead className="min-w-[170px] px-1 py-2 font-bold text-foreground">Medicine / Product</TableHead>
                <TableHead className="w-18 min-w-[72px] px-0.5 py-2">Batch #</TableHead>
                <TableHead className="w-24 min-w-[96px] px-0.5 py-2">Expiry</TableHead>
                <TableHead className="w-12 min-w-[48px] px-0.5 py-2 text-center">Billed Qty</TableHead>
                <TableHead className="w-11 min-w-[44px] px-0.5 py-2 text-center text-emerald-700 dark:text-emerald-400">Free</TableHead>
                <TableHead className="w-16 min-w-[64px] px-0.5 py-2 text-center">PTR (₹)</TableHead>
                <TableHead className="w-16 min-w-[64px] px-0.5 py-2 text-center">MRP (₹)</TableHead>
                <TableHead className="w-12 min-w-[46px] px-0.5 py-2 text-center">Disc %</TableHead>
                <TableHead className="w-14 min-w-[54px] px-0.5 py-2 text-center">GST</TableHead>
                <TableHead className="w-20 min-w-[76px] px-1 py-2 text-right font-bold text-foreground">Line Total</TableHead>
                <TableHead className="w-7 min-w-[28px] text-center px-0.5 py-2"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <td colSpan={12} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <ShoppingCart className="h-8 w-8 text-muted-foreground/40 stroke-1" />
                      <p className="text-sm font-medium">No line items extracted</p>
                      <p className="text-xs text-muted-foreground">
                        Upload a purchase invoice or click &quot;Add Line Item&quot; to manually enter items.
                      </p>
                    </div>
                  </td>
                </TableRow>
              ) : (
                items.map((item, idx) => (
                  <LineItemRowEditor
                    key={item.id || `item-${idx}`}
                    item={item}
                    index={idx}
                    products={products}
                    onChange={(updated) => handleItemChange(idx, updated)}
                    onDelete={() => handleItemDelete(idx)}
                    disabled={disabled}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
