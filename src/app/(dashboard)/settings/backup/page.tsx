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
  Server,
  FileText,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils/cn'

interface WorkerReport {
  id: number
  domain: string
  label: string
  description: string
  tables: string
  durationMs: number
  rowCount: number
  status: 'COMPLETED' | 'READY' | 'ERROR'
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

export default function DatabaseBackupPage() {
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

  const workers: WorkerReport[] = [
    {
      id: 1,
      domain: 'PRODUCTS_CATALOG',
      label: 'Worker Thread #1: Products & Formulation Master',
      description: 'Active medicines, formulation salts, HSN codes, GST %, MRP, PTR, cost price & racks.',
      tables: 'Product, Category, Rack, HsnCode',
      durationMs: 0,
      rowCount: 0,
      status: 'READY',
    },
    {
      id: 2,
      domain: 'BATCHES_INVENTORY',
      label: 'Worker Thread #2: Batches & Live Physical Inventory',
      description: 'Physical batches, stock units, reserved units, sold units, expiry dates & batch valuation.',
      tables: 'Batch, Inventory',
      durationMs: 0,
      rowCount: 0,
      status: 'READY',
    },
    {
      id: 3,
      domain: 'SALES_TRANSACTIONS',
      label: 'Worker Thread #3: Sales Invoices & Dispensary Counter',
      description: 'Point-of-sale invoices, customer details, prescribers, discounts, tax amounts & payments.',
      tables: 'Sale, SaleItem, Payment',
      durationMs: 0,
      rowCount: 0,
      status: 'READY',
    },
    {
      id: 4,
      domain: 'PURCHASES_GRN',
      label: 'Worker Thread #4: Purchases & Wholesaler Inward Bills',
      description: 'Wholesale inward bills, distributor GSTIN, purchase order amounts & balances due.',
      tables: 'Purchase, PurchaseItem, Supplier',
      durationMs: 0,
      rowCount: 0,
      status: 'READY',
    },
    {
      id: 5,
      domain: 'ENTITIES_FINANCE',
      label: 'Worker Thread #5: Customers, Suppliers, Doctors & Payments',
      description: 'Directory of customers, pharmaceutical distributors, registered doctors & settlements.',
      tables: 'Customer, Supplier, Doctor, Payment',
      durationMs: 0,
      rowCount: 0,
      status: 'READY',
    },
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

      const threadCount = Number(response.headers.get('X-Backup-Threads') || 5)
      const totalDurationMs = Number(response.headers.get('X-Backup-Duration-Ms') || 0)
      const totalRows = Number(response.headers.get('X-Backup-Total-Rows') || 0)
      const fileSizeBytes = Number(response.headers.get('X-Backup-File-Size') || 0)

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
        message: `Successfully extracted and downloaded "${filename}" (${(blob.size / 1024).toFixed(1)} KB) via 5 parallel worker threads.`,
      })

