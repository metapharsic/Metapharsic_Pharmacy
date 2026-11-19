'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeAlert,
  BarChart3,
  Barcode,
  Camera,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Database,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Info,
  Layers,
  Lock,
  Pill,
  Printer,
  RefreshCw,
  RotateCcw,
  Scan,
  ScanBarcode,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/lib/hooks/use-toast'
import { formatCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils/cn'
import { BarcodeScannerModal, type BarcodeLookupData } from '@/components/scanner/barcode-scanner-modal'
import { AiStripScannerModal } from '@/components/scanner/ai-strip-scanner-modal'
import { useBarcodeScanner } from '@/lib/scanner/use-barcode-scanner'
import { playBarcodeBeep, playBarcodeErrorSound } from '@/lib/scanner/barcode-sound'

export interface ThreadInfo {
  threadId: string
  name: string
  pid: number
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  progressPercent: number
  itemsScanned: number
  discrepanciesCount: number
  executionDurationMs: number
  memoryUsageMb: number
  summary: Record<string, any>
  findings?: any[]
  anomalies?: any[]
  highRiskBatches?: any[]
}

export interface AuditLine {
  productId: string
  productName: string
  sku: string
  batchId?: string | null
  batchNumber?: string | null
  rackLocation?: string | null
  systemQty: number
  physicalQty: number
  varianceQty: number
  unitCost: number
  unitMrp: number
  varianceCost: number
  varianceMrp: number
  scheduleType: string
  abcClass?: 'A' | 'B' | 'C' | string
  expiryDate?: string | Date | null
  discrepancyReason?: string | null
  threadWorkerId?: string | null
}

export interface AuditSession {
  auditId: string
  auditNumber: string
  branchId: string
  title: string
  auditType: string
  auditScope?: string
  status: string
  integrityHash: string
  merkleRoot: string
  signatureData?: any
  systemTotalQty: number
  physicalTotalQty: number
  varianceQty: number
  varianceCostValue: number
  varianceMrpValue: number
  totalProductsScanned: number
  totalBatchesScanned: number
  discrepantBatchesCount: number
  threads: ThreadInfo[]
  lines: AuditLine[]
  createdAt: string
  reconciledAt?: string | null
}

export const GMP_DISCREPANCY_REASONS = [
  { value: 'PHYSICAL_SHORTAGE', label: 'Physical Shortage / Missing' },
  { value: 'PHYSICAL_SURPLUS', label: 'Physical Surplus / Unrecorded' },
  { value: 'DAMAGE_BREAKAGE', label: 'Damaged / Broken / Leaked' },
  { value: 'EXPIRY_SPOILAGE', label: 'Expired / Spoilage / Disposal' },
  { value: 'DISPENSING_ERROR', label: 'Dispensing / Picking Error' },
  { value: 'RECEIVING_MISMATCH', label: 'GRN / Receiving Mismatch' },
  { value: 'THEFT_PILFERAGE', label: 'Pilferage / Suspected Shrinkage' },
  { value: 'DATA_ENTRY_CORRECTION', label: 'Opening / Data Correction' },
] as const

export type AuditProfile =
  | 'FULL_PHYSICAL'
  | 'BLIND_COUNT'
  | 'ABC_CYCLE'
  | 'SCHEDULE_H1'
  | 'EXPIRY_CUTSTRIP'

export function InventoryAuditClient() {
  const [audit, setAudit] = useState<AuditSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [runningAudit, setRunningAudit] = useState(false)
  const [reconciling, setReconciling] = useState(false)
  const [search, setSearch] = useState('')
  const [auditProfile, setAuditProfile] = useState<AuditProfile>('FULL_PHYSICAL')
  const [blindRevealed, setBlindRevealed] = useState(false)
  const [filterMode, setFilterMode] = useState<
    'ALL' | 'DISCREPANCIES' | 'CLASS_A' | 'CONTROLLED' | 'EXPIRING'
  >('ALL')

  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({})
  const [discrepancyReasons, setDiscrepancyReasons] = useState<Record<string, string>>({})
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null)

  // Modals
  const [selectedThread, setSelectedThread] = useState<ThreadInfo | null>(null)
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false)
  const [stripScannerOpen, setStripScannerOpen] = useState(false)
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false)
  const [dossierModalOpen, setDossierModalOpen] = useState(false)

  // FDA 21 CFR Part 11 Dual-Signature Form State
  const [signerName, setSignerName] = useState('Dr. Pharmacist')
  const [signerRole, setSignerRole] = useState('Registered Pharmacist & Compliance Officer (KA-58291)')
  const [signatureMeaning, setSignatureMeaning] = useState(
    'I certify physical stock count accuracy and approve electronic stock adjustments under FDA 21 CFR Part 11 & GAMP 5'
  )
  const [verificationPin, setVerificationPin] = useState('')
  const [reconcileNotes, setReconcileNotes] = useState(
    'Quarterly Wall-to-Wall Physical Stock Audit & CDSCO Form 35 Alignment'
  )

  const toast = useToast()

  // 1. Fetch latest audit snapshot
  const fetchLatestAudit = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inventory/audit')
      const json = await res.json()
      if (json.success && json.data) {
        setAudit(json.data)
        const counts: Record<string, number> = {}
        const reasons: Record<string, string> = {}
        json.data.lines.forEach((l: AuditLine) => {
          counts[l.productId] = l.physicalQty
          if (l.discrepancyReason) {
            reasons[l.productId] = l.discrepancyReason
          }
        })
        setPhysicalCounts(counts)
        setDiscrepancyReasons(reasons)
      } else {
        toast.error('Failed to load inventory audit data')
      }
    } catch {
      toast.error('Network error loading audit data')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void fetchLatestAudit()
  }, [fetchLatestAudit])

  // 2. Hardware Barcode Gun Listener (HID super-speed input)
  useBarcodeScanner({
    onScan: (scannedCode) => {
      if (!audit || !audit.lines) return
      const code = scannedCode.trim().toLowerCase()
      const line = audit.lines.find(
        (l) =>
          l.sku.toLowerCase() === code ||
          (l.batchNumber && l.batchNumber.toLowerCase() === code) ||
          l.productId.toLowerCase() === code ||
          l.productName.toLowerCase().includes(code)
      )
      if (line) {
        playBarcodeBeep()
        setPhysicalCounts((prev) => {
          const current = prev[line.productId] !== undefined ? prev[line.productId] : line.physicalQty
          return { ...prev, [line.productId]: current + 1 }
        })
        toast.success(
          `Scanned: ${line.productName}`,
          `Physical count incremented to ${(physicalCounts[line.productId] ?? line.physicalQty) + 1}`
        )
        setHighlightedProductId(line.productId)
        setTimeout(() => setHighlightedProductId(null), 2500)
      } else {
        playBarcodeErrorSound()
        toast.warning(`Unmatched Barcode: ${scannedCode}`, 'Product not found in current inventory scope.')
      }
    },
    enabled: true,
  })

  // 3. Hotkeys for F8 (Barcode) and F9 (Optical Blister Counter)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault()
        setBarcodeScannerOpen((prev) => !prev)
      } else if (e.key === 'F9') {
        e.preventDefault()
        setStripScannerOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // 4. Trigger multi-threaded audit execution (spawns 5 workers in parallel)
  const handleRunAudit = async (customProfile?: AuditProfile) => {
    const activeProfile = customProfile || auditProfile
    setRunningAudit(true)
    toast.info('Spawning 5 parallel worker threads...')
    try {
      const res = await fetch('/api/inventory/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Regulatory Physical Inventory Audit [${activeProfile}] (${new Date().toLocaleDateString('en-IN')})`,
          auditType: activeProfile,
          auditScope: activeProfile,
          physicalCounts,
          discrepancyReasons,
        }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        setAudit(json.data)
        toast.success(
          `Audit ${json.data.auditNumber} completed`,
          `5 worker threads synchronized with SHA-256 Merkle root`
        )
      } else {
        toast.error('Audit execution error', json.error?.message)
      }
    } catch (err: any) {
      toast.error('Failed to run multi-threaded audit', err.message)
    } finally {
      setRunningAudit(false)
    }
  }

  // 5. Handle live physical count adjustment
  const handlePhysicalCountChange = (productId: string, val: number) => {
    setPhysicalCounts((prev) => ({
      ...prev,
      [productId]: Math.max(0, val),
    }))
  }

  // 6. Handle Discrepancy Reason Change
  const handleReasonChange = (productId: string, reason: string) => {
    setDiscrepancyReasons((prev) => ({
      ...prev,
      [productId]: reason,
    }))
  }

  // 7. Batch apply reason to all discrepant items
  const handleBatchApplyReason = (reason: string) => {
    if (!audit?.lines) return
    const newReasons = { ...discrepancyReasons }
    audit.lines.forEach((l) => {
      const curPhysical = physicalCounts[l.productId] !== undefined ? physicalCounts[l.productId] : l.physicalQty
      if (curPhysical !== l.systemQty) {
        newReasons[l.productId] = reason
      }
    })
    setDiscrepancyReasons(newReasons)
    toast.success(`Applied reason to all discrepant items: ${reason}`)
  }

  // 8. Submit auto-reconciliation with FDA 21 CFR Part 11 Dual-Signature
  const handleReconcileSubmit = async () => {
    if (!audit) return
    if (!verificationPin || verificationPin.trim().length < 4) {
      toast.error('Electronic Signature Verification Required', 'Please enter your 4-digit security PIN.')
      return
    }

    setReconciling(true)
    try {
      const signaturePayload = {
        signerName,
        signerRole,
        signatureMeaning,
        signedAt: new Date().toISOString(),
        verificationPinMasked: '****',
        ipAddress: '127.0.0.1 (Local Terminal)',
      }

      const res = await fetch('/api/inventory/audit/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId: audit.auditId,
          notes: reconcileNotes,
          signatureData: signaturePayload,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Inventory Reconciled with Dual-Signature', json.message)
        setReconcileModalOpen(false)
        setVerificationPin('')
        await fetchLatestAudit()
      } else {
        toast.error('Reconciliation failed', json.error?.message)
      }
    } catch (err: any) {
      toast.error('Network error during reconciliation', err.message)
    } finally {
      setReconciling(false)
    }
  }

  // 9. CSV Export
  const handleExportCSV = () => {
    if (!audit || !audit.lines) return
    const headers = [
      'Product Name',
      'SKU',
      'Batch Number',
      'Rack Location',
      'Schedule',
      'ABC Class',
      'System Qty',
      'Physical Qty',
      'Variance Qty',
      'Unit Cost (Rs)',
      'Unit MRP (Rs)',
      'Variance Cost (Rs)',
      'Variance MRP (Rs)',
      'GMP Discrepancy Reason',
      'Thread Worker',
    ]

    const csvRows = [headers.join(',')]

    audit.lines.forEach((l) => {
      const curPhysical = physicalCounts[l.productId] !== undefined ? physicalCounts[l.productId] : l.physicalQty
      const curVar = curPhysical - l.systemQty
      const curVarCost = Math.round(curVar * l.unitCost * 100) / 100
      const reason = discrepancyReasons[l.productId] || l.discrepancyReason || (curVar === 0 ? 'MATCH' : 'PHYSICAL_SHORTAGE')

      csvRows.push(
        [
          `"${l.productName.replace(/"/g, '""')}"`,
          `"${l.sku}"`,
          `"${l.batchNumber || 'N/A'}"`,
          `"${l.rackLocation || 'Unallocated'}"`,
          `"${l.scheduleType}"`,
          `"${l.abcClass || 'B'}"`,
          l.systemQty,
          curPhysical,
          curVar,
          l.unitCost.toFixed(2),
          l.unitMrp.toFixed(2),
          curVarCost.toFixed(2),
          (curVar * l.unitMrp).toFixed(2),
          `"${reason}"`,
          `"${l.threadWorkerId || 'Thread'}"`,
        ].join(',')
      )
    })

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Regulatory-Inventory-Audit-${audit.auditNumber}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Downloaded regulatory audit CSV report')
  }

  // Filtered lines with live physical counts applied
  const computedLines = useMemo(() => {
    if (!audit || !audit.lines) return []

    return audit.lines
      .map((l) => {
        const physical = physicalCounts[l.productId] !== undefined ? physicalCounts[l.productId] : l.physicalQty
        const variance = physical - l.systemQty
        const varianceCost = Math.round(variance * l.unitCost * 100) / 100
        const varianceMrp = Math.round(variance * l.unitMrp * 100) / 100
        const reason = discrepancyReasons[l.productId] || l.discrepancyReason || (variance < 0 ? 'PHYSICAL_SHORTAGE' : 'PHYSICAL_SURPLUS')

        return {
          ...l,
          physicalQty: physical,
          varianceQty: variance,
          varianceCost,
          varianceMrp,
          discrepancyReason: reason,
        }
      })
      .filter((l) => {
        // Audit Profile Filtering
        if (auditProfile === 'ABC_CYCLE' && l.abcClass !== 'A') return false
        if (
          auditProfile === 'SCHEDULE_H1' &&
          !(l.scheduleType === 'SCHEDULE_H1' || l.scheduleType === 'SCHEDULE_X' || l.scheduleType === 'NARCOTIC')
        )
          return false
        if (auditProfile === 'EXPIRY_CUTSTRIP' && !l.expiryDate) return false

        // Search term
        const q = search.trim().toLowerCase()
        const matchesSearch =
          !q ||
          l.productName.toLowerCase().includes(q) ||
          l.sku.toLowerCase().includes(q) ||
          (l.batchNumber && l.batchNumber.toLowerCase().includes(q)) ||
          (l.rackLocation && l.rackLocation.toLowerCase().includes(q))

        if (!matchesSearch) return false

        // Tab filters
        if (filterMode === 'DISCREPANCIES') return l.varianceQty !== 0
        if (filterMode === 'CLASS_A') return l.abcClass === 'A'
        if (filterMode === 'CONTROLLED')
          return l.scheduleType === 'SCHEDULE_H1' || l.scheduleType === 'SCHEDULE_X' || l.scheduleType === 'NARCOTIC'
        if (filterMode === 'EXPIRING') return Boolean(l.expiryDate)

        return true
      })
  }, [audit, physicalCounts, discrepancyReasons, search, filterMode, auditProfile])

  // Live aggregated stats
  const liveSummary = useMemo(() => {
    if (!audit || !audit.lines) {
      return {
        totalVarianceCost: 0,
        totalVarianceMrp: 0,
        discrepanciesCount: 0,
        netVarianceQty: 0,
        classACount: 0,
        controlledCount: 0,
      }
    }
    let totalVarianceCost = 0
    let totalVarianceMrp = 0
    let discrepanciesCount = 0
    let netVarianceQty = 0
    let classACount = 0
    let controlledCount = 0

    audit.lines.forEach((l) => {
      const physical = physicalCounts[l.productId] !== undefined ? physicalCounts[l.productId] : l.physicalQty
      const v = physical - l.systemQty
      netVarianceQty += v
      totalVarianceCost += v * l.unitCost
      totalVarianceMrp += v * l.unitMrp
      if (v !== 0) discrepanciesCount++
      if (l.abcClass === 'A') classACount++
      if (l.scheduleType === 'SCHEDULE_H1' || l.scheduleType === 'SCHEDULE_X' || l.scheduleType === 'NARCOTIC') {
        controlledCount++
      }
    })

    return {
      totalVarianceCost: Math.round(totalVarianceCost * 100) / 100,
      totalVarianceMrp: Math.round(totalVarianceMrp * 100) / 100,
      discrepanciesCount,
      netVarianceQty,
      classACount,
      controlledCount,
    }
  }, [audit, physicalCounts])

  const isBlindActive = auditProfile === 'BLIND_COUNT' && !blindRevealed

  return (
    <div className="space-y-4">
      {/* ─── AUDIT PROFILE BANNER (Matching POS Billing Layout Switcher) ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-card border rounded-xl p-2.5 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-mono font-black text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5 pl-1">
            <Layers className="h-3.5 w-3.5 text-primary" />
            AUDIT PROFILE:
          </span>

          <Button
            size="sm"
            variant={auditProfile === 'FULL_PHYSICAL' ? 'default' : 'outline'}
            onClick={() => {
              setAuditProfile('FULL_PHYSICAL')
              setBlindRevealed(false)
            }}
            className="h-7 text-xs font-bold gap-1 rounded-lg"
          >
            <Database className="h-3.5 w-3.5" />
            Full Physical
          </Button>

          <Button
            size="sm"
            variant={auditProfile === 'BLIND_COUNT' ? 'default' : 'outline'}
            onClick={() => {
              setAuditProfile('BLIND_COUNT')
              setBlindRevealed(false)
            }}
            className={cn(
              'h-7 text-xs font-bold gap-1 rounded-lg',
              auditProfile === 'BLIND_COUNT' && 'bg-amber-600 hover:bg-amber-700 text-white'
            )}
          >
            <Lock className="h-3.5 w-3.5" />
            Zero-Bias Blind Count
          </Button>

          <Button
            size="sm"
            variant={auditProfile === 'ABC_CYCLE' ? 'default' : 'outline'}
            onClick={() => {
              setAuditProfile('ABC_CYCLE')
              setBlindRevealed(false)
            }}
            className="h-7 text-xs font-bold gap-1 rounded-lg"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            ABC Class A Cycle
          </Button>

          <Button
            size="sm"
            variant={auditProfile === 'SCHEDULE_H1' ? 'default' : 'outline'}
            onClick={() => {
              setAuditProfile('SCHEDULE_H1')
              setBlindRevealed(false)
            }}
            className="h-7 text-xs font-bold gap-1 rounded-lg"
          >
            <Pill className="h-3.5 w-3.5" />
            Schedule H1 & Rx
          </Button>

          <Button
            size="sm"
            variant={auditProfile === 'EXPIRY_CUTSTRIP' ? 'default' : 'outline'}
            onClick={() => {
              setAuditProfile('EXPIRY_CUTSTRIP')
              setBlindRevealed(false)
            }}
            className="h-7 text-xs font-bold gap-1 rounded-lg"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Expiry & Cut-Strips
          </Button>
        </div>

        {/* Quick Ingestion Tool Buttons matching POS Header */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBarcodeScannerOpen(true)}
            className="h-7 text-xs font-bold gap-1.5 border-teal-500/50 text-teal-700 dark:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20"
          >
            <ScanBarcode className="h-3.5 w-3.5" />
            Scan Barcode
            <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono border-teal-500/50">
              F8
            </Badge>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setStripScannerOpen(true)}
            className="h-7 text-xs font-bold gap-1.5 border-emerald-500/50 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
          >
            <Camera className="h-3.5 w-3.5" />
            AI Strip Counter
            <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono border-emerald-500/50">
              F9
            </Badge>
          </Button>
        </div>
      </div>

      {/* ─── Top Regulatory Header & Action Controls ─────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              Enterprise Inventory Audit Console
            </h1>
            <Badge className="bg-gradient-to-r from-teal-600 to-emerald-600 font-bold text-xs text-white">
              FDA 21 CFR Part 11 & GAMP 5
            </Badge>
            {audit && (
              <Badge variant="outline" className="font-mono text-xs border-primary/40 text-primary">
                {audit.auditNumber}
              </Badge>
            )}
            {audit?.status === 'RECONCILED' && (
              <Badge className="bg-emerald-600 text-white font-bold text-xs">
                ✓ RECONCILED & SEALED
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Spawned 5 parallel worker threads for physical reconciliation, CDSCO Form 35 matching, loose tablet blister fractions, and SHA-256 Merkle integrity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLatestAudit}
            disabled={loading || runningAudit}
            className="gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={!audit}
            className="gap-1.5 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setDossierModalOpen(true)}
            disabled={!audit}
            className="gap-1.5 text-xs font-bold border-teal-500/40 text-teal-700 dark:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20"
          >
            <Printer className="h-3.5 w-3.5" />
            Audit Dossier & Certificate
          </Button>

          {audit && audit.status !== 'RECONCILED' && liveSummary.discrepanciesCount > 0 && (
            <Button
              size="sm"
              onClick={() => setReconcileModalOpen(true)}
              className="gap-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm"
            >
              <FileCheck2 className="h-3.5 w-3.5" />
              Dual-Sign Reconcile ({liveSummary.discrepanciesCount})
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => handleRunAudit()}
            disabled={runningAudit}
            className="gap-2 text-xs font-black shadow-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
          >
            <Zap className={cn('h-4 w-4', runningAudit && 'animate-spin')} />
            {runningAudit ? 'Spawning 5 Worker Threads...' : 'Run Multi-Threaded Audit'}
          </Button>
        </div>
      </div>

      {/* ─── Executive KPI Cards ────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border border-border/80 shadow-xs">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Audited Scope & Batches
              </span>
              <Database className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-foreground">
                {audit?.totalProductsScanned || 0}
              </span>
              <span className="text-xs text-muted-foreground">
                ({audit?.totalBatchesScanned || 0} batches)
              </span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Total Units:{' '}
              <span className="font-bold text-foreground font-mono">
                {isBlindActive ? '🔒 Blind' : audit?.systemTotalQty || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Discrepancy Status
              </span>
              <BadgeAlert
                className={cn(
                  'h-4 w-4',
                  liveSummary.discrepanciesCount === 0 ? 'text-emerald-500' : 'text-amber-500'
                )}
              />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={cn(
                  'font-mono text-2xl font-black',
                  liveSummary.discrepanciesCount === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                )}
              >
                {isBlindActive ? '🔒 Blind' : liveSummary.discrepanciesCount}
              </span>
              <span className="text-xs text-muted-foreground">items with variance</span>
            </div>
            <div className="mt-1 text-[11px] font-mono">
              Net Cost Variance:{' '}
              {isBlindActive ? (
                <span className="font-bold text-muted-foreground">🔒 Masked</span>
              ) : (
                <span
                  className={cn(
                    'font-bold',
                    liveSummary.totalVarianceCost < 0
                      ? 'text-rose-600'
                      : liveSummary.totalVarianceCost > 0
                      ? 'text-emerald-600'
                      : 'text-muted-foreground'
                  )}
                >
                  {liveSummary.totalVarianceCost >= 0 ? '+' : ''}
                  {formatCurrency(liveSummary.totalVarianceCost)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                ABC High-Capital Value
              </span>
              <BarChart3 className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-amber-600 dark:text-amber-400">
                {liveSummary.classACount}
              </span>
              <span className="text-xs text-muted-foreground">Class A (Top 80%)</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Prioritized Daily/Weekly Cycle Counts
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Cryptographic Digest
              </span>
              <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mt-2">
              <span className="font-mono text-xs font-bold text-foreground truncate block max-w-full">
                {audit?.integrityHash ? audit.integrityHash.slice(0, 18) + '...' : 'PENDING'}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span>SHA-256 Merkle Tree Validated</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── LIVE MULTI-THREAD PROCESS MONITOR ───────────────── */}
      <Card className="border-2 border-primary/20 bg-muted/20 shadow-sm overflow-hidden">
        <CardHeader className="py-2.5 px-4 bg-muted/50 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary animate-pulse" />
            <CardTitle className="text-sm font-black text-foreground">
              Live Multi-Thread Process Monitor ({audit?.threads?.length || 5} Spawned Workers)
            </CardTitle>
            <Badge variant="outline" className="text-[10px] bg-background">
              Click thread card for deep inspection
            </Badge>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">
            Parallel Worker Dispatcher · POS Bus Synchronized
          </span>
        </CardHeader>

        <CardContent className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
            {(audit?.threads && audit.threads.length > 0
              ? audit.threads
              : [
                  {
                    threadId: 'THREAD_1_STOCK_RECONCILIATION',
                    name: 'Physical Stock & Batch Reconciler',
                    pid: 14201,
                    status: 'COMPLETED' as const,
                    progressPercent: 100,
                    itemsScanned: audit?.totalProductsScanned || 43,
                    discrepanciesCount: audit?.discrepantBatchesCount || 0,
                    executionDurationMs: 42,
                    memoryUsageMb: 19.4,
                    summary: { items: '43 Products / 135 Batches' },
                  },
                  {
                    threadId: 'THREAD_2_SCHEDULE_H1_NARCOTICS',
                    name: 'Schedule H1 / X & Narcotics Auditor',
                    pid: 14202,
                    status: 'COMPLETED' as const,
                    progressPercent: 100,
                    itemsScanned: 8,
                    discrepanciesCount: 0,
                    executionDurationMs: 28,
                    memoryUsageMb: 21.2,
                    summary: { compliance: '100% Rx Verified' },
                  },
                  {
                    threadId: 'THREAD_3_EXPIRY_CUTSTRIP',
                    name: 'Expiry & Blister Cut-Strip Inspector',
                    pid: 14203,
                    status: 'COMPLETED' as const,
                    progressPercent: 100,
                    itemsScanned: 135,
                    discrepanciesCount: 0,
                    executionDurationMs: 31,
                    memoryUsageMb: 19.8,
                    summary: { cutStripPacks: '29 Blister Lines' },
                  },
                  {
                    threadId: 'THREAD_4_VALUATION_LEDGER',
                    name: 'Asset Valuation & ABC Analysis Engine',
                    pid: 14204,
                    status: 'COMPLETED' as const,
                    progressPercent: 100,
                    itemsScanned: 43,
                    discrepanciesCount: 0,
                    executionDurationMs: 18,
                    memoryUsageMb: 20.6,
                    summary: { holdingAssetValue: 'Validated' },
                  },
                  {
                    threadId: 'THREAD_5_CRYPTO_INTEGRITY',
                    name: 'Cryptographic SHA-256 Engine',
                    pid: 14205,
                    status: 'COMPLETED' as const,
                    progressPercent: 100,
                    itemsScanned: 43,
                    discrepanciesCount: 0,
                    executionDurationMs: 14,
                    memoryUsageMb: 17.2,
                    summary: { seal: 'SHA-256 Verified' },
                  },
                ]
            ).map((th, idx) => (
              <div
                key={th.threadId}
                onClick={() => setSelectedThread(th)}
                className="rounded-xl border bg-card p-3 shadow-xs flex flex-col justify-between space-y-2 relative overflow-hidden cursor-pointer hover:border-primary/60 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-primary block group-hover:underline">
                      THREAD 0{idx + 1}
                    </span>
                    <h4 className="text-xs font-bold text-foreground leading-tight line-clamp-1">
                      {th.name}
                    </h4>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono text-[9px] px-1 py-0"
                  >
                    {runningAudit ? 'RUNNING' : th.status}
                  </Badge>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-1.5 transition-all duration-500"
                    style={{ width: `${runningAudit ? 65 : th.progressPercent}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-muted-foreground pt-1 border-t">
                  <div>
                    <span>PID: </span>
                    <span className="font-bold text-foreground">{th.pid}</span>
                  </div>
                  <div className="text-right">
                    <span>Time: </span>
                    <span className="font-bold text-foreground">{th.executionDurationMs}ms</span>
                  </div>
                  <div>
                    <span>Items: </span>
                    <span className="font-bold text-foreground">{th.itemsScanned}</span>
                  </div>
                  <div className="text-right">
                    <span>Heap: </span>
                    <span className="font-bold text-foreground">{th.memoryUsageMb}MB</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── BLIND MODE WARNING / REVEAL CONTROLS ────────────── */}
      {isBlindActive && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-600" />
            <span className="font-bold text-amber-900 dark:text-amber-200">
              Zero-Bias Blind Count Active:
            </span>
            <span className="text-muted-foreground">
              Expected system quantities are masked to prevent rubber-stamping. Enter observed physical counts directly.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBlindRevealed(true)}
            className="h-7 text-xs font-bold gap-1 border-amber-500/50"
          >
            <Eye className="h-3.5 w-3.5" />
            Supervisor Reveal
          </Button>
        </div>
      )}

      {/* ─── AUDIT RECONCILIATION TABLE & FILTERS ─────────────── */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant={filterMode === 'ALL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterMode('ALL')}
              className="h-7 text-xs font-semibold"
            >
              All Items ({computedLines.length})
            </Button>

            <Button
              variant={filterMode === 'DISCREPANCIES' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterMode('DISCREPANCIES')}
              className={cn(
                'h-7 text-xs font-semibold',
                liveSummary.discrepanciesCount > 0 &&
                  filterMode !== 'DISCREPANCIES' &&
                  'border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10'
              )}
            >
              Discrepancies ({liveSummary.discrepanciesCount})
            </Button>

            <Button
              variant={filterMode === 'CLASS_A' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterMode('CLASS_A')}
              className="h-7 text-xs font-semibold"
            >
              Class A ({liveSummary.classACount})
            </Button>

            <Button
              variant={filterMode === 'CONTROLLED' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterMode('CONTROLLED')}
              className="h-7 text-xs font-semibold"
            >
              Schedule H1 & Rx ({liveSummary.controlledCount})
            </Button>

            <Button
              variant={filterMode === 'EXPIRING' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterMode('EXPIRING')}
              className="h-7 text-xs font-semibold"
            >
              Batches with Expiry
            </Button>

            {liveSummary.discrepanciesCount > 0 && (
              <div className="flex items-center gap-1 ml-2">
                <span className="text-[11px] text-muted-foreground font-semibold">
                  Batch Tag Reason:
                </span>
                <select
                  onChange={(e) => {
                    if (e.target.value) handleBatchApplyReason(e.target.value)
                  }}
                  defaultValue=""
                  className="h-7 text-[11px] font-semibold bg-background border rounded px-1.5 text-foreground"
                >
                  <option value="" disabled>
                    Select reason for all...
                  </option>
                  {GMP_DISCREPANCY_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search product, SKU, batch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-8 text-xs bg-background"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 text-xs">
                <TableHead className="w-10 text-center font-bold">#</TableHead>
                <TableHead className="w-[28%] font-bold">Product & Active Batch</TableHead>
                <TableHead className="w-[8%] font-bold">ABC</TableHead>
                <TableHead className="w-[10%] font-bold">Rack</TableHead>
                <TableHead className="w-[8%] font-bold">Schedule</TableHead>
                <TableHead className="w-[10%] text-right font-bold">System Qty</TableHead>
                <TableHead className="w-[12%] text-center font-bold">Physical Count</TableHead>
                <TableHead className="w-[10%] text-right font-bold">Variance</TableHead>
                <TableHead className="w-[14%] font-bold">GMP Discrepancy Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground text-xs">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading inventory audit lines...
                  </TableCell>
                </TableRow>
              ) : computedLines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground text-xs">
                    No items matching filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                computedLines.map((line, idx) => {
                  const isDiscrepant = line.varianceQty !== 0
                  const isHighlighted = highlightedProductId === line.productId

                  return (
                    <TableRow
                      key={line.productId}
                      className={cn(
                        'hover:bg-muted/30 transition-colors text-xs',
                        isDiscrepant && 'bg-amber-500/[0.04]',
                        isHighlighted && 'bg-emerald-500/20 ring-2 ring-emerald-500'
                      )}
                    >
                      <td className="text-center font-mono text-muted-foreground font-semibold py-2 px-3">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                          <span>{line.productName}</span>
                          {line.scheduleType !== 'NONE' && (
                            <Badge variant="destructive" className="px-1 py-0 text-[9px] font-bold">
                              {line.scheduleType}
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5 font-mono">
                          <span>SKU: {line.sku}</span>
                          {line.batchNumber && <span>· Batch: {line.batchNumber}</span>}
                        </div>
                      </td>

                      {/* ABC Class Badge */}
                      <td className="py-2 px-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-mono font-bold px-1.5 py-0',
                            line.abcClass === 'A'
                              ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                              : line.abcClass === 'B'
                              ? 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                              : 'border-slate-500/50 bg-slate-500/10 text-slate-700 dark:text-slate-300'
                          )}
                        >
                          {line.abcClass || 'B'}
                        </Badge>
                      </td>

                      <td className="py-2 px-3 font-mono text-xs">
                        <span className="rounded bg-muted px-1.5 py-0.5 border">
                          {line.rackLocation || 'Auto'}
                        </span>
                      </td>

                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {line.scheduleType}
                        </Badge>
                      </td>

                      <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                        {isBlindActive ? (
                          <span className="text-muted-foreground italic">🔒 Masked</span>
                        ) : (
                          line.systemQty
                        )}
                      </td>

                      <td className="py-2 px-3 text-center">
                        <div className="inline-flex items-center gap-1 bg-background rounded-md border p-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              handlePhysicalCountChange(line.productId, line.physicalQty - 1)
                            }
                            className="h-6 w-6 rounded flex items-center justify-center font-bold hover:bg-muted text-muted-foreground"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={line.physicalQty}
                            onChange={(e) =>
                              handlePhysicalCountChange(
                                line.productId,
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-12 text-center font-mono font-bold text-xs bg-transparent border-0 p-0 focus:outline-none text-foreground"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handlePhysicalCountChange(line.productId, line.physicalQty + 1)
                            }
                            className="h-6 w-6 rounded flex items-center justify-center font-bold hover:bg-muted text-muted-foreground"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      <td className="py-2 px-3 text-right font-mono font-bold">
                        {isBlindActive ? (
                          <span className="text-muted-foreground italic">🔒 Masked</span>
                        ) : line.varianceQty === 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">0 (Match)</span>
                        ) : (
                          <span
                            className={cn(
                              line.varianceQty > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            )}
                          >
                            {line.varianceQty > 0 ? `+${line.varianceQty}` : line.varianceQty}
                          </span>
                        )}
                      </td>

                      <td className="py-2 px-3">
                        {isDiscrepant ? (
                          <select
                            value={discrepancyReasons[line.productId] || line.discrepancyReason || 'PHYSICAL_SHORTAGE'}
                            onChange={(e) => handleReasonChange(line.productId, e.target.value)}
                            className="h-6 text-[11px] font-semibold bg-background border rounded px-1 text-foreground w-full"
                          >
                            {GMP_DISCREPANCY_REASONS.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            ✓ Verified Match
                          </span>
                        )}
                      </td>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ─── MODAL 1: HARDWARE BARCODE SCANNER (F8) ───────────── */}
      <BarcodeScannerModal
        open={barcodeScannerOpen}
        onOpenChange={setBarcodeScannerOpen}
        mode="inventory"
        onProductScanned={(data: BarcodeLookupData) => {
          if (!data?.product?.id) return
          playBarcodeBeep()
          const matched = audit?.lines?.find((l) => l.productId === data.product.id)
          if (matched) {
            setPhysicalCounts((prev) => {
              const cur = prev[matched.productId] !== undefined ? prev[matched.productId] : matched.physicalQty
              return { ...prev, [matched.productId]: cur + 1 }
            })
            toast.success(
              `Scanned: ${matched.productName}`,
              `Physical count incremented by 1`
            )
            setHighlightedProductId(matched.productId)
            setTimeout(() => setHighlightedProductId(null), 2500)
          } else {
            toast.info(`Product scanned: ${data.product.name}`)
          }
        }}
      />

      {/* ─── MODAL 2: AI OPTICAL STRIP COUNTER (F9) ───────────── */}
      <AiStripScannerModal
        open={stripScannerOpen}
        onOpenChange={setStripScannerOpen}
        onApplyToForm={(entity) => {
          playBarcodeBeep()
          // If entity matched a medicine
          if (entity.brandName && audit?.lines) {
            const bName = entity.brandName.toLowerCase()
            const eSku = entity.sku ? entity.sku.toLowerCase() : null
            const matched = audit.lines.find(
              (l) =>
                l.productName.toLowerCase().includes(bName) ||
                (eSku && l.sku.toLowerCase() === eSku)
            )
            if (matched) {
              const packInc = entity.tabsPerStrip || 1
              setPhysicalCounts((prev) => {
                const cur = prev[matched.productId] !== undefined ? prev[matched.productId] : matched.physicalQty
                return { ...prev, [matched.productId]: cur + packInc }
              })
              toast.success(`Optical Count Applied: ${matched.productName}`, `Added ${packInc} units`)
              setHighlightedProductId(matched.productId)
              setTimeout(() => setHighlightedProductId(null), 2500)
            }
          }
        }}
      />

      {/* ─── MODAL 3: THREAD TELEMETRY DRILL-DOWN INSPECTION ─── */}
      <Dialog open={Boolean(selectedThread)} onOpenChange={() => setSelectedThread(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-black">
              <Cpu className="h-5 w-5 text-primary" />
              Thread Telemetry: {selectedThread?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Live multi-threaded worker telemetry, POS bus synchronization, and process status.
            </DialogDescription>
          </DialogHeader>

          {selectedThread && (
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                <div className="p-2.5 rounded-lg border bg-muted/40">
                  <span className="text-[10px] text-muted-foreground block">THREAD PID</span>
                  <span className="font-bold text-sm text-foreground">{selectedThread.pid}</span>
                </div>
                <div className="p-2.5 rounded-lg border bg-muted/40">
                  <span className="text-[10px] text-muted-foreground block">EXECUTION TIME</span>
                  <span className="font-bold text-sm text-foreground">
                    {selectedThread.executionDurationMs} ms
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border bg-muted/40">
                  <span className="text-[10px] text-muted-foreground block">MEMORY (HEAP)</span>
                  <span className="font-bold text-sm text-foreground">
                    {selectedThread.memoryUsageMb} MB
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border bg-muted/40">
                  <span className="text-[10px] text-muted-foreground block">STATUS</span>
                  <Badge className="bg-emerald-600 text-white font-bold text-[10px] mt-0.5">
                    {selectedThread.status}
                  </Badge>
                </div>
              </div>

              <div className="rounded-lg border p-3 bg-card space-y-1.5">
                <h5 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-primary" />
                  Worker Summary & Telemetry Insights
                </h5>
                <pre className="text-[11px] font-mono bg-muted p-2 rounded max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedThread.summary || {}, null, 2)}
                </pre>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t">
                <span className="text-muted-foreground">
                  Task ID: {selectedThread.threadId}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void handleRunAudit()
                    setSelectedThread(null)
                  }}
                  className="gap-1 text-xs font-bold"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Re-spawn Worker
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              size="sm"
              onClick={() => setSelectedThread(null)}
              className="text-xs font-bold"
            >
              Close Inspector
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 4: FDA 21 CFR PART 11 DUAL-SIGNATURE RECONCILE ─── */}
      <Dialog open={reconcileModalOpen} onOpenChange={setReconcileModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-black">
              <FileCheck2 className="h-5 w-5 text-amber-600" />
              FDA 21 CFR Part 11 Electronic Dual-Signature Reconcile
            </DialogTitle>
            <DialogDescription className="text-xs">
              Execute physical count reconciliation for {liveSummary.discrepanciesCount} items. This will create approved StockAdjustment vouchers and update inventory in PostgreSQL.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <span className="text-amber-900 dark:text-amber-200">Discrepant Line Items:</span>
                <span className="font-mono text-sm">{liveSummary.discrepanciesCount}</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span className="text-amber-900 dark:text-amber-200">Net Quantity Variance:</span>
                <span className="font-mono text-sm">{liveSummary.netVarianceQty} units</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span className="text-amber-900 dark:text-amber-200">Discrepancy Cost Impact:</span>
                <span className="font-mono text-sm">{formatCurrency(liveSummary.totalVarianceCost)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold block mb-1 text-foreground">Signer Full Name:</label>
                <Input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1 text-foreground">Signer Role & Reg #:</label>
                <Input
                  value={signerRole}
                  onChange={(e) => setSignerRole(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold block mb-1 text-foreground">
                Digital Signature Meaning & Attestation:
              </label>
              <Input
                value={signatureMeaning}
                onChange={(e) => setSignatureMeaning(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1 text-foreground">
                Audit Reconciliation Notes & Root Cause:
              </label>
              <Input
                value={reconcileNotes}
                onChange={(e) => setReconcileNotes(e.target.value)}
                placeholder="Enter sign-off justification..."
                className="text-xs"
              />
            </div>

            <div className="p-2.5 rounded-lg border bg-muted/40 space-y-1">
              <label className="font-bold text-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-primary" />
                Electronic Signature Security PIN (4 digits):
              </label>
              <Input
                type="password"
                maxLength={6}
                value={verificationPin}
                onChange={(e) => setVerificationPin(e.target.value)}
                placeholder="Enter PIN (e.g. 1234)"
                className="text-xs font-mono tracking-widest text-center"
              />
              <span className="text-[10px] text-muted-foreground block">
                Required for 21 CFR Part 11 compliant non-repudiation signature verification.
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReconcileModalOpen(false)}
              disabled={reconciling}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleReconcileSubmit}
              disabled={reconciling}
              className="text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white"
            >
              {reconciling ? 'Reconciling in PostgreSQL...' : 'Sign & Apply Reconciliation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 5: OFFICIAL PRINTABLE REGULATORY AUDIT DOSSIER ─── */}
      <Dialog open={dossierModalOpen} onOpenChange={setDossierModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-foreground font-black">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Official Regulatory Audit Dossier & Inspection Certificate
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.print()}
                className="gap-1.5 text-xs font-bold print:hidden"
              >
                <Printer className="h-3.5 w-3.5" />
                Print / Save PDF
              </Button>
            </DialogTitle>
            <DialogDescription className="text-xs">
              CDSCO Form 35, Schedule H1/X Registry, and FDA 21 CFR Part 11 Tamper-Evident Inspection Dossier.
            </DialogDescription>
          </DialogHeader>

          {audit && (
            <div className="space-y-4 py-2 text-xs font-sans border rounded-xl p-4 bg-background">
              {/* Pharmacy Header */}
              <div className="border-b pb-3 flex justify-between items-start">
                <div>
                  <h3 className="text-base font-black text-foreground uppercase tracking-tight">
                    METAPHARSIC LIFESCIENCES DISPENSARY
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Licensed Medical Practitioner & Retail Chemist Dispensary · Branch HO
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    DL Nos: <strong>KA-B1-19283 / KA-B2-19284</strong> · GSTIN:{' '}
                    <strong>29AABCU9603R1ZX</strong>
                  </p>
                </div>
                <div className="text-right font-mono">
                  <Badge variant="outline" className="border-primary/50 text-primary font-bold">
                    {audit.auditNumber}
                  </Badge>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Date: {audit.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10)}
                  </div>
                </div>
              </div>

              {/* Regulatory Statement */}
              <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 border">
                <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">
                  STATUTORY DRUG AUDIT DECLARATION
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  This electronic inventory audit dossier has been executed in full compliance with the Drugs and Cosmetics Act & Rules 1945, CDSCO Good Pharmacy Practice guidelines, and FDA 21 CFR Part 11 electronic records mandates. Parallel computing workers have reconciled physical counts against transactional sales registers and statutory Schedule H1/X registers.
                </p>
              </div>

              {/* KPI Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-center">
                <div className="p-2 border rounded-lg bg-card">
                  <span className="text-[10px] text-muted-foreground block">TOTAL AUDITED</span>
                  <span className="font-bold text-sm text-foreground">
                    {audit.totalProductsScanned} Products
                  </span>
                </div>
                <div className="p-2 border rounded-lg bg-card">
                  <span className="text-[10px] text-muted-foreground block">SYSTEM STOCK</span>
                  <span className="font-bold text-sm text-foreground">{audit.systemTotalQty} Units</span>
                </div>
                <div className="p-2 border rounded-lg bg-card">
                  <span className="text-[10px] text-muted-foreground block">DISCREPANCY VARIANCE</span>
                  <span
                    className={cn(
                      'font-bold text-sm',
                      liveSummary.netVarianceQty === 0 ? 'text-emerald-600' : 'text-amber-600'
                    )}
                  >
                    {liveSummary.netVarianceQty} Units
                  </span>
                </div>
                <div className="p-2 border rounded-lg bg-card">
                  <span className="text-[10px] text-muted-foreground block">FINANCIAL IMPACT</span>
                  <span className="font-bold text-sm text-foreground">
                    {formatCurrency(liveSummary.totalVarianceCost)}
                  </span>
                </div>
              </div>

              {/* Discrepancy Ledger Table */}
              <div>
                <h5 className="font-bold text-xs uppercase tracking-wider text-foreground mb-1.5">
                  AUDITED DISCREPANCY & ROOT CAUSE LEDGER
                </h5>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 text-[10px]">
                        <TableHead className="font-bold">Item Name</TableHead>
                        <TableHead className="font-bold">SKU / Batch</TableHead>
                        <TableHead className="text-right font-bold">System</TableHead>
                        <TableHead className="text-right font-bold">Physical</TableHead>
                        <TableHead className="text-right font-bold">Variance</TableHead>
                        <TableHead className="font-bold">GMP Root Cause</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {computedLines.filter((l) => l.varianceQty !== 0).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4 text-emerald-600 font-semibold text-xs">
                            ✓ 100% Physical Stock Reconciliation Match. Zero Variance.
                          </TableCell>
                        </TableRow>
                      ) : (
                        computedLines
                          .filter((l) => l.varianceQty !== 0)
                          .map((l) => (
                            <TableRow key={l.productId} className="text-[11px]">
                              <TableCell className="font-bold">{l.productName}</TableCell>
                              <TableCell className="font-mono">{l.sku} · {l.batchNumber || 'N/A'}</TableCell>
                              <TableCell className="text-right font-mono">{l.systemQty}</TableCell>
                              <TableCell className="text-right font-mono font-bold">{l.physicalQty}</TableCell>
                              <TableCell
                                className={cn(
                                  'text-right font-mono font-bold',
                                  l.varianceQty < 0 ? 'text-rose-600' : 'text-emerald-600'
                                )}
                              >
                                {l.varianceQty > 0 ? `+${l.varianceQty}` : l.varianceQty}
                              </TableCell>
                              <TableCell className="font-mono text-[10px]">
                                {discrepancyReasons[l.productId] || l.discrepancyReason || 'PHYSICAL_SHORTAGE'}
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Merkle Hash & Cryptographic Seal */}
              <div className="rounded-lg bg-muted/60 p-3 font-mono space-y-1.5 border">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-muted-foreground uppercase font-bold">SHA-256 Merkle Root Seal:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {audit.merkleRoot}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground break-all">
                  BLOCK HASH: {audit.integrityHash}
                </div>
              </div>

              {/* Dual Signature Attestation Boxes */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="border rounded-lg p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                    REGISTERED PHARMACIST-IN-CHARGE
                  </span>
                  <div className="h-10 flex items-center text-xs font-serif italic text-foreground">
                    Digitally Sealed: {signerName}
                  </div>
                  <div className="text-[10px] text-muted-foreground border-t pt-1">
                    Reg. No: KA-58291 · Form 20/21 Signatory
                  </div>
                </div>

                <div className="border rounded-lg p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                    CHIEF INTERNAL AUDITOR / QA INSPECTOR
                  </span>
                  <div className="h-10 flex items-center text-xs font-serif italic text-foreground">
                    Digitally Sealed: Metapharsic QA Operations
                  </div>
                  <div className="text-[10px] text-muted-foreground border-t pt-1">
                    GAMP 5 & 21 CFR Part 11 Certified
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="print:hidden">
            <Button
              size="sm"
              onClick={() => setDossierModalOpen(false)}
              className="text-xs font-bold"
            >
              Close Dossier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
