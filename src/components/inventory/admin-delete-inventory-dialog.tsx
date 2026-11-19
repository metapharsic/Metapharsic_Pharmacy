'use client'

/**
 * Admin Delete Inventory Dialog
 * Double-confirmation barrier restricted strictly to Admin users.
 * Displays a typed confirmation ("DELETE") before proceeding.
 * Shows the 5 worker-thread execution status after deletion.
 */

import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Lock,
  Loader2,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/lib/hooks/use-toast'
import type { InventoryRow } from './inventory-table'

// ─── Thread Info Types ────────────────────────────────────────

interface ThreadInfo {
  threadId: string
  name: string
  pid: number
  status: 'COMPLETED' | 'RUNNING' | 'FAILED'
  executionDurationMs: number
  memoryUsageMb: number
}

const THREAD_DISPLAY_NAMES: Record<string, { label: string; color: string }> = {
  THREAD_ADMIN_RBAC_AUTHORITY:         { label: 'RBAC Authority',        color: 'text-violet-600'  },
  THREAD_STOCK_AND_CAS_INTEGRITY:      { label: 'Stock & CAS Integrity', color: 'text-blue-600'    },
  THREAD_TRANSACTIONAL_INVENTORY_MUTATOR: { label: 'Inventory Mutator', color: 'text-emerald-600' },
  THREAD_RACK_AND_STORAGE_SYNC:        { label: 'Rack Storage Sync',     color: 'text-amber-600'   },
  THREAD_AUDIT_LEDGER_AND_VALUATION:   { label: 'Audit Ledger',          color: 'text-rose-600'    },
}

// ─── Thread Status Strip ──────────────────────────────────────

function ThreadStatusStrip({ threads }: { threads: ThreadInfo[] }) {
  if (!threads || threads.length === 0) return null

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-2 space-y-1.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Multi-Thread Execution Status
        </span>
      </div>
      {threads.map((t) => {
        const display = THREAD_DISPLAY_NAMES[t.threadId] ?? { label: t.name, color: 'text-foreground' }
        const isOk = t.status === 'COMPLETED'
        const isFail = t.status === 'FAILED'
        return (
          <div
            key={t.threadId}
            className="flex items-center gap-2 rounded px-2 py-1 bg-background border border-border/40"
          >
            {isFail ? (
              <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
            ) : isOk ? (
              <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${display.color}`} />
            ) : (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
            )}
            <span className={`flex-1 text-[11px] font-medium ${display.color} truncate`}>
              {display.label}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
              {t.executionDurationMs}ms
            </span>
            <Badge
              variant={isOk ? 'success' : isFail ? 'destructive' : 'default'}
              className="text-[10px] h-4 px-1.5"
            >
              {t.status}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
              {t.memoryUsageMb.toFixed(1)} MB
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Dialog ─────────────────────────────────────────────

const CONFIRM_PHRASE = 'DELETE'

export interface AdminDeleteInventoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: InventoryRow | null
  isAdmin: boolean
  onDeleted?: () => void
}

export function AdminDeleteInventoryDialog({
  open,
  onOpenChange,
  row,
  isAdmin,
  onDeleted,
}: AdminDeleteInventoryDialogProps) {
  const toast = useToast()
  const [confirmText, setConfirmText] = useState('')
  const [reason, setReason] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletedThreads, setDeletedThreads] = useState<ThreadInfo[] | null>(null)
  const [merkleRoot, setMerkleRoot] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) {
      setConfirmText('')
      setReason('')
      setDeletedThreads(null)
      setMerkleRoot(null)
      setDone(false)
    }
  }, [open])

  const isConfirmed = confirmText === CONFIRM_PHRASE

  const handleDelete = async () => {
    if (!row || !isAdmin || !isConfirmed) return

    setIsDeleting(true)
    setDeletedThreads(null)

    try {
      const reasonParam = encodeURIComponent(reason.trim() || 'Admin Inventory Removal')
      const res = await fetch(`/api/inventory/${row.id}?reason=${reasonParam}`, {
        method: 'DELETE',
      })

      const data = (await res.json()) as {
        success?: boolean
        threads?: ThreadInfo[]
        merkleRoot?: string
        error?: { message?: string }
      }

      if (!res.ok || !data.success) {
        const msg = data.error?.message || 'Deletion failed'
        throw new Error(msg)
      }

      setDeletedThreads(data.threads ?? null)
      setMerkleRoot(data.merkleRoot ?? null)
      setDone(true)
      toast.success(`${row.product.name} has been safely removed from inventory.`)
      onDeleted?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(msg)
      if (msg.toLowerCase().includes('forbidden')) {
        toast.error('Only Admin users can delete inventory items')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const handleClose = () => {
    if (!isDeleting) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-destructive">
            <Trash2 className="h-4 w-4" />
            Delete Inventory Item
            {!isAdmin && (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5 flex items-center gap-1">
                <Lock className="h-2.5 w-2.5" />
                Admin Only
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {!isAdmin && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">
              Deleting inventory items is strictly restricted to Admin users. You do not have the required role.
            </p>
          </div>
        )}

        {!done ? (
          <>
            {/* Warning block */}
            <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
              <div className="text-sm">
                <p className="font-semibold text-amber-700">This action will deactivate the item and zero its stock.</p>
                <p className="text-amber-600 mt-0.5 text-xs">
                  All active batches for{' '}
                  <strong>{row?.product.name ?? 'this item'}</strong> will be marked EXHAUSTED and the product deactivated.
                  This can be reversed by admin re-activation.
                </p>
                {row && (
                  <p className="text-amber-600 text-xs mt-1 font-mono">
                    Current stock: <strong>{row.availableQuantity}</strong> units &nbsp;·&nbsp; Branch:{' '}
                    <strong>{row.branch.name}</strong>
                  </p>
                )}
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1">
              <Label htmlFor="del-reason" className="text-xs">Reason for Removal <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="del-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={!isAdmin || isDeleting}
                placeholder="e.g., Discontinued medicine, damaged stock..."
                className="text-sm"
              />
            </div>

            {/* Double-confirm barrier */}
            <div className="space-y-1">
              <Label htmlFor="del-confirm" className="text-xs">
                Type <span className="font-mono font-bold text-destructive">{CONFIRM_PHRASE}</span> to confirm deletion
              </Label>
              <Input
                id="del-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                disabled={!isAdmin || isDeleting}
                placeholder={`Type ${CONFIRM_PHRASE} here`}
                className={`text-sm font-mono ${isConfirmed ? 'border-destructive ring-1 ring-destructive/40' : ''}`}
                autoComplete="off"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={handleClose} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={!isAdmin || !isConfirmed || isDeleting}
                className="gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Deleting via 5 Threads…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Confirm Delete
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* Deletion result */}
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
              <div className="text-sm">
                <p className="font-semibold text-emerald-700">Item successfully deleted & deactivated</p>
                <p className="text-xs text-emerald-600 mt-0.5">{row?.product.name} has been removed from active inventory.</p>
              </div>
            </div>

            {deletedThreads && <ThreadStatusStrip threads={deletedThreads} />}

            {merkleRoot && (
              <p className="text-[10px] font-mono text-muted-foreground break-all">
                Integrity Hash: {merkleRoot}
              </p>
            )}

            <DialogFooter>
              <Button size="sm" onClick={handleClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

