'use client'

// ─────────────────────────────────────────────────────────────
// Component — InventoryOverview
// Enterprise-grade Hub for Complete Pharmacy Inventory Management:
// - Real-time Stock Valuation & Executive KPIs
// - Live Stock Matrix with Expandable FEFO Batch Drawers
// - Rack & Box Physical Location Layout
// - Multi-Threaded Dead Stock & Capital Lockup Analysis
// - Vendor / Distributor-Specific Inventory Tracking
// - Critical FEFO Expiry Radar Matrix
// - Unified Stock Adjustments & Movement Audit Ledger
// - Instant 1-Click POS Billing Dispenser Sync
// ─────────────────────────────────────────────────────────────
import {
  AlertTriangle,
  Barcode,
  Boxes,
  Camera,
  Clock,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Layers,
  MapPin,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingDown,
  Truck,
  Zap,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { AdjustmentFormDialog } from '@/components/inventory/adjustment-form'
import { AdminDeleteInventoryDialog } from '@/components/inventory/admin-delete-inventory-dialog'
import { AdminEditInventoryDialog } from '@/components/inventory/admin-edit-inventory-dialog'
import { AdjustmentsView } from '@/components/inventory/adjustments-view'
import { DeadStockView } from '@/components/inventory/dead-stock-view'
import { EditLocationDialog } from '@/components/inventory/edit-location-dialog'
import { FefoExpiryRadar } from '@/components/inventory/fefo-expiry-radar'
import { InventoryKpiCards } from '@/components/inventory/inventory-kpi-cards'
import {
  InventoryLifecycleTabs,
  type InventoryTab,
} from '@/components/inventory/inventory-lifecycle-tabs'
import { InventoryTable, type InventoryRow } from '@/components/inventory/inventory-table'
import { MovementsView } from '@/components/inventory/movements-view'
import { RackBoxView } from '@/components/inventory/rack-box-view'
import { VendorInventoryView } from '@/components/inventory/vendor-inventory-view'
import { ProductSubstitutesDialog } from '@/components/products/product-substitutes-dialog'
import { SalesPatternModal } from '@/components/inventory/sales-pattern-modal'
import { AutoPoModal } from '@/components/purchases/auto-po-modal'
import { AiStripScannerModal } from '@/components/scanner/ai-strip-scanner-modal'
import { BarcodeScannerModal } from '@/components/scanner/barcode-scanner-modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/lib/hooks/use-toast'
import type { InventorySummary } from '@/lib/inventory/inventory-service'
import { playBarcodeBeep } from '@/lib/scanner/barcode-sound'
import { useBarcodeScanner } from '@/lib/scanner/use-barcode-scanner'
import {
  addPosCartItem,
  clearPosCart,
  usePosCart,
  type PosCartLine,
} from '@/lib/stores/pos-cart-store'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/lib/i18n/i18n-context'

interface InventoryOverviewProps {
  initialRows: InventoryRow[]
  initialPagination: { page: number; limit: number; total: number; pages: number }
  initialBranchId: string | null
  initialCategoryId?: string
  initialSummary?: InventorySummary | null
  canAdjust?: boolean
  canApprove?: boolean
}

interface BranchOption {
  id: string
  name: string
  code: string | null
}

interface CategoryOption {
  id: string
  name: string
  slug: string
  parentId: string | null
  parentName?: string | null
}

export function InventoryOverview({
  initialRows,
  initialPagination,
  initialBranchId,
  initialCategoryId,
  initialSummary,
  canAdjust = true,
  canApprove = true,
}: InventoryOverviewProps) {
  const router = useRouter()
  const toast = useToast()
  const { summary: posSummary } = usePosCart()
  const { data: session } = useSession()
  const { isAr, translateCategory } = useI18n()

  // Determine admin role for this session
  const isAdmin = (session?.user?.roles ?? []).some((r: string) =>
    ['admin', 'owner', 'super_admin'].includes(r.toLowerCase())
  )

  // Admin Inventory Dialogs State
  const [adminEditOpen, setAdminEditOpen] = useState(false)
  const [adminDeleteOpen, setAdminDeleteOpen] = useState(false)
  const [adminTargetRow, setAdminTargetRow] = useState<InventoryRow | null>(null)

  // Active Tab with URL synchronization
  const [activeTab, setActiveTab] = useState<InventoryTab>('stock')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      const tabParam = sp.get('tab') as InventoryTab | null
      const validTabs: InventoryTab[] = [
        'stock',
        'locations',
        'dead_stock',
        'vendors',
        'fefo',
        'adjustments',
        'movements',
      ]
      if (tabParam && validTabs.includes(tabParam)) {
        setActiveTab(tabParam)
      }
      const catParam = sp.get('categoryId')
      if (catParam) {
        setCategoryId(catParam)
      }
    }
  }, [])

  const handleSelectTab = useCallback((tab: InventoryTab) => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', tab)
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  // Stock Grid State
  const [rows, setRows] = useState<InventoryRow[]>(initialRows)
  const [totalPages, setTotalPages] = useState(initialPagination.pages)
  const [page, setPage] = useState(initialPagination.page)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [branchId, setBranchId] = useState<string>(initialBranchId ?? 'all')
  const [status, setStatus] = useState<string>('all')
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId ?? 'all')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [loading, setLoading] = useState(false)
  const [substitutesOpen, setSubstitutesOpen] = useState(false)
  const [selectedSubstituteProduct, setSelectedSubstituteProduct] = useState<any | null>(null)

  // Executive KPI Summary State
  const [summary, setSummary] = useState<InventorySummary | null>(initialSummary ?? null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  // Modals
  const [autoPoOpen, setAutoPoOpen] = useState(false)
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false)
  const [aiScannerOpen, setAiScannerOpen] = useState(false)
  const [adjustmentOpen, setAdjustmentOpen] = useState(false)
  const [selectedAdjustProduct, setSelectedAdjustProduct] = useState<{ id: string; name: string } | null>(null)
  const [salesPatternOpen, setSalesPatternOpen] = useState(false)
  const [selectedTabletProduct, setSelectedTabletProduct] = useState<{ id: string; name: string } | null>(null)

  // Location edit modal
  const [editLocationOpen, setEditLocationOpen] = useState(false)
  const [editLocationProduct, setEditLocationProduct] = useState<{
    id: string
    name: string
    sku: string
    rack?: string | null
    shelf?: string | null
    box?: string | null
  } | null>(null)

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  // Load branches and categories
  useEffect(() => {
    fetch('/api/inventory/branches')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setBranches(d.data as BranchOption[])
      })
      .catch(() => undefined)

    fetch('/api/categories/options')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) setCategories(d.data as CategoryOption[])
      })
      .catch(() => undefined)
  }, [])

  // Load Summary KPIs
  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const params = new URLSearchParams()
      if (branchId !== 'all') params.set('branchId', branchId)
      if (categoryId !== 'all') params.set('categoryId', categoryId)
      const res = await fetch(`/api/inventory/summary?${params.toString()}`)
      const json = await res.json()
      if (json.success && json.data) {
        setSummary(json.data as InventorySummary)
      }
    } catch {
      // silently fallback to prior summary
    } finally {
      setSummaryLoading(false)
    }
  }, [branchId, categoryId])

  // Load Stock Rows
  const load = useCallback(
    async (opts?: { page?: number; reset?: boolean }) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(opts?.reset ? 1 : (opts?.page ?? page)))
        params.set('limit', '20')
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (branchId !== 'all') params.set('branchId', branchId)
        if (categoryId !== 'all') params.set('categoryId', categoryId)
        if (status !== 'all') params.set('status', status)

        const res = await fetch(`/api/inventory?${params.toString()}`)
        const json = (await res.json()) as {
          success: boolean
          data?: InventoryRow[]
          pagination?: { page: number; total: number; pages: number }
        }
        if (json.success) {
          setRows(json.data ?? [])
          setTotalPages(json.pagination?.pages ?? 1)
          setPage(json.pagination?.page ?? 1)
        } else {
          toast.error('Failed to load stock')
        }
      } catch {
        toast.error('Failed to load stock')
      } finally {
        setLoading(false)
      }
    },
    [page, debouncedSearch, branchId, categoryId, status, toast]
  )

  useEffect(() => {
    void load({ reset: true })
    void loadSummary()
  }, [debouncedSearch, branchId, categoryId, status]) // eslint-disable-line react-hooks/exhaustive-deps, @typescript-eslint/no-floating-promises

  // ─── USB Hardware Barcode Scanner Listener on Inventory Page ─
  useBarcodeScanner({
    enabled: !barcodeScannerOpen && !aiScannerOpen,
    onScan: () => {
      setBarcodeScannerOpen(true)
    },
  })

  // ─── 1-Click Quick Add to POS from Inventory Table ───────────
  const handleQuickAddToPos = async (row: InventoryRow) => {
    try {
      const code = row.product.barcode || row.product.sku || row.productId
      const params = new URLSearchParams({ barcode: code })
      if (branchId !== 'all') params.set('branchId', branchId)

      const res = await fetch(`/api/barcode/lookup?${params.toString()}`)
      const json = await res.json()

      if (json.success && json.data) {
        const cartItem: PosCartLine = json.data.posCartItem
        addPosCartItem(cartItem)
        playBarcodeBeep()
        toast.success(
          `Added to POS: ${row.product.name}`,
          `Price: ₹${cartItem.mrp} · Cart items: ${posSummary.itemCount + 1}`
        )
      } else {
        toast.error('Failed to resolve product for POS')
      }
    } catch {
      toast.error('Network error adding to POS')
    }
  }

  // Quick Adjust Handler for a product
  const handleOpenAdjustDialog = (product: { id: string; name: string }) => {
    setSelectedAdjustProduct(product)
    setAdjustmentOpen(true)
  }

  // Quick Relocate Handler for a product
  const handleOpenLocationDialog = (row: InventoryRow) => {
    setEditLocationProduct({
      id: row.productId,
      name: row.product.name,
      sku: row.product.sku,
      rack: row.product.rack,
      shelf: row.product.shelf,
      box: row.product.box,
    })
    setEditLocationOpen(true)
  }

  // Export Filtered Table to CSV
  const handleExportCsv = () => {
    if (rows.length === 0) {
      toast.error('No stock items to export')
      return
    }

    const headers = [
      'Product Name',
      'SKU',
      'Barcode',
      'Rack',
      'Shelf',
      'Box',
      'Branch',
      'Total Quantity',
      'Reserved Quantity',
      'Available Quantity',
      'Reorder Level',
      'Status',
      'Last Updated',
    ]

    const csvRows = [headers.join(',')]

    for (const r of rows) {
      const vals = [
        `"${(r.product.name || '').replace(/"/g, '""')}"`,
        `"${r.product.sku || ''}"`,
        `"${r.product.barcode || ''}"`,
        `"${r.product.rack || ''}"`,
        `"${r.product.shelf || ''}"`,
        `"${r.product.box || ''}"`,
        `"${r.branch.name || ''}"`,
        r.totalQuantity,
        r.reservedQuantity,
        r.availableQuantity,
        r.product.reorderLevel,
        `"${r.stockStatus}"`,
        `"${r.updatedAt}"`,
      ]
      csvRows.push(vals.join(','))
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mpharm-stock-ledger-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Inventory Exported', `${rows.length} stock records saved to CSV`)
  }

  // Print Stock Checklist
  const handlePrintStockSheet = () => {
    window.print()
  }

  return (
    <div className="space-y-4">
      {/* Active POS Cart Banner when items exist in checkout session */}
      {posSummary.itemCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3.5 shadow-sm transition-all animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">
                  Active POS Billing Session
                </span>
                <Badge variant="outline" className="bg-background text-[11px] font-mono">
                  {posSummary.itemCount} items · {posSummary.totalUnits} units
                </Badge>
                <span className="font-bold text-primary text-sm">
                  ₹{posSummary.subtotal.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Medicines dispensed or added from inventory are waiting in the POS register.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearPosCart()
                toast.info('POS Cart cleared')
              }}
              className="h-8 gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear Cart</span>
            </Button>

            <Button
              size="sm"
              onClick={() => router.push('/pos')}
              className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>Open POS Checkout</span>
              <ExternalLink className="h-3 w-3 opacity-80" />
            </Button>
          </div>
        </div>
      )}

      {/* Executive Inventory KPIs & Valuation Header */}
      <InventoryKpiCards
        summary={summary}
        loading={summaryLoading}
        selectedFilter={status}
        onFilterClick={(st) => {
          setStatus(st)
          handleSelectTab('stock')
        }}
        onTabChange={(tab) => {
          if (tab === 'fefo') handleSelectTab('fefo')
          else if (tab === 'adjustments') handleSelectTab('adjustments')
          else handleSelectTab('stock')
        }}
        onRefresh={() => {
          void load({ reset: false })
          void loadSummary()
        }}
      />

      {/* Complete Pharmacy Inventory Lifecycle Navigator */}
      <InventoryLifecycleTabs
        currentTab={activeTab}
        onSelectTab={handleSelectTab}
        counts={{
          totalSkus: summary?.totalSkus ?? rows.length,
          nearExpiryCount: summary?.nearExpiryBatchesCount ?? 0,
          pendingAdjustmentsCount: summary?.pendingAdjustmentsCount ?? 0,
          deadStockCount: summary?.deadStockCount ?? 0,
        }}
      />

      {/* Main Tabs Container */}
      <Tabs
        value={activeTab}
        onValueChange={(val: any) => handleSelectTab(val as InventoryTab)}
        className="w-full space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <span>Chemist Action Hub:</span>
            <span className="font-semibold text-foreground capitalize">
              {activeTab === 'dead_stock' ? 'Dead Stock Radar' : activeTab.replace('_', ' ')}
            </span>
          </div>

          {/* Quick Global Action Pill: AI Strip Scanner & Adjust Stock */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedTabletProduct(null)
                setSalesPatternOpen(true)
              }}
              className="gap-1.5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-600/10 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-600 hover:text-white font-semibold text-xs shadow-xs transition-all"
            >
              <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 fill-amber-500/20" />
              <span>⚡ Sales Patterns &amp; 1-Tab Billing</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setAiScannerOpen(true)}
              className="gap-1.5 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-primary/10 border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-600 hover:text-white font-semibold text-xs shadow-xs transition-all"
            >
              <Camera className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              <Sparkles className="h-3 w-3 text-amber-500 animate-pulse" />
              <span>AI Strip Scanner</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedAdjustProduct(null)
                setAdjustmentOpen(true)
              }}
              className="gap-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Adjust Stock</span>
            </Button>
          </div>
        </div>

        {/* ─── TAB 1: LIVE STOCK MATRIX ────────────────────────── */}
        <TabsContent value="stock" className="space-y-4 focus-visible:outline-none">
          {/* Chemist Decision Strip */}
          <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-border/70 bg-gradient-to-r from-card to-background shadow-xs">
            <span className="text-[11px] font-semibold text-muted-foreground px-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
              {isAr ? 'اختصارات الصيدلي:' : 'Chemist Shortcuts:'}
            </span>
            <Button
              variant={status === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatus('all')}
              className="h-7 text-xs px-2.5 font-medium"
            >
              {isAr ? `جميع الأصناف (${summary?.totalSkus ?? 0})` : `All Stock (${summary?.totalSkus ?? 0})`}
            </Button>
            <Button
              variant={status === 'low_stock' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatus('low_stock')}
              className="h-7 text-xs px-2.5 font-medium text-amber-600 dark:text-amber-400"
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              {isAr ? `نواقص المخزون (${summary?.lowStockCount ?? 0})` : `Low Stock (${summary?.lowStockCount ?? 0})`}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSelectTab('locations')}
              className="h-7 text-xs px-2.5 font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
            >
              <Boxes className="h-3 w-3 mr-1" />
              {isAr ? 'مخطط الأرفف والصناديق' : 'Rack & Box Layout'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSelectTab('fefo')}
              className="h-7 text-xs px-2.5 font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
            >
              <Clock className="h-3 w-3 mr-1" />
              {isAr ? `قريب الصلاحية (${summary?.nearExpiryBatchesCount ?? 1})` : `FEFO Near Expiry (${summary?.nearExpiryBatchesCount ?? 1})`}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSelectTab('dead_stock')}
              className="h-7 text-xs px-2.5 font-medium text-destructive hover:bg-destructive/10"
            >
              <TrendingDown className="h-3 w-3 mr-1" />
              {isAr ? 'رادار الرواكد' : 'Dead Stock Radar'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSelectTab('vendors')}
              className="h-7 text-xs px-2.5 font-medium text-sky-600 hover:text-sky-700 hover:bg-sky-500/10"
            >
              <Truck className="h-3 w-3 mr-1" />
              {isAr ? 'مخزون الموردين' : 'Vendor Inventory'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSelectTab('movements')}
              className="h-7 text-xs px-2.5 font-medium text-muted-foreground hover:text-foreground"
            >
              <FileText className="h-3 w-3 mr-1" />
              {isAr ? 'سجل التدقيق' : 'Audit Ledger'}
            </Button>
          </div>

          {/* Filters and Scanner Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-xs flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? 'ابحث عن الدواء، الكود، الرف، الخانة، الباركود...' : 'Search medicine, SKU, Rack, Shelf, Box, barcode…'}
                className="pl-8 h-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="w-44 h-9 text-xs font-medium">
                  <SelectValue placeholder={isAr ? 'جميع الفروع' : 'All branches'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isAr ? 'جميع الفروع' : 'All branches'}</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-52 h-9 text-xs font-medium">
                  <SelectValue placeholder={isAr ? 'جميع التصنيفات' : 'All Classifications'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isAr ? 'جميع التصنيفات' : 'All Classifications'}</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.parentName ? `${c.parentName} › ${isAr ? translateCategory(c.name) : c.name}` : (isAr ? translateCategory(c.name) : c.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-32 h-9 text-xs font-medium">
                  <SelectValue placeholder={isAr ? 'جميع الحالات' : 'All status'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isAr ? 'جميع الحالات' : 'All status'}</SelectItem>
                  <SelectItem value="in_stock">{isAr ? 'متوفر بالمخزون' : 'In Stock'}</SelectItem>
                  <SelectItem value="low_stock">{isAr ? 'رصيد منخفض' : 'Low Stock'}</SelectItem>
                  <SelectItem value="out_of_stock">{isAr ? 'نفد من المخزون' : 'Out of Stock'}</SelectItem>
                  <SelectItem value="overstock">{isAr ? 'مخزون فائض' : 'Overstock'}</SelectItem>
                </SelectContent>
              </Select>

              {/* Barcode Scanner Launch Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBarcodeScannerOpen(true)}
                className="h-9 gap-1.5 border-primary/40 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground font-medium text-xs transition-all shadow-xs"
              >
                <Barcode className="h-4 w-4" />
                <span>{isAr ? 'قارئ الباركود' : 'Barcode Gun'}</span>
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={() => setAutoPoOpen(true)}
                className="h-9 gap-1.5 bg-primary hover:bg-primary/90 text-xs"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isAr ? 'أمر شراء ذكي' : 'Auto-PO'}</span>
              </Button>

              {/* Export CSV */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportCsv}
                className="h-9 gap-1 text-xs text-muted-foreground hover:text-foreground"
                title={isAr ? 'تصدير كشف المخزون إلى ملف CSV' : 'Export stock ledger to CSV'}
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span className="hidden sm:inline">{isAr ? 'تصدير كشف' : 'Export CSV'}</span>
              </Button>

              {/* Print Stock Sheet */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrintStockSheet}
                className="h-9 gap-1 text-xs text-muted-foreground hover:text-foreground"
                title={isAr ? 'طباعة كشف الجرد الفعلي للمخزون' : 'Print physical stock audit sheet'}
              >
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">{isAr ? 'طباعة' : 'Print'}</span>
              </Button>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="text-xs text-muted-foreground">
                {isAr ? `صفحة ${page} من ${Math.max(totalPages, 1)}` : `Page ${page} of ${Math.max(totalPages, 1)}`}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => load({ page: page - 1 })}
                className="h-8 px-2 text-xs"
              >
                {isAr ? 'السابق' : 'Prev'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => load({ page: page + 1 })}
                className="h-8 px-2 text-xs"
              >
                {isAr ? 'التالي' : 'Next'}
              </Button>
            </div>
          </div>

          {/* Quick 1-Click Status Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setStatus('all')}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                status === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Boxes className="h-3 w-3" />
              <span>{isAr ? `جميع المخزون (${summary?.totalSkus ?? rows.length})` : `All Stock (${summary?.totalSkus ?? rows.length})`}</span>
            </button>

            <button
              type="button"
              onClick={() => setStatus('in_stock')}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                status === 'in_stock'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>{isAr ? 'متوفر' : 'In Stock'}</span>
            </button>

            <button
              type="button"
              onClick={() => setStatus('low_stock')}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                status === 'low_stock'
                  ? 'bg-amber-600 text-white shadow-xs font-semibold'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>{isAr ? `رصيد منخفض (${summary?.lowStockCount ?? 0})` : `Low Stock (${summary?.lowStockCount ?? 0})`}</span>
            </button>

            <button
              type="button"
              onClick={() => setStatus('out_of_stock')}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                status === 'out_of_stock'
                  ? 'bg-rose-600 text-white shadow-xs font-semibold'
                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              <span>{isAr ? `نافد (${summary?.outOfStockCount ?? 0})` : `Out of Stock (${summary?.outOfStockCount ?? 0})`}</span>
            </button>

            <button
              type="button"
              onClick={() => setStatus('overstock')}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                status === 'overstock'
                  ? 'bg-sky-600 text-white shadow-xs font-semibold'
                  : 'bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
              <span>{isAr ? 'مخزون فائض' : 'Overstock'}</span>
            </button>
          </div>

          <InventoryTable
            rows={rows}
            isLoading={loading}
            onQuickAddToPos={handleQuickAddToPos}
            onScanProduct={() => setBarcodeScannerOpen(true)}
            onAdjustProduct={(row) =>
              handleOpenAdjustDialog({ id: row.productId, name: row.product.name })
            }
            onEditLocation={handleOpenLocationDialog}
            onTabletSale={(row) => {
              setSelectedTabletProduct({ id: row.productId, name: row.product.name })
              setSalesPatternOpen(true)
            }}
            onViewSubstitutes={(row) => {
              setSelectedSubstituteProduct({
                id: row.productId,
                name: row.product.name,
                genericName: (row.product as any).genericName || null,
                sku: row.product.sku,
              })
              setSubstitutesOpen(true)
            }}
            isAdmin={isAdmin}
            onEditItem={(row) => {
              setAdminTargetRow(row)
              setAdminEditOpen(true)
            }}
            onDeleteItem={(row) => {
              setAdminTargetRow(row)
              setAdminDeleteOpen(true)
            }}
          />
        </TabsContent>

        {/* ─── TAB 2: RACK & BOX PHYSICAL STORAGE MAP ─────────── */}
        <TabsContent value="locations" className="focus-visible:outline-none">
          <RackBoxView
            branchId={branchId}
            onSelectProduct={(pId) => {
              setSearch(pId)
              handleSelectTab('stock')
            }}
          />
        </TabsContent>

        {/* ─── TAB 3: DEAD STOCK & CAPITAL LOCKUP RADAR ───────── */}
        <TabsContent value="dead_stock" className="focus-visible:outline-none">
          <DeadStockView branchId={branchId} />
        </TabsContent>

        {/* ─── TAB 4: VENDOR SPECIFIC INVENTORY ───────────────── */}
        <TabsContent value="vendors" className="focus-visible:outline-none">
          <VendorInventoryView
            branchId={branchId}
            onOpenAutoPo={() => setAutoPoOpen(true)}
          />
        </TabsContent>

        {/* ─── TAB 5: FEFO EXPIRY RADAR ───────────────────────── */}
        <TabsContent value="fefo" className="focus-visible:outline-none">
          <FefoExpiryRadar
            branchId={branchId}
            onAdjustProduct={(productId, productName) =>
              handleOpenAdjustDialog({ id: productId, name: productName })
            }
          />
        </TabsContent>

        {/* ─── TAB 6: STOCK ADJUSTMENTS ───────────────────────── */}
        <TabsContent value="adjustments" className="focus-visible:outline-none">
          <AdjustmentsView
            initialRows={[]}
            initialPagination={{ page: 1, limit: 20, total: 0, pages: 1 }}
            initialBranchId={branchId !== 'all' ? branchId : initialBranchId}
            canAdjust={canAdjust}
            canApprove={canApprove}
          />
        </TabsContent>

        {/* ─── TAB 7: MOVEMENT AUDIT LEDGER ───────────────────── */}
        <TabsContent value="movements" className="focus-visible:outline-none">
          <MovementsView
            initialRows={[]}
            initialPagination={{ page: 1, limit: 20, total: 0, pages: 1 }}
            initialBranchId={branchId !== 'all' ? branchId : initialBranchId}
          />
        </TabsContent>
      </Tabs>

      {/* Auto-PO Dialog */}
      <AutoPoModal
        open={autoPoOpen}
        onOpenChange={setAutoPoOpen}
        branchId={branchId !== 'all' ? branchId : undefined}
        onSuccess={() => {
          void load({ reset: true })
          void loadSummary()
        }}
      />

      {/* Hardware Barcode Scanner Modal */}
      <BarcodeScannerModal
        open={barcodeScannerOpen}
        onOpenChange={setBarcodeScannerOpen}
        branchId={branchId !== 'all' ? branchId : undefined}
        mode="inventory"
      />

      {/* AI Strip & Packaging Scanner Modal (Gemini 2.5 Flash AI Vision + Smartphone Ingest) */}
      <AiStripScannerModal
        open={aiScannerOpen}
        onOpenChange={setAiScannerOpen}
        onInventoryUpdated={() => {
          void load({ reset: true })
          void loadSummary()
          toast.success('Live Stock Synchronized', 'Scanned medicine strip ingested into inventory records.')
        }}
      />

      {/* Quick Stock Adjustment Dialog */}
      <AdjustmentFormDialog
        open={adjustmentOpen}
        onOpenChange={(open) => {
          setAdjustmentOpen(open)
          if (!open) setSelectedAdjustProduct(null)
        }}
        defaultBranchId={branchId !== 'all' ? branchId : initialBranchId}
        defaultProductId={selectedAdjustProduct?.id}
        defaultProductName={selectedAdjustProduct?.name}
        onCreated={(message) => {
          toast.success('Stock Adjustment Recorded', message)
          void load({ reset: false })
          void loadSummary()
        }}
      />

      {/* Chemist Sales Pattern & 1-Tablet Auto-Billing Modal */}
      <SalesPatternModal
        open={salesPatternOpen}
        onOpenChange={(open) => {
          setSalesPatternOpen(open)
          if (!open) setSelectedTabletProduct(null)
        }}
        branchId={branchId !== 'all' ? branchId : initialBranchId}
        initialProductId={selectedTabletProduct?.id}
        onSaleCompleted={() => {
          void load({ reset: false })
          void loadSummary()
        }}
      />

      {/* Storage Location Relocate Dialog (Rack > Shelf > Box) */}
      <EditLocationDialog
        open={editLocationOpen}
        onOpenChange={setEditLocationOpen}
        product={editLocationProduct}
        onSaved={() => {
          void load({ reset: false })
          void loadSummary()
        }}
      />

      {/* Admin Edit Inventory Dialog (strictly Admin) */}
      <AdminEditInventoryDialog
        open={adminEditOpen}
        onOpenChange={(open) => {
          setAdminEditOpen(open)
          if (!open) setAdminTargetRow(null)
        }}
        row={adminTargetRow}
        isAdmin={isAdmin}
        onSaved={() => {
          void load({ reset: false })
          void loadSummary()
        }}
      />

      {/* Admin Delete Inventory Dialog (strictly Admin, double-confirm) */}
      <AdminDeleteInventoryDialog
        open={adminDeleteOpen}
        onOpenChange={(open) => {
          setAdminDeleteOpen(open)
          if (!open) setAdminTargetRow(null)
        }}
        row={adminTargetRow}
        isAdmin={isAdmin}
        onDeleted={() => {
          void load({ reset: true })
          void loadSummary()
        }}
      />
    </div>
  )
}
