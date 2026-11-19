'use client'

import { formatRack, formatShelf } from '@/lib/utils/rack'

// ─────────────────────────────────────────────────────────────
// Component — InventoryTable
// Displays current stock levels per product per branch with
// expandable FEFO batch drawers, barcode indicators, rack location,
// quick stock adjustments, and instant "Add to POS" action.
// ─────────────────────────────────────────────────────────────
import {
  AlertTriangle,
  Barcode,
  ChevronDown,
  ChevronRight,
  Layers,
  Lock,
  MapPin,
  Package,
  Pencil,
  Plus,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react'
import React, { useState } from 'react'

import { ProductBatchDrawer, type BatchItem } from '@/components/inventory/product-batch-drawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/lib/hooks/use-toast'
import { playBarcodeBeep } from '@/lib/scanner/barcode-sound'
import { addPosCartItem, type PosCartLine } from '@/lib/stores/pos-cart-store'
import { formatDateTime } from '@/lib/utils/date'
import { useI18n } from '@/lib/i18n/i18n-context'

// ─── Types ───────────────────────────────────────────────────

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstock'

export interface InventoryRow {
  id: string
  productId: string
  branchId: string
  totalQuantity: number
  reservedQuantity: number
  availableQuantity: number
  updatedAt: string
  stockStatus: StockStatus
  product: {
    id: string
    name: string
    nameAr?: string | null
    genericName?: string | null
    genericNameAr?: string | null
    sku: string
    barcode?: string | null
    rack?: string | null
    shelf?: string | null
    box?: string | null
    unitOfMeasure: string
    reorderLevel: number
    maxStockLevel: number | null
    categories?: Array<{
      id: string
      name: string
      slug: string
      parentId?: string | null
      parentName?: string | null
    }>
  }
  branch: { id: string; name: string; code: string | null }
}

interface InventoryTableProps {
  rows: InventoryRow[]
  isLoading?: boolean
  isAdmin?: boolean
  onQuickAddToPos?: (row: InventoryRow) => void
  onScanProduct?: (row: InventoryRow) => void
  onAdjustProduct?: (row: InventoryRow) => void
  onEditLocation?: (row: InventoryRow) => void
  onTabletSale?: (row: InventoryRow) => void
  onViewSubstitutes?: (row: InventoryRow) => void
  /** Admin-only actions */
  onEditItem?: (row: InventoryRow) => void
  onDeleteItem?: (row: InventoryRow) => void
}

// ─── Status metadata ──────────────────────────────────────────

const STATUS_META: Record<
  StockStatus,
  { label: string; variant: 'success' | 'warning' | 'destructive' | 'info' | 'default' }
> = {
  in_stock: { label: 'In Stock', variant: 'success' },
  low_stock: { label: 'Low Stock', variant: 'warning' },
  out_of_stock: { label: 'Out of Stock', variant: 'destructive' },
  overstock: { label: 'Overstock', variant: 'info' },
}

export function InventoryTable({
  rows,
  isLoading,
  isAdmin = false,
  onQuickAddToPos,
  onScanProduct,
  onAdjustProduct,
  onEditLocation,
  onTabletSale,
  onViewSubstitutes,
  onEditItem,
  onDeleteItem,
}: InventoryTableProps) {
  const toast = useToast()
  const {
    locale,
    isPureArabic,
    translateDrug,
    translateGeneric,
    translateUnit,
    translateLocation,
    translateStatus,
    translateCategory,
  } = useI18n()
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  const toggleRow = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id))
  }

  const handleDispenseBatchToPos = (row: InventoryRow, batch: BatchItem) => {
    const mrp = Number(batch.mrp) || 0
    const localizedName = translateDrug(row.product.name, row.product.nameAr)
    const cartItem: PosCartLine = {
      productId: row.productId,
      sku: row.product.sku,
      barcode: row.product.barcode ?? null,
      name: localizedName,
      genericName: translateGeneric(row.product.genericName, row.product.genericNameAr),
      unitOfMeasure: translateUnit(row.product.unitOfMeasure) || 'Strip',
      mrp,
      gstRate: 12,
      cgstRate: 6,
      sgstRate: 6,
      igstRate: 0,
      hsnCode: '3004',
      drugSchedule: 'SCHEDULE_H',
      isPrescriptionRequired: false,
      isGstExempt: false,
      quantity: 1,
      discountPercent: 0,
      availableQuantity: batch.availableQuantity,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
    }

    addPosCartItem(cartItem)
    playBarcodeBeep()
    toast.success(
      locale === 'ar' ? `تمت الإضافة للصرف: ${localizedName}` : `Dispensed to POS: ${row.product.name}`,
      locale === 'ar'
        ? `تشغيلة #${batch.batchNumber} · المتاح: ${batch.availableQuantity} وحدة`
        : `Batch #${batch.batchNumber} · Available: ${batch.availableQuantity} units`
    )
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 text-xs">
              <TableHead className="w-10"></TableHead>
              <TableHead>{locale === 'ar' ? 'الدواء والرمز' : 'Product & SKU'}</TableHead>
              <TableHead>{locale === 'ar' ? 'الفرع' : 'Branch'}</TableHead>
              <TableHead className="text-right">{locale === 'ar' ? 'الإجمالي' : 'Total'}</TableHead>
              <TableHead className="text-right">{locale === 'ar' ? 'المحجوز' : 'Reserved'}</TableHead>
              <TableHead className="text-right">{locale === 'ar' ? 'المتاح' : 'Available'}</TableHead>
              <TableHead className="text-center">{locale === 'ar' ? 'الحالة' : 'Status'}</TableHead>
              <TableHead className="text-right pr-4">{locale === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                <TableCell><Skeleton className="h-7 w-24 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-8 text-center space-y-2">
        <Package className="h-8 w-8 text-muted-foreground/60 mx-auto" />
        <p className="text-sm font-semibold text-foreground">
          {locale === 'ar' ? 'لا توجد سجلات مخزون مطابقة' : 'No stock records found'}
        </p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          {locale === 'ar'
            ? 'لم يتم العثور على أدوية تطابق معايير البحث أو التصفية الحالية. جرب مسح باركود جديد.'
            : 'No inventory items matched your active search or filter criteria. Try clearing filters or scanning a new medicine strip.'}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-xs">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 text-xs">
            <TableHead className="w-8 px-2"></TableHead>
            <TableHead className="font-semibold">{locale === 'ar' ? 'الدواء، الكود والرف' : 'Product, SKU & Rack'}</TableHead>
            <TableHead className="font-semibold">{locale === 'ar' ? 'الفرع' : 'Branch'}</TableHead>
            <TableHead className="font-semibold text-right">{locale === 'ar' ? 'الإجمالي' : 'Total'}</TableHead>
            <TableHead className="font-semibold text-right">{locale === 'ar' ? 'المحجوز' : 'Reserved'}</TableHead>
            <TableHead className="font-semibold text-right">{locale === 'ar' ? 'المتاح للصرف' : 'Available'}</TableHead>
            <TableHead className="font-semibold text-center">{locale === 'ar' ? 'الحالة' : 'Status'}</TableHead>
            <TableHead className="font-semibold text-right pr-4">{locale === 'ar' ? 'صرف سريع / تسوية' : 'Quick Dispense / Adjust'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isExpanded = expandedRowId === row.id
            const isOutOfStock = row.availableQuantity <= 0
            const isLowStock =
              row.availableQuantity > 0 &&
              row.availableQuantity <= row.product.reorderLevel
            const meta = STATUS_META[row.stockStatus]
            const localizedDrugName = translateDrug(row.product.name, row.product.nameAr)

            return (
              <React.Fragment key={row.id}>
                <TableRow
                  className={`group transition-colors text-xs ${
                    isExpanded
                      ? 'bg-muted/25 font-medium'
                      : isOutOfStock
                        ? 'bg-destructive/5 hover:bg-destructive/10'
                        : isLowStock
                          ? 'bg-amber-500/5 hover:bg-amber-500/10'
                          : 'hover:bg-muted/30'
                  }`}
                >
                  {/* Expand Chevron Column */}
                  <TableCell className="w-8 px-2 py-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRow(row.id)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      title={isExpanded ? (locale === 'ar' ? 'طي التشغيلات' : 'Collapse Batches') : (locale === 'ar' ? 'عرض تشغيلات FEFO' : 'View FEFO Batches')}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-primary" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>

                  {/* Product Details */}
                  <TableCell className="py-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-foreground text-xs">
                          {localizedDrugName}
                        </span>
                        {!isPureArabic && row.product.nameAr && (
                          <span className="text-[10px] text-muted-foreground font-sans">
                            ({row.product.name})
                          </span>
                        )}
                        {isLowStock && (
                          <span
                            title={locale === 'ar' ? 'أقل من حد إعادة الطلب' : 'Below reorder threshold'}
                            className="inline-flex text-amber-500"
                          >
                            <AlertTriangle className="h-3 w-3" />
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="font-mono text-[11px] font-medium text-muted-foreground/90">
                          {row.product.sku}
                        </span>
                        {row.product.unitOfMeasure && (
                          <span>· {translateUnit(row.product.unitOfMeasure)}</span>
                        )}
                        {(row.product.rack || row.product.box) ? (
                          <span
                            onClick={() => onEditLocation?.(row)}
                            className="cursor-pointer inline-flex items-center gap-1 font-mono text-[10px] bg-amber-500/10 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 hover:border-amber-500 transition-colors"
                            title={locale === 'ar' ? 'انقر لتغيير موقع الرف والخزينة' : 'Click to relocate Rack, Shelf & Box'}
                          >
                            <MapPin className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />
                            <span>{locale === 'ar' ? `رف ${row.product.rack || 'بدون رف'}` : (formatRack(row.product.rack) || 'No Rack')}</span>
                            {row.product.shelf && <span>&gt; {locale === 'ar' ? `خانة ${row.product.shelf}` : `Shelf ${row.product.shelf}`}</span>}
                            {row.product.box && (
                              <span className="font-bold underline decoration-amber-500/50">
                                [{row.product.box}]
                              </span>
                            )}
                          </span>
                        ) : (
                          <span
                            onClick={() => onEditLocation?.(row)}
                            className="cursor-pointer inline-flex items-center gap-1 font-mono text-[10px] bg-muted/50 text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded border border-dashed border-border hover:border-primary transition-colors"
                            title={locale === 'ar' ? 'انقر لتحديد موقع الرف والصندوق' : 'Click to assign Rack, Shelf & Box location'}
                          >
                            <MapPin className="h-2.5 w-2.5" />
                            <span>{locale === 'ar' ? '+ صندوق' : '+ Box'}</span>
                          </span>
                        )}
                        {row.product.barcode && (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.2 rounded border border-border/50">
                            <Barcode className="h-3 w-3" />
                            {row.product.barcode}
                          </span>
                        )}
                      </div>

                      {/* Dosage Form & Therapeutic Classification Badges */}
                      {row.product.categories && row.product.categories.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                          {row.product.categories.map((cat) => {
                            const isDosage = cat.parentName?.toLowerCase().includes('dosage')
                            return (
                              <Badge
                                key={cat.id}
                                variant="outline"
                                className={`text-[9px] font-normal py-0 px-1.5 ${
                                  isDosage
                                    ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                }`}
                              >
                                {translateCategory(cat.name)}
                              </Badge>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Branch */}
                  <TableCell className="py-3 text-xs">
                    <span className="text-muted-foreground">
                      {row.branch.name}
                      {row.branch.code ? ` (${row.branch.code})` : ''}
                    </span>
                  </TableCell>

                  {/* Total */}
                  <TableCell className="py-3 text-right font-mono text-xs text-muted-foreground">
                    {row.totalQuantity}
                  </TableCell>

                  {/* Reserved */}
                  <TableCell className="py-3 text-right font-mono text-xs">
                    {row.reservedQuantity > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {row.reservedQuantity}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">0</span>
                    )}
                  </TableCell>

                  {/* Available */}
                  <TableCell className="py-3 text-right font-mono text-xs">
                    <span
                      className={`font-bold ${
                        isOutOfStock
                          ? 'text-destructive'
                          : isLowStock
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-foreground'
                      }`}
                    >
                      {row.availableQuantity}
                    </span>
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell className="py-3 text-center">
                    <Badge variant={meta.variant} className="text-[10px]">
                      {translateStatus(row.stockStatus)}
                    </Badge>
                  </TableCell>

                  {/* Actions Column */}
                  <TableCell className="py-3 text-right pr-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* View Batches button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRow(row.id)}
                        className={`h-7 px-2 text-[11px] gap-1 transition-all ${
                          isExpanded
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        title={locale === 'ar' ? 'عرض تفاصيل تشغيلات FEFO' : 'View FEFO Batch breakdown'}
                      >
                        <Layers className="h-3 w-3" />
                        <span className="hidden md:inline">{locale === 'ar' ? 'التشغيلات' : 'Batches'}</span>
                      </Button>

                      {/* Edit Location (Rack > Shelf > Box) */}
                      {onEditLocation && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditLocation(row)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-600"
                          title="Assign or Relocate Storage Location (Rack > Shelf > Box)"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Adjust Stock */}
                      {onAdjustProduct && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onAdjustProduct(row)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Quick Stock Adjustment (Damaged, Expiry, Physical Count)"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Barcode scanner action */}
                      {onScanProduct && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onScanProduct(row)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Scan Barcode"
                        >
                          <Barcode className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Instant 1-Tab Sale */}
                      {onTabletSale && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isOutOfStock}
                          onClick={() => onTabletSale(row)}
                          className="h-7 gap-1 px-2 text-[11px] text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 font-semibold transition-all border border-amber-500/30 shadow-2xs"
                          title="Instant 1-Tablet Dispense / Sales Pattern Auto-Bill"
                        >
                          <Zap className="h-3 w-3 text-amber-500 fill-amber-500/20" />
                          <span className="hidden sm:inline">{locale === 'ar' ? 'صرف قرص' : '1-Tab Sale'}</span>
                        </Button>
                      )}

                      {/* Therapeutic Substitutes Action */}
                      {onViewSubstitutes && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewSubstitutes(row)}
                          className={`h-7 gap-1 px-2 text-[11px] transition-all ${
                            isOutOfStock || isLowStock
                              ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 font-medium border border-amber-500/30 shadow-2xs'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          title="Find equivalent generic salt or therapeutic alternatives"
                        >
                          <Sparkles className="h-3 w-3 text-amber-500" />
                          <span className="hidden xl:inline">{locale === 'ar' ? 'البدائل' : 'Substitutes'}</span>
                        </Button>
                      )}

                      {/* Add to POS */}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isOutOfStock}
                        onClick={() => onQuickAddToPos?.(row)}
                        className="h-7 gap-1 px-2 text-xs border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground font-medium transition-all shadow-xs"
                        title={
                          isOutOfStock ? (locale === 'ar' ? 'الصنف نافد من المخزون' : 'Item is out of stock') : (locale === 'ar' ? 'إضافة وحدة واحدة إلى سلة الصرف' : 'Add 1 unit to POS cart')
                        }
                      >
                        <Plus className="h-3 w-3" />
                        <ShoppingCart className="h-3 w-3" />
                        <span className="hidden sm:inline">{locale === 'ar' ? 'إضافة للصرف' : 'Add to POS'}</span>
                      </Button>

                      {/* Admin-only separator */}
                      {isAdmin && (onEditItem || onDeleteItem) && (
                        <div className="h-5 w-px bg-border/60 mx-0.5" aria-hidden />
                      )}

                      {/* Admin Edit */}
                      {isAdmin && onEditItem && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditItem(row)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10"
                          title="Admin: Edit Item (name, pricing, stock, rack)"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Admin Delete */}
                      {isAdmin && onDeleteItem && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteItem(row)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Admin: Delete / Deactivate Item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Lock icon for non-admins (read-only hint) */}
                      {!isAdmin && (
                        <div
                          className="h-7 w-7 flex items-center justify-center text-muted-foreground/40"
                          title="Admin access required to edit or delete inventory"
                        >
                          <Lock className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>

                {/* Expanded Batch & FEFO Drawer Row */}
                {isExpanded && (
                  <TableRow className="bg-muted/10 border-b border-border/60">
                    <TableCell colSpan={8} className="p-3 pl-8 sm:pl-10">
                      <ProductBatchDrawer
                        productId={row.productId}
                        productName={row.product.name}
                        branchId={row.branchId}
                        onQuickAddToPos={(batch) => handleDispenseBatchToPos(row, batch)}
                        onAdjustBatch={() => onAdjustProduct?.(row)}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
