'use client'

import {
  AlignJustify,
  Barcode,
  Camera,
  ChevronDown,
  Columns2,
  FileSpreadsheet,
  GitBranch,
  HelpCircle,
  Keyboard,
  Layers,
  Scissors,
  Sparkles,
  Split,
  TableProperties,
  Zap,
} from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BILLING_FORMATS, type BillingFormatMode } from './billing-types'
import { UxComparisonModal } from './ux-comparison-modal'

interface BillingFormatSwitcherProps {
  currentFormat: BillingFormatMode
  onChangeFormat: (format: BillingFormatMode) => void
  onOpenScanner?: () => void
  onOpenStripCounter?: () => void
  onOpenSalesPatterns?: () => void
}

const ICONS: Record<BillingFormatMode, React.ElementType> = {
  format1: Keyboard,
  format2: Split,
  format3: GitBranch,
  format4: AlertTriangleIcon,
  classic: Layers,
}

function AlertTriangleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

export function BillingFormatSwitcher({
  currentFormat,
  onChangeFormat,
  onOpenScanner,
  onOpenStripCounter,
  onOpenSalesPatterns,
}: BillingFormatSwitcherProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const activeMeta = BILLING_FORMATS.find((f) => f.id === currentFormat) ?? BILLING_FORMATS[0]
  const ActiveIcon = ICONS[currentFormat]

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3.5 py-1.5 backdrop-blur-xs">
        {/* Left: Mode Segmented Switcher */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <span className="mr-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
            <Sparkles className="h-3 w-3 text-teal-600 dark:text-teal-400" />
            Billing Layout:
          </span>

          <div className="inline-flex rounded-lg bg-background p-0.5 border border-border/70 shadow-2xs">
            {BILLING_FORMATS.map((fmt) => {
              const isActive = currentFormat === fmt.id
              const Icon = ICONS[fmt.id]
              return (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => onChangeFormat(fmt.id)}
                  title={`${fmt.title} — ${fmt.tagline}`}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{fmt.shortLabel}</span>
                  <span className="sm:hidden">{fmt.id.toUpperCase()}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: Active Format Tagline & Tools (Barcode Scan + Matrix) */}
        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline" className="border-teal-500/40 bg-teal-500/10 text-[10px] text-teal-700 dark:text-teal-300 font-mono">
              {activeMeta.badge}
            </Badge>
            <span className="text-[11px] truncate max-w-xs">{activeMeta.tagline}</span>
          </div>

          {onOpenScanner && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenScanner}
              className="h-7 gap-1.5 px-2.5 text-xs font-semibold border-primary/50 bg-primary/10 hover:bg-primary/20 text-primary shadow-2xs transition-colors"
              title="Open Live Camera / USB Barcode Scanner (F8)"
            >
              <Barcode className="h-3.5 w-3.5" />
              <Camera className="h-3 w-3" />
              <span>Scan Barcode</span>
              <kbd className="ml-1 hidden sm:inline-block rounded bg-primary/20 px-1 py-0.2 font-mono text-[9px] text-primary">
                F8
              </kbd>
            </Button>
          )}

          {onOpenStripCounter && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenStripCounter}
              className="h-7 gap-1.5 px-2.5 text-xs font-semibold border-teal-500/50 bg-teal-500/15 hover:bg-teal-500/25 text-teal-800 dark:text-teal-200 shadow-2xs transition-colors"
              title="Open AI Strip Counter / Phone Camera Vision (F9)"
            >
              <Scissors className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span>AI Strip Counter</span>
              <kbd className="ml-1 hidden sm:inline-block rounded bg-teal-500/25 px-1 py-0.2 font-mono text-[9px] text-teal-800 dark:text-teal-200">
                F9
              </kbd>
            </Button>
          )}

          {onOpenSalesPatterns && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSalesPatterns}
              className="h-7 gap-1.5 px-2.5 text-xs font-bold border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-all shadow-xs"
              title="Load Pre-configured 1-Tablet Sales Patterns & Acute Combos"
            >
              <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 fill-amber-500/20" />
              <span>⚡ 1-Tab Patterns</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalOpen(true)}
            className="h-7 gap-1.5 px-2.5 text-xs font-medium border-teal-500/40 hover:bg-teal-500/10 text-teal-700 dark:text-teal-300"
          >
            <TableProperties className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">UX Comparison</span> Matrix
          </Button>
        </div>
      </div>

      <UxComparisonModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        currentFormat={currentFormat}
        onSelectFormat={onChangeFormat}
      />
    </>
  )
}
