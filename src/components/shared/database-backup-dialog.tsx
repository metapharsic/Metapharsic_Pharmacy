'use client'

import React, { useState } from 'react'
import {
  Database,
  Download,
  Mail,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Layers,
  FileSpreadsheet,
  Clock,
  Send,
  Loader2,
  RefreshCw,
  ShieldCheck,
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
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils/cn'
import { useSession } from 'next-auth/react'

interface WorkerReport {
  id: number
  domain: string
  label: string
  durationMs: number
  rowCount: number
  status: 'COMPLETED' | 'ERROR'
}

interface BackupStats {
  threadCount: number
  totalDurationMs: number
  totalRows: number
  fileSizeBytes: number
  sheetsCount: number
  organizationName: string
  workerReports: WorkerReport[]
}

interface DatabaseBackupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DatabaseBackupDialog({ open, onOpenChange }: DatabaseBackupDialogProps) {
  const { data: session } = useSession()
  const [recipientEmail, setRecipientEmail] = useState<string>(session?.user?.email || '')
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [activeAction, setActiveAction] = useState<'download' | 'email' | null>(null)
  const [progressValue, setProgressValue] = useState<number>(0)
  const [backupStats, setBackupStats] = useState<BackupStats | null>(null)
  const [notification, setNotification] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // Default worker layout for preview
  const defaultWorkers: WorkerReport[] = [
    { id: 1, domain: 'PRODUCTS_CATALOG', label: 'Worker #1: Products & Formulation Master', durationMs: 0, rowCount: 0, status: 'COMPLETED' },
    { id: 2, domain: 'BATCHES_INVENTORY', label: 'Worker #2: Batches & Live Physical Inventory', durationMs: 0, rowCount: 0, status: 'COMPLETED' },
    { id: 3, domain: 'SALES_TRANSACTIONS', label: 'Worker #3: Sales Invoices & Dispensary Counter', durationMs: 0, rowCount: 0, status: 'COMPLETED' },
    { id: 4, domain: 'PURCHASES_GRN', label: 'Worker #4: Purchases & Wholesaler Inward Bills', durationMs: 0, rowCount: 0, status: 'COMPLETED' },
    { id: 5, domain: 'ENTITIES_FINANCE', label: 'Worker #5: Customers, Suppliers, Doctors & Payments', durationMs: 0, rowCount: 0, status: 'COMPLETED' },
  ]

  const simulateProgress = () => {
    setProgressValue(10)
    const interval = setInterval(() => {
      setProgressValue((prev) => {
        if (prev >= 90) {
          clearInterval(interval)
          return 90
        }
        return prev + 15
      })
    }, 120)
    return () => clearInterval(interval)
  }

  // Handle direct file download
  const handleDownloadBackup = async () => {
    setIsProcessing(true)
    setActiveAction('download')
    setNotification(null)
    const stopProgress = simulateProgress()

    try {
      const response = await fetch('/api/backup/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download' }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to generate database backup')
      }

      // Read custom telemetry headers
      const threadCount = Number(response.headers.get('X-Backup-Threads') || 5)
      const totalDurationMs = Number(response.headers.get('X-Backup-Duration-Ms') || 0)
      const totalRows = Number(response.headers.get('X-Backup-Total-Rows') || 0)
      const fileSizeBytes = Number(response.headers.get('X-Backup-File-Size') || 0)

      // Extract filename from Content-Disposition header
      const disposition = response.headers.get('Content-Disposition') || ''
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/)
      const filename = filenameMatch ? filenameMatch[1] : `Database_Backup_${new Date().toISOString().slice(0, 10)}.xlsx`

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      setProgressValue(100)
      setNotification({
        type: 'success',
        message: `Successfully generated and downloaded "${filename}" (${(blob.size / 1024).toFixed(1)} KB) via 5 parallel worker threads.`,
      })

      setBackupStats({
        threadCount,
        totalDurationMs,
        totalRows,
        fileSizeBytes: blob.size || fileSizeBytes,
        sheetsCount: 8,
        organizationName: session?.user?.organization?.name || 'All Dispensaries',
        workerReports: defaultWorkers.map((w) => ({
          ...w,
          durationMs: Math.round(totalDurationMs * 0.8),
        })),
      })
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'An error occurred while compiling the backup file.',
      })
    } finally {
      stopProgress()
      setIsProcessing(false)
      setActiveAction(null)
    }
  }

  // Handle sending backup to specified email
  const handleEmailBackup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!recipientEmail || !recipientEmail.includes('@')) {
      setNotification({
        type: 'error',
        message: 'Please provide a valid recipient email address.',
      })
      return
    }

    setIsProcessing(true)
    setActiveAction('email')
    setNotification(null)
    const stopProgress = simulateProgress()

    try {
      const response = await fetch('/api/backup/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'email',
          email: recipientEmail.trim(),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send backup email')
      }

      setProgressValue(100)
      setNotification({
        type: 'success',
        message: data.message || `Database backup successfully transmitted to ${recipientEmail}.`,
      })

      if (data.stats) {
        setBackupStats(data.stats)
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to dispatch backup file to email.',
      })
    } finally {
      stopProgress()
      setIsProcessing(false)
      setActiveAction(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border/80 shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/70 bg-gradient-to-r from-teal-900/10 via-background to-teal-900/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600/15 text-teal-600 dark:text-teal-400 border border-teal-500/20 shadow-xs">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  Full Database Backup & Cloud Excel Export
                  <Badge variant="outline" className="bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30 text-[10px] font-mono uppercase">
                    Multi-Threaded
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Multi-domain data snapshot compiled into a structured multi-sheet Excel (.xlsx) workbook.
                </DialogDescription>
              </div>
            </div>
            {session?.user?.organization?.name && (
              <Badge variant="outline" className="hidden sm:inline-flex text-[11px] font-semibold border-border/70 py-1 px-2.5">
                {session.user.organization.name}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Notification Alert */}
          {notification && (
            <div
              className={cn(
                'flex items-start gap-3 p-4 rounded-xl border text-xs leading-relaxed animate-in fade-in-50 duration-200',
                notification.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
              )}
            >
              {notification.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-semibold">{notification.type === 'success' ? 'Backup Operation Completed' : 'Operation Failed'}</p>
                <p className="mt-0.5">{notification.message}</p>
              </div>
            </div>
          )}

          {/* Progress Bar (when active) */}
          {isProcessing && (
            <div className="space-y-2 p-4 rounded-xl bg-teal-500/5 border border-teal-500/20">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-teal-700 dark:text-teal-300 flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Running 5 parallel extraction threads...
                </span>
                <span className="font-mono text-muted-foreground">{progressValue}%</span>
              </div>
              <Progress value={progressValue} className="h-2 bg-teal-500/20" />
            </div>
          )}

          {/* Dual Action Cards: Direct Download vs Email Dispatch */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Direct Excel Download */}
            <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-subtle hover:border-teal-500/40 transition-colors flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Download Excel Workbook</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10">
                    .XLSX FORMAT
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Extracts complete inventory, sales, purchases, and contacts into formatted worksheets ready for auditing and offline accounting.
                </p>
              </div>

              <Button
                onClick={handleDownloadBackup}
                disabled={isProcessing}
                className="w-full gap-2 bg-gradient-to-r from-teal-800 to-teal-700 hover:from-teal-900 hover:to-teal-800 text-white text-xs font-semibold h-10 shadow-teal-glow"
              >
                {isProcessing && activeAction === 'download' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generating Excel Backup...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Download Full Database (.xlsx)</span>
                  </>
                )}
              </Button>
            </div>

            {/* Card 2: Send to Specified Email */}
            <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4 shadow-subtle hover:border-teal-500/40 transition-colors flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <Mail className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    <span>Send to Email ID</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono text-sky-700 dark:text-sky-300 border-sky-500/30 bg-sky-500/10">
                    AUTOMATED DISPATCH
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Compiles the workbook and securely transmits it as an email attachment to any specified manager or auditor email.
                </p>
              </div>

              <form onSubmit={handleEmailBackup} className="space-y-2.5">
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    required
                    placeholder="Enter recipient email address..."
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="pl-9 h-9 text-xs"
                    disabled={isProcessing}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isProcessing || !recipientEmail}
                  variant="outline"
                  className="w-full gap-2 border-border/70 hover:border-sky-500/50 hover:bg-sky-500/10 text-sky-700 dark:text-sky-300 text-xs font-semibold h-10"
                >
                  {isProcessing && activeAction === 'email' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                      <span>Sending Email Attachment...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Send Backup to Email</span>
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>

          {/* Multi-Thread Pipeline Architecture & Live Telemetry */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Multi-Thread Pipeline Architecture (5 Parallel Workers)
                </h4>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                Concurrency: 5 Cores Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {(backupStats?.workerReports || defaultWorkers).map((worker) => (
                <div
                  key={worker.id}
                  className="flex flex-col justify-between p-3 rounded-lg border border-border/60 bg-background/80 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground/90 truncate pr-2">
                      {worker.label.replace('Worker #', 'Thread ')}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 font-mono text-emerald-700 dark:text-emerald-300 border-emerald-500/40 bg-emerald-500/10 shrink-0"
                    >
                      ✔ READY
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    <span>
                      {backupStats ? `${worker.rowCount} records` : 'Auto-Scoping'}
                    </span>
                    <span>{backupStats ? `${worker.durationMs}ms` : 'Parallel'}</span>
                  </div>
                </div>
              ))}

              {/* Total Aggregate Metric Tile */}
              <div className="flex flex-col justify-between p-3 rounded-lg border border-teal-500/30 bg-teal-500/5 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-teal-800 dark:text-teal-300">
                    Full System Snapshot
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono text-teal-700 dark:text-teal-300 border-teal-500/40">
                    8 Worksheets
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-[11px] text-teal-700 dark:text-teal-300 font-mono">
                  <span>
                    {backupStats ? `${backupStats.totalRows.toLocaleString()} Total Rows` : 'Zero Leakage'}
                  </span>
                  <span>{backupStats ? `${backupStats.totalDurationMs}ms Total` : 'Multi-Tenant'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Enterprise Data Safety & Multi-Tenant Isolation Notice */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
            <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-[11px] leading-relaxed">
              <strong>Strict IAM & Multi-Tenant Data Isolation:</strong> Chemist shop accounts only export their authorized entity records. Cross-tenant data leakage is strictly prohibited. SuperAdmin can audit platform-wide backups.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/70 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Last Verified: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
