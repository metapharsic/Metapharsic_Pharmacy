'use client'

// ─────────────────────────────────────────────────────────────
// Component — BatchExpirySweepModal
// Enterprise Multi-Threaded & Spawned Batch Expiry Sweep Modal
// High-throughput parallel CAS batch processor with live telemetry
// ─────────────────────────────────────────────────────────────
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Cpu,
  Loader2,
  Play,
  RotateCcw,
  Sliders,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/lib/hooks/use-toast'

interface BatchExpirySweepModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type SweepMode = 'worker' | 'spawn'

interface SweepTelemetry {
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  jobId?: string
  pid?: number
  percentComplete: number
  batchesExpired: number
  batchesSkipped: number
  batchesFailed: number
  totalDue: number
  durationMs: number
  throughput: number
  workersUsed: number
  chunksCount: number
}

const INITIAL_TELEMETRY: SweepTelemetry = {
  status: 'IDLE',
  percentComplete: 0,
  batchesExpired: 0,
  batchesSkipped: 0,
  batchesFailed: 0,
  totalDue: 0,
  durationMs: 0,
  throughput: 0,
  workersUsed: 4,
  chunksCount: 0,
}

export function BatchExpirySweepModal({
  open,
  onOpenChange,
  onSuccess,
}: BatchExpirySweepModalProps) {
  const toast = useToast()
  const [mode, setMode] = useState<SweepMode>('worker')
  const [concurrency, setConcurrency] = useState<number>(4)
  const [chunkSize, setChunkSize] = useState<number>(50)
  const [dryRun, setDryRun] = useState<boolean>(false)

  const [telemetry, setTelemetry] = useState<SweepTelemetry>(INITIAL_TELEMETRY)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!open) {
      stopPolling()
      setIsSubmitting(false)
      setTelemetry(INITIAL_TELEMETRY)
    }
    return () => stopPolling()
  }, [open, stopPolling])

  const pollJobStatus = useCallback(
    (jobId: string) => {
      stopPolling()
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/batches/expire?jobId=${encodeURIComponent(jobId)}`)
          const json = await res.json()

          if (!json.success || !json.job) return

          const { job } = json

          if (job.status === 'RUNNING' && job.progress) {
            setTelemetry((prev) => ({
              ...prev,
              status: 'RUNNING',
              percentComplete: job.progress.percentComplete ?? 0,
              batchesExpired: job.progress.batchesExpired ?? 0,
              batchesSkipped: job.progress.batchesSkipped ?? 0,
              batchesFailed: job.progress.batchesFailed ?? 0,
              throughput: job.progress.currentThroughput ?? 0,
              durationMs: job.progress.elapsedMs ?? 0,
            }))
          } else if (job.status === 'COMPLETED') {
            stopPolling()
            setIsSubmitting(false)
            const result = job.result || {}
            setTelemetry({
              status: 'COMPLETED',
              jobId: job.jobId,
              pid: job.pid,
              percentComplete: 100,
              batchesExpired: result.expiredCount ?? 0,
              batchesSkipped: result.skippedCount ?? 0,
              batchesFailed: result.errorCount ?? 0,
              totalDue: result.totalDue ?? 0,
              durationMs: result.durationMs ?? 0,
              throughput: result.throughput ?? 0,
              workersUsed: result.workersUsed ?? 0,
              chunksCount: result.chunksCount ?? 0,
            })
            toast.success(
              `Sweep completed: ${result.expiredCount ?? 0} batches transitioned to EXPIRED (${result.durationMs ?? 0}ms)`
            )
            onSuccess?.()
          } else if (job.status === 'FAILED') {
            stopPolling()
            setIsSubmitting(false)
            setTelemetry((prev) => ({ ...prev, status: 'FAILED' }))
            toast.error(job.error || 'Spawned expiry sweep process failed')
          }
        } catch {
          // Keep polling until exit or close
        }
      }, 800)
    },
    [stopPolling, toast, onSuccess]
  )

  const handleRunSweep = async () => {
    setIsSubmitting(true)
    setTelemetry({
      ...INITIAL_TELEMETRY,
      status: 'RUNNING',
      workersUsed: concurrency,
    })

    try {
      const res = await fetch('/api/batches/expire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          concurrency,
          chunkSize,
          dryRun,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Sweep execution failed')
      }

      if (mode === 'spawn') {
        setTelemetry((prev) => ({
          ...prev,
          status: 'RUNNING',
          jobId: data.jobId,
          pid: data.pid,
        }))
        pollJobStatus(data.jobId)
      } else {
        // Direct multi-threaded worker pool completion
        setIsSubmitting(false)
        setTelemetry({
          status: 'COMPLETED',
          percentComplete: 100,
          batchesExpired: data.expiredCount ?? 0,
          batchesSkipped: data.skippedCount ?? 0,
          batchesFailed: data.errorCount ?? 0,
          totalDue: data.totalDue ?? 0,
          durationMs: data.durationMs ?? 0,
          throughput: data.throughput ?? 0,
          workersUsed: data.workersUsed ?? concurrency,
          chunksCount: data.chunksCount ?? 0,
        })
        toast.success(
          `Multi-threaded sweep complete: ${data.expiredCount} batches expired across ${data.workersUsed} worker threads (${data.durationMs}ms)`
        )
        onSuccess?.()
      }
    } catch (err) {
      setIsSubmitting(false)
      setTelemetry((prev) => ({ ...prev, status: 'FAILED' }))
      toast.error(err instanceof Error ? err.message : 'Failed to execute expiry sweep')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                Enterprise Batch Expiry Engine
              </DialogTitle>
              <DialogDescription>
                High-throughput parallel CAS batch processor with dedicated worker threads & spawned processes
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Architecture info callout */}
          <Alert className="border-emerald-200 bg-emerald-50/50 text-emerald-900">
            <Zap className="h-4 w-4 text-emerald-600" />
            <AlertTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              High-Concurrency Architecture
            </AlertTitle>
            <AlertDescription className="text-xs text-emerald-700">
              Leverages Node.js worker thread pools and isolated child processes with Compare-And-Swap (CAS)
              guarantees to prevent race conditions with concurrent POS sales and dispensary operations.
            </AlertDescription>
          </Alert>

          {/* Configuration Grid */}
          <div className="grid grid-cols-2 gap-4 rounded-lg border bg-slate-50/60 p-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Execution Mode</Label>
              <Select
                value={mode}
                onValueChange={(val) => setMode(val as SweepMode)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-9 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="worker">Multi-Threaded Worker Pool (In-Process)</SelectItem>
                  <SelectItem value="spawn">Spawned Decoupled Process (Background)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Thread Concurrency</Label>
              <Select
                value={String(concurrency)}
                onValueChange={(val) => setConcurrency(Number(val))}
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-9 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 CPU Cores / Threads</SelectItem>
                  <SelectItem value="4">4 CPU Cores / Threads (Recommended)</SelectItem>
                  <SelectItem value="8">8 CPU Cores / Threads (High-Power)</SelectItem>
                  <SelectItem value="16">16 CPU Cores / Threads (Server Max)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Chunk Transaction Size</Label>
              <Select
                value={String(chunkSize)}
                onValueChange={(val) => setChunkSize(Number(val))}
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-9 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 Batches / Chunk</SelectItem>
                  <SelectItem value="50">50 Batches / Chunk (Standard)</SelectItem>
                  <SelectItem value="100">100 Batches / Chunk (Bulk)</SelectItem>
                  <SelectItem value="250">250 Batches / Chunk (Ultra Fast)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex h-9 cursor-pointer items-center justify-between rounded-md border bg-white px-3">
                <span className="text-xs font-medium text-slate-700">Dry Run (Simulation)</span>
                <Checkbox
                  checked={dryRun}
                  onCheckedChange={(checked) => setDryRun(Boolean(checked))}
                  disabled={isSubmitting}
                />
              </label>
            </div>
          </div>

          {/* Live Telemetry Display */}
          {telemetry.status !== 'IDLE' && (
            <div className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600 animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                    Engine Telemetry
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {telemetry.pid && (
                    <Badge variant="outline" className="text-[11px] font-mono">
                      PID: {telemetry.pid}
                    </Badge>
                  )}
                  {telemetry.status === 'RUNNING' && (
                    <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[11px] flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> RUNNING
                    </Badge>
                  )}
                  {telemetry.status === 'COMPLETED' && (
                    <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> COMPLETED
                    </Badge>
                  )}
                  {telemetry.status === 'FAILED' && (
                    <Badge variant="destructive" className="text-[11px] flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> FAILED
                    </Badge>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-600 font-mono">
                  <span>Progress</span>
                  <span>{telemetry.percentComplete}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-300"
                    style={{ width: `${telemetry.percentComplete}%` }}
                  />
                </div>
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-4 gap-2 pt-1 text-center font-mono">
                <div className="rounded border bg-slate-50 p-2">
                  <div className="text-[10px] text-slate-500 uppercase">Expired</div>
                  <div className="text-base font-bold text-emerald-700">
                    {telemetry.batchesExpired}
                  </div>
                </div>
                <div className="rounded border bg-slate-50 p-2">
                  <div className="text-[10px] text-slate-500 uppercase">Skipped (CAS)</div>
                  <div className="text-base font-bold text-slate-700">
                    {telemetry.batchesSkipped}
                  </div>
                </div>
                <div className="rounded border bg-slate-50 p-2">
                  <div className="text-[10px] text-slate-500 uppercase">Throughput</div>
                  <div className="text-base font-bold text-blue-700">
                    {telemetry.throughput > 0 ? `${telemetry.throughput} b/s` : '—'}
                  </div>
                </div>
                <div className="rounded border bg-slate-50 p-2">
                  <div className="text-[10px] text-slate-500 uppercase">Latency</div>
                  <div className="text-base font-bold text-slate-700">
                    {telemetry.durationMs > 0 ? `${telemetry.durationMs}ms` : '—'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="text-xs text-slate-500">
            {dryRun ? '⚠️ Simulation mode enabled — no records will change' : 'All updates create immutable audit logs'}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Close
            </Button>
            <Button
              onClick={handleRunSweep}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Execute Expiry Sweep
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
