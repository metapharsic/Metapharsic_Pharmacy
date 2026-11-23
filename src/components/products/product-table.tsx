'use client'

import { formatRack } from '@/lib/utils/rack'

// ─────────────────────────────────────────────────────────────
// Component — ProductTable
// Displays paginated product list with actions
// ─────────────────────────────────────────────────────────────
import type { ColumnDef } from '@tanstack/react-table'
import {
  PackagePlus,
  Pencil,
  Trash2,
  Eye,
  MapPin,
  AlertTriangle,
  Package,
  Calendar,
  Sparkles,
  Printer,
  QrCode,
  ShieldAlert,
  TrendingUp,
  ShoppingCart,
  Zap,
} from 'lucide-react'

import { DataTable } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { checkDiscountExemption } from '@/lib/pricing/discount-exemption'
import { formatDate } from '@/lib/utils/date'
import { formatCurrency } from '@/lib/utils/currency'
import { useI18n } from '@/lib/i18n/i18n-context'

// ─── Types ───────────────────────────────────────────────────

export interface ProductBatchSummary {
  id: string
  batchNumber: string
  quantity: number
  availableQuantity: number
  expiryDate: string | Date
  mrp: string | number
}

export interface ProductRow {
  id: string
  name: string
  nameAr?: string | null
  genericName?: string | null
  genericNameAr?: string | null
  sku: string
  barcode?: string | null
  manufacturer?: string | null
  rack?: string | null
  mrp: string
  costPrice?: string | null
  gstRate?: number
  minStockLevel?: number
  unitOfMeasure: string
  tabsPerStrip?: number | null
  isActive: boolean
  isPrescriptionRequired: boolean
  drugSchedule: string
  dpcoCeiling?: number | string | null
  isDiscountable?: boolean | null
  hsnCode?: string | null
  createdAt: Date | string
  categories: { category: { id: string; name: string } }[]
  totalStock?: number
  batchCount?: number
  earliestExpiry?: string | null
  isNearExpiry?: boolean
  batches?: ProductBatchSummary[]
}

interface ProductTableProps {
  products: ProductRow[]
  isLoading?: boolean
  selectedProductIds?: string[]
  onToggleSelect?: (id: string) => void
  onSelectAll?: () => void
  onAddProduct?: () => void
  onViewProduct?: (product: ProductRow) => void
  onEditProduct?: (product: ProductRow) => void
  onToggleActive?: (product: ProductRow) => void
  onInspectBatches?: (product: ProductRow) => void
  onFindSubstitutes?: (product: ProductRow) => void
  onQuickUpdateRack?: (product: ProductRow) => void
  onPrintLabel?: (product: ProductRow) => void
  onViewRateHistory?: (product: ProductRow) => void
  onRequestReorder?: (product: ProductRow) => void
  onSellAtPos?: (product: ProductRow) => void
}

// ─── Columns ─────────────────────────────────────────────────

interface I18nHelpers {
  locale: string
  isPureArabic: boolean
  translateDrug: (nameEn?: string | null, nameAr?: string | null) => string
  translateGeneric: (genEn?: string | null, genAr?: string | null) => string | null
  translateCategory: (cat?: string | null) => string
  translateSchedule: (sched?: string | null) => string
  formatPrice: (amount: number | string) => string
}

