'use client'

// ─────────────────────────────────────────────────────────────
// Component — CategoryManager (Enterprise Tier-1 Standards)
// Manages category hierarchy, live metrics, flat/tree modes,
// search filters, and dialog operations.
// ─────────────────────────────────────────────────────────────
import {
  Pencil,
  Plus,
  Trash2,
  ListTree,
  List,
  Search,
  RefreshCw,
  FolderTree,
  Package,
  Layers,
  ArrowUpDown,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Maximize2,
  Minimize2,
  Download,
  AlertTriangle,
  ShieldAlert,
  TrendingUp,
  Boxes,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { DispensaryCategoryRollup, CategoryAnalyticsMetric } from '@/lib/categories/category-analytics-service'
import { useToast } from '@/lib/hooks/use-toast'
import { useUiStore } from '@/lib/stores/ui-store'

import { CategoryForm } from './category-form'
import { CategoryTree, type CategoryNode } from './category-tree'

export type CategoryOption = {
  id: string
  name: string
  slug: string
  parentId: string | null
  productCount: number
  isActive: boolean
}

// ─── Flat helpers ─────────────────────────────────────────────

function flattenTree(nodes: CategoryNode[]): CategoryOption[] {
  const out: CategoryOption[] = []
  function walk(list: CategoryNode[]) {
    for (const n of list) {
      out.push({
        id: n.id,
        name: n.name,
        slug: n.slug,
        parentId: n.parentId ?? null,
        productCount: n.productCount,
        isActive: n.isActive,
      })
      if (n.children && n.children.length > 0) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

function countAllSubcategories(nodes: CategoryNode[]): number {
  let count = 0
  function walk(list: CategoryNode[]) {
    for (const n of list) {
      if (n.children && n.children.length > 0) {
        count += n.children.length
        walk(n.children)
      }
    }
  }
  walk(nodes)
  return count
}

// ─── Component ───────────────────────────────────────────────

export function CategoryManager({ canManage = true }: { canManage?: boolean }) {
  const toast = useToast()
  const { openConfirmDialog } = useUiStore()

  const [tree, setTree] = useState<CategoryNode[]>([])
  const [analytics, setAnalytics] = useState<DispensaryCategoryRollup | null>(null)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryNode | undefined>(undefined)
  const [presetParentId, setPresetParentId] = useState<string | undefined>(undefined)
  const [showFlat, setShowFlat] = useState(false)
  const [search, setSearch] = useState('')
  const [expandAll, setExpandAll] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [treeRes, analyticsRes] = await Promise.all([
        fetch('/api/categories?tree=true'),
        fetch('/api/categories/analytics'),
      ])
      const [treeJson, analyticsJson] = await Promise.all([
        treeRes.json() as Promise<{ success: boolean; data?: CategoryNode[] }>,
        analyticsRes.json() as Promise<{ success: boolean; data?: DispensaryCategoryRollup }>,
      ])

      if (treeJson.success && treeJson.data) {
        setTree(treeJson.data)
      }
      if (analyticsJson.success && analyticsJson.data) {
        setAnalytics(analyticsJson.data)
      }
    } catch {
      toast.error('Failed to load categories or live valuation analytics')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const allFlatOptions = useMemo(() => flattenTree(tree), [tree])

  // Map of ID -> Name for flat table parent lookup
  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const opt of allFlatOptions) {
      map.set(opt.id, opt.name)
    }
    return map
  }, [allFlatOptions])

  // Metrics
  const totalRootCategories = tree.length
  const totalSubcategories = countAllSubcategories(tree)
  const totalProductsMapped = allFlatOptions.reduce((acc, c) => acc + (c.productCount || 0), 0)

  // Export Category Catalog to CSV
  function handleExportCsv() {
    if (allFlatOptions.length === 0) {
      toast.error('No categories to export')
      return
    }

    const headers = [
      'Category Name',
      'Parent Category',
      'Slug',
      'Products Mapped',
      'Stock Units',
      'Valuation Cost (INR)',
      'Valuation MRP (INR)',
      'Margin %',
      'Near Expiry Batches',
      'Schedule H / Rx',
      'Status',
    ]

    const rows = allFlatOptions.map((cat) => {
      const metric = analytics?.categoryMetrics?.[cat.id]
      const parentName = cat.parentId ? categoryNameMap.get(cat.parentId) ?? '' : 'Root'
      return [
        `"${cat.name.replace(/"/g, '""')}"`,
        `"${parentName.replace(/"/g, '""')}"`,
        `"${cat.slug}"`,
        cat.productCount,
        metric?.availableStockUnits ?? 0,
        metric?.valuationCost ?? 0,
        metric?.valuationMrp ?? 0,
        metric?.marginPercent ?? 0,
        metric?.nearExpiryBatchesCount ?? 0,
        (metric?.scheduleCount ?? 0) > 0 ? 'Yes' : 'No',
        cat.isActive ? 'Active' : 'Inactive',
      ]
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `PharmaCare_Category_Catalog_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Category catalog exported successfully')
  }

  function openAdd(parentId?: string) {
    setEditing(undefined)
    setPresetParentId(parentId)
    setFormOpen(true)
  }

  function openEdit(node: CategoryNode) {
    setEditing(node)
    setPresetParentId(undefined)
    setFormOpen(true)
  }

  function handleAddSub(parentNode: CategoryNode) {
    openAdd(parentNode.id)
  }

  function handleDelete(node: CategoryNode) {
    openConfirmDialog({
      title: 'Deactivate Category',
      description: `This will deactivate "${node.name}". Any existing products will keep their category tags.`,
      variant: 'destructive',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/categories/${node.id}`, { method: 'DELETE' })
          if (res.ok) {
            toast.success('Category deactivated successfully')
            void refresh()
          } else {
            const json = (await res.json()) as { error?: { message?: string } }
            toast.error(json.error?.message ?? 'Failed to delete category')
          }
        } catch {
          toast.error('Network error deleting category')
        }
      },
    })
  }

  return (
    <div className="space-y-5">
      {/* Enterprise Tier-1 KPI Valuation & Compliance Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/70 shadow-sm bg-card/60">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Hierarchy Groups
              </p>
              <h3 className="text-xl font-bold font-mono text-foreground mt-0.5">
                {totalRootCategories} <span className="text-xs font-normal text-muted-foreground">Roots</span> • {totalSubcategories} <span className="text-xs font-normal text-muted-foreground">Subs</span>
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {totalProductsMapped} items mapped in catalog
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <FolderTree className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm bg-card/60">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Stock Valuation (MRP)
              </p>
              <h3 className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{(analytics?.grandTotals.totalValuationMrp ?? 0).toLocaleString('en-IN')}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Cost: ₹{(analytics?.grandTotals.totalValuationCost ?? 0).toLocaleString('en-IN')} ({analytics?.grandTotals.overallMarginPercent ?? 0}% Margin)
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
                Inventory Units
              </p>
              <h3 className="text-xl font-bold font-mono text-foreground mt-0.5">
                {(analytics?.grandTotals.totalInventoryUnits ?? 0).toLocaleString('en-IN')} <span className="text-xs font-normal text-muted-foreground">Units</span>
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Across {analytics?.grandTotals.totalProductsMapped ?? totalProductsMapped} active formulations
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
                Risk & Expiry Watch
              </p>
              <h3 className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                {analytics?.grandTotals.totalNearExpiryBatches ?? 0} <span className="text-xs font-normal text-muted-foreground">Expiring</span>
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {analytics?.grandTotals.totalLowStockProducts ?? 0} low stock alert thresholds
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/20 p-2.5 rounded-lg border border-border/60">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search categories by name, slug or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-8 bg-background"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* View mode toggle */}
          <div className="flex bg-muted p-0.5 rounded-md border border-border/40">
            <Button
              variant={showFlat ? 'ghost' : 'secondary'}
              size="sm"
              onClick={() => setShowFlat(false)}
              className="h-7 text-xs px-2.5 gap-1"
            >
              <ListTree className="h-3.5 w-3.5" /> Tree
            </Button>
            <Button
              variant={showFlat ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowFlat(true)}
              className="h-7 text-xs px-2.5 gap-1"
            >
              <List className="h-3.5 w-3.5" /> Flat List
            </Button>
          </div>

          {!showFlat && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandAll((v) => !v)}
              className="h-7 text-xs gap-1 px-2.5"
              title={expandAll ? 'Collapse All Tree Nodes' : 'Expand All Tree Nodes'}
            >
              {expandAll ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              {expandAll ? 'Collapse' : 'Expand'}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-7 text-xs px-2.5 gap-1"
            title="Export Category Master Catalog to CSV"
          >
            <Download className="h-3 w-3" /> Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading}
            className="h-7 text-xs px-2.5"
            title="Refresh from PostgreSQL"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          {canManage && (
            <Button size="sm" onClick={() => openAdd()} className="h-7 text-xs gap-1 px-3">
              <Plus className="h-3.5 w-3.5" /> Add Root Category
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-border/60 bg-card/40 gap-2">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Hydrating categories from PostgreSQL…</p>
        </div>
      ) : tree.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted gap-2 text-center p-6">
          <FolderTree className="h-8 w-8 text-muted-foreground/60" />
          <h4 className="text-sm font-semibold text-foreground">No Categories Found</h4>
          <p className="text-xs text-muted-foreground max-w-sm">
            Categories organize medicines into therapeutic classifications and dosage forms.
          </p>
          {canManage && (
            <Button size="sm" onClick={() => openAdd()} className="mt-2 text-xs gap-1">
              <Plus className="h-3.5 w-3.5" /> Create First Category
            </Button>
          )}
        </div>
      ) : showFlat ? (
        <FlatCategoryTable
          categories={allFlatOptions}
          searchQuery={search}
          categoryNameMap={categoryNameMap}
          canManage={canManage}
          treeNodes={tree}
          analyticsMetrics={analytics?.categoryMetrics}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      ) : (
        <div className="rounded-xl border border-border/70 bg-card shadow-sm p-3.5">
          <CategoryTree
            nodes={tree}
            canManage={canManage}
            searchQuery={search}
            expandAll={expandAll}
            analyticsMetrics={analytics?.categoryMetrics}
            onEdit={openEdit}
            onDelete={handleDelete}
            onAddSub={handleAddSub}
          />
        </div>
      )}

      {/* Form dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-primary" />
              {editing
                ? `Edit Category: ${editing.name}`
                : presetParentId
                  ? `Add Sub-Category under "${categoryNameMap.get(presetParentId) || 'Parent'}"`
                  : 'Add New Root Category'}
            </DialogTitle>
          </DialogHeader>
          <CategoryForm
            key={editing?.id ?? presetParentId ?? 'root'}
            initialData={
              editing
                ? editing
                : presetParentId
                  ? {
                      id: '',
                      name: '',
                      slug: '',
                      description: '',
                      parentId: presetParentId,
                      sortOrder: 0,
                      isActive: true,
                    }
                  : undefined
            }
            categories={allFlatOptions}
            onSuccess={() => {
              setFormOpen(false)
              void refresh()
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Flat table sub-component ─────────────────────────────────

function FlatCategoryTable({
  categories,
  searchQuery,
  categoryNameMap,
  canManage,
  treeNodes,
  analyticsMetrics,
  onEdit,
  onDelete,
}: {
  categories: CategoryOption[]
  searchQuery: string
  categoryNameMap: Map<string, string>
  canManage: boolean
  treeNodes: CategoryNode[]
  analyticsMetrics?: Record<string, CategoryAnalyticsMetric>
  onEdit: (node: CategoryNode) => void
  onDelete: (node: CategoryNode) => void
}) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return categories
    const q = searchQuery.toLowerCase()
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.parentId && (categoryNameMap.get(c.parentId) || '').toLowerCase().includes(q))
    )
  }, [categories, searchQuery, categoryNameMap])

  function findNode(nodes: CategoryNode[], id: string): CategoryNode | null {
    for (const n of nodes) {
      if (n.id === id) return n
      const found = findNode(n.children, id)
      if (found) return found
    }
    return null
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-medium">
              <th className="py-2.5 px-4 font-semibold">Category Name</th>
              <th className="py-2.5 px-4 font-semibold">URL Slug</th>
              <th className="py-2.5 px-4 font-semibold">Parent Classification</th>
              <th className="py-2.5 px-4 font-semibold text-center">Mapped Products</th>
              <th className="py-2.5 px-4 font-semibold text-right">Valuation (MRP / Cost)</th>
              <th className="py-2.5 px-4 font-semibold text-center">Compliance & Risks</th>
              <th className="py-2.5 px-4 font-semibold text-center">Status</th>
              {canManage && <th className="py-2.5 px-4 font-semibold text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.length > 0 ? (
              filtered.map((cat) => {
                const parentName = cat.parentId ? categoryNameMap.get(cat.parentId) : null
                const metric = analyticsMetrics?.[cat.id]
                return (
                  <tr key={cat.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        {cat.parentId ? (
                          <span className="text-muted-foreground/60 text-xs pl-2">↳</span>
                        ) : (
                          <FolderTree className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span>{cat.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                      /{cat.slug}
                    </td>
                    <td className="py-3 px-4">
                      {parentName ? (
                        <Badge variant="outline" className="text-[11px] font-normal py-0">
                          {parentName}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-[11px] italic">Root Group</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <Link
                          href={`/products?categoryId=${cat.id}`}
                          className="inline-flex items-center gap-1 font-mono text-[11px] hover:text-primary transition-colors"
                          title="View in Product Catalog"
                        >
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs px-2 py-0.5 hover:bg-primary/20"
                          >
                            <Package className="h-3 w-3 mr-1" />
                            {cat.productCount}
                          </Badge>
                        </Link>
                        {metric && metric.availableStockUnits > 0 && (
                          <Link
                            href={`/inventory?categoryId=${cat.id}`}
                            className="inline-flex items-center gap-1 font-mono text-[11px] hover:text-emerald-600 transition-colors"
                            title="View in Inventory Management"
                          >
                            <Badge
                              variant="outline"
                              className="font-mono text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                            >
                              <Boxes className="h-2.5 w-2.5 mr-1" />
                              {metric.availableStockUnits}
                            </Badge>
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {metric && metric.valuationMrp > 0 ? (
                        <div>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            ₹{metric.valuationMrp.toLocaleString('en-IN')}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            Cost: ₹{metric.valuationCost.toLocaleString('en-IN')} ({metric.marginPercent}%)
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {metric && metric.scheduleCount > 0 ? (
                          <Badge
                            variant="outline"
                            className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] py-0 gap-0.5"
                          >
                            <ShieldAlert className="h-2.5 w-2.5" />
                            Sched H ({metric.scheduleCount})
                          </Badge>
                        ) : null}
                        {metric && metric.nearExpiryBatchesCount > 0 ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] py-0 gap-0.5"
                          >
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {metric.nearExpiryBatchesCount} exp
                          </Badge>
                        ) : null}
                        {(!metric || (metric.scheduleCount === 0 && metric.nearExpiryBatchesCount === 0)) && (
                          <span className="text-muted-foreground text-[11px] italic">Standard</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {cat.isActive ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[10px] py-0">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30 gap-1 text-[10px] py-0">
                          <XCircle className="h-2.5 w-2.5" />
                          Inactive
                        </Badge>
                      )}
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              const node = findNode(treeNodes, cat.id)
                              if (node) onEdit(node)
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                            onClick={() => {
                              const node = findNode(treeNodes, cat.id)
                              if (node) onDelete(node)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  No matching categories found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
