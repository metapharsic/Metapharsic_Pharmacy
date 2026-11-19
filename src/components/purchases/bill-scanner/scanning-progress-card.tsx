'use client'

import {
  AlertCircle,
  Binary,
  CheckCircle2,
  Cpu,
  FileCheck2,
  FileSearch,
  Layers,
  Loader2,
  ShieldCheck,
  Sparkles,
  Timer,
  Upload,
  Zap,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'

import type { ReviewBillThread, ScanStage } from './types'

export interface ScanningProgressCardProps {
  currentStage: ScanStage
  progressPercent: number
  overallConfidence?: number
  threads?: ReviewBillThread[]
  merkleRoot?: string
  errorMessage?: string | null
  onRetry?: () => void
  className?: string
}

const STAGES: Array<{
  id: ScanStage
  label: string
  description: string
  icon: React.ElementType
  threadName: string
}> = [
  {
    id: 'uploading',
    label: 'Document Ingestion',
    description: 'CLAHE contrast equalization & binary normalization',
    icon: Upload,
    threadName: 'Thread 1: Vision Ingestion',
  },
  {
    id: 'ocr',
    label: 'OCR Recognition',
    description: 'Multi-threaded neural text detection & character recognition',
    icon: Cpu,
    threadName: 'Thread 2: Neural OCR Engine',
  },
  {
    id: 'extracting',
    label: 'Pharma Entity Parsing',
    description: 'Segmenting medicine names, batches, expiries, quantities & rates',
    icon: FileSearch,
    threadName: 'Thread 3: Table Geometry Clusterer',
  },
  {
    id: 'matching',
    label: 'Catalog Fuzzy Matching',
    description: 'Matching master catalog, auto-provisioning distinct SKUs & tax audit',
    icon: Sparkles,
    threadName: 'Thread 4: Provisioning & Audit',
  },
]

export function ScanningProgressCard({
  currentStage,
  progressPercent,
  overallConfidence,
  threads,
  merkleRoot,
  errorMessage,
  onRetry,
  className,
}: ScanningProgressCardProps) {
  const [elapsedSec, setElapsedSec] = useState<number>(0)

  // Track elapsed time during active scan
  useEffect(() => {
    if (currentStage === 'ready' || errorMessage) return
    const timer = setInterval(() => {
      setElapsedSec((prev) => Math.round((prev + 0.1) * 10) / 10)
    }, 100)
    return () => clearInterval(timer)
  }, [currentStage, errorMessage])

  const getStageStatus = (
    stageId: ScanStage
  ): 'completed' | 'in_progress' | 'pending' | 'error' => {
    if (errorMessage && currentStage === stageId) return 'error'

    const stageOrder: ScanStage[] = ['uploading', 'ocr', 'extracting', 'matching', 'ready']
    const currentIndex = stageOrder.indexOf(currentStage)
    const thisIndex = stageOrder.indexOf(stageId)

    if (currentStage === 'ready') return 'completed'
    if (currentIndex > thisIndex) return 'completed'
    if (currentIndex === thisIndex) return 'in_progress'
    return 'pending'
  }

  const clampedPercent = Math.min(100, Math.max(0, Math.round(progressPercent)))

  return (
    <Card className={cn('border-primary/25 bg-card/80 backdrop-blur-md shadow-md transition-all', className)}>
      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Header with Title, Live Elapsed Timer, and Percentage Display */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all shadow-sm',
                currentStage === 'ready'
                  ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                  : errorMessage
                    ? 'bg-destructive/15 text-destructive border border-destructive/30'
                    : 'bg-primary/15 text-primary border border-primary/30 animate-pulse'
              )}
            >
              {currentStage === 'ready' ? (
                <FileCheck2 className="h-6 w-6 text-emerald-600" />
              ) : errorMessage ? (
                <AlertCircle className="h-6 w-6 text-destructive" />
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-foreground">
                  {currentStage === 'ready'
                    ? 'Multi-Thread Extraction & Verification Complete'
                    : errorMessage
                      ? 'Scan Processing Interrupted'
                      : 'Automated Bill Extraction Pipeline (Multi-Thread Processing)'}
                </h4>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-2 py-0.5 font-semibold flex items-center gap-1',
                    currentStage === 'ready'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                      : 'border-primary/30 bg-primary/10 text-primary'
                  )}
                >
                  <Zap className="h-2.5 w-2.5" />
                  {currentStage === 'ready' ? '100% Extracted' : '5 Parallel Threads Active'}
                </Badge>
              </div>

              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-muted-foreground">
                  {currentStage === 'uploading' && 'Thread 1: Preprocessing image buffers & equalizing high-resolution contrast...'}
                  {currentStage === 'ocr' && 'Thread 2: Extracting OCR characters & text layers via neural vision stream...'}
                  {currentStage === 'extracting' && 'Thread 3: Segmenting tabular formulation lines, batch codes & expiry dates...'}
                  {currentStage === 'matching' && 'Thread 4 & 5: Matching inventory catalog & computing Merkle audit root...'}
                  {currentStage === 'ready' && 'All line items, batches, PTR/MRP margins and statutory taxes loaded successfully.'}
                </p>
                {currentStage !== 'ready' && !errorMessage && (
                  <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-0.5 ml-1">
                    <Timer className="h-3 w-3 text-primary inline" />
                    {elapsedSec.toFixed(1)}s
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Large Visible Percentage Box */}
          <div className="flex items-center gap-3 bg-muted/30 px-3.5 py-1.5 rounded-xl border border-border/60">
            <div className="text-right">
              <div className="flex items-baseline justify-end gap-1">
                <span className="text-2xl font-black font-mono tracking-tight text-primary">
                  {clampedPercent}%
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  {currentStage === 'ready' ? 'Done' : 'Progress'}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono block">
                {currentStage === 'ready'
                  ? `${threads?.length || 5} Threads Verified`
                  : 'Stage ' + (['uploading', 'ocr', 'extracting', 'matching', 'ready'].indexOf(currentStage) + 1) + '/4'}
              </span>
            </div>

            {overallConfidence !== undefined && currentStage === 'ready' && (
              <Badge
                variant="default"
                className={cn(
                  'text-xs font-bold px-2 py-1',
                  overallConfidence >= 0.85
                    ? 'bg-emerald-600 text-white'
                    : overallConfidence >= 0.65
                      ? 'bg-amber-500 text-white'
                      : 'border-amber-500 text-amber-700'
                )}
              >
                {Math.round(overallConfidence * 100)}% Confidence
              </Badge>
            )}
          </div>
        </div>

        {/* Dynamic Animated Progress Bar */}
        <div className="space-y-1">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/80 p-0.5 border border-border/40">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300 ease-out shadow-xs',
                errorMessage
                  ? 'bg-destructive'
                  : currentStage === 'ready'
                    ? 'bg-emerald-600'
                    : 'bg-gradient-to-r from-primary to-emerald-500 animate-pulse'
              )}
              style={{ width: `${clampedPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground px-1">
            <span>0% Ingestion</span>
            <span>25% Optical Scan</span>
            <span>50% Neural OCR</span>
            <span>75% Table Clustering</span>
            <span>100% Provisioned</span>
          </div>
        </div>

        {/* 4 Pipeline Stage Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
          {STAGES.map((s) => {
            const status = getStageStatus(s.id)
            const Icon = s.icon

            return (
              <div
                key={s.id}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg border p-2.5 transition-all shadow-xs',
                  status === 'completed' &&
                    'border-emerald-500/30 bg-emerald-500/5 text-foreground',
                  status === 'in_progress' &&
                    'border-primary/50 bg-primary/10 shadow-sm animate-pulse text-primary',
                  status === 'pending' &&
                    'border-border/50 bg-muted/20 opacity-60 text-muted-foreground',
                  status === 'error' &&
                    'border-destructive/40 bg-destructive/10 text-destructive'
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                    status === 'completed' && 'bg-emerald-500/20 text-emerald-600',
                    status === 'in_progress' && 'bg-primary/20 text-primary',
                    status === 'pending' && 'bg-muted text-muted-foreground',
                    status === 'error' && 'bg-destructive/20 text-destructive'
                  )}
                >
                  {status === 'completed' ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : status === 'in_progress' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : status === 'error' ? (
                    <AlertCircle className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold leading-tight truncate">{s.label}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight line-clamp-1 mt-0.5">
                    {s.description}
                  </p>
                  <span className="text-[9px] font-mono text-primary/80 mt-1 block">
                    {s.threadName}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Multi-Thread Worker Monitor Panel */}
        {threads && threads.length > 0 ? (
          <div className="rounded-lg border border-border/80 bg-background/60 p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <Binary className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  Multi-Thread Worker Cluster ({threads.length} Parallel Threads)
                </span>
              </div>
              {merkleRoot && (
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-border/50">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" />
                  <span>Merkle Digest: {merkleRoot.substring(0, 16)}...</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
              {threads.map((t, idx) => (
                <div
                  key={idx}
                  className="rounded-md border border-border/60 bg-card p-2 text-[11px] space-y-1 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground truncate pr-1">
                      {t.name.replace('Thread: ', '')}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 font-mono text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                    >
                      PID {t.pid}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                    {t.summary ? Object.entries(t.summary).map(([k, v]) => `${k}: ${v}`).join(' • ') : `Status: ${t.status}`}
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[9px] font-mono text-muted-foreground">
                    <span>⏱ {t.executionDurationMs}ms</span>
                    <span>💾 {t.memoryUsageMb}MB</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Live Active Threads Preview while scanning */
          currentStage !== 'ready' && !errorMessage && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Layers className="h-3.5 w-3.5 text-primary animate-pulse" />
                  <span>Parallel Multi-Thread Engine Active:</span>
                </div>
                <span className="text-[10px] font-mono text-primary font-bold">5 Threads Parallelizing Ingestion</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mt-2 text-[10px] font-mono text-muted-foreground">
                <div className="flex items-center gap-1 bg-background/80 p-1 rounded border border-border/40">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="truncate">T1: Image Prep</span>
                </div>
                <div className="flex items-center gap-1 bg-background/80 p-1 rounded border border-border/40">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                  <span className="truncate">T2: Neural OCR</span>
                </div>
                <div className="flex items-center gap-1 bg-background/80 p-1 rounded border border-border/40">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                  <span className="truncate">T3: Table Geometry</span>
                </div>
                <div className="flex items-center gap-1 bg-background/80 p-1 rounded border border-border/40">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping" />
                  <span className="truncate">T4: Catalog Linker</span>
                </div>
                <div className="flex items-center gap-1 bg-background/80 p-1 rounded border border-border/40">
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-ping" />
                  <span className="truncate">T5: Merkle Audit</span>
                </div>
              </div>
            </div>
          )
        )}

        {/* Error Banner and Retry Button */}
        {errorMessage && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            {onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                Retry Scan
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