function useColumns(
  onView: (p: ProductRow) => void,
  onEdit: (p: ProductRow) => void,
  onToggleActive: (p: ProductRow) => void,
  onInspectBatches?: (p: ProductRow) => void,
  onFindSubstitutes?: (p: ProductRow) => void,
  onQuickUpdateRack?: (p: ProductRow) => void,
  onPrintLabel?: (p: ProductRow) => void,
  onViewRateHistory?: (p: ProductRow) => void,
  onRequestReorder?: (p: ProductRow) => void,
  onSellAtPos?: (p: ProductRow) => void,
  selectedProductIds: string[] = [],
  onToggleSelect?: (id: string) => void,
  onSelectAll?: () => void,
  i18n?: I18nHelpers
): ColumnDef<ProductRow>[] {
  const isAr = i18n?.locale === 'ar'

  return [
    {
      id: 'select',
      header: () => (
        <input
          type="checkbox"
          checked={Array.isArray(selectedProductIds) && selectedProductIds.length > 0}
          onChange={() => onSelectAll?.()}
          className="rounded border-border cursor-pointer h-3.5 w-3.5"
          title={isAr ? 'تحديد / إلغاء تحديد الكل' : 'Select / Deselect all'}
        />
      ),
      cell: ({ row }) => {
        const isSelected = Array.isArray(selectedProductIds) && selectedProductIds.includes(row.original.id)
        return (
          <input
            type="checkbox"
            checked={!!isSelected}
            onChange={(e) => {
              e.stopPropagation()
              onToggleSelect?.(row.original.id)
            }}
            className="rounded border-border cursor-pointer h-3.5 w-3.5"
            title={isAr ? 'تحديد الدواء' : 'Select product'}
          />
        )
      },
    },
    {
      accessorKey: 'name',
      header: isAr ? 'الدواء والمستحضر' : 'Product',
      cell: ({ row }) => {
        const localizedName = i18n ? i18n.translateDrug(row.original.name, row.original.nameAr) : row.original.name
        const genericName = i18n ? i18n.translateGeneric(row.original.genericName, row.original.genericNameAr) : row.original.genericName

        return (
          <div>
            <p className="font-semibold text-foreground text-xs">{localizedName}</p>
            {isAr && !i18n?.isPureArabic && row.original.nameAr && (
              <p className="text-[10px] text-muted-foreground font-sans">({row.original.name})</p>
            )}
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {genericName && (
                <span className="text-xs text-muted-foreground">{genericName}</span>
              )}
              {genericName && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onFindSubstitutes?.(row.original)
                  }}
                  className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:text-primary/80 hover:underline font-medium"
                  title={isAr ? 'البحث عن البدائل والمكافئات الحيوية' : 'Find equivalent generic salt substitutes'}
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  {isAr ? 'البدائل' : 'Substitutes'}
                </button>
              )}
              {row.original.manufacturer && (
                <span className="text-[10px] text-muted-foreground/80 bg-muted px-1 py-0.2 rounded font-normal">
                  {row.original.manufacturer}
                </span>
              )}
              {Boolean(row.original.tabsPerStrip && row.original.tabsPerStrip > 1) && (
                <span className="text-[10px] text-primary/90 bg-primary/10 border border-primary/20 px-1 py-0.2 rounded font-mono font-medium">
                  ⚡ {row.original.tabsPerStrip}{isAr ? ' قرص/شريط' : 'T/strip'}
                </span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'sku',
      header: isAr ? 'رمز الصنف SKU' : 'SKU',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.sku}</span>,
    },
    {
      accessorKey: 'categories',
      header: isAr ? 'التصنيفات الدوائية' : 'Categories',
      cell: ({ row }) => {
        const cats = Array.isArray(row.original.categories) ? row.original.categories : []
        return (
          <div className="flex flex-wrap gap-1">
            {cats.slice(0, 2).map((c) => (
              <Badge key={c.category?.id || Math.random()} variant="secondary" className="text-xs">
                {i18n ? i18n.translateCategory(c.category?.name) : (c.category?.name || 'General')}
              </Badge>
            ))}
            {cats.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{cats.length - 2}
              </Badge>
            )}
            {cats.length === 0 && (
              <span className="text-muted-foreground text-xs italic">
                {isAr ? 'بدون تصنيف' : 'Uncategorized'}
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'totalStock',
      header: isAr ? 'الرصيد الفعلي' : 'Live Stock',
      cell: ({ row }) => {
        const stock = row.original.totalStock ?? 0
        const minLevel = row.original.minStockLevel ?? 10
        const batchCount = row.original.batchCount ?? 0

        return (
          <button
            type="button"
            onClick={() => onInspectBatches?.(row.original)}
            className="text-left group/stock cursor-pointer focus:outline-none"
            title={isAr ? 'انقر لعرض تفاصيل التشغيلات والصلاحية' : 'Click to view batch lot breakdown, expiries & rates'}
          >
            {stock === 0 ? (
              <div>
                <Badge variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[11px] font-mono py-0 group-hover/stock:border-rose-500">
                  {isAr ? 'نفد من المخزون' : 'Out of Stock'}
                </Badge>
                <span className="block text-[10px] text-muted-foreground group-hover/stock:text-primary transition-colors mt-0.5 underline-offset-2 hover:underline">
                  {isAr ? '0 تشغيلات ▾' : '0 batches ▾'}
                </span>
              </div>
            ) : stock <= minLevel ? (
              <div>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[11px] font-mono py-0 gap-0.5 group-hover/stock:border-amber-500">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {isAr ? `منخفض: ${stock} وحدة` : `Low: ${stock} units`}
                </Badge>
                <span className="block text-[10px] text-muted-foreground group-hover/stock:text-primary transition-colors mt-0.5 underline-offset-2 hover:underline">
                  {isAr ? `${batchCount} تشغيلات ▾` : `${batchCount} ${batchCount === 1 ? 'batch' : 'batches'} ▾`}
                </span>
              </div>
            ) : (
              <div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-mono py-0 group-hover/stock:border-emerald-500">
                  {isAr ? `${stock} وحدة` : `${stock} units`}
                </Badge>
                <span className="block text-[10px] text-muted-foreground group-hover/stock:text-primary transition-colors mt-0.5 underline-offset-2 hover:underline">
                  {isAr ? `${batchCount} تشغيلات ▾` : `${batchCount} ${batchCount === 1 ? 'batch' : 'batches'} ▾`}
                </span>
              </div>
            )}
          </button>
        )
      },
    },
    {
      accessorKey: 'earliestExpiry',
      header: isAr ? 'أقرب صلاحية' : 'Earliest Expiry',
      cell: ({ row }) => {
        const exp = row.original.earliestExpiry
        if (!exp) return <span className="text-muted-foreground text-xs">—</span>

        const d = new Date(exp)
        const formatted = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`

        return (
          <div className="flex items-center gap-1 font-mono text-xs">
            <span>{formatted}</span>
            {row.original.isNearExpiry && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[9px] py-0 px-1 font-sans">
                {isAr ? 'قريب الانتهاء' : 'Near Expiry'}
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      id: 'rack',
      accessorFn: (row) => formatRack(row.rack),
      header: isAr ? 'الرف والموقع' : 'Rack',
      cell: ({ row }) => {
        const displayRack = formatRack(row.original.rack)
        return (
          <button
            type="button"
            onClick={() => onQuickUpdateRack?.(row.original)}
            className="text-left group/rack cursor-pointer hover:scale-105 transition-transform focus:outline-none"
            title={isAr ? 'انقر لتحديد موقع الرف والخزينة' : 'Click to relocate shelf/godown location'}
          >
            {displayRack ? (
              <Badge variant="secondary" className="font-mono text-[11px] gap-1 py-0 px-1.5 group-hover/rack:border-primary">
                <MapPin className="h-2.5 w-2.5 text-muted-foreground group-hover/rack:text-primary" />
                {displayRack}
              </Badge>
            ) : (
              <span className="text-muted-foreground text-[11px] italic group-hover/rack:text-primary underline-offset-2 hover:underline">
                {isAr ? '+ تحديد الرف' : '+ Set Rack'}
              </span>
            )}
          </button>
        )
      },
    },
    {
      accessorKey: 'mrp',
      header: isAr ? 'سعر الجمهور' : 'MRP',
      cell: ({ row }) => {
        const mrpNum = parseFloat(row.original.mrp)
        const formattedPrice = i18n ? i18n.formatPrice(mrpNum) : formatCurrency(row.original.mrp)
        const tabs = row.original.tabsPerStrip
        const tabRate = tabs && tabs > 1 && !isNaN(mrpNum) ? (mrpNum / tabs) : null

        return (
          <div>
            <span className="font-mono font-medium">{formattedPrice}</span>
            {tabRate && (
              <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                ⚡ {i18n ? i18n.formatPrice(tabRate) : formatCurrency(tabRate)}{isAr ? '/قرص' : '/tab'}
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'isPrescriptionRequired',
      header: isAr ? 'التصنيف' : 'Rx',
      cell: ({ row }) => {
        const sched = row.original.drugSchedule
        if (sched && sched !== 'NONE') {
          return (
            <Badge variant="warning" className="text-[10px] py-0 px-1">
              {isAr ? `مراقب (${sched})` : `Sched ${sched}`}
            </Badge>
          )
        }
        return row.original.isPrescriptionRequired ? (
          <Badge variant="warning" className="text-[10px] py-0 px-1">
            {isAr ? 'وصفة طبية (Rx)' : 'Rx'}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] py-0 px-1">
            {isAr ? 'عام (OTC)' : 'OTC'}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'isActive',
      header: isAr ? 'الحالة' : 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'success' : 'destructive'}>
          {row.original.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطل' : 'Inactive')}
        </Badge>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: isAr ? 'تاريخ التسجيل' : 'Created',
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: 'actions',
      header: isAr ? 'إجراءات' : '',
      cell: ({ row }) => {
        const product = row.original
        const isShortage = (product.totalStock ?? 0) <= (product.minStockLevel ?? 10)

        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              onClick={() => onSellAtPos ? onSellAtPos(product) : (window.location.href = `/pos`)}
              title="Fast Sell at POS (Strip or 1-Tab loose)"
            >
              <Zap className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={() => onInspectBatches?.(product)}
              title="Inspect Batches & Stock Lots"
            >
              <Package className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={() => onPrintLabel?.(product)}
              title="Print Thermal Shelf / Barcode Label"
            >
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-emerald-600"
              onClick={() => onViewRateHistory?.(product)}
              title="Rate History & Margin Profitability"
            >
              <TrendingUp className="h-3.5 w-3.5" />
            </Button>
            {isShortage && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                onClick={() => onRequestReorder?.(product)}
                title="Create Purchase Indent (Shortage Reorder)"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onView(product)}
              title="View product"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(product)}
              title="Edit product"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onToggleActive(product)}
              title={product.isActive ? 'Deactivate product' : 'Activate product'}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        )
      },
    },
  ]
}

// ─── Component ───────────────────────────────────────────────

export function ProductTable({
  products,
  isLoading,
  selectedProductIds = [],
  onToggleSelect,
  onSelectAll,
  onAddProduct,
  onViewProduct,
  onEditProduct,
  onToggleActive,
  onInspectBatches,
  onFindSubstitutes,
  onQuickUpdateRack,
  onPrintLabel,
  onViewRateHistory,
  onRequestReorder,
  onSellAtPos,
}: ProductTableProps) {
  const {
    locale,
    isPureArabic,
    translateDrug,
    translateGeneric,
    translateCategory,
    translateSchedule,
    formatPrice,
  } = useI18n()

  const i18nHelpers: I18nHelpers = {
    locale,
    isPureArabic,
    translateDrug,
    translateGeneric,
    translateCategory,
    translateSchedule,
    formatPrice,
  }

  return (
    <DataTable
      columns={useColumns(
        (p) => onViewProduct?.(p),
        (p) => onEditProduct?.(p),
        (p) => onToggleActive?.(p),
        onInspectBatches,
        onFindSubstitutes,
        onQuickUpdateRack,
        onPrintLabel,
        onViewRateHistory,
        onRequestReorder,
        onSellAtPos,
        selectedProductIds,
        onToggleSelect,
        onSelectAll,
        i18nHelpers
      )}
      data={products}
      isLoading={isLoading}
      searchKey="name"
      searchPlaceholder={locale === 'ar' ? 'ابحث بالاسم التجاري أو العلمي...' : 'Search products…'}
      emptyMessage={locale === 'ar' ? 'لم يتم العثور على أدوية مطابقة' : 'No products found. Add your first product to get started.'}
      toolbar={
        onAddProduct && (
          <Button size="sm" onClick={onAddProduct}>
            <PackagePlus className="mr-2 h-4 w-4" />
            {locale === 'ar' ? 'تسجيل دواء جديد' : 'Add Product'}
          </Button>
        )
      }
    />
  )
}
