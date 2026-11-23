'use client'

// ─────────────────────────────────────────────────────────────
// Component — ProductCatalog (Enterprise Tier-1 Standards)
// Enhanced with live dispensary KPI cards, stock status filters,
// schedule compliance filters, and catalog CSV export.
// ─────────────────────────────────────────────────────────────
import {
  Search,
  Download,
  Package,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  Plus,
  Upload,
  Printer,
  QrCode,
  ShoppingCart,
  Filter,
  Scan,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { AiStripScannerModal } from '@/components/scanner/ai-strip-scanner-modal'
import { ProductBatchDialog } from '@/components/products/product-batch-dialog'
import { ProductDetailModal } from '@/components/products/product-detail-modal'
import { ProductImportDialog } from '@/components/products/product-import-dialog'
import { ProductLabelDialog } from '@/components/products/product-label-dialog'
import { ProductRateHistoryDialog } from '@/components/products/product-rate-history-dialog'
import { ProductSubstitutesDialog } from '@/components/products/product-substitutes-dialog'
import { ProductTable, type ProductRow } from '@/components/products/product-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ROUTES } from '@/lib/constants/routes'
import { useToast } from '@/lib/hooks/use-toast'
import type { CatalogSummaryMetrics } from '@/lib/products/product-analytics-service'
import { useUiStore } from '@/lib/stores/ui-store'
import { formatCurrency } from '@/lib/utils/currency'
import { useI18n } from '@/lib/i18n/i18n-context'

interface ProductCatalogProps {
  initialProducts: ProductRow[]
  initialPagination: { page: number; limit: number; total: number; pages: number }
  canCreate: boolean
  canUpdate: boolean
  canImport: boolean
  initialCategoryId?: string
}

interface CategoryOption {
  id: string
  name: string
  slug?: string
  parentId?: string | null
  parentName?: string | null
}

export function ProductCatalog({
  initialProducts,
  initialPagination,
  canCreate,
  canUpdate,
  canImport,
  initialCategoryId,
}: ProductCatalogProps) {
  const router = useRouter()
  const toast = useToast()
  const { openConfirmDialog } = useUiStore()
  const { territoryDef } = useI18n()

  const [products, setProducts] = useState<ProductRow[]>(initialProducts)
  const [totalPages, setTotalPages] = useState(initialPagination.pages)
  const [page, setPage] = useState(initialPagination.page)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId || 'all')
  const [stockStatus, setStockStatus] = useState<string>('all')
  const [drugSchedule, setDrugSchedule] = useState<string>('all')
  const [isActive, setIsActive] = useState<string>('all')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [summaryMetrics, setSummaryMetrics] = useState<CatalogSummaryMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  // Interactive drawer & modal states
  const [selectedBatchProduct, setSelectedBatchProduct] = useState<ProductRow | null>(null)
  const [batchDialogOpen, setBatchDialogOpen] = useState(false)
  const [selectedSubstituteProduct, setSelectedSubstituteProduct] = useState<ProductRow | null>(null)
  const [substitutesDialogOpen, setSubstitutesDialogOpen] = useState(false)
  const [editingRackProduct, setEditingRackProduct] = useState<ProductRow | null>(null)
  const [rackDialogOpen, setRackDialogOpen] = useState(false)
  const [newRackValue, setNewRackValue] = useState('')
  const [savingRack, setSavingRack] = useState(false)

  // Label Printing Engine
  const [labelProducts, setLabelProducts] = useState<ProductRow[]>([])
  const [labelDialogOpen, setLabelDialogOpen] = useState(false)

  // AI Strip & Packaging Scanner Cockpit
  const [scannerOpen, setScannerOpen] = useState(false)

  // Rate History & Margin Explorer
  const [selectedRateProduct, setSelectedRateProduct] = useState<ProductRow | null>(null)
  const [rateDialogOpen, setRateDialogOpen] = useState(false)

  // Multi-selection & Bulk Actions
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/products/summary')
      const json = (await res.json()) as { success: boolean; data?: CatalogSummaryMetrics }
      if (json.success && json.data) {
        setSummaryMetrics(json.data)
      }
    } catch {
      // silent fallback
    }
  }, [])

  useEffect(() => {
    void fetchSummary()
    fetch('/api/categories/options')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCategories(d.data as CategoryOption[])
      })
      .catch(() => undefined)
  }, [fetchSummary])

  const load = useCallback(
    async (opts?: { page?: number; reset?: boolean }) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(opts?.reset ? 1 : (opts?.page ?? page)))
        params.set('limit', '20')
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (categoryId !== 'all') params.set('categoryId', categoryId)
        if (isActive !== 'all') params.set('isActive', isActive === 'active' ? 'true' : 'false')
        if (stockStatus !== 'all') params.set('stockStatus', stockStatus)
        if (drugSchedule !== 'all') params.set('drugSchedule', drugSchedule)

        const res = await fetch(`/api/products?${params.toString()}`)
        const json = (await res.json()) as {
          success: boolean
          data?: any[]
          pagination?: { page: number; total: number; pages: number }
        }
        if (json.success && json.data) {
          const ninetyDays = new Date()
          ninetyDays.setDate(ninetyDays.getDate() + 90)

          const mapped: ProductRow[] = json.data.map((p) => {
            const batches = p.batches ?? []
            let totalStock = 0
            let earliestExpiry: string | null = null
            let isNearExpiry = false

            const batchSummaries = batches.map((b: any) => {
              const avail = Math.max(0, (b.quantity ?? 0) - (b.reservedQuantity ?? 0) - (b.soldQuantity ?? 0))
              totalStock += avail
              if (avail > 0 && !earliestExpiry && b.expiryDate) {
                earliestExpiry = new Date(b.expiryDate).toISOString()
              }
              if (avail > 0 && b.expiryDate && new Date(b.expiryDate) <= ninetyDays) {
                isNearExpiry = true
              }
              return {
                id: b.id,
                batchNumber: b.batchNumber,
                quantity: b.quantity,
                availableQuantity: avail,
                expiryDate: b.expiryDate,
                mrp: b.mrp ? b.mrp.toString() : p.mrp.toString(),
              }
            })

            return {
              id: p.id,
              name: p.name,
              genericName: p.genericName,
              sku: p.sku,
              barcode: p.barcode,
              manufacturer: p.manufacturer,
              rack: (p.rack && typeof p.rack === 'object' ? (p.rack.shelfNumber ? `${p.rack.code}-${p.rack.shelfNumber}` : p.rack.code) : (p.rack || null)),
              mrp: p.mrp ? p.mrp.toString() : '0',
              costPrice: p.costPrice ? p.costPrice.toString() : null,
              gstRate: p.gstRate ? Number(p.gstRate) : 12,
              minStockLevel: p.minStockLevel ?? 10,
              unitOfMeasure: p.unitOfMeasure ?? 'Strip',
              tabsPerStrip: p.tabsPerStrip ?? null,
              isActive: p.isActive,
              isPrescriptionRequired: p.isPrescriptionRequired,
              drugSchedule: p.drugSchedule,
              hsnCode: p.hsnCode,
              createdAt: p.createdAt,
              categories: Array.isArray(p.categories)
                ? p.categories.map((c: any) => ({
                    category: { id: c.category?.id || '', name: c.category?.name || 'General' },
                  }))
                : [],
              totalStock,
              batchCount: batches.length,
              earliestExpiry,
              isNearExpiry,
              batches: batchSummaries,
            }
          })

          setProducts(mapped)
          setTotalPages(json.pagination?.pages ?? 1)
          setPage(json.pagination?.page ?? 1)
        } else {
          toast.error('Failed to load products')
        }
      } catch {
        toast.error('Failed to load products')
      } finally {
        setLoading(false)
      }
    },
    [page, debouncedSearch, categoryId, isActive, stockStatus, drugSchedule, toast]
  )

  useEffect(() => {
    void load({ reset: true })
  }, [debouncedSearch, categoryId, isActive, stockStatus, drugSchedule]) // eslint-disable-line react-hooks/exhaustive-deps, @typescript-eslint/no-floating-promises

  function handleToggleActive(product: ProductRow) {
    const action = product.isActive ? 'deactivate' : 'activate'
    openConfirmDialog({
      title: `${product.isActive ? 'Deactivate' : 'Activate'} Product`,
      description: `Are you sure you want to ${action} "${product.name}"?`,
      variant: product.isActive ? 'destructive' : 'default',
      onConfirm: async () => {
        const res = await fetch(`/api/products/${product.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !product.isActive }),
        })
        if (res.ok) {
          toast.success(`Product ${action}d successfully`)
          void load()
          void fetchSummary()
        } else {
          toast.error(`Failed to ${action} product`)
        }
      },
    })
  }

  function handleExportCsv() {
    if (products.length === 0) {
      toast.error('No products to export')
      return
    }

    const headers = [
      'Product Name',
      'Generic Composition',
      'Manufacturer',
      'SKU',
      'Barcode',
      'Rack Location',
      `MRP (${territoryDef.currency.code})`,
      'Tabs Per Strip',
      `Loose Tab MRP (${territoryDef.currency.code})`,
      'Live Stock Units',
      'Active Batches',
      'Earliest Expiry',
      'Schedule',
      'Rx Required',
      'Status',
    ]

    const rows = products.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${(p.genericName ?? '').replace(/"/g, '""')}"`,
      `"${(p.manufacturer ?? '').replace(/"/g, '""')}"`,
      `"${p.sku}"`,
      `"${p.barcode ?? ''}"`,
      `"${p.rack ?? ''}"`,
      p.mrp,
      p.tabsPerStrip ?? 1,
      p.tabsPerStrip && p.tabsPerStrip > 1 ? (parseFloat(p.mrp) / p.tabsPerStrip).toFixed(2) : p.mrp,
      p.totalStock ?? 0,
      p.batchCount ?? 0,
      p.earliestExpiry ? p.earliestExpiry.split('T')[0] : '',
      p.drugSchedule,
      p.isPrescriptionRequired ? 'Yes' : 'No',
      p.isActive ? 'Active' : 'Inactive',
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `PharmaCare_Products_Catalog_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Product catalog exported successfully')
  }

  return (
    <div className="space-y-5">
      {/* Executive Catalog Intelligence Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/70 shadow-sm bg-card/60">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Active Formulations
              </p>
              <h3 className="text-xl font-bold font-mono text-foreground mt-0.5">
                {summaryMetrics?.totalProducts ?? products.length}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {summaryMetrics?.manufacturerCount ?? 0} Pharmaceutical Brands
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Package className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm bg-card/60">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Dispensary Valuation
              </p>
              <h3 className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                {formatCurrency(summaryMetrics?.totalValuationMrp ?? 0)}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Cost: {formatCurrency(summaryMetrics?.totalValuationCost ?? 0)} ({summaryMetrics?.overallMarginPercent ?? 0}% Margin)
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm bg-card/60">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Units in Stock
              </p>
              <h3 className="text-xl font-bold font-mono text-foreground mt-0.5">
                {(summaryMetrics?.totalInStockUnits ?? 0).toLocaleString('en-IN')} <span className="text-xs font-normal text-muted-foreground">Units</span>
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {summaryMetrics?.outOfStockCount ?? 0} items currently out of stock
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Package className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm bg-card/60">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Stock & Expiry Watch
              </p>
              <h3 className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                {summaryMetrics?.lowStockCount ?? 0} <span className="text-xs font-normal text-muted-foreground">Low Stock</span>
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {summaryMetrics?.nearExpiryCount ?? 0} formulations expiring in &lt;90 days
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 1-Click Operational Triage Pills (Marg ERP / Tally Quick Filters) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1 flex items-center gap-1">
          <Filter className="h-3 w-3" /> Triage:
        </span>
        <button
          type="button"
          onClick={() => {
            setStockStatus('all')
            setDrugSchedule('all')
          }}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            stockStatus === 'all' && drugSchedule === 'all'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background hover:bg-muted/60 text-muted-foreground'
          }`}
        >
          All Formulations ({summaryMetrics?.totalProducts ?? products.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setStockStatus('in_stock')
            setDrugSchedule('all')
          }}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            stockStatus === 'in_stock'
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-background hover:bg-muted/60 text-muted-foreground'
          }`}
        >
          In Stock (
          {Math.max(0, (summaryMetrics?.totalProducts ?? 0) - (summaryMetrics?.outOfStockCount ?? 0))}
          )
        </button>
        <button
          type="button"
          onClick={() => {
            setStockStatus('low_stock')
            setDrugSchedule('all')
          }}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            stockStatus === 'low_stock'
              ? 'bg-amber-600 text-white border-amber-600'
              : 'bg-background hover:bg-muted/60 text-muted-foreground'
          }`}
        >
          Low Stock ({summaryMetrics?.lowStockCount ?? 0})
        </button>
        <button
          type="button"
          onClick={() => {
            setStockStatus('near_expiry')
            setDrugSchedule('all')
          }}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            stockStatus === 'near_expiry'
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-background hover:bg-muted/60 text-muted-foreground'
          }`}
        >
          Critical Expiry &lt;90d ({summaryMetrics?.nearExpiryCount ?? 0})
        </button>
        <button
          type="button"
          onClick={() => {
            setStockStatus('all')
            setDrugSchedule('H')
          }}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            drugSchedule === 'H'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-background hover:bg-muted/60 text-muted-foreground'
          }`}
        >
          Schedule H / H1 ({summaryMetrics?.scheduleHCount ?? 0})
        </button>
        <button
          type="button"
          onClick={() => {
            setStockStatus('out_of_stock')
            setDrugSchedule('all')
          }}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            stockStatus === 'out_of_stock'
              ? 'bg-zinc-700 text-white border-zinc-700 dark:bg-zinc-300 dark:text-zinc-900'
              : 'bg-background hover:bg-muted/60 text-muted-foreground'
          }`}
        >
          Out of Stock ({summaryMetrics?.outOfStockCount ?? 0})
        </button>
      </div>

      {/* Main Filter & Action Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-muted/20 p-2.5 rounded-lg border border-border/60">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search bar */}
          <div className="relative min-w-[220px] flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Name, Salt, SKU, Barcode, Rack…"
              className="pl-8 text-xs h-8 bg-background"
            />
          </div>

          {/* Category Filter */}
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-48 text-xs h-8 bg-background">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.parentName ? `${c.parentName} › ${c.name}` : c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Stock Status Filter */}
          <Select value={stockStatus} onValueChange={setStockStatus}>
            <SelectTrigger className="w-36 text-xs h-8 bg-background">
              <SelectValue placeholder="All Stock Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock Status</SelectItem>
              <SelectItem value="in_stock">In Stock Only</SelectItem>
              <SelectItem value="low_stock">Low Stock Alerts</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              <SelectItem value="near_expiry">Expiring Soon</SelectItem>
            </SelectContent>
          </Select>

          {/* Drug Schedule Filter */}
          <Select value={drugSchedule} onValueChange={setDrugSchedule}>
            <SelectTrigger className="w-36 text-xs h-8 bg-background">
              <SelectValue placeholder="All Schedules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schedules</SelectItem>
              <SelectItem value="H">Schedule H</SelectItem>
              <SelectItem value="H1">Schedule H1</SelectItem>
              <SelectItem value="X">Schedule X</SelectItem>
              <SelectItem value="NONE">OTC / General</SelectItem>
            </SelectContent>
          </Select>

          {/* Active Status Filter */}
          <Select value={isActive} onValueChange={setIsActive}>
            <SelectTrigger className="w-28 text-xs h-8 bg-background">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-8 text-xs px-2.5 gap-1"
            title="Export Product Catalog to CSV"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void load()
              void fetchSummary()
            }}
            disabled={loading}
            className="h-8 text-xs px-2.5"
            title="Refresh from PostgreSQL"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          {canImport && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="h-8 text-xs gap-1 px-2.5"
            >
              <Upload className="h-3.5 w-3.5" /> Import CSV
            </Button>
          )}

          {canCreate && (
            <Button
              size="sm"
              onClick={() => router.push(ROUTES.PRODUCTS_NEW)}
              className="h-8 text-xs gap-1 px-3"
            >
              <Plus className="h-3.5 w-3.5" /> Add Product
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setLabelProducts(products)
              setLabelDialogOpen(true)
            }}
            className="h-8 text-xs gap-1.5 px-3 border-teal-500/30 text-teal-800 dark:text-teal-200 hover:bg-teal-500/10"
            title="Generate and print barcodes and 2D QR codes for catalog products"
          >
            <QrCode className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            <span>QR &amp; Barcodes</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setScannerOpen(true)}
            className="h-8 text-xs gap-1.5 px-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-sm font-semibold"
            title="Scan medicine strip, blister, or carton to automatically update inventory"
          >
            <Scan className="h-3.5 w-3.5" /> AI Strip Scanner
          </Button>
        </div>
      </div>

      {/* Pagination bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Showing page <span className="font-semibold text-foreground">{page}</span> of{' '}
          <span className="font-semibold text-foreground">{Math.max(totalPages, 1)}</span>
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => load({ page: page - 1 })}
            className="h-7 text-xs px-2.5"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => load({ page: page + 1 })}
            className="h-7 text-xs px-2.5"
          >
            Next
          </Button>
        </div>
      </div>

      <ProductImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          void load({ reset: true })
          void fetchSummary()
        }}
      />

      {/* Bulk Actions Bar */}
      {selectedProductIds.length > 0 && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/30 p-2.5 rounded-lg text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-xs font-semibold px-2">
              {selectedProductIds.length} Selected
            </Badge>
            <span className="text-muted-foreground">Bulk operations across active catalog</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={bulkLoading}
              onClick={async () => {
                setBulkLoading(true)
                try {
                  const res = await fetch('/api/products/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productIds: selectedProductIds, action: 'activate' }),
                  })
                  const d = await res.json()
                  if (d.success) {
                    toast.success(d.data?.message || 'Activated products')
                    setSelectedProductIds([])
                    void load()
                    void fetchSummary()
                  }
                } finally {
                  setBulkLoading(false)
                }
              }}
              className="h-7 text-xs"
            >
              Activate All
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkLoading}
              onClick={async () => {
                setBulkLoading(true)
                try {
                  const res = await fetch('/api/products/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productIds: selectedProductIds, action: 'deactivate' }),
                  })
                  const d = await res.json()
                  if (d.success) {
                    toast.success(d.data?.message || 'Deactivated products')
                    setSelectedProductIds([])
                    void load()
                    void fetchSummary()
                  }
                } finally {
                  setBulkLoading(false)
                }
              }}
              className="h-7 text-xs text-destructive hover:text-destructive"
            >
              Deactivate All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const selected = products.filter((p) => selectedProductIds.includes(p.id))
                setLabelProducts(selected)
                setLabelDialogOpen(true)
              }}
              className="h-7 text-xs gap-1"
            >
              <Printer className="h-3 w-3" /> Print Labels ({selectedProductIds.length})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedProductIds([])}
              className="h-7 text-xs text-muted-foreground"
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      <ProductTable
        products={products}
        isLoading={loading}
        selectedProductIds={selectedProductIds}
        onToggleSelect={(id) => {
          setSelectedProductIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
          )
        }}
        onSelectAll={() => {
          if (selectedProductIds.length === products.length) {
            setSelectedProductIds([])
          } else {
            setSelectedProductIds(products.map((p) => p.id))
          }
        }}
        onAddProduct={canCreate ? () => router.push(ROUTES.PRODUCTS_NEW) : undefined}
        onViewProduct={(p) => {
          setSelectedProductId(p.id)
          setDetailModalOpen(true)
        }}
        onEditProduct={canUpdate ? (p) => router.push(ROUTES.PRODUCT_EDIT(p.id)) : undefined}
        onToggleActive={canUpdate ? handleToggleActive : undefined}
        onInspectBatches={(p) => {
          setSelectedBatchProduct(p)
          setBatchDialogOpen(true)
        }}
        onFindSubstitutes={(p) => {
          setSelectedSubstituteProduct(p)
          setSubstitutesDialogOpen(true)
        }}
        onQuickUpdateRack={(p) => {
          setEditingRackProduct(p)
          setNewRackValue(p.rack || '')
          setRackDialogOpen(true)
        }}
        onPrintLabel={(p) => {
          setLabelProducts([p])
          setLabelDialogOpen(true)
        }}
        onViewRateHistory={(p) => {
          setSelectedRateProduct(p)
          setRateDialogOpen(true)
        }}
        onRequestReorder={async (p) => {
          try {
            const res = await fetch(`/api/products/${p.id}/reorder`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            })
            const json = await res.json()
            if (json.success) {
              toast.success(
                `Reorder indent ${json.data.indentNumber} created for ${json.data.quantity} units of ${p.name}`
              )
            } else {
              toast.error(json.error?.message || 'Failed to submit indent')
            }
          } catch {
            toast.error('Failed to submit reorder indent')
          }
        }}
        onSellAtPos={(prod) => router.push('/pos')}
      />

      {/* Thermal Label & Barcode Printer Dialog */}
      <ProductLabelDialog
        products={labelProducts}
        open={labelDialogOpen}
        onOpenChange={setLabelDialogOpen}
      />

      {/* Batch Rate History & Margin Dialog */}
      <ProductRateHistoryDialog
        product={selectedRateProduct}
        open={rateDialogOpen}
        onOpenChange={setRateDialogOpen}
      />

      {/* Batch Lot Breakdown Dialog */}
      <ProductBatchDialog
        product={selectedBatchProduct}
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
      />

      {/* Generic Salt Substitutes Dialog */}
      <ProductSubstitutesDialog
        product={selectedSubstituteProduct}
        open={substitutesDialogOpen}
        onOpenChange={setSubstitutesDialogOpen}
      />

      {/* Quick Rack Relocation Modal */}
      <Dialog open={rackDialogOpen} onOpenChange={setRackDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Dispensary Rack Relocation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Update shelf, bay, or storage rack locator for{' '}
              <strong className="text-foreground">{editingRackProduct?.name}</strong>:
            </p>
            <Input
              placeholder="e.g. RACK-A1-02, SHELF-B3"
              value={newRackValue}
              onChange={(e) => setNewRackValue(e.target.value)}
              className="text-xs uppercase"
              autoFocus
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (!editingRackProduct) return
                  setSavingRack(true)
                  try {
                    const res = await fetch(`/api/products/${editingRackProduct.id}/rack`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ rack: newRackValue.trim() || null }),
                    })
                    const json = await res.json()
                    if (json.success) {
                      toast.success(`Rack updated to ${newRackValue.trim() || 'unassigned'}`)
                      setProducts((prev) =>
                        prev.map((p) =>
                          p.id === editingRackProduct.id
                            ? { ...p, rack: newRackValue.trim() || null }
                            : p
                        )
                      )
                      setRackDialogOpen(false)
                    } else {
                      toast.error(json.error?.message || 'Failed to update rack')
                    }
                  } finally {
                    setSavingRack(false)
                  }
                }
              }}
            />
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRackDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={savingRack}
              onClick={async () => {
                if (!editingRackProduct) return
                setSavingRack(true)
                try {
                  const res = await fetch(`/api/products/${editingRackProduct.id}/rack`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rack: newRackValue.trim() || null }),
                  })
                  const json = await res.json()
                  if (json.success) {
                    toast.success(`Rack updated to ${newRackValue.trim() || 'unassigned'}`)
                    setProducts((prev) =>
                      prev.map((p) =>
                        p.id === editingRackProduct.id
                          ? { ...p, rack: newRackValue.trim() || null }
                          : p
                      )
                    )
                    setRackDialogOpen(false)
                  } else {
                    toast.error(json.error?.message || 'Failed to update rack')
                  }
                } finally {
                  setSavingRack(false)
                }
              }}
              className="text-xs"
            >
              {savingRack ? 'Saving...' : 'Save Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductDetailModal
        productId={selectedProductId}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        canEdit={canUpdate}
      />

      {/* AI Strip & Packaging Scanner Modal */}
      <AiStripScannerModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onInventoryUpdated={() => {
          void load({ reset: true })
          void fetchSummary()
        }}
      />
    </div>
  )
}
