'use client'

import {
  Clock,
  Trash2,
} from 'lucide-react'
import React, { useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/ui/searchable-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils/cn'

import {
  computeLineItemAmounts,
  isShortExpiryDate,
  type MasterProduct,
  type ReviewBillItem,
} from './types'

export interface LineItemRowEditorProps {
  item: ReviewBillItem
  index: number
  products: MasterProduct[]
  onChange: (updated: ReviewBillItem) => void
  onDelete: () => void
  disabled?: boolean
}

const GST_SLABS = [
  { value: '0', label: '0%' },
  { value: '5', label: '5%' },
  { value: '12', label: '12%' },
  { value: '18', label: '18%' },
  { value: '28', label: '28%' },
]

export function LineItemRowEditor({
  item,
  index,
  products,
  onChange,
  onDelete,
  disabled = false,
}: LineItemRowEditorProps) {
  // Always resolve the non-empty human-readable medicine name from OCR or matched product
  const effectiveName = useMemo(() => {
    const raw = item.productName || item.rawDescription || `Medicine-${index + 1}`
    return String(raw).trim()
  }, [item.productName, item.rawDescription, index])

  // Strictly match against catalog products: require name similarity or exact ID with name confirmation
  const matchedCatalogProduct = useMemo(() => {
    if (!products || products.length === 0) return undefined
    const normEffective = effectiveName.toLowerCase()

    // 1. Exact name match
    const byName = products.find((p) => p.name && p.name.trim().toLowerCase() === normEffective)
    if (byName) return byName

    // 2. If item.productId matches a catalog product, confirm name isn't completely foreign
    if (item.productId && !item.productId.startsWith('NEW_PRODUCT_') && !item.productId.startsWith('prod-auto-')) {
      const byId = products.find((p) => p.id === item.productId)
      if (byId) {
        const byIdNorm = byId.name.trim().toLowerCase()
        if (byIdNorm === normEffective || byIdNorm.includes(normEffective) || normEffective.includes(byIdNorm)) {
          return byId
        }
      }
    }

    return undefined
  }, [products, item.productId, effectiveName])

  // Selected value to feed into SearchableSelect:
  // If matched to an existing catalog product, use catalog ID.
  // Otherwise, ALWAYS use the effectiveName so the medicine name is 100% visible in the box!
  const selectedValue = useMemo(() => {
    if (matchedCatalogProduct) {
      return matchedCatalogProduct.id
    }
    return effectiveName
  }, [matchedCatalogProduct, effectiveName])

  // Convert master products to SearchableSelect options, ALWAYS ensuring the item's name is in the list
  const productOptions = useMemo<SearchableSelectOption[]>(() => {
    const list: SearchableSelectOption[] = products.map((p) => ({
      value: p.id,
      label: p.name,
      sublabel: `SKU: ${p.sku} • MRP: ₹${p.mrp.toFixed(2)}${p.ptr ? ` • PTR: ₹${p.ptr.toFixed(2)}` : ''}`,
      badge: p.unitOfMeasure,
      badgeVariant: 'secondary',
      keywords: [p.sku, p.name],
    }))

    // If this item is not already matched to an existing catalog product, prepend it as an active option!
    if (effectiveName && !matchedCatalogProduct) {
      list.unshift({
        value: effectiveName,
        label: effectiveName,
        sublabel: item.isNewProduct ? 'Auto-Provision to Inventory' : 'Extracted from Invoice',
        badge: item.matchConfidence && item.matchConfidence >= 0.75 ? 'From Bill' : 'New Item',
        badgeVariant: 'outline',
        keywords: [effectiveName],
      })
    }

    return list
  }, [products, effectiveName, matchedCatalogProduct, item.isNewProduct, item.matchConfidence])

  // Calculate reliable PTR / Unit Cost
  const displayUnitCost = useMemo(() => {
    if (item.unitCost !== undefined && item.unitCost > 0) return item.unitCost
    if (item.ptr !== undefined && item.ptr > 0) return item.ptr
    if (item.totalAmount > 0) {
      const qty = item.billedQuantity > 0 ? item.billedQuantity : 1
      const tax = item.taxPercent || 0
      return Math.round((item.totalAmount / (qty * (1 + tax / 100))) * 100) / 100
    }
    if (item.mrp > 0) return Math.round((item.mrp / 1.25) * 100) / 100
    return 0
  }, [item.unitCost, item.ptr, item.totalAmount, item.billedQuantity, item.taxPercent, item.mrp])

  // Calculate reliable MRP
  const displayMrp = useMemo(() => {
    if (item.mrp !== undefined && item.mrp > 0) return item.mrp
    if (item.stripSellingPrice !== undefined && item.stripSellingPrice > 0) return item.stripSellingPrice
    if (displayUnitCost > 0) return Math.round(displayUnitCost * 1.25 * 100) / 100
    return 0
  }, [item.mrp, item.stripSellingPrice, displayUnitCost])

  const handleProductSelect = (selectedIdOrName: string) => {
    const matched = products.find(
      (p) => p.id === selectedIdOrName || p.name.trim().toLowerCase() === selectedIdOrName.trim().toLowerCase()
    )
    if (matched) {
      const unitCost = item.unitCost > 0 ? item.unitCost : (matched.ptr || matched.costPrice || displayUnitCost)
      const mrp = item.mrp > 0 ? item.mrp : (matched.mrp || displayMrp)
      const taxPercent = item.taxPercent > 0 ? item.taxPercent : (matched.gstRate || 5)
      const { taxAmount, totalAmount } = computeLineItemAmounts({
        billedQuantity: item.billedQuantity || 1,
        unitCost,
        discountPercent: item.discountPercent || 0,
        taxPercent,
      })

      onChange({
        ...item,
        productId: matched.id,
        productName: matched.name,
        rawDescription: item.rawDescription || matched.name,
        sku: matched.sku,
        unitCost,
        mrp,
        ptr: unitCost,
        taxPercent,
        taxAmount,
        totalAmount: item.totalAmount > 0 ? item.totalAmount : totalAmount,
        isNewProduct: false,
        matchConfidence: 1.0,
      })
    } else {
      // Selected custom or extracted name: preserve exact name and prepare for auto-catalog creation
      const cleanName = selectedIdOrName.trim()
      onChange({
        ...item,
        productId: `NEW_PRODUCT_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        productName: cleanName,
        rawDescription: cleanName,
        isNewProduct: true,
      })
    }
  }

  // Recalculate financial fields whenever quantity, cost, discount, or tax change
  const handleFieldChange = <K extends keyof ReviewBillItem>(field: K, value: ReviewBillItem[K]) => {
    const updated: ReviewBillItem = { ...item, [field]: value }

    const currentCost = field === 'unitCost' ? Number(value) : (Number(updated.unitCost) > 0 ? Number(updated.unitCost) : displayUnitCost)
    updated.unitCost = currentCost
    updated.ptr = currentCost

    const currentMrp = field === 'mrp' ? Number(value) : (Number(updated.mrp) > 0 ? Number(updated.mrp) : displayMrp)
    updated.mrp = currentMrp
    updated.stripSellingPrice = currentMrp

    if (
      field === 'billedQuantity' ||
      field === 'unitCost' ||
      field === 'discountPercent' ||
      field === 'taxPercent'
    ) {
      const { taxAmount, totalAmount } = computeLineItemAmounts({
        billedQuantity: Number(updated.billedQuantity) || 0,
        unitCost: currentCost,
        discountPercent: Number(updated.discountPercent) || 0,
        taxPercent: Number(updated.taxPercent) || 0,
      })
      updated.taxAmount = taxAmount
      updated.totalAmount = totalAmount
    }

    if (field === 'expiryDate') {
      updated.isShortExpiry = isShortExpiryDate(typeof value === 'string' ? value : '')
    }

    onChange(updated)
  }

  const isShortExpiry = item.isShortExpiry || isShortExpiryDate(item.expiryDate)
  const isLowConfidence = item.matchConfidence < 0.75

  return (
    <TableRow
      className={cn(
        'transition-colors text-xs hover:bg-muted/30 border-b border-border/50',
        isLowConfidence && 'bg-amber-500/5',
        isShortExpiry && 'bg-rose-500/5'
      )}
    >
      {/* 1. Item Index */}
      <TableCell className="w-7 min-w-[28px] text-center font-mono text-muted-foreground px-0.5 py-1 text-xs font-semibold">
        {index + 1}
      </TableCell>

      {/* 2. Product Selection & Matching */}
      <TableCell className="min-w-[170px] px-1 py-1 space-y-0.5">
        <SearchableSelect
          value={selectedValue}
          onChange={handleProductSelect}
          options={productOptions}
          placeholder="Search catalog medicine..."
          searchPlaceholder="Search medicine by name or SKU..."
          emptyMessage="No medicine found. Enter name to add."
          allowCustom={true}
          customLabelPrefix="Custom Medicine:"
          disabled={disabled}
          className="h-7 text-xs w-full font-semibold bg-background"
        />

        <div className="flex flex-wrap items-center gap-1">
          {item.matchConfidence !== undefined && (
            <Badge
              variant="outline"
              className={cn(
                'text-[9px] px-1 py-0 h-3 font-mono',
                item.matchConfidence >= 0.75
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
              )}
            >
              {Math.round(item.matchConfidence * 100)}% Match
            </Badge>
          )}

          {!item.isNewProduct && matchedCatalogProduct ? (
            <Badge variant="success" className="text-[9px] px-1 py-0 h-3">
              Catalog Match
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3 border-primary/30 text-primary bg-primary/5">
              New Medicine
            </Badge>
          )}

          {item.rawDescription && item.rawDescription !== item.productName && (
            <span
              className="text-[9px] text-muted-foreground truncate max-w-[110px]"
              title={`OCR Extracted: ${item.rawDescription}`}
            >
              OCR: {item.rawDescription}
            </span>
          )}
        </div>
      </TableCell>

      {/* 3. Batch Number */}
      <TableCell className="w-18 min-w-[72px] px-0.5 py-1">
        <Input
          type="text"
          value={item.batchNumber || ''}
          onChange={(e) => handleFieldChange('batchNumber', e.target.value.toUpperCase())}
          placeholder="BATCH #"
          disabled={disabled}
          className={cn(
            'h-7 px-1 font-mono font-bold text-xs uppercase bg-background text-foreground border rounded leading-normal',
            !item.batchNumber.trim() && 'border-destructive focus-visible:ring-destructive'
          )}
        />
      </TableCell>

      {/* 4. Expiry Date & Short Expiry Alert */}
      <TableCell className="w-24 min-w-[96px] px-0.5 py-1 space-y-0.5">
        <Input
          type="date"
          value={item.expiryDate || ''}
          onChange={(e) => handleFieldChange('expiryDate', e.target.value)}
          disabled={disabled}
          className={cn(
            'h-7 px-0.5 font-mono text-[11px] bg-background text-foreground border rounded leading-normal',
            isShortExpiry && 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-300 font-bold'
          )}
        />
        {isShortExpiry && (
          <div className="flex items-center gap-0.5 text-[8px] text-amber-600 dark:text-amber-400 font-medium">
            <Clock className="h-2 w-2 shrink-0" />
            <span>&lt; 6 mo</span>
          </div>
        )}
      </TableCell>

      {/* 5. Billed Quantity */}
      <TableCell className="w-12 min-w-[48px] px-0.5 py-1 text-center">
        <Input
          type="number"
          min="1"
          step="1"
          value={item.billedQuantity > 0 ? item.billedQuantity : 1}
          placeholder="1"
          onChange={(e) => handleFieldChange('billedQuantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
          disabled={disabled}
          className="h-7 px-0.5 font-mono text-xs text-center font-bold text-foreground bg-background border rounded leading-normal tabular-nums"
        />
      </TableCell>

      {/* 6. Free Quantity (Scheme bonus goods) */}
      <TableCell className="w-11 min-w-[44px] px-0.5 py-1 text-center">
        <Input
          type="number"
          min="0"
          step="1"
          value={item.freeQuantity !== undefined && item.freeQuantity !== null ? item.freeQuantity : 0}
          placeholder="0"
          onChange={(e) => handleFieldChange('freeQuantity', Math.max(0, parseInt(e.target.value, 10) || 0))}
          disabled={disabled}
          title="Free goods bonus units (added to stock without financial charge)"
          className="h-7 px-0.5 font-mono text-xs text-center font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 border rounded leading-normal tabular-nums"
        />
      </TableCell>

      {/* 7. Unit Cost / PTR */}
      <TableCell className="w-16 min-w-[64px] px-0.5 py-1 text-center">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={displayUnitCost > 0 ? displayUnitCost : (item.unitCost || item.ptr || '')}
          placeholder="0.00"
          onChange={(e) => handleFieldChange('unitCost', Math.max(0, parseFloat(e.target.value) || 0))}
          disabled={disabled}
          className="h-7 px-0.5 font-mono text-xs text-center font-bold text-foreground bg-background border rounded leading-normal tabular-nums"
        />
      </TableCell>

      {/* 8. MRP */}
      <TableCell className="w-16 min-w-[64px] px-0.5 py-1 text-center">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={displayMrp > 0 ? displayMrp : (item.mrp || '')}
          placeholder="0.00"
          onChange={(e) => handleFieldChange('mrp', Math.max(0, parseFloat(e.target.value) || 0))}
          disabled={disabled}
          className="h-7 px-0.5 font-mono text-xs text-center font-bold text-foreground bg-background border rounded leading-normal tabular-nums"
        />
      </TableCell>

      {/* 9. Discount % */}
      <TableCell className="w-12 min-w-[46px] px-0.5 py-1 text-center">
        <Input
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={item.discountPercent !== undefined && item.discountPercent !== null ? item.discountPercent : 0}
          placeholder="0"
          onChange={(e) => handleFieldChange('discountPercent', Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
          disabled={disabled}
          className="h-7 px-0.5 font-mono text-xs text-center font-semibold text-foreground bg-background border rounded leading-normal tabular-nums"
        />
      </TableCell>

      {/* 10. GST Slab % */}
      <TableCell className="w-14 min-w-[54px] px-0.5 py-1 text-center">
        <Select
          value={String(item.taxPercent ?? 5)}
          onValueChange={(val) => handleFieldChange('taxPercent', parseFloat(val) || 0)}
          disabled={disabled}
        >
          <SelectTrigger className="h-7 text-xs font-mono px-1 text-center bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GST_SLABS.map((slab) => (
              <SelectItem key={slab.value} value={slab.value} className="text-xs font-mono">
                {slab.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* 11. Line Total */}
      <TableCell className="w-20 min-w-[76px] px-1 py-1 text-right font-mono font-bold text-foreground text-xs tabular-nums">
        ₹{Number(item.totalAmount || 0).toFixed(2)}
      </TableCell>

      {/* 12. Actions */}
      <TableCell className="w-7 min-w-[28px] px-0.5 py-1 text-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={disabled}
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          aria-label="Delete line item"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </TableCell>
    </TableRow>
  )
}
