'use client'

import {
  Boxes,
  Building2,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  PieChart,
  Receipt,
  RotateCcw,
  Square,
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import React, { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import type { ChemistFinancialStats, PlatformAnalyticsData } from '@/lib/platform/platform-analytics-service'
import {
  type ChemistExcelExportOptions,
  exportChemistFinancialExcel,
} from '@/lib/reports/platform-excel-generator'
import { cn } from '@/lib/utils/cn'

export interface ChemistExcelExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  analyticsData: PlatformAnalyticsData | null
  initialSelectedChemistId?: string | null
}

export function ChemistExcelExportDialog({
  open,
  onOpenChange,
  analyticsData,
  initialSelectedChemistId = null,
}: ChemistExcelExportDialogProps) {
  const toast = useToast()

  // Scope selection: 'ALL' or 'CUSTOM'
  const [scopeMode, setScopeMode] = useState<'ALL' | 'CUSTOM'>(
    initialSelectedChemistId ? 'CUSTOM' : 'ALL'
  )

  // Selected shop IDs when in 'CUSTOM' mode
  const [selectedShopIds, setSelectedShopIds] = useState<string[]>(() => {
    if (initialSelectedChemistId) return [initialSelectedChemistId]
    if (analyticsData?.chemists) return analyticsData.chemists.map((c) => c.organizationId)
    return []
  })

  // Selected range of information sections
  const [sections, setSections] = useState({
    executiveKpi: true,
    financialOverview: true,
    itemizedLedger: true,
    inventoryValuation: true,
    ledgerExposure: true,
    topMedicines: true,
    recentTransactions: true,
  })

  // Health Tier filter
  const [healthFilter, setHealthFilter] = useState<string>('ALL')
  const [isExporting, setIsExporting] = useState<boolean>(false)

  // Sync if initialSelectedChemistId changes
  React.useEffect(() => {
    if (initialSelectedChemistId) {
      setScopeMode('CUSTOM')
      setSelectedShopIds([initialSelectedChemistId])
    }
  }, [initialSelectedChemistId])

  const chemists = analyticsData?.chemists || []

  const toggleShop = (shopId: string) => {
    setSelectedShopIds((prev) =>
      prev.includes(shopId) ? prev.filter((id) => id !== shopId) : [...prev, shopId]
    )
  }

  const selectAllShops = () => {
    setSelectedShopIds(chemists.map((c) => c.organizationId))
  }

  const clearAllShops = () => {
    setSelectedShopIds([])
  }

  // Count active worksheets to be generated
  const activeWorksheetCount = useMemo(() => {
    let count = 0
    if (sections.executiveKpi) count++
    if (sections.financialOverview) count++
    if (sections.itemizedLedger) count++
    if (sections.inventoryValuation) count++
    if (sections.ledgerExposure) count++
    if (sections.topMedicines) count++
    if (sections.recentTransactions) count++
    return count
  }, [sections])

  // Count effective shops included
  const effectiveShopsCount = useMemo(() => {
    let list = scopeMode === 'ALL' ? chemists : chemists.filter((c) => selectedShopIds.includes(c.organizationId))
    if (healthFilter !== 'ALL') {
      list = list.filter((c) => c.profitability.healthTier === healthFilter)
    }
    return list.length
  }, [chemists, scopeMode, selectedShopIds, healthFilter])

  const canExport = effectiveShopsCount > 0 && activeWorksheetCount > 0 && !isExporting

  const handleExecuteExport = () => {
    if (!analyticsData) return
    setIsExporting(true)
    try {
      const options: ChemistExcelExportOptions = {
        selectedShopIds: scopeMode === 'CUSTOM' ? selectedShopIds : undefined,
        includeExecutiveKpi: sections.executiveKpi,
        includeFinancialOverview: sections.financialOverview,
        includeItemizedLedger: sections.itemizedLedger,
        includeInventoryValuation: sections.inventoryValuation,
        includeLedgerExposure: sections.ledgerExposure,
        includeTopMedicines: sections.topMedicines,
        includeRecentTransactions: sections.recentTransactions,
        healthTierFilter: healthFilter,
      }

      exportChemistFinancialExcel(analyticsData, options)
      toast.success(
        `Excel Workbook generated with ${activeWorksheetCount} sheet(s) for ${effectiveShopsCount} chemist shop(s)!`
      )
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate Excel file'
      toast.error(msg)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <FileSpreadsheet className="h-6 w-6 shrink-0" />
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Export Formatted Chemist Financial Excel (.xlsx)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Configure your selected range of chemist shops and information sections to generate a multi-tab formatted Excel workbook.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* ─── SECTION 1: CHEMIST SHOP RANGE (SCOPE) ─── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Store className="h-3.5 w-3.5 text-primary" />
                <span>1. Select Range of Chemist Shops</span>
              </Label>
              <span className="text-[11px] text-muted-foreground font-mono">
                {effectiveShopsCount} of {chemists.length} shop(s) selected
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScopeMode('ALL')}
                className={cn(
                  'rounded-lg border p-2.5 text-left transition-all text-xs flex items-center justify-between',
                  scopeMode === 'ALL'
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border/70 hover:bg-muted/40 text-muted-foreground'
                )}
              >
                <div>
                  <div className="font-bold text-foreground">All Chemist Shops</div>
                  <div className="text-[10px] text-muted-foreground">
                    Consolidated Master across all {chemists.length} tenants
                  </div>
                </div>
                {scopeMode === 'ALL' && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => setScopeMode('CUSTOM')}
                className={cn(
                  'rounded-lg border p-2.5 text-left transition-all text-xs flex items-center justify-between',
                  scopeMode === 'CUSTOM'
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border/70 hover:bg-muted/40 text-muted-foreground'
                )}
              >
                <div>
                  <div className="font-bold text-foreground">Custom Shop Range</div>
                  <div className="text-[10px] text-muted-foreground">
                    Choose specific shops or single store audit
                  </div>
                </div>
                {scopeMode === 'CUSTOM' && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            </div>

            {/* Custom Range Shop Checklist */}
            {scopeMode === 'CUSTOM' && (
              <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-border/60 text-xs">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Select shops to include:
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={selectAllShops}
                      className="text-primary hover:underline font-semibold flex items-center gap-0.5"
                    >
                      <CheckSquare className="h-3 w-3" /> Select All
                    </button>
                    <span className="text-border">|</span>
                    <button
                      type="button"
                      onClick={clearAllShops}
                      className="text-muted-foreground hover:underline flex items-center gap-0.5"
                    >
                      <Square className="h-3 w-3" /> Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {chemists.map((chem) => {
                    const isChecked = selectedShopIds.includes(chem.organizationId)
                    return (
                      <div
                        key={chem.organizationId}
                        onClick={() => toggleShop(chem.organizationId)}
                        className={cn(
                          'flex items-center justify-between p-2 rounded-md border text-xs cursor-pointer transition-all',
                          isChecked
                            ? 'bg-background border-primary/40 shadow-xs'
                            : 'border-transparent opacity-60 hover:opacity-100'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleShop(chem.organizationId)}
                            className="mt-0.5"
                          />
                          <div>
                            <span className="font-semibold text-foreground">
                              {chem.organizationName}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-1.5 font-mono">
                              ({chem.city || 'India'})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="font-mono text-[9px] uppercase">
                            {chem.organizationCode}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="font-mono text-[9px] text-emerald-600 font-bold"
                          >
                            ₹{chem.sales.grossRevenue.toLocaleString('en-IN')}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ─── SECTION 2: RANGE OF INFORMATION SECTIONS (WORKSHEETS) ─── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                <span>2. Select Range of Information to Include</span>
              </Label>
              <span className="text-[11px] text-muted-foreground font-mono">
                {activeWorksheetCount} worksheet(s) selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div
                onClick={() => setSections((p) => ({ ...p, executiveKpi: !p.executiveKpi }))}
                className={cn(
                  'rounded-lg border p-2.5 cursor-pointer transition-all flex items-start gap-2.5',
                  sections.executiveKpi
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border/60 opacity-60 hover:opacity-90'
                )}
              >
                <Checkbox
                  checked={sections.executiveKpi}
                  onCheckedChange={(c) => setSections((p) => ({ ...p, executiveKpi: Boolean(c) }))}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-foreground block flex items-center gap-1">
                    <PieChart className="h-3 w-3 text-primary" />
                    Executive KPI &amp; Summary
                  </span>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    High-level strategic rollup of revenue, inward purchases, COGS, net profit, and stock valuation.
                  </p>
                </div>
              </div>

              <div
                onClick={() => setSections((p) => ({ ...p, financialOverview: !p.financialOverview }))}
                className={cn(
                  'rounded-lg border p-2.5 cursor-pointer transition-all flex items-start gap-2.5',
                  sections.financialOverview
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border/60 opacity-60 hover:opacity-90'
                )}
              >
                <Checkbox
                  checked={sections.financialOverview}
                  onCheckedChange={(c) => setSections((p) => ({ ...p, financialOverview: Boolean(c) }))}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-foreground block flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-emerald-600" />
                    Chemist Financial Overview
                  </span>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Shop-level sales, wholesale purchases, COGS, gross profit, margin %, and health classification.
                  </p>
                </div>
              </div>

              <div
                onClick={() => setSections((p) => ({ ...p, itemizedLedger: !p.itemizedLedger }))}
                className={cn(
                  'rounded-lg border p-2.5 cursor-pointer transition-all flex items-start gap-2.5 sm:col-span-2',
                  sections.itemizedLedger
                    ? 'border-emerald-500/60 bg-emerald-500/10 dark:bg-emerald-950/20 shadow-xs'
                    : 'border-border/60 opacity-60 hover:opacity-90'
                )}
              >
                <Checkbox
                  checked={sections.itemizedLedger}
                  onCheckedChange={(c) => setSections((p) => ({ ...p, itemizedLedger: Boolean(c) }))}
                  className="mt-0.5 border-emerald-500 data-[state=checked]:bg-emerald-600"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-foreground block flex items-center gap-1">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Individual Item Purchase &amp; Sales Ledger (Each Entity)</span>
                    <Badge variant="outline" className="text-[9px] uppercase font-mono text-emerald-600 border-emerald-500/30">
                      Medicine-by-Medicine
                    </Badge>
                  </span>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Complete itemized audit of every medicine per chemist shop: inward units, purchase rates, total spend, primary supplier, batch/expiry, sold units, sales revenue, COGS, gross profit ₹, margin %, and live stock in hand.
                  </p>
                </div>
              </div>

              <div
                onClick={() => setSections((p) => ({ ...p, inventoryValuation: !p.inventoryValuation }))}
                className={cn(
                  'rounded-lg border p-2.5 cursor-pointer transition-all flex items-start gap-2.5',
                  sections.inventoryValuation
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border/60 opacity-60 hover:opacity-90'
                )}
              >
                <Checkbox
                  checked={sections.inventoryValuation}
                  onCheckedChange={(c) => setSections((p) => ({ ...p, inventoryValuation: Boolean(c) }))}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-foreground block flex items-center gap-1">
                    <Boxes className="h-3 w-3 text-amber-600" />
                    Inventory Asset Valuation
                  </span>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Total stock units, valuation at purchase cost, retail MRP valuation, and potential retail profit.
                  </p>
                </div>
              </div>

              <div
                onClick={() => setSections((p) => ({ ...p, ledgerExposure: !p.ledgerExposure }))}
                className={cn(
                  'rounded-lg border p-2.5 cursor-pointer transition-all flex items-start gap-2.5',
                  sections.ledgerExposure
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border/60 opacity-60 hover:opacity-90'
                )}
              >
                <Checkbox
                  checked={sections.ledgerExposure}
                  onCheckedChange={(c) => setSections((p) => ({ ...p, ledgerExposure: Boolean(c) }))}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-foreground block flex items-center gap-1">
                    <Wallet className="h-3 w-3 text-purple-600" />
                    Market Credit Ledger (AP/AR)
                  </span>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Distributor accounts payable (AP), patient receivables (AR), and net working capital balances.
                  </p>
                </div>
              </div>

              <div
                onClick={() => setSections((p) => ({ ...p, topMedicines: !p.topMedicines }))}
                className={cn(
                  'rounded-lg border p-2.5 cursor-pointer transition-all flex items-start gap-2.5',
                  sections.topMedicines
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border/60 opacity-60 hover:opacity-90'
                )}
              >
                <Checkbox
                  checked={sections.topMedicines}
                  onCheckedChange={(c) => setSections((p) => ({ ...p, topMedicines: Boolean(c) }))}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-foreground block flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-emerald-600" />
                    Top Profit-Driving Medicines
                  </span>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Ranked medicine sales, units dispensed, gross revenue, cost, profit, and margin percentages.
                  </p>
                </div>
              </div>

              <div
                onClick={() => setSections((p) => ({ ...p, recentTransactions: !p.recentTransactions }))}
                className={cn(
                  'rounded-lg border p-2.5 cursor-pointer transition-all flex items-start gap-2.5',
                  sections.recentTransactions
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border/60 opacity-60 hover:opacity-90'
                )}
              >
                <Checkbox
                  checked={sections.recentTransactions}
                  onCheckedChange={(c) => setSections((p) => ({ ...p, recentTransactions: Boolean(c) }))}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-foreground block flex items-center gap-1">
                    <Receipt className="h-3 w-3 text-blue-600" />
                    Recent Invoices &amp; Transactions
                  </span>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Audit log of recent completed sales with invoice numbers, payment methods, and total amounts.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ─── SECTION 3: PERFORMANCE HEALTH TIER FILTER ─── */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Performance Health Filter:
              </Label>
              <Select value={healthFilter} onValueChange={setHealthFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Performance Tiers</SelectItem>
                  <SelectItem value="EXCEPTIONAL">Exceptional Only (&ge; 25% Margin)</SelectItem>
                  <SelectItem value="HEALTHY">Healthy Only (18-25% Margin)</SelectItem>
                  <SelectItem value="MODERATE">Moderate Only (10-18% Margin)</SelectItem>
                  <SelectItem value="LOW">Low Margin Only (&lt; 10%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Output Format:</Label>
              <div className="h-8 rounded-md border border-border/70 bg-muted/30 px-3 flex items-center justify-between text-xs font-mono font-medium">
                <span>Excel 2007+ (.xlsx)</span>
                <Badge variant="outline" className="text-[9px] uppercase font-mono">
                  Multi-Tab
                </Badge>
              </div>
            </div>
          </div>

          {/* ─── SPECIFICATION SUMMARY PILL ─── */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                Ready to generate <strong>{activeWorksheetCount} formatted sheet(s)</strong> covering{' '}
                <strong>{effectiveShopsCount} chemist shop(s)</strong>.
              </span>
            </div>
            <span className="text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 uppercase">
              Auto-Fitted &bull; INR ₹ Formatted
            </span>
          </div>
        </div>

        <DialogFooter className="mt-3 gap-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
            className="text-xs"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleExecuteExport}
            disabled={!canExport}
            className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md"
          >
            <Download className="h-4 w-4" />
            <span>
              {isExporting ? 'Generating Excel Workbook...' : 'Download Formatted Excel (.xlsx)'}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