      setBackupStats({
        threadCount,
        totalDurationMs,
        totalRows,
        fileSizeBytes: blob.size || fileSizeBytes,
        sheetsCount: 8,
        organizationName: session?.user?.organization?.name || 'All Dispensaries',
        workerReports: workers.map((w) => ({
          ...w,
          durationMs: Math.round(totalDurationMs * 0.8),
          status: 'COMPLETED',
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
        setBackupStats({
          ...data.stats,
          workerReports: data.stats.workerReports.map((wr: any) => ({
            ...wr,
            tables: workers.find((w) => w.id === wr.id)?.tables || 'System Tables',
            description: workers.find((w) => w.id === wr.id)?.description || '',
          })),
        })
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
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200 shadow-xs border border-teal-500/20">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Enterprise Database Backup
                <Badge variant="outline" className="bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30 text-[10px] font-mono uppercase">
                  Multi-Thread Engine
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generate full dispensary database backups in multi-sheet Excel (.xlsx) format and dispatch securely via email.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {session?.user?.organization?.name && (
            <Badge variant="outline" className="text-xs font-semibold px-3 py-1 bg-muted/30 border-border/80">
              {session.user.organization.name}
            </Badge>
          )}
          <Badge variant="teal" className="text-xs font-mono font-bold">
            5 Parallel Workers
          </Badge>
        </div>
      </div>

      {/* Notification Banner */}
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
            <p className="font-semibold">{notification.type === 'success' ? 'Backup Process Succeeded' : 'Operation Error'}</p>
            <p className="mt-0.5">{notification.message}</p>
          </div>
        </div>
      )}

      {/* Live Thread Execution Progress */}
      {isProcessing && (
        <div className="space-y-2 p-4 rounded-xl bg-teal-500/5 border border-teal-500/20 shadow-xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-teal-700 dark:text-teal-300 flex items-center gap-1.5">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Spawning 5 parallel database worker threads...
            </span>
            <span className="font-mono text-muted-foreground font-bold">{progressValue}%</span>
          </div>
          <Progress value={progressValue} className="h-2 bg-teal-500/20" />
        </div>
      )}

      {/* Quick Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-subtle border-border/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Architecture</p>
              <p className="text-base font-bold text-foreground">5 Workers</p>
              <p className="text-[10px] text-teal-600 dark:text-teal-400">Concurrent extraction</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-subtle border-border/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Workbook</p>
              <p className="text-base font-bold text-foreground">8 Sheets</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Formatted .xlsx</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-subtle border-border/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Dispatch</p>
              <p className="text-base font-bold text-foreground">Email Attached</p>
              <p className="text-[10px] text-sky-600 dark:text-sky-400">Direct or scheduled</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-subtle border-border/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">IAM Isolation</p>
              <p className="text-base font-bold text-foreground">Zero Leakage</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400">Scoped to organization</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Main Action Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Module 1: Instant Local Excel Download */}
        <Card className="shadow-subtle border-border/80 flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <CardTitle className="text-base font-bold">1. Take Database Backup (Download .xlsx)</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10">
                OFFLINE ARCHIVE
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Directly compile and download all dispensary tables into a single enterprise Excel workbook with dedicated tabs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Workbook Name:</span>
                <span className="font-mono font-medium text-foreground">
                  {session?.user?.organization?.name ? `${session.user.organization.name.replace(/[^a-zA-Z0-9]/g, '_')}_Backup.xlsx` : 'Database_Backup.xlsx'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Included Worksheets:</span>
                <span className="font-medium text-foreground">Products, Batches, Sales, Purchases, Customers, Suppliers, Doctors, Payments</span>
              </div>
            </div>

            <Button
              onClick={handleDownloadBackup}
              disabled={isProcessing}
              className="w-full gap-2 bg-gradient-to-r from-teal-800 to-teal-700 hover:from-teal-900 hover:to-teal-800 text-white font-semibold shadow-teal-glow text-xs h-11"
            >
              {isProcessing && activeAction === 'download' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing 5 Concurrent Threads...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Take Full Database Backup Now</span>
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Module 2: Send Backup to Specified Email */}
        <Card className="shadow-subtle border-border/80 flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                <CardTitle className="text-base font-bold">2. Send Backup to Specified Email</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono text-sky-700 dark:text-sky-300 border-sky-500/30 bg-sky-500/10">
                CLOUD DISPATCH
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Securely transmit the generated .xlsx backup file as an attachment to any designated manager, auditor, or external backup email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleEmailBackup} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Recipient Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    required
                    placeholder="e.g. auditor@pharmacare.local or accountant@gmail.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="pl-9 text-xs h-10"
                    disabled={isProcessing}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isProcessing || !recipientEmail}
                variant="outline"
                className="w-full gap-2 border-border/70 hover:border-sky-500/50 hover:bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold text-xs h-11"
              >
                {isProcessing && activeAction === 'email' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                    <span>Transmitting Backup File...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Send Backup to Specified Email</span>
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Multi-Thread Pipeline Architecture Details */}
      <Card className="shadow-subtle border-border/80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              <div>
                <CardTitle className="text-sm font-bold">Multi-Thread Concurrent Pipeline Specifications</CardTitle>
                <CardDescription className="text-xs">
                  5 isolated domain pipelines running simultaneously to prevent database locking and maximize throughput.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
              Promise.all Concurrency
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/70 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[80px] text-xs font-semibold">Thread</TableHead>
                  <TableHead className="text-xs font-semibold">Domain Pipeline</TableHead>
                  <TableHead className="text-xs font-semibold">Underlying Tables</TableHead>
                  <TableHead className="text-xs font-semibold">Description</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(backupStats?.workerReports || workers).map((w) => (
                  <TableRow key={w.id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-xs font-bold text-teal-700 dark:text-teal-300">
                      #{w.id}
                    </TableCell>
                    <TableCell className="font-semibold text-xs text-foreground">
                      {w.label.replace(`Worker Thread #${w.id}: `, '')}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {w.tables}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {w.description}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 font-mono text-emerald-700 dark:text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
                      >
                        ✔ {backupStats ? `${w.rowCount} rows` : 'READY'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
