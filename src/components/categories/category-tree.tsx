'use client'

// ─────────────────────────────────────────────────────────────
// Component — CategoryTree (Enhanced Tier-1 ERP Hierarchy)
// Recursive display of category tree with direct actions,
// product catalog links, and active status indicators.
// ─────────────────────────────────────────────────────────────
import {
  ChevronRight,
  Folder,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
  Package,
  Tag,
  AlertTriangle,
  TrendingUp,
  ShieldAlert,
  Boxes,
} from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CategoryAnalyticsMetric } from '@/lib/categories/category-analytics-service'
import { cn } from '@/lib/utils/cn'

export interface CategoryNode {
  id: string
  name: string
  slug: string
  description?: string | null
  parentId?: string | null
  isActive: boolean
  sortOrder: number
  productCount: number
  directProductCount?: number
  children: CategoryNode[]
}

interface CategoryTreeProps {
  nodes: CategoryNode[]
  depth?: number
  canManage?: boolean
  searchQuery?: string
  expandAll?: boolean
  analyticsMetrics?: Record<string, CategoryAnalyticsMetric>
  onEdit?: (node: CategoryNode) => void
  onDelete?: (node: CategoryNode) => void
  onAddSub?: (parentNode: CategoryNode) => void
}

function CategoryTreeItem({
  node,
  depth,
  canManage = true,
  searchQuery = '',
  expandAll = false,
  analyticsMetrics,
  onEdit,
  onDelete,
  onAddSub,
}: {
  node: CategoryNode
  depth: number
  canManage?: boolean
  searchQuery?: string
  expandAll?: boolean
  analyticsMetrics?: Record<string, CategoryAnalyticsMetric>
  onEdit?: (node: CategoryNode) => void
  onDelete?: (node: CategoryNode) => void
  onAddSub?: (parentNode: CategoryNode) => void
}) {
  const [expanded, setExpanded] = useState<boolean>(true)
  const hasChildren = node.children.length > 0
  const metric = analyticsMetrics?.[node.id]

  useEffect(() => {
    if (expandAll !== undefined) {
      setExpanded(expandAll)
    }
  }, [expandAll])

  // Filter matching
  const isMatch =
    !searchQuery ||
    node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (node.description && node.description.toLowerCase().includes(searchQuery.toLowerCase()))

  const hasMatchingChild = (children: CategoryNode[]): boolean => {
    if (!searchQuery) return true
    return children.some(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hasMatchingChild(c.children)
    )
  }

  const shouldRender = isMatch || hasMatchingChild(node.children)
  if (!shouldRender) return null

  return (
    <div className="group/item">
      <div
        className={cn(
          'flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
          'hover:bg-muted/50 border border-transparent hover:border-border/60',
          !node.isActive && 'opacity-60 bg-muted/20'
        )}
        style={{ paddingLeft: `${depth * 24 + 10}px` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 transition-transform"
            >
              <ChevronRight
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  expanded && 'rotate-90 text-primary'
                )}
              />
            </button>
          ) : (
            <div className="w-6 shrink-0 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-border" />
            </div>
          )}

          {hasChildren ? (
            expanded ? (
              <FolderOpen className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-primary/80 shrink-0" />
            )
          ) : (
            <Tag className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
          )}

          <div className="truncate flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground tracking-tight">{node.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              /{node.slug}
            </span>
            {node.description && (
              <span className="hidden xl:inline-block text-xs text-muted-foreground/80 truncate max-w-xs">
                — {node.description}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
          {/* Regulatory Badges */}
          {metric && metric.scheduleCount > 0 && (
            <Badge
              variant="outline"
              title={`${metric.scheduleCount} prescription/Schedule H products`}
              className="hidden sm:inline-flex bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 font-mono text-[10px] py-0 px-1.5 gap-1"
            >
              <ShieldAlert className="h-2.5 w-2.5" />
              Sched H
            </Badge>
          )}

          {/* Near Expiry Warning */}
          {metric && metric.nearExpiryBatchesCount > 0 && (
            <Badge
              variant="outline"
              title={`${metric.nearExpiryBatchesCount} batches expiring within 90 days`}
              className="hidden sm:inline-flex bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-mono text-[10px] py-0 px-1.5 gap-1"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {metric.nearExpiryBatchesCount} exp
            </Badge>
          )}

          {/* Valuation Chip */}
          {metric && metric.valuationMrp > 0 && (
            <Badge
              variant="outline"
              title={`Valuation: ₹${metric.valuationMrp.toLocaleString('en-IN')} at MRP | ₹${metric.valuationCost.toLocaleString('en-IN')} at Cost (${metric.marginPercent}% Margin)`}
              className="hidden md:inline-flex bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-mono text-[10px] py-0 px-1.5 gap-1"
            >
              <TrendingUp className="h-2.5 w-2.5" />
              ₹{metric.valuationMrp.toLocaleString('en-IN')}
            </Badge>
          )}

          {/* Direct link to mapped products in catalog */}
          <Link
            href={`/products?categoryId=${node.id}`}
            title={`View ${node.productCount} products in ${node.name}`}
            className="hover:scale-105 transition-transform"
          >
            <Badge
              variant="outline"
              className={cn(
                'gap-1 font-mono text-[11px] py-0.5 px-2 border-border/70 hover:border-primary cursor-pointer',
                node.productCount > 0
                  ? 'bg-primary/5 text-primary border-primary/30'
                  : 'bg-muted/40 text-muted-foreground'
              )}
            >
              <Package className="h-3 w-3" />
              {node.productCount} {node.productCount === 1 ? 'item' : 'items'}
              {node.children.length > 0 && (
                <span className="text-[9px] opacity-75 font-normal ml-0.5">
                  ({node.children.length} {node.children.length === 1 ? 'sub' : 'subs'})
                </span>
              )}
            </Badge>
          </Link>

          {/* Direct link to live inventory stock */}
          {metric && metric.availableStockUnits > 0 && (
            <Link
              href={`/inventory?categoryId=${node.id}`}
              title={`View ${metric.availableStockUnits} in-stock units in Inventory`}
              className="hover:scale-105 transition-transform"
            >
              <Badge
                variant="outline"
                className="gap-1 font-mono text-[11px] py-0.5 px-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:border-emerald-500 cursor-pointer"
              >
                <Boxes className="h-3 w-3" />
                {metric.availableStockUnits} stock
              </Badge>
            </Link>
          )}

          {/* Quick Actions for Managers */}
          {canManage && (
            <div className="flex items-center gap-0.5 opacity-90 sm:opacity-0 group-hover/item:opacity-100 transition-opacity">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Add Sub-category"
                onClick={() => onAddSub?.(node)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Edit Category"
                onClick={() => onEdit?.(node)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                title="Deactivate / Delete Category"
                onClick={() => onDelete?.(node)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="space-y-0.5 mt-0.5 border-l border-border/40 ml-4 sm:ml-5 pl-1">
          {node.children.map((child) => (
            <CategoryTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              canManage={canManage}
              searchQuery={searchQuery}
              expandAll={expandAll}
              analyticsMetrics={analyticsMetrics}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddSub={onAddSub}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function CategoryTree({
  nodes,
  depth = 0,
  canManage = true,
  searchQuery = '',
  expandAll = false,
  analyticsMetrics,
  onEdit,
  onDelete,
  onAddSub,
}: CategoryTreeProps) {
  if (nodes.length === 0) return null

  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <CategoryTreeItem
          key={node.id}
          node={node}
          depth={depth}
          canManage={canManage}
          searchQuery={searchQuery}
          expandAll={expandAll}
          analyticsMetrics={analyticsMetrics}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddSub={onAddSub}
        />
      ))}
    </div>
  )
}
