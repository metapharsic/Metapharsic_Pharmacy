'use client'

import {
  Check,
  ChevronRight,
  ExternalLink,
  Layers,
  Sparkles,
  Table,
  Zap,
  Split,
  GitFork,
  AlertTriangle,
  Monitor,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BILLING_FORMATS, type BillingFormatMode } from './billing-types'

interface UxComparisonModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentFormat: BillingFormatMode
  onSelectFormat: (format: BillingFormatMode) => void
}

const COMPARISON_ROWS = [
  {
    criteria: 'Billing Speed',
    format1: 'Fastest (Pure keyboard)',
    format2: 'High (Visual clarity)',
    format3: 'High (Structured browsing)',
    format4: 'Fast (Contextual alerts)',
  },
  {
    criteria: 'Learning Curve',
    format1: 'Low (Standard Accounting Grid)',
    format2: 'Medium (Modern desktop POS)',
    format3: 'Low (Standard web combobox)',
    format4: 'Very Low (Clear prompts)',
  },
  {
    criteria: 'Substitute Visibility',
    format1: 'Grouped inside dropdown (F2)',
    format2: 'Persistent in separate dock',
    format3: 'Nested under medicine node',
    format4: 'Appears only when needed',
  },
  {
    criteria: 'Screen Space Needed',
    format1: 'Compact (Single table)',
    format2: 'High (Requires dedicated height)',
    format3: 'Compact (Dropdown overlay)',
    format4: 'Expands dynamically',
  },
  {
    criteria: 'Target Pharmacy Persona',
    format1: 'Busiest retail counters & wholesale',
    format2: 'Hospital counters & counseling desks',
    format3: 'Compact laptop/tablet setups',
    format4: 'Retail stores avoiding lost sales',
  },
  {
    criteria: 'Recommended Tech',
    format1: 'React Table + Downshift / Pure Keys',
    format2: 'React Grid + Context Panel',
    format3: 'Custom Radix UI / Headless Tree',
    format4: 'TanStack Table Row Expansion',
  },
]

export function UxComparisonModal({
  open,
  onOpenChange,
  currentFormat,
  onSelectFormat,
}: UxComparisonModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-border/80 shadow-2xl">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-700 p-6 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
              <Sparkles className="h-4 w-4" />
            </span>
            <Badge variant="secondary" className="bg-white/20 text-white border-0 text-[11px] font-semibold">
              Demo & Evaluation Matrix
            </Badge>
          </div>
          <DialogTitle className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
            4 Billing Formats for Customer Experience (CX)
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-white/80 sm:text-sm">
            Compare interaction paradigms side-by-side to determine the optimal workflow for your client demo or store rollout.
          </DialogDescription>
        </div>

        {/* Comparison Matrix Table */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Format Quick Selection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {BILLING_FORMATS.filter((f) => f.id !== 'classic').map((fmt) => {
              const isSelected = currentFormat === fmt.id
              return (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => {
                    onSelectFormat(fmt.id)
                    onOpenChange(false)
                  }}
                  className={`group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/[0.04] ring-2 ring-primary/40 shadow-sm'
                      : 'border-border/70 bg-card hover:border-primary/50 hover:bg-muted/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {fmt.id.toUpperCase()}
                      </span>
                      {isSelected ? (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </span>
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {fmt.title.split(': ')[1]}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {fmt.tagline}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      ⚡ {fmt.billingSpeed}
                    </span>
                    <span className="text-muted-foreground font-mono">
                      {fmt.learningCurve} curve
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Detailed Criteria Table */}
          <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
            <div className="bg-muted/40 px-4 py-2.5 border-b border-border/60">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Detailed Evaluation Matrix
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20">
                    <th className="p-3 font-semibold text-muted-foreground w-1/5">Criteria</th>
                    <th className="p-3 font-bold text-foreground w-1/5">
                      Format 1<br />
                      <span className="text-[10px] font-normal text-muted-foreground">Classic Inline</span>
                    </th>
                    <th className="p-3 font-bold text-foreground w-1/5">
                      Format 2<br />
                      <span className="text-[10px] font-normal text-muted-foreground">Split Matrix Dock</span>
                    </th>
                    <th className="p-3 font-bold text-foreground w-1/5">
                      Format 3<br />
                      <span className="text-[10px] font-normal text-muted-foreground">Tree-Select ComboBox</span>
                    </th>
                    <th className="p-3 font-bold text-foreground w-1/5">
                      Format 4<br />
                      <span className="text-[10px] font-normal text-muted-foreground">Accordion on Warning</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {COMPARISON_ROWS.map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium text-foreground/90 bg-muted/10">
                        {row.criteria}
                      </td>
                      <td className={`p-3 leading-relaxed ${currentFormat === 'format1' ? 'bg-primary/[0.04] font-medium' : ''}`}>
                        {row.format1}
                      </td>
                      <td className={`p-3 leading-relaxed ${currentFormat === 'format2' ? 'bg-primary/[0.04] font-medium' : ''}`}>
                        {row.format2}
                      </td>
                      <td className={`p-3 leading-relaxed ${currentFormat === 'format3' ? 'bg-primary/[0.04] font-medium' : ''}`}>
                        {row.format3}
                      </td>
                      <td className={`p-3 leading-relaxed ${currentFormat === 'format4' ? 'bg-primary/[0.04] font-medium' : ''}`}>
                        {row.format4}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Demo Prescription Tip */}
          <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-3.5 text-xs text-muted-foreground">
            <div className="font-semibold text-teal-800 dark:text-teal-300 flex items-center gap-1.5 mb-1">
              <Zap className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              CX Presentation Tip
            </div>
            Type <code className="rounded bg-teal-500/15 px-1 py-0.5 font-mono text-[11px] text-teal-700 dark:text-teal-300">dolo</code> in any format to demonstrate how each handles strengths (650mg, 500mg, 100mg Drops), zero-stock triggers (120mg Syrup), and generic salt substitution (Calpol, P-650, Pacimol, Sumo L).
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
