'use client'

import React from 'react'
import {
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils/cn'

export interface ThreadItem {
  id: number
  code: string
  name: string
  label: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERROR'
  durationMs: number
  details: string
  metrics?: Record<string, string | number>
}

interface ThreadStatusCardProps {
  threads: ThreadItem[]
  isExecuting?: boolean
  totalDurationMs?: number
  compact?: boolean
  onClose?: () => void
}

export function ThreadStatusCard({
  threads,
  isExecuting = false,
  totalDurationMs = 0,
  compact = false,
  onClose,
}: ThreadStatusCardProps) {
  const completedCount = threads.filter((t) => t.status === 'COMPLETED').length
  const progressPercent = Math.round((completedCount / (threads.length || 5)) * 100)

  return (
    <div className="w-full rounded-xl border border-teal-500/30 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-md transition-all animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400">
            <Cpu className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-teal-300">
                Multi-Thread Execution Engine
              </h4>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] px-1.5 py-0 font-mono font-semibold',
                  isExecuting
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                )}
              >
                {isExecuting ? 'PROCESSING PIPELINE' : 'ALL THREADS SYNCED'}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400">
              5 Concurrent POS Security & Database Backup Workers
            </p>
          </div>
        </div>

        {totalDurationMs > 0 && (
          <div className="flex items-center gap-1.5 rounded-md bg-slate-800 px-2 py-1 font-mono text-xs text-teal-300">
            <Clock className="h-3.5 w-3.5 text-teal-400" />
            <span>{totalDurationMs} ms</span>
          </div>
        )}
      </div>

      {/* Overall Progress Meter */}
      <div className="my-3 space-y-1">
        <div className="flex justify-between text-[11px] text-slate-400">
          <span>Worker Thread Pipeline Status</span>
          <span className="font-mono text-teal-300 font-semibold">{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-1.5 bg-slate-800" />
      </div>

      {/* Individual Threads List */}
      <div className="space-y-2 pt-1">
        {threads.map((thread) => {
          const isDone = thread.status === 'COMPLETED'
          const isBusy = thread.status === 'RUNNING'
          const isErr = thread.status === 'ERROR'

          return (
            <div
              key={thread.id}
              className={cn(
                'flex items-start justify-between rounded-lg border p-2.5 transition-all text-xs',
                isDone && 'border-emerald-500/30 bg-emerald-950/20 text-slate-200',
                isBusy && 'border-teal-500/50 bg-teal-950/30 text-white animate-pulse',
                isErr && 'border-rose-500/40 bg-rose-950/20 text-rose-200',
                thread.status === 'PENDING' && 'border-slate-800 bg-slate-950/40 text-slate-500'
              )}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5">
                  {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />}
                  {isDone && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                  {isErr && <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />}
                  {thread.status === 'PENDING' && (
                    <div className="h-3 w-3 rounded-full border border-slate-700 bg-slate-800" />
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">{thread.label}</span>
                    <span className="rounded bg-slate-800 px-1 py-0.2 text-[9px] font-mono text-slate-400">
                      Thread #{thread.id}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 leading-snug">
                    {thread.details}
                  </p>
                </div>
              </div>

              <div className="text-right">
                {thread.durationMs > 0 ? (
                  <span className="font-mono text-[10px] text-teal-400 font-medium">
                    {thread.durationMs}ms
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-600 font-mono">—</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer Info */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-[10.5px] text-slate-400">
        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Automated Backup & Regulatory Shield Active</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs text-teal-400 hover:text-teal-300 underline underline-offset-2"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}
