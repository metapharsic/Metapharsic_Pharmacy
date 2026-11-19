'use client'

import React, { useState } from 'react'
import {
  Keyboard,
  Search,
  ShoppingCart,
  Boxes,
  Users,
  Printer,
  Sparkles,
  Zap,
  ArrowRight,
  Receipt,
  RotateCcw,
  Tag,
  ScanLine,
  HelpCircle,
  Clock,
  CheckCircle2,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
import { cn } from '@/lib/utils/cn'

export interface ShortcutItem {
  keys: string[]
  action: string
  description: string
  category: 'POS & Billing' | 'Inventory & Purchases' | 'Clinical & Directory' | 'System Navigation'
  context?: string
  href?: string
}

export const CHEMIST_SHORTCUTS: ShortcutItem[] = [
  // POS & Billing
  {
    keys: ['F2'],
    action: 'Open POS / Billing Counter',
    description: 'Instantly opens the high-speed dispensary billing counter with automatic search focus.',
    category: 'POS & Billing',
    context: 'Everywhere',
    href: '/pos',
  },
  {
    keys: ['F9'],
    action: 'Quick Tender & Complete Bill',
    description: 'Opens payment modal, auto-fills exact amount in Cash, and prepares receipt for printing.',
    category: 'POS & Billing',
    context: 'In POS Counter',
  },
  {
    keys: ['F10'],
    action: 'Hold Current Bill',
    description: 'Suspends the active cart into the held queue so you can serve an urgent customer without losing items.',
    category: 'POS & Billing',
    context: 'In POS Counter',
  },
  {
    keys: ['Ctrl', 'Shift', 'H'],
    action: 'Recall Held Bills',
    description: 'Opens held bill drawer to resume a previously suspended cart in one click.',
    category: 'POS & Billing',
    context: 'In POS Counter',
  },
  {
    keys: ['Ctrl', 'P'],
    action: 'Attach Prescription (Rx)',
    description: 'Opens prescription selector to link doctor prescription and customer clinical records.',
    category: 'POS & Billing',
    context: 'In POS Counter',
  },
  {
    keys: ['Alt', 'D'],
    action: 'Apply Discount',
    description: 'Focuses discount percentage input for fast discount tenders.',
    category: 'POS & Billing',
    context: 'In POS Counter',
  },
  {
    keys: ['Escape'],
    action: 'Clear / Close Modal',
    description: 'Cancels the current search dropdown, clears cart confirmation, or dismisses open popup dialogs.',
    category: 'POS & Billing',
    context: 'Everywhere',
  },

  // Inventory & Purchases
  {
    keys: ['F6'],
    action: 'Scan Purchase Invoice (OCR)',
    description: 'Launches the AI-assisted bill scanner to ingest distributor invoices via camera or file upload.',
    category: 'Inventory & Purchases',
    context: 'Everywhere',
    href: '/purchases/scan',
  },
  {
    keys: ['F7'],
    action: 'Inventory Stock Overview',
    description: 'Displays live dispensary stock, valuation, low-stock warnings, and reorder levels.',
    category: 'Inventory & Purchases',
    context: 'Everywhere',
    href: '/inventory',
  },
  {
    keys: ['Alt', 'P'],
    action: 'New Purchase Entry',
    description: 'Opens manual purchase bill entry form for distributor stock reception.',
    category: 'Inventory & Purchases',
    context: 'Everywhere',
    href: '/purchases/new',
  },
  {
    keys: ['F4'],
    action: 'Batch Expiry & FEFO Watch',
    description: 'Monitors near-expiry drugs (<30d, <90d) and expired medicines requiring supplier returns.',
    category: 'Inventory & Purchases',
    context: 'Everywhere',
    href: '/expiry',
  },

  // Clinical & Directory
  {
    keys: ['F3'],
    action: 'Product Master Catalog',
    description: 'Search master formulations, compositions, schedules (H/H1/X), MRPs, and packaging.',
    category: 'Clinical & Directory',
    context: 'Everywhere',
    href: '/products',
  },
  {
    keys: ['F8'],
    action: 'Customer & Patient Directory',
    description: 'Look up customer profiles, phone numbers, loyalty points, and purchase histories.',
    category: 'Clinical & Directory',
    context: 'Everywhere',
    href: '/customers',
  },
  {
    keys: ['Alt', 'S'],
    action: 'Sales Invoices Register',
    description: 'Review historical sales invoices, reprint receipts, and track daily dispensary volume.',
    category: 'Clinical & Directory',
    context: 'Everywhere',
    href: '/sales',
  },
  {
    keys: ['Alt', 'R'],
    action: 'Sales Returns & Credit Notes',
    description: 'Process customer returns against original bills and issue credit notes or cash refunds.',
    category: 'Clinical & Directory',
    context: 'Everywhere',
    href: '/returns/sales',
  },

  // System Navigation
  {
    keys: ['F1'],
    action: 'Open Keyboard Shortcuts Guide',
    description: 'Displays this quick reference card with all chemist hotkeys and productivity guidelines.',
    category: 'System Navigation',
    context: 'Everywhere',
  },
  {
    keys: ['Ctrl', 'Shift', 'B'],
    action: 'Database Backup (Excel & Email)',
    description: 'Opens multi-threaded database backup modal to export entire database to Excel or email to specified address.',
    category: 'System Navigation',
    context: 'Everywhere',
    href: '/settings/backup',
  },
  {
    keys: ['Alt', 'H'],
    action: 'Return to Dashboard',
    description: 'Navigates back to main dispensary overview and operational alerts.',
    category: 'System Navigation',
    context: 'Everywhere',
    href: '/',
  },
]

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [viewMode, setViewMode] = useState<'tiles' | 'grid'>('tiles')

  const categories = ['ALL', 'POS & Billing', 'Inventory & Purchases', 'Clinical & Directory', 'System Navigation']

  const filteredShortcuts = CHEMIST_SHORTCUTS.filter((sc) => {
    const matchCategory = selectedCategory === 'ALL' || sc.category === selectedCategory
    const q = search.toLowerCase().trim()
    const matchSearch =
      !q ||
      sc.action.toLowerCase().includes(q) ||
      sc.description.toLowerCase().includes(q) ||
      sc.keys.some((k) => k.toLowerCase().includes(q))
    return matchCategory && matchSearch
  })

  const handlePrint = () => {
    window.print()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border-border/80 shadow-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-border/70 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200">
                <Keyboard className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <span>Chemist Fast Keyboard Shortcuts</span>
                  <Badge variant="outline" className="border-teal-500/40 text-teal-700 dark:text-teal-300 text-[10px]">
                    Zero-Mouse Billing
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Master hotkeys designed for high-speed pharmacy dispensing counters and instant stock management.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View Mode Toggle: Tiles vs Grid */}
              <div className="flex items-center border border-border/80 rounded-lg p-0.5 bg-muted/50">
                <button
                  type="button"
                  onClick={() => setViewMode('tiles')}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
                    viewMode === 'tiles'
                      ? 'bg-card text-teal-700 dark:text-teal-300 shadow-2xs font-bold border border-border/60'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Tiles / Card View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>Tiles</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
                    viewMode === 'grid'
                      ? 'bg-card text-teal-700 dark:text-teal-300 shadow-2xs font-bold border border-border/60'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Grid / Table View"
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  <span>Grid</span>
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-1.5 text-xs hidden sm:flex print:hidden h-8"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print</span>
              </Button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search shortcut by action, description, or key..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'px-2 py-1 rounded text-[11px] font-semibold whitespace-nowrap transition-colors',
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
        </DialogHeader>

        {/* Shortcuts List Body */}
        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {/* Quick Counter Tip */}
          <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-start gap-2.5 text-xs text-teal-950 dark:text-teal-200">
            <Sparkles className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">5-Second Chemist Billing Flow:</span>
              <p className="text-[11px] text-muted-foreground">
                Press <kbd className="px-1 py-0.5 rounded bg-background border font-mono font-bold text-foreground">F2</kbd> &rarr; Scan or type medicine &rarr; Press <kbd className="px-1 py-0.5 rounded bg-background border font-mono font-bold text-foreground">Enter</kbd> to add to cart &rarr; Press <kbd className="px-1 py-0.5 rounded bg-background border font-mono font-bold text-foreground">F9</kbd> to tender exact cash & print!
              </p>
            </div>
          </div>

          {/* VIEW 1: TILES VIEW */}
          {viewMode === 'tiles' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredShortcuts.map((sc, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-border/80 bg-card hover:border-teal-500/40 hover:bg-muted/20 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        {sc.keys.map((k, i) => (
                          <React.Fragment key={i}>
                            <kbd className="inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 rounded border border-border/90 bg-muted/70 font-mono text-[11px] font-bold text-foreground shadow-2xs">
                              {k}
                            </kbd>
                            {i < sc.keys.length - 1 && <span className="text-muted-foreground text-[10px]">+</span>}
                          </React.Fragment>
                        ))}
                      </div>
                      <Badge variant="outline" className="text-[9px] font-mono text-muted-foreground">
                        {sc.context || sc.category}
                      </Badge>
                    </div>
                    <h4 className="text-xs font-bold text-foreground">{sc.action}</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{sc.description}</p>
                  </div>

                  {sc.href && (
                    <div className="mt-2.5 pt-2 border-t border-border/50 flex justify-end">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40 gap-1 font-semibold"
                        onClick={() => onOpenChange(false)}
                      >
                        <a href={sc.href}>
                          <span>Launch Now</span>
                          <ArrowRight className="h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* VIEW 2: GRID / TABLE VIEW */
            <div className="rounded-lg border border-border/80 overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 text-[11px] font-bold">
                    <TableHead className="w-36">Shortcut Key</TableHead>
                    <TableHead className="w-48">Action Name</TableHead>
                    <TableHead className="w-36">Category</TableHead>
                    <TableHead>Complete Description</TableHead>
                    <TableHead className="w-28">Context</TableHead>
                    <TableHead className="w-20 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShortcuts.map((sc, idx) => (
                    <TableRow key={idx} className="text-xs hover:bg-muted/30">
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          {sc.keys.map((k, i) => (
                            <React.Fragment key={i}>
                              <kbd className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded border border-border/90 bg-muted/80 font-mono text-[10px] font-bold text-foreground shadow-2xs">
                                {k}
                              </kbd>
                              {i < sc.keys.length - 1 && <span className="text-muted-foreground text-[9px]">+</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-foreground py-2.5">
                        {sc.action}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge variant="outline" className="text-[10px]">
                          {sc.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[11px] py-2.5 leading-snug">
                        {sc.description}
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground py-2.5">
                        {sc.context || 'Everywhere'}
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        {sc.href ? (
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[10px] text-teal-600 hover:text-teal-700"
                            onClick={() => onOpenChange(false)}
                          >
                            <a href={sc.href}>
                              <ArrowRight className="h-3 w-3" />
                            </a>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredShortcuts.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <Keyboard className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-medium">No keyboard shortcuts match &ldquo;{search}&rdquo;</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border/70 bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 text-[11px]">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Shortcuts are active across all tenant &amp; chemist user accounts</span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenChange(false)}>
            Close (Esc)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
