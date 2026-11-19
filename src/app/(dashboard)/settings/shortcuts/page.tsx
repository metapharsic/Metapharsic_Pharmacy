'use client'

import React, { useState } from 'react'
import {
  Keyboard,
  Search,
  Printer,
  Sparkles,
  Zap,
  ArrowRight,
  ShoppingCart,
  Boxes,
  Users,
  CheckCircle2,
  SlidersHorizontal,
  BookmarkCheck,
  FileSpreadsheet,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CHEMIST_SHORTCUTS, ShortcutItem } from '@/components/shared/keyboard-shortcuts-dialog'
import { cn } from '@/lib/utils/cn'

export default function ShortcutsPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [viewMode, setViewMode] = useState<'tiles' | 'grid'>('tiles')

  const categories = ['ALL', 'POS & Billing', 'Inventory & Purchases', 'Clinical & Directory', 'System Navigation']

  const filtered = CHEMIST_SHORTCUTS.filter((sc) => {
    const matchCategory = selectedCategory === 'ALL' || sc.category === selectedCategory
    const q = search.toLowerCase().trim()
    const matchSearch =
      !q ||
      sc.action.toLowerCase().includes(q) ||
      sc.description.toLowerCase().includes(q) ||
      sc.keys.some((k) => k.toLowerCase().includes(q))
    return matchCategory && matchSearch
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200">
              <Keyboard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Chemist Fast Keyboard Shortcuts Master Guide</span>
                <Badge variant="outline" className="border-teal-500/40 text-teal-700 dark:text-teal-300 text-[10px]">
                  F1 Active
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Complete hotkeys reference for high-speed dispensing counters, rapid inventory scanning, and zero-mouse operation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          {/* View Mode Toggle: Tiles vs Grid */}
          <div className="flex items-center border border-border/80 rounded-lg p-0.5 bg-muted/50">
            <button
              type="button"
              onClick={() => setViewMode('tiles')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                viewMode === 'tiles'
                  ? 'bg-card text-teal-700 dark:text-teal-300 shadow-2xs font-bold border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Tiles / Card View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Tiles View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                viewMode === 'grid'
                  ? 'bg-card text-teal-700 dark:text-teal-300 shadow-2xs font-bold border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Grid / Table View"
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Grid / Table</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5 text-xs h-8"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Counter Cheat Sheet</span>
          </Button>
        </div>
      </div>

      {/* 3 High-Speed Workflow Pro-Tips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-teal-500/30 bg-teal-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-teal-600" />
                <span>5-Sec Cash Sale</span>
              </span>
              <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono text-[10px] font-bold">F2 &rarr; F9</kbd>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Instant Billing Flow:</p>
            <p className="text-[11px]">
              Press <kbd className="px-1 py-0.5 rounded bg-muted border font-mono font-bold">F2</kbd> anywhere &rarr; Scan medicine barcode &rarr; Press <kbd className="px-1 py-0.5 rounded bg-muted border font-mono font-bold">F9</kbd> to tender exact cash & auto-print invoice!
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <BookmarkCheck className="h-4 w-4 text-amber-600" />
                <span>Hold & Resume Cart</span>
              </span>
              <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono text-[10px] font-bold">F10</kbd>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Urgent Customer Interruption:</p>
            <p className="text-[11px]">
              If a customer stepped away to check another medicine, press <kbd className="px-1 py-0.5 rounded bg-muted border font-mono font-bold">F10</kbd> to hold their cart, bill the next customer, then recall it in one click!
            </p>
          </CardContent>
        </Card>

        <Card className="border-indigo-500/30 bg-indigo-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
                <span>Distributor Bill OCR</span>
              </span>
              <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono text-[10px] font-bold">F6</kbd>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Zero-Typing Inward Stock:</p>
            <p className="text-[11px]">
              Press <kbd className="px-1 py-0.5 rounded bg-muted border font-mono font-bold">F6</kbd> to launch bill scanner. Upload your wholesaler PDF/Image to auto-create products, batches, and stock valuations.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg border border-border/80 bg-card">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search shortcut (e.g. F2, Bill, Prescriptions, Expiry, Returns)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs h-9 bg-background"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors',
                selectedCategory === cat
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* VIEW 1: TILES / CARDS VIEW */}
      {viewMode === 'tiles' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((sc, idx) => (
            <Card key={idx} className="border-border/80 shadow-xs hover:border-teal-500/40 transition-all flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {sc.keys.map((k, i) => (
                      <React.Fragment key={i}>
                        <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded border border-border/90 bg-muted font-mono text-xs font-extrabold text-foreground shadow-2xs">
                          {k}
                        </kbd>
                        {i < sc.keys.length - 1 && <span className="text-muted-foreground font-bold text-xs">+</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                    {sc.context || sc.category}
                  </Badge>
                </div>
                <CardTitle className="text-sm font-bold text-foreground mt-2">{sc.action}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground pt-0 space-y-3">
                <p className="leading-relaxed">{sc.description}</p>
                {sc.href && (
                  <div className="pt-2 border-t border-border/50 flex justify-end">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-xs text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40 gap-1 font-semibold"
                    >
                      <a href={sc.href}>
                        <span>Open Module</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* VIEW 2: GRID / TABLE VIEW */
        <div className="rounded-lg border border-border/80 overflow-hidden bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 text-xs font-bold">
                <TableHead className="w-40 font-bold">Shortcut Key</TableHead>
                <TableHead className="w-56 font-bold">Action Name</TableHead>
                <TableHead className="w-40 font-bold">Category</TableHead>
                <TableHead className="font-bold">Complete Description</TableHead>
                <TableHead className="w-32 font-bold">Context</TableHead>
                <TableHead className="w-24 text-right font-bold">Launch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((sc, idx) => (
                <TableRow key={idx} className="text-xs hover:bg-muted/30">
                  <TableCell className="py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {sc.keys.map((k, i) => (
                        <React.Fragment key={i}>
                          <kbd className="inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 rounded border border-border/90 bg-muted/90 font-mono text-xs font-bold text-foreground shadow-2xs">
                            {k}
                          </kbd>
                          {i < sc.keys.length - 1 && <span className="text-muted-foreground text-[10px] font-bold">+</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-foreground py-3 text-xs">
                    {sc.action}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant="outline" className="text-[11px] font-medium">
                      {sc.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs py-3 leading-relaxed">
                    {sc.description}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground py-3">
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {sc.context || 'Everywhere'}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    {sc.href ? (
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40 font-semibold gap-1"
                      >
                        <a href={sc.href}>
                          <span>Open</span>
                          <ArrowRight className="h-3 w-3" />
                        </a>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border border-border/80">
          <Keyboard className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No shortcuts match &ldquo;{search}&rdquo;</p>
          <Button variant="outline" size="sm" onClick={() => { setSearch(''); setSelectedCategory('ALL'); }} className="mt-3 text-xs">
            Reset Filters
          </Button>
        </div>
      )}
    </div>
  )
}
